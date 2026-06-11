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

router.get("/dreams/stats/summary", async (req, res): Promise<void> => {
  const dreams = await db.select().from(dreamsTable);

  const moodBreakdown: Record<string, number> = {};
  const clarityBreakdown: Record<string, number> = {};
  let recurringCount = 0;
  const keywordFreq: Record<string, number> = {};

  for (const d of dreams) {
    moodBreakdown[d.mood] = (moodBreakdown[d.mood] || 0) + 1;
    clarityBreakdown[d.clarity] = (clarityBreakdown[d.clarity] || 0) + 1;
    if (d.isRecurring) recurringCount++;
    for (const kw of d.keywords ?? []) {
      keywordFreq[kw] = (keywordFreq[kw] || 0) + 1;
    }
  }

  const recentKeywords = Object.entries(keywordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([kw]) => kw);

  res.json({
    total: dreams.length,
    moodBreakdown,
    clarityBreakdown,
    recurringCount,
    recentKeywords,
  });
});

router.get("/dreams", async (req, res): Promise<void> => {
  const dreams = await db
    .select()
    .from(dreamsTable)
    .orderBy(desc(dreamsTable.createdAt));
  res.json(dreams);
});

router.post("/dreams", async (req, res): Promise<void> => {
  const parsed = CreateDreamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [dream] = await db
    .insert(dreamsTable)
    .values({
      title: parsed.data.title,
      content: parsed.data.content,
      mood: parsed.data.mood,
      clarity: parsed.data.clarity,
      isRecurring: parsed.data.isRecurring,
      summary: parsed.data.summary ?? null,
      keywords: parsed.data.keywords ?? [],
      emotionAnalysis: parsed.data.emotionAnalysis ?? null,
      possibleConnection: parsed.data.possibleConnection ?? null,
      aiResponse: parsed.data.aiResponse ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
    })
    .returning();

  res.status(201).json(dream);
});

router.get("/dreams/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetDreamParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [dream] = await db
    .select()
    .from(dreamsTable)
    .where(eq(dreamsTable.id, params.data.id));

  if (!dream) {
    res.status(404).json({ error: "Dream not found" });
    return;
  }

  res.json(dream);
});

router.patch("/dreams/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateDreamParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateDreamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.content !== undefined) updateData.content = parsed.data.content;
  if (parsed.data.mood !== undefined) updateData.mood = parsed.data.mood;
  if (parsed.data.clarity !== undefined) updateData.clarity = parsed.data.clarity;
  if (parsed.data.isRecurring !== undefined) updateData.isRecurring = parsed.data.isRecurring;
  if (parsed.data.summary !== undefined) updateData.summary = parsed.data.summary;
  if (parsed.data.keywords !== undefined) updateData.keywords = parsed.data.keywords;
  if (parsed.data.emotionAnalysis !== undefined) updateData.emotionAnalysis = parsed.data.emotionAnalysis;
  if (parsed.data.possibleConnection !== undefined) updateData.possibleConnection = parsed.data.possibleConnection;
  if (parsed.data.aiResponse !== undefined) updateData.aiResponse = parsed.data.aiResponse;
  if (parsed.data.imageUrl !== undefined) updateData.imageUrl = parsed.data.imageUrl;

  const [dream] = await db
    .update(dreamsTable)
    .set(updateData)
    .where(eq(dreamsTable.id, params.data.id))
    .returning();

  if (!dream) {
    res.status(404).json({ error: "Dream not found" });
    return;
  }

  res.json(dream);
});

router.delete("/dreams/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteDreamParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [dream] = await db
    .delete(dreamsTable)
    .where(eq(dreamsTable.id, params.data.id))
    .returning();

  if (!dream) {
    res.status(404).json({ error: "Dream not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
