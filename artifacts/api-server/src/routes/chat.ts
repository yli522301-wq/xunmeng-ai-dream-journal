import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, chatMessagesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/chat/history", async (req, res): Promise<void> => {
  const characterId = typeof req.query.characterId === "string" ? req.query.characterId : undefined;
  const dreamId = typeof req.query.dreamId === "string" ? req.query.dreamId : undefined;
  const limitParam = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;
  const limit = isNaN(limitParam) ? 50 : Math.min(limitParam, 200);

  const conditions = [];
  if (characterId) conditions.push(eq(chatMessagesTable.characterId, characterId));
  if (dreamId) conditions.push(eq(chatMessagesTable.dreamId, dreamId));

  const messages = await db
    .select()
    .from(chatMessagesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(limit);

  res.json(messages.reverse());
});

router.delete("/chat/clear", async (req, res): Promise<void> => {
  const characterId = typeof req.query.characterId === "string" ? req.query.characterId : undefined;

  if (characterId) {
    await db
      .delete(chatMessagesTable)
      .where(eq(chatMessagesTable.characterId, characterId));
  } else {
    await db.delete(chatMessagesTable);
  }

  res.sendStatus(204);
});

export { router as chatRouter };
export default router;
