import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error(
    "OPENAI_API_KEY must be set. Add it to your environment before starting the server.",
  );
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});
