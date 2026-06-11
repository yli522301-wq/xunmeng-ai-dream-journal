import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Mic, ImageIcon, Type } from "lucide-react";
import type { ChatMessage, CharKey } from "@/pages/dream-space";

export const DREAMS_STORAGE_KEY = "xm-saved-dreams";

export interface SavedDream {
  id: string;
  title: string;
  createdAt: string;
  activeCharacter: CharKey;
  messages: ChatMessage[];
  summary: string;
  mood: string;
  coverImage?: string;
}

const CHAR_STYLES: Record<string, { name: string; enName: string; hsl: string; dot: string }> = {
  daoshen: { name: "岛深", enName: "Daoshan", hsl: "185 70% 55%", dot: "#6B8CFF" },
  muge:    { name: "暮歌", enName: "Muge",    hsl: "240 70% 65%", dot: "#9B7CFF" },
  anuan:   { name: "阿暖", enName: "Anuan",   hsl: "38 90% 60%",  dot: "#F2A84B" },
};

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  } catch { return ""; }
}

function detectContentTypes(messages: ChatMessage[]) {
  const userMsgs = messages.filter(m => m.role === "user");
  const hasAudio  = userMsgs.some(m => m.type === "audio");
  const hasImage  = userMsgs.some(m => m.type === "image" || !!m.imageUrl);
  const hasText   = userMsgs.some(m => (m.type === "text" || !m.type) && m.content && m.content !== "[图片]");
  return { hasAudio, hasImage, hasText };
}

export default function DreamArchive() {
  const [, setLocation] = useLocation();
  const [dreams, setDreams] = useState<SavedDream[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DREAMS_STORAGE_KEY);
      if (raw) setDreams([...JSON.parse(raw) as SavedDream[]].reverse());
    } catch { /* ignore */ }
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#05050A] text-white flex flex-col relative overflow-x-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.04]"
          style={{ background: "radial-gradient(circle, rgba(107,140,255,1), transparent)" }} />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(circle, rgba(155,124,255,1), transparent)" }} />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-8 pb-2 max-w-xl mx-auto w-full">
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase transition-opacity"
          style={{ color: "rgba(255,255,255,0.25)" }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.65")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          <ArrowLeft size={13} />
          <span>梦境空间</span>
        </button>
        <div className="flex items-center gap-1.5">
          <Sparkles size={12} style={{ color: "rgba(255,255,255,0.10)" }} />
          <span className="text-[10px] tracking-[0.3em]" style={{ color: "rgba(255,255,255,0.10)" }}>
            {dreams.length > 0 ? `${dreams.length} 段梦` : ""}
          </span>
        </div>
      </div>

      {/* Title */}
      <div className="relative z-10 px-6 pt-5 pb-7 max-w-xl mx-auto w-full">
        <h1 className="text-[26px] font-serif tracking-wide" style={{ color: "rgba(255,255,255,0.88)" }}>
          梦之档案
        </h1>
        <p className="mt-1.5 text-[11px] tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.16)" }}>
          每一段被收藏的梦，都不会消散
        </p>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 px-5 pb-16 max-w-xl mx-auto w-full">
        {dreams.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-4">
            {dreams.map((dream, i) => (
              <DreamCard
                key={dream.id}
                dream={dream}
                index={i}
                onClick={() => setLocation(`/archive/${dream.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-7">
      <motion.div
        className="relative w-20 h-20"
        animate={{ y: [0, -7, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="absolute inset-0 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, rgba(107,140,255,0.9), transparent)" }} />
        <div className="absolute inset-3 rounded-full flex items-center justify-center"
          style={{
            background: "radial-gradient(circle at 38% 35%, rgba(107,140,255,0.18), rgba(20,15,50,0.40))",
            border: "1px solid rgba(107,140,255,0.14)",
          }}>
          <Sparkles size={16} style={{ color: "rgba(107,140,255,0.35)" }} />
        </div>
      </motion.div>
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-[13px] tracking-wide" style={{ color: "rgba(255,255,255,0.25)" }}>
          你还没有收藏任何梦
        </p>
        <p className="text-[10px] tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.10)" }}>
          第一段被你留下的梦，会出现在这里
        </p>
      </div>
    </div>
  );
}

function DreamCard({
  dream, index, onClick,
}: {
  dream: SavedDream;
  index: number;
  onClick: () => void;
}) {
  const cs = CHAR_STYLES[dream.activeCharacter] ?? CHAR_STYLES.daoshen;
  const hasCover = !!dream.coverImage;
  const { hasAudio, hasImage, hasText } = detectContentTypes(dream.messages);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.07, ease: "easeOut" }}
      onClick={onClick}
      className="group relative rounded-3xl overflow-hidden cursor-pointer select-none"
      style={{
        border: `1px solid hsl(${cs.hsl} / 0.12)`,
        boxShadow: `0 2px 20px hsl(${cs.hsl} / 0.04)`,
      }}
      whileHover={{ scale: 1.01, transition: { duration: 0.18 } }}
      whileTap={{ scale: 0.985 }}
    >
      {/* ── Cover area ── */}
      <div className="relative h-40 overflow-hidden">
        {hasCover ? (
          <>
            <img
              src={dream.coverImage}
              alt=""
              className="w-full h-full object-cover"
              style={{ filter: "brightness(0.58) saturate(0.85)" }}
            />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(to bottom, rgba(5,5,10,0.25) 0%, rgba(5,5,10,0.88) 100%)" }}
            />
          </>
        ) : (
          <div
            className="w-full h-full relative"
            style={{ background: `linear-gradient(140deg, hsl(${cs.hsl} / 0.14) 0%, rgba(5,5,10,1) 70%)` }}
          >
            {/* Audio visual element when no image but has audio */}
            {hasAudio && !hasImage && (
              <div className="absolute inset-0 flex items-center justify-center opacity-10">
                <div className="flex items-end gap-1.5" style={{ height: 40 }}>
                  {[6, 14, 9, 20, 12, 18, 8, 16, 10, 22, 8, 15, 6].map((h, i) => (
                    <div
                      key={i}
                      className="w-1.5 rounded-full"
                      style={{
                        height: h,
                        background: `hsl(${cs.hsl})`,
                        opacity: 0.6 + (i % 3) * 0.15,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div
              className="absolute top-2 right-4 w-32 h-32 rounded-full opacity-25"
              style={{ background: `radial-gradient(circle at 40% 38%, hsl(${cs.hsl} / 0.55), transparent 62%)` }}
            />
            <div
              className="absolute top-7 right-10 w-16 h-16 rounded-full"
              style={{
                background: `radial-gradient(circle at 38% 35%, hsl(${cs.hsl} / 0.18), transparent)`,
                border: `1px solid hsl(${cs.hsl} / 0.16)`,
              }}
            />
          </div>
        )}

        {/* Character badge */}
        <div className="absolute top-3.5 left-4 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cs.dot }} />
          <span className="text-[10px] tracking-[0.18em]" style={{ color: cs.dot, opacity: 0.88 }}>
            {cs.name}
          </span>
          <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.20)" }}>{cs.enName}</span>
        </div>

        {/* Content type icons */}
        <div className="absolute top-3.5 right-4 flex items-center gap-1.5">
          {hasAudio && (
            <div className="w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: `hsl(${cs.hsl} / 0.15)`, border: `1px solid hsl(${cs.hsl} / 0.20)` }}>
              <Mic size={9} style={{ color: `hsl(${cs.hsl})` }} />
            </div>
          )}
          {hasImage && (
            <div className="w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: `hsl(${cs.hsl} / 0.15)`, border: `1px solid hsl(${cs.hsl} / 0.20)` }}>
              <ImageIcon size={9} style={{ color: `hsl(${cs.hsl})` }} />
            </div>
          )}
          {hasText && !hasAudio && !hasImage && (
            <div className="w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Type size={9} style={{ color: "rgba(255,255,255,0.30)" }} />
            </div>
          )}
          {/* Date */}
          <span className="text-[9px] tabular-nums" style={{ color: "rgba(255,255,255,0.20)" }}>
            {formatDate(dream.createdAt)}
          </span>
        </div>
      </div>

      {/* ── Text content ── */}
      <div
        className="relative px-5 py-4"
        style={{ background: "linear-gradient(to bottom, rgba(5,5,10,0.96), rgba(8,8,16,0.99))" }}
      >
        <div
          className="absolute left-0 top-4 bottom-4 w-[2px] rounded-r-full"
          style={{ background: `linear-gradient(to bottom, hsl(${cs.hsl} / 0.55), transparent)` }}
        />
        <h3
          className="text-[15px] font-serif tracking-wide mb-1.5 pr-6 leading-snug"
          style={{ color: "rgba(255,255,255,0.84)" }}
        >
          {dream.title}
        </h3>
        <p
          className="text-[12px] leading-relaxed"
          style={{
            color: "rgba(255,255,255,0.30)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          } as React.CSSProperties}
        >
          {dream.summary}
        </p>
        <div
          className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ color: `hsl(${cs.hsl})` }}
        >
          <span className="text-[13px]">→</span>
        </div>
      </div>

      {/* Hover border glow */}
      <div
        className="absolute inset-0 rounded-3xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ boxShadow: `inset 0 0 0 1px hsl(${cs.hsl} / 0.22)` }}
      />
    </motion.div>
  );
}
