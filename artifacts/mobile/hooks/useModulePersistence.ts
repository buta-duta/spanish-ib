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
  const snapshotKey = JSON.stringify(snapshotData);

  useEffect(() => {
    if (!progress.loaded || !enabled || phase === "setup") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void progress.saveModuleSnapshot(moduleId, phase, JSON.parse(snapshotKey) as Record<string, unknown>);
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [progress.loaded, enabled, moduleId, phase, snapshotKey, progress.saveModuleSnapshot]);

  return {
    weakPractice,
    snapshot: progress.getModuleSnapshot(moduleId),
    clearSnapshot: () => progress.clearModuleSnapshot(moduleId),
    weakAreas: progress.getWeakAreas(moduleId),
    generalWeakAreas: progress.getWeakAreas("general"),
    latestSummary: progress.getLatestSummary(moduleId),
  };
}
