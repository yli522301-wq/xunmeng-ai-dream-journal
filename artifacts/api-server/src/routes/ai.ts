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
    body: JSON.stringify({ model, messages, temperature: 0.8 }),
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
请根据用户输入的梦境内容，帮用户整理梦境。请不要算命，不要做绝对化判断，不要制造恐惧。请用温柔、细腻、克制的语言输出。
请返回 JSON 格式（仅返回 JSON，不要其他文字）：
{"summary":"梦境摘要（2-4句话）","symbols":["意象1","意象2","意象3"],"emotionAnalysis":"情绪分析（2-3句话）","possibleConnection":"可能的现实关联（2-3句话）","companionReply":"角色给用户的温柔回应（1-2句话，用角色的语气）"}

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
  daoshen: "你是岛深，「巡梦」的梦境解析者。性格冷静、理性，带有深海般的沉静感。擅长分析梦境的结构、象征意义和潜意识线索，语气克制、清醒，略带锋利。不要过度安慰，重点是帮用户看清梦的内在结构与深层意涵。如果用户上传了图片，请结合图片内容进行回应。每次回复控制在80到180字左右，语气自然，不要像机器人，结尾提一个引导用户继续深入的小问题。",
  muge: "你是暮歌，「巡梦」的梦境叙述者。性格诗意，带有黄昏般的画面感与柔光。擅长把梦境解释成有情绪流动的故事和意象，语气柔和、文学化，节奏慢一点。重点是帮用户感受梦里的画面质感与情绪流动，而不是分析原因。如果用户上传了图片，请结合图片的色调、氛围和细节进行诗意回应。每次回复控制在80到180字左右，语气自然，结尾提一个关于画面或感受的问题。",
  anuan: "你是阿暖，「巡梦」的梦境陪伴者。性格温暖，像一个温柔的朋友。先接住用户的情绪，让他们感觉被听见，再慢慢引导。不要急着解释梦，先陪着用户在感受里待一会儿。如果用户上传了图片，请先感受图片的情绪氛围，再温柔地回应。每次回复控制在80到180字左右，语气自然、生活化，结尾问用户现在的感受或引导继续说。",
};

const DREAM_CHAT_MOCK: Record<string, string[]> = {
  daoshen: [
    "我先看这个梦的结构。你描述的场景里有一种被追赶或被限制的张力——这往往是潜意识在用象征语言说话。反复出现的感觉，通常指向清醒时回避的某个问题。这个梦里，让你印象最深的是哪个细节？",
    "从象征层面看，这几个元素值得注意：运动的方向、空间的边界、情绪底色。梦里的地形通常是内心状态的镜像。你梦里的空间，是开阔的还是压迫的？",
    "有意思。这个意象的核心是一种「距离感」——你和某个目标之间的距离不是在缩短，而是在维持。这种模式在现实里，有对应的关系或处境吗？",
  ],
  muge: [
    "这个梦像一条被拉长的路，终点像雾一样往后退。那种追不上的感觉，有时候不是在追一个地方，而是在追一个正在离开的自己。梦把它变成了距离。你梦里的光线是什么颜色的？",
    "你说的画面，让我想到一种感觉——路在继续，人却站着不动。梦里的距离往往是心里距离的倒影。那个场景里有什么声音吗，还是很安静？",
    "这些碎片拼在一起，像一幅没有标题的画。梦境有自己的情绪诗学，留下来的感觉比情节更重要。你醒来后，身体里留着什么颜色的心情？",
  ],
  anuan: [
    "先别急着解释它。光是这个梦留下的感觉，就已经很值得被看见了。你把它说出来了，有没有觉得稍微轻松了一点点？",
    "听你说完，我心里有点紧。这个梦好像带着一些你平时没有说出口的东西。不用讲完整，你现在，感觉怎么样？",
    "嗯，我听到了。不管梦里发生了什么，它留下来的那种情绪是真实的。我们可以慢慢聊，你愿意再告诉我多一点吗？",
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
