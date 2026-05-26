import AsyncStorage from "@react-native-async-storage/async-storage";

import { SESSION_STORAGE_KEY } from "@/constants/themes";
import type { UserProgressStore } from "@/types/progress";
import { EMPTY_PROGRESS } from "@/types/progress";

export const PROGRESS_STORAGE_KEY = "@ib_user_progress_v2";
const LEGACY_FLASHCARDS_KEY = "@ib_spanish_flashcards_v1";

function normalizeStore(parsed: Partial<UserProgressStore>): UserProgressStore {
  return {
    version: 2,
    flashcards: Array.isArray(parsed.flashcards) ? parsed.flashcards : [],
    examSessions: Array.isArray(parsed.examSessions) ? parsed.examSessions : [],
    modules: parsed.modules && typeof parsed.modules === "object" ? parsed.modules : {},
    sessionSummaries: Array.isArray(parsed.sessionSummaries) ? parsed.sessionSummaries : [],
    weakAreas: Array.isArray(parsed.weakAreas) ? parsed.weakAreas : [],
  };
}

export async function loadProgressStore(): Promise<UserProgressStore> {
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_STORAGE_KEY);
    if (raw) {
      return normalizeStore(JSON.parse(raw) as Partial<UserProgressStore>);
    }
  } catch (e) {
    console.error("loadProgressStore failed:", e);
  }
  return migrateLegacyStorage();
}

export async function saveProgressStore(store: UserProgressStore): Promise<void> {
  await AsyncStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(store));
}

async function migrateLegacyStorage(): Promise<UserProgressStore> {
  const store: UserProgressStore = { ...EMPTY_PROGRESS };
  try {
    const [sessionsRaw, cardsRaw] = await Promise.all([
      AsyncStorage.getItem(SESSION_STORAGE_KEY),
      AsyncStorage.getItem(LEGACY_FLASHCARDS_KEY),
    ]);
    if (sessionsRaw) store.examSessions = JSON.parse(sessionsRaw);
    if (cardsRaw) store.flashcards = JSON.parse(cardsRaw);
    if (sessionsRaw || cardsRaw) await saveProgressStore(store);
  } catch (e) {
    console.error("migrateLegacyStorage failed:", e);
  }
  return store;
}
