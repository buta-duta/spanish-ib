import type { Response } from "express";

type OpenAIErrorLike = {
  status?: number;
  code?: string | null;
  type?: string | null;
  requestID?: string;
  error?: {
    message?: string;
    type?: string | null;
    code?: string | null;
  };
  message?: string;
};

export function getOpenAIErrorPayload(err: unknown) {
  const e = err as OpenAIErrorLike;
  const status = typeof e?.status === "number" ? e.status : undefined;

  const code =
    typeof e?.code === "string"
      ? e.code
      : typeof e?.error?.code === "string"
        ? e.error.code
        : undefined;

  const type =
    typeof e?.type === "string"
      ? e.type
      : typeof e?.error?.type === "string"
        ? e.error.type
        : undefined;

  const message =
    typeof e?.error?.message === "string"
      ? e.error.message
      : typeof e?.message === "string"
        ? e.message
        : "Unknown error";

  const requestId = typeof e?.requestID === "string" ? e.requestID : undefined;

  return {
    status,
    code,
    type,
    message,
    requestId,
  };
}

export function sendOpenAIError(res: Response, err: unknown, fallbackMessage: string) {
  const payload = getOpenAIErrorPayload(err);
  const status = payload.status && payload.status >= 400 ? payload.status : 500;
  return res.status(status).json({
    error: fallbackMessage,
    openai: payload,
  });
}

