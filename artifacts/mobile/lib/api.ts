import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { fetch as expoFetch } from "expo/fetch";
import { Platform } from "react-native";

const AUTH_STORAGE_KEY = "ib_site_auth_token_v1";

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

function normalizeHost(domain: string): string {
  return domain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

export function getApiUrl(): string {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/`;
  }

  const fromEnv = process.env.EXPO_PUBLIC_DOMAIN;
  if (fromEnv) {
    return `https://${normalizeHost(fromEnv)}/`;
  }

  const fromExtra = Constants.expoConfig?.extra?.apiDomain as string | undefined;
  if (fromExtra) {
    return `https://${normalizeHost(fromExtra)}/`;
  }

  if (Platform.OS === "web") {
    return "/";
  }

  return "http://localhost:5000/";
}

async function readToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(AUTH_STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function getStoredAuthToken(): Promise<string | null> {
  return readToken();
}

export async function setStoredAuthToken(token: string) {
  await AsyncStorage.setItem(AUTH_STORAGE_KEY, token);
}

export async function clearStoredAuthToken() {
  await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
}

function connectionErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("Failed to fetch") || msg.includes("Network request failed")) {
    return "Sin conexión al servidor. Comprueba tu internet o prueba otra red.";
  }
  if (msg.includes("AbortError") || msg.includes("aborted")) {
    return "La conexión tardó demasiado. Inténtalo de nuevo.";
  }
  return "No se pudo conectar al servidor.";
}

export async function unlockSite(password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = `${getApiUrl()}api/auth/unlock`;
  try {
    const res = await globalThis.fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const serverMsg = body?.error as string | undefined;
      if (res.status === 500 && serverMsg?.includes("not configured")) {
        return { ok: false, error: "El servidor no tiene SITE_PASSWORD configurado." };
      }
      return { ok: false, error: serverMsg || "Contraseña incorrecta." };
    }
    const { token } = (await res.json()) as { token?: string };
    if (!token) return { ok: false, error: "Respuesta inválida del servidor." };
    await setStoredAuthToken(token);
    return { ok: true };
  } catch (err) {
    console.error("unlockSite failed:", url, err);
    return { ok: false, error: connectionErrorMessage(err) };
  }
}

function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = await readToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await globalThis.fetch(input, { ...init, headers });
  if (res.status === 401) {
    await clearStoredAuthToken();
    unauthorizedHandler?.();
  }
  return res;
}

export async function expoApiFetch(input: string, init?: RequestInit): Promise<Response> {
  const token = await readToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await expoFetch(input, { ...init, headers });
  if (res.status === 401) {
    await clearStoredAuthToken();
    unauthorizedHandler?.();
  }
  return res;
}
