import { apiFetch, getApiUrl } from "@/lib/api";

const TTS_TIMEOUT_MS = 120_000;
const TTS_RETRIES = 2;

export type ListeningTtsResult = {
  audioBase64: string;
  isDualVoice?: boolean;
};

export async function fetchListeningTts(passage: string): Promise<ListeningTtsResult | null> {
  const url = `${getApiUrl()}api/listening/tts`;

  for (let attempt = 0; attempt < TTS_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);
    try {
      const res = await apiFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passage }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("TTS failed");
      const data = (await res.json()) as ListeningTtsResult;
      if (!data.audioBase64) throw new Error("Empty audio");
      return data;
    } catch {
      if (attempt === TTS_RETRIES - 1) return null;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}
