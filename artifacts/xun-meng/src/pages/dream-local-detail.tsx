import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Trash2 } from "lucide-react";
import type { ChatMessage } from "@/pages/dream-space";
import { DREAMS_STORAGE_KEY, type SavedDream } from "@/pages/dream-archive";

const CHAR_STYLES: Record<string, { name: string; enName: string; hsl: string; dot: string }> = {
  daoshen: { name: "岛深", enName: "Daoshan", hsl: "185 70% 55%", dot: "#6B8CFF" },
  muge:    { name: "暮歌", enName: "Muge",    hsl: "240 70% 65%", dot: "#9B7CFF" },
  anuan:   { name: "阿暖", enName: "Anuan",   hsl: "38 90% 60%",  dot: "#F2A84B" },
};

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 · ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  } catch { return ""; }
}

export default function DreamLocalDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const [dream, setDream] = useState<SavedDream | null | undefined>(undefined);
  const id = (params as { id: string }).id;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DREAMS_STORAGE_KEY);
      if (raw) {
        const all = JSON.parse(raw) as SavedDream[];
        setDream(all.find(d => d.id === id) ?? null);
      } else {
        setDream(null);
      }
    } catch {
      setDream(null);
    }
  }, [id]);

  const handleDelete = () => {
    if (!window.confirm("确定要删除这段梦吗？")) return;
    try {
      const raw = localStorage.getItem(DREAMS_STORAGE_KEY);
      const all = raw ? (JSON.parse(raw) as SavedDream[]) : [];
      localStorage.setItem(DREAMS_STORAGE_KEY, JSON.stringify(all.filter(d => d.id !== id)));
    } catch { /* ignore */ }
    setLocation("/archive");
  };

  if (dream === undefined) {
    return (
      <div className="min-h-screen bg-[#05050A] text-white flex items-center justify-center">
        <motion.div
          animate={{ opacity: [0.15, 0.5, 0.15] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-[11px] tracking-[0.3em]"
          style={{ color: "rgba(255,255,255,0.3)" }}
        >
          正在感应…
        </motion.div>
      </div>
    );
  }

  if (!dream) {
    return (
      <div className="min-h-screen bg-[#05050A] text-white flex flex-col items-center justify-center gap-5">
        <p className="text-[13px] tracking-wide" style={{ color: "rgba(255,255,255,0.25)" }}>
          梦境已消散，或者从未存在过。
        </p>
        <button
          onClick={() => setLocation("/archive")}
          className="text-[11px] tracking-[0.2em] flex items-center gap-2 transition-opacity"
          style={{ color: "rgba(255,255,255,0.20)" }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.6")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          <ArrowLeft size={12} />
          返回档案
        </button>
      </div>
    );
  }

  const cs = CHAR_STYLES[dream.activeCharacter] ?? CHAR_STYLES.daoshen;

  return (
    <div className="min-h-screen w-full bg-[#05050A] text-white flex flex-col relative">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[520px] h-[280px] rounded-full opacity-[0.055]"
          style={{ background: `radial-gradient(circle, hsl(${cs.hsl}), transparent)` }}
        />
      </div>

      {/* ── Header ── */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-8 pb-4 max-w-xl mx-auto w-full">
        <button
          onClick={() => setLocation("/archive")}
          className="flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase transition-opacity"
          style={{ color: "rgba(255,255,255,0.22)" }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.65")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          <ArrowLeft size={13} />
          <span>梦之档案</span>
        </button>
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 text-[10px] tracking-wider transition-opacity"
          style={{ color: "rgba(255,90,90,0.28)" }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.75")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          <Trash2 size={12} />
          <span>删除</span>
        </button>
      </div>

      {/* ── Hero: cover image or gradient ── */}
      <div className="relative z-10 mx-auto w-full max-w-xl px-5 mb-5">
        {dream.coverImage ? (
          <div className="rounded-3xl overflow-hidden h-56 relative">
            <img
              src={dream.coverImage}
              alt=""
              className="w-full h-full object-cover"
              style={{ filter: "brightness(0.58) saturate(0.82)" }}
            />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(to bottom, transparent 35%, rgba(5,5,10,0.96) 100%)" }}
            />
            <HeroText dream={dream} cs={cs} />
          </div>
        ) : (
          <div
            className="rounded-3xl overflow-hidden h-44 relative"
            style={{
              background: `linear-gradient(140deg, hsl(${cs.hsl} / 0.14) 0%, rgba(5,5,10,1) 80%)`,
            }}
          >
            {/* Decorative orb */}
            <div
              className="absolute top-3 right-6 w-28 h-28 rounded-full opacity-20"
              style={{ background: `radial-gradient(circle at 40% 38%, hsl(${cs.hsl} / 0.6), transparent 62%)` }}
            />
            <div
              className="absolute top-8 right-12 w-14 h-14 rounded-full"
              style={{
                background: `radial-gradient(circle at 38% 35%, hsl(${cs.hsl} / 0.20), transparent)`,
                border: `1px solid hsl(${cs.hsl} / 0.16)`,
              }}
            />
            <HeroText dream={dream} cs={cs} />
          </div>
        )}
      </div>

      {/* ── Character badge ── */}
      <div className="relative z-10 px-5 mb-6 max-w-xl mx-auto w-full">
        <div
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full"
          style={{
            background: `hsl(${cs.hsl} / 0.07)`,
            border: `1px solid hsl(${cs.hsl} / 0.18)`,
          }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cs.dot }} />
          <span className="text-[11px] tracking-[0.14em]" style={{ color: cs.dot }}>
            {cs.name}
          </span>
          <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.18)" }}>·</span>
          <span className="text-[10px] tracking-wide" style={{ color: "rgba(255,255,255,0.28)" }}>
            {cs.enName}
          </span>
        </div>
      </div>

      {/* ── Chat history ── */}
      <div className="relative z-10 px-5 pb-16 max-w-xl mx-auto w-full flex flex-col gap-3.5">
        {dream.messages.map((msg, i) => (
          <ChatBubble
            key={msg.id ?? i}
            msg={msg}
            activeCharacter={dream.activeCharacter}
            cs={cs}
          />
        ))}
      </div>
    </div>
  );
}

function HeroText({
  dream,
  cs,
}: {
  dream: SavedDream;
  cs: { hsl: string; dot: string; name: string };
}) {
  return (
    <div className="absolute bottom-0 left-0 right-0 px-6 pb-5">
      <h1
        className="text-[21px] font-serif tracking-wide leading-snug"
        style={{ color: "rgba(255,255,255,0.90)" }}
      >
        {dream.title}
      </h1>
      <p className="mt-1 text-[10px] tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.28)" }}>
        {formatDate(dream.createdAt)}
      </p>
    </div>
  );
}

function ChatBubble({
  msg,
  activeCharacter,
  cs,
}: {
  msg: ChatMessage;
  activeCharacter: string;
  cs: { hsl: string; dot: string; name: string; enName: string };
}) {
  if (msg.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.24 }}
        className="flex justify-end"
      >
        <div
          className="max-w-[78%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-[13px] leading-relaxed"
          style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.68)" }}
        >
          {msg.imageUrl && (
            <img
              src={msg.imageUrl}
              alt="图片"
              className="rounded-xl max-w-full mb-2"
              style={{ maxHeight: "160px", objectFit: "cover", display: "block" }}
            />
          )}
          {msg.content !== "[图片]" && (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          )}
          <p
            className="mt-1 text-[9px] tracking-wider text-right"
            style={{ color: "rgba(255,255,255,0.16)" }}
          >
            {msg.timestamp}
          </p>
        </div>
      </motion.div>
    );
  }

  const roleKey = msg.role as string;
  const charStyle = CHAR_STYLES[roleKey] ?? cs;
  const isActive = roleKey === activeCharacter;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.24 }}
      className="flex justify-start gap-2.5 items-start"
      style={{ opacity: isActive ? 1 : 0.55 }}
    >
      {/* Mini orb */}
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
        style={{
          background: `radial-gradient(circle at 38% 35%, hsl(${charStyle.hsl} / 0.35), hsl(${charStyle.hsl} / 0.08))`,
          border: `1px solid hsl(${charStyle.hsl} / 0.20)`,
        }}
      >
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: charStyle.dot, opacity: 0.65 }}
        />
      </div>

      <div className="max-w-[78%] flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 px-0.5">
          <span className="text-[10px] font-medium" style={{ color: charStyle.dot }}>
            {charStyle.name}
          </span>
          <span className="text-[9px] tracking-wider" style={{ color: "rgba(255,255,255,0.18)" }}>
            {charStyle.enName}
          </span>
        </div>
        <div
          className="rounded-2xl rounded-tl-sm px-4 py-2.5 text-[13px] leading-relaxed"
          style={{
            background: `linear-gradient(135deg, hsl(${charStyle.hsl} / 0.08) 0%, rgba(255,255,255,0.016) 100%)`,
            border: `1px solid hsl(${charStyle.hsl} / 0.18)`,
            color: "rgba(255,255,255,0.60)",
          }}
        >
          <p className="whitespace-pre-wrap">{msg.content}</p>
          <p
            className="mt-1 text-[9px] tracking-wider"
            style={{ color: "rgba(255,255,255,0.16)" }}
          >
            {msg.timestamp}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
