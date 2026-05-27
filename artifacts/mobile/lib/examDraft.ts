import type { ExamMessage, ExamSession } from "@/types/userData";

export type ExamDraftSnapshot = {
  sessionId: string;
  themeId: string;
  themeName: string;
  level: "b" | "ab_initio";
  messages: ExamMessage[];
  sessionTurn: number;
  practiceFocus?: string;
  startedAt: number;
  wasRepeated: boolean;
};

export function isExamDraft(data: Record<string, unknown> | undefined): data is ExamDraftSnapshot {
  if (!data) return false;
  return (
    typeof data.sessionId === "string" &&
    Array.isArray(data.messages) &&
    data.messages.length > 0
  );
}

export function draftToSession(draft: ExamDraftSnapshot): ExamSession {
  return {
    id: draft.sessionId,
    themeId: draft.themeId,
    themeName: draft.themeName,
    level: draft.level,
    messages: draft.messages,
    startedAt: draft.startedAt,
    wasRepeated: draft.wasRepeated,
    practiceFocus: draft.practiceFocus,
    sessionTurn: draft.sessionTurn,
  };
}

export function sessionToDraft(
  session: ExamSession,
  sessionTurn: number,
): ExamDraftSnapshot {
  return {
    sessionId: session.id,
    themeId: session.themeId,
    themeName: session.themeName,
    level: session.level,
    messages: session.messages,
    sessionTurn,
    practiceFocus: session.practiceFocus,
    startedAt: session.startedAt,
    wasRepeated: session.wasRepeated,
  };
}
