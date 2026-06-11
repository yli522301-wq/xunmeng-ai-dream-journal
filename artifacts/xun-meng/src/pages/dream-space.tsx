import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  useGetActiveCharacter, useListCharacters, useActivateCharacter,
  useGetAiSettings, useAiChat, useCreateDream, useAiRecognizeImage,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { ArrowLeft, Mic, Square, Image as ImageIcon, Sparkles } from "lucide-react";
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

export interface ChatMessage {
  id: string;
  role: "user" | CharKey;
  content: string;
  timestamp: string;
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

function getCharConfig(name: string): DreamCharConfig {
  for (const c of DREAM_CHARS) {
    if (name.includes(c.nameMatch)) return c;
  }
  return DREAM_CHARS[1];
}

// ── Demo messages ──────────────────────────────────────────────────────────
const DEMO_MESSAGES: ChatMessage[] = [
  { id: "d0", role: "user",     content: "我梦到自己一直在赶路，但怎么都赶不上。", timestamp: "昨天" },
  { id: "d1", role: "daoshen", content: "赶路的焦虑梦几乎是潜意识对现实压力的直接映射——你在追什么，或者怕被什么追上？注意梦里「赶不上」的对象：是时间、是人、还是一辆你永远上不去的车。", timestamp: "昨天" },
  { id: "d2", role: "muge",    content: "你一直在跑，路却像在延伸。那种追不上的感觉，有时候不是在追目标，而是在追一个正在离开的自己。梦把它变成了距离。", timestamp: "昨天" },
  { id: "d3", role: "anuan",   content: "赶不上的感觉真的很累人。醒来有没有觉得整个人喘不过气？这个梦可能在说，你最近给自己的压力有点大了。", timestamp: "昨天" },
];

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

  const { data: activeChar, refetch: refetchActive } = useGetActiveCharacter();
  const { data: characters } = useListCharacters();
  const { data: settings }   = useGetAiSettings();
  const activateMutation    = useActivateCharacter();
  const chatMutation        = useAiChat();
  const createDreamMutation = useCreateDream();
  const recognizeMutation   = useAiRecognizeImage();

  const [messages,    setMessages]    = useState<ChatMessage[]>(DEMO_MESSAGES);
  const [inputText,   setInputText]   = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isThinking,  setIsThinking]  = useState(false);
  const [avatars,     setAvatars]     = useState<Record<CharKey, string | null>>(loadAvatars);

  const [atmosphereOpen, setAtmosphereOpen] = useState(false);
  const [bgTheme,        setBgTheme]        = useState<BgTheme>("void");
  const [ambientSound,   setAmbientSound]   = useState<AmbientSoundType>("none");
  const [music,          setMusic]          = useState<MusicType>("none");

  const { play: playAmbient, stop: stopAmbient } = useAmbientSound();
  const { play: playMusic,   stop: stopMusic }   = useAmbientMusic();

  const fileInputRef   = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const SpeechRecognition =
    typeof window !== "undefined"
      ? (window.SpeechRecognition || (window as any).webkitSpeechRecognition)
      : null;

  useEffect(() => {
    if (!SpeechRecognition) return;
    const r = new SpeechRecognition();
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      setIsListening(false);
      setTimeout(() => handleSend(t), 300);
    };
    r.onerror = () => setIsListening(false);
    r.onend   = () => setIsListening(false);
    recognitionRef.current = r;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChar?.id]);

  useEffect(() => () => { stopAmbient(); stopMusic(); }, [stopAmbient, stopMusic]);

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
  const handleMusicChange = (m: MusicType)         => { setMusic(m); playMusic(m); };

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

  const isSpeaking = !!displayReply && !isThinking;
  const hsl        = charConfig.hsl;

  // ── Tab switch ───────────────────────────────────────────────────────────
  const handleTabClick = async (id: string) => {
    if (activeChar?.id === id) return;
    await activateMutation.mutateAsync({ id });
    refetchActive();
    // Intentionally do NOT clear messages — shared thread
  };

  // ── TTS ──────────────────────────────────────────────────────────────────
  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = activeChar?.language === "en" ? "en-US" : "zh-CN";
    u.rate = 0.88;
    window.speechSynthesis.speak(u);
  };

  // ── Get DB character system prompt by key ─────────────────────────────────
  const getSystemPrompt = useCallback((key: CharKey): string => {
    const nameMatch = CHAR_MAP[key].nameMatch;
    const dbChar = characters?.find(c => c.name.includes(nameMatch));
    return dbChar?.systemPrompt ?? CHAR_MAP[key].stylePrompt;
  }, [characters]);

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = async (text?: string) => {
    const msg = (text ?? inputText).trim();
    if (!msg || !activeChar) return;
    setInputText("");
    setIsThinking(true);

    const userMsg: ChatMessage = { id: genId(), role: "user", content: msg, timestamp: nowTime() };
    const updatedMsgs = [...messages, userMsg];
    setMessages(updatedMsgs);

    const apiHistory = messagesToApiHistory(updatedMsgs).slice(-10);

    try {
      // Current active character replies, with full shared history as context
      const res = await chatMutation.mutateAsync({
        data: { message: msg, history: apiHistory, characterSystemPrompt: getSystemPrompt(activeKey) },
      });
      const reply: ChatMessage = { id: genId(), role: activeKey, content: res.reply, timestamp: nowTime() };
      setMessages(prev => [...prev, reply]);
      speak(res.reply);
    } catch {
      toast({ title: "感应失败，请重试", variant: "destructive" });
    } finally {
      setIsThinking(false);
    }
  };

  // ── Mic ───────────────────────────────────────────────────────────────────
  const toggleMic = () => {
    if (!SpeechRecognition || !recognitionRef.current) {
      toast({ title: "此浏览器不支持语音输入", variant: "destructive" });
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.lang = activeChar?.language === "en" ? "en-US" : "zh-CN";
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // ── Image ──────────────────────────────────────────────────────────────────
  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChar) return;
    setIsThinking(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      const base64  = dataUrl.split(",")[1];
      try {
        const res = await recognizeMutation.mutateAsync({
          data: { imageBase64: base64, mimeType: file.type || "image/jpeg" },
        });
        const replyText = `${res.description}\n\n${res.draftContent}`;
        const userMsg: ChatMessage  = { id: genId(), role: "user",     content: "[图片]",  timestamp: nowTime() };
        const aiMsg:   ChatMessage  = { id: genId(), role: activeKey,  content: replyText, timestamp: nowTime() };
        setMessages(prev => [...prev, userMsg, aiMsg]);
        speak(replyText);
      } catch {
        toast({ title: "图片感应失败", variant: "destructive" });
      } finally {
        setIsThinking(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // ── Save dream ─────────────────────────────────────────────────────────────
  const handleSaveDream = async () => {
    if (!activeChar || messages.filter(m => m.role === "user").length === 0) {
      toast({ title: "还没有梦境内容" }); return;
    }
    const firstUser = messages.find(m => m.role === "user")?.content ?? "未命名";
    const title = firstUser.slice(0, 15) + (firstUser.length > 15 ? "…" : "");
    const content = messages.map(m => {
      const who = m.role === "user" ? "你" : (CHAR_MAP[m.role as CharKey]?.name ?? m.role);
      return `[${who}] ${m.content}`;
    }).join("\n\n");
    try {
      await createDreamMutation.mutateAsync({
        data: { title, content, mood: "calm", clarity: "moderate", isRecurring: false,
                companionReply: displayReply?.content, characterId: activeChar.id },
      });
      toast({ title: "已保存到梦境手账 ✦" });
    } catch {
      toast({ title: "保存失败", variant: "destructive" });
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

  const hasMessages = messages.filter(m => !m.id.startsWith("d")).length > 0 || messages.length > 0;

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
          <Link href="/dreams">
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

        <button onClick={handleSaveDream}
          className="text-[11px] tracking-wider transition-colors"
          style={{ color: "rgba(255,255,255,0.18)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.18)")}>
          保存
        </button>
      </header>

      {/* ── CENTER SOUL AREA ── */}
      <div className="flex-1 flex flex-col items-center justify-center w-full px-6 gap-5"
        style={{ zIndex: 10, position: "relative" }}>

        <CompanionOrb size="lg" color={charConfig.companionColor} isSpeaking={isSpeaking} isThinking={isThinking} isListening={isListening} />

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

        {/* ── RESPONSE / WELCOME CARD ── */}
        <div className="w-full max-w-md min-h-[80px] flex items-center justify-center mt-1">
          <AnimatePresence mode="wait">
            {isThinking ? (
              <motion.div key="thinking"
                initial={{ opacity: 0 }} animate={{ opacity: [0.12, 0.45, 0.12] }} exit={{ opacity: 0 }}
                transition={{ duration: 1.6, repeat: Infinity }}
                className="text-[11px] tracking-[0.28em]" style={{ color: "rgba(255,255,255,0.20)" }}>
                正在感应…
              </motion.div>
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
                <p className="text-[14px] leading-[1.8] whitespace-pre-wrap" style={{ color: "rgba(255,255,255,0.72)" }}>
                  {displayReply.content}
                </p>
                <p className="mt-3 text-[9px] tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.16)" }}>
                  {displayReply.timestamp}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={`welcome-${activeChar.id}`}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
                className="w-full flex flex-col items-center gap-3"
              >
                <div className="w-full rounded-2xl px-5 py-4 text-center"
                  style={{
                    background: `linear-gradient(140deg, hsl(${hsl} / 0.04) 0%, transparent 100%)`,
                    border: `1px solid hsl(${hsl} / 0.08)`,
                  }}>
                  <p className="text-[13px] leading-[1.85] italic" style={{ color: "rgba(255,255,255,0.38)" }}>
                    {charConfig.firstMessage}
                  </p>
                </div>
                <p className="text-[10px] tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.12)" }}>
                  {charConfig.hint}
                </p>
              </motion.div>
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
        />
      )}

      {/* ── BOTTOM INPUT ZONE ── */}
      <div className="w-full max-w-md mx-auto px-5 pb-10 pt-3 flex flex-col items-center gap-3 flex-shrink-0"
        style={{ zIndex: 30, position: "relative" }}>

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
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
          <button onClick={() => fileInputRef.current?.click()}
            className="transition-colors flex-shrink-0"
            style={{ color: "rgba(255,255,255,0.18)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.18)")}>
            <ImageIcon size={15} />
          </button>
        </div>

        {/* Mic row */}
        <div className="flex items-center justify-between w-full">
          <button onClick={() => setAtmosphereOpen(true)}
            className="flex flex-col items-center gap-1 transition-colors"
            style={{ color: hasAtmosphere ? `hsl(${hsl} / 0.7)` : "rgba(255,255,255,0.20)" }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.8")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
            <Sparkles size={17} />
            {hasAtmosphere && (
              <motion.span className="w-1 h-1 rounded-full"
                style={{ backgroundColor: `hsl(${hsl})` }}
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
          </button>

          <motion.button
            onClick={toggleMic}
            className="relative flex items-center justify-center rounded-full flex-shrink-0"
            style={{
              width: 72, height: 72,
              backgroundColor: `hsl(${hsl} / ${isListening ? 0.82 : 0.13})`,
              boxShadow: isListening
                ? `0 0 0 8px hsl(${hsl} / 0.10), 0 0 36px hsl(${hsl} / 0.30)`
                : `0 0 0 1px hsl(${hsl} / 0.18)`,
              color: isListening ? "#fff" : `hsl(${hsl})`,
            }}
            animate={isListening ? { scale: [1, 1.05, 1] } : { scale: 1 }}
            transition={isListening ? { duration: 1.3, repeat: Infinity, ease: "easeInOut" } : {}}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.93 }}
          >
            {isListening ? <Square size={22} className="fill-current" /> : <Mic size={25} />}
            {isListening && (
              <motion.div className="absolute inset-0 rounded-full pointer-events-none"
                style={{ border: `1px solid hsl(${hsl} / 0.4)` }}
                animate={{ scale: [1, 1.55], opacity: [0.5, 0] }}
                transition={{ duration: 1.3, repeat: Infinity, ease: "easeOut" }}
              />
            )}
          </motion.button>

          <div style={{ width: 40 }} />
        </div>

        <AnimatePresence>
          {isListening && (
            <motion.p
              initial={{ opacity: 0, y: 4 }} exit={{ opacity: 0 }}
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ opacity: { duration: 1.2, repeat: Infinity }, y: { duration: 0.2 } }}
              className="text-[11px] tracking-[0.2em] -mt-2"
              style={{ color: "rgba(255,255,255,0.35)" }}>
              正在聆听…
            </motion.p>
          )}
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
    </div>
  );
}
