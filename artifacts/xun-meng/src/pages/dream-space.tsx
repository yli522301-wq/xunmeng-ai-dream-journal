import { useState, useRef, useEffect, useMemo, useCallback, type PointerEvent } from "react";
import {
  useGetAiSettings, useDreamChat, useCreateDream, useAiRecognizeImage,
} from "@workspace/api-client-react";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowLeft, Mic, Square, Image as ImageIcon, Sparkles, Music2, X, BookOpen, Palette, MessageCircle, Headphones, Search, Upload, Play, Pause } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { CompanionOrb, CompanionColor } from "@/components/companion-orb";
import { HistoryBottomSheet } from "@/components/history-panel";
import { AtmospherePanel } from "@/components/atmosphere-panel";
import {
  AmbientBg,
  DEFAULT_AMBIENT_VISUAL_SETTINGS,
  type AmbientVisualSettings,
  type BgTheme,
} from "@/components/ambient-bg";
import { MineradioParticles } from "@/components/mineradio-particles";
import { useAmbientSound, type AmbientSoundType } from "@/hooks/use-ambient-sound";
import { useAmbientMusic, type MusicType } from "@/hooks/use-ambient-music";
import { DreamAntigravityBackground } from "@/components/DreamAntigravityBackground";
import {
  AlbumParticleStage,
  getDefaultAlbumParticleCover,
  type ParticleAudioMetrics,
} from "@/components/album-particle-stage";
import { API_BASE } from "@/lib/api";
import { DaoshenRealtimeClient, type DaoshenRealtimePhase, type RealtimeError } from "@/lib/daoshen-realtime";

// ── Types ──────────────────────────────────────────────────────────────────
export type CharKey = "daoshen" | "muge" | "anuan";
export type ResponseMode = "solo" | "multi" | "cross";
export type VoiceStatus = "idle" | "requesting" | "recording" | "processing" | "error";
type ChatVisualStyle = "orb" | "album-particle";
type ParticleMode = "chat" | "music";
type DaoshenDialect = "standard" | "sichuan" | "shaanxi" | "cantonese";

const FALLBACK_TRANSCRIPT = "我梦到自己一直在赶路，但怎么都赶不上。";
const DAOSHEN_DIALECT_STORAGE_KEY = "xm-daoshen-dialect";
function loadDaoshenDialect(): DaoshenDialect {
  try {
    const raw = localStorage.getItem(DAOSHEN_DIALECT_STORAGE_KEY);
    if (raw === "standard" || raw === "sichuan" || raw === "shaanxi" || raw === "cantonese") return raw;
  } catch { /* ignore */ }
  return "standard";
}

export interface ChatMessage {
  id: string;
  role: "user" | CharKey;
  type?: "text" | "image" | "audio" | "hint";
  content: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  audioUrl?: string;
  audioDuration?: number;
  transcription?: string;
  timestamp: string;
  /** Sources from web_search, only present for song search replies */
  sources?: Array<{ name: string; title: string; url: string }>;
  /** Cleaned display text (no URLs, markdown links, citations) for visual rendering */
  displayContent?: string;
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

export interface MusicSnapshot {
  source: "builtin" | "local" | "ambient";
  title: string;
  artist?: string;
  fileName?: string;
  trackId?: string;
  environmentId?: string;
  mood?: string;
  volume?: number;
  isPlaying?: boolean;
}

interface NeteaseSong {
  id: string;
  name: string;
  artists: string[];
  album: string;
  cover: string;
  duration: number;
  source: "netease";
}

interface LyricLine {
  time: number;
  text: string;
}

function parseLrc(raw: string): LyricLine[] {
  return raw
    .split(/\r?\n/)
    .flatMap(line => {
      const stamps = [...line.matchAll(/\[(\d{1,3}):(\d{2}(?:\.\d{1,3})?)\]/g)];
      const text = line.replace(/\[[^\]]+\]/g, "").trim();
      if (!text || stamps.length === 0) return [];
      return stamps.map(match => ({
        time: Number(match[1]) * 60 + Number(match[2]),
        text,
      }));
    })
    .sort((a, b) => a.time - b.time);
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
    companionColor: "indigo",
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
    companionColor: "purple",
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
const RESUME_STORAGE_KEY = "xm_resume_dream";

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

/**
 * Clean a web search reply for display: remove markdown links, URLs,
 * source citations, and technical markers while preserving natural text.
 */
function cleanSearchReply(text: string): string {
  return text
    // Remove markdown links: [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove bare URLs
    .replace(/https?:\/\/[^\s\)]+/g, "")
    // Remove citation markers like ([site.com]) or ([1])
    .replace(/\s*\(\[[^\]]+\]\)/g, "")
    .replace(/\s*\[\d+\]/g, "")
    // Remove utm_source and other query params that may appear in text
    .replace(/\?utm_source=[^\s]+/g, "")
    .replace(/\?ref=[^\s]+/g, "")
    // Remove horizontal rule separators
    .replace(/\n---\n?/g, "\n")
    // Remove empty bullet points
    .replace(/\n\s*[-\*]\s*$/gm, "")
    // Clean up double spaces and extra newlines
    .replace(/\n{3,}/g, "\n\n")
    .replace(/  +/g, " ")
    .trim();
}

/** Clean text for TTS: only spoken words, no URLs, links, or markers. */
function cleanForTts(text: string): string {
  return cleanSearchReply(text)
    // Remove any remaining bracketed references
    .replace(/\([^)]*\b(?:source|sources|ref|link|url)\b[^)]*\)/gi, "")
    .replace(/\n{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",").pop() ?? "" : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

const TTS_PLAYBACK_PROFILE: Record<CharKey, {
  playbackRate: number;
  preservePitch: boolean;
  hint: string;
}> = {
  anuan: {
    playbackRate: 0.96,
    preservePitch: false,
    hint: "温柔低声 · 陪伴感",
  },
  muge: {
    playbackRate: 0.98,
    preservePitch: true,
    hint: "自然叙述",
  },
  daoshen: {
    playbackRate: 0.96,
    preservePitch: false,
    hint: "低稳解析",
  },
};

function applyTtsPlaybackProfile(audio: HTMLAudioElement, charKey: CharKey) {
  const profile = TTS_PLAYBACK_PROFILE[charKey] ?? TTS_PLAYBACK_PROFILE.anuan;
  audio.playbackRate = profile.playbackRate;

  // Lowering the playback rate only sounds deeper if pitch preservation is disabled.
  // Browser support differs, so set all common spellings.
  (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = profile.preservePitch;
  (audio as HTMLAudioElement & { mozPreservesPitch?: boolean }).mozPreservesPitch = profile.preservePitch;
  (audio as HTMLAudioElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = profile.preservePitch;
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
const CHAR_KEY_STORAGE_KEY = "xm-active-char";
const AMBIENT_VISUAL_STORAGE_KEY = "xm-ambient-visual-settings";

function clampSetting(value: unknown, fallback: number, min = 0.35, max = 2.2): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, n));
}

function loadAmbientVisualSettings(): AmbientVisualSettings {
  try {
    const raw = localStorage.getItem(AMBIENT_VISUAL_STORAGE_KEY);
    if (!raw) return DEFAULT_AMBIENT_VISUAL_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AmbientVisualSettings>;
    return {
      stars: {
        density: clampSetting(parsed.stars?.density, DEFAULT_AMBIENT_VISUAL_SETTINGS.stars.density, 0.35, 1.75),
        brightness: clampSetting(parsed.stars?.brightness, DEFAULT_AMBIENT_VISUAL_SETTINGS.stars.brightness, 0.35, 1.85),
        speed: clampSetting(parsed.stars?.speed, DEFAULT_AMBIENT_VISUAL_SETTINGS.stars.speed, 0.35, 2.2),
      },
      rain: {
        intensity: clampSetting(parsed.rain?.intensity, DEFAULT_AMBIENT_VISUAL_SETTINGS.rain.intensity, 0.35, 1.8),
        brightness: clampSetting(parsed.rain?.brightness, DEFAULT_AMBIENT_VISUAL_SETTINGS.rain.brightness, 0.35, 1.8),
        speed: clampSetting(parsed.rain?.speed, DEFAULT_AMBIENT_VISUAL_SETTINGS.rain.speed, 0.35, 2.2),
      },
    };
  } catch {
    return DEFAULT_AMBIENT_VISUAL_SETTINGS;
  }
}

function saveAmbientVisualSettings(settings: AmbientVisualSettings) {
  try { localStorage.setItem(AMBIENT_VISUAL_STORAGE_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}

function loadCharKey(): CharKey {
  try {
    const raw = localStorage.getItem(CHAR_KEY_STORAGE_KEY);
    if (raw === "daoshen" || raw === "muge" || raw === "anuan") return raw;
  } catch { /* ignore */ }
  return "anuan";
}
function saveCharKey(k: CharKey) {
  try { localStorage.setItem(CHAR_KEY_STORAGE_KEY, k); } catch { /* ignore */ }
}

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

function AlbumParticleCore({
  cover,
  playing,
  hsl,
}: {
  cover: string;
  playing: boolean;
  hsl: string;
}) {
  return (
    <motion.div
      className="absolute left-1/2 top-1/2 pointer-events-none overflow-hidden rounded-full"
      style={{
        width: 190,
        height: 190,
        x: "-50%",
        y: "-50%",
        zIndex: 8,
        mixBlendMode: "screen",
        transformStyle: "preserve-3d",
        maskImage: "radial-gradient(circle, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.70) 44%, rgba(0,0,0,0.22) 68%, transparent 82%)",
        WebkitMaskImage: "radial-gradient(circle, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.70) 44%, rgba(0,0,0,0.22) 68%, transparent 82%)",
      }}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{
        opacity: playing ? [0.26, 0.40, 0.30] : 0.24,
        scale: playing ? [0.985, 1.025, 0.995] : 0.98,
        rotate: playing ? [0, 1.4, -0.8, 0] : 0,
      }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{
        opacity: { duration: 4.6, repeat: playing ? Infinity : 0, ease: "easeInOut" },
        scale: { duration: 4.6, repeat: playing ? Infinity : 0, ease: "easeInOut" },
        rotate: { duration: 18, repeat: playing ? Infinity : 0, ease: "easeInOut" },
      }}
    >
      <img
        src={cover}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          filter: "brightness(0.58) contrast(1.22) saturate(0.78) blur(0.15px)",
          opacity: 0.82,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 50% 45%, transparent 0%, rgba(0,0,0,0.04) 48%, rgba(0,0,0,0.58) 100%),
            radial-gradient(circle at 50% 50%, hsl(${hsl} / 0.10) 0%, transparent 70%)
          `,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(circle, rgba(255,255,255,0.46) 0 1px, transparent 1.35px),
            radial-gradient(circle, hsl(${hsl} / 0.34) 0 0.8px, transparent 1.15px)
          `,
          backgroundSize: "9px 9px, 13px 13px",
          backgroundPosition: "0 0, 4px 5px",
          opacity: 0.40,
          mixBlendMode: "screen",
        }}
      />
      <motion.div
        className="absolute inset-[-16px] rounded-full"
        style={{
          background: `radial-gradient(circle, hsl(${hsl} / 0.28) 0%, transparent 60%)`,
          filter: "blur(16px)",
          mixBlendMode: "screen",
        }}
        animate={{ opacity: playing ? [0.22, 0.42, 0.24] : 0.18 }}
        transition={{ duration: 3.8, repeat: playing ? Infinity : 0, ease: "easeInOut" }}
      />
    </motion.div>
  );
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isSpaceDragBlocked(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("button,a,input,textarea,select,[role='button'],[data-no-space-drag='true']"));
}

// ── Component ───────────────────────────────────────────────────────────────
export default function DreamSpace() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const search = useSearch();

  const [activeKey, setActiveKey]  = useState<CharKey>(loadCharKey);
  const [daoshenDialect] = useState<DaoshenDialect>(loadDaoshenDialect);
  const { data: settings }         = useGetAiSettings();
  const dreamChatMutation    = useDreamChat();
  const createDreamMutation  = useCreateDream();
  const recognizeMutation   = useAiRecognizeImage();

  const [messages,      setMessages]      = useState<ChatMessage[]>(DEMO_MESSAGES);
  const [resumeActive,  setResumeActive]  = useState(false);
  const [inputText,     setInputText]     = useState("");
  const [voiceStatusS,  setVoiceStatusS]  = useState<VoiceStatus>("idle");
  const [isThinking,    setIsThinking]    = useState(false);
  const [thinkingMsg,   setThinkingMsg]   = useState("正在感应…");
  const [avatars,       setAvatars]       = useState<Record<CharKey, string | null>>(loadAvatars);
  const [chatVisualStyle, setChatVisualStyle] = useState<ChatVisualStyle>(() => {
    try { return localStorage.getItem("xm-chat-visual-style") === "album-particle" ? "album-particle" : "orb"; }
    catch { return "orb"; }
  });
  const [visualStyleOpen, setVisualStyleOpen] = useState(false);
  const [particleMode, setParticleMode] = useState<ParticleMode>("chat");
  const [particleCover, setParticleCover] = useState<string | null>(null);
  const particleCoverInputRef = useRef<HTMLInputElement | null>(null);

  const [pendingImageDataUrl, setPendingImageDataUrl] = useState<string | null>(null);
  const [bgMusicOpen,    setBgMusicOpen]    = useState(false);
  const [bgMusicUrl,     setBgMusicUrl]     = useState<string | null>(null);
  const [bgMusicName,    setBgMusicName]    = useState("");
  const [bgMusicCover,   setBgMusicCover]   = useState<string | null>(null);
  const [bgMusicPlaying, setBgMusicPlaying] = useState(false);
  const [bgMusicVolume,  setBgMusicVolume]  = useState(0.3);
  const [neteaseQuery,   setNeteaseQuery]   = useState("");
  const [neteaseSongs,   setNeteaseSongs]   = useState<NeteaseSong[]>([]);
  const [neteaseLoading, setNeteaseLoading] = useState(false);
  const [musicSearchOpen, setMusicSearchOpen] = useState(false);
  const [lyricsVisible, setLyricsVisible] = useState(false);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [musicCurrentTime, setMusicCurrentTime] = useState(0);
  const bgAudioRef          = useRef<HTMLAudioElement | null>(null);
  const [musicContext, setMusicContext] = useState<MusicContext | null>(null);
  const musicContextRef = useRef<MusicContext | null>(null);
  const [saveMusicSnapshot, setSaveMusicSnapshot] = useState(true);
  const [editingDreamId, setEditingDreamId] = useState<string | null>(null);
  const [dreamMode, setDreamMode] = useState<"new" | "continue">("new");
  const resumeSummaryRef = useRef<{ title: string; summary: string } | null>(null);
  const [spaceTilt, setSpaceTilt] = useState({ x: 0, y: 0, dragging: false });
  const spaceDragRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
  });

  // ── ElevenLabs TTS state ──────────────────────────────────────────────────
  const [ttsEnabled] = useState(() => {
    try { return localStorage.getItem("xm-tts-enabled") !== "false"; } catch { return true; }
  });
  const [ttsVolume] = useState(() => {
    try { return Number(localStorage.getItem("xm-tts-volume") ?? "0.7"); } catch { return 0.7; }
  });
  const [ttsStatus, setTtsStatus] = useState<"idle" | "loading" | "playing" | "blocked">("idle");
  const ttsEnabledRef  = useRef(true);
  const ttsVolumeRef   = useRef(0.7);
  const ttsAudioRef    = useRef<HTMLAudioElement | null>(null);
  const daoshenRealtimeRef = useRef<DaoshenRealtimeClient | null>(null);
  const daoshenRealtimeAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsCacheRef    = useRef<Map<string, string>>(new Map());
  const particleAudioMetricsRef = useRef<ParticleAudioMetrics>({ bass: 0, mid: 0, treble: 0, beat: 0, energy: 0 });
  const particleAudioContextRef = useRef<AudioContext | null>(null);
  const particleAudioAnalyserRef = useRef<AnalyserNode | null>(null);
  const particleAudioSourcesRef = useRef(new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>());
  const particleRealtimeSourcesRef = useRef(new WeakMap<MediaStream, {
    source: MediaStreamAudioSourceNode;
    analyser: AnalyserNode;
  }>());
  const particleAudioRafRef = useRef<number | null>(null);
  const particleAudioMeterStateRef = useRef({
    bassPeak: 0.04,
    midPeak: 0.03,
    treblePeak: 0.02,
    energyPeak: 0.035,
    bass: 0,
    mid: 0,
    treble: 0,
    energy: 0,
    beat: 0,
    previousEnergy: 0,
  });
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
  const [ambientVisualSettings, setAmbientVisualSettings] = useState<AmbientVisualSettings>(loadAmbientVisualSettings);

  const { play: playAmbient, stop: stopAmbient } = useAmbientSound();
  const { play: playMusic,   stop: stopMusic }   = useAmbientMusic();

  // ── Resume dream via URL param (?continueDreamId=...) ────────────────────
  // This survives page refresh because the URL is stable.
  useEffect(() => {
    const params = new URLSearchParams(search);
    const continueDreamId = params.get("continueDreamId");

    // Also clean up any legacy xm_resume_dream key left by older code
    localStorage.removeItem(RESUME_STORAGE_KEY);

    if (!continueDreamId) {
      // No continue param — ensure we're in new-dream mode
      // (only reset if we were previously in continue mode to avoid overwriting user state)
      setEditingDreamId(prev => { if (prev) { return null; } return prev; });
      setDreamMode(prev => { if (prev === "continue") { return "new"; } return prev; });
      return;
    }

    try {
      const allDreams: Array<Record<string, unknown>> =
        JSON.parse(localStorage.getItem(DREAMS_STORAGE_KEY) ?? "[]");
      const dream = allDreams.find(d => d.id === continueDreamId);
      if (!dream) {
        toast({ title: "找不到这段梦境记录。" });
        setLocation("/");
        return;
      }

      const key: CharKey = (dream.activeCharacter as CharKey) ?? "anuan";
      saveCharKey(key);
      setActiveKey(key);

      const originalMsgs = (dream.messages as ChatMessage[]) ?? [];
      const hintMsg: ChatMessage = {
        id: `hint-${continueDreamId}`,
        role: "user",
        type: "hint",
        content: "从这里继续",
        timestamp: nowTime(),
      };
      setMessages([...originalMsgs, hintMsg]);
      setEditingDreamId(continueDreamId);
      setDreamMode("continue");
      resumeSummaryRef.current = {
        title: (dream.title as string) ?? "",
        summary: (dream.summary as string) ?? "",
      };
      setResumeActive(true);

      // Restore music snapshot if present
      const snap = dream.musicSnapshot as MusicSnapshot | undefined;
      if (snap) {
        if (snap.source === "ambient" && snap.environmentId) {
          setAmbientSound(snap.environmentId as AmbientSoundType);
        } else if (snap.source === "builtin" && snap.trackId) {
          setMusic(snap.trackId as MusicType);
        }
      }
    } catch {
      /* ignore parse errors */
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

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
  useEffect(() => {
    try { localStorage.setItem("xm-chat-visual-style", chatVisualStyle); } catch { /* ignore */ }
  }, [chatVisualStyle]);
  useEffect(() => { saveAmbientVisualSettings(ambientVisualSettings); }, [ambientVisualSettings]);

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
  const handleAmbientVisualReset = (themeToReset: BgTheme) => {
    if (themeToReset === "stars") {
      setAmbientVisualSettings(prev => ({
        ...prev,
        stars: { ...DEFAULT_AMBIENT_VISUAL_SETTINGS.stars },
      }));
    }
    if (themeToReset === "rain") {
      setAmbientVisualSettings(prev => ({
        ...prev,
        rain: { ...DEFAULT_AMBIENT_VISUAL_SETTINGS.rain },
      }));
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const charConfig    = CHAR_MAP[activeKey] ?? DREAM_CHARS[2];
  const hasAtmosphere = bgTheme !== "void" || ambientSound !== "none" || music !== "none";

  const displayReply = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === activeKey) return messages[i];
    }
    return null;
  }, [messages, activeKey]);

  const isSpeaking = (!!displayReply && !isThinking) || !!typingMsgId;
  const orbIsSpeaking = ttsStatus === "playing";
  const hsl        = charConfig.hsl;
  const immersiveMusic = chatVisualStyle === "album-particle" && particleMode === "music";
  const activeLyricIndex = useMemo(() => {
    if (lyrics.length === 0) return -1;
    for (let index = lyrics.length - 1; index >= 0; index -= 1) {
      if (musicCurrentTime >= lyrics[index].time) return index;
    }
    return 0;
  }, [lyrics, musicCurrentTime]);

  // ── Tab switch ───────────────────────────────────────────────────────────
  const handleTabClick = (key: CharKey) => {
    if (activeKey === key) return;
    if (activeKey === "daoshen") {
      daoshenRealtimeRef.current?.stop();
      daoshenRealtimeRef.current = null;
      daoshenRealtimeAudioRef.current = null;
      setVoiceStatus("idle");
      setTtsStatus("idle");
    }
    setActiveKey(key);
    saveCharKey(key);
    // Intentionally do NOT clear messages — shared thread
  };

  // ── Keep TTS refs in sync with state ─────────────────────────────────────
  useEffect(() => { ttsEnabledRef.current = ttsEnabled; }, [ttsEnabled]);
  useEffect(() => {
    ttsVolumeRef.current = ttsVolume;
    if (ttsAudioRef.current) ttsAudioRef.current.volume = ttsVolume;
    daoshenRealtimeRef.current?.setVolume(ttsVolume);
  }, [ttsVolume]);

  const startParticleAudioMeter = (analyser: AnalyserNode, replaceCurrent = false) => {
    if (replaceCurrent && particleAudioRafRef.current !== null) {
      cancelAnimationFrame(particleAudioRafRef.current);
      particleAudioRafRef.current = null;
      particleAudioMeterStateRef.current = {
        bassPeak: 0.04, midPeak: 0.03, treblePeak: 0.02, energyPeak: 0.035,
        bass: 0, mid: 0, treble: 0, energy: 0, beat: 0, previousEnergy: 0,
      };
    }
    if (particleAudioRafRef.current !== null) return;
    const frequency = new Uint8Array(analyser.frequencyBinCount);
    const waveform = new Uint8Array(analyser.fftSize);
    const average = (from: number, to: number) => {
      const end = Math.max(from + 1, Math.min(frequency.length, to));
      let sum = 0;
      for (let i = from; i < end; i += 1) sum += frequency[i] / 255;
      return sum / (end - from);
    };
    const follow = (current: number, target: number, attack: number, release: number) =>
      current + (target - current) * (target > current ? attack : release);

    const tick = () => {
      analyser.getByteFrequencyData(frequency);
      analyser.getByteTimeDomainData(waveform);
      const state = particleAudioMeterStateRef.current;
      const bassEnd = Math.max(8, Math.floor(frequency.length * 0.055));
      const midEnd = Math.max(bassEnd + 1, Math.floor(frequency.length * 0.34));
      const trebleEnd = Math.max(midEnd + 1, Math.floor(frequency.length * 0.72));
      const rawBass = average(1, bassEnd);
      const rawMid = average(bassEnd, midEnd);
      const rawTreble = average(midEnd, trebleEnd);
      let rms = 0;
      for (let i = 0; i < waveform.length; i += 1) {
        const sample = (waveform[i] - 128) / 128;
        rms += sample * sample;
      }
      rms = Math.sqrt(rms / waveform.length);

      state.bassPeak = Math.max(0.04, state.bassPeak * 0.995, rawBass);
      state.midPeak = Math.max(0.03, state.midPeak * 0.994, rawMid);
      state.treblePeak = Math.max(0.02, state.treblePeak * 0.993, rawTreble);
      state.energyPeak = Math.max(0.035, state.energyPeak * 0.995, rms);
      const bassTarget = Math.min(0.90, rawBass / Math.max(0.045, state.bassPeak * 0.76));
      const midTarget = Math.min(0.78, rawMid / Math.max(0.032, state.midPeak * 0.78));
      const trebleTarget = Math.min(0.62, rawTreble / Math.max(0.024, state.treblePeak * 0.80));
      const energyTarget = Math.min(0.84, rms / Math.max(0.038, state.energyPeak * 0.74));
      const onset = Math.max(0, energyTarget - state.previousEnergy);
      state.previousEnergy = state.previousEnergy * 0.82 + energyTarget * 0.18;
      state.beat = Math.max(state.beat * 0.82, onset > 0.055 ? Math.min(0.62, onset * 2.8) : 0);
      state.bass = follow(state.bass, bassTarget, 0.30, 0.08);
      state.mid = follow(state.mid, midTarget, 0.22, 0.07);
      state.treble = follow(state.treble, trebleTarget, 0.20, 0.06);
      state.energy = follow(state.energy, energyTarget, 0.24, 0.07);
      particleAudioMetricsRef.current = {
        bass: state.bass,
        mid: state.mid,
        treble: state.treble,
        beat: state.beat,
        energy: state.energy,
      };
      particleAudioRafRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const connectAudioToAlbumParticles = async (audio: HTMLMediaElement) => {
    const AudioContextCtor = window.AudioContext
      || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const context = particleAudioContextRef.current ?? new AudioContextCtor();
    particleAudioContextRef.current = context;
    if (context.state === "suspended") await context.resume();
    let analyser = particleAudioAnalyserRef.current;
    if (!analyser) {
      analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.72;
      analyser.connect(context.destination);
      particleAudioAnalyserRef.current = analyser;
    }
    let source = particleAudioSourcesRef.current.get(audio);
    if (!source) {
      source = context.createMediaElementSource(audio);
      source.connect(analyser);
      particleAudioSourcesRef.current.set(audio, source);
    }
    startParticleAudioMeter(analyser);
  };

  const connectRealtimeAudioToAlbumParticles = async (audio: HTMLAudioElement) => {
    const stream = audio.srcObject;
    if (!(stream instanceof MediaStream)) {
      await connectAudioToAlbumParticles(audio);
      return;
    }
    const AudioContextCtor = window.AudioContext
      || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const context = particleAudioContextRef.current ?? new AudioContextCtor();
    particleAudioContextRef.current = context;
    if (context.state === "suspended") await context.resume();

    let entry = particleRealtimeSourcesRef.current.get(stream);
    if (!entry) {
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.64;
      // Analyse the WebRTC MediaStream directly. The <audio> element remains
      // responsible for playback, so this analysis branch must not feed the
      // destination and create doubled/echoed speech.
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      entry = { source, analyser };
      particleRealtimeSourcesRef.current.set(stream, entry);
    }
    startParticleAudioMeter(entry.analyser, true);
  };

  const playWithParticleAudio = async (audio: HTMLMediaElement) => {
    try {
      await connectAudioToAlbumParticles(audio);
    } catch (error) {
      console.warn("[particle-audio] analyser unavailable, continuing playback", error);
    }
    return audio.play();
  };

  useEffect(() => () => {
    if (particleAudioRafRef.current !== null) cancelAnimationFrame(particleAudioRafRef.current);
    particleAudioRafRef.current = null;
    particleAudioMetricsRef.current = { bass: 0, mid: 0, treble: 0, beat: 0, energy: 0 };
    void particleAudioContextRef.current?.close();
    particleAudioContextRef.current = null;
  }, []);

  const appendRealtimeMessage = (role: "user" | "daoshen", text: string) => {
    const content = text.trim();
    if (!content) return;
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (last?.role === role && last.content === content) return prev;
      return [...prev, {
        id: genId(),
        role,
        type: role === "user" ? "audio" : "text",
        content,
        transcription: role === "user" ? content : undefined,
        timestamp: nowTime(),
      }];
    });
  };

  const applyDaoshenRealtimePhase = (phase: DaoshenRealtimePhase) => {
    if (phase === "connecting") {
      setVoiceStatus("requesting");
      setTtsStatus("idle");
      return;
    }
    if (phase === "thinking") {
      setVoiceStatus("processing");
      setTtsStatus("idle");
      return;
    }
    if (phase === "speaking") {
      // The mic remains live while 岛深 speaks, allowing server VAD to interrupt him.
      setVoiceStatus("recording");
      setTtsStatus("playing");
      return;
    }
    if (phase === "listening") {
      setVoiceStatus("recording");
      setTtsStatus("idle");
      return;
    }
    setVoiceStatus("idle");
    setTtsStatus("idle");
  };

  const stopDaoshenRealtime = () => {
    daoshenRealtimeRef.current?.stop();
    daoshenRealtimeRef.current = null;
    daoshenRealtimeAudioRef.current = null;
    stopSubtitleSync();
    subtitleFullRef.current = "";
    setSubtitleText("");
    if (particleMode === "chat") {
      particleAudioMetricsRef.current = { bass: 0, mid: 0, treble: 0, beat: 0, energy: 0 };
    }
    setVoiceStatus("idle");
    setTtsStatus("idle");
  };

  const toggleDaoshenRealtime = async () => {
    if (daoshenRealtimeRef.current) {
      stopDaoshenRealtime();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
      toast({ title: "当前浏览器不支持实时语音，请使用最新版 Chrome 或 Safari。" });
      return;
    }

    window.speechSynthesis.cancel();
    ttsAudioRef.current?.pause();
    ttsAudioRef.current = null;
    stopSubtitleSync();
    subtitleFullRef.current = "";
    setSubtitleText("");

    const client = new DaoshenRealtimeClient({
      onPhase: applyDaoshenRealtimePhase,
      onRemoteAudio: audio => {
        daoshenRealtimeAudioRef.current = audio;
        audio.volume = ttsVolumeRef.current;
        void connectRealtimeAudioToAlbumParticles(audio).catch(error => {
          console.warn("[daoshen-realtime] particle analyser unavailable", error);
        });
      },
      onUserTranscript: text => appendRealtimeMessage("user", text),
      onAssistantTranscriptStart: () => {
        // Realtime captions are driven by OpenAI transcript deltas. Disable the
        // older duration-based TTS timer so it cannot overwrite the current line.
        stopSubtitleSync();
        subtitleFullRef.current = "";
        setSubtitleText("");
      },
      onAssistantTranscriptDelta: text => setSubtitleText(text),
      onAssistantTranscript: text => {
        appendRealtimeMessage("daoshen", text);
        setSubtitleText(text);
      },
      onAssistantTranscriptEnd: () => setSubtitleText(""),
      onError: error => {
        console.error("[daoshen-realtime]", error.code, error.message);
        // Show a specific Chinese error message mapped from the error code.
        const messages: Record<string, string> = {
          mic_denied: "麦克风权限被拒绝，请在浏览器设置中允许麦克风访问。",
          ice_timeout: "网络连接超时，请检查代理或网络后重试。",
          handshake_failed: error.message || "Realtime 会话建立失败，请重试。",
          proxy_unavailable: "当前代理不可用，请检查代理设置后重试。",
          missing_realtime_access: "API Key 缺少 Realtime 权限，请检查 Key 配置。",
          connection_lost: "Realtime 连接已断开，请重试。",
          channel_error: "Realtime 数据通道错误，请重试。",
          api_error: error.message || "岛深的实时语音暂时没有接通，请重试。",
        };
        toast({ title: messages[error.code] ?? error.message });
        stopDaoshenRealtime();
      },
    });
    daoshenRealtimeRef.current = client;
    client.setVolume(ttsVolumeRef.current);
    try {
      await client.start();
    } catch {
      if (daoshenRealtimeRef.current === client) stopDaoshenRealtime();
    }
  };

  useEffect(() => () => {
    daoshenRealtimeRef.current?.stop();
    daoshenRealtimeRef.current = null;
  }, []);

  // ── TTS ──────────────────────────────────────────────────────────────────
  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = activeKey === "daoshen" ? "zh-CN" : "en-US";
    u.rate = 0.88;
    window.speechSynthesis.speak(u);
  };

  // ── TTS playback (VoxCPM dialects for 岛深, ElevenLabs for 暮歌/阿暖) ─────
  const playTtsSafe = async (
    msgId: string,
    text: string,
    charKey: CharKey,
    onPlayStart?: (audioDuration: number) => void,
  ) => {
    // Daoshen uses OpenAI Realtime — never call the TTS endpoint.
    // (VoxCPM dialect is handled through the same endpoint but with a dialect
    // param; standard Daoshen without dialect must not hit ElevenLabs.)
    if (charKey === "daoshen" && daoshenDialect === "standard") {
      onPlayStart?.(5);
      return;
    }

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
        const resp = await fetch(`${API_BASE}/api/ai/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: text.slice(0, 500),
            character: charKey,
            dialect: charKey === "daoshen" ? daoshenDialect : "standard",
          }),
        });
        console.log(
          "[TTS] response status:",
          resp.status,
          resp.headers.get("content-type"),
          "provider:",
          resp.headers.get("x-tts-provider"),
        );
        if (!resp.ok) {
          const errBody = await resp.json().catch(() => ({})) as { code?: string; error?: string };
          const code = errBody.code ?? "unknown";
          console.error("[TTS] fetch failed:", resp.status, code, errBody.error);

          // Map structured error codes to Chinese user-facing messages.
          const errorMessages: Record<string, string> = {
            missing_api_key: "语音服务未配置，请检查 ElevenLabs Key。",
            invalid_api_key: "语音服务 Key 无效或已过期，请更新 Key。",
            voice_not_found: "未找到可用语音，请检查 ElevenLabs 账户。",
            quota_exceeded: "语音服务额度已用完，请稍后再试。",
            permission_denied: "语音服务权限不足，请检查 Key 权限。",
            elevenlabs_timeout: "语音生成超时，请重试。",
            elevenlabs_unavailable: "语音服务暂时不可用，已先显示文字。",
            daoshen_uses_realtime: "岛深使用实时语音，无需调用 TTS。",
            unsupported_character: "当前人格不支持 TTS 语音。",
          };
          toast({ title: errorMessages[code] ?? "语音暂时没有接通，已先显示文字。" });
          setTtsStatus("idle");
          onPlayStart?.(5);
          return;
        }
        const blob = await resp.blob();
        console.log("[TTS] blob size:", blob.size);
        if (blob.size === 0) {
          console.error("[TTS] blob is empty");
          toast({ title: "语音生成失败，请重试。" });
          setTtsStatus("idle");
          onPlayStart?.(5);
          return;
        }
        audioUrl = URL.createObjectURL(blob);
        console.log("[TTS] audioUrl created:", !!audioUrl);
        ttsCacheRef.current.set(msgId, audioUrl);
      } catch (err) {
        console.error("[TTS] fetch error:", err);
        toast({ title: "语音服务暂时不可用，已先显示文字。" });
        setTtsStatus("idle");
        onPlayStart?.(5);
        return;
      }
    }

    const originalBgVol = bgAudioRef.current?.volume ?? bgMusicVolume;
    const audio = new Audio(audioUrl);
    applyTtsPlaybackProfile(audio, charKey);
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
      // Clean up blob URL on error too — avoid memory leak.
      ttsCacheRef.current.delete(msgId);
      URL.revokeObjectURL(audioUrl!);
      onPlayStart?.(5);
      stopSubtitleSync();
      restoreBg();
      toast({ title: "音频播放失败，请重试。" });
    };
    audio.onpause = () => {
      stopSubtitleSync();
    };
    audio.onplay = () => {
      startSubtitleSync(audio, text);
    };

    setTtsStatus("playing");
    try {
      await playWithParticleAudio(audio);
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
    playWithParticleAudio(ttsAudioRef.current).then(() => {
      setTtsStatus("playing");
      console.log("[TTS] manual play() success");
    }).catch(err => {
      console.error("[TTS] manual play() failed:", err);
      setTtsStatus("idle");
    });
  };

  // ── Character system prompt from static config ────────────────────────────
  const getSystemPrompt = useCallback((key: CharKey): string => {
    return CHAR_MAP[key]?.stylePrompt ?? CHAR_MAP.anuan.stylePrompt;
  }, []);

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = async (text?: string, voiceData?: { duration?: number }) => {
    const msg = (text ?? inputText).trim();
    const imgUrl = text ? null : pendingImageDataUrl;
    if (!msg && !imgUrl && !voiceData) return;
    // Front-end length guard
    if (msg.length > 1000) {
      toast({ title: "这段话有点长，可以分成几次慢慢告诉我。" });
      return;
    }
    // Block concurrent sends
    if (isThinking) return;
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
      let apiSources: Array<{ name: string; title: string; url: string }> | undefined;

      if (!settings?.hasApiKey) {
        // No API key — use local character-specific mock
        await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
        replyContent = stripCharPrefix(getMockReply(activeKey, msg, updatedMsgs));
        usedMock = true;
      } else {
        try {
          // Build history: exclude hint messages; last ≤24 messages (≈12 turns) for AI context
          const aiMsgs = updatedMsgs.filter(m => m.type !== "hint");
          const historyItems = aiMsgs.slice(-25, -1).map(m => ({
            role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
            content: m.role === "user"
              ? m.content
              : `[${CHAR_MAP[m.role as CharKey]?.name ?? m.role}] ${m.content}`,
            imageUrl: m.imageUrl ?? null,
          }));
          // In continue mode, always prepend dream summary for consistent AI context
          if (resumeSummaryRef.current) {
            const info = resumeSummaryRef.current;
            historyItems.unshift({
              role: "assistant",
              content: `[续写上下文] 这是梦境《${info.title}》的延续。梦境摘要：${info.summary}`,
              imageUrl: null,
            });
          }

          const musicCtx = musicContextRef.current;
          // Detect song search intent: asking about artist, release info, story behind the song
          const isSongSearch = (() => {
            const q = msg.toLowerCase();
            const keywords = [
              "是谁写的", "是谁唱的", "歌手", "艺人", "作者", "创作者",
              "什么时候出的", "发行", "专辑", "时间", "日期",
              "创作背景", "故事", "代表什么", "意义", "含义", "稀深吮",
              "who wrote", "who sang", "who composed", "artist", "singer",
              "released", "album", "when", "date", "background", "story", "meaning",
              "原版", "翻唱", "cover", "版本", "经典", "老歌",
            ];
            return keywords.some(k => q.includes(k));
          })();
          const res = await dreamChatMutation.mutateAsync({
            data: {
              activeCharacter: activeKey,
              history: historyItems,
              userInput: msg || "[图片]",
              imageUrl: imgUrl ?? null,
              musicContext: musicCtx,
              dialect: activeKey === "daoshen" ? daoshenDialect : "standard",
              songSearch: isSongSearch,
            },
          });
          replyContent = stripCharPrefix(res.reply);
          apiSources = (res as any)?.sources ?? undefined;
          if (res.isMock) usedMock = true;
        } catch (err) {
          // Check for structured limit errors from backend
          const apiErr = err as { status?: number; data?: { code?: string; error?: string } };
          const code = apiErr?.data?.code;
          const msgText = apiErr?.data?.error;
          if (code && msgText) {
            toast({ title: msgText });
            // For rate/daily/timeout limits, don't fall back to mock
            setIsThinking(false);
            return;
          }
          // Generic API failure — fall back to local mock
          await new Promise(r => setTimeout(r, 400 + Math.random() * 300));
          replyContent = stripCharPrefix(getMockReply(activeKey, msg, updatedMsgs));
          usedMock = true;
        }
      }

      // Only show the mock toast when the user expected a real reply
      if (usedMock && settings?.hasApiKey) {
        toast({ title: "AI 暂时没有接通，已切换为演示回复。" });
      }

      const reply: ChatMessage = {
        id: genId(), role: activeKey, content: replyContent, timestamp: nowTime(),
        sources: apiSources,
        displayContent: cleanSearchReply(replyContent),
      };
      setMessages(prev => [...prev, reply]);

      // Prepare empty display area; full text goes to chat history only.
      // Upper display area will be driven by TTS subtitle or typing fallback.
      setTypingMsgId(reply.id);
      setTypingContent("");
      typingStartedRef.current = null;

      // Defer typewriter until TTS starts playing so text and voice are in sync.
      // Speed calibrated to audio duration. 3-second hard fallback in case TTS hangs.
      const displayContent = cleanSearchReply(replyContent);
      const ttsContent = cleanForTts(replyContent);
      const fallbackTimer = setTimeout(() => {
        if (typingStartedRef.current !== reply.id) {
          startTypewriter(reply.id, displayContent);
        }
      }, 3000);

      void playTtsSafe(reply.id, ttsContent, activeKey, (audioDuration: number) => {
        clearTimeout(fallbackTimer);
        const msPerChar = Math.max(30, Math.min(110, (audioDuration * 1000) / displayContent.length));
        startTypewriter(reply.id, displayContent, msPerChar);
      });
    } catch {
      toast({ title: "感应失败，请重试", variant: "destructive" });
    } finally {
      setIsThinking(false);
    }
  };

  // ── Mic state machine ────────────────────────────────────────────────────
  const toggleMic = () => {
    // 岛深 alone uses the persistent, interruptible OpenAI Realtime session.
    // 暮歌 and 阿暖 continue through the existing record → transcribe → TTS flow.
    if (activeKey === "daoshen") {
      void toggleDaoshenRealtime();
      return;
    }

    // Block while busy
    if (voiceStatus === "requesting" || voiceStatus === "processing") return;

    // Stop recording
    if (voiceStatus === "recording") {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
      } else {
        try { recognitionRef.current?.stop(); } catch { /* ignore */ }
      }
      setVoiceStatus("processing");
      return;
    }

    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast({ title: "当前浏览器不支持录音，请直接输入梦境。" });
      return;
    }

    setVoiceStatus("requesting");
    audioChunksRef.current = [];
    audioRecordStartRef.current = Date.now();

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus") ? "audio/ogg;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/ogg") ? "audio/ogg"
          : "";
        const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

        mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        mr.onerror = () => {
          stream.getTracks().forEach(t => t.stop());
          mediaRecorderRef.current = null;
          setVoiceStatus("idle");
          toast({ title: "录音出现问题，请重试。" });
        };
        mr.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          const duration = Math.max(1, Math.round((Date.now() - audioRecordStartRef.current) / 1000));
          const audioBlob = new Blob(audioChunksRef.current, { type: mr.mimeType || mimeType || "audio/webm" });
          audioChunksRef.current = [];
          mediaRecorderRef.current = null;
          setVoiceStatus("processing");

          try {
            const audioBase64 = await blobToBase64(audioBlob);
            const resp = await fetch(`${API_BASE}/api/ai/transcribe`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audioBase64, mimeType: audioBlob.type || "audio/webm" }),
            });
            if (!resp.ok) throw new Error(await resp.text());
            const data = await resp.json() as { text?: string };
            const transcript = data.text?.trim();
            setVoiceStatus("idle");
            if (!transcript) {
              toast({ title: "没有识别到语音，可以再说一次。" });
              return;
            }
            console.log("[STT] OpenAI transcript =", transcript);
            handleSendRef.current(transcript, { duration });
          } catch (err) {
            console.error("[STT] transcription failed:", err);
            setVoiceStatus("idle");
            toast({ title: "语音识别失败，请再试一次或直接输入。" });
          }
        };

        mediaRecorderRef.current = mr;
        mr.start();
        setVoiceStatus("recording");
      })
      .catch(err => {
        console.error("[Mic] getUserMedia failed:", err);
        mediaRecorderRef.current = null;
      setVoiceStatus("idle");
        toast({ title: "没有获得麦克风权限，请在系统设置或浏览器权限中允许麦克风。" });
      });
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

  const handleParticleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file?.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = event => {
      const result = String(event.target?.result || "");
      if (result) setParticleCover(result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleBgMusicFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (bgMusicUrl) URL.revokeObjectURL(bgMusicUrl);
    const url = URL.createObjectURL(file);
    setBgMusicUrl(url);
    setBgMusicCover(null);
    setLyrics([]);
    setLyricsVisible(false);
    setMusicCurrentTime(0);
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
      playWithParticleAudio(bgAudioRef.current)
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

  const searchNeteaseMusic = async () => {
    const q = neteaseQuery.trim();
    if (!q) return;
    setNeteaseLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/music/netease/search?keywords=${encodeURIComponent(q)}&limit=5`);
      const data = await resp.json() as { songs?: NeteaseSong[]; error?: string };
      if (!resp.ok) throw new Error(data.error || "搜索失败");
      setNeteaseSongs(data.songs ?? []);
      if (!data.songs?.length) toast({ title: "没有搜到合适的网易云结果。" });
    } catch (err) {
      console.error("[netease] search failed:", err);
      toast({ title: "网易云搜索暂时失败，请稍后再试。" });
    } finally {
      setNeteaseLoading(false);
    }
  };

  const playNeteaseSong = async (song: NeteaseSong) => {
    try {
      const [resp, lyricResp] = await Promise.all([
        fetch(`${API_BASE}/api/music/netease/song-url?id=${encodeURIComponent(song.id)}`),
        fetch(`${API_BASE}/api/music/netease/lyric?id=${encodeURIComponent(song.id)}`).catch(() => null),
      ]);
      const data = await resp.json() as { proxiedUrl?: string; message?: string; error?: string };
      if (!resp.ok || !data.proxiedUrl) {
        toast({ title: data.message || "这首歌暂时无法播放，可能受版权或会员限制。" });
        return;
      }

      if (bgMusicUrl?.startsWith("blob:")) URL.revokeObjectURL(bgMusicUrl);
      const title = song.name;
      const artist = song.artists.join(" / ");
      setBgMusicUrl(data.proxiedUrl);
      setBgMusicName(artist ? `${title} · ${artist}` : title);
      setBgMusicCover(song.cover ? `${API_BASE}/api/music/netease/cover?url=${encodeURIComponent(song.cover)}` : null);
      if (lyricResp?.ok) {
        const lyricData = await lyricResp.json() as { lyric?: string };
        const nextLyrics = parseLrc(lyricData.lyric ?? "");
        setLyrics(nextLyrics);
        setLyricsVisible(nextLyrics.length > 0);
      } else {
        setLyrics([]);
        setLyricsVisible(false);
      }
      setMusicCurrentTime(0);

      const ctx: MusicContext = {
        source: "local",
        title,
        artist,
        fileName: `netease:${song.id}`,
        type: "netease",
        mood: "",
        isPlaying: false,
      };
      setMusicContext(ctx);
      musicContextRef.current = ctx;

      if (bgAudioRef.current) {
        bgAudioRef.current.src = data.proxiedUrl;
        bgAudioRef.current.volume = bgMusicVolume;
        await playWithParticleAudio(bgAudioRef.current);
        setBgMusicPlaying(true);
        const updated = { ...ctx, isPlaying: true };
        setMusicContext(updated);
        musicContextRef.current = updated;
      }
    } catch (err) {
      console.error("[netease] play failed:", err);
      toast({ title: "这首网易云音乐暂时无法播放。" });
    }
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
      playWithParticleAudio(bgAudioRef.current)
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

  const switchParticleMode = (mode: ParticleMode) => {
    if (mode === particleMode) return;
    if (mode === "music") {
      ttsAudioRef.current?.pause();
      ttsAudioRef.current = null;
      setTtsStatus("idle");
      setBgMusicOpen(true);
    } else {
      setMusicSearchOpen(false);
      bgAudioRef.current?.pause();
      setBgMusicPlaying(false);
      setBgMusicOpen(false);
      if (musicContextRef.current) {
        const updated = { ...musicContextRef.current, isPlaying: false };
        setMusicContext(updated);
        musicContextRef.current = updated;
      }
    }
    setParticleMode(mode);
  };

  // ── Save dream ─────────────────────────────────────────────────────────────
  const handleSaveDream = () => {
    const userMessages = messages.filter(m => m.role === "user" && m.type !== "hint");
    if (userMessages.length === 0) {
      toast({ title: "先说一点梦的内容，再保存。" });
      return;
    }
    setShowSaveConfirm(true);
  };

  const confirmSave = () => {
    setShowSaveConfirm(false);

    // Exclude internal hint messages from everything stored or computed
    const storableMsgs = messages.filter(m => m.type !== "hint");
    const userMessages = storableMsgs.filter(m => m.role === "user");
    if (userMessages.length === 0) return;

    const firstUser = userMessages[0].content;
    const title = firstUser === "[图片]" || firstUser === ""
      ? "一段无言的梦"
      : firstUser.slice(0, 14) + (firstUser.length > 14 ? "…" : "");
    const lastAiMsg = [...storableMsgs].reverse().find(m => m.role !== "user");
    const summary = lastAiMsg?.content ?? firstUser;

    // coverImage: 600 px cardCover from first user image
    const coverImage = storableMsgs.find(m => m.role === "user" && m.imageUrl)?.imageUrl;

    // Strip audio blobs; swap imageUrl → thumbnailUrl (240 px) in messages
    const messagesForStorage = storableMsgs.map(m => {
      const { audioUrl: _a, thumbnailUrl: thumb, ...rest } =
        m as ChatMessage & { audioUrl?: string; thumbnailUrl?: string };
      if (rest.type === "image" && thumb) {
        return { ...rest, imageUrl: thumb };
      }
      return rest;
    });

    // ── Build music snapshot ───────────────────────────────────────────────
    const musicSnap: MusicSnapshot | null = (() => {
      if (!saveMusicSnapshot) return null;
      if (musicContext) {
        return {
          source: musicContext.source,
          title: musicContext.title,
          artist: musicContext.artist || undefined,
          fileName: musicContext.fileName || undefined,
          trackId: musicContext.source === "builtin" ? music : undefined,
          mood: musicContext.mood || undefined,
          volume: bgMusicVolume,
          isPlaying: musicContext.isPlaying,
        };
      }
      if (ambientSound !== "none") {
        const labels: Record<AmbientSoundType, string> = {
          none: "", rain: "雨声", night: "虫鸣夜声", ocean: "海浪",
        };
        return {
          source: "ambient",
          title: labels[ambientSound],
          environmentId: ambientSound,
          volume: bgMusicVolume,
          isPlaying: true,
        };
      }
      return null;
    })();

    let existing: unknown[] = [];
    try { existing = JSON.parse(localStorage.getItem(DREAMS_STORAGE_KEY) ?? "[]"); } catch { /* ignore */ }

    if (dreamMode === "continue" && editingDreamId) {
      // ── Update the existing dream in-place ────────────────────────────────
      const updatedAt = new Date().toISOString();
      const updatedList = (existing as Array<Record<string, unknown>>).map(d =>
        (d as { id?: string }).id === editingDreamId
          ? {
              ...d,
              messages: messagesForStorage,
              summary,
              updatedAt,
              ...(musicSnap ? { musicSnapshot: musicSnap } : {}),
            }
          : d
      );
      const doNavigate = () => {
        setEditingDreamId(null);
        setDreamMode("new");
        resumeSummaryRef.current = null;
        setLocation("/archive");
      };
      // Tier 1
      try {
        localStorage.setItem(DREAMS_STORAGE_KEY, JSON.stringify(updatedList));
        doNavigate();
        return;
      } catch { /* quota exceeded */ }
      // Tier 2: strip images from the updated entry
      try {
        const lite = (updatedList as Array<Record<string, unknown>>).map(d =>
          (d as { id?: string }).id === editingDreamId
            ? {
                ...d,
                coverImage: undefined,
                messages: messagesForStorage.map(m =>
                  m.type === "image" ? { ...m, imageUrl: undefined } : m
                ),
              }
            : d
        );
        localStorage.setItem(DREAMS_STORAGE_KEY, JSON.stringify(lite));
        toast({ title: "图片较大，已为你保存压缩版梦境。" });
        doNavigate();
        return;
      } catch {
        toast({ title: "保存失败，请清除部分旧梦境后重试。", variant: "destructive" });
      }
      return;
    }

    // ── New dream ──────────────────────────────────────────────────────────
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
      musicSnapshot: musicSnap ?? undefined,
    };

    // Tier 1: thumbnails in messages + 600 px coverImage
    try {
      localStorage.setItem(DREAMS_STORAGE_KEY, JSON.stringify([...existing, dream]));
      setLocation("/archive");
      return;
    } catch { /* quota exceeded — fall through */ }

    // Tier 2: drop coverImage
    try {
      localStorage.setItem(DREAMS_STORAGE_KEY,
        JSON.stringify([...existing, { ...dream, coverImage: undefined }]));
      toast({ title: "图片较大，已为你保存压缩版梦境。" });
      setLocation("/archive");
      return;
    } catch { /* still failing — fall through */ }

    // Tier 3: strip all images
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

  const hasMessages = messages.length > 0;

  const handleSpacePointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || isSpaceDragBlocked(e.target)) return;

    spaceDragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      baseX: spaceTilt.x,
      baseY: spaceTilt.y,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setSpaceTilt(prev => ({ ...prev, dragging: true }));
  }, [spaceTilt.x, spaceTilt.y]);

  const handleSpacePointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const drag = spaceDragRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setSpaceTilt({
      x: clampNumber(drag.baseX - dy / 22, -10, 10),
      y: clampNumber(drag.baseY + dx / 18, -16, 16),
      dragging: true,
    });
  }, []);

  const endSpaceDrag = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const drag = spaceDragRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;

    spaceDragRef.current.active = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setSpaceTilt({ x: 0, y: 0, dragging: false });
  }, []);

  return (
    <div
      className="flex flex-col items-center w-full min-h-screen bg-[#05050A] overflow-hidden relative"
      onPointerDown={handleSpacePointerDown}
      onPointerMove={handleSpacePointerMove}
      onPointerUp={endSpaceDrag}
      onPointerCancel={endSpaceDrag}
      style={{ perspective: 1200 }}
    >

      {/* ── Background ── */}
      <motion.div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 0,
          transformStyle: "preserve-3d",
          transformOrigin: "50% 50%",
        }}
        animate={{
          rotateX: spaceTilt.x * 0.28,
          rotateY: spaceTilt.y * 0.24,
          scale: spaceTilt.dragging ? 1.018 : 1,
        }}
        transition={{ type: "spring", stiffness: 72, damping: 18, mass: 0.7 }}
      >
        <DreamAntigravityBackground
          particleColor={charConfig.particleColor}
          glowColor={charConfig.glowColor}
        />
        <AmbientBg theme={bgTheme} settings={ambientVisualSettings} />
        {chatVisualStyle === "orb" && (
          <MineradioParticles
            playing={bgMusicPlaying}
            cover={null}
            opacity={hasAtmosphere ? 0.48 : 0.30}
            colors={{
              primary: charConfig.particleColor,
              secondary: charConfig.particleColor,
              highlight: "#fff0b8",
              glow: charConfig.particleColor,
            }}
          />
        )}
      </motion.div>

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
          {!immersiveMusic && <div>
            <p className="text-[10px] tracking-[0.22em] uppercase" style={{ color: "rgba(255,255,255,0.16)" }}>
              Dream Space
            </p>
            {!settings?.hasApiKey && (
              <p className="text-[9px] tracking-wider" style={{ color: "rgba(52,211,153,0.4)" }}>demo</p>
            )}
          </div>}
        </div>

        {chatVisualStyle === "album-particle" ? (
          <div
            className={`absolute top-4 flex items-center rounded-full p-1 ${immersiveMusic ? "right-5" : "left-1/2 -translate-x-1/2"}`}
            style={{
              background: "rgba(12,12,24,0.62)",
              border: "1px solid rgba(255,255,255,0.075)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 10px 34px rgba(0,0,0,0.22)",
            }}
          >
            <div className="relative" style={{ display: immersiveMusic ? "none" : undefined }}>
              <AnimatePresence>
                {visualStyleOpen && (
                  <motion.div
                    className="absolute top-[calc(100%+10px)] left-1/2 -translate-x-1/2 w-36 rounded-2xl p-2 flex flex-col gap-1"
                    style={{
                      background: "rgba(8,8,18,0.95)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      boxShadow: "0 10px 34px rgba(0,0,0,0.48)",
                      zIndex: 60,
                    }}
                    initial={{ opacity: 0, y: -5, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  >
                    <button
                      onClick={() => { setChatVisualStyle("orb"); setVisualStyleOpen(false); }}
                      className="rounded-xl px-3 py-2 text-left text-[11px] tracking-wide"
                      style={{ color: "rgba(255,255,255,0.48)" }}
                    >
                      星球粒子
                    </button>
                    <button
                      onClick={() => setVisualStyleOpen(false)}
                      className="rounded-xl px-3 py-2 text-left text-[11px] tracking-wide"
                      style={{ color: `hsl(${hsl} / 0.9)`, background: `hsl(${hsl} / 0.13)` }}
                    >
                      专辑粒子
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              <button
                onClick={() => setVisualStyleOpen(open => !open)}
                className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] tracking-wide transition-all"
                style={{ color: `hsl(${hsl} / 0.82)`, background: `hsl(${hsl} / 0.10)` }}
              >
                <Palette size={14} />
                专辑粒子
              </button>
            </div>
            <button
              onClick={() => switchParticleMode("chat")}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] tracking-wide transition-all"
              style={{
                color: particleMode === "chat" ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.34)",
                background: particleMode === "chat" ? "rgba(255,255,255,0.10)" : "transparent",
              }}
            >
              <MessageCircle size={14} />
              粒子对话
            </button>
            <button
              onClick={() => switchParticleMode("music")}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] tracking-wide transition-all"
              style={{
                display: immersiveMusic ? "none" : undefined,
                color: particleMode === "music" ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.34)",
                background: particleMode === "music" ? "rgba(255,255,255,0.10)" : "transparent",
              }}
            >
              <Headphones size={14} />
              沉浸听歌
            </button>
          </div>
        ) : (
          /* Original three-persona selector stays exclusive to the sphere style. */
          <div className="flex items-center gap-0.5 rounded-full px-1 py-1"
            style={{ background: "rgba(255,255,255,0.03)", position: "relative", left: -28 }}>
            {DREAM_CHARS.map(cfg => {
              const active = activeKey === cfg.key;
              return (
                <button
                  key={cfg.key}
                  onClick={() => handleTabClick(cfg.key)}
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
                  {cfg.name}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-3" style={{ display: immersiveMusic ? "none" : undefined }}>
          {dreamMode === "continue" && (
            <button
              onClick={() => {
                // Navigate to "/" without the continueDreamId param — the
                // URL-param useEffect will then reset to new-dream mode.
                setLocation("/");
              }}
              className="text-[10px] tracking-wider transition-colors px-2 py-0.5 rounded-full"
              style={{
                color: `hsl(${hsl} / 0.55)`,
                border: `1px solid hsl(${hsl} / 0.20)`,
                background: `hsl(${hsl} / 0.06)`,
              }}
              title="退出续写，开始新对话"
            >
              新建
            </button>
          )}
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

        {immersiveMusic && (
          <motion.div
            data-no-space-drag="true"
            className="absolute left-1/2 top-2 -translate-x-1/2 flex items-start gap-2"
            style={{ zIndex: 26 }}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div
              className="flex flex-col items-stretch"
              onMouseEnter={() => setMusicSearchOpen(true)}
              onMouseLeave={() => setMusicSearchOpen(false)}
              onFocus={() => setMusicSearchOpen(true)}
              onBlur={event => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setMusicSearchOpen(false);
              }}
            >
              {musicSearchOpen ? (
                <motion.div
                  className="flex w-[min(72vw,620px)] items-center gap-3 rounded-full px-4 py-2"
                  style={{
                    background: "rgba(8,8,18,0.74)",
                    border: `1px solid hsl(${hsl} / 0.24)`,
                    backdropFilter: "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)",
                    boxShadow: "0 12px 34px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.06)",
                  }}
                  initial={{ opacity: 0, width: 44 }}
                  animate={{ opacity: 1, width: "min(72vw, 620px)" }}
                >
                  <Search size={15} style={{ color: `hsl(${hsl} / 0.62)`, flexShrink: 0 }} />
                  <input
                    autoFocus
                    value={neteaseQuery}
                    onChange={e => setNeteaseQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") void searchNeteaseMusic(); }}
                    placeholder="搜索歌曲 · 歌手"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    style={{ color: "rgba(255,255,255,0.78)" }}
                  />
                  <button
                    onClick={() => void searchNeteaseMusic()}
                    disabled={neteaseLoading}
                    className="h-9 w-9 rounded-full text-[12px] disabled:opacity-50"
                    style={{ background: `hsl(${hsl} / 0.22)`, color: `hsl(${hsl} / 0.92)` }}
                  >
                    {neteaseLoading ? "…" : "搜"}
                  </button>
                  <button
                    onClick={() => bgMusicInputRef.current?.click()}
                    className="flex h-9 w-9 items-center justify-center rounded-full"
                    title="导入本地音乐"
                    style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.70)" }}
                  >
                    <Upload size={15} />
                  </button>
                </motion.div>
              ) : (
                <button
                  className="flex h-10 w-10 items-center justify-center rounded-full"
                  title="搜索音乐"
                  style={{
                    background: "rgba(8,8,18,0.42)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.42)",
                    backdropFilter: "blur(18px)",
                  }}
                >
                  <Search size={15} />
                </button>
              )}

              {musicSearchOpen && (neteaseSongs.length > 0 || bgMusicName) && (
                <div
                  className="mt-2 w-[min(72vw,620px)] rounded-[24px] p-3"
                  style={{
                    background: "rgba(8,8,18,0.82)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    backdropFilter: "blur(26px)",
                    boxShadow: "0 18px 46px rgba(0,0,0,0.42)",
                  }}
                >
                  {neteaseSongs.length > 0 && (
                    <div className="max-h-52 overflow-y-auto pr-1 flex flex-col gap-1.5">
                      {neteaseSongs.map(song => (
                        <button
                          key={song.id}
                          onClick={() => void playNeteaseSong(song)}
                          className="flex items-center gap-3 rounded-2xl p-2 text-left"
                          style={{ background: "rgba(255,255,255,0.04)" }}
                        >
                          {song.cover ? (
                            <img src={`${API_BASE}/api/music/netease/cover?url=${encodeURIComponent(song.cover)}`} alt="" className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            <div className="h-9 w-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}><Music2 size={14} /></div>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px]" style={{ color: "rgba(255,255,255,0.76)" }}>{song.name}</span>
                            <span className="block truncate text-[11px]" style={{ color: "rgba(255,255,255,0.36)" }}>{song.artists.join(" / ") || song.album}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {bgMusicName && (
                    <div className="mt-2 flex items-center gap-3 px-1">
                      <button onClick={toggleBgMusic} className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: `hsl(${hsl} / 0.20)` }}>
                        {bgMusicPlaying ? <Pause size={15} /> : <Play size={15} />}
                      </button>
                      <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: "rgba(255,255,255,0.50)" }}>{bgMusicName}</span>
                      <input type="range" min={0} max={1} step={0.01} value={bgMusicVolume} onChange={e => setBgMusicVolume(Number(e.target.value))} className="h-[3px] w-24" style={{ accentColor: `hsl(${hsl})` }} />
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => particleCoverInputRef.current?.click()}
              className="flex h-10 w-10 items-center justify-center rounded-full"
              title="更换专辑封面"
              style={{ background: "rgba(8,8,18,0.42)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.42)", backdropFilter: "blur(18px)" }}
            >
              <ImageIcon size={15} />
            </button>
            <button
              onClick={() => setLyricsVisible(value => !value)}
              disabled={lyrics.length === 0}
              className="flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-[12px] disabled:opacity-25"
              title={lyrics.length ? "显示或隐藏 3D 歌词" : "选择网易云歌曲后显示歌词"}
              style={{ background: lyricsVisible ? `hsl(${hsl} / 0.18)` : "rgba(8,8,18,0.42)", border: `1px solid ${lyricsVisible ? `hsl(${hsl} / 0.24)` : "rgba(255,255,255,0.08)"}`, color: lyricsVisible ? `hsl(${hsl} / 0.88)` : "rgba(255,255,255,0.42)", backdropFilter: "blur(18px)" }}
            >
              词
            </button>
          </motion.div>
        )}
      </header>

      {/* ── CENTER SOUL AREA ── */}
      <motion.div
        className="flex-1 flex flex-col items-center justify-center w-full px-6 gap-3"
        style={{
          zIndex: 10,
          position: "relative",
          transformStyle: "preserve-3d",
          transformOrigin: "50% 45%",
        }}
        animate={{
          rotateX: spaceTilt.x * 0.72,
          rotateY: spaceTilt.y * 0.72,
          x: spaceTilt.y * 1.6,
          y: -spaceTilt.x * 1.1,
        }}
        transition={{ type: "spring", stiffness: 90, damping: 19, mass: 0.68 }}
      >

        {chatVisualStyle === "album-particle" ? (
          <motion.div
            key="album-particle-stage"
            className="relative select-none"
            onPointerDown={event => event.stopPropagation()}
            style={{
              width: immersiveMusic ? "min(76vw, calc(100vh - 150px), 920px)" : "min(72vw, 760px)",
              height: immersiveMusic ? "min(76vw, calc(100vh - 150px), 920px)" : "min(72vw, 760px)",
              maxHeight: immersiveMusic ? "none" : "calc(100vh - 290px)",
              maxWidth: immersiveMusic ? "none" : "calc(100vh - 290px)",
              overflow: "visible",
              cursor: "grab",
              filter: "drop-shadow(0 18px 46px rgba(255,170,70,0.08))",
            }}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1, y: immersiveMusic ? "-4vh" : 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <AlbumParticleStage
              cover={
                (particleMode === "music" ? bgMusicCover : null)
                ?? particleCover
                ?? getDefaultAlbumParticleCover()
              }
              metricsRef={particleAudioMetricsRef}
              active={particleMode === "music" ? bgMusicPlaying : ttsStatus === "playing"}
            />

            <AnimatePresence>
              {immersiveMusic && lyricsVisible && activeLyricIndex >= 0 && (
                <motion.div
                  key="immersive-lyrics"
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                  style={{ perspective: 1100, transformStyle: "preserve-3d", zIndex: 4 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="flex w-[82%] flex-col items-center gap-3 text-center"
                    style={{ transformStyle: "preserve-3d" }}
                    animate={{ rotateX: -4 + spaceTilt.x * 0.25, rotateY: -11 + spaceTilt.y * 0.35, z: 86 }}
                    transition={{ type: "spring", stiffness: 85, damping: 20 }}
                  >
                    {lyrics.slice(Math.max(0, activeLyricIndex - 2), activeLyricIndex + 3).map((line, visibleIndex) => {
                      const center = Math.min(2, activeLyricIndex);
                      const distance = visibleIndex - center;
                      const current = distance === 0;
                      return (
                        <motion.p
                          key={`${line.time}-${line.text}`}
                          className={current ? "text-[clamp(22px,3vw,48px)] font-semibold tracking-wide" : "text-[clamp(12px,1.45vw,21px)] tracking-wide"}
                          style={{
                            color: current ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.24)",
                            textShadow: current ? `0 0 20px hsl(${hsl} / 0.52), 0 5px 26px rgba(0,0,0,0.78)` : "0 3px 16px rgba(0,0,0,0.65)",
                            transform: `translateZ(${current ? 92 : 20 - Math.abs(distance) * 14}px) translateX(${distance * 22}px)`,
                            opacity: current ? 1 : Math.max(0.16, 0.42 - Math.abs(distance) * 0.12),
                          }}
                          initial={{ opacity: 0, y: 16, z: 0 }}
                          animate={{ opacity: current ? 1 : Math.max(0.16, 0.42 - Math.abs(distance) * 0.12), y: 0, z: current ? 92 : 18 }}
                          transition={{ duration: 0.42, ease: "easeOut" }}
                        >
                          {line.text}
                        </motion.p>
                      );
                    })}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          /* CompanionOrb — clickable wake interaction for all characters */
          <motion.div
            key="companion-orb-stage"
            className="relative select-none"
            style={{
              cursor: "pointer",
              transformStyle: "preserve-3d",
              filter: spaceTilt.dragging
                ? `drop-shadow(${spaceTilt.y * -0.7}px ${spaceTilt.x * 0.5}px 22px hsl(${hsl} / 0.20))`
                : `drop-shadow(0 10px 28px hsl(${hsl} / 0.10))`,
            }}
            animate={wakeClicked ? { scale: [1, 1.07, 1.02] } : { scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            onClick={handleOrbClick}
          >
            <CompanionOrb
              size="lg"
              color={charConfig.companionColor}
              isSpeaking={orbIsSpeaking}
              isThinking={false}
              isListening={false}
              interactionRotation={{ x: spaceTilt.x, y: spaceTilt.y }}
            />
            <AnimatePresence>
              {bgMusicCover && (
                <AlbumParticleCore
                  cover={bgMusicCover}
                  playing={bgMusicPlaying}
                  hsl={hsl}
                />
              )}
            </AnimatePresence>
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
        )}

        {/* Name + subtitle — re-animate when character changes */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeKey}
            initial={{ opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.38, ease: "easeOut" }}
            className="flex flex-col items-center gap-1.5 text-center"
            style={{ display: chatVisualStyle === "album-particle" ? "none" : undefined }}
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

        {/* ── WAKE SUBTITLE — works for all characters ── */}
        <AnimatePresence>
          {chatVisualStyle === "orb" && wakeText !== null && (
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
          {chatVisualStyle === "orb" && (ttsStatus === "playing" || ttsStatus === "loading") && wakeText === null && (
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
        <div
          className="w-full max-w-md min-h-[80px] flex items-center justify-center mt-1"
          style={{ display: chatVisualStyle === "album-particle" ? "none" : undefined }}
        >
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
                  const shown = isTyping ? typingContent : (displayReply.displayContent ?? displayReply.content);
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
                {displayReply.sources && displayReply.sources.length > 0 && (
                  <p className="mt-1 text-[8px] tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.12)" }}>
                    <span style={{ fontStyle: "italic" }}>来源 / {displayReply.sources.slice(0, 4).map(s => s.name).join(", ")}</span>
                  </p>
                )}
              </motion.div>
            ) : (
              <motion.div
                key={`welcome-${activeKey}`}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full"
              />
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── HISTORY BOTTOM SHEET ── only when there are messages */}
      {chatVisualStyle === "orb" && hasMessages && !immersiveMusic && (
        <HistoryBottomSheet
          messages={messages}
          charMap={Object.fromEntries(DREAM_CHARS.map(c => [c.key, { name: c.name, enName: c.enName, particleColor: c.particleColor }]))}
          avatars={avatars}
          onAvatarChange={handleAvatarChange}
          typingMsgId={typingMsgId}
          typingContent={typingContent}
          initialOpen={resumeActive}
        />
      )}

      {/* ── BOTTOM INPUT ZONE ── */}
      <div className="w-full max-w-md mx-auto px-5 pb-10 pt-3 flex flex-col items-center gap-3 flex-shrink-0"
        style={{ zIndex: 30, position: "relative", display: immersiveMusic ? "none" : undefined }}>

        <input ref={bgMusicInputRef} type="file" accept="audio/mpeg,audio/wav,audio/x-m4a,audio/*" className="hidden" onChange={handleBgMusicFile} />
        <input ref={particleCoverInputRef} type="file" accept="image/*" className="hidden" onChange={handleParticleCoverSelect} />

        {!immersiveMusic && (
          <>

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
          <button onClick={() => fileInputRef.current?.click()}
            className="transition-colors flex-shrink-0"
            style={{ color: pendingImageDataUrl ? `hsl(${hsl} / 0.8)` : "rgba(255,255,255,0.18)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.50)")}
            onMouseLeave={e => (e.currentTarget.style.color = pendingImageDataUrl ? `hsl(${hsl} / 0.8)` : "rgba(255,255,255,0.18)")}>
            <ImageIcon size={15} />
          </button>
        </div>
          </>
        )}

        {/* ── Auxiliary toolbar ── */}
        <div className="flex items-center justify-center gap-4 w-full">
          {/* Chat visual style */}
          <div
            className="relative"
            style={{ display: chatVisualStyle === "album-particle" ? "none" : undefined }}
          >
            <AnimatePresence>
              {visualStyleOpen && (
                <motion.div
                  className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 w-40 rounded-2xl p-2 flex flex-col gap-1"
                  style={{
                    background: "rgba(8,8,18,0.94)",
                    backdropFilter: "blur(24px)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 8px 34px rgba(0,0,0,0.52)",
                    zIndex: 50,
                  }}
                  initial={{ opacity: 0, y: 7, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.97 }}
                >
                  {([
                    ["orb", "星球粒子"],
                    ["album-particle", "专辑粒子"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => { setChatVisualStyle(value); setVisualStyleOpen(false); }}
                      className="rounded-xl px-3 py-2 text-left text-[11px] tracking-wide transition-all"
                      style={{
                        color: chatVisualStyle === value ? `hsl(${hsl} / 0.9)` : "rgba(255,255,255,0.42)",
                        background: chatVisualStyle === value ? `hsl(${hsl} / 0.13)` : "transparent",
                        border: `1px solid ${chatVisualStyle === value ? `hsl(${hsl} / 0.18)` : "transparent"}`,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            <button
              onClick={() => setVisualStyleOpen(open => !open)}
              className="flex items-center justify-center gap-1.5 h-9 rounded-full px-3 transition-all"
              title="切换聊天视觉风格"
              style={{
                color: visualStyleOpen || chatVisualStyle === "album-particle" ? `hsl(${hsl} / 0.72)` : "rgba(255,255,255,0.24)",
                background: "rgba(255,255,255,0.04)",
                border: visualStyleOpen || chatVisualStyle === "album-particle"
                  ? `1px solid hsl(${hsl} / 0.18)`
                  : "1px solid rgba(255,255,255,0.06)",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = `hsl(${hsl} / 0.70)`;
                e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                e.currentTarget.style.borderColor = `hsl(${hsl} / 0.18)`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = "rgba(255,255,255,0.24)";
                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
              }}
            >
              <Palette size={15} />
              <span className="text-[10px] tracking-wide whitespace-nowrap">
                {chatVisualStyle === "album-particle" ? "专辑粒子" : "风格"}
              </span>
            </button>
          </div>

          {chatVisualStyle === "album-particle" && (
            <button
              onClick={() => particleCoverInputRef.current?.click()}
              className="flex items-center justify-center w-9 h-9 rounded-full transition-all"
              title="更换粒子封面"
              style={{
                color: particleCover ? `hsl(${hsl} / 0.72)` : "rgba(255,255,255,0.24)",
                background: "rgba(255,255,255,0.04)",
                border: particleCover ? `1px solid hsl(${hsl} / 0.18)` : "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <ImageIcon size={15} />
            </button>
          )}

          {/* Atmosphere */}
          {(chatVisualStyle === "orb" || chatVisualStyle === "album-particle") && (
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
          )}

          {/* Music */}
          <div
            className="relative"
            style={{
              display: chatVisualStyle === "album-particle" ? "none" : undefined,
            }}
          >
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
                  {/* Netease Cloud Music */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5">
                      <input
                        value={neteaseQuery}
                        onChange={e => setNeteaseQuery(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") void searchNeteaseMusic();
                        }}
                        placeholder="搜网易云音乐"
                        className="min-w-0 flex-1 rounded-xl px-2.5 py-2 text-[11px] outline-none"
                        style={{
                          background: "rgba(255,255,255,0.045)",
                          color: "rgba(255,255,255,0.68)",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      />
                      <button
                        onClick={() => void searchNeteaseMusic()}
                        disabled={neteaseLoading}
                        className="w-9 rounded-xl py-2 text-[11px] transition-all disabled:opacity-50"
                        style={{
                          background: `hsl(${hsl} / 0.16)`,
                          color: `hsl(${hsl} / 0.76)`,
                          border: `1px solid hsl(${hsl} / 0.16)`,
                        }}
                      >
                        {neteaseLoading ? "…" : "搜"}
                      </button>
                    </div>

                    {neteaseSongs.length > 0 && (
                      <div className="max-h-36 overflow-y-auto pr-1 flex flex-col gap-1">
                        {neteaseSongs.map(song => (
                          <button
                            key={song.id}
                            onClick={() => void playNeteaseSong(song)}
                            className="flex items-center gap-2 rounded-xl p-1.5 text-left transition-all"
                            style={{ background: "rgba(255,255,255,0.035)" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.035)")}
                          >
                            {song.cover ? (
                              <img
                                src={`${API_BASE}/api/music/netease/cover?url=${encodeURIComponent(song.cover)}`}
                                alt=""
                                className="w-7 h-7 rounded-lg object-cover flex-shrink-0"
                              />
                            ) : (
                              <div
                                className="w-7 h-7 rounded-lg flex-shrink-0"
                                style={{ background: `hsl(${hsl} / 0.14)` }}
                              />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block text-[11px] truncate" style={{ color: "rgba(255,255,255,0.68)" }}>
                                {song.name}
                              </span>
                              <span className="block text-[9px] truncate" style={{ color: "rgba(255,255,255,0.28)" }}>
                                {song.artists.join(" / ") || song.album}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

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
              {ttsStatus === "loading"  && `${charConfig.name}正在开口…`}
              {ttsStatus === "playing"  && `${charConfig.name}正在说话…`}
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
        visualSettings={ambientVisualSettings}
        onTheme={handleSceneSelect}
        onSound={handleSoundChange}
        onMusic={handleMusicChange}
        onVisualSettingsChange={setAmbientVisualSettings}
        onVisualSettingsReset={handleAmbientVisualReset}
        onClose={() => setAtmosphereOpen(false)}
      />

      {/* Hidden background music audio element */}
      <audio
        ref={el => { bgAudioRef.current = el; if (el) el.volume = bgMusicVolume; }}
        crossOrigin="anonymous"
        loop
        preload="none"
        onTimeUpdate={event => setMusicCurrentTime(event.currentTarget.currentTime)}
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
                    {dreamMode === "continue" ? "要更新这段梦境吗？" : "要把这段梦收入档案吗？"}
                  </h3>
                  <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.26)" }}>
                    {dreamMode === "continue"
                      ? <>新增的对话会追加到<br />原来的梦境记录里。</>
                      : <>你可以保存它，也可以让它<br />只停留在这次对话里。</>
                    }
                  </p>
                </div>
                {/* Music save toggle — only shown when music is active */}
                {(musicContext || ambientSound !== "none") && (
                  <button
                    onClick={() => setSaveMusicSnapshot(s => !s)}
                    className="flex items-center gap-2.5 w-full px-1 py-0.5"
                    style={{ color: saveMusicSnapshot ? `hsl(${hsl} / 0.75)` : "rgba(255,255,255,0.22)" }}
                  >
                    <div
                      className="w-8 h-4 rounded-full flex items-center transition-all duration-300 flex-shrink-0"
                      style={{
                        background: saveMusicSnapshot ? `hsl(${hsl} / 0.38)` : "rgba(255,255,255,0.08)",
                        border: `1px solid ${saveMusicSnapshot ? `hsl(${hsl} / 0.45)` : "rgba(255,255,255,0.12)"}`,
                        padding: "2px",
                        justifyContent: saveMusicSnapshot ? "flex-end" : "flex-start",
                      }}
                    >
                      <div className="w-3 h-3 rounded-full" style={{ background: saveMusicSnapshot ? `hsl(${hsl})` : "rgba(255,255,255,0.30)" }} />
                    </div>
                    <span className="text-[11px] tracking-wide">保存当时的声音</span>
                  </button>
                )}

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
                    {dreamMode === "continue" ? "更新梦境" : "收入档案"}
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
