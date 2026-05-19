import fs from "node:fs";
import { Buffer } from "node:buffer";
import { getGemini } from "../client.js";

const IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL?.trim() || "imagen-3.0-generate-002";

export async function generateImageBuffer(
  prompt: string,
  _size: "1024x1024" | "512x512" | "256x256" = "1024x1024",
): Promise<Buffer> {
  const ai = getGemini();
  const response = await ai.models.generateImages({
    model: IMAGE_MODEL,
    prompt,
    config: { numberOfImages: 1 },
  });

  const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
  if (!imageBytes) throw new Error("No image data in Gemini response");
  return Buffer.from(imageBytes, "base64");
}

export async function editImages(
  imageFiles: string[],
  prompt: string,
  outputPath?: string,
): Promise<Buffer> {
  const buffers = await Promise.all(
    imageFiles.map((file) => fs.promises.readFile(file)),
  );
  const ai = getGemini();
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL_PRO?.trim() || "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          ...buffers.map((buf) => ({
            inlineData: { mimeType: "image/png", data: buf.toString("base64") },
          })),
          { text: prompt },
        ],
      },
    ],
    config: { responseModalities: ["IMAGE", "TEXT"] },
  });

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    const data = part.inlineData?.data;
    if (data) {
      const imageBytes = Buffer.from(data, "base64");
      if (outputPath) fs.writeFileSync(outputPath, imageBytes);
      return imageBytes;
    }
  }
  throw new Error("No edited image in Gemini response");
}
