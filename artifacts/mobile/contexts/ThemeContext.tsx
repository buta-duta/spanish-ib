import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  THEME_STORAGE_KEY,
  THEMES,
  type Theme,
  getThemeById,
} from "@/constants/themes";

type ThemeContextType = {
  selectedTheme: Theme | null;
  usedThemes: string[];
  selectTheme: (themeId: string) => Promise<void>;
  selectRandomTheme: () => Promise<Theme>;
  clearSelectedTheme: () => void;
  getNextSuggestedTheme: () => Theme;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
  const [usedThemes, setUsedThemes] = useState<string[]>([]);

  useEffect(() => {
    loadUsedThemes();
  }, []);

  const loadUsedThemes = async () => {
    try {
      const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setUsedThemes(parsed);
      }
    } catch (e) {
      console.error("Failed to load used themes:", e);
    }
  };

  const saveUsedThemes = async (themes: string[]) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themes));
    } catch (e) {
      console.error("Failed to save used themes:", e);
    }
  };

  const selectTheme = useCallback(
    async (themeId: string) => {
      const theme = getThemeById(themeId);
      if (!theme) return;

      setSelectedTheme(theme);

      let newUsed = [...usedThemes];
      if (!newUsed.includes(themeId)) {
        newUsed.push(themeId);
      }
      if (newUsed.length >= THEMES.length) {
        newUsed = [themeId];
      }

      setUsedThemes(newUsed);
      await saveUsedThemes(newUsed);
    },
    [usedThemes]
  );

  const selectRandomTheme = useCallback(async (): Promise<Theme> => {
    let available = THEMES.filter((t) => !usedThemes.includes(t.id));

    if (available.length === 0) {
      available = THEMES;
      const randomTheme = available[Math.floor(Math.random() * available.length)];
      const newUsed = [randomTheme.id];
      setUsedThemes(newUsed);
      await saveUsedThemes(newUsed);
      setSelectedTheme(randomTheme);
      return randomTheme;
    }

    const randomTheme = available[Math.floor(Math.random() * available.length)];
    const newUsed = [...usedThemes, randomTheme.id];
    const finalUsed = newUsed.length >= THEMES.length ? [randomTheme.id] : newUsed;
    setUsedThemes(finalUsed);
    await saveUsedThemes(finalUsed);
    setSelectedTheme(randomTheme);
    return randomTheme;
  }, [usedThemes]);

  const clearSelectedTheme = useCallback(() => {
    setSelectedTheme(null);
  }, []);

  const getNextSuggestedTheme = useCallback((): Theme => {
    const remaining = THEMES.filter((t) => !usedThemes.includes(t.id));
    if (remaining.length === 0) {
      return THEMES[0];
    }
    return remaining[0];
  }, [usedThemes]);

  return (
    <ThemeContext.Provider
      value={{
        selectedTheme,
        usedThemes,
        selectTheme,
        selectRandomTheme,
        clearSelectedTheme,
        getNextSuggestedTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useIBTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useIBTheme must be used inside ThemeProvider");
  return ctx;
}
