import type { GenerateContentResponse } from "@google/genai";
import { Buffer } from "node:buffer";
import { spawn } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";

import { getGemini, MODEL_FLASH, MODEL_TTS } from "../client.js";

export type AudioFormat = "wav" | "mp3" | "webm" | "mp4" | "ogg" | "unknown";

const GEMINI_VOICES: Record<string, string> = {
  alloy: "Kore",
  echo: "Charon",
  fable: "Fenrir",
  onyx: "Puck",
  nova: "Aoede",
  shimmer: "Aoede",
};

function geminiVoice(voice: string): string {
  return GEMINI_VOICES[voice] ?? GEMINI_VOICES.shimmer;
}

function mimeForExt(ext: string): string {
  const map: Record<string, string> = {
    wav: "audio/wav",
    mp3: "audio/mpeg",
    webm: "audio/webm",
    mp4: "audio/mp4",
    m4a: "audio/mp4",
    mpeg: "audio/mpeg",
    mpga: "audio/mpeg",
    ogg: "audio/ogg",
    flac: "audio/flac",
  };
  return map[ext.replace(/^\./, "").toLowerCase()] ?? "audio/wav";
}

function extractAudioBuffer(response: GenerateContentResponse): Buffer {
  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    const data = part.inlineData?.data;
    if (data) return Buffer.from(data, "base64");
  }
  throw new Error("No audio data in Gemini response");
}

export function detectAudioFormat(buffer: Buffer): AudioFormat {
  if (buffer.length < 12) return "unknown";

  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    return "wav";
  }
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return "webm";
  }
  if (
    (buffer[0] === 0xff && (buffer[1] === 0xfb || buffer[1] === 0xfa || buffer[1] === 0xf3)) ||
    (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33)
  ) {
    return "mp3";
  }
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    return "mp4";
  }
  if (buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
    return "ogg";
  }
  return "unknown";
}

export async function convertToWav(audioBuffer: Buffer): Promise<Buffer> {
  const inputPath = join(tmpdir(), `input-${randomUUID()}`);
  const outputPath = join(tmpdir(), `output-${randomUUID()}.wav`);

  try {
    await writeFile(inputPath, audioBuffer);

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i", inputPath,
        "-vn",
        "-f", "wav",
        "-ar", "16000",
        "-ac", "1",
        "-acodec", "pcm_s16le",
        "-y",
        outputPath,
      ]);

      ffmpeg.stderr.on("data", () => {});
      ffmpeg.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
      ffmpeg.on("error", reject);
    });

    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

export async function ensureCompatibleFormat(
  audioBuffer: Buffer,
): Promise<{ buffer: Buffer; format: "wav" | "mp3" }> {
  const detected = detectAudioFormat(audioBuffer);
  if (detected === "wav") return { buffer: audioBuffer, format: "wav" };
  if (detected === "mp3") return { buffer: audioBuffer, format: "mp3" };
  const wavBuffer = await convertToWav(audioBuffer);
  return { buffer: wavBuffer, format: "wav" };
}

async function synthesizeSpeech(
  text: string,
  voice: string,
  systemInstruction?: string,
): Promise<Buffer> {
  const ai = getGemini();
  const response = await ai.models.generateContent({
    model: MODEL_TTS,
    contents: [{ role: "user", parts: [{ text }] }],
    config: {
      ...(systemInstruction ? { systemInstruction } : {}),
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: geminiVoice(voice) },
        },
      },
    },
  });
  return extractAudioBuffer(response);
}

export async function textToSpeech(
  text: string,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  _format: "wav" | "mp3" | "flac" | "opus" | "pcm16" = "wav",
): Promise<Buffer> {
  return synthesizeSpeech(
    `Repeat the following text verbatim: ${text}`,
    voice,
    "You are an assistant that performs text-to-speech.",
  );
}

export async function textToSpeechExaminer(text: string): Promise<Buffer> {
  return synthesizeSpeech(
    `Di exactamente esto en voz alta, sin añadir nada extra: ${text}`,
    "shimmer",
    "Eres una examinadora del IB de habla hispana. Habla con entonación natural, cálida y profesional en español. Usa un ritmo conversacional auténtico con variación de tono. Evita sonar monótona o robótica.",
  );
}

export async function textToSpeechStream(
  text: string,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
): Promise<AsyncIterable<string>> {
  const buffer = await textToSpeech(text, voice, "pcm16");
  return (async function* () {
    yield buffer.toString("base64");
  })();
}

export async function speechToText(
  audioBuffer: Buffer,
  formatExt: string = "wav",
): Promise<string> {
  const ai = getGemini();
  const ext = formatExt.replace(/^\./, "").replace(/[^a-z0-9]/gi, "") || "wav";
  const response = await ai.models.generateContent({
    model: MODEL_FLASH,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: mimeForExt(ext),
              data: audioBuffer.toString("base64"),
            },
          },
          {
            text: "Transcribe the spoken Spanish in this audio. Return only the transcript text, with no labels or explanation.",
          },
        ],
      },
    ],
  });
  return (response.text ?? "").trim();
}

export async function speechToTextStream(
  audioBuffer: Buffer,
  formatExt: string = "wav",
): Promise<AsyncIterable<string>> {
  const text = await speechToText(audioBuffer, formatExt);
  return (async function* () {
    yield text;
  })();
}

export async function voiceChat(
  audioBuffer: Buffer,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  inputFormat: "wav" | "mp3" = "wav",
  _outputFormat: "wav" | "mp3" = "mp3",
): Promise<{ transcript: string; audioResponse: Buffer }> {
  const transcript = await speechToText(audioBuffer, inputFormat);
  const audioResponse = await textToSpeech(transcript || "...", voice, "mp3");
  return { transcript, audioResponse };
}

export async function voiceChatStream(
  audioBuffer: Buffer,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  inputFormat: "wav" | "mp3" = "wav",
): Promise<AsyncIterable<{ type: "transcript" | "audio"; data: string }>> {
  const { transcript, audioResponse } = await voiceChat(
    audioBuffer,
    voice,
    inputFormat,
  );
  return (async function* () {
    yield { type: "transcript", data: transcript };
    yield { type: "audio", data: audioResponse.toString("base64") };
  })();
}
