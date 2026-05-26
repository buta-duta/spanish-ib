import type { Request, Response, NextFunction } from "express";
import { verifySiteSessionToken } from "../siteAuth";

const OPEN_PATHS = new Set(["/healthz", "/auth/unlock"]);

export function requireSiteAuth(req: Request, res: Response, next: NextFunction) {
  if (OPEN_PATHS.has(req.path)) {
    return next();
  }

  const header = req.headers.authorization;
  const token =
    typeof header === "string" && header.startsWith("Bearer ")
      ? header.slice(7)
      : typeof req.headers["x-site-token"] === "string"
        ? req.headers["x-site-token"]
        : undefined;

  if (verifySiteSessionToken(token)) {
    return next();
  }

  return res.status(401).json({ error: "Unauthorized. Enter the site password." });
}
