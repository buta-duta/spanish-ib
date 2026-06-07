import type { ExamSession, Flashcard } from "@/types/userData";

export type ModuleId = "exam" | "listening" | "reading" | "writing" | "image";

export const MODULE_IDS: ModuleId[] = ["exam", "listening", "reading", "writing", "image"];

export const MODULE_LABELS: Record<ModuleId, string> = {
  exam: "Oral exam",
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  image: "Image practice",
};

export type MistakeItem = {
  id: string;
  category: string;
  description: string;
  example?: string;
  correction?: string;
  questionType?: string;
};

export type SessionSummary = {
  id: string;
  module: ModuleId;
  completedAt: number;
  summary: string;
  focusAreas: string[];
  mistakes: MistakeItem[];
  score?: { correct: number; total: number };
  mode?: "quick" | "full";
};

export type WeakArea = {
  tag: string;
  label: string;
  module: ModuleId | "general";
  count: number;
  lastSeen: number;
};

export type ModuleSnapshot = {
  phase: string;
  data: Record<string, unknown>;
  updatedAt: number;
};

export type UserProgressStore = {
  version: 2;
  flashcards: Flashcard[];
  examSessions: ExamSession[];
  modules: Partial<Record<ModuleId, ModuleSnapshot>>;
  sessionSummaries: SessionSummary[];
  weakAreas: WeakArea[];
};

export const EMPTY_PROGRESS: UserProgressStore = {
  version: 2,
  flashcards: [],
  examSessions: [],
  modules: {},
  sessionSummaries: [],
  weakAreas: [],
};
