import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import {
  anonymousSessionsTable,
  usageLimitsTable,
  rateLimitEntriesTable,
  requestLogsTable,
} from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";
import { createHash } from "crypto";

const RATE_LIMIT_PER_MINUTE = 5;
const CHAT_LIMIT_PER_DAY = 30;
const SONG_SEARCH_LIMIT_PER_DAY = 5;
const MAX_MESSAGE_LENGTH = 1000;
const RATE_WINDOW_MS = 60 * 1000;

export const errorMessages = {
  messageTooLong: "这段话有点长，可以分成几次慢慢告诉我。",
  tooFast: "慢一点，我还在听你刚刚说的话。",
  dailyChatLimit: "今天的梦聊得有点久啦，明天再继续吧。",
  dailySongLimit: "今天寻找歌曲故事的次数已经用完了，我们先聊聊这首歌带给你的感觉吧。",
  timeout: "刚刚的回应走丢了，没有产生额外重试，请稍后再试。",
  concurrent: "请等待上一条消息的回复完成。",
};

export type LimitErrorCode =
  | "message_too_long"
  | "rate_limit"
  | "daily_chat_limit"
  | "daily_song_limit"
  | "timeout"
  | "concurrent"
  | "unknown";

export interface LimitError {
  code: LimitErrorCode;
  error: string;
}

// In-memory concurrent request guard per anonymous session
const activeRequests = new Set<string>();

function getClientIp(req: Request): string | undefined {
  // req.ip is set by Express using the "trust proxy" setting configured in
  // app.ts.  With trust proxy = 1, Express strips the trusted proxy's own
  // address and returns the client IP that the proxy recorded — ignoring any
  // X-Forwarded-For values a client could have prepended before the proxy hop.
  return req.ip ?? req.socket.remoteAddress ?? undefined;
}

function hashIp(ip: string | undefined): string {
  if (!ip) return "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Resolve the anonymous session from the cookie-based sessionId set by sessionMiddleware.
 *  This identity cannot be minted by spoofing X-Forwarded-For or User-Agent because it is
 *  tied to an HttpOnly cookie issued by the server. */
function getAnonId(req: Request): string {
  return (req as Request & { anonymousId: string }).anonymousId;
}

async function ensureSessionRecord(req: Request): Promise<string> {
  const anonId = getAnonId(req);
  const ip = getClientIp(req);
  const ipHash = hashIp(ip);
  const ua = req.headers["user-agent"] ?? "";
  const lang = req.headers["accept-language"] ?? "";
  const deviceFp = createHash("sha256").update(ua + lang).digest("hex").slice(0, 16);

  const existing = await db
    .select()
    .from(anonymousSessionsTable)
    .where(eq(anonymousSessionsTable.id, anonId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(anonymousSessionsTable)
      .set({ lastActiveAt: new Date() })
      .where(eq(anonymousSessionsTable.id, anonId));
  } else {
    await db.insert(anonymousSessionsTable).values({
      id: anonId,
      ipHash,
      deviceFingerprint: deviceFp,
      createdAt: new Date(),
      lastActiveAt: new Date(),
    });
  }
  return anonId;
}

export async function checkMessageLength(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userInput = req.body?.userInput ?? req.body?.message ?? "";
  if (typeof userInput === "string" && userInput.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({
      error: errorMessages.messageTooLong,
      code: "message_too_long",
    } as unknown as LimitError);
    return;
  }
  next();
}

export async function checkRateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const anonId = await ensureSessionRecord(req);
  (req as Request & { anonymousId: string }).anonymousId = anonId;

  const windowStart = new Date(Date.now() - RATE_WINDOW_MS);

  const entries = await db
    .select()
    .from(rateLimitEntriesTable)
    .where(
      and(
        eq(rateLimitEntriesTable.anonymousId, anonId),
        gte(rateLimitEntriesTable.windowStart, windowStart)
      )
    );

  const totalInWindow = entries.reduce((sum, e) => sum + e.requestCount, 0);

  if (totalInWindow >= RATE_LIMIT_PER_MINUTE) {
    res.status(429).json({
      error: errorMessages.tooFast,
      code: "rate_limit",
    } as unknown as LimitError);
    return;
  }

  const now = new Date();
  const matchingWindow = entries.find(e =>
    Math.abs(e.windowStart.getTime() - now.getTime()) < 1000
  );

  if (matchingWindow) {
    await db
      .update(rateLimitEntriesTable)
      .set({ requestCount: matchingWindow.requestCount + 1 })
      .where(eq(rateLimitEntriesTable.id, matchingWindow.id));
  } else {
    await db.insert(rateLimitEntriesTable).values({
      id: crypto.randomUUID(),
      anonymousId: anonId,
      windowStart: now,
      requestCount: 1,
    });
  }

  next();
}

export async function checkDailyChatLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const anonId = getAnonId(req);
  if (!anonId) {
    next();
    return;
  }

  const today = getToday();
  const existing = await db
    .select()
    .from(usageLimitsTable)
    .where(
      and(
        eq(usageLimitsTable.anonymousId, anonId),
        eq(usageLimitsTable.limitDate, today)
      )
    )
    .limit(1);

  const record = existing[0];
  if (record && record.chatCount >= CHAT_LIMIT_PER_DAY) {
    res.status(429).json({
      error: errorMessages.dailyChatLimit,
      code: "daily_chat_limit",
    } as unknown as LimitError);
    return;
  }

  next();
}

export async function checkDailySongLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const anonId = getAnonId(req);
  if (!anonId) {
    next();
    return;
  }

  const today = getToday();
  const existing = await db
    .select()
    .from(usageLimitsTable)
    .where(
      and(
        eq(usageLimitsTable.anonymousId, anonId),
        eq(usageLimitsTable.limitDate, today)
      )
    )
    .limit(1);

  const record = existing[0];
  if (record && record.songSearchCount >= SONG_SEARCH_LIMIT_PER_DAY) {
    res.status(429).json({
      error: errorMessages.dailySongLimit,
      code: "daily_song_limit",
    } as unknown as LimitError);
    return;
  }

  next();
}

/** Inline version for route-level conditional checks (returns boolean instead of Express next). */
export async function checkDailySongLimitInline(req: Request): Promise<boolean> {
  const anonId = getAnonId(req);
  if (!anonId) return true;

  const today = getToday();
  const existing = await db
    .select()
    .from(usageLimitsTable)
    .where(
      and(
        eq(usageLimitsTable.anonymousId, anonId),
        eq(usageLimitsTable.limitDate, today)
      )
    )
    .limit(1);

  const record = existing[0];
  if (record && record.songSearchCount >= SONG_SEARCH_LIMIT_PER_DAY) {
    return false;
  }

  return true;
}

export async function checkConcurrentRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  const anonId = getAnonId(req);
  if (!anonId) {
    next();
    return;
  }

  if (activeRequests.has(anonId)) {
    res.status(429).json({
      error: errorMessages.concurrent,
      code: "concurrent",
    } as unknown as LimitError);
    return;
  }

  activeRequests.add(anonId);
  res.on("finish", () => activeRequests.delete(anonId));
  res.on("close", () => activeRequests.delete(anonId));
  next();
}

export async function incrementChatCount(req: Request): Promise<void> {
  const anonId = getAnonId(req);
  if (!anonId) return;

  const today = getToday();
  const existing = await db
    .select()
    .from(usageLimitsTable)
    .where(
      and(
        eq(usageLimitsTable.anonymousId, anonId),
        eq(usageLimitsTable.limitDate, today)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(usageLimitsTable)
      .set({
        chatCount: existing[0].chatCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(usageLimitsTable.id, existing[0].id));
  } else {
    await db.insert(usageLimitsTable).values({
      id: crypto.randomUUID(),
      anonymousId: anonId,
      limitDate: today,
      chatCount: 1,
      songSearchCount: 0,
      updatedAt: new Date(),
    });
  }
}

export async function incrementSongSearchCount(req: Request): Promise<void> {
  const anonId = getAnonId(req);
  if (!anonId) return;

  const today = getToday();
  const existing = await db
    .select()
    .from(usageLimitsTable)
    .where(
      and(
        eq(usageLimitsTable.anonymousId, anonId),
        eq(usageLimitsTable.limitDate, today)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(usageLimitsTable)
      .set({
        songSearchCount: existing[0].songSearchCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(usageLimitsTable.id, existing[0].id));
  } else {
    await db.insert(usageLimitsTable).values({
      id: crypto.randomUUID(),
      anonymousId: anonId,
      limitDate: today,
      chatCount: 0,
      songSearchCount: 1,
      updatedAt: new Date(),
    });
  }
}

export async function logRequest(
  req: Request,
  requestType: string,
  success: boolean,
  tokenUsage?: number,
  errorType?: string
): Promise<void> {
  const anonId = getAnonId(req);
  if (!anonId) return;

  try {
    await db.insert(requestLogsTable).values({
      id: crypto.randomUUID(),
      anonymousId: anonId,
      requestType,
      success: success ? "true" : "false",
      tokenUsage: tokenUsage ?? null,
      errorType: errorType ?? null,
      createdAt: new Date(),
    });
  } catch {
    // Silently fail logging — don't break the request
  }
}
