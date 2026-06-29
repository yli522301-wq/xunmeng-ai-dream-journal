import { Router, type IRouter } from "express";
import { createHash } from "crypto";

const router: IRouter = Router();

function getAnonId(req: unknown): string {
  return (req as { anonymousId: string }).anonymousId;
}

/**
 * GET /api/session/ns
 *
 * Returns a short opaque namespace token (16 hex chars) derived from the
 * server-side anonymousId.  The frontend uses this as a localStorage prefix
 * so that dream data is isolated per session and survives cookie rotation
 * only on the same session — never leaking between different users sharing
 * the same browser profile.
 *
 * The token is deterministic for the same session so it survives page
 * refreshes without a round-trip cost after the first fetch.
 */
router.get("/session/ns", (req, res): void => {
  const anonId = getAnonId(req);
  if (!anonId) {
    res.status(401).json({ error: "no session" });
    return;
  }
  const ns = createHash("sha256").update(anonId).digest("hex").slice(0, 16);
  res.json({ ns });
});

export default router;
