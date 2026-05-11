import { Platform } from "react-native";

function stripToHost(input: string): string {
  const s = input.trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) {
    try {
      return new URL(s).host;
    } catch {
      return s.replace(/^https?:\/\//i, "").split("/")[0] ?? "";
    }
  }
  return s.replace(/\/+$/, "");
}

export function getApiUrl(): string {
  const raw = process.env.EXPO_PUBLIC_DOMAIN;
  if (raw && String(raw).trim()) {
    const host = stripToHost(String(raw));
    if (host) return `https://${host}/`;
  }
  if (Platform.OS === "web") {
    if (typeof globalThis !== "undefined" && "location" in globalThis) {
      const loc = (globalThis as unknown as { location?: { origin?: string } }).location;
      if (loc?.origin) return `${loc.origin}/`;
    }
    return "/";
  }
  return "http://localhost:5000/";
}
