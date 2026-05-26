import OpenAI from "openai";

let client: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY must be set. Add it to your environment before starting the server.",
      );
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

/** Lazy proxy so auth routes can load without OPENAI_API_KEY at cold start. */
export const openai: OpenAI = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    const value = Reflect.get(getOpenAI(), prop, receiver);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(getOpenAI()) : value;
  },
});
