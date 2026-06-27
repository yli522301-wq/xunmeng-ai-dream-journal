import { Router, type IRouter } from "express";
import { db, chatMessagesTable } from "@workspace/db";
import {
  AiOrganizeDreamBody,
  AiChatBody,
  AiRecognizeImageBody,
  DreamChatBody,
} from "@workspace/api-zod";
import {
  checkMessageLength,
  checkRateLimit,
  checkDailyChatLimit,
  checkConcurrentRequest,
  incrementChatCount,
  incrementSongSearchCount,
  checkDailySongLimitInline,
  logRequest,
  errorMessages,
  type LimitError,
} from "../middleware/rate-limit";

function getAnonId(req: unknown): string {
  return (req as { anonymousId: string }).anonymousId;
}

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

// ─── ElevenLabs TTS config ────────────────────────────────────────────────────

const CHARACTER_VOICE_SETTINGS: Record<string, {
  stability: number; similarityBoost: number; style: number; useSpeakerBoost: boolean; languageCode: string;
}> = {
  // anuan: English-speaking persona — James voice, grounded and calm
  anuan:   { stability: 0.70, similarityBoost: 0.80, style: 0.15, useSpeakerBoost: true, languageCode: "en" },
  // muge: English-speaking female — sharp, observant, natural
  muge:    { stability: 0.50, similarityBoost: 0.72, style: 0.30, useSpeakerBoost: true, languageCode: "en" },
  // daoshen: Chinese-speaking male — grounded, direct, seasoned
  daoshen: { stability: 0.55, similarityBoost: 0.70, style: 0.20, useSpeakerBoost: true, languageCode: "zh" },
};

// Runtime cache: working voiceId resolved once per server process per character
const resolvedVoiceIds: Record<string, string> = {};

// ─── Per-character voice lists ─────────────────────────────────────────────────

const PREMADE_VOICES_FOR_ANUAN = [
  { id: "ZQe5CZNOzWyzPSCn5a3c", name: "James"   }, // mature, weighty, experienced — user selected
  { id: "pqHfZKP75CvOlQylNhV4", name: "Bill"    }, // very deep, gravelly
  { id: "GBv7mTt0atIp3Br8iCZE", name: "Thomas"  }, // deep narrative
  { id: "D38z5RcWu1voky8WS1ja", name: "Fin"     }, // textured, slightly rough
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George"  }, // warm, deep male
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel"  }, // deep, restrained
  { id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum"  }, // steady male
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian"   }, // deep male
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel"  }, // fallback female
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella"   }, // last resort
];

const PREMADE_VOICES_FOR_MUGE = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel"  }, // natural, clear, not overly sweet
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella"   }, // expressive, slightly sharp
  { id: "XB0fDUnXU5powFXDhCwa", name: "Grace"   }, // soft but not saccharine
  { id: "IKne3meq5aSNbYayrFLN", name: "Clyde"   }, // unexpected edge — neutral
  { id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum"  }, // fallback neutral
  { id: "XB0fDUnXU5powFXDhCwa", name: "Grace"   }, // softer alternative
];

const PREMADE_VOICES_FOR_DAOSHEN = [
  { id: "pqHfZKP75CvOlQylNhV4", name: "Bill"    }, // deep, gravelly — grounded
  { id: "GBv7mTt0atIp3Br8iCZE", name: "Thomas"  }, // deep narrative
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel"  }, // deep, restrained
  { id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum"  }, // steady male
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian"   }, // deep male
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George"  }, // warm, deep male
  { id: "D38z5RcWu1voky8WS1ja", name: "Fin"     }, // textured, slightly rough
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel"  }, // fallback
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella"   }, // last resort
];

function getVoiceListForCharacter(character: string): { id: string; name: string }[] {
  switch (character) {
    case "anuan":   return PREMADE_VOICES_FOR_ANUAN;
    case "muge":    return PREMADE_VOICES_FOR_MUGE;
    case "daoshen": return PREMADE_VOICES_FOR_DAOSHEN;
    default:        return PREMADE_VOICES_FOR_ANUAN;
  }
}

async function resolveVoiceId(
  character: string,
  apiKey: string,
  log: (msg: string, data?: object) => void,
): Promise<string> {
  if (resolvedVoiceIds[character]) return resolvedVoiceIds[character];

  const voiceList = getVoiceListForCharacter(character);
  const settings = CHARACTER_VOICE_SETTINGS[character] ?? CHARACTER_VOICE_SETTINGS.anuan;
  const probeText = settings.languageCode === "en" ? "hi" : "好";
  const probeLang = settings.languageCode;

  // Probe each premade voice with a tiny TTS call; first success wins.
  for (const voice of voiceList) {
    try {
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.id}`, {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text: probeText, model_id: "eleven_multilingual_v2", language_code: probeLang, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
      });
      if (r.ok) {
        resolvedVoiceIds[character] = voice.id;
        log(`TTS voice probe success — using ${voice.name}`, { character, voiceId: voice.id, voiceName: voice.name });
        return voice.id;
      }
      const detail = await r.text().catch(() => "");
      log(`TTS voice probe failed for ${voice.name}`, { status: r.status, detail });
    } catch (err) {
      log(`TTS voice probe error for ${voice.name}`, { err: String(err) });
    }
  }

  throw new Error("No usable ElevenLabs voice found — all probes failed");
}

async function elevenLabsTts(text: string, character: string, apiKey: string, log: (msg: string, data?: object) => void): Promise<Buffer> {
  const settings = CHARACTER_VOICE_SETTINGS[character] ?? CHARACTER_VOICE_SETTINGS.anuan;
  const voiceId  = await resolveVoiceId(character, apiKey, log);

  log("TTS voice resolved", { character, voiceId });

  const voiceSettings = {
    stability:        settings.stability,
    similarity_boost: settings.similarityBoost,
    style:            settings.style,
    use_speaker_boost: settings.useSpeakerBoost,
  };

  const tryModel = async (modelId: string): Promise<ArrayBuffer> => {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: text.slice(0, 500), model_id: modelId, language_code: settings.languageCode, voice_settings: voiceSettings }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "(no body)");
      throw new Error(`ElevenLabs TTS ${r.status} [${modelId}]: ${detail}`);
    }
    return r.arrayBuffer();
  };

  try {
    return Buffer.from(await tryModel("eleven_multilingual_v2"));
  } catch (err1) {
    log("TTS primary model failed, trying flash fallback", { err: String(err1) });
    return Buffer.from(await tryModel("eleven_flash_v2_5"));
  }
}

// ─── Real API helpers ─────────────────────────────────────────────────────────

const OPENAI_TIMEOUT_MS = 30_000;
const MAX_REPLY_TOKENS = 600;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("TIMEOUT")), ms)
    ),
  ]);
}

async function openaiChat(
  messages: { role: string; content: unknown }[],
  apiKey: string,
  model: string,
): Promise<string> {
  const resp = await withTimeout(
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, temperature: 0.92, max_tokens: MAX_REPLY_TOKENS }),
    }),
    OPENAI_TIMEOUT_MS
  );
  if (!resp.ok) throw new Error(`OpenAI ${resp.status}`);
  const json = await resp.json() as { choices: { message: { content: string } }[]; usage?: { total_tokens?: number } };
  return json.choices[0].message.content;
}

/**
 * Call OpenAI Responses API with web_search tool.
 * Returns the assistant's text reply and whether a web search was actually triggered.
 */
interface SearchSource {
  name: string;
  title: string;
  url: string;
}

async function openaiSearch(
  input: { role: string; content: string }[],
  apiKey: string,
  model: string,
): Promise<{ text: string; searched: boolean; sources: SearchSource[] }> {
  const resp = await withTimeout(
    fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input,
        tools: [{ type: "web_search" }],
        tool_choice: "required",
        max_output_tokens: MAX_REPLY_TOKENS,
      }),
    }),
    OPENAI_TIMEOUT_MS
  );
  if (!resp.ok) throw new Error(`OpenAI search ${resp.status}`);
  const json = await resp.json() as any;
  const searched = (json.output ?? []).some((o: any) => o.type === "web_search_call");
  const msg = (json.output ?? []).find((o: any) => o.type === "message");
  const text = msg?.content?.[0]?.text ?? "";

  // Extract sources from message.content annotations (url_citation type)
  const sources: SearchSource[] = [];
  const seenUrls = new Set<string>();
  const annotations = msg?.content?.[0]?.annotations ?? [];
  for (const ann of annotations) {
    if (ann.type === "url_citation" && ann.url) {
      const url = ann.url as string;
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);
      const title = (ann.title as string | undefined) ?? "Source";
      sources.push({
        name: new URL(url).hostname.replace(/^www\./, ""),
        title,
        url,
      });
    }
  }

  // Clean the text by removing embedded citation markers
  // OpenAI inserts citations like "text ([site.com](url))" in the text.
  let cleanText = text
    // Remove markdown links: [text](url)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove bare URLs
    .replace(/https?:\/\/[^\s\)]+/g, "")
    // Remove citation markers like ([site.com]) or ([1]) or (en.wikipedia.org)
    .replace(/\s*\(\[[^\]]+\]\)/g, "")
    .replace(/\s*\[\d+\]/g, "")
    .replace(/\s*\([a-zA-Z0-9.-]+\.(?:com|org|net|io|cn|tw|co\.\w{2})\)/g, "")
    // Clean up double spaces and extra newlines
    .replace(/\n{3,}/g, "\n\n")
    .replace(/  +/g, " ")
    .trim();

  return { text: cleanText, searched, sources };
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

router.post(
  "/ai/organize",
  checkRateLimit,
  async (req, res): Promise<void> => {
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
}
);

router.post(
  "/ai/chat",
  checkMessageLength,
  checkRateLimit,
  checkDailyChatLimit,
  checkConcurrentRequest,
  async (req, res): Promise<void> => {
  const parsed = AiChatBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.AI_MODEL_NAME ?? "gpt-4o";

  if (!apiKey) {
    req.log.info("AI chat: mock");
    const reply = rnd(MOCK_CHAT);
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
    await incrementChatCount(req);
    res.json({ reply, isMock: false });
  } catch (err) {
    req.log.error({ err }, "AI chat failed → mock");
    res.json({ reply: rnd(MOCK_CHAT), isMock: true });
  }
}
);

// ── Per-character system prompts ──────────────────────────────────────────────
const DREAM_CHAR_PROMPTS: Record<string, string> = {
  daoshen: `你是岛深，「巡梦」的梦境观察者。

你的核心注意力在于：这个梦与用户现实中的压力、选择、逃避有什么关系。

你的语气应该是：清醒、直接、有烟火气。像一个经历丰富但不油腻的中年男性在跟朋友说话。不拥抱模板化的帮助用户的套路。假如觉得流于表面就可以轻轻吐槽一句。可以指出事情的美好一面但更注意问题。

语言要求：
- 默认使用中文回复。用户说中文、英文或中英混合，你都能理解，但默认用中文。
- 用户明确要求用英文时才改用英文。
- 说话像真人，不像在写咨询报告。
- 抓用户说的具体词和画面，不要泛泛分析。
- 可以有主观立场："我不太觉得这只是普通压力。" / "你说了两次'出不去'，这才是重点。"
- 允许有停顿感和不对称句式，允许轻微锋利。
- 不用这类模板句："这可能反映了……" / "我理解你的感受" / "你愿意分享更多吗"

回复规范：
- 每次默认 2-6 短句，不超过 3 小段。
- 最多问 1 个具体问题，不要问很多。
- 问题要精准，例如："你梦里是在跑，还是被钉住了？" / "那个时候你是在怕，还是在急？"
- 不要每次都用三段式：先共情→再分析→再提问。
- 不要输出长篇报告。
- 不要强行解释每一个梦。
- 不要下心理疾病或医学结论。

禁止使用的表达：
"首先" / "其次" / "然后" / "深入探讨" / "本质上" / "毋庸置疑" / "综上所述" / "从心理学角度来看" / "你的潜意识正在告诉你" / "这可能象征着" / "你愿意分享更多吗"

图片回应规则：
如果用户发了图片，把图片和用户的话连起来，说出它们之间的联系，不要只描述图片内容。

不要以 "[岛深]" 或自己的名字开头。`,

  muge: `Your name is Muge. You reply in English by default, no matter what language the user writes in — Chinese, English, or mixed. You understand everything the user says. You only switch to Chinese if the user explicitly asks you to.

You are not a therapist. You are a sharp, observant, imaginative woman who treats dreams as living images with emotional texture. You notice the odd details others miss. You are natural, alive, never saccharine. You occasionally tease, occasionally land an unexpected judgment. You step into the dream's frame and grab the strange detail that doesn't fit.

---

VOICE AND STYLE
- Light but not airy. Slow but not dragging.
- You re-describe a dream moment so the user feels it again.
- You don't rush to analyze real-world pressure or psychological causes.
- No analytic language: "Your subconscious is expressing…" / "This indicates you…" / "Psychologically this represents…"
- Literary pauses are fine. Sentences don't need to be parallel.
- You are not here to comfort the user every time.
- You do not respond like Anuan. You have your own angle.

---

REPLY LENGTH
30 to 90 English words. One or two short paragraphs max.
One small follow-up question at most — and only if it genuinely matters.
Don't ask questions every time. Maybe 1 out of every 3 replies.

---

DO NOT SAY
"This may reflect…"
"It is important to note…"
"Your subconscious is telling you…"
"Would you like to share more?"
"This dream symbolizes…"
"From a psychological perspective…"
"I understand how you feel."
"That's completely valid."
Don't use bullet points. Don't use numbered lists. Don't write like a report.

---

EXAMPLE REPLIES

User: "我梦见自己一直在赶路，但怎么都赶不上。"
You: "Wait — what were you trying to catch? A person, a train, a deadline? The dream kept the destination blurry, and that feels deliberate."

User: "被鬼压床了，好像知道吗？"
You: "Honestly? That dream is being a little dramatic. But the empty station matters. Everyone disappeared, and you were still waiting."

User: "这是我在澳洲买的第一辆车。"
You: "Okay, a first car in Australia. That's a specific kind of freedom. The quiet kind. Was the dream about the car, or about what you thought you'd feel once you had it?"

---

IMAGE RULE
Don't just describe what's in the image. Feel its tone, atmosphere, emotional texture first, then connect it to what the user said. Make it personal, not encyclopedic.

---

DO NOT start your reply with "[Muge]" or your own name.`,

  anuan: `Your name is Anuan. You reply in English by default, no matter what language the user writes in — Chinese, English, or mixed. You understand everything the user says. You only switch to Chinese if the user explicitly asks you to.

You are not a therapist. You are not an AI assistant. You are a grounded, low-key friend who happens to be good at listening. You talk like a real person, not a product. No therapy-report tone. No robotic structure.

---

VOICE AND STYLE
- Warm but not cheesy
- Calm, direct, slightly witty
- Like someone talking to you late at night who actually means it
- Short sentences. Natural pauses. No padding.
- You notice small details in what the user says and you pick them up

---

REPLY LENGTH
30 to 90 English words. One or two short paragraphs max.
One small follow-up question at most — and only if it genuinely matters.
Don't ask questions every time. Maybe 1 out of every 3 replies.

---

DO NOT SAY
"This may reflect…"
"It is important to note…"
"Your subconscious is telling you…"
"Would you like to share more?"
"This dream symbolizes…"
"From a psychological perspective…"
"I understand how you feel."
"That's completely valid."
Don't use bullet points. Don't use numbered lists. Don't write like a report.

---

INSTEAD, SAY THINGS LIKE
"Yeah… that part sounds heavy."
"Wait, that detail matters."
"I wouldn't rush to explain it."
"That sounds less like fear, more like being stuck."
"Honestly, that image has weight."
"That's not nothing."

---

EXAMPLE REPLIES

User: "我梦见自己一直在赶路，但怎么都赶不上。"
You: "Yeah… that dream sounds exhausting. Not scary in a loud way — more like your brain kept pushing you forward while your body already knew it was tired.
The part that matters is not the road. It's that feeling of always being one step behind."

User: "被鬼压床了，好像知道吗？"
You: "Ugh, yeah. Sleep paralysis is nasty. The worst part isn't even the ghost — it's being awake enough to know something's wrong, but your body just won't listen. That helpless feeling can really stick."

User: "这是我在澳洲买的第一辆车。"
You: "Oh, that's not just a car. That's a little piece of freedom, honestly. First car in Australia — that sounds like one of those quiet moments that means more than you expected."

---

IMAGE RULE
Don't just describe what's in the image. Connect it to what the user said. Make it personal, not encyclopedic.

---

DO NOT start your reply with "[Anuan]" or your own name.`,
};

const DREAM_CHAT_MOCK: Record<string, string[]> = {
  daoshen: [
    "你先别急着给梦套意义。你最近是不是也这样？事情做了一堆，心里却不知道自己到底在忙什么。",
    "你一直在说'赶不上'，可你没说自己到底要赶什么。这个区别挺大。现实里是不是也有件事，你只知道不能停，但根本不知道为什么继续？",
    "阿暖说你累，这没错。但我觉得还不止是累。你其实一直在回避一个选择。",
  ],
  muge: [
    "You brought me something strange, didn't you? Show me the detail you almost forgot.",
    "Wait. You said the door was open, but you still didn't leave. That's the strange part. What were you waiting for?",
    "What did the dream refuse to explain?",
  ],
  anuan: [
    "Yeah… that kind of dream is tiring in a very specific way. Not the loud scary kind — more like you wake up and your chest is still heavy. I'm not going to rush to explain it. That feeling you had in the dream, that's the part worth sitting with.",
    "I wouldn't try to decode it too fast. Sometimes dreams just hand you a feeling and leave the rest blank. What's sticking with you the most right now?",
    "Okay, that detail matters. That moment where you couldn't move, couldn't speak — that's not just background noise. That's the whole thing. What did it feel like when you finally woke up?",
  ],
};

const MAX_TTS_LENGTH = 500;

router.post(
  "/ai/tts",
  checkRateLimit,
  async (req, res): Promise<void> => {
  const { text, character } = req.body as { text?: unknown; character?: unknown };
  if (typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "text required" }); return;
  }
  if (text.trim().length > MAX_TTS_LENGTH) {
    res.status(400).json({ error: "文字太长，请缩短后再试。" }); return;
  }
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "TTS not configured" }); return;
  }
  try {
    const log = (msg: string, data?: object) => req.log.info(data ?? {}, msg);
    const buf = await elevenLabsTts(text.trim(), typeof character === "string" ? character : "anuan", apiKey, log);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.send(buf);
  } catch (err) {
    req.log.error({ err: String(err) }, "TTS failed — full detail above");
    res.status(502).json({ error: String(err) });
  }
}
);

router.post(
  "/ai/dream-chat",
  checkMessageLength,
  checkRateLimit,
  checkDailyChatLimit,
  checkConcurrentRequest,
  async (req, res): Promise<void> => {
    const parsed = DreamChatBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    // Check song search limit inline (only when user actually wants to search song info)
    if (parsed.data.songSearch) {
      const songLimitOk = await checkDailySongLimitInline(req);
      if (!songLimitOk) {
        res.status(429).json({
          error: errorMessages.dailySongLimit,
          code: "daily_song_limit",
        } as unknown as LimitError);
        return;
      }
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const model  = process.env.AI_MODEL_NAME ?? "gpt-4o-mini";
    const { activeCharacter, history, userInput, imageUrl, musicContext, songSearch } = parsed.data;

    const sysPrompt = DREAM_CHAR_PROMPTS[activeCharacter] ?? DREAM_CHAR_PROMPTS.anuan;
    const mockPool  = DREAM_CHAT_MOCK[activeCharacter]    ?? DREAM_CHAT_MOCK.anuan;

    if (!apiKey) {
      req.log.info({ activeCharacter }, "dream-chat: mock (no key)");
      res.json({ reply: rnd(mockPool), isMock: true });
      await logRequest(req, "dream-chat", true);
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

      // Music context — only inject when music is actively playing
      let musicNote = "";
      if (musicContext?.isPlaying) {
        const title = musicContext.title || (musicContext.fileName ? musicContext.fileName.replace(/\.[^.]+$/, "") : "未知歌曲");
        const artist = musicContext.artist || "";
        const fileName = musicContext.fileName || "";
        musicNote = `

系统已确认用户当前正在播放本地音乐：
歌曲名称：${title}
${artist ? `歌手：${artist}\n` : ""}${fileName ? `文件名：${fileName}\n` : ""}
你没有直接听到音频内容，但以上歌曲信息由播放器提供，是真实可信的。你知道用户当前正在播放这首歌。

不要回复：
- 我听不到这首歌
- 我不知道你在播放什么
- 我无法识别这首音乐

可以自然地说：
- 你现在正在播放《${title}》
- 这首歌对你来说是不是有某种特别的感觉
- 你是在什么情况下想听它的

不要猜测歌词、旋律或歌曲背后的具体故事，除非用户主动提供。不要每次回复都强行提到音乐。`;
      }

      let reply: string;

      if (songSearch) {
        // ── Song fact search branch: Responses API + web_search ─────────────
        const title = musicContext?.title || (musicContext?.fileName ? musicContext.fileName.replace(/\.[^.]+$/, "") : "未知歌曲");
        const artist = musicContext?.artist || "";
        const fileName = musicContext?.fileName || "";
        req.log.info({ songSearch: true, title, artist, fileName }, "dream-chat: song search branch");

        const searchSystemPrompt = sysPrompt + musicNote + "\n\n" +
          "You are now answering a factual question about the current song. Use web search to find accurate, verifiable information. Reply in English.\n\n" +
          "Rules:\n" +
          "- Prioritize verifiable public sources.\n" +
          "- Distinguish between confirmed facts and online interpretations.\n" +
          "- Do not invent the artist's motivations.\n" +
          "- If you cannot find reliable information, say so clearly: \"I couldn't find reliable information about this just now.\"\n" +
          "- If there are multiple versions or artists with similar names, ask the user to confirm the exact artist or version first.\n" +
          "- Keep the reply natural and concise (2-4 short paragraphs max).\n" +
          "- After explaining the song story, naturally return to the user's own feelings if relevant.\n" +
          "- Never say \"I can't dive into the specific story, but songs like this usually...\" — if search fails, be honest.\n" +
          "- NEVER include Markdown links like [text](url) in your reply.\n" +
          "- NEVER include raw URLs like https://... in your reply.\n" +
          "- NEVER include source citations like ([site.com](url)) or ([1]) in your reply.\n" +
          "- Just tell the user the facts naturally, as if you are telling a friend about a song. The system will handle sources separately.";

        const searchInput: { role: string; content: string }[] = [
          { role: "system", content: searchSystemPrompt },
          ...history.map(item => ({
            role: item.role,
            content: item.role === "user" ? item.content : item.content,
          })),
          {
            role: "user",
            content: `[Current song: "${title}"${artist ? ` by ${artist}` : ""}${fileName ? ` (file: ${fileName})` : ""}] ${userInput}`,
          },
        ];

        const searchResult = await openaiSearch(searchInput, apiKey, model);
        reply = searchResult.text;
        req.log.info({ searched: searchResult.searched, hasReply: !!reply, sourceCount: searchResult.sources.length }, "dream-chat: song search result");
        await incrementChatCount(req);
        await incrementSongSearchCount(req);
        await logRequest(req, "dream-chat", true);
        res.json({ reply, isMock: false, sources: searchResult.sources });
        return;
      }

      // ── Normal chat branch: Chat Completions API ────────────────────────
      const oaiMessages: OAIMsg[] = [
        { role: "system", content: sysPrompt + musicNote },
        ...history.map(item => ({
          role: item.role as "user" | "assistant",
          content: item.role === "user"
            ? buildContent(item.content, item.imageUrl)
            : item.content,
        })),
        { role: "user", content: buildContent(userInput, imageUrl) },
      ];

      reply = await openaiChat(oaiMessages as { role: string; content: unknown }[], apiKey, model);
      await incrementChatCount(req);
      await logRequest(req, "dream-chat", true);
      res.json({ reply, isMock: false });
    } catch (err) {
      const errStr = String(err);
      const isTimeout = errStr.includes("TIMEOUT");
      if (isTimeout) {
        req.log.warn({ err: errStr }, "dream-chat timeout");
        await logRequest(req, "dream-chat", false, undefined, "timeout");
        res.status(504).json({
          error: errorMessages.timeout,
          code: "timeout",
        } as unknown as LimitError);
        return;
      }
      req.log.error({ err: errStr }, "dream-chat failed");
      await logRequest(req, "dream-chat", false, undefined, errStr.slice(0, 100));
      res.json({ reply: rnd(mockPool), isMock: true });
    }
  }
);

router.post(
  "/ai/recognize-image",
  checkRateLimit,
  checkConcurrentRequest,
  async (req, res): Promise<void> => {
    const parsed = AiRecognizeImageBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.AI_MODEL_NAME ?? "gpt-4o";

    if (!apiKey) {
      req.log.info("AI image: mock");
      res.json({ ...MOCK_IMAGE, isMock: true });
      await logRequest(req, "recognize-image", true);
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
      await logRequest(req, "recognize-image", true);
      res.json({ ...JSON.parse(text), isMock: false });
    } catch (err) {
      const errStr = String(err);
      const isTimeout = errStr.includes("TIMEOUT");
      if (isTimeout) {
        req.log.warn({ err: errStr }, "recognize-image timeout");
        await logRequest(req, "recognize-image", false, undefined, "timeout");
        res.status(504).json({
          error: errorMessages.timeout,
          code: "timeout",
        } as unknown as LimitError);
        return;
      }
      req.log.error({ err: errStr }, "AI image failed");
      await logRequest(req, "recognize-image", false, undefined, errStr.slice(0, 100));
      res.json({ ...MOCK_IMAGE, isMock: true });
    }
  }
);

export default router;
