// #region agent log
const _AGENT_INGEST =
  "http://127.0.0.1:7446/ingest/1c36d822-da85-4a38-a54b-515e251fb3b4";

export function agentLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>,
  runId = "pre-fix",
) {
  fetch(_AGENT_INGEST, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "9a5c13",
    },
    body: JSON.stringify({
      sessionId: "9a5c13",
      runId,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
// #endregion
