import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, charactersTable } from "@workspace/db";
import {
  CreateCharacterBody,
  UpdateCharacterBody,
  UpdateCharacterParams,
  DeleteCharacterParams,
  GetCharacterParams,
  ActivateCharacterParams,
} from "@workspace/api-zod";

function getAnonId(req: unknown): string {
  return (req as { anonymousId: string }).anonymousId;
}

const router: IRouter = Router();

router.get("/characters/active", async (req, res): Promise<void> => {
  const anonId = getAnonId(req);
  const [character] = await db
    .select()
    .from(charactersTable)
    .where(and(eq(charactersTable.anonymousId, anonId), eq(charactersTable.isActive, true)))
    .limit(1);

  if (!character) {
    res.status(404).json({ error: "No active character" });
    return;
  }
  res.json(character);
});

router.get("/characters", async (req, res): Promise<void> => {
  const anonId = getAnonId(req);
  const characters = await db
    .select()
    .from(charactersTable)
    .where(eq(charactersTable.anonymousId, anonId))
    .orderBy(desc(charactersTable.createdAt));
  res.json(characters);
});

router.post("/characters", async (req, res): Promise<void> => {
  const parsed = CreateCharacterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const anonId = getAnonId(req);

  if (parsed.data.isActive) {
    await db
      .update(charactersTable)
      .set({ isActive: false })
      .where(and(eq(charactersTable.anonymousId, anonId), eq(charactersTable.isActive, true)));
  }

  const [character] = await db
    .insert(charactersTable)
    .values({
      anonymousId: anonId,
      name: parsed.data.name,
      avatar: parsed.data.avatar ?? null,
      role: parsed.data.role,
      personality: parsed.data.personality,
      speakingStyle: parsed.data.speakingStyle,
      relationship: parsed.data.relationship,
      language: parsed.data.language,
      voiceType: parsed.data.voiceType,
      systemPrompt: parsed.data.systemPrompt,
      isActive: parsed.data.isActive ?? false,
    })
    .returning();

  res.status(201).json(character);
});

router.get("/characters/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetCharacterParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const anonId = getAnonId(req);
  const [character] = await db
    .select()
    .from(charactersTable)
    .where(and(eq(charactersTable.id, params.data.id), eq(charactersTable.anonymousId, anonId)));

  if (!character) {
    res.status(404).json({ error: "Character not found" });
    return;
  }
  res.json(character);
});

router.patch("/characters/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateCharacterParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateCharacterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const anonId = getAnonId(req);

  if (parsed.data.isActive) {
    await db
      .update(charactersTable)
      .set({ isActive: false })
      .where(and(eq(charactersTable.anonymousId, anonId), eq(charactersTable.isActive, true)));
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.avatar !== undefined) updateData.avatar = parsed.data.avatar;
  if (parsed.data.role !== undefined) updateData.role = parsed.data.role;
  if (parsed.data.personality !== undefined) updateData.personality = parsed.data.personality;
  if (parsed.data.speakingStyle !== undefined) updateData.speakingStyle = parsed.data.speakingStyle;
  if (parsed.data.relationship !== undefined) updateData.relationship = parsed.data.relationship;
  if (parsed.data.language !== undefined) updateData.language = parsed.data.language;
  if (parsed.data.voiceType !== undefined) updateData.voiceType = parsed.data.voiceType;
  if (parsed.data.systemPrompt !== undefined) updateData.systemPrompt = parsed.data.systemPrompt;
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

  const [character] = await db
    .update(charactersTable)
    .set(updateData)
    .where(and(eq(charactersTable.id, params.data.id), eq(charactersTable.anonymousId, anonId)))
    .returning();

  if (!character) {
    res.status(404).json({ error: "Character not found" });
    return;
  }
  res.json(character);
});

router.delete("/characters/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteCharacterParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const anonId = getAnonId(req);
  const deleted = await db
    .delete(charactersTable)
    .where(and(eq(charactersTable.id, params.data.id), eq(charactersTable.anonymousId, anonId)))
    .returning();

  if (deleted.length === 0) {
    res.status(404).json({ error: "Character not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/characters/:id/activate", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ActivateCharacterParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const anonId = getAnonId(req);

  await db
    .update(charactersTable)
    .set({ isActive: false })
    .where(and(eq(charactersTable.anonymousId, anonId), eq(charactersTable.isActive, true)));

  const [character] = await db
    .update(charactersTable)
    .set({ isActive: true })
    .where(and(eq(charactersTable.id, params.data.id), eq(charactersTable.anonymousId, anonId)))
    .returning();

  if (!character) {
    res.status(404).json({ error: "Character not found" });
    return;
  }
  res.json(character);
});

export default router;
