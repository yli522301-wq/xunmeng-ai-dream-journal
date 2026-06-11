import { useState, useRef, useEffect } from "react";
import {
  useGetActiveCharacter, useListCharacters, useActivateCharacter,
  useGetAiSettings, useAiChat, useCreateDream, useAiRecognizeImage,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { ArrowLeft, Mic, Square, Image as ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { CompanionOrb, CompanionColor } from "@/components/companion-orb";
import { AudioWaveform } from "@/components/audio-waveform";

const CHIPS = [
  "小时候的自己在招手",
  "被一种光追着跑",
  "站在楼顶往下看",
  "一条没有尽头的走廊",
];

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
  if (name.includes("阿暖")) return "正在静静听你梦里的风";
  if (name.includes("暮歌")) return "等你告诉它你刚醒来看见了什么";
  if (name.includes("岛深")) return "帮你梳理那些混沌的线索";
  return "在等你说那个梦";
}

const COLOR_HSL: Record<CompanionColor, string> = {
  amber:  "38 90% 60%",
  indigo: "240 70% 65%",
  teal:   "185 70% 55%",
  purple: "255 90% 70%",
};

export default function DreamSpace() {
  const { toast } = useToast();

  const { data: activeChar, refetch: refetchActive } = useGetActiveCharacter();
  const { data: characters } = useListCharacters();
  const { data: settings } = useGetAiSettings();
  const activateMutation  = useActivateCharacter();
  const chatMutation      = useAiChat();
  const createDreamMutation = useCreateDream();
  const recognizeMutation = useAiRecognizeImage();

  const [reply, setReply]   = useState<{ text: string; time: string } | null>(null);
  const [inputText, setInputText]   = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isThinking,  setIsThinking]  = useState(false);
  const [history, setHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);

  const fileInputRef  = useRef<HTMLInputElement>(null);
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

    const newHistory = [...history, { role: "user" as const, content: msg }];
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
        data: {
          title, content, mood: "calm", clarity: "moderate", isRecurring: false,
          companionReply: reply?.text,
          characterId: activeChar.id,
        },
      });
      toast({ title: "已保存到梦境手账" });
    } catch {
      toast({ title: "保存失败", variant: "destructive" });
    }
  };

  if (!activeChar) {
    return (
      <div className="min-h-screen bg-[#05050A] text-white flex items-center justify-center">
        <motion.div animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 2, repeat: Infinity }}
          className="text-white/30 text-sm tracking-widest">
          正在感应...
        </motion.div>
      </div>
    );
  }

  const isSpeaking = !!reply && !isThinking;

  return (
    <div className="flex flex-col items-center w-full min-h-screen bg-[#05050A] overflow-hidden relative">

      {/* Ambient color bloom — changes with character */}
      <motion.div
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 rounded-full blur-[120px]"
        style={{ width: 400, height: 400, top: -80 }}
        animate={{ backgroundColor: [`hsl(${hsl} / 0.07)`, `hsl(${hsl} / 0.12)`, `hsl(${hsl} / 0.07)`] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* ── TOP BAR ── */}
      <header className="w-full flex items-center justify-between px-5 py-4 relative z-30">
        {/* Left */}
        <div className="flex items-center gap-3">
          <Link href="/dreams">
            <button className="text-white/30 hover:text-white/60 transition-colors">
              <ArrowLeft size={18} />
            </button>
          </Link>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] tracking-[0.2em] text-white/25 uppercase font-sans">
              Dream Space
            </span>
            {!settings?.hasApiKey && (
              <span className="text-[9px] text-green-400/50">demo</span>
            )}
          </div>
        </div>

        {/* Center — character tabs */}
        <div className="flex items-center gap-1 bg-white/[0.04] rounded-full px-1.5 py-1">
          {characters?.map(c => {
            const active = activeChar.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => handleTabClick(c.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/30 hover:text-white/55"
                }`}
              >
                {getPrefix(c.name)} {c.name.replace(/[a-zA-Z\s]/g, "")}
              </button>
            );
          })}
        </div>

        {/* Right */}
        <button
          onClick={handleSaveDream}
          className="text-[11px] text-white/25 hover:text-white/55 tracking-wider transition-colors"
        >
          保存
        </button>
      </header>

      {/* ── CENTER ── */}
      <div className="flex-1 flex flex-col items-center justify-center w-full px-6 gap-6 relative z-20 mt-2">

        {/* Orb */}
        <CompanionOrb
          size="lg"
          color={charColor}
          isSpeaking={isSpeaking}
          isThinking={isThinking}
          isListening={isListening}
        />

        {/* Name + quote */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-2.5">
            <span className="text-xl font-serif text-white/90 tracking-wide">
              {activeChar.name.replace(/[a-zA-Z]/g, "").trim()}
            </span>
            <span className="text-sm text-white/30 font-sans tracking-widest">
              {getEnName(activeChar.name)}
            </span>
            <motion.div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: `hsl(${hsl})` }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            />
          </div>
          <p className="text-xs text-white/30 italic tracking-wide">
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
        <div className="w-full max-w-md min-h-[100px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            {isThinking ? (
              <motion.div
                key="thinking"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.2, 0.6, 0.2] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.4, repeat: Infinity }}
                className="text-xs text-white/25 tracking-[0.25em]"
              >
                正在感应…
              </motion.div>
            ) : reply ? (
              <motion.div
                key="reply"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className="w-full rounded-2xl px-6 py-5 text-center"
                style={{
                  background: `linear-gradient(135deg, hsl(${hsl} / 0.05) 0%, rgba(255,255,255,0.02) 100%)`,
                  border: `1px solid hsl(${hsl} / 0.12)`,
                  boxShadow: `0 4px 40px hsl(${hsl} / 0.06)`,
                }}
              >
                <p className="text-[15px] text-white/80 leading-relaxed whitespace-pre-wrap">
                  {reply.text}
                </p>
                <p className="mt-4 text-[10px] text-white/20 tracking-[0.2em]">
                  {reply.time}
                </p>
              </motion.div>
            ) : (
              <motion.p
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs text-white/18 tracking-[0.2em]"
              >
                轻触麦克风，说一个刚醒来还没散掉的梦
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* ── CHIPS ── */}
        <div className="flex flex-wrap justify-center gap-2">
          {CHIPS.map((chip, i) => (
            <motion.button
              key={i}
              onClick={() => handleSend(chip)}
              className="px-4 py-1.5 rounded-full text-xs text-white/30 transition-all"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}
              whileHover={{
                color: "rgba(255,255,255,0.65)",
                borderColor: `hsl(${hsl} / 0.3)`,
                boxShadow: `0 0 12px hsl(${hsl} / 0.12)`,
              }}
            >
              {chip}
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── BOTTOM INPUT ── */}
      <div className="w-full max-w-md mx-auto px-5 pb-10 pt-4 flex flex-col items-center gap-5 relative z-30">

        {/* Text + image row */}
        <div className="w-full flex items-center gap-3">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="也可以输入…"
            className="flex-1 bg-transparent text-sm text-white/55 placeholder:text-white/18
                       border-0 border-b focus:outline-none focus:border-white/20 transition-colors pb-1"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
          />
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-white/20 hover:text-white/50 transition-colors flex-shrink-0"
          >
            <ImageIcon size={16} />
          </button>
        </div>

        {/* Mic — hero button */}
        <motion.button
          onClick={toggleMic}
          className="relative flex items-center justify-center rounded-full flex-shrink-0"
          style={{
            width: 72, height: 72,
            backgroundColor: `hsl(${hsl} / ${isListening ? 0.85 : 0.14})`,
            boxShadow: isListening
              ? `0 0 0 8px hsl(${hsl} / 0.12), 0 0 40px hsl(${hsl} / 0.35)`
              : `0 0 0 1px hsl(${hsl} / 0.2)`,
            color: isListening ? "#fff" : `hsl(${hsl})`,
          }}
          animate={isListening ? { scale: [1, 1.06, 1] } : { scale: 1 }}
          transition={isListening ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" } : {}}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
        >
          {isListening ? <Square size={24} className="fill-current" /> : <Mic size={26} />}

          {isListening && (
            <motion.div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{ border: `1px solid hsl(${hsl} / 0.4)` }}
              animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
            />
          )}
        </motion.button>

        {isListening && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.4, 0.9, 0.4] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="text-xs text-white/40 tracking-widest -mt-2"
          >
            正在聆听…
          </motion.p>
        )}
      </div>
    </div>
  );
}
