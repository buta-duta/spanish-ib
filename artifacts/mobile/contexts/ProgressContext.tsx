import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { ExamSession } from "@/contexts/ExamContext";
import type { Flashcard } from "@/contexts/FlashcardContext";
import { useAuth } from "@/contexts/AuthContext";
import { localSessionSummary } from "@/lib/mistakes";
import { apiFetch, getApiUrl } from "@/lib/api";
import { loadProgressStore, saveProgressStore } from "@/lib/progressStorage";
import type {
  MistakeItem,
  ModuleId,
  ModuleSnapshot,
  SessionSummary,
  UserProgressStore,
  WeakArea,
} from "@/types/progress";
import { EMPTY_PROGRESS } from "@/types/progress";

type CompleteSessionInput = {
  module: ModuleId;
  mistakes: MistakeItem[];
  score?: { correct: number; total: number };
  clearSnapshot?: boolean;
};

type ProgressContextValue = {
  loaded: boolean;
  store: UserProgressStore;
  flashcards: Flashcard[];
  examSessions: ExamSession[];
  sessionSummaries: SessionSummary[];
  weakAreas: WeakArea[];
  addFlashcard: (
    word: string,
    data: { meaning: string; phonetic: string; partOfSpeech: string },
  ) => Promise<"added" | "duplicate">;
  removeFlashcard: (id: string) => Promise<void>;
  clearFlashcards: () => Promise<void>;
  hasFlashcardWord: (word: string) => boolean;
  setExamSessions: (sessions: ExamSession[]) => Promise<void>;
  saveExamSession: (session: ExamSession) => Promise<ExamSession[]>;
  deleteExamSession: (id: string) => Promise<void>;
  saveModuleSnapshot: (module: ModuleId, phase: string, data: Record<string, unknown>) => Promise<void>;
  getModuleSnapshot: (module: ModuleId) => ModuleSnapshot | undefined;
  clearModuleSnapshot: (module: ModuleId) => Promise<void>;
  completeSession: (input: CompleteSessionInput) => Promise<SessionSummary>;
  getWeakAreas: (module?: ModuleId | "general") => WeakArea[];
  getLatestSummary: (module: ModuleId) => SessionSummary | undefined;
  resetModule: (module: ModuleId) => Promise<void>;
  resetAll: () => Promise<void>;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

function upsertWeakAreas(existing: WeakArea[], module: ModuleId, tags: string[]): WeakArea[] {
  const next = [...existing];
  const now = Date.now();
  for (const tag of tags) {
    const label = tag.replace(/_/g, " ");
    const moduleKey: ModuleId | "general" = module;
    const idx = next.findIndex((w) => w.tag === tag && w.module === moduleKey);
    if (idx >= 0) {
      next[idx] = { ...next[idx], count: next[idx].count + 1, lastSeen: now, label };
    } else {
      next.push({ tag, label, module: moduleKey, count: 1, lastSeen: now });
    }
  }
  for (const tag of tags) {
    const label = tag.replace(/_/g, " ");
    const idx = next.findIndex((w) => w.tag === tag && w.module === "general");
    if (idx >= 0) {
      next[idx] = { ...next[idx], count: next[idx].count + 1, lastSeen: now, label };
    } else {
      next.push({ tag, label, module: "general", count: 1, lastSeen: now });
    }
  }
  return next.sort((a, b) => b.count - a.count || b.lastSeen - a.lastSeen).slice(0, 40);
}

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const { isUnlocked } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [store, setStore] = useState<UserProgressStore>(EMPTY_PROGRESS);
  const storeRef = useRef(store);
  storeRef.current = store;

  const persist = useCallback(async (next: UserProgressStore) => {
    storeRef.current = next;
    setStore(next);
    try {
      await saveProgressStore(next);
    } catch (e) {
      console.error("persist progress failed:", e);
    }
  }, []);

  const load = useCallback(async () => {
    const data = await loadProgressStore();
    storeRef.current = data;
    setStore(data);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (isUnlocked) {
      setLoaded(false);
      void load();
    } else {
      setStore(EMPTY_PROGRESS);
      setLoaded(false);
    }
  }, [isUnlocked, load]);

  const addFlashcard = useCallback(
    async (
      word: string,
      data: { meaning: string; phonetic: string; partOfSpeech: string },
    ): Promise<"added" | "duplicate"> => {
      const key = word.toLowerCase().trim();
      const current = storeRef.current;
      if (current.flashcards.some((c) => c.word.toLowerCase() === key)) return "duplicate";
      const card: Flashcard = {
        id: `fc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        word: word.trim(),
        meaning: data.meaning,
        phonetic: data.phonetic,
        partOfSpeech: data.partOfSpeech,
        addedAt: Date.now(),
      };
      await persist({ ...current, flashcards: [card, ...current.flashcards] });
      return "added";
    },
    [persist],
  );

  const removeFlashcard = useCallback(
    async (id: string) => {
      const current = storeRef.current;
      await persist({ ...current, flashcards: current.flashcards.filter((c) => c.id !== id) });
    },
    [persist],
  );

  const clearFlashcards = useCallback(async () => {
    await persist({ ...storeRef.current, flashcards: [] });
  }, [persist]);

  const hasFlashcardWord = useCallback((word: string) => {
    const key = word.toLowerCase().trim();
    return storeRef.current.flashcards.some((c) => c.word.toLowerCase() === key);
  }, []);

  const setExamSessions = useCallback(
    async (sessions: ExamSession[]) => {
      await persist({ ...storeRef.current, examSessions: sessions });
    },
    [persist],
  );

  const saveExamSession = useCallback(
    async (session: ExamSession) => {
      const current = storeRef.current;
      const updated = [session, ...current.examSessions.filter((s) => s.id !== session.id)].slice(0, 50);
      await persist({ ...current, examSessions: updated });
      return updated;
    },
    [persist],
  );

  const deleteExamSession = useCallback(
    async (id: string) => {
      const current = storeRef.current;
      await persist({ ...current, examSessions: current.examSessions.filter((s) => s.id !== id) });
    },
    [persist],
  );

  const saveModuleSnapshot = useCallback(
    async (module: ModuleId, phase: string, data: Record<string, unknown>) => {
      const current = storeRef.current;
      const snapshot: ModuleSnapshot = { phase, data, updatedAt: Date.now() };
      await persist({
        ...current,
        modules: { ...current.modules, [module]: snapshot },
      });
    },
    [persist],
  );

  const getModuleSnapshot = useCallback((module: ModuleId) => storeRef.current.modules[module], []);

  const clearModuleSnapshot = useCallback(
    async (module: ModuleId) => {
      const current = storeRef.current;
      const { [module]: _, ...rest } = current.modules;
      await persist({ ...current, modules: rest });
    },
    [persist],
  );

  const completeSession = useCallback(
    async (input: CompleteSessionInput): Promise<SessionSummary> => {
      const { module, mistakes, score, clearSnapshot = true } = input;
      let summaryText: string;
      let focusAreas: string[];

      try {
        const res = await apiFetch(`${getApiUrl()}api/progress/session-summary`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ module, mistakes, score }),
        });
        if (res.ok) {
          const body = (await res.json()) as { summary?: string; focusAreas?: string[] };
          summaryText = body.summary || localSessionSummary(mistakes, score).summary;
          focusAreas = body.focusAreas?.length ? body.focusAreas : localSessionSummary(mistakes, score).focusAreas;
        } else {
          const local = localSessionSummary(mistakes, score);
          summaryText = local.summary;
          focusAreas = local.focusAreas;
        }
      } catch {
        const local = localSessionSummary(mistakes, score);
        summaryText = local.summary;
        focusAreas = local.focusAreas;
      }

      const summary: SessionSummary = {
        id: `summary-${Date.now()}`,
        module,
        completedAt: Date.now(),
        summary: summaryText,
        focusAreas,
        mistakes,
        score,
      };

      const current = storeRef.current;
      const modules = { ...current.modules };
      if (clearSnapshot) delete modules[module];

      const weakAreas = upsertWeakAreas(current.weakAreas, module, focusAreas);
      const sessionSummaries = [summary, ...current.sessionSummaries].slice(0, 40);

      await persist({
        ...current,
        modules,
        sessionSummaries,
        weakAreas,
      });

      return summary;
    },
    [persist],
  );

  const getWeakAreas = useCallback((module?: ModuleId | "general") => {
    const all = storeRef.current.weakAreas;
    if (!module) return all;
    if (module === "general") return all.filter((w) => w.module === "general");
    return all.filter((w) => w.module === module || w.module === "general");
  }, []);

  const getLatestSummary = useCallback((module: ModuleId) => {
    return storeRef.current.sessionSummaries.find((s) => s.module === module);
  }, []);

  const resetModule = useCallback(
    async (module: ModuleId) => {
      const current = storeRef.current;
      const { [module]: _snap, ...modules } = current.modules;
      await persist({
        ...current,
        modules,
        sessionSummaries: current.sessionSummaries.filter((s) => s.module !== module),
        weakAreas: current.weakAreas.filter((w) => w.module !== module),
        examSessions: module === "exam" ? [] : current.examSessions,
      });
    },
    [persist],
  );

  const resetAll = useCallback(async () => {
    await persist({ ...EMPTY_PROGRESS });
  }, [persist]);

  const value = useMemo<ProgressContextValue>(
    () => ({
      loaded,
      store,
      flashcards: store.flashcards,
      examSessions: store.examSessions,
      sessionSummaries: store.sessionSummaries,
      weakAreas: store.weakAreas,
      addFlashcard,
      removeFlashcard,
      clearFlashcards,
      hasFlashcardWord,
      setExamSessions,
      saveExamSession,
      deleteExamSession,
      saveModuleSnapshot,
      getModuleSnapshot,
      clearModuleSnapshot,
      completeSession,
      getWeakAreas,
      getLatestSummary,
      resetModule,
      resetAll,
    }),
    [
      loaded,
      store,
      addFlashcard,
      removeFlashcard,
      clearFlashcards,
      hasFlashcardWord,
      setExamSessions,
      saveExamSession,
      deleteExamSession,
      saveModuleSnapshot,
      getModuleSnapshot,
      clearModuleSnapshot,
      completeSession,
      getWeakAreas,
      getLatestSummary,
      resetModule,
      resetAll,
    ],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress must be used inside ProgressProvider");
  return ctx;
}
