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
};
