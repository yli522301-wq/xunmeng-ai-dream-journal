import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  useGetActiveCharacter, useListCharacters, useActivateCharacter,
  useGetAiSettings, useDreamChat, useCreateDream, useAiRecognizeImage,
} from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Mic, Square, Image as ImageIcon, Sparkles, Music2, X, BookOpen, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { CompanionOrb, CompanionColor } from "@/components/companion-orb";
import { AudioWaveform } from "@/components/audio-waveform";
import { HistoryBottomSheet } from "@/components/history-panel";
import { AtmospherePanel } from "@/components/atmosphere-panel";
import { AmbientBg, type BgTheme } from "@/components/ambient-bg";
import { useAmbientSound, type AmbientSoundType } from "@/hooks/use-ambient-sound";
import { useAmbientMusic, type MusicType } from "@/hooks/use-ambient-music";
import { DreamAntigravityBackground } from "@/components/DreamAntigravityBackground";

// ── Types ──────────────────────────────────────────────────────────────────
export type CharKey = "daoshen" | "muge" | "anuan";
export type ResponseMode = "solo" | "multi" | "cross";
export type VoiceStatus = "idle" | "requesting" | "recording" | "processing" | "error";

const FALLBACK_TRANSCRIPT = "我梦到自己一直在赶路，但怎么都赶不上。";

export interface ChatMessage {
  id: string;
  role: "user" | CharKey;
  type?: "text" | "image" | "audio";
  content: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  audioUrl?: string;
  audioDuration?: number;
  transcription?: string;
  timestamp: string;
}

export interface MusicContext {
  source: "builtin" | "local";
  title: string;
  artist: string;
  fileName: string;
  type: string;
  mood: string;
  isPlaying: boolean;
}

export interface DreamCharConfig {
  key: CharKey;
  nameMatch: string;
  name: string;
  enName: string;
  particleColor: string;
  glowColor: string;
  companionColor: CompanionColor;
  hsl: string;
  subtitle: string;
  hint: string;
  firstMessage: string;
  stylePrompt: string;
}

// ── Character config ────────────────────────────────────────────────────────
const DREAM_CHARS: DreamCharConfig[] = [
  {
    key: "daoshen",
    nameMatch: "岛深",
    name: "岛深",
    enName: "Daoshan",
    particleColor: "#6B8CFF",
    glowColor: "rgba(107,140,255,0.28)",
    companionColor: "teal",
    hsl: "185 70% 55%",
    subtitle: "潜入梦的深处",
    hint: "你可以从一个画面开始，我会陪你慢慢往下潜。",
    firstMessage: "梦像一片海。你只需要说出最先浮上来的那个画面，我会陪你一起往深处走。",
    stylePrompt: "你是岛深，梦境的理性解析者。风格冷静克制，结构化，擅长分析象征意象和潜意识模式，语气略带锋利。你认为暮歌太感性、阿暖太直白，但保持克制的尊重。三位解析者在共同讨论同一个梦。",
  },
  {
    key: "muge",
    nameMatch: "暮歌",
    name: "暮歌",
    enName: "Muge",
    particleColor: "#9B7CFF",
    glowColor: "rgba(155,124,255,0.28)",
    companionColor: "indigo",
    hsl: "240 70% 65%",
    subtitle: "你可以从任何地方开始",
    hint: "梦境就像一面镜子，有时映出的是我们白天来不及细想的事情。",
    firstMessage: "梦境就像一面镜子，有时映出的是我们白天来不及细想的事情。你的梦里，最近出现了什么？",
    stylePrompt: "你是暮歌，梦境的诗意叙述者。语言温柔文学化，擅长把梦境转化为有情绪流动的故事，关注意象的色彩与运动。你认为岛深过于理性、阿暖过于直白，但态度温柔。三位解析者在共同讨论同一个梦。",
  },
  {
    key: "anuan",
    nameMatch: "阿暖",
    name: "阿暖",
    enName: "Anuan",
    particleColor: "#F2A84B",
    glowColor: "rgba(242,168,75,0.26)",
    companionColor: "amber",
    hsl: "38 90% 60%",
    subtitle: "我在，慢慢说",
    hint: "不用讲完整，哪怕只是一个感觉，也可以交给我。",
    firstMessage: "不用急着说清楚。你可以先告诉我，醒来后身体里留下的第一个感觉是什么。",
    stylePrompt: "你是阿暖，温暖陪伴型梦境朋友。先接住情绪再慢慢分析，语气亲近柔和，生活化。你觉得岛深和暮歌说得太复杂，用户需要先被接住情绪。三位解析者在共同讨论同一个梦。",
  },
];

const CHAR_MAP = Object.fromEntries(DREAM_CHARS.map(c => [c.key, c])) as Record<CharKey, DreamCharConfig>;
const ALL_KEYS: CharKey[] = ["daoshen", "muge", "anuan"];

// ── Local mock AI ───────────────────────────────────────────────────────────
const THINKING_MSG: Record<CharKey, string> = {
  daoshen: "岛深正在往梦的深处看…",
  muge:    "暮歌正在整理梦的画面…",
  anuan:   "阿暖正在慢慢听你说…",
};

const MOCK_POOL: Record<CharKey, string[]> = {
  daoshen: [
    "我会先看这个梦的结构。你描述的这个场景里有一种被追赶或被限制的张力——这往往不是单纯的情节，而是潜意识在用象征语言说话。反复出现的感觉，通常指向清醒时回避的某个问题。",
    "从象征层面看，这个梦有几个值得注意的元素：运动的方向、空间的边界、以及你在梦里的情绪底色。梦里的地形，通常是内心状态的镜像。",
    "有意思。这个意象的核心是一种「距离感」——你和某个目标之间的距离不是在缩短，而是在维持。这种模式在现实里，有对应的关系或处境吗？",
  ],
  muge: [
    "这个梦像一条被拉长的路。你一直在走，但终点像雾一样往后退。那种追不上的感觉，有时候不是在追一个地方，而是在追一个正在离开的自己。梦把它变成了距离。",
    "你说的画面，让我想到一种感觉——路在继续，人却站着不动。梦里的距离，往往是心里距离的倒影。你梦里有光吗，还是一直是灰色的？",
    "这些碎片拼在一起，像一幅没有标题的画。我想帮你找到那个标题。梦境有时候不讲逻辑，但它有自己的情绪诗学——你留下的感觉，比情节更重要。",
  ],
  anuan: [
    "先别急着解释它。光是这个梦留下的感觉，就已经很值得被看见了。你说完以后，有没有觉得轻松了一点点？",
    "听你说完，我心里有点紧。这个梦好像带着一些你平时没有说出口的累。不用讲完整，你现在感觉怎么样？",
    "嗯，我听到了。不管梦里发生了什么，它留下来的那种情绪是真实的。我们可以慢慢聊，不用一下子说清楚。",
  ],
};

function getMockReply(key: CharKey, userMsg: string, history: ChatMessage[]): string {
  // If user mentions another character by name, reference their last message
  const mentioned = ALL_KEYS.filter(k => k !== key).find(k =>
    userMsg.includes(CHAR_MAP[k].name)
  );
  const refMsg = mentioned
    ? [...history].reverse().find(m => m.role === mentioned)
    : null;

  const pool = MOCK_POOL[key];
  let reply = pool[Math.floor(Math.random() * pool.length)];

  if (refMsg) {
    const snippet = refMsg.content.slice(0, 28);
    const prefixes: Record<CharKey, string> = {
      daoshen: `${CHAR_MAP[mentioned!].name}的角度更偏情感直觉——"${snippet}…" 我补充一个结构视角：`,
      muge:    `岛深说得很精准，但我更想留在那个画面里。"${snippet}…"——`,
      anuan:   `他们说的都有道理，但我想先问问你听完以后，感觉怎么样？"${snippet}…" 这句话有没有让你想到什么？`,
    };
    reply = prefixes[key] + " " + reply;
  }

  return reply;
}

const DREAMS_STORAGE_KEY = "xm-saved-dreams";

function getCharConfig(name: string): DreamCharConfig {
  for (const c of DREAM_CHARS) {
    if (name.includes(c.nameMatch)) return c;
  }
  return DREAM_CHARS[1];
}

// ── Demo messages ──────────────────────────────────────────────────────────
const DEMO_MESSAGES: ChatMessage[] = [];

// ── Helpers ────────────────────────────────────────────────────────────────
function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
function nowTime() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}
function messagesToApiHistory(msgs: ChatMessage[]) {
  return msgs.map(m => ({
    role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
    content: m.role === "user" ? m.content : `[${CHAR_MAP[m.role as CharKey]?.name ?? m.role}] ${m.content}`,
  }));
}

/**
 * Strip character-name prefixes from the start of AI replies.
 * Removes patterns like:
 *   [阿暖], [暮歌], [岛深], [Anuan], [Muge], [Daoshen], [Unknown]
 *   阿暖：, 暮歌：, 岛深：, Anuan:, Muge:, Daoshen:, Unknown:, unknown:
 */
function stripCharPrefix(text: string): string {
  return text
    .replace(/^(\[Unknown\]|\[unknown\]|\[\s*\])\s*[:：]?\s*/, "")
    .replace(/^(\[\u963f\u6696\]|\[\u66ae\u6b4c\]|\[\u5c9b\u6df1\]|\[Anuan\]|\[Muge\]|\[Daoshen\])\s*[:：]?\s*/i, "")
    .replace(/^(\u963f\u6696|\u66ae\u6b4c|\u5c9b\u6df1|Anuan|Muge|Daoshen|Unknown|unknown)\s*[:：]\s*/, "")
    .trim();
}

// ── Image compression utility ──────────────────────────────────────────────
/**
 * Resize + compress an image DataURL to a JPEG of at most `maxWidth` px wide.
 * Returns the compressed DataURL, or the original if compression fails / makes it larger.
 */
function compressImage(dataUrl: string, maxWidth: number, quality = 0.65): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, maxWidth / img.naturalWidth);
      const w = Math.round(img.naturalWidth  * ratio);
      const h = Math.round(img.naturalHeight * ratio);
      try {
        const canvas = document.createElement("canvas");
        canvas.width  = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(dataUrl); return; }
        ctx.drawImage(img, 0, 0, w, h);
        const out = canvas.toDataURL("image/jpeg", quality);
        resolve(out.length < dataUrl.length ? out : dataUrl);
      } catch { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

const SCENE_DEFAULTS: Record<BgTheme, { sound: AmbientSoundType; music: MusicType }> = {
  void:  { sound: "none",  music: "none" },
  rain:  { sound: "rain",  music: "piano-rain" },
  night: { sound: "night", music: "strings" },
  fog:   { sound: "none",  music: "fog" },
  stars: { sound: "night", music: "none" },
};

const AVATAR_STORAGE_KEY = "xm-avatars";

function loadAvatars(): Record<CharKey, string | null> {
  try {
    const raw = localStorage.getItem(AVATAR_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { daoshen: null, muge: null, anuan: null };
}
function saveAvatars(a: Record<CharKey, string | null>) {
  try { localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(a)); } catch { /* ignore */ }
}

// ── Component ───────────────────────────────────────────────────────────────
export default function DreamSpace() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: activeChar, refetch: refetchActive } = useGetActiveCharacter();
  const { data: characters } = useListCharacters();
  const { data: settings }   = useGetAiSettings();
  const activateMutation     = useActivateCharacter();
  const dreamChatMutation    = useDreamChat();
  const createDreamMutation  = useCreateDream();
  const recognizeMutation   = useAiRecognizeImage();

  const [messages,      setMessages]      = useState<ChatMessage[]>(DEMO_MESSAGES);
  const [inputText,     setInputText]     = useState("");
  const [voiceStatusS,  setVoiceStatusS]  = useState<VoiceStatus>("idle");
  const [isThinking,    setIsThinking]    = useState(false);
  const [thinkingMsg,   setThinkingMsg]   = useState("正在感应…");
  const [avatars,       setAvatars]       = useState<Record<CharKey, string | null>>(loadAvatars);

  const [pendingImageDataUrl, setPendingImageDataUrl] = useState<string | null>(null);
  const [bgMusicOpen,    setBgMusicOpen]    = useState(false);
  const [bgMusicUrl,     setBgMusicUrl]     = useState<string | null>(null);
  const [bgMusicName,    setBgMusicName]    = useState("");
  const [bgMusicPlaying, setBgMusicPlaying] = useState(false);
  const [bgMusicVolume,  setBgMusicVolume]  = useState(0.3);
  const bgAudioRef          = useRef<HTMLAudioElement | null>(null);
  const [musicContext, setMusicContext] = useState<MusicContext | null>(null);
  const musicContextRef = useRef<MusicContext | null>(null);

  // ── ElevenLabs TTS state ──────────────────────────────────────────────────
  const [ttsEnabled, setTtsEnabledState] = useState(() => {
    try { return localStorage.getItem("xm-tts-enabled") !== "false"; } catch { return true; }
  });
  const [ttsVolume, setTtsVolumeState] = useState(() => {
    try { return Number(localStorage.getItem("xm-tts-volume") ?? "0.7"); } catch { return 0.7; }
  });
  const [ttsStatus, setTtsStatus] = useState<"idle" | "loading" | "playing" | "blocked">("idle");
  const [ttsVoiceOpen, setTtsVoiceOpen] = useState(false);
  const ttsEnabledRef  = useRef(true);
  const ttsVolumeRef   = useRef(0.7);
  const ttsAudioRef    = useRef<HTMLAudioElement | null>(null);
  const ttsCacheRef    = useRef<Map<string, string>>(new Map());
  const bgMusicInputRef     = useRef<HTMLInputElement>(null);
  const mediaRecorderRef    = useRef<MediaRecorder | null>(null);
  const audioChunksRef      = useRef<Blob[]>([]);
  const audioRecordStartRef = useRef<number>(0);
  const pendingTranscriptRef = useRef<string | null>(null);

  // Use a ref for voiceStatus so recognition callbacks never see stale state
  const voiceStatusRef        = useRef<VoiceStatus>("idle");
  const transcriptRef         = useRef<string | null>(null);
  const interimTranscriptRef  = useRef<string | null>(null); // captures partial results
  const typingStartedRef      = useRef<string | null>(null); // tracks which msgId typewriter started
  const handleSendRef         = useRef<(text?: string, voiceData?: { duration?: number }) => Promise<void>>(async () => {});

  // ── Anuan wake-up interaction ─────────────────────────────────────────────
  const USER_NAME = "Charlie"; // Demo value — swap for real user profile later
  const [wakeText,    setWakeText]    = useState<string | null>(null);
  const [wakeTyped,   setWakeTyped]   = useState("");
  const [wakeClicked, setWakeClicked] = useState(false);
  const wakeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeTimeoutRef  = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const requestingTimeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingIntervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  const [typingMsgId,   setTypingMsgId]   = useState<string | null>(null);
  const [typingContent, setTypingContent] = useState<string>("");

  // ── TTS subtitle sync (voice-timed, independent of chat typewriter) ─
  const [subtitleText,   setSubtitleText]   = useState<string>("");
  const subtitleFullRef  = useRef<string>("");
  const subtitleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subtitleLastIdx  = useRef<number>(0);

  /** Start updating subtitleText based on audio.currentTime */
  function startSubtitleSync(audio: HTMLAudioElement, text: string) {
    subtitleFullRef.current = text;
    setSubtitleText("");
    subtitleLastIdx.current = 0;
    const isChinese = /[\u4e00-\u9fff]/.test(text);
    const tick = () => {
      if (!audio || !subtitleFullRef.current) return;
      const duration = audio.duration || 1;
      const currentTime = audio.currentTime;
      const progress = currentTime / duration;
      // Lead text ahead of voice: 2-5 words for English, 4-8 chars for Chinese
      const lead = isChinese
        ? Math.max(4, Math.ceil(text.length * 0.08))
        : Math.max(10, Math.ceil(text.length * 0.08));
      const targetIdx = Math.floor(progress * text.length);
      const idx = Math.min(text.length, targetIdx + lead);
      if (idx !== subtitleLastIdx.current) {
        subtitleLastIdx.current = idx;
        setSubtitleText(text.slice(0, idx));
      }
      if (!audio.paused && !audio.ended && audio.currentTime < audio.duration) {
        subtitleTimerRef.current = setTimeout(tick, 80);
      }
    };
    subtitleTimerRef.current = setTimeout(tick, 80);
  }

  function stopSubtitleSync() {
    if (subtitleTimerRef.current) clearTimeout(subtitleTimerRef.current);
    subtitleTimerRef.current = null;
    subtitleLastIdx.current = 0;
  }

  function startTypewriter(msgId: string, fullText: string, intervalMs = 38) {
    if (typingStartedRef.current === msgId) return; // already started
    typingStartedRef.current = msgId;
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    setTypingMsgId(msgId);
    setTypingContent("");
    let idx = 0;
    const INTERVAL = intervalMs;
    typingIntervalRef.current = setInterval(() => {
      idx += 1;
      if (idx >= fullText.length) {
        setTypingContent(fullText);
        clearInterval(typingIntervalRef.current!);
        typingIntervalRef.current = null;
        setTypingMsgId(null);
      } else {
        setTypingContent(fullText.slice(0, idx));
      }
    }, INTERVAL);
  }

  function setVoiceStatus(s: VoiceStatus) {
    voiceStatusRef.current = s;
    setVoiceStatusS(s);
  }
  // Derived alias used in render
  const voiceStatus   = voiceStatusS;

  // ── Wake-up interaction — works for all characters ───────────────────────
  function getWakePhrases(char: string): string[] {
    const n = USER_NAME;
    if (char === "anuan") {
      return [
        "Who's out there?",
        `Hey ${n}… you there?`,
        `How are you doing today, ${n}?`,
        "Tell me, what kind of dream found you today?",
        "Hey. I'm here. What did you see last night?",
        "You look like you brought a strange dream with you.",
        `Alright, ${n}. What are we looking at today?`,
        "I'm listening. Start anywhere.",
      ];
    }
    if (char === "muge") {
      return [
        "You came to show me something odd, didn't you?",
        `Hey ${n}. What's the one thing you almost forgot?`,
        "Tell me the part that didn't make sense.",
        `So, ${n}... what did you really see?`,
        "I'm here. Start with the strange detail.",
        "You look like you walked out of something unfinished.",
        `What did the dream refuse to explain, ${n}?`,
        "The most interesting part is usually the one you skip. Let's go there.",
      ];
    }
    // daoshen
    return [
      `今天怎么样，${n}？`,
      `你是不是又做了一个没头没尾的梦？`,
      `来吧，${n}，不用跟我云山雾罩，说实话。`,
      `最近是不是趋进一个环，事很多，但迈不过去。`,
      `今天窗外有没有烂太阳，没有的话就是纬度的问题。`,
      `你的梦和你的现实比比，哪个更胖一点？`,
      `我不急着求一个答案，就听听实话。`,
      `${n}，还没睡醒吧？说说看。`,
    ];
  }

  function handleOrbClick() {
    if (ttsStatus === "playing" || ttsStatus === "loading") return;

    const phrases = getWakePhrases(activeKey);
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];

    if (wakeIntervalRef.current) { clearInterval(wakeIntervalRef.current); wakeIntervalRef.current = null; }
    if (wakeTimeoutRef.current)  { clearTimeout(wakeTimeoutRef.current);   wakeTimeoutRef.current  = null; }

    setWakeText(phrase);
    setWakeTyped("");
    setWakeClicked(true);
    setTimeout(() => setWakeClicked(false), 600);

    let idx = 0;
    wakeIntervalRef.current = setInterval(() => {
      idx++;
      setWakeTyped(phrase.slice(0, idx));
      if (idx >= phrase.length) {
        clearInterval(wakeIntervalRef.current!);
        wakeIntervalRef.current = null;
        wakeTimeoutRef.current = setTimeout(() => {
          setWakeText(null);
          setWakeTyped("");
        }, 2500);
      }
    }, 45);

    // Fire TTS — silent on failure, wake is best-effort
    void playTtsSafe(`wake_${Date.now()}`, phrase, activeKey);
  }
  const isListening   = voiceStatus === "recording"; // for CompanionOrb / AudioWaveform

  const [atmosphereOpen,   setAtmosphereOpen]   = useState(false);
  const [showSaveConfirm,  setShowSaveConfirm]  = useState(false);
  const [bgTheme,        setBgTheme]        = useState<BgTheme>("void");
  const [ambientSound,   setAmbientSound]   = useState<AmbientSoundType>("none");
  const [music,          setMusic]          = useState<MusicType>("none");

  const { play: playAmbient, stop: stopAmbient } = useAmbientSound();
  const { play: playMusic,   stop: stopMusic }   = useAmbientMusic();

  const fileInputRef   = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Keep handleSendRef current so recognition callbacks avoid stale closures
  useEffect(() => { handleSendRef.current = handleSend; });

  // Set up SpeechRecognition ONCE on mount — never recreate on char switch
  useEffect(() => {
    const SR: any =
      typeof window !== "undefined"
        ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
        : null;
    if (!SR) return;

    const r = new SR();
    r.continuous      = false;
    r.interimResults  = true;
    r.maxAlternatives = 1;
    r.lang            = "zh-CN";

    r.onstart = () => {
      if (requestingTimeoutRef.current) {
        clearTimeout(requestingTimeoutRef.current);
        requestingTimeoutRef.current = null;
      }
      setVoiceStatus("recording");
    };

    r.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          transcriptRef.current = t;        // best: final result
          interimTranscriptRef.current = t; // keep in sync
        } else {
          interimTranscriptRef.current = t; // fallback if onend fires before final
        }
      }
    };

    r.onerror = (e: any) => {
      if (requestingTimeoutRef.current) {
        clearTimeout(requestingTimeoutRef.current);
        requestingTimeoutRef.current = null;
      }
      transcriptRef.current = null;
      interimTranscriptRef.current = null;
      const prev = voiceStatusRef.current;
      setVoiceStatus("idle");
      if (e.error === "not-allowed" || e.error === "permission-denied") {
        toast({ title: "没有获得麦克风权限，你也可以直接输入梦境。" });
      } else if (prev !== "idle") {
        toast({ title: "我没听清，可以再说一次。" });
      }
    };

    r.onend = () => {
      const prev = voiceStatusRef.current;
      if (prev === "idle" || prev === "error") return;
      // Prefer final transcript, fall back to last interim result
      const text = transcriptRef.current || interimTranscriptRef.current;
      transcriptRef.current = null;
      interimTranscriptRef.current = null;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        pendingTranscriptRef.current = text;
        setVoiceStatus("processing");
        mediaRecorderRef.current.stop();
      } else {
        setVoiceStatus("idle");
        if (text && text.trim()) {
          console.log("[STT] real transcript =", text.trim());
          setTimeout(() => handleSendRef.current(text.trim()), 200);
        } else {
          console.log("[STT] using fallback transcription");
          toast({ title: "当前没有识别到语音，已用示例梦境演示。" });
          setTimeout(() => handleSendRef.current(FALLBACK_TRANSCRIPT), 200);
        }
      }
    };

    recognitionRef.current = r;
    return () => {
      try { r.abort(); } catch { /* ignore */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { stopAmbient(); stopMusic(); }, [stopAmbient, stopMusic]);

  // Sync music volume
  useEffect(() => {
    if (bgAudioRef.current) bgAudioRef.current.volume = bgMusicVolume;
  }, [bgMusicVolume]);

  // Duck background music during recording (lower, never pause)
  useEffect(() => {
    const audio = bgAudioRef.current;
    if (!audio || audio.paused) return;
    if (voiceStatusS === "recording") {
      audio.volume = bgMusicVolume * 0.3;
    } else {
      audio.volume = bgMusicVolume;
    }
  }, [voiceStatusS]);

  // Persist avatars
  useEffect(() => { saveAvatars(avatars); }, [avatars]);

  const handleAvatarChange = useCallback((key: CharKey, dataUrl: string) => {
    setAvatars(prev => ({ ...prev, [key]: dataUrl }));
  }, []);

  const handleSceneSelect = (t: BgTheme) => {
    setBgTheme(t);
    const def = SCENE_DEFAULTS[t];
    setAmbientSound(def.sound);
    playAmbient(def.sound);
    setMusic(def.music);
    playMusic(def.music);
  };
  const handleSoundChange = (s: AmbientSoundType) => { setAmbientSound(s); playAmbient(s); };
  const handleMusicChange = (m: MusicType) => {
    setMusic(m);
    playMusic(m);
    if (m === "none") {
      setMusicContext(null);
      musicContextRef.current = null;
    } else {
      const labels: Record<MusicType, string> = {
        none: "无", piano: "钢琴微光", fog: "雾蓝氛围",
        strings: "夜色弦音", "piano-rain": "雨夜钢琴",
      };
      const ctx: MusicContext = {
        source: "builtin", title: labels[m], artist: "巡梦",
        fileName: "", type: "synth", mood: "", isPlaying: true,
      };
      setMusicContext(ctx);
      musicContextRef.current = ctx;
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const charConfig    = activeChar ? getCharConfig(activeChar.name) : DREAM_CHARS[1];
  const activeKey     = charConfig.key;
  const hasAtmosphere = bgTheme !== "void" || ambientSound !== "none" || music !== "none";

  const displayReply = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === activeKey) return messages[i];
    }
    return null;
  }, [messages, activeKey]);

  const isSpeaking = (!!displayReply && !isThinking) || !!typingMsgId;
  const hsl        = charConfig.hsl;

  // ── Tab switch ───────────────────────────────────────────────────────────
  const handleTabClick = async (id: string) => {
    if (activeChar?.id === id) return;
    await activateMutation.mutateAsync({ id });
    refetchActive();
    // Intentionally do NOT clear messages — shared thread
  };

  // ── Keep TTS refs in sync with state ─────────────────────────────────────
  useEffect(() => { ttsEnabledRef.current = ttsEnabled; }, [ttsEnabled]);
  useEffect(() => {
    ttsVolumeRef.current = ttsVolume;
    if (ttsAudioRef.current) ttsAudioRef.current.volume = ttsVolume;
  }, [ttsVolume]);

  const setTtsEnabled = (v: boolean) => {
    setTtsEnabledState(v);
    ttsEnabledRef.current = v;
    try { localStorage.setItem("xm-tts-enabled", String(v)); } catch { /* ignore */ }
    if (!v) {
      ttsAudioRef.current?.pause();
      ttsAudioRef.current = null;
      setTtsStatus("idle");
      // Restore bg music if ducked
      if (bgAudioRef.current) bgAudioRef.current.volume = bgMusicVolume;
    }
  };
  const setTtsVolume = (v: number) => {
    setTtsVolumeState(v);
    ttsVolumeRef.current = v;
    try { localStorage.setItem("xm-tts-volume", String(v)); } catch { /* ignore */ }
    if (ttsAudioRef.current) ttsAudioRef.current.volume = v;
  };

  // ── TTS ──────────────────────────────────────────────────────────────────
  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = activeChar?.language === "en" ? "en-US" : "zh-CN";
    u.rate = 0.88;
    window.speechSynthesis.speak(u);
  };

  // ── ElevenLabs TTS playback (all characters) ─────────────────────────
  const playTtsSafe = async (
    msgId: string,
    text: string,
    charKey: CharKey,
    onPlayStart?: (audioDuration: number) => void,
  ) => {
    if (!ttsEnabledRef.current) {
      onPlayStart?.(5);
      return;
    }

    // Cancel any ongoing TTS
    window.speechSynthesis.cancel();
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }

    // Check session cache
    let audioUrl = ttsCacheRef.current.get(msgId);

    if (!audioUrl) {
      setTtsStatus("loading");
      try {
        const resp = await fetch("/api/ai/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.slice(0, 500), character: charKey }),
        });
        console.log("[TTS] response status:", resp.status, resp.headers.get("content-type"));
        if (!resp.ok) {
          const errText = await resp.text().catch(() => "");
          console.error("[TTS] fetch failed:", resp.status, errText);
          toast({ title: "语音暂时没有接通，已先显示文字。" });
          setTtsStatus("idle");
          onPlayStart?.(5);
          return;
        }
        const blob = await resp.blob();
        console.log("[TTS] blob size:", blob.size);
        if (blob.size === 0) {
          console.error("[TTS] blob is empty");
          toast({ title: "语音暂时没有接通，已先显示文字。" });
          setTtsStatus("idle");
          onPlayStart?.(5);
          return;
        }
        audioUrl = URL.createObjectURL(blob);
        console.log("[TTS] audioUrl created:", !!audioUrl);
        ttsCacheRef.current.set(msgId, audioUrl);
      } catch (err) {
        console.error("[TTS] fetch error:", err);
        toast({ title: "语音暂时没有接通，已先显示文字。" });
        setTtsStatus("idle");
        onPlayStart?.(5);
        return;
      }
    }

    const originalBgVol = bgAudioRef.current?.volume ?? bgMusicVolume;
    const audio = new Audio(audioUrl);
    audio.volume = ttsVolumeRef.current;
    ttsAudioRef.current = audio;

    if (bgAudioRef.current && bgMusicPlaying) {
      bgAudioRef.current.volume = originalBgVol * 0.3;
    }

    const restoreBg = () => {
      if (bgAudioRef.current && bgMusicPlaying) bgAudioRef.current.volume = originalBgVol;
      ttsAudioRef.current = null;
      setTtsStatus("idle");
      setSubtitleText("");
    };

    audio.onended = () => {
      ttsCacheRef.current.delete(msgId);
      URL.revokeObjectURL(audioUrl!);
      stopSubtitleSync();
      restoreBg();
      // Auto-dismiss wake panel after audio ends
      if (msgId.startsWith("wake_")) {
        setTimeout(() => {
          setWakeText(null);
          setWakeTyped("");
        }, 2500);
      }
    };
    audio.onerror = () => {
      onPlayStart?.(5); // start typewriter if not started yet
      stopSubtitleSync();
      restoreBg();
    };
    audio.onpause = () => {
      stopSubtitleSync();
    };
    audio.onplay = () => {
      startSubtitleSync(audio, text);
    };

    setTtsStatus("playing");
    try {
      await audio.play();
      console.log("[TTS] play() success, duration:", audio.duration);
      // Calibrate typewriter speed to audio duration
      const dur = audio.duration || (text.length * 0.12);
      onPlayStart?.(dur);
    } catch (err: any) {
      console.warn("[TTS] play() blocked:", err?.name, err?.message);
      if (err?.name === "NotAllowedError") {
        setTtsStatus("blocked");
        onPlayStart?.(5); // start typewriter anyway
      } else {
        onPlayStart?.(5);
        restoreBg();
      }
    }
  };

  const handleManualPlay = () => {
    if (!ttsAudioRef.current) return;
    ttsAudioRef.current.play().then(() => {
      setTtsStatus("playing");
      console.log("[TTS] manual play() success");
    }).catch(err => {
      console.error("[TTS] manual play() failed:", err);
      setTtsStatus("idle");
    });
  };

  // ── Get DB character system prompt by key ─────────────────────────────────
  const getSystemPrompt = useCallback((key: CharKey): string => {
    const nameMatch = CHAR_MAP[key].nameMatch;
    const dbChar = characters?.find(c => c.name.includes(nameMatch));
    return dbChar?.systemPrompt ?? CHAR_MAP[key].stylePrompt;
  }, [characters]);

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = async (text?: string, voiceData?: { duration?: number }) => {
    const msg = (text ?? inputText).trim();
    const imgUrl = text ? null : pendingImageDataUrl;
    if (!msg && !imgUrl && !voiceData) return;
    if (!activeChar) return;
    setInputText("");
    if (!text) setPendingImageDataUrl(null);
    setThinkingMsg(THINKING_MSG[activeKey]);
    setIsThinking(true);

    // Generate a small thumbnail (240 px) for fallback saves; imageUrl is
    // already a 600 px cardCover compressed at upload time.
    let thumbnailUrl: string | undefined;
    if (imgUrl) {
      try { thumbnailUrl = await compressImage(imgUrl, 240, 0.50); } catch { /* ignore */ }
    }

    const userMsg: ChatMessage = {
      id: genId(), role: "user",
      type: voiceData ? "audio" : (imgUrl ? "image" : "text"),
      content: msg || (imgUrl ? "[图片]" : ""),
      imageUrl: imgUrl ?? undefined,
      thumbnailUrl,
      audioDuration: voiceData?.duration,
      transcription: voiceData ? (msg || undefined) : undefined,
      timestamp: nowTime(),
    };
    const updatedMsgs = [...messages, userMsg];
    setMessages(updatedMsgs);

    try {
      let replyContent: string;
      let usedMock = false;

      if (!settings?.hasApiKey) {
        // No API key — use local character-specific mock
        await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
        replyContent = stripCharPrefix(getMockReply(activeKey, msg, updatedMsgs));
        usedMock = true;
      } else {
        try {
          // Build history: last ≤12 turns before the current message
          const historyItems = updatedMsgs.slice(-13, -1).map(m => ({
            role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
            content: m.role === "user"
              ? m.content
              : `[${CHAR_MAP[m.role as CharKey]?.name ?? m.role}] ${m.content}`,
            imageUrl: m.imageUrl ?? null,
          }));

          const musicCtx = musicContextRef.current;
          console.log("Sending musicContext:", musicCtx);
          const res = await dreamChatMutation.mutateAsync({
            data: {
              activeCharacter: activeKey,
              history: historyItems,
              userInput: msg || "[图片]",
              imageUrl: imgUrl ?? null,
              musicContext: musicCtx,
            },
          });
          replyContent = stripCharPrefix(res.reply);
          if (res.isMock) usedMock = true;
        } catch {
          // API call failed — fall back to local mock silently with toast
          await new Promise(r => setTimeout(r, 400 + Math.random() * 300));
          replyContent = stripCharPrefix(getMockReply(activeKey, msg, updatedMsgs));
          usedMock = true;
        }
      }

      // Only show the mock toast when the user expected a real reply
      if (usedMock && settings?.hasApiKey) {
        toast({ title: "AI 暂时没有接通，已切换为演示回复。" });
      }

      const reply: ChatMessage = { id: genId(), role: activeKey, content: replyContent, timestamp: nowTime() };
      setMessages(prev => [...prev, reply]);

      // Prepare empty display area; full text goes to chat history only.
      // Upper display area will be driven by TTS subtitle or typing fallback.
      setTypingMsgId(reply.id);
      setTypingContent("");
      typingStartedRef.current = null;

      // Defer typewriter until TTS starts playing so text and voice are in sync.
      // Speed calibrated to audio duration. 3-second hard fallback in case TTS hangs.
      const fallbackTimer = setTimeout(() => {
        if (typingStartedRef.current !== reply.id) {
          startTypewriter(reply.id, replyContent);
        }
      }, 3000);
      void playTtsSafe(reply.id, replyContent, activeKey, (audioDuration: number) => {
        clearTimeout(fallbackTimer);
        const msPerChar = Math.max(30, Math.min(110, (audioDuration * 1000) / replyContent.length));
        startTypewriter(reply.id, replyContent, msPerChar);
      });
    } catch {
      toast({ title: "感应失败，请重试", variant: "destructive" });
    } finally {
      setIsThinking(false);
    }
  };

  // ── Mic state machine ────────────────────────────────────────────────────
  const toggleMic = () => {
    // Block while busy
    if (voiceStatus === "requesting" || voiceStatus === "processing") return;

    // Stop recording
    if (voiceStatus === "recording") {
      try { recognitionRef.current?.stop(); } catch { /* ignore */ }
      setVoiceStatus("processing");
      return;
    }

    // No Speech API → immediate mock fallback
    if (!recognitionRef.current) {
      toast({ title: "当前浏览器暂不支持语音识别，已为你生成一段示例梦境。" });
      setVoiceStatus("recording");
      setTimeout(() => {
        setVoiceStatus("processing");
        setTimeout(() => {
          setVoiceStatus("idle");
          handleSend(FALLBACK_TRANSCRIPT);
        }, 500);
      }, 1800);
      return;
    }

    // Start real recording
    setVoiceStatus("requesting");

    // Start MediaRecorder alongside SpeechRecognition for audio capture
    audioChunksRef.current = [];
    audioRecordStartRef.current = Date.now();
    if (typeof MediaRecorder !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
            : MediaRecorder.isTypeSupported("audio/ogg") ? "audio/ogg" : "";
          const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
          mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
          mr.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            const transcript = pendingTranscriptRef.current ?? "";
            pendingTranscriptRef.current = null;
            const duration = Math.max(1, Math.round((Date.now() - audioRecordStartRef.current) / 1000));
            audioChunksRef.current = [];
            mediaRecorderRef.current = null;
            setVoiceStatus("idle");
            if (transcript) {
              console.log("[STT] real transcript (MediaRecorder path) =", transcript);
            } else {
              console.log("[STT] using fallback transcription (MediaRecorder path)");
            }
            handleSendRef.current(transcript || FALLBACK_TRANSCRIPT, { duration });
          };
          mediaRecorderRef.current = mr;
          mr.start();
        })
        .catch(() => { mediaRecorderRef.current = null; });
    }

    // Safety net: if onstart never fires within 3s, fall back to mock
    requestingTimeoutRef.current = setTimeout(() => {
      if (voiceStatusRef.current === "requesting") {
        toast({ title: "当前浏览器暂不支持语音识别，已为你生成一段示例梦境。" });
        setVoiceStatus("idle");
        setTimeout(() => handleSendRef.current(FALLBACK_TRANSCRIPT), 200);
      }
    }, 3000);
    try {
      recognitionRef.current.start();
      // onstart will transition to "recording"
    } catch {
      // Already running or other error — reset and try fallback
      if (requestingTimeoutRef.current) {
        clearTimeout(requestingTimeoutRef.current);
        requestingTimeoutRef.current = null;
      }
      setVoiceStatus("idle");
      toast({ title: "当前浏览器暂不支持语音识别，已为你生成一段示例梦境。" });
      setTimeout(() => handleSendRef.current(FALLBACK_TRANSCRIPT), 300);
    }
  };

  // ── Image ──────────────────────────────────────────────────────────────────
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const raw = ev.target?.result as string;
      if (!raw) { toast({ title: "图片没有载入成功，请重新选择。" }); return; }
      // Compress to card-cover size immediately on upload so the in-memory
      // DataURL and the saved imageUrl are always a manageable JPEG.
      const compressed = await compressImage(raw, 600, 0.62);
      setPendingImageDataUrl(compressed);
    };
    reader.onerror = () => toast({ title: "图片没有载入成功，请重新选择。" });
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleBgMusicFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (bgMusicUrl) URL.revokeObjectURL(bgMusicUrl);
    const url = URL.createObjectURL(file);
    setBgMusicUrl(url);
    const name = file.name.replace(/\.[^.]+$/, "");
    setBgMusicName(name);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? "";
    const ctx: MusicContext = { source: "local", title: name, artist: "", fileName: file.name, type: ext, mood: "", isPlaying: false };
    setMusicContext(ctx);
    musicContextRef.current = ctx;
    // Try read ID3 tags
    if (ext === "mp3") {
      import("@/lib/read-id3").then(m => m.readId3Meta(file)).then(meta => {
        if (meta.title || meta.artist) {
          const updated: MusicContext = {
            ...ctx,
            title: meta.title || ctx.title,
            artist: meta.artist || ctx.artist,
          };
          setMusicContext(updated);
          musicContextRef.current = updated;
        }
      }).catch(() => { /* ignore */ });
    }
    if (bgAudioRef.current) {
      bgAudioRef.current.src = url;
      bgAudioRef.current.volume = bgMusicVolume;
      bgAudioRef.current.play()
        .then(() => {
          setBgMusicPlaying(true);
          const updated = { ...ctx, isPlaying: true };
          setMusicContext(updated);
          musicContextRef.current = updated;
        })
        .catch(() => {
          toast({ title: "这首音乐暂时无法播放，请换一首。" });
          setBgMusicPlaying(false);
          const updated = { ...ctx, isPlaying: false };
          setMusicContext(updated);
          musicContextRef.current = updated;
        });
    }
    e.target.value = "";
  };

  const toggleBgMusic = () => {
    if (!bgAudioRef.current || !bgMusicUrl) return;
    if (bgMusicPlaying) {
      bgAudioRef.current.pause();
      setBgMusicPlaying(false);
      if (musicContextRef.current) {
        const updated = { ...musicContextRef.current, isPlaying: false };
        setMusicContext(updated);
        musicContextRef.current = updated;
      }
    } else {
      bgAudioRef.current.play()
        .then(() => {
          setBgMusicPlaying(true);
          if (musicContextRef.current) {
            const updated = { ...musicContextRef.current, isPlaying: true };
            setMusicContext(updated);
            musicContextRef.current = updated;
          }
        })
        .catch(() => toast({ title: "这首音乐暂时无法播放，请换一首。" }));
    }
  };

  // ── Save dream ─────────────────────────────────────────────────────────────
  const handleSaveDream = () => {
    const userMessages = messages.filter(m => m.role === "user");
    if (userMessages.length === 0) {
      toast({ title: "先说一点梦的内容，再保存。" });
      return;
    }
    setShowSaveConfirm(true);
  };

  const confirmSave = () => {
    setShowSaveConfirm(false);
    const userMessages = messages.filter(m => m.role === "user");
    const firstUser = userMessages[0].content;
    const title = firstUser === "[图片]" || firstUser === ""
      ? "一段无言的梦"
      : firstUser.slice(0, 14) + (firstUser.length > 14 ? "…" : "");
    const lastAiMsg = [...messages].reverse().find(m => m.role !== "user");
    const summary = lastAiMsg?.content ?? firstUser;

    // coverImage: 600 px cardCover from first user image (highest quality, for
    // gallery / starmap / corridor display).
    const coverImage = messages.find(m => m.role === "user" && m.imageUrl)?.imageUrl;

    // Strip audio blobs (keep type/duration/transcription for voice card).
    // For image messages swap imageUrl → thumbnailUrl (240 px) so that only a
    // small thumbnail is persisted per message; the 600 px version lives only
    // in coverImage above.
    const messagesForStorage = messages.map(m => {
      const { audioUrl: _a, thumbnailUrl: thumb, ...rest } =
        m as ChatMessage & { audioUrl?: string; thumbnailUrl?: string };
      if (rest.type === "image" && thumb) {
        return { ...rest, imageUrl: thumb };   // 240 px thumbnail in messages
      }
      return rest;
    });

    const dream = {
      id: genId(),
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      activeCharacter: activeKey,
      messages: messagesForStorage,
      summary,
      mood: "朦胧",
      coverImage,
    };

    let existing: unknown[] = [];
    try { existing = JSON.parse(localStorage.getItem(DREAMS_STORAGE_KEY) ?? "[]"); } catch { /* ignore */ }

    // ── Tier 1: thumbnails in messages + 600 px coverImage ────────────────────
    try {
      localStorage.setItem(DREAMS_STORAGE_KEY, JSON.stringify([...existing, dream]));
      setLocation("/archive");
      return;
    } catch { /* quota exceeded — fall through */ }

    // ── Tier 2: drop coverImage (messages already have tiny thumbnails) ───────
    try {
      localStorage.setItem(DREAMS_STORAGE_KEY,
        JSON.stringify([...existing, { ...dream, coverImage: undefined }]));
      toast({ title: "图片较大，已为你保存压缩版梦境。" });
      setLocation("/archive");
      return;
    } catch { /* still failing — fall through */ }

    // ── Tier 3: strip all images; text + audio transcriptions only ────────────
    const dream3 = {
      ...dream,
      coverImage: undefined,
      messages: messagesForStorage.map(m =>
        m.type === "image" ? { ...m, imageUrl: undefined } : m
      ),
    };
    try {
      localStorage.setItem(DREAMS_STORAGE_KEY, JSON.stringify([...existing, dream3]));
      toast({ title: "图片较大，已为你保存梦境文字版本。" });
      setLocation("/archive");
    } catch {
      toast({ title: "保存失败，请清除部分旧梦境后重试。", variant: "destructive" });
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!activeChar) {
    return (
      <div className="min-h-screen bg-[#05050A] text-white flex items-center justify-center">
        <motion.div animate={{ opacity: [0.15, 0.5, 0.15] }} transition={{ duration: 2, repeat: Infinity }}
          className="text-[11px] tracking-[0.3em]" style={{ color: "rgba(255,255,255,0.3)" }}>
          正在感应…
        </motion.div>
      </div>
    );
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col items-center w-full min-h-screen bg-[#05050A] overflow-hidden relative">

      {/* ── Background ── */}
      <DreamAntigravityBackground
        particleColor={charConfig.particleColor}
        glowColor={charConfig.glowColor}
      />
      <AmbientBg theme={bgTheme} />

      {/* Character colour bloom */}
      <motion.div
        className="pointer-events-none absolute rounded-full blur-[130px]"
        style={{ width: 400, height: 400, top: -110, left: "50%", x: "-50%", zIndex: 1 }}
        animate={{ backgroundColor: [`hsl(${hsl} / 0.07)`, `hsl(${hsl} / 0.14)`, `hsl(${hsl} / 0.07)`] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* ── TOP BAR ── */}
      <header className="w-full flex items-center justify-between px-5 py-4 relative flex-shrink-0" style={{ zIndex: 20 }}>
        <div className="flex items-center gap-3">
          <Link href="/archive">
            <button className="transition-colors" style={{ color: "rgba(255,255,255,0.22)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.22)")}>
              <ArrowLeft size={17} />
            </button>
          </Link>
          <div>
            <p className="text-[10px] tracking-[0.22em] uppercase" style={{ color: "rgba(255,255,255,0.16)" }}>
              Dream Space
            </p>
            {!settings?.hasApiKey && (
              <p className="text-[9px] tracking-wider" style={{ color: "rgba(52,211,153,0.4)" }}>demo</p>
            )}
          </div>
        </div>

        {/* Character tabs */}
        <div className="flex items-center gap-0.5 rounded-full px-1 py-1"
          style={{ background: "rgba(255,255,255,0.03)" }}>
          {characters?.map(c => {
            const active = activeChar.id === c.id;
            const cfg    = getCharConfig(c.name);
            return (
              <button
                key={c.id}
                onClick={() => handleTabClick(c.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 13px", borderRadius: 999, fontSize: 12, fontWeight: 500,
                  cursor: "pointer",
                  background: active ? "rgba(255,255,255,0.12)" : "transparent",
                  border: `1px solid ${active ? "rgba(255,255,255,0.16)" : "transparent"}`,
                  color: active ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.28)",
                  transition: "all 0.3s ease",
                  outline: "none", whiteSpace: "nowrap",
                }}
              >
                <span style={{
                  width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                  backgroundColor: active ? cfg.particleColor : "rgba(255,255,255,0.18)",
                  boxShadow: active ? `0 0 6px ${cfg.particleColor}88` : "none",
                  transition: "background-color 0.3s ease",
                }} />
                {c.name.replace(/[a-zA-Z\s]/g, "")}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/archive")}
            className="transition-opacity"
            title="梦之档案"
            style={{ color: "rgba(255,255,255,0.14)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.40)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.14)")}
          >
            <BookOpen size={15} />
          </button>
          <button onClick={handleSaveDream}
            className="text-[11px] tracking-wider transition-colors"
            style={{ color: "rgba(255,255,255,0.18)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.18)")}>
            保存
          </button>
        </div>
      </header>

      {/* ── CENTER SOUL AREA ── */}
      <div className="flex-1 flex flex-col items-center justify-center w-full px-6 gap-5"
        style={{ zIndex: 10, position: "relative" }}>

        {/* CompanionOrb — clickable wake interaction for all characters */}
        <motion.div
          className="relative select-none"
          style={{ cursor: "pointer" }}
          animate={wakeClicked ? { scale: [1, 1.07, 1.02] } : { scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          onClick={handleOrbClick}
        >
          <CompanionOrb size="lg" color={charConfig.companionColor} isSpeaking={isSpeaking} isThinking={isThinking} isListening={isListening} />
          <AnimatePresence>
            {wakeClicked && (
              <motion.div
                className="absolute rounded-full pointer-events-none"
                style={{ inset: "-14px", border: `1.5px solid ${charConfig.companionColor}88` }}
                initial={{ opacity: 0.8, scale: 0.88 }}
                animate={{ opacity: 0, scale: 1.55 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.65, ease: "easeOut" }}
              />
            )}
          </AnimatePresence>
        </motion.div>

        {/* Name + subtitle — re-animate when character changes */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeChar.id}
            initial={{ opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.38, ease: "easeOut" }}
            className="flex flex-col items-center gap-1.5 text-center"
          >
            <div className="flex items-center gap-2">
              <span className="text-[19px] font-serif tracking-wide" style={{ color: "rgba(255,255,255,0.85)" }}>
                {charConfig.name}
              </span>
              <span className="text-xs tracking-[0.15em]" style={{ color: "rgba(255,255,255,0.22)" }}>
                {charConfig.enName}
              </span>
              <motion.div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: charConfig.particleColor }}
                animate={{ opacity: [0.2, 0.9, 0.2] }}
                transition={{ duration: 2.8, repeat: Infinity }}
              />
            </div>
            <p className="text-xs italic tracking-wide" style={{ color: "rgba(255,255,255,0.22)" }}>
              {charConfig.subtitle}
            </p>
          </motion.div>
        </AnimatePresence>

        <AudioWaveform isActive={isSpeaking} isListening={isListening} isThinking={isThinking} color={charConfig.companionColor} />

        {/* ── WAKE SUBTITLE — works for all characters ── */}
        <AnimatePresence>
          {wakeText !== null && (
            <motion.div
              key="wake-subtitle"
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="w-full max-w-md rounded-2xl px-4 py-3"
              style={{
                background: "rgba(6, 6, 14, 0.82)",
                backdropFilter: "blur(22px)",
                WebkitBackdropFilter: "blur(22px)",
                border: `1px solid hsl(${hsl} / 0.22)`,
                boxShadow: `0 0 28px hsl(${hsl} / 0.08), inset 0 1px 0 rgba(255,255,255,0.04)`,
              }}
            >
              <p className="text-[9px] tracking-[0.28em] mb-1.5 uppercase"
                style={{ color: `hsl(${hsl} / 0.50)` }}>
                {charConfig.enName}
              </p>
              <p className="text-[13px] leading-[1.65]" style={{ color: "rgba(255,255,255,0.65)" }}>
                {ttsStatus === "playing" && subtitleText ? (
                  <>"{subtitleText}"</>
                ) : (
                  <>"{wakeTyped}"</>
                )}
                <motion.span
                  className="inline-block w-[2px] h-[1em] ml-[1px] align-middle rounded-full"
                  style={{ backgroundColor: charConfig.companionColor }}
                  animate={{ opacity: [0.8, 0, 0.8] }}
                  transition={{ duration: 0.75, repeat: Infinity }}
                />
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── TTS SUBTITLE PANEL ── */}
        <AnimatePresence>
          {(ttsStatus === "playing" || ttsStatus === "loading") && wakeText === null && (
            <motion.div
              key="subtitle"
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="w-full max-w-md rounded-2xl px-4 py-3"
              style={{
                background: "rgba(6, 6, 14, 0.78)",
                backdropFilter: "blur(22px)",
                WebkitBackdropFilter: "blur(22px)",
                border: `1px solid hsl(${hsl} / 0.22)`,
                boxShadow: `0 0 30px hsl(${hsl} / 0.10), inset 0 1px 0 rgba(255,255,255,0.04)`,
              }}
            >
              <p className="text-[9px] tracking-[0.28em] mb-1.5 uppercase" style={{ color: `hsl(${hsl} / 0.50)` }}>
                {charConfig.name}正在说
              </p>
              {ttsStatus === "loading" ? (
                <div className="flex gap-[3px] items-center h-[18px]">
                  {[0, 1, 2].map(i => (
                    <motion.div key={i} className="w-[3px] rounded-full"
                      style={{ background: `hsl(${hsl} / 0.45)` }}
                      animate={{ height: ["4px", "12px", "4px"] }}
                      transition={{ duration: 0.6 + i * 0.12, repeat: Infinity, ease: "easeInOut", delay: i * 0.1 }}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-[13px] leading-[1.65]" style={{ color: "rgba(255,255,255,0.65)" }}>
                  {subtitleText || "…"}
                  <motion.span
                    className="inline-block w-[2px] h-[1em] ml-[2px] align-middle rounded-full"
                    style={{ backgroundColor: charConfig.particleColor }}
                    animate={{ opacity: [0.7, 0, 0.7] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── RESPONSE / WELCOME CARD ── */}
        <div className="w-full max-w-md min-h-[80px] flex items-center justify-center mt-1">
          <AnimatePresence mode="wait">
            {isThinking ? (
              <motion.div key="thinking"
                initial={{ opacity: 0 }} animate={{ opacity: [0.12, 0.45, 0.12] }} exit={{ opacity: 0 }}
                transition={{ duration: 1.6, repeat: Infinity }}
                className="text-[11px] tracking-[0.28em]" style={{ color: "rgba(255,255,255,0.20)" }}>
                {thinkingMsg}
              </motion.div>
            ) : (ttsStatus === "playing" || ttsStatus === "loading") ? (
              <motion.div key="tts-active"
                initial={{ opacity: 0 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full"
              />
            ) : displayReply ? (
              <motion.div key={`reply-${displayReply.id}`}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full rounded-2xl px-5 py-5 text-center"
                style={{
                  background: `linear-gradient(140deg, hsl(${hsl} / 0.05) 0%, rgba(255,255,255,0.012) 100%)`,
                  border: `1px solid hsl(${hsl} / 0.10)`,
                  boxShadow: `0 2px 28px hsl(${hsl} / 0.05)`,
                }}>
                {(() => {
                  const isTyping = typingMsgId === displayReply.id;
                  const shown = isTyping ? typingContent : displayReply.content;
                  return (
                    <p className="text-[14px] leading-[1.8] whitespace-pre-wrap" style={{ color: "rgba(255,255,255,0.72)" }}>
                      {shown}
                      {isTyping && (
                        <motion.span
                          className="inline-block w-[2px] h-[1em] ml-[2px] align-middle rounded-full"
                          style={{ backgroundColor: charConfig.particleColor, opacity: 0.7 }}
                          animate={{ opacity: [0.7, 0, 0.7] }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                        />
                      )}
                    </p>
                  );
                })()}
                <p className="mt-3 text-[9px] tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.16)" }}>
                  {displayReply.timestamp}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={`welcome-${activeChar.id}`}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full"
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── HISTORY BOTTOM SHEET ── only when there are messages */}
      {hasMessages && (
        <HistoryBottomSheet
          messages={messages}
          charMap={Object.fromEntries(DREAM_CHARS.map(c => [c.key, { name: c.name, enName: c.enName, particleColor: c.particleColor }]))}
          avatars={avatars}
          onAvatarChange={handleAvatarChange}
          typingMsgId={typingMsgId}
          typingContent={typingContent}
        />
      )}

      {/* ── BOTTOM INPUT ZONE ── */}
      <div className="w-full max-w-md mx-auto px-5 pb-10 pt-3 flex flex-col items-center gap-3 flex-shrink-0"
        style={{ zIndex: 30, position: "relative" }}>

        {/* Pending image preview */}
        <AnimatePresence>
          {pendingImageDataUrl && (
            <motion.div
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="w-full flex justify-start"
            >
              <div className="relative inline-flex">
                <img
                  src={pendingImageDataUrl}
                  alt="预览"
                  className="h-16 w-16 rounded-xl object-cover"
                  style={{ border: `1px solid hsl(${hsl} / 0.22)` }}
                />
                <button
                  onClick={() => setPendingImageDataUrl(null)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(10,10,20,0.85)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.60)" }}
                >
                  <X size={10} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Main Mic Button ── */}
        {(() => {
          const isRecording   = voiceStatus === "recording";
          const isRequesting  = voiceStatus === "requesting";
          const isProcessing  = voiceStatus === "processing";
          const bgOpacity     = isRecording ? 0.82 : isRequesting ? 0.30 : isProcessing ? 0.08 : 0.13;
          const glowStyle     = isRecording
            ? `0 0 0 8px hsl(${hsl} / 0.10), 0 0 36px hsl(${hsl} / 0.30)`
            : isRequesting
            ? `0 0 0 4px hsl(${hsl} / 0.08), 0 0 18px hsl(${hsl} / 0.15)`
            : `0 0 0 1px hsl(${hsl} / 0.18)`;
          return (
            <motion.button
              onClick={toggleMic}
              disabled={isProcessing}
              className="relative flex items-center justify-center rounded-full"
              style={{
                width: 72, height: 72,
                backgroundColor: `hsl(${hsl} / ${bgOpacity})`,
                boxShadow: glowStyle,
                color: isRecording ? "#fff" : `hsl(${hsl} / ${isProcessing ? 0.35 : 1})`,
                cursor: isProcessing ? "default" : "pointer",
              }}
              animate={isRecording ? { scale: [1, 1.05, 1] } : { scale: 1 }}
              transition={isRecording ? { duration: 1.3, repeat: Infinity, ease: "easeInOut" } : {}}
              whileHover={!isProcessing ? { scale: 1.06 } : {}}
              whileTap={!isProcessing ? { scale: 0.93 } : {}}
            >
              {isRecording
                ? <Square size={22} className="fill-current" />
                : isProcessing
                ? <motion.div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `hsl(${hsl})` }}
                    animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 0.9, repeat: Infinity }} />
                : <Mic size={25} />}
              {isRecording && (
                <motion.div className="absolute inset-0 rounded-full pointer-events-none"
                  style={{ border: `1px solid hsl(${hsl} / 0.4)` }}
                  animate={{ scale: [1, 1.55], opacity: [0.5, 0] }}
                  transition={{ duration: 1.3, repeat: Infinity, ease: "easeOut" }}
                />
              )}
            </motion.button>
          );
        })()}

        {/* Text input + image */}
        <div className="w-full flex items-center gap-3">
          <input
            type="text" value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={`对${charConfig.name}说点什么…`}
            className="flex-1 bg-transparent text-sm focus:outline-none pb-1 transition-colors"
            style={{
              color: "rgba(255,255,255,0.50)",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
            }}
          />
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          <input ref={bgMusicInputRef} type="file" accept="audio/mpeg,audio/wav,audio/x-m4a,audio/*" className="hidden" onChange={handleBgMusicFile} />
          <button onClick={() => fileInputRef.current?.click()}
            className="transition-colors flex-shrink-0"
            style={{ color: pendingImageDataUrl ? `hsl(${hsl} / 0.8)` : "rgba(255,255,255,0.18)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.50)")}
            onMouseLeave={e => (e.currentTarget.style.color = pendingImageDataUrl ? `hsl(${hsl} / 0.8)` : "rgba(255,255,255,0.18)")}>
            <ImageIcon size={15} />
          </button>
        </div>

        {/* ── Auxiliary toolbar ── */}
        <div className="flex items-center justify-center gap-4 w-full">
          {/* Atmosphere */}
          <button onClick={() => setAtmosphereOpen(true)}
            className="flex items-center justify-center w-9 h-9 rounded-full transition-all"
            style={{
              color: hasAtmosphere ? `hsl(${hsl} / 0.7)` : "rgba(255,255,255,0.20)",
              background: "rgba(255,255,255,0.04)",
              border: hasAtmosphere ? `1px solid hsl(${hsl} / 0.18)` : "1px solid rgba(255,255,255,0.06)",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(255,255,255,0.07)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              e.currentTarget.style.borderColor = hasAtmosphere ? `hsl(${hsl} / 0.18)` : "rgba(255,255,255,0.06)";
            }}>
            <Sparkles size={15} />
          </button>

          {/* AI Voice */}
          <div className="relative">
            <AnimatePresence>
              {ttsVoiceOpen && (
                <motion.div
                  className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 w-52 rounded-2xl p-3 flex flex-col gap-2.5"
                  style={{
                    background: "rgba(8,8,18,0.93)",
                    backdropFilter: "blur(24px)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    boxShadow: "0 4px 32px rgba(0,0,0,0.55)",
                    zIndex: 50,
                  }}
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.97 }}
                  transition={{ duration: 0.18 }}
                >
                  {/* Toggle row */}
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] tracking-wide" style={{ color: "rgba(255,255,255,0.45)" }}>
                      阿暖语音
                    </span>
                    <button
                      onClick={() => setTtsEnabled(!ttsEnabled)}
                      className="relative w-9 h-5 rounded-full transition-all flex-shrink-0"
                      style={{
                        background: ttsEnabled ? `hsl(${hsl} / 0.55)` : "rgba(255,255,255,0.10)",
                      }}
                    >
                      <motion.span
                        className="absolute top-[3px] w-[14px] h-[14px] rounded-full"
                        style={{ background: ttsEnabled ? "#fff" : "rgba(255,255,255,0.40)" }}
                        animate={{ left: ttsEnabled ? "calc(100% - 17px)" : "3px" }}
                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      />
                    </button>
                  </div>

                  {/* Volume slider */}
                  {ttsEnabled && (
                    <div className="flex items-center gap-2 px-1">
                      <Volume2 size={11} style={{ color: "rgba(255,255,255,0.22)", flexShrink: 0 }} />
                      <input
                        type="range" min={0} max={1} step={0.01}
                        value={ttsVolume}
                        onChange={e => setTtsVolume(Number(e.target.value))}
                        className="flex-1 h-[3px] rounded-full cursor-pointer appearance-none"
                        style={{ accentColor: `hsl(${hsl})` }}
                      />
                      <span className="text-[10px] w-7 text-right tabular-nums" style={{ color: "rgba(255,255,255,0.22)" }}>
                        {Math.round(ttsVolume * 100)}%
                      </span>
                    </div>
                  )}

                  {/* Status hint */}
                  <p className="text-[10px] px-1 leading-relaxed" style={{ color: "rgba(255,255,255,0.18)" }}>
                    {ttsEnabled
                      ? "阿暖回复时会用语音朗读"
                      : "已关闭，只显示文字"}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={() => setTtsVoiceOpen(s => !s)}
              className="flex items-center justify-center w-9 h-9 rounded-full transition-all"
              style={{
                color: ttsVoiceOpen
                  ? `hsl(${hsl} / 0.75)`
                  : ttsStatus === "playing"
                  ? `hsl(${hsl} / 0.65)`
                  : ttsEnabled
                  ? "rgba(255,255,255,0.28)"
                  : "rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                border: ttsVoiceOpen || ttsStatus === "playing" || ttsEnabled
                  ? `1px solid hsl(${hsl} / 0.18)`
                  : "1px solid rgba(255,255,255,0.06)",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                e.currentTarget.style.borderColor = (ttsVoiceOpen || ttsStatus === "playing" || ttsEnabled)
                  ? `hsl(${hsl} / 0.18)`
                  : "rgba(255,255,255,0.06)";
              }}
            >
              {ttsEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
          </div>

          {/* Music */}
          <div className="relative">
            <AnimatePresence>
              {bgMusicOpen && (
                <motion.div
                  className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 w-52 rounded-2xl p-3 flex flex-col gap-2.5"
                  style={{
                    background: "rgba(8,8,18,0.93)",
                    backdropFilter: "blur(24px)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    boxShadow: "0 4px 32px rgba(0,0,0,0.55)",
                    zIndex: 50,
                  }}
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.97 }}
                  transition={{ duration: 0.18 }}
                >
                  {/* Import button */}
                  <button
                    onClick={() => bgMusicInputRef.current?.click()}
                    className="flex items-center gap-2 text-[11px] tracking-wide rounded-xl px-2.5 py-2 w-full transition-all"
                    style={{ background: "rgba(255,255,255,0.045)", color: "rgba(255,255,255,0.55)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.09)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.045)")}
                  >
                    <Music2 size={12} />
                    {bgMusicName ? "更换音乐" : "导入音乐文件"}
                  </button>

                  {bgMusicName && (
                    <>
                      {/* Play/pause + filename */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={toggleBgMusic}
                          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all"
                          style={{
                            background: bgMusicPlaying ? `hsl(${hsl} / 0.22)` : "rgba(255,255,255,0.07)",
                            color: bgMusicPlaying ? `hsl(${hsl})` : "rgba(255,255,255,0.50)",
                          }}
                        >
                          <span className="text-[10px]">{bgMusicPlaying ? "‖" : "▷"}</span>
                        </button>
                        <span className="text-[11px] truncate flex-1" style={{ color: "rgba(255,255,255,0.38)", maxWidth: "120px" }}>
                          {bgMusicName}
                        </span>
                        {bgMusicPlaying && (
                          <div className="flex gap-[2px] items-end h-3 flex-shrink-0">
                            {[0, 1, 2].map(i => (
                              <motion.div key={i} className="w-[2px] rounded-full"
                                style={{ background: `hsl(${hsl} / 0.60)` }}
                                animate={{ height: ["3px", "10px", "3px"] }}
                                transition={{ duration: 0.65 + i * 0.18, repeat: Infinity, ease: "easeInOut", delay: i * 0.11 }}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Volume slider */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.22)" }}>♪</span>
                        <input
                          type="range" min={0} max={1} step={0.01}
                          value={bgMusicVolume}
                          onChange={e => setBgMusicVolume(Number(e.target.value))}
                          className="flex-1 h-[3px] rounded-full cursor-pointer appearance-none"
                          style={{ accentColor: `hsl(${hsl})` }}
                        />
                        <span className="text-[10px] w-7 text-right tabular-nums" style={{ color: "rgba(255,255,255,0.22)" }}>
                          {Math.round(bgMusicVolume * 100)}%
                        </span>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={() => setBgMusicOpen(s => !s)}
              className="flex items-center justify-center w-9 h-9 rounded-full transition-all"
              style={{
                color: bgMusicOpen || bgMusicPlaying ? `hsl(${hsl} / 0.75)` : "rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                border: bgMusicOpen || bgMusicPlaying
                  ? `1px solid hsl(${hsl} / 0.18)`
                  : "1px solid rgba(255,255,255,0.06)",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                e.currentTarget.style.borderColor = (bgMusicOpen || bgMusicPlaying)
                  ? `hsl(${hsl} / 0.18)`
                  : "rgba(255,255,255,0.06)";
              }}
            >
              <Music2 size={15} />
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {ttsStatus !== "idle" && voiceStatus === "idle" ? (
            <motion.p
              key={`tts-${ttsStatus}`}
              initial={{ opacity: 0, y: 4 }} exit={{ opacity: 0, y: -2 }}
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ opacity: { duration: 1.4, repeat: Infinity }, y: { duration: 0.2 } }}
              className="text-[11px] tracking-[0.2em] -mt-2"
              style={{ color: "rgba(255,255,255,0.32)" }}>
              {ttsStatus === "loading"  && "阿暖正在开口…"}
              {ttsStatus === "playing"  && "阿暖正在说话…"}
              {ttsStatus === "blocked"  && (
                <button
                  onClick={handleManualPlay}
                  className="underline underline-offset-2"
                  style={{ color: "rgba(255,255,255,0.55)", fontSize: "11px", letterSpacing: "0.2em" }}
                >
                  点击听阿暖说话
                </button>
              )}
            </motion.p>
          ) : voiceStatus !== "idle" ? (
            <motion.p
              key={voiceStatus}
              initial={{ opacity: 0, y: 4 }} exit={{ opacity: 0, y: -2 }}
              animate={{ opacity: voiceStatus === "recording" ? [0.3, 0.7, 0.3] : 0.45 }}
              transition={{ opacity: { duration: voiceStatus === "recording" ? 1.2 : 0 }, y: { duration: 0.2 } }}
              className="text-[11px] tracking-[0.2em] -mt-2"
              style={{ color: "rgba(255,255,255,0.35)" }}>
              {voiceStatus === "requesting"  && "正在请求麦克风权限…"}
              {voiceStatus === "recording"   && "正在聆听你的梦…"}
              {voiceStatus === "processing"  && "正在整理你的梦…"}
              {voiceStatus === "error"       && "录音出现问题，请重试"}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>

      <AtmospherePanel
        open={atmosphereOpen}
        theme={bgTheme}
        sound={ambientSound}
        music={music}
        onTheme={handleSceneSelect}
        onSound={handleSoundChange}
        onMusic={handleMusicChange}
        onClose={() => setAtmosphereOpen(false)}
      />

      {/* Hidden background music audio element */}
      <audio
        ref={el => { bgAudioRef.current = el; if (el) el.volume = bgMusicVolume; }}
        loop
        preload="none"
        style={{ display: "none" }}
      />

      {/* ── Save confirmation modal ── */}
      <AnimatePresence>
        {showSaveConfirm && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(5,5,10,0.74)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setShowSaveConfirm(false)}
          >
            <motion.div
              className="mx-5 max-w-xs w-full overflow-hidden"
              style={{
                background: "rgba(10,10,22,0.96)",
                border: `1px solid hsl(${hsl} / 0.20)`,
                backdropFilter: "blur(28px)",
                WebkitBackdropFilter: "blur(28px)",
                borderRadius: "28px",
                boxShadow: `0 12px 48px rgba(0,0,0,0.60), 0 0 0 1px hsl(${hsl} / 0.06)`,
              }}
              initial={{ opacity: 0, scale: 0.88, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 10 }}
              transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
              onClick={e => e.stopPropagation()}
            >
              <div
                className="h-[2px]"
                style={{ background: `linear-gradient(to right, transparent, hsl(${hsl} / 0.55), transparent)` }}
              />
              <div className="px-7 py-7 flex flex-col items-center text-center gap-5">
                <motion.div
                  className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{
                    background: `radial-gradient(circle at 38% 35%, hsl(${hsl} / 0.22), hsl(${hsl} / 0.05))`,
                    border: `1px solid hsl(${hsl} / 0.22)`,
                  }}
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Sparkles size={15} style={{ color: `hsl(${hsl})`, opacity: 0.80 }} />
                </motion.div>
                <div>
                  <h3
                    className="text-[15px] font-serif tracking-wide mb-2.5 leading-snug"
                    style={{ color: "rgba(255,255,255,0.88)" }}
                  >
                    要把这段梦收入档案吗？
                  </h3>
                  <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.26)" }}>
                    你可以保存它，也可以让它<br />只停留在这次对话里。
                  </p>
                </div>
                <div className="w-full flex flex-col gap-2.5">
                  <motion.button
                    onClick={confirmSave}
                    className="w-full py-3.5 rounded-[18px] text-[13px] tracking-wide"
                    style={{
                      background: `linear-gradient(135deg, hsl(${hsl} / 0.22) 0%, hsl(${hsl} / 0.08) 100%)`,
                      border: `1px solid hsl(${hsl} / 0.32)`,
                      color: `hsl(${hsl})`,
                    }}
                    whileHover={{ opacity: 0.88 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    收入档案
                  </motion.button>
                  <button
                    onClick={() => setShowSaveConfirm(false)}
                    className="w-full py-2.5 rounded-[18px] text-[12px] tracking-wider"
                    style={{ color: "rgba(255,255,255,0.20)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.20)")}
                  >
                    暂不保存
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
