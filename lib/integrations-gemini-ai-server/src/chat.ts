import type { Content } from "@google/genai";
import { getGemini, MODEL_FLASH, MODEL_PRO } from "./client.js";

export type ChatRole = "system" | "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

function splitSystem(messages: ChatMessage[]): {
  system?: string;
  turns: ChatMessage[];
} {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  return {
    system: system || undefined,
    turns: messages.filter((m) => m.role !== "system"),
  };
}

function toContents(turns: ChatMessage[]): Content[] {
  return turns.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

export async function completeChat(
  messages: ChatMessage[],
  opts?: {
    model?: "flash" | "pro";
    maxOutputTokens?: number;
    temperature?: number;
    json?: boolean;
  },
): Promise<string> {
  const ai = getGemini();
  const { system, turns } = splitSystem(messages);
  const model = opts?.model === "pro" ? MODEL_PRO : MODEL_FLASH;

  const response = await ai.models.generateContent({
    model,
    contents: toContents(turns),
    config: {
      ...(system ? { systemInstruction: system } : {}),
      maxOutputTokens: opts?.maxOutputTokens,
      temperature: opts?.temperature,
      ...(opts?.json ? { responseMimeType: "application/json" } : {}),
    },
  });

  return response.text ?? "";
}

export async function* streamChat(
  messages: ChatMessage[],
  opts?: { model?: "flash" | "pro"; maxOutputTokens?: number },
): AsyncGenerator<string> {
  const ai = getGemini();
  const { system, turns } = splitSystem(messages);
  const model = opts?.model === "pro" ? MODEL_PRO : MODEL_FLASH;

  const stream = await ai.models.generateContentStream({
    model,
    contents: toContents(turns),
    config: {
      ...(system ? { systemInstruction: system } : {}),
      maxOutputTokens: opts?.maxOutputTokens,
    },
  });

  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) yield text;
  }
}
