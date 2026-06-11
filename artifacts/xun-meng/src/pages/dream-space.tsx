import { useState, useRef, useEffect } from "react";
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

// ── Dream character personality config ─────────────────────────────────────
interface DreamCharConfig {
  particleColor: string;
  glowColor: string;
  subtitle: string;
  hint: string;
  firstMessage: string;
}

const DREAM_CHARS: { match: string; cfg: DreamCharConfig }[] = [
  {
    match: "岛深",
    cfg: {
      particleColor: "#6B8CFF",
      glowColor:     "rgba(107,140,255,0.28)",
      subtitle:      "潜入梦的深处",
      hint:          "你可以从一个画面开始，我会陪你慢慢往下潜。",
      firstMessage:  "梦像一片海。你只需要说出最先浮上来的那个画面，我会陪你一起往深处走。",
    },
  },
  {
    match: "暮歌",
    cfg: {
      particleColor: "#9B7CFF",
      glowColor:     "rgba(155,124,255,0.28)",
      subtitle:      "你可以从任何地方开始",
      hint:          "梦境就像一面镜子，有时映出的是我们白天来不及细想的事情。",
      firstMessage:  "梦境就像一面镜子，有时映出的是我们白天来不及细想的事情。你的梦里，最近出现了什么？",
    },
  },
  {
    match: "阿暖",
    cfg: {
      particleColor: "#F2A84B",
      glowColor:     "rgba(242,168,75,0.26)",
      subtitle:      "我在，慢慢说",
      hint:          "不用讲完整，哪怕只是一个感觉，也可以交给我。",
      firstMessage:  "不用急着说清楚。你可以先告诉我，醒来后身体里留下的第一个感觉是什么。",
    },
  },
];

const DEFAULT_CFG: DreamCharConfig = DREAM_CHARS[1].cfg;

function getCharConfig(name: string): DreamCharConfig {
  for (const { match, cfg } of DREAM_CHARS) {
    if (name.includes(match)) return cfg;
  }
  return DEFAULT_CFG;
}

// ── Other helpers ───────────────────────────────────────────────────────────
function getColor(name: string): CompanionColor {
  if (name.includes("阿暖")) return "amber";
  if (name.includes("暮歌")) return "indigo";
  if (name.includes("岛深")) return "teal";
  return "purple";
}
function getEnName(name: string) {
  if (name.includes("阿暖")) return "Anuan";
  if (name.includes("暮歌")) return "Muge";
  if (name.includes("岛深")) return "Daoshan";
  return "";
}

const COLOR_HSL: Record<CompanionColor, string> = {
  amber:  "38 90% 60%",
  indigo: "240 70% 65%",
  teal:   "185 70% 55%",
  purple: "255 90% 70%",
};

const SCENE_DEFAULTS: Record<BgTheme, { sound: AmbientSoundType; music: MusicType }> = {
  void:  { sound: "none",  music: "none" },
  rain:  { sound: "rain",  music: "piano-rain" },
  night: { sound: "night", music: "strings" },
  fog:   { sound: "none",  music: "fog" },
  stars: { sound: "night", music: "none" },
};

type Message = { role: "user" | "assistant"; content: string };

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

  const [reply,       setReply]       = useState<{ text: string; time: string } | null>(null);
  const [inputText,   setInputText]   = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isThinking,  setIsThinking]  = useState(false);
  const [history,     setHistory]     = useState<Message[]>([]);

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

  const charColor  = activeChar ? getColor(activeChar.name) : "purple";
  const hsl        = COLOR_HSL[charColor];
  const charConfig = activeChar ? getCharConfig(activeChar.name) : DEFAULT_CFG;
  const hasAtmosphere = bgTheme !== "void" || ambientSound !== "none" || music !== "none";

  const handleTabClick = async (id: string) => {
    if (activeChar?.id === id) return;
    await activateMutation.mutateAsync({ id });
    refetchActive();
    setReply(null);
    setHistory([]);
  };

  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = activeChar?.language === "en" ? "en-US" : "zh-CN";
    u.rate = 0.88;
    window.speechSynthesis.speak(u);
  };

  const handleSend = async (text?: string) => {
    const msg = (text ?? inputText).trim();
    if (!msg || !activeChar) return;
    setInputText("");
    setIsThinking(true);
    const newHistory: Message[] = [...history, { role: "user", content: msg }];
    setHistory(newHistory);
    try {
      const res = await chatMutation.mutateAsync({
        data: {
          message: msg,
          history: newHistory.slice(-8),
          characterSystemPrompt: activeChar.systemPrompt,
        },
      });
      const now = new Date();
      const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      setHistory(h => [...h, { role: "assistant", content: res.reply }]);
      setReply({ text: res.reply, time });
      speak(res.reply);
    } catch {
      toast({ title: "感应失败，请重试", variant: "destructive" });
    } finally {
      setIsThinking(false);
    }
  };

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
        const now = new Date();
        const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
        setHistory(h => [
          ...h,
          { role: "user", content: "[图片]" },
          { role: "assistant", content: replyText },
        ]);
        setReply({ text: replyText, time });
        speak(replyText);
      } catch {
        toast({ title: "图片感应失败", variant: "destructive" });
      } finally {
        setIsThinking(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveDream = async () => {
    if (!activeChar || history.length === 0) { toast({ title: "还没有梦境内容" }); return; }
    const firstUser = history.find(m => m.role === "user")?.content ?? "未命名";
    const title = firstUser.slice(0, 15) + (firstUser.length > 15 ? "…" : "");
    const content = history.map(m => `[${m.role === "user" ? "你" : activeChar.name}] ${m.content}`).join("\n\n");
    try {
      await createDreamMutation.mutateAsync({
        data: { title, content, mood: "calm", clarity: "moderate", isRecurring: false,
                companionReply: reply?.text, characterId: activeChar.id },
      });
      toast({ title: "已保存到梦境手账 ✦" });
    } catch {
      toast({ title: "保存失败", variant: "destructive" });
    }
  };

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

  const isSpeaking = !!reply && !isThinking;

  return (
    <div className="flex flex-col items-center w-full min-h-screen bg-[#05050A] overflow-hidden relative">

      {/* ── Background layers ── */}
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

        {/* ── Character tabs ── */}
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
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "6px 13px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  background: active ? "rgba(255,255,255,0.12)" : "transparent",
                  border: `1px solid ${active ? "rgba(255,255,255,0.16)" : "transparent"}`,
                  color: active ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.28)",
                  transition: "all 0.3s ease",
                  outline: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {/* Dot indicator with character colour */}
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    flexShrink: 0,
                    backgroundColor: active ? cfg.particleColor : "rgba(255,255,255,0.18)",
                    transition: "background-color 0.3s ease",
                    boxShadow: active ? `0 0 6px ${cfg.particleColor}88` : "none",
                  }}
                />
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

        <CompanionOrb size="lg" color={charColor} isSpeaking={isSpeaking} isThinking={isThinking} isListening={isListening} />

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
                {activeChar.name.replace(/[a-zA-Z]/g, "").trim()}
              </span>
              <span className="text-xs tracking-[0.15em]" style={{ color: "rgba(255,255,255,0.22)" }}>
                {getEnName(activeChar.name)}
              </span>
              {/* Pulsing dot in character colour */}
              <motion.div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
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

        {/* Waveform */}
        <AudioWaveform isActive={isSpeaking} isListening={isListening} isThinking={isThinking} color={charColor} />

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
            ) : reply ? (
              <motion.div key="reply"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full rounded-2xl px-5 py-5 text-center"
                style={{
                  background: `linear-gradient(140deg, hsl(${hsl} / 0.05) 0%, rgba(255,255,255,0.012) 100%)`,
                  border: `1px solid hsl(${hsl} / 0.10)`,
                  boxShadow: `0 2px 28px hsl(${hsl} / 0.05)`,
                }}>
                <p className="text-[14px] leading-[1.8] whitespace-pre-wrap" style={{ color: "rgba(255,255,255,0.72)" }}>
                  {reply.text}
                </p>
                <p className="mt-3 text-[9px] tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.16)" }}>
                  {reply.time}
                </p>
              </motion.div>
            ) : (
              /* Welcome card — character's first message, shown before any conversation */
              <motion.div
                key={`welcome-${activeChar.id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
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

      {/* ── HISTORY BOTTOM SHEET ── */}
      <HistoryBottomSheet
        history={history}
        charName={activeChar.name.replace(/[a-zA-Z]/g, "").trim()}
      />

      {/* ── BOTTOM INPUT ZONE ── */}
      <div className="w-full max-w-md mx-auto px-5 pb-10 pt-3 flex flex-col items-center gap-4 flex-shrink-0"
        style={{ zIndex: 30, position: "relative" }}>

        {/* Text input + image */}
        <div className="w-full flex items-center gap-3">
          <input
            type="text" value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="或者直接输入文字…"
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

        {/* Main row: atmosphere | mic | spacer */}
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

          {/* Mic — hero */}
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

        {/* Listening hint */}
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

      {/* ── ATMOSPHERE OVERLAY ── */}
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
