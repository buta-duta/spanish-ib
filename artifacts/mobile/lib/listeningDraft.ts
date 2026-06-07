import type { GradeMap, Paper } from "@/lib/paper";

export type ListeningPhase = "setup" | "listening" | "questions" | "review" | "paper";
export type ListeningExamMode = "quick" | "full";

export type ListeningQuestion = {
  id: string;
  type: "multiple-choice" | "true-false" | "short-answer" | "detail" | "inference";
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
};

export type ListeningAnswerRecord = {
  given: string;
  correct: boolean;
  feedback: string;
};

export type ListeningDraftSnapshot = {
  phase: ListeningPhase;
  examMode: ListeningExamMode;
  selectedThemeId: string;
  selectedType: string;
  manualPassage: string;
  customFocus: string;
  includeFlashcards: boolean;
  passageTitle: string;
  passageContext: string;
  passage: string;
  showPassage: boolean;
  playCount: number;
  maxPlays: number;
  unlimitedPlays: boolean;
  playbackSpeed: number;
  isDualVoice: boolean;
  numQuestions: number;
  questions: ListeningQuestion[];
  quickAnswers: Record<string, string>;
  answers: Record<string, ListeningAnswerRecord>;
  paper: Paper | null;
  paperAnswers: Record<string, string>;
  paperGrades: GradeMap;
  paperResult: { correct: number; total: number } | null;
};

export function isListeningDraft(data: Record<string, unknown> | undefined): data is ListeningDraftSnapshot {
  if (!data) return false;
  const phase = data.phase as string;
  if (phase === "setup" || phase === "review") return false;
  const hasPassage = typeof data.passage === "string" && data.passage.trim().length > 0;
  const hasPaper = !!data.paper && typeof data.paper === "object";
  return hasPassage || hasPaper;
}
