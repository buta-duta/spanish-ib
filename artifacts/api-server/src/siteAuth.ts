import crypto from "node:crypto";

const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function sitePassword(): string {
  const value = process.env.SITE_PASSWORD;
  if (!value) {
    throw new Error("SITE_PASSWORD must be set in the environment.");
  }
  return value;
}

export function verifySitePassword(password: string): boolean {
  const expected = sitePassword();
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function createSiteSessionToken(): string {
  const secret = sitePassword();
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySiteSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  let secret: string;
  try {
    secret = sitePassword();
  } catch {
    return false;
  }
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  } catch {
    return false;
  }
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number };
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}
