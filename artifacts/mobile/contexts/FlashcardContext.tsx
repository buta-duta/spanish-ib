import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "@ib_spanish_flashcards_v1";

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
  const [cards, setCards] = useState<Flashcard[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => { if (raw) setCards(JSON.parse(raw)); })
      .catch(() => {});
  }, []);

  const persist = useCallback(async (next: Flashcard[]) => {
    setCards(next);
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }, []);

  const addCard = useCallback(async (
    word: string,
    data: { meaning: string; phonetic: string; partOfSpeech: string }
  ): Promise<"added" | "duplicate"> => {
    const key = word.toLowerCase().trim();
    const exists = cards.some((c) => c.word.toLowerCase() === key);
    if (exists) return "duplicate";
    const card: Flashcard = {
      id: `fc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      word: word.trim(),
      meaning: data.meaning,
      phonetic: data.phonetic,
      partOfSpeech: data.partOfSpeech,
      addedAt: Date.now(),
    };
    await persist([card, ...cards]);
    return "added";
  }, [cards, persist]);

  const removeCard = useCallback(async (id: string) => {
    await persist(cards.filter((c) => c.id !== id));
  }, [cards, persist]);

  const clearAll = useCallback(async () => {
    await persist([]);
  }, [persist]);

  const hasWord = useCallback((word: string) => {
    return cards.some((c) => c.word.toLowerCase() === word.toLowerCase().trim());
  }, [cards]);

  return (
    <FlashcardContext.Provider value={{ cards, addCard, removeCard, clearAll, hasWord }}>
      {children}
    </FlashcardContext.Provider>
  );
}

export function useFlashcards(): FlashcardContextType {
  const ctx = useContext(FlashcardContext);
  if (!ctx) throw new Error("useFlashcards must be used inside FlashcardProvider");
  return ctx;
}
