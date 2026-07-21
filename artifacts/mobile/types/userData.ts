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
  /** Separate learning feedback shown outside the examiner reply */
  kind?: "english-tip" | "mistake-tip";
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
