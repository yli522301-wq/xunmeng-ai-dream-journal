import type { Request, Response, NextFunction } from "express";
import { randomBytes } from "crypto";

const COOKIE_NAME = "xunmeng_session";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function generateSessionId(): string {
  return randomBytes(32).toString("hex");
}

function parseCookies(req: Request): Record<string, string> {
  const raw = req.headers.cookie;
  if (!raw) return {};
  const result: Record<string, string> = {};
  for (const pair of raw.split(";")) {
    const [key, ...rest] = pair.trim().split("=");
    if (key) result[key] = rest.join("=");
  }
  return result;
}

function serializeCookie(name: string, value: string, opts: {
  maxAge: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
}): string {
  let cookie = `${name}=${value}`;
  if (opts.maxAge >= 0) cookie += `; Max-Age=${Math.floor(opts.maxAge / 1000)}`;
  if (opts.httpOnly) cookie += "; HttpOnly";
  if (opts.secure) cookie += "; Secure";
  cookie += `; SameSite=${opts.sameSite}`;
  cookie += "; Path=/";
  return cookie;
}

/** Attach a server-generated anonymous session ID via HttpOnly Secure cookie.
 *  The session ID is not guessable by clients and is not derived from spoofable headers. */
export function sessionMiddleware(req: Request, res: Response, next: NextFunction): void {
  const cookies = parseCookies(req);
  let sessionId = cookies[COOKIE_NAME];

  if (!sessionId || !/^[0-9a-f]{64}$/.test(sessionId)) {
    sessionId = generateSessionId();
    const isProduction = process.env.NODE_ENV === "production";
    res.setHeader("Set-Cookie", serializeCookie(COOKIE_NAME, sessionId, {
      maxAge: ONE_YEAR_MS,
      httpOnly: true,
      secure: isProduction,
      sameSite: "Strict",
    }));
  }

  (req as Request & { anonymousId: string }).anonymousId = sessionId;
  next();
}
