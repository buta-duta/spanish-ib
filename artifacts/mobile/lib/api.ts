import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetch as expoFetch } from "expo/fetch";
import { Platform } from "react-native";

const AUTH_STORAGE_KEY = "ib_site_auth_token_v1";

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function getApiUrl() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) {
    const host = domain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    return `https://${host}/`;
  }
  if (Platform.OS === "web") return "/";
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

export async function unlockSite(password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await globalThis.fetch(`${getApiUrl()}api/auth/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body?.error || "Contraseña incorrecta." };
    }
    const { token } = (await res.json()) as { token?: string };
    if (!token) return { ok: false, error: "Respuesta inválida del servidor." };
    await setStoredAuthToken(token);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo conectar al servidor." };
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
