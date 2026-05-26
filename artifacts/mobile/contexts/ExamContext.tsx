import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { useProgress } from "@/contexts/ProgressContext";
import type { ExamMessage, ExamSession } from "@/types/userData";

export type Message = ExamMessage;
export type { ExamSession };

let messageCounter = 0;
export function generateMsgId(): string {
  messageCounter++;
  return `msg-${Date.now()}-${messageCounter}-${Math.random().toString(36).substr(2, 9)}`;
}

type ExamContextType = {
  currentSession: ExamSession | null;
  sessions: ExamSession[];
  startSession: (themeId: string, themeName: string, wasRepeated: boolean, level: "b" | "ab_initio") => ExamSession;
  addMessage: (message: Omit<Message, "id" | "timestamp">) => Message;
  endSession: () => Promise<ExamSession | null>;
  loadSessions: () => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  clearCurrentSession: () => void;
};

const ExamContext = createContext<ExamContextType | null>(null);

export function ExamProvider({ children }: { children: React.ReactNode }) {
  const progress = useProgress();
  const [currentSession, setCurrentSession] = useState<ExamSession | null>(null);
  const [sessions, setSessions] = useState<ExamSession[]>([]);

  useEffect(() => {
    if (progress.loaded) {
      setSessions(progress.examSessions);
    }
  }, [progress.loaded, progress.examSessions]);

  const loadSessions = useCallback(async () => {
    if (progress.loaded) {
      setSessions(progress.examSessions);
    }
  }, [progress.loaded, progress.examSessions]);

  const startSession = useCallback(
    (themeId: string, themeName: string, wasRepeated: boolean, level: "b" | "ab_initio"): ExamSession => {
      const session: ExamSession = {
        id: `session-${Date.now()}`,
        themeId,
        themeName,
        level,
        messages: [],
        startedAt: Date.now(),
        wasRepeated,
      };
      setCurrentSession(session);
      return session;
    },
    [],
  );

  const addMessage = useCallback((msg: Omit<Message, "id" | "timestamp">): Message => {
    const message: Message = {
      ...msg,
      id: generateMsgId(),
      timestamp: Date.now(),
    };
    setCurrentSession((prev) => {
      if (!prev) return prev;
      return { ...prev, messages: [...prev.messages, message] };
    });
    return message;
  }, []);

  const endSession = useCallback(async (): Promise<ExamSession | null> => {
    if (!currentSession) return null;

    const completed: ExamSession = {
      ...currentSession,
      completedAt: Date.now(),
    };

    try {
      const updated = await progress.saveExamSession(completed);
      setSessions(updated);
    } catch (e) {
      console.error("Failed to save session:", e);
    }

    setCurrentSession(null);
    return completed;
  }, [currentSession, progress]);

  const deleteSession = useCallback(
    async (id: string) => {
      try {
        await progress.deleteExamSession(id);
        setSessions((prev) => prev.filter((s) => s.id !== id));
      } catch (e) {
        console.error("Failed to delete session:", e);
      }
    },
    [progress],
  );

  const clearCurrentSession = useCallback(() => {
    setCurrentSession(null);
  }, []);

  return (
    <ExamContext.Provider
      value={{
        currentSession,
        sessions,
        startSession,
        addMessage,
        endSession,
        loadSessions,
        deleteSession,
        clearCurrentSession,
      }}
    >
      {children}
    </ExamContext.Provider>
  );
}

export function useExam() {
  const ctx = useContext(ExamContext);
  if (!ctx) throw new Error("useExam must be used inside ExamProvider");
  return ctx;
}
