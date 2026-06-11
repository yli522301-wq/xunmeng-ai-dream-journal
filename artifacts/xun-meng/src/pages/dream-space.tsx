import { useState, useRef, useEffect } from "react";
import {
  useGetActiveCharacter, useListCharacters, useActivateCharacter,
  useGetAiSettings, useAiChat, useCreateDream, useAiRecognizeImage,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { ArrowLeft, Mic, Square, Image as ImageIcon, ScrollText, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { CompanionOrb, CompanionColor } from "@/components/companion-orb";
import { AudioWaveform } from "@/components/audio-waveform";
import { HistoryPanel } from "@/components/history-panel";
import { AtmospherePanel } from "@/components/atmosphere-panel";
import { AmbientBg, type BgTheme } from "@/components/ambient-bg";
import { useAmbientSound, type AmbientSoundType } from "@/hooks/use-ambient-sound";

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

function getPrefix(name: string) {
  if (name.includes("阿暖")) return "●";
  if (name.includes("暮歌")) return "☽";
  if (name.includes("岛深")) return "✦";
  return "●";
}

function getIdleQuote(name: string) {
  if (name.includes("阿暖")) return "我在，慢慢说";
  if (name.includes("暮歌")) return "你可以从任何地方开始说";
  if (name.includes("岛深")) return "那个梦的线索，我记着";
  return "说吧，我在听";
}

const COLOR_HSL: Record<CompanionColor, string> = {
  amber:  "38 90% 60%",
  indigo: "240 70% 65%",
  teal:   "185 70% 55%",
  purple: "255 90% 70%",
};

type Message = { role: "user" | "assistant"; content: string };

export default function DreamSpace() {
  const { toast } = useToast();

  const { data: activeChar, refetch: refetchActive } = useGetActiveCharacter();
  const { data: characters } = useListCharacters();
  const { data: settings }   = useGetAiSettings();
  const activateMutation   = useActivateCharacter();
  const chatMutation       = useAiChat();
  const createDreamMutation = useCreateDream();
  const recognizeMutation  = useAiRecognizeImage();

  const [reply, setReply]     = useState<{ text: string; time: string } | null>(null);
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isThinking,  setIsThinking]  = useState(false);
  const [history,     setHistory]     = useState<Message[]>([]);

  const [historyOpen,    setHistoryOpen]    = useState(false);
  const [atmosphereOpen, setAtmosphereOpen] = useState(false);
  const [bgTheme,        setBgTheme]        = useState<BgTheme>("void");
  const [ambientSound,   setAmbientSound]   = useState<AmbientSoundType>("none");

  const { play: playAmbient, stop: stopAmbient } = useAmbientSound();

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

  // Stop ambient sound on unmount
  useEffect(() => () => stopAmbient(), [stopAmbient]);

  const handleSoundChange = (s: AmbientSoundType) => {
    setAmbientSound(s);
    playAmbient(s);
  };

  const charColor = activeChar ? getColor(activeChar.name) : "purple";
  const hsl = COLOR_HSL[charColor];

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
          { role: "user",      content: "[图片]" },
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
    if (!activeChar || history.length === 0) {
      toast({ title: "还没有梦境内容" });
      return;
    }
    const firstUser = history.find(m => m.role === "user")?.content ?? "未命名的梦";
    const title   = firstUser.slice(0, 15) + (firstUser.length > 15 ? "…" : "");
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

  const isSpeaking = !!reply && !isThinking;

  if (!activeChar) {
    return (
      <div className="min-h-screen bg-[#05050A] text-white flex items-center justify-center">
        <motion.div animate={{ opacity: [0.2, 0.6, 0.2] }} transition={{ duration: 2, repeat: Infinity }}
          className="text-white/20 text-xs tracking-[0.3em]">
          正在感应…
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full min-h-screen bg-[#05050A] overflow-hidden relative">

      {/* Ambient background layer */}
      <AmbientBg theme={bgTheme} />

      {/* Character colour bloom */}
      <motion.div
        className="pointer-events-none absolute rounded-full blur-[130px]"
        style={{ width: 380, height: 380, top: -100, left: "50%", x: "-50%", zIndex: 1 }}
        animate={{
          backgroundColor: [`hsl(${hsl} / 0.07)`, `hsl(${hsl} / 0.13)`, `hsl(${hsl} / 0.07)`],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* ── TOP BAR ── */}
      <header className="w-full flex items-center justify-between px-5 py-4 relative z-20 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/dreams">
            <button className="text-white/25 hover:text-white/55 transition-colors">
              <ArrowLeft size={17} />
            </button>
          </Link>
          <div>
            <p className="text-[10px] tracking-[0.22em] text-white/18 uppercase">Dream Space</p>
            {!settings?.hasApiKey && (
              <p className="text-[9px] text-emerald-400/40 tracking-wider">demo</p>
            )}
          </div>
        </div>

        {/* Character tabs */}
        <div className="flex items-center gap-0.5 bg-white/[0.03] rounded-full px-1 py-1">
          {characters?.map(c => {
            const active = activeChar.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => handleTabClick(c.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                  active ? "bg-white/[0.09] text-white/85" : "text-white/25 hover:text-white/50"
                }`}
              >
                {getPrefix(c.name)} {c.name.replace(/[a-zA-Z\s]/g, "")}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleSaveDream}
          className="text-[11px] text-white/20 hover:text-white/50 tracking-wider transition-colors"
        >
          保存
        </button>
      </header>

      {/* ── CENTER SOUL AREA ── */}
      <div className="flex-1 flex flex-col items-center justify-center w-full px-6 gap-5 relative z-10">

        {/* Orb */}
        <CompanionOrb
          size="lg"
          color={charColor}
          isSpeaking={isSpeaking}
          isThinking={isThinking}
          isListening={isListening}
        />

        {/* Name + quote */}
        <div className="flex flex-col items-center gap-1.5 text-center">
          <div className="flex items-center gap-2">
            <span className="text-[19px] font-serif text-white/85 tracking-wide">
              {activeChar.name.replace(/[a-zA-Z]/g, "").trim()}
            </span>
            <span className="text-xs text-white/25 font-sans tracking-[0.15em]">
              {getEnName(activeChar.name)}
            </span>
            <motion.div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: `hsl(${hsl})` }}
              animate={{ opacity: [0.25, 0.9, 0.25] }}
              transition={{ duration: 2.8, repeat: Infinity }}
            />
          </div>
          <p className="text-xs text-white/22 tracking-wide italic">
            {getIdleQuote(activeChar.name)}
          </p>
        </div>

        {/* Waveform */}
        <AudioWaveform
          isActive={isSpeaking}
          isListening={isListening}
          isThinking={isThinking}
          color={charColor}
        />

        {/* ── RESPONSE CARD ── */}
        <div className="w-full max-w-md min-h-[88px] flex items-center justify-center mt-1">
          <AnimatePresence mode="wait">
            {isThinking ? (
              <motion.div key="thinking"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.15, 0.5, 0.15] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.6, repeat: Infinity }}
                className="text-[11px] text-white/22 tracking-[0.28em]"
              >
                正在感应…
              </motion.div>
            ) : reply ? (
              <motion.div key="reply"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full rounded-2xl px-5 py-5 text-center"
                style={{
                  background: `linear-gradient(140deg, hsl(${hsl} / 0.05) 0%, rgba(255,255,255,0.015) 100%)`,
                  border: `1px solid hsl(${hsl} / 0.1)`,
                  boxShadow: `0 2px 32px hsl(${hsl} / 0.05)`,
                }}
              >
                <p className="text-[14px] text-white/75 leading-[1.75] whitespace-pre-wrap">
                  {reply.text}
                </p>
                <p className="mt-3.5 text-[9px] text-white/18 tracking-[0.22em]">
                  {reply.time}
                </p>
              </motion.div>
            ) : (
              <motion.p key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[11px] text-white/16 tracking-[0.18em]"
              >
                轻触麦克风，把那个梦说给我听
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── BOTTOM INPUT ZONE ── */}
      <div className="w-full max-w-md mx-auto px-5 pb-10 pt-3 flex flex-col items-center gap-4 relative z-20 flex-shrink-0">

        {/* Accessory row: text input + image */}
        <div className="w-full flex items-center gap-3">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="或者直接输入文字…"
            className="flex-1 bg-transparent text-sm text-white/50 placeholder:text-white/16
                       focus:outline-none pb-1 transition-colors"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
          />
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
          <button onClick={() => fileInputRef.current?.click()}
            className="text-white/18 hover:text-white/45 transition-colors flex-shrink-0">
            <ImageIcon size={15} />
          </button>
        </div>

        {/* Main row: history | mic | atmosphere */}
        <div className="flex items-center justify-between w-full">

          {/* History button */}
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex flex-col items-center gap-1 text-white/20 hover:text-white/50 transition-colors"
          >
            <ScrollText size={17} />
            {history.length > 0 && (
              <span className="text-[9px] text-white/25 tracking-wider">{history.length}</span>
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
            {isListening
              ? <Square size={22} className="fill-current" />
              : <Mic size={25} />
            }
            {/* Ripple when listening */}
            {isListening && (
              <motion.div
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{ border: `1px solid hsl(${hsl} / 0.4)` }}
                animate={{ scale: [1, 1.55], opacity: [0.5, 0] }}
                transition={{ duration: 1.3, repeat: Infinity, ease: "easeOut" }}
              />
            )}
          </motion.button>

          {/* Atmosphere button */}
          <button
            onClick={() => setAtmosphereOpen(true)}
            className="flex flex-col items-center gap-1 text-white/20 hover:text-white/50 transition-colors"
          >
            <Sparkles size={17} />
            {(bgTheme !== "void" || ambientSound !== "none") && (
              <motion.span
                className="w-1 h-1 rounded-full"
                style={{ backgroundColor: `hsl(${hsl})` }}
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
          </button>
        </div>

        {/* Listening hint */}
        <AnimatePresence>
          {isListening && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              exit={{ opacity: 0 }}
              transition={{ opacity: { duration: 1.2, repeat: Infinity }, y: { duration: 0.2 } }}
              className="text-[11px] text-white/35 tracking-[0.2em] -mt-2"
            >
              正在聆听…
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* ── OVERLAYS ── */}
      <HistoryPanel
        open={historyOpen}
        history={history}
        onClose={() => setHistoryOpen(false)}
        charName={activeChar.name.replace(/[a-zA-Z]/g, "").trim()}
      />

      <AtmospherePanel
        open={atmosphereOpen}
        theme={bgTheme}
        sound={ambientSound}
        onTheme={setBgTheme}
        onSound={handleSoundChange}
        onClose={() => setAtmosphereOpen(false)}
      />
    </div>
  );
}
