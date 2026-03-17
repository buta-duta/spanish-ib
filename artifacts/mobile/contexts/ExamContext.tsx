import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { SESSION_STORAGE_KEY } from "@/constants/themes";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

export type ExamSession = {
  id: string;
  themeId: string;
  themeName: string;
  messages: Message[];
  startedAt: number;
  completedAt?: number;
  wasRepeated: boolean;
};

let messageCounter = 0;
export function generateMsgId(): string {
  messageCounter++;
  return `msg-${Date.now()}-${messageCounter}-${Math.random().toString(36).substr(2, 9)}`;
}

type ExamContextType = {
  currentSession: ExamSession | null;
  sessions: ExamSession[];
  startSession: (themeId: string, themeName: string, wasRepeated: boolean) => ExamSession;
  addMessage: (message: Omit<Message, "id" | "timestamp">) => Message;
  endSession: () => Promise<ExamSession | null>;
  loadSessions: () => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  clearCurrentSession: () => void;
};

const ExamContext = createContext<ExamContextType | null>(null);

export function ExamProvider({ children }: { children: React.ReactNode }) {
  const [currentSession, setCurrentSession] = useState<ExamSession | null>(null);
  const [sessions, setSessions] = useState<ExamSession[]>([]);

  const loadSessions = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        setSessions(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load sessions:", e);
    }
  }, []);

  const startSession = useCallback(
    (themeId: string, themeName: string, wasRepeated: boolean): ExamSession => {
      const session: ExamSession = {
        id: `session-${Date.now()}`,
        themeId,
        themeName,
        messages: [],
        startedAt: Date.now(),
        wasRepeated,
      };
      setCurrentSession(session);
      return session;
    },
    []
  );

  const addMessage = useCallback(
    (msg: Omit<Message, "id" | "timestamp">): Message => {
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
    },
    []
  );

  const endSession = useCallback(async (): Promise<ExamSession | null> => {
    if (!currentSession) return null;

    const completed: ExamSession = {
      ...currentSession,
      completedAt: Date.now(),
    };

    try {
      const stored = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
      const existing: ExamSession[] = stored ? JSON.parse(stored) : [];
      const updated = [completed, ...existing].slice(0, 50);
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
      setSessions(updated);
    } catch (e) {
      console.error("Failed to save session:", e);
    }

    setCurrentSession(null);
    return completed;
  }, [currentSession]);

  const deleteSession = useCallback(async (id: string) => {
    try {
      const stored = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
      const existing: ExamSession[] = stored ? JSON.parse(stored) : [];
      const updated = existing.filter((s) => s.id !== id);
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
      setSessions(updated);
    } catch (e) {
      console.error("Failed to delete session:", e);
    }
  }, []);

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
