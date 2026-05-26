import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

let loaded = false;

/** Load repo-root `.env` then `.env.local` (local dev). Vercel uses dashboard env vars. */
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  config({ path: resolve(root, ".env") });
  config({ path: resolve(root, ".env.local"), override: true });
}

export function requireEnv(name: "OPENAI_API_KEY" | "SITE_PASSWORD"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set. Copy .env.example to .env and add your values.`);
  }
  return value;
}
