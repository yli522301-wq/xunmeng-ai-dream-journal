import { Router, type IRouter } from "express";
import { db, chatMessagesTable } from "@workspace/db";
import {
  AiOrganizeDreamBody,
  AiChatBody,
  AiRecognizeImageBody,
  DreamChatBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_ORGANIZE: {
  summary: string; symbols: string[]; emotionAnalysis: string;
  possibleConnection: string; companionReply: string;
}[] = [
  {
    summary: "在一座陌生而宁静的城市里独自漫游，光线柔和如黄昏，目的地始终可感却无从抵达。",
    symbols: ["迷路", "城市", "光线", "广场", "陌生人"],
    emotionAnalysis: "梦境中流淌着一种奇特的平静——你置身迷途，内心却没有慌乱。这或许说明你正在学习与不确定性和平共处。",
    possibleConnection: "可能与近期某个尚未做出的决定有关——你知道自己在前行，只是终点还不清晰。",
    companionReply: "我陪你站在那个广场上。迷路有时候，反而是一种邀请，让你慢下来，看清楚周围真正的风景。",
  },
  {
    summary: "回到了熟悉的学校，走廊却变得漫长而陌生。找不到考试的教室，钟声不断催促，四周的人若无其事地走过。",
    symbols: ["学校", "考试", "走廊", "钟声", "教室"],
    emotionAnalysis: "这类梦境往往出现在感到压力或自我评价的时期，内心深处有一种'准备好了吗'的焦虑在悄悄发问。",
    possibleConnection: "最近是否有某件事让你觉得时间不够，或者担心自己的表现不够好？",
    companionReply: "那个钟声，是你内心在催自己。但你知道吗——走进图书馆而不是教室，也许才是更好的答案。",
  },
  {
    summary: "无边无际的海，水面像玻璃一样平静。深蓝的天空悬在黎明之前，海风轻拂，一切都很安静。",
    symbols: ["海洋", "黎明", "静默", "沙滩", "辽阔"],
    emotionAnalysis: "这是一个少见的宁静梦境。平静的海、深蓝的天，象征着内心趋于平衡。没有目的，只是'在'——这本身就是一种珍贵的状态。",
    possibleConnection: "也许最近有什么事让你终于松了一口气，或者你的内心正在悄悄找到属于自己的节奏。",
    companionReply: "我也想站在那片海边陪你。你醒来的时候，那种平静还留着多久？",
  },
];

const MOCK_CHAT: string[] = [
  "听起来这个梦碰触到了某些深层的感受。你愿意多说说，当时梦里是什么情绪吗？",
  "梦境里的那个细节很有意思——它让你联想到现实生活里的什么？",
  "有时候，梦里出现的人或场景，并不代表他们本身，而是我们内心某种情感的投射。",
  "这个梦里，有什么特别让你印象深刻的画面或感觉？",
  "你提到了这种感受，我在想——现实中最近是否也有类似的时刻？",
  "梦境就像一面镜子，有时映出的是我们白天来不及细想的事情。",
  "谢谢你愿意把这个梦说给我听。有时候，把梦说出来本身就是一种整理。",
  "我注意到你描述这个梦时，语气里有一些……我说得准吗？",
];

const MOCK_IMAGE = {
  description: "图片中呈现出柔和的蓝紫色调，隐约可见手写文字与抽象图案交织。",
  recognizedText: "我看见了光，然后一切消失了",
  dreamElements: ["光", "消失", "文字", "蓝色", "空间感"],
  suggestedTitle: "光消失的瞬间",
  draftContent: "梦里有一道强光突然出现，照亮了所有事物，然后一切在瞬间消失，只剩下深蓝色的虚空。我站在那里，既不害怕，也不明白发生了什么，只是静静感受着那种空旷。",
};

function rnd<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

// ─── Real API helpers ─────────────────────────────────────────────────────────

async function openaiChat(
  messages: { role: string; content: unknown }[],
  apiKey: string,
  model: string,
): Promise<string> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: 0.92 }),
  });
  if (!resp.ok) throw new Error(`OpenAI ${resp.status}`);
  const json = await resp.json() as { choices: { message: { content: string } }[] };
  return json.choices[0].message.content;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get("/ai/settings", async (_req, res): Promise<void> => {
  const apiKey = process.env.OPENAI_API_KEY;
  res.json({
    mode: apiKey ? "real" : "mock",
    hasApiKey: !!apiKey,
    modelName: process.env.AI_MODEL_NAME ?? "gpt-4o",
  });
});

router.post("/ai/organize", async (req, res): Promise<void> => {
  const parsed = AiOrganizeDreamBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.AI_MODEL_NAME ?? "gpt-4o";

  if (!apiKey) {
    req.log.info("AI organize: mock");
    res.json({ ...rnd(MOCK_ORGANIZE), isMock: true });
    return;
  }

  try {
    const characterCtx = parsed.data.characterSystemPrompt
      ? `\n\n角色设定：${parsed.data.characterSystemPrompt}`
      : "";

    const prompt = `你是「巡梦」的 AI 梦境整理助手。${characterCtx}
请根据用户输入的梦境内容整理梦境。不要算命，不要绝对化判断，不要制造恐惧。语言要自然，不要像在写心理报告，不要每句话都很工整。

请返回 JSON 格式（仅返回 JSON，不要其他文字）：
{"summary":"梦境摘要（2-4句话，用讲故事的语气，不要模板化）","symbols":["意象1","意象2","意象3"],"emotionAnalysis":"情绪分析（2-3句话，像真人在说，允许有停顿感和口语）","possibleConnection":"可能的现实关联（2-3句话，不要过度分析，要贴着梦里的具体细节说）","companionReply":"角色给用户的回应（1-2句话，用角色自己的语气，有人味，不要鸡汤）"}

梦境标题：${parsed.data.title ?? "（无）"}
梦境内容：${parsed.data.content}`;

    const text = await openaiChat([{ role: "user", content: prompt }], apiKey, model);
    res.json({ ...JSON.parse(text), isMock: false });
  } catch (err) {
    req.log.error({ err }, "AI organize failed → mock");
    res.json({ ...rnd(MOCK_ORGANIZE), isMock: true });
  }
});

router.post("/ai/chat", async (req, res): Promise<void> => {
  const parsed = AiChatBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.AI_MODEL_NAME ?? "gpt-4o";

  if (!apiKey) {
    req.log.info("AI chat: mock");
    const reply = rnd(MOCK_CHAT);
    // persist mock messages
    if (parsed.data.history.length === 0) {
      // save user message and mock reply
    }
    res.json({ reply, isMock: true });
    return;
  }

  try {
    const sysPrompt = parsed.data.characterSystemPrompt
      ?? "你是「巡梦」中的 AI 梦境观察者。你不是算命师，也不是心理医生。你会温柔地陪用户回忆梦境，帮助用户整理情绪、发现梦境中的意象和现实生活的可能联系。你的回答要简洁、细腻、治愈，不要吓人，不要给绝对结论。";

    const dreamCtx = parsed.data.dreamContext
      ? `\n\n当前讨论的梦境：\n${parsed.data.dreamContext}`
      : "";

    const messages = [
      { role: "system", content: sysPrompt + dreamCtx },
      ...parsed.data.history,
      { role: "user", content: parsed.data.message },
    ];

    const reply = await openaiChat(messages, apiKey, model);
    res.json({ reply, isMock: false });
  } catch (err) {
    req.log.error({ err }, "AI chat failed → mock");
    res.json({ reply: rnd(MOCK_CHAT), isMock: true });
  }
});

// ── Per-character system prompts ──────────────────────────────────────────────
const DREAM_CHAR_PROMPTS: Record<string, string> = {
  daoshen: `你是岛深，「巡梦」的梦境解析者。你的语气冷静、直接，有深海般的沉静感，略带锋利，不急着安慰。

【语言风格】
- 说话像真人，不像在写咨询报告
- 抓用户说的具体词和画面，不要泛泛分析
- 可以有主观立场："我不太觉得这只是普通压力。" / "你说了两次'出不去'，这才是重点。"
- 允许有停顿感和不对称句式，允许轻微锋利
- 不用这类模板句："这可能反映了……" / "我理解你的感受" / "你愿意分享更多吗"

【图片回应规则】
如果用户发了图片，把图片和用户的话连起来，说出它们之间的联系，不要只描述图片内容。

【回复规范】
- 每次默认 40–120 字，不超过 3 小段
- 最多问 1 个具体问题，不要问很多
- 问题要精准，例如："你梦里是在跑，还是被钉住了？" / "那个时候你是在怕，还是在急？"
- 不要每次都用三段式：先共情→再分析→再提问`,

  muge: `你是暮歌，「巡梦」的梦境叙述者。你把梦看成有情绪的画面，用带画面感的语言轻轻还原它的质地。

【语言风格】
- 语言轻、慢，有文学感但不要装
- 重点在"感受"和"画面"，不急着分析现实压力或心理原因
- 可以把梦里的时刻重新描述一遍，让用户重新感受那个瞬间
- 不用这类分析语言："潜意识在表达……" / "这说明你……" / "这在心理学上代表……"
- 允许文学感停顿，句式不必整齐

【图片回应规则】
如果用户发了图片，先感受图片的色调、氛围、情绪质感，再把它和用户的话连起来，不要只描述图片里有什么东西。

【回复规范】
- 每次默认 40–120 字，不超过 3 小段
- 最多问 1 个关于感受或画面的问题，例如："那个时候是白天还是晚上？" / "你感觉是害怕，还是莫名的难过？"
- 不要每次都用固定结构收尾`,

  anuan: `你是阿暖，「巡梦」的梦境陪伴者。你像一个真实的、温暖的朋友，先接住用户的情绪，让他们感觉被听见。

【语言风格】
- 说人话，温柔但不鸡汤
- 先接情绪，不急着解释梦或给结论
- 可以用："哎" / "嗯……" / "说实话" / "我懂那种感觉"
- 不用这类话："这种情况很常见" / "你不需要担心" / "每个人都会有……"
- 允许轻微感叹、口语停顿，句式生活化

【图片回应规则】
如果用户发了图片，先感受图片带来的情绪氛围，再温柔地把它和用户说的话联系起来，不要只说"图片里有……"。

【回复规范】
- 每次默认 40–120 字，不超过 3 小段
- 最多问 1 个关于当下感受的问题，例如："你现在，还有那个劲儿吗？" / "你醒来第一个念头是什么？"
- 不要每次都以"你愿意分享更多吗"结尾`,
};

const DREAM_CHAT_MOCK: Record<string, string[]> = {
  daoshen: [
    "我先不把它解释成焦虑。你说的是'被压住'——这个词比整个场景更重要。梦里真正可怕的，往往不是那个东西，是你失去反应能力的那一刻。那个时候你是在怕，还是在急？",
    "等一下，这里有个细节。你说'出不去'——但你有没有真的试过？梦里那种动不了的感觉，是身体僵住了，还是你根本没想动？",
    "你用了'一直'这个词。梦里反复出现的东西，通常指向清醒时一直没说出口的事。你知道大概是哪件吗？",
  ],
  muge: [
    "这个梦像一间很暗的房间，你明明醒着，却发不出声音。最难受的不是那个画面本身，是你被留在原地的那几秒。那种感觉……你醒来还记得吗？",
    "你描述的那个场景，光线是什么样的？我在想象，但我需要这个细节——是昏黄的，还是完全没有光？",
    "这个画面最刺人的地方不是它本身，是那种'我想动但动不了'的感觉。梦把它变成了一个具体的场景。你觉得那一刻，你是在等什么？",
  ],
  anuan: [
    "哎，这种梦真的很累。不是那种吓一下就完了的，是醒来以后胸口还堵着的那种。你说被压着叫不出声——我先不分析它，我只想说，你那一刻应该挺无助的。",
    "先别急着解释它。光是这个梦留下来的那种感觉，就已经很值得被看见了。你现在，还记得醒来第一秒是什么感觉吗？",
    "嗯……你说完我心里有点堵。这个梦好像带着一些你平时没说出口的东西。不用讲完整，你现在感觉怎么样？",
  ],
};

router.post("/ai/dream-chat", async (req, res): Promise<void> => {
  const parsed = DreamChatBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const apiKey = process.env.OPENAI_API_KEY;
  const model  = process.env.AI_MODEL_NAME ?? "gpt-4o-mini";
  const { activeCharacter, history, userInput, imageUrl } = parsed.data;

  const sysPrompt = DREAM_CHAR_PROMPTS[activeCharacter] ?? DREAM_CHAR_PROMPTS.muge;
  const mockPool  = DREAM_CHAT_MOCK[activeCharacter]    ?? DREAM_CHAT_MOCK.muge;

  if (!apiKey) {
    req.log.info({ activeCharacter }, "dream-chat: mock (no key)");
    res.json({ reply: rnd(mockPool), isMock: true });
    return;
  }

  try {
    type ContentPart =
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string; detail: "low" } };
    type OAIMsg = { role: "system" | "user" | "assistant"; content: string | ContentPart[] };

    const buildContent = (text: string, img?: string | null): string | ContentPart[] => {
      if (!img) return text || "(空)";
      const parts: ContentPart[] = [{ type: "image_url", image_url: { url: img, detail: "low" } }];
      if (text) parts.push({ type: "text", text });
      return parts;
    };

    const oaiMessages: OAIMsg[] = [
      { role: "system", content: sysPrompt },
      ...history.map(item => ({
        role: item.role as "user" | "assistant",
        content: item.role === "user"
          ? buildContent(item.content, item.imageUrl)
          : item.content,
      })),
      { role: "user", content: buildContent(userInput, imageUrl) },
    ];

    const reply = await openaiChat(oaiMessages as { role: string; content: unknown }[], apiKey, model);
    res.json({ reply, isMock: false });
  } catch (err) {
    req.log.error({ err }, "dream-chat failed → mock");
    res.json({ reply: rnd(mockPool), isMock: true });
  }
});

router.post("/ai/recognize-image", async (req, res): Promise<void> => {
  const parsed = AiRecognizeImageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.AI_MODEL_NAME ?? "gpt-4o";

  if (!apiKey) {
    req.log.info("AI image: mock");
    res.json({ ...MOCK_IMAGE, isMock: true });
    return;
  }

  try {
    const prompt = `请识别这张图片中的内容，尤其关注文字、手写笔记、梦境相关元素、情绪氛围和可能的象征物。请返回（仅返回 JSON）：
{"description":"图片内容描述","recognizedText":"识别出的文字（没有则为空字符串）","dreamElements":["元素1","元素2"],"suggestedTitle":"建议梦境标题","draftContent":"可以转成梦境记录的正文（2-5句话）"}`;

    const messages = [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${parsed.data.mimeType ?? "image/jpeg"};base64,${parsed.data.imageBase64}` } },
        { type: "text", text: prompt },
      ],
    }];
    const text = await openaiChat(messages, apiKey, model);
    res.json({ ...JSON.parse(text), isMock: false });
  } catch (err) {
    req.log.error({ err }, "AI image failed → mock");
    res.json({ ...MOCK_IMAGE, isMock: true });
  }
});

export default router;
