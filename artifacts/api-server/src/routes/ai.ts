import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import {
  AiOrganizeDreamBody,
  AiChatBody,
  AiRecognizeImageBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const MOCK_ORGANIZE_RESPONSES = [
  {
    summary: "梦境中你独自穿越一座陌生的城市，街道蜿蜒曲折，光线柔和如黄昏。你似乎在寻找某个地方，却始终无法到达。",
    keywords: ["迷路", "城市", "光线", "寻找", "旅途"],
    emotionAnalysis: "梦境中弥漫着一种淡淡的焦虑与好奇交织的情绪。迷路的场景往往反映了现实中对方向感或某种选择的不确定。",
    possibleConnection: "可能与近期面临的某个决定或转变有关——你正在寻找的，也许是现实中尚未找到答案的事物。",
    aiResponse: "在梦里迷路，有时反而是一种放慢脚步的邀请。你愿意告诉我，你最近是否也在现实里寻找什么？",
  },
  {
    summary: "你回到了久违的学校，走廊却变得陌生而漫长。找不到教室，钟声不断响起，周围的人都若无其事地走过。",
    keywords: ["学校", "教室", "钟声", "熟悉感", "焦虑"],
    emotionAnalysis: "这类梦境常见于面临考验或评价时——内心深处对'准备是否充分'的自我审视。",
    possibleConnection: "可能与近期的工作压力、截止日期，或是对某件重要事情的担忧有关。",
    aiResponse: "学校的梦很常见，却每次都带来独特的感受。那个你找不到的教室，或许象征着你正在追寻的某种确定感。",
  },
  {
    summary: "一片无边无际的海洋，水面平静如镜。你站在某处遥望，海风轻拂，既没有恐惧，也没有目的，只有一种深沉的平静。",
    keywords: ["海洋", "平静", "无边", "自由", "静默"],
    emotionAnalysis: "这是一个少见的宁静梦境。海洋在梦中常代表潜意识的深层，平静的海面意味着内心趋于平衡。",
    possibleConnection: "也许最近你完成了某件让你释然的事，或者你的内心正在悄悄找到属于自己的节奏。",
    aiResponse: "这样的梦很珍贵——它像是你的潜意识送给你的礼物。你醒来时，还记得那片海是什么颜色吗？",
  },
];

const MOCK_CHAT_RESPONSES = [
  "听起来这个梦触碰到了某些深层的感受。你愿意多说说当时的情绪吗？",
  "梦境里的那个细节很有意思——它让你联想到现实生活里的什么？",
  "有时候，梦里出现的人或场景，并不一定代表他们本身，而是我们内心某种情感的投射。",
  "这个梦里，有什么让你特别印象深刻的画面或感觉吗？",
  "你提到了这种感受，我在想，现实中最近是否也有类似的时刻？",
  "梦境就像一面镜子，有时映出的是我们白天来不及细想的事情。你怎么看？",
  "我注意到你在描述这个梦时用了这个词——这对你来说有什么特别的意义吗？",
  "谢谢你愿意分享这个梦。有时候把梦说出来，本身就是一种整理。",
];

const MOCK_IMAGE_RESULTS = [
  {
    description: "图片中呈现出柔和的蓝紫色调，隐约可见手写文字与抽象图案交织。",
    recognizedText: "我看见了光，然后一切消失了",
    dreamElements: ["光", "消失", "文字", "蓝色", "抽象"],
    suggestedTitle: "光消失的瞬间",
    draftContent: "梦里有一道强光突然出现，照亮了所有事物，然后一切在瞬间消失，只剩下深蓝色的虚空。我站在那里，既不害怕，也不明白发生了什么。",
  },
];

function getMockOrganize() {
  return MOCK_ORGANIZE_RESPONSES[Math.floor(Math.random() * MOCK_ORGANIZE_RESPONSES.length)];
}

function getMockChatReply() {
  return MOCK_CHAT_RESPONSES[Math.floor(Math.random() * MOCK_CHAT_RESPONSES.length)];
}

async function callOpenAIOrganize(content: string, title: string | null | undefined, apiKey: string, model: string) {
  const prompt = `你是「巡梦」的 AI 梦境整理助手。请根据用户输入的梦境内容，帮用户整理梦境。请不要算命，不要做绝对化判断，不要制造恐惧。请用温柔、细腻、克制的语言输出。

请返回 JSON 格式（仅返回 JSON，不要其他文字）：
{
  "summary": "梦境摘要（2-4句话）",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "emotionAnalysis": "情绪分析（2-3句话）",
  "possibleConnection": "可能的现实关联（2-3句话）",
  "aiResponse": "一句温柔的回应"
}

梦境标题：${title || "（无）"}
梦境内容：${content}`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  });
  if (!resp.ok) throw new Error(`OpenAI API error: ${resp.status}`);
  const json = await resp.json() as { choices: { message: { content: string } }[] };
  return JSON.parse(json.choices[0].message.content);
}

async function callOpenAIChat(message: string, history: { role: string; content: string }[], dreamContext: string | null | undefined, apiKey: string, model: string) {
  const systemPrompt = `你是「巡梦」中的 AI 梦境观察者。你不是算命师，也不是心理医生。你会温柔地陪用户回忆梦境，帮助用户整理情绪、发现梦境中的意象和现实生活的可能联系。你的回答要简洁、细腻、治愈，不要吓人，不要给绝对结论。${dreamContext ? `\n\n用户当前讨论的梦境：\n${dreamContext}` : ""}`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: message },
  ];

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, temperature: 0.8 }),
  });
  if (!resp.ok) throw new Error(`OpenAI API error: ${resp.status}`);
  const json = await resp.json() as { choices: { message: { content: string } }[] };
  return json.choices[0].message.content;
}

async function callOpenAIImage(imageBase64: string, mimeType: string, apiKey: string, model: string) {
  const prompt = `请识别这张图片中的内容，尤其关注文字、手写笔记、梦境相关元素、情绪氛围和可能的象征物。请返回（仅返回 JSON，不要其他文字）：
{
  "description": "图片内容描述",
  "recognizedText": "识别出的文字（没有则为空字符串）",
  "dreamElements": ["元素1", "元素2"],
  "suggestedTitle": "建议梦境标题",
  "draftContent": "可以转成梦境记录的正文（2-5句话）"
}`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          { type: "text", text: prompt },
        ],
      }],
      temperature: 0.5,
    }),
  });
  if (!resp.ok) throw new Error(`OpenAI API error: ${resp.status}`);
  const json = await resp.json() as { choices: { message: { content: string } }[] };
  return JSON.parse(json.choices[0].message.content);
}

router.get("/ai/settings", async (req, res): Promise<void> => {
  const apiKey = process.env.OPENAI_API_KEY;
  const hasApiKey = !!apiKey;
  res.json({
    mode: hasApiKey ? "real" : "mock",
    hasApiKey,
    modelName: process.env.AI_MODEL_NAME || "gpt-4o",
  });
});

router.post("/ai/organize", async (req, res): Promise<void> => {
  const parsed = AiOrganizeDreamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.AI_MODEL_NAME || "gpt-4o";

  if (!apiKey) {
    const mock = getMockOrganize();
    req.log.info("AI organize: using mock response");
    res.json({ ...mock, isMock: true });
    return;
  }

  try {
    const result = await callOpenAIOrganize(parsed.data.content, parsed.data.title, apiKey, model);
    res.json({ ...result, isMock: false });
  } catch (err) {
    req.log.error({ err }, "AI organize failed, falling back to mock");
    const mock = getMockOrganize();
    res.json({ ...mock, isMock: true });
  }
});

router.post("/ai/chat", async (req, res): Promise<void> => {
  const parsed = AiChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.AI_MODEL_NAME || "gpt-4o";

  if (!apiKey) {
    req.log.info("AI chat: using mock response");
    const reply = getMockChatReply();
    res.json({ reply, isMock: true });
    return;
  }

  try {
    const reply = await callOpenAIChat(
      parsed.data.message,
      parsed.data.history,
      parsed.data.dreamContext,
      apiKey,
      model
    );
    res.json({ reply, isMock: false });
  } catch (err) {
    req.log.error({ err }, "AI chat failed, falling back to mock");
    res.json({ reply: getMockChatReply(), isMock: true });
  }
});

router.post("/ai/recognize-image", async (req, res): Promise<void> => {
  const parsed = AiRecognizeImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.AI_MODEL_NAME || "gpt-4o";

  if (!apiKey) {
    req.log.info("AI image recognition: using mock response");
    res.json({ ...MOCK_IMAGE_RESULTS[0], isMock: true });
    return;
  }

  try {
    const result = await callOpenAIImage(
      parsed.data.imageBase64,
      parsed.data.mimeType || "image/jpeg",
      apiKey,
      model
    );
    res.json({ ...result, isMock: false });
  } catch (err) {
    req.log.error({ err }, "AI image recognition failed, falling back to mock");
    res.json({ ...MOCK_IMAGE_RESULTS[0], isMock: true });
  }
});

export default router;
