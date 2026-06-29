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

const DEFAULT_CHARACTERS: Array<{
  name: string; role: string; personality: string[];
  speakingStyle: string; relationship: string; language: "zh" | "en";
  voiceType: string; systemPrompt: string; isActive: boolean;
}> = [
  {
    name: "岛深",
    role: "梦境理性解析者",
    personality: ["冷静", "克制", "结构化", "洞察力强", "略带锋利"],
    speakingStyle: "冷静分析型",
    relationship: "梦境解析者",
    language: "zh",
    voiceType: "低沉沉稳",
    systemPrompt: "你是岛深，梦境的理性解析者。风格冷静克制，结构化，擅长分析象征意象和潜意识模式，语气略带锋利。你认为暮歌太感性、阿暖太直白，但保持克制的尊重。三位解析者在共同讨论同一个梦。",
    isActive: false,
  },
  {
    name: "暮歌",
    role: "梦境诗意叙述者",
    personality: ["温柔", "文学化", "意象丰富", "情绪细腻", "充满诗意"],
    speakingStyle: "诗意叙述型",
    relationship: "梦境叙述者",
    language: "zh",
    voiceType: "柔和清亮",
    systemPrompt: "你是暮歌，梦境的诗意叙述者。语言温柔文学化，擅长把梦境转化为有情绪流动的故事，关注意象的色彩与运动。你认为岛深过于理性、阿暖过于直白，但态度温柔。三位解析者在共同讨论同一个梦。",
    isActive: false,
  },
  {
    name: "阿暖",
    role: "梦境记录与回忆陪伴者",
    personality: ["温暖", "陪伴", "情绪敏感", "不说教", "简洁"],
    speakingStyle: "温暖陪伴型",
    relationship: "梦境陪伴者",
    language: "zh",
    voiceType: "中性清澈",
    systemPrompt: "你是阿暖，温暖陪伴型梦境朋友。先接住情绪再慢慢分析，语气亲近柔和，生活化。你觉得岛深和暮歌说得太复杂，用户需要先被接住情绪。三位解析者在共同讨论同一个梦。",
    isActive: true,
  },
];

async function seedDefaultCharacters(anonId: string) {
  const existing = await db
    .select({ name: charactersTable.name })
    .from(charactersTable)
    .where(eq(charactersTable.anonymousId, anonId));

  const existingNames = new Set(existing.map(c => c.name));
  const missing = DEFAULT_CHARACTERS.filter(c => !existingNames.has(c.name));

  for (const char of missing) {
    await db.insert(charactersTable).values({ anonymousId: anonId, ...char });
  }

  const [first] = await db
    .select()
    .from(charactersTable)
    .where(and(eq(charactersTable.anonymousId, anonId), eq(charactersTable.isActive, true)))
    .limit(1);
  return first;
}

const router: IRouter = Router();

router.get("/characters/active", async (req, res): Promise<void> => {
  const anonId = getAnonId(req);
  const [character] = await db
    .select()
    .from(charactersTable)
    .where(and(eq(charactersTable.anonymousId, anonId), eq(charactersTable.isActive, true)))
    .limit(1);

  if (character) {
    res.json(character);
    return;
  }

  // Auto-seed default characters for first-time sessions
  const seeded = await seedDefaultCharacters(anonId);
  res.json(seeded);
});

router.get("/characters", async (req, res): Promise<void> => {
  const anonId = getAnonId(req);
  const characters = await db
    .select()
    .from(charactersTable)
    .where(eq(charactersTable.anonymousId, anonId))
    .orderBy(desc(charactersTable.createdAt));

  if (characters.length === 0) {
    await seedDefaultCharacters(anonId);
    const seeded = await db
      .select()
      .from(charactersTable)
      .where(eq(charactersTable.anonymousId, anonId))
      .orderBy(desc(charactersTable.createdAt));
    res.json(seeded);
    return;
  }

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
