import React, { createContext, useContext } from "react";

import { useProgress } from "@/contexts/ProgressContext";

export type Flashcard = {
  id: string;
  word: string;
  meaning: string;
  phonetic: string;
  partOfSpeech: string;
  addedAt: number;
};

type FlashcardContextType = {
  cards: Flashcard[];
  addCard: (word: string, data: { meaning: string; phonetic: string; partOfSpeech: string }) => Promise<"added" | "duplicate">;
  removeCard: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  hasWord: (word: string) => boolean;
};

const FlashcardContext = createContext<FlashcardContextType | null>(null);

export function FlashcardProvider({ children }: { children: React.ReactNode }) {
  const progress = useProgress();
  return (
    <FlashcardContext.Provider
      value={{
        cards: progress.flashcards,
        addCard: progress.addFlashcard,
        removeCard: progress.removeFlashcard,
        clearAll: progress.clearFlashcards,
        hasWord: progress.hasFlashcardWord,
      }}
    >
      {children}
    </FlashcardContext.Provider>
  );
}

export function useFlashcards(): FlashcardContextType {
  const ctx = useContext(FlashcardContext);
  if (!ctx) throw new Error("useFlashcards must be used inside FlashcardProvider");
  return ctx;
}
