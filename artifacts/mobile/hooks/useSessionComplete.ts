import { useEffect, useRef } from "react";

import { useProgress } from "@/contexts/ProgressContext";
import type { MistakeItem, ModuleId } from "@/types/progress";

export function useSessionComplete(
  moduleId: ModuleId,
  completePhase: string,
  phase: string,
  getMistakes: () => MistakeItem[],
  getScore?: () => { correct: number; total: number } | undefined,
  deps: unknown[] = [],
  ready = true,
  sessionMode?: "quick" | "full",
) {
  const progress = useProgress();
  const doneRef = useRef(false);

  useEffect(() => {
    if (phase !== completePhase) {
      doneRef.current = false;
      return;
    }
    if (!ready || !progress.loaded || doneRef.current) return;
    doneRef.current = true;
    void progress.completeSession({
      module: moduleId,
      mistakes: getMistakes(),
      score: getScore?.(),
      clearSnapshot: true,
      mode: sessionMode,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, completePhase, progress.loaded, moduleId, ready, ...deps]);
}
