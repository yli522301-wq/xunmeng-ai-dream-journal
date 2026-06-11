import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, dreamsTable } from "@workspace/db";
import {
  CreateDreamBody,
  UpdateDreamBody,
  UpdateDreamParams,
  DeleteDreamParams,
  GetDreamParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dreams/stats/summary", async (_req, res): Promise<void> => {
  const dreams = await db.select().from(dreamsTable);
  const moodBreakdown: Record<string, number> = {};
  const clarityBreakdown: Record<string, number> = {};
  let recurringCount = 0;
  const symFreq: Record<string, number> = {};

  for (const d of dreams) {
    moodBreakdown[d.mood] = (moodBreakdown[d.mood] ?? 0) + 1;
    clarityBreakdown[d.clarity] = (clarityBreakdown[d.clarity] ?? 0) + 1;
    if (d.isRecurring) recurringCount++;
    for (const s of d.symbols ?? []) symFreq[s] = (symFreq[s] ?? 0) + 1;
  }

  const recentSymbols = Object.entries(symFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([s]) => s);

  res.json({ total: dreams.length, moodBreakdown, clarityBreakdown, recurringCount, recentSymbols });
});

router.get("/dreams", async (_req, res): Promise<void> => {
  const dreams = await db.select().from(dreamsTable).orderBy(desc(dreamsTable.createdAt));
  res.json(dreams);
});

router.post("/dreams", async (req, res): Promise<void> => {
  const parsed = CreateDreamBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [dream] = await db
    .insert(dreamsTable)
    .values({
      title: parsed.data.title,
      content: parsed.data.content,
      mood: parsed.data.mood,
      clarity: parsed.data.clarity,
      isRecurring: parsed.data.isRecurring,
      characterId: parsed.data.characterId ?? null,
      summary: parsed.data.summary ?? null,
      symbols: parsed.data.symbols ?? [],
      emotionAnalysis: parsed.data.emotionAnalysis ?? null,
      possibleConnection: parsed.data.possibleConnection ?? null,
      companionReply: parsed.data.companionReply ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
    })
    .returning();

  res.status(201).json(dream);
});

router.get("/dreams/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetDreamParams.safeParse({ id: rawId });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [dream] = await db.select().from(dreamsTable).where(eq(dreamsTable.id, params.data.id));
  if (!dream) { res.status(404).json({ error: "Dream not found" }); return; }
  res.json(dream);
});

router.patch("/dreams/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateDreamParams.safeParse({ id: rawId });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateDreamBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const u: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) u.title = parsed.data.title;
  if (parsed.data.content !== undefined) u.content = parsed.data.content;
  if (parsed.data.mood !== undefined) u.mood = parsed.data.mood;
  if (parsed.data.clarity !== undefined) u.clarity = parsed.data.clarity;
  if (parsed.data.isRecurring !== undefined) u.isRecurring = parsed.data.isRecurring;
  if (parsed.data.characterId !== undefined) u.characterId = parsed.data.characterId;
  if (parsed.data.summary !== undefined) u.summary = parsed.data.summary;
  if (parsed.data.symbols !== undefined) u.symbols = parsed.data.symbols;
  if (parsed.data.emotionAnalysis !== undefined) u.emotionAnalysis = parsed.data.emotionAnalysis;
  if (parsed.data.possibleConnection !== undefined) u.possibleConnection = parsed.data.possibleConnection;
  if (parsed.data.companionReply !== undefined) u.companionReply = parsed.data.companionReply;
  if (parsed.data.imageUrl !== undefined) u.imageUrl = parsed.data.imageUrl;

  const [dream] = await db.update(dreamsTable).set(u).where(eq(dreamsTable.id, params.data.id)).returning();
  if (!dream) { res.status(404).json({ error: "Dream not found" }); return; }
  res.json(dream);
});

router.delete("/dreams/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteDreamParams.safeParse({ id: rawId });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  await db.delete(dreamsTable).where(eq(dreamsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
