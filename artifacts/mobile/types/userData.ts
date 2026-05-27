export type Flashcard = {
  id: string;
  word: string;
  meaning: string;
  phonetic: string;
  partOfSpeech: string;
  addedAt: number;
};

export type ExamMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  /** Short English-in-Spanish tip shown right after the student's message */
  kind?: "english-tip";
};

export type ExamSession = {
  id: string;
  themeId: string;
  themeName: string;
  level: "b" | "ab_initio";
  messages: ExamMessage[];
  startedAt: number;
  completedAt?: number;
  wasRepeated: boolean;
  practiceFocus?: string;
  sessionTurn?: number;
};
