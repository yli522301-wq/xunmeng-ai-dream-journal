import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Sparkles, Mic, ImageIcon, CalendarDays,
  ChevronLeft, ChevronRight, X,
} from "lucide-react";
import type { ChatMessage, CharKey } from "@/pages/dream-space";
// @ts-ignore — JSX component, handled by Vite
import CircularGallery from "@/components/CircularGallery.jsx";

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

// ── Constants ───────────────────────────────────────────────────────────────
const CS: Record<string, { name: string; enName: string; hsl: string; dot: string }> = {
  daoshen: { name: "岛深", enName: "Daoshan", hsl: "185 70% 55%", dot: "#6B8CFF" },
  muge:    { name: "暮歌", enName: "Muge",    hsl: "240 70% 65%", dot: "#9B7CFF" },
  anuan:   { name: "阿暖", enName: "Anuan",   hsl: "38 90% 60%",  dot: "#F2A84B" },
};

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

// ── Helpers ─────────────────────────────────────────────────────────────────
function toDateKey(iso: string) { return iso.slice(0, 10); }

function fmtArchiveDate(iso: string) {
  try {
    const d = new Date(iso);
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return { date: `${yy}.${mm}.${dd}`, time: `${hh}:${mi}` };
  } catch { return { date: "", time: "" }; }
}

function fmtGroupLabel(dateKey: string) {
  try {
    const [y, m, d] = dateKey.split("-").map(Number);
    const weekNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const wd = new Date(y, m - 1, d).getDay();
    return `${y}年${m}月${d}日  ${weekNames[wd]}`;
  } catch { return dateKey; }
}

function detectTypes(messages: ChatMessage[]) {
  const u = messages.filter(m => m.role === "user");
  return {
    hasAudio: u.some(m => m.type === "audio"),
    hasImage: u.some(m => m.type === "image" || !!m.imageUrl),
  };
}

type CardVariant = "large" | "medium" | "compact";

function getVariant(dream: SavedDream): CardVariant {
  if (dream.coverImage) return "large";
  const { hasAudio } = detectTypes(dream.messages);
  if (hasAudio) return "medium";
  if (dream.summary.length < 45) return "compact";
  return "medium";
}

function getDaysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate(); }
function getFirstWeekday(y: number, m: number) { return new Date(y, m - 1, 1).getDay(); }

// ── 3-D tilt hook ────────────────────────────────────────────────────────────
function useTilt(intensity = 6) {
  const [t, setT] = useState({ x: 0, y: 0 });
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const cx = (e.clientX - r.left) / r.width - 0.5;
    const cy = (e.clientY - r.top) / r.height - 0.5;
    setT({ x: -cy * intensity, y: cx * (intensity * 1.2) });
  }, [intensity]);
  const onMouseLeave = useCallback(() => setT({ x: 0, y: 0 }), []);
  const style: React.CSSProperties = {
    transform: `perspective(700px) rotateX(${t.x}deg) rotateY(${t.y}deg)`,
    transition: "transform 0.18s ease",
  };
  return { onMouseMove, onMouseLeave, tiltStyle: style };
}

// ── Calendar Panel — fixed centered modal ────────────────────────────────────
function CalendarPanel({
  dreamsByDate,
  selectedDate,
  onSelect,
  onClose,
}: {
  dreamsByDate: Record<string, SavedDream[]>;
  selectedDate: string | null;
  onSelect: (d: string | null) => void;
  onClose: () => void;
}) {
  const today = new Date();
  const [cal, setCal] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 });

  const prev = () => setCal(c => c.month === 1 ? { year: c.year - 1, month: 12 } : { ...c, month: c.month - 1 });
  const next = () => setCal(c => c.month === 12 ? { year: c.year + 1, month: 1 } : { ...c, month: c.month + 1 });

  const totalDays = getDaysInMonth(cal.year, cal.month);
  const firstWd   = getFirstWeekday(cal.year, cal.month);
  const cells: (number | null)[] = [
    ...Array(firstWd).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
      />

      {/* Calendar card — centered on screen */}
      <motion.div
        className="fixed z-50"
        style={{ top: "50%", left: "50%", x: "-50%", y: "-50%", width: "min(340px, 92vw)" }}
        initial={{ opacity: 0, scale: 0.94, y: "-46%" }}
        animate={{ opacity: 1, scale: 1, y: "-50%" }}
        exit={{ opacity: 0, scale: 0.95, y: "-46%" }}
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(8,8,20,0.98)",
            border: "1px solid rgba(255,255,255,0.09)",
            backdropFilter: "blur(40px)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.70), 0 0 0 1px rgba(107,140,255,0.06)",
          }}
        >
          {/* Month nav */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <button onClick={prev}
              className="w-8 h-8 flex items-center justify-center rounded-full"
              style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.40)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}>
              <ChevronLeft size={15} />
            </button>
            <span className="text-[14px] tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.75)" }}>
              {cal.year}年{cal.month}月
            </span>
            <button onClick={next}
              className="w-8 h-8 flex items-center justify-center rounded-full"
              style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.40)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}>
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 px-3 pb-1">
            {WEEKDAYS.map(w => (
              <div key={w} className="text-center text-[10px] tracking-widest py-1"
                style={{ color: "rgba(255,255,255,0.22)" }}>
                {w}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 px-3 pb-4 gap-y-1">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const key = `${cal.year}-${String(cal.month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const dreams    = dreamsByDate[key] ?? [];
              const hasDreams = dreams.length > 0;
              const isToday   = key === todayStr;
              const isSel     = key === selectedDate;
              const dots = [...new Set(dreams.map(d => CS[d.activeCharacter]?.dot ?? "#fff"))].slice(0, 3);

              return (
                <motion.button key={`${cal.year}-${cal.month}-${day}`}
                  onClick={() => onSelect(isSel ? null : key)}
                  className="flex flex-col items-center justify-center py-1.5 rounded-xl"
                  style={{
                    background: isSel ? "rgba(107,140,255,0.20)" : "transparent",
                    border: isSel ? "1px solid rgba(107,140,255,0.35)" : isToday ? "1px solid rgba(255,255,255,0.12)" : "1px solid transparent",
                  }}
                  whileHover={{ background: hasDreams ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)" }}
                  whileTap={{ scale: 0.90 }}>
                  <span className="text-[12px] tabular-nums leading-none"
                    style={{
                      color: isSel ? "rgba(130,160,255,0.95)" : isToday ? "rgba(255,255,255,0.85)" : hasDreams ? "rgba(255,255,255,0.60)" : "rgba(255,255,255,0.22)",
                      fontWeight: isSel || isToday ? 600 : 400,
                    }}>
                    {day}
                  </span>
                  {hasDreams ? (
                    <div className="flex gap-[3px] mt-[3px]">
                      {dots.map((c, di) => (
                        <motion.div key={di} className="w-[4px] h-[4px] rounded-full"
                          style={{ backgroundColor: c }}
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 2.2 + di * 0.3, repeat: Infinity, delay: di * 0.2 }} />
                      ))}
                    </div>
                  ) : <div className="h-[7px]" />}
                </motion.button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-center gap-3 pb-4 pt-1 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            {selectedDate && (
              <button onClick={() => { onSelect(null); onClose(); }}
                className="text-[10px] tracking-wide flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-opacity"
                style={{ background: "rgba(107,140,255,0.10)", border: "1px solid rgba(107,140,255,0.18)", color: "rgba(107,140,255,0.70)" }}
                onMouseEnter={e => (e.currentTarget.style.opacity="0.75")}
                onMouseLeave={e => (e.currentTarget.style.opacity="1")}>
                <Sparkles size={9} />全部梦境
              </button>
            )}
            <button onClick={onClose}
              className="text-[10px] tracking-wide px-3 py-1.5 rounded-full"
              style={{ color: "rgba(255,255,255,0.20)" }}
              onMouseEnter={e => (e.currentTarget.style.opacity="0.6")}
              onMouseLeave={e => (e.currentTarget.style.opacity="1")}>
              关闭
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ── Date group header ─────────────────────────────────────────────────────────
function DateGroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-3 mt-8 mb-3 first:mt-0">
      <span className="text-[10px] tracking-[0.22em] flex-shrink-0"
        style={{ color: "rgba(255,255,255,0.28)" }}>
        {label}
      </span>
      <div className="h-px flex-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
      <span className="text-[9px] flex-shrink-0 tabular-nums" style={{ color: "rgba(255,255,255,0.16)" }}>
        {count}段
      </span>
    </div>
  );
}

// ── Large card ────────────────────────────────────────────────────────────────
function LargeCard({ dream, index, onClick }: { dream: SavedDream; index: number; onClick: () => void }) {
  const cs = CS[dream.activeCharacter] ?? CS.daoshen;
  const { hasAudio, hasImage } = detectTypes(dream.messages);
  const { date, time } = fmtArchiveDate(dream.createdAt);
  const { onMouseMove, onMouseLeave, tiltStyle } = useTilt(4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.48, delay: index * 0.06, ease: [0.23, 1, 0.32, 1] }}
      onClick={onClick}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={tiltStyle}
      className="group relative rounded-3xl overflow-hidden cursor-pointer select-none"
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.985 }}
    >
      {/* Image cover */}
      <div className="relative h-52 overflow-hidden">
        <img src={dream.coverImage} alt="" className="w-full h-full object-cover"
          style={{ filter: "brightness(0.52) saturate(0.80)" }} />
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, rgba(5,5,10,0.15) 0%, rgba(5,5,10,0.92) 100%)" }} />

        {/* Character badge */}
        <div className="absolute top-4 left-4 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cs.dot }} />
          <span className="text-[10px] tracking-[0.16em]" style={{ color: cs.dot, opacity: 0.90 }}>{cs.name}</span>
          <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.25)" }}>{cs.enName}</span>
        </div>

        {/* Date + icons top-right */}
        <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
          <span className="text-[10px] tabular-nums font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>{date}</span>
          <span className="text-[9px] tabular-nums" style={{ color: "rgba(255,255,255,0.30)" }}>{time}</span>
          <div className="flex gap-1.5 mt-0.5">
            {hasAudio && <Mic size={9} style={{ color: `hsl(${cs.hsl} / 0.65)` }} />}
            {hasImage && <ImageIcon size={9} style={{ color: `hsl(${cs.hsl} / 0.65)` }} />}
          </div>
        </div>

        {/* Title overlaid at bottom of image */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
          <h3 className="text-[18px] font-serif tracking-wide leading-snug"
            style={{ color: "rgba(255,255,255,0.90)" }}>
            {dream.title}
          </h3>
        </div>
      </div>

      {/* Summary */}
      <div className="relative px-5 py-3.5"
        style={{ background: "linear-gradient(to bottom, rgba(5,5,10,0.96), rgba(8,8,16,0.99))" }}>
        <div className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full"
          style={{ background: `linear-gradient(to bottom, hsl(${cs.hsl} / 0.50), transparent)` }} />
        <p className="text-[12px] leading-relaxed"
          style={{
            color: "rgba(255,255,255,0.32)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          } as React.CSSProperties}>
          {dream.summary}
        </p>
      </div>

      {/* Hover border glow */}
      <div className="absolute inset-0 rounded-3xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ boxShadow: `inset 0 0 0 1px hsl(${cs.hsl} / 0.28)` }} />
    </motion.div>
  );
}

// ── Medium card ───────────────────────────────────────────────────────────────
function MediumCard({ dream, index, onClick }: { dream: SavedDream; index: number; onClick: () => void }) {
  const cs = CS[dream.activeCharacter] ?? CS.daoshen;
  const { hasAudio } = detectTypes(dream.messages);
  const { date, time } = fmtArchiveDate(dream.createdAt);
  const { onMouseMove, onMouseLeave, tiltStyle } = useTilt(5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.44, delay: index * 0.055, ease: [0.23, 1, 0.32, 1] }}
      onClick={onClick}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={tiltStyle}
      className="group relative rounded-3xl overflow-hidden cursor-pointer select-none"
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.985 }}
    >
      {/* Gradient cover */}
      <div className="relative h-28 overflow-hidden"
        style={{ background: `linear-gradient(140deg, hsl(${cs.hsl} / 0.16) 0%, rgba(5,5,10,0.95) 72%)` }}>
        {/* Ambient orb */}
        <motion.div
          className="absolute top-2 right-8 w-24 h-24 rounded-full opacity-[0.22]"
          style={{ background: `radial-gradient(circle at 40% 38%, hsl(${cs.hsl} / 0.7), transparent 62%)` }}
          animate={{ scale: [1, 1.05, 1], opacity: [0.20, 0.28, 0.20] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} />

        {/* Audio waveform decoration */}
        {hasAudio && (
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.12]">
            <div className="flex items-end gap-1.5" style={{ height: 36 }}>
              {[5,13,8,18,11,20,7,15,9,19,7,13,5].map((h, i) => (
                <motion.div key={i} className="w-[2px] rounded-full flex-shrink-0"
                  style={{ height: h, background: `hsl(${cs.hsl})` }}
                  animate={{ height: [h, h * 0.4, h * 1.3, h * 0.6, h] }}
                  transition={{ duration: 1.8 + i * 0.12, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 }} />
              ))}
            </div>
          </div>
        )}

        {/* Left: character badge */}
        <div className="absolute top-4 left-4 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cs.dot }} />
          <span className="text-[10px] tracking-[0.14em]" style={{ color: cs.dot, opacity: 0.88 }}>{cs.name}</span>
        </div>

        {/* Right: date */}
        <div className="absolute top-4 right-4 text-right">
          <div className="text-[10px] tabular-nums" style={{ color: "rgba(255,255,255,0.40)" }}>{date}</div>
          <div className="text-[9px] tabular-nums" style={{ color: "rgba(255,255,255,0.22)" }}>{time}</div>
        </div>

        {/* Bottom title */}
        <div className="absolute bottom-0 left-4 right-4 pb-2.5">
          <h3 className="text-[15px] font-serif tracking-wide leading-snug"
            style={{ color: "rgba(255,255,255,0.85)" }}>
            {dream.title}
          </h3>
        </div>
      </div>

      {/* Summary */}
      <div className="relative px-4 py-3"
        style={{ background: "rgba(8,8,18,0.98)" }}>
        <div className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full"
          style={{ background: `linear-gradient(to bottom, hsl(${cs.hsl} / 0.40), transparent)` }} />
        <p className="text-[11px] leading-relaxed"
          style={{
            color: "rgba(255,255,255,0.28)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          } as React.CSSProperties}>
          {dream.summary}
        </p>
        {/* Icons row */}
        <div className="flex items-center gap-1.5 mt-2">
          {hasAudio && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
              style={{ background: `hsl(${cs.hsl} / 0.10)`, border: `1px solid hsl(${cs.hsl} / 0.15)` }}>
              <Mic size={8} style={{ color: `hsl(${cs.hsl} / 0.70)` }} />
              <span className="text-[9px]" style={{ color: `hsl(${cs.hsl} / 0.55)` }}>语音</span>
            </div>
          )}
        </div>
      </div>

      <div className="absolute inset-0 rounded-3xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ boxShadow: `inset 0 0 0 1px hsl(${cs.hsl} / 0.22)` }} />
    </motion.div>
  );
}

// ── Compact card ──────────────────────────────────────────────────────────────
function CompactCard({ dream, index, onClick }: { dream: SavedDream; index: number; onClick: () => void }) {
  const cs = CS[dream.activeCharacter] ?? CS.daoshen;
  const { date, time } = fmtArchiveDate(dream.createdAt);
  const { onMouseMove, onMouseLeave, tiltStyle } = useTilt(6);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: index * 0.05, ease: [0.23, 1, 0.32, 1] }}
      onClick={onClick}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{ ...tiltStyle, border: `1px solid hsl(${cs.hsl} / 0.10)` }}
      className="group relative rounded-2xl overflow-hidden cursor-pointer select-none flex items-stretch"
      whileHover={{ y: -2, transition: { duration: 0.18 } }}
      whileTap={{ scale: 0.985 }}
    >
      {/* Left color strip + mini orb */}
      <div
        className="flex-shrink-0 w-14 flex flex-col items-center justify-center gap-1.5 relative"
        style={{ background: `linear-gradient(180deg, hsl(${cs.hsl} / 0.14) 0%, rgba(5,5,10,0.70) 100%)` }}
      >
        <motion.div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{
            background: `radial-gradient(circle at 38% 35%, hsl(${cs.hsl} / 0.30), hsl(${cs.hsl} / 0.06))`,
            border: `1px solid hsl(${cs.hsl} / 0.20)`,
          }}
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cs.dot, opacity: 0.70 }} />
        </motion.div>
        <span className="text-[7px] tracking-[0.12em]" style={{ color: cs.dot, opacity: 0.60 }}>{cs.name}</span>
      </div>

      {/* Right content */}
      <div className="flex-1 px-3 py-3" style={{ background: "rgba(8,8,18,0.95)" }}>
        <h3 className="text-[13px] font-serif tracking-wide leading-snug mb-1"
          style={{ color: "rgba(255,255,255,0.82)" }}>
          {dream.title}
        </h3>
        <p className="text-[11px] leading-relaxed mb-2"
          style={{
            color: "rgba(255,255,255,0.26)",
            display: "-webkit-box",
            WebkitLineClamp: 1,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          } as React.CSSProperties}>
          {dream.summary}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] tabular-nums" style={{ color: "rgba(255,255,255,0.22)" }}>{date}</span>
          <span style={{ color: "rgba(255,255,255,0.12)" }}>·</span>
          <span className="text-[9px] tabular-nums" style={{ color: "rgba(255,255,255,0.18)" }}>{time}</span>
        </div>
      </div>

      {/* Hover glow */}
      <div className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ boxShadow: `inset 0 0 0 1px hsl(${cs.hsl} / 0.20)` }} />
    </motion.div>
  );
}

// ── Card router ───────────────────────────────────────────────────────────────
function DreamCard({ dream, index, onClick }: { dream: SavedDream; index: number; onClick: () => void }) {
  const v = getVariant(dream);
  if (v === "large")   return <LargeCard   dream={dream} index={index} onClick={onClick} />;
  if (v === "compact") return <CompactCard dream={dream} index={index} onClick={onClick} />;
  return <MediumCard dream={dream} index={index} onClick={onClick} />;
}

// ── Date group renderer ───────────────────────────────────────────────────────
function DateGroup({
  label,
  dreams,
  baseIndex,
  onDreamClick,
}: {
  label: string;
  dreams: SavedDream[];
  baseIndex: number;
  onDreamClick: (id: string) => void;
}) {
  const compact = dreams.filter(d => getVariant(d) === "compact");
  const others  = dreams.filter(d => getVariant(d) !== "compact");

  return (
    <div>
      <DateGroupHeader label={label} count={dreams.length} />
      <div className="flex flex-col gap-3.5">
        {/* Non-compact cards: full width */}
        {others.map((d, i) => (
          <DreamCard key={d.id} dream={d} index={baseIndex + i} onClick={() => onDreamClick(d.id)} />
        ))}
        {/* Compact cards: 2-column grid */}
        {compact.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {compact.map((d, i) => (
              <DreamCard key={d.id} dream={d} index={baseIndex + others.length + i} onClick={() => onDreamClick(d.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6">
      <motion.div className="relative w-18 h-18"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}>
        <div className="w-16 h-16 relative">
          <div className="absolute inset-0 rounded-full opacity-15"
            style={{ background: "radial-gradient(circle, rgba(107,140,255,0.9), transparent)" }} />
          <div className="absolute inset-3 rounded-full flex items-center justify-center"
            style={{
              background: "radial-gradient(circle at 38% 35%, rgba(107,140,255,0.18), rgba(20,15,50,0.40))",
              border: "1px solid rgba(107,140,255,0.14)",
            }}>
            <Sparkles size={15} style={{ color: "rgba(107,140,255,0.35)" }} />
          </div>
        </div>
      </motion.div>
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-[13px] tracking-wide" style={{ color: "rgba(255,255,255,0.25)" }}>
          {filtered ? "这一天没有留下任何梦" : "你还没有收藏任何梦"}
        </p>
        <p className="text-[10px] tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.10)" }}>
          {filtered ? "试试选择其他日期" : "第一段被你留下的梦，会出现在这里"}
        </p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DreamArchive() {
  const [, setLocation] = useLocation();
  const [allDreams,    setAllDreams]    = useState<SavedDream[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calOpen,      setCalOpen]      = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DREAMS_STORAGE_KEY);
      if (raw) setAllDreams([...JSON.parse(raw) as SavedDream[]].reverse());
    } catch { /* ignore */ }
  }, []);

  // Build gallery items for CircularGallery (newest first, up to 30)
  const galleryItems = useMemo(() => {
    return allDreams.slice(0, 30).map(dream => {
      // First user image from messages, then coverImage, then null (uses fallback)
      const imgMsg = dream.messages.find(
        m => m.role === "user" && (m.imageUrl || m.type === "image")
      );
      const image = imgMsg?.imageUrl ?? dream.coverImage ?? null;
      return {
        image,
        text: dream.title,
        dreamId: dream.id,
        charKey: dream.activeCharacter as string,
      };
    });
  }, [allDreams]);

  // Build date map for calendar indicators
  const dreamsByDate = useMemo(() => {
    const map: Record<string, SavedDream[]> = {};
    for (const d of allDreams) {
      const k = toDateKey(d.createdAt);
      if (!map[k]) map[k] = [];
      map[k].push(d);
    }
    return map;
  }, [allDreams]);

  // Filter + group
  const filtered = useMemo(() =>
    selectedDate ? allDreams.filter(d => d.createdAt.startsWith(selectedDate)) : allDreams,
    [allDreams, selectedDate]
  );

  const groups = useMemo(() => {
    const map: Record<string, SavedDream[]> = {};
    for (const d of filtered) {
      const k = toDateKey(d.createdAt);
      if (!map[k]) map[k] = [];
      map[k].push(d);
    }
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, dreams]) => ({ key, label: fmtGroupLabel(key), dreams }));
  }, [filtered]);

  let cardCounter = 0;

  return (
    <div className="min-h-screen w-full bg-[#05050A] text-white flex flex-col relative overflow-x-hidden"
      onClick={() => calOpen && setCalOpen(false)}>

      {/* ── Calendar modal — lives at page root so it's never clipped by a parent ── */}
      <AnimatePresence>
        {calOpen && (
          <CalendarPanel
            dreamsByDate={dreamsByDate}
            selectedDate={selectedDate}
            onSelect={d => { setSelectedDate(d); if (d) setCalOpen(false); }}
            onClose={() => setCalOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.038]"
          style={{ background: "radial-gradient(circle, rgba(107,140,255,1), transparent)" }} />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full opacity-[0.028]"
          style={{ background: "radial-gradient(circle, rgba(155,124,255,1), transparent)" }} />
      </div>

      {/* ── Header ── */}
      <div className="relative z-10 px-6 pt-8 pb-2 max-w-xl mx-auto w-full">
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase"
            style={{ color: "rgba(255,255,255,0.25)" }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.65")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            <ArrowLeft size={13} /><span>梦境空间</span>
          </button>

          {/* Calendar button */}
          <motion.button
            onClick={e => { e.stopPropagation(); setCalOpen(s => !s); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{
              background: calOpen || selectedDate ? "rgba(107,140,255,0.14)" : "rgba(255,255,255,0.04)",
              border: calOpen || selectedDate ? "1px solid rgba(107,140,255,0.28)" : "1px solid rgba(255,255,255,0.07)",
            }}
            whileHover={{ opacity: 0.82 }}
            whileTap={{ scale: 0.95 }}
          >
            <CalendarDays size={12} style={{ color: selectedDate ? "rgba(107,140,255,0.88)" : "rgba(255,255,255,0.32)" }} />
            <span className="text-[11px] tracking-wide" style={{ color: selectedDate ? "rgba(107,140,255,0.80)" : "rgba(255,255,255,0.32)" }}>
              {selectedDate ? selectedDate.replace(/-/g, ".").slice(2) : "日期"}
            </span>
            {selectedDate && (
              <motion.span
                onClick={e => { e.stopPropagation(); setSelectedDate(null); }}
                className="ml-0.5"
                whileTap={{ scale: 0.85 }}
              >
                <X size={9} style={{ color: "rgba(107,140,255,0.60)" }} />
              </motion.span>
            )}
          </motion.button>
        </div>

        {/* Title */}
        <h1 className="text-[26px] font-serif tracking-wide" style={{ color: "rgba(255,255,255,0.88)" }}>
          梦之档案
        </h1>
        <p className="mt-1.5 text-[11px] tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.16)" }}>
          {selectedDate
            ? `筛选：${selectedDate.replace(/-/g, ".")}  ·  ${filtered.length} 段梦`
            : "每一段被收藏的梦，都不会消散"}
        </p>
      </div>

      {/* ── 梦境回忆走廊 ── */}
      {galleryItems.length > 0 && (
        <div className="relative z-10 w-full max-w-2xl mx-auto px-5 mt-5 mb-2">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[10px] tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.22)" }}>
              梦境回忆走廊
            </span>
            <div className="h-px flex-1 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
            <span className="text-[9px] tabular-nums" style={{ color: "rgba(255,255,255,0.12)" }}>
              滑动浏览 · 点击进入
            </span>
          </div>
          <div style={{ height: 420 }}>
            <CircularGallery
              items={galleryItems}
              bend={2.5}
              textColor="#EDEBFF"
              borderRadius={0.08}
              scrollEase={0.038}
              scrollSpeed={1.6}
              onItemClick={(item: { dreamId: string }) => setLocation(`/archive/${item.dreamId}`)}
            />
          </div>
        </div>
      )}

      {/* ── Dream list ── */}
      <div className="relative z-10 flex-1 px-5 pb-16 max-w-xl mx-auto w-full">
        {filtered.length === 0 ? (
          <EmptyState filtered={!!selectedDate} />
        ) : (
          <div>
            {groups.map(g => {
              const el = (
                <DateGroup
                  key={g.key}
                  label={g.label}
                  dreams={g.dreams}
                  baseIndex={cardCounter}
                  onDreamClick={id => setLocation(`/archive/${id}`)}
                />
              );
              cardCounter += g.dreams.length;
              return el;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
