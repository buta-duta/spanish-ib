import { GoogleGenAI } from "@google/genai";

let _gemini: GoogleGenAI | undefined;

export function getGemini(): GoogleGenAI {
  if (!_gemini) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is missing at runtime. In Vercel: Project → Settings → Environment Variables → add GEMINI_API_KEY for Production, Preview, or both, then redeploy.",
      );
    }
    _gemini = new GoogleGenAI({ apiKey });
  }
  return _gemini;
}

export const MODEL_FLASH =
  process.env.GEMINI_MODEL_FLASH?.trim() || "gemini-2.0-flash";
export const MODEL_PRO =
  process.env.GEMINI_MODEL_PRO?.trim() || "gemini-2.5-flash";
export const MODEL_TTS =
  process.env.GEMINI_MODEL_TTS?.trim() || "gemini-2.5-flash-preview-tts";
