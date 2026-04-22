import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type CurriculumLevel = "b" | "ab_initio";

const CURRICULUM_STORAGE_KEY = "ib_curriculum_level_v1";

type CurriculumContextType = {
  level: CurriculumLevel;
  setLevel: (next: CurriculumLevel) => Promise<void>;
  isAbInitio: boolean;
  levelLabel: string;
};

const CurriculumContext = createContext<CurriculumContextType | null>(null);

export function CurriculumProvider({ children }: { children: React.ReactNode }) {
  const [level, setLevelState] = useState<CurriculumLevel>("b");

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(CURRICULUM_STORAGE_KEY);
        if (stored === "b" || stored === "ab_initio") {
          setLevelState(stored);
        }
      } catch {}
    })();
  }, []);

  const setLevel = async (next: CurriculumLevel) => {
    setLevelState(next);
    try {
      await AsyncStorage.setItem(CURRICULUM_STORAGE_KEY, next);
    } catch {}
  };

  const value = useMemo(
    () => ({
      level,
      setLevel,
      isAbInitio: level === "ab_initio",
      levelLabel: level === "ab_initio" ? "IB Spanish Ab Initio" : "IB Spanish B",
    }),
    [level]
  );

  return <CurriculumContext.Provider value={value}>{children}</CurriculumContext.Provider>;
}

export function useCurriculum() {
  const ctx = useContext(CurriculumContext);
  if (!ctx) throw new Error("useCurriculum must be used inside CurriculumProvider");
  return ctx;
}
