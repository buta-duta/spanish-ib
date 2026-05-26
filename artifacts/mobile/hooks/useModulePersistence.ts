import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";

import { useProgress } from "@/contexts/ProgressContext";
import type { ModuleId } from "@/types/progress";

export function useWeakPracticeMode(): boolean {
  const params = useLocalSearchParams<{ practiceWeak?: string }>();
  return params.practiceWeak === "1";
}

export function useModulePersistence(
  moduleId: ModuleId,
  phase: string,
  snapshotData: Record<string, unknown>,
  enabled = true,
) {
  const progress = useProgress();
  const weakPractice = useWeakPracticeMode();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!progress.loaded || !enabled || phase === "setup") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void progress.saveModuleSnapshot(moduleId, phase, snapshotData);
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [progress.loaded, enabled, moduleId, phase, snapshotData, progress]);

  return {
    weakPractice,
    snapshot: progress.getModuleSnapshot(moduleId),
    clearSnapshot: () => progress.clearModuleSnapshot(moduleId),
    weakAreas: progress.getWeakAreas(moduleId),
    generalWeakAreas: progress.getWeakAreas("general"),
    latestSummary: progress.getLatestSummary(moduleId),
  };
}
