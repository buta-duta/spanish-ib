import OpenAI from "openai";

let _openai: OpenAI | undefined;

export function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is missing at runtime. In Vercel: Project → Settings → Environment Variables → add OPENAI_API_KEY for Production, Preview, or both, then redeploy.",
      );
    }
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

export const openai: OpenAI = new Proxy({} as OpenAI, {
  get(_target, prop: string | symbol) {
    const client = getOpenAI();
    const value = Reflect.get(client, prop, client);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
