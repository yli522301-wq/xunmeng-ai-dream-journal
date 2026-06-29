/**
 * 全部梦境 — /archive/list
 *
 * ChromaGrid 网格展示所有梦境档案，支持日历日期筛选。
 * 左上角返回"梦境回忆走廊"（/archive）。
 */
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useSessionNs, getDreamsKey } from "@/hooks/use-session-ns";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, X, Sparkles,
} from "lucide-react";
import type { CharKey } from "@/pages/dream-space";
import { DREAMS_STORAGE_KEY, type SavedDream, CS } from "@/pages/dream-archive";
// @ts-ignore — JSX component
import ChromaGrid from "@/components/ChromaGrid.jsx";

// ── Constants ─────────────────────────────────────────────────────────────────
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function getDaysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate(); }
function getFirstWeekday(y: number, m: number) { return new Date(y, m - 1, 1).getDay(); }

// ── Calendar Panel ────────────────────────────────────────────────────────────
function CalendarPanel({
  dreamsByDate, selectedDate, onSelect, onClose,
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
      <motion.div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(5px)" }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed z-50"
        style={{ top: "50%", left: "50%", x: "-50%", y: "-50%", width: "min(340px, 92vw)" }}
        initial={{ opacity: 0, scale: 0.94, y: "-46%" }}
        animate={{ opacity: 1, scale: 1, y: "-50%" }}
        exit={{ opacity: 0, scale: 0.95, y: "-46%" }}
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        onClick={e => e.stopPropagation()}
      >
        <div className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(8,8,20,0.98)",
            border: "1px solid rgba(255,255,255,0.09)",
            backdropFilter: "blur(40px)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.70)",
          }}>

          {/* Month nav */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <button onClick={prev}
              className="w-8 h-8 flex items-center justify-center rounded-full"
              style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.40)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.09)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}>
              <ChevronLeft size={15} />
            </button>
            <span className="text-[14px] tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.75)" }}>
              {cal.year}年{cal.month}月
            </span>
            <button onClick={next}
              className="w-8 h-8 flex items-center justify-center rounded-full"
              style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.40)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.09)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}>
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 px-3 pb-1">
            {WEEKDAYS.map(w => (
              <div key={w} className="text-center text-[10px] tracking-widest py-1"
                style={{ color: "rgba(255,255,255,0.20)" }}>{w}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 px-3 pb-4 gap-y-1">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const key = `${cal.year}-${String(cal.month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const dreams    = dreamsByDate[key] ?? [];
              const hasDreams = dreams.length > 0;
              const isToday   = key === todayStr;
              const isSel     = key === selectedDate;
              const dots      = [...new Set(dreams.map(d => CS[d.activeCharacter]?.dot ?? "#fff"))].slice(0, 3);

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
          <div className="flex items-center justify-center gap-3 pb-4 pt-1 border-t"
            style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            {selectedDate && (
              <button onClick={() => { onSelect(null); onClose(); }}
                className="text-[10px] tracking-wide flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ background: "rgba(107,140,255,0.10)", border: "1px solid rgba(107,140,255,0.18)", color: "rgba(107,140,255,0.70)" }}>
                <Sparkles size={9} />全部梦境
              </button>
            )}
            <button onClick={onClose}
              className="text-[10px] tracking-wide px-3 py-1.5 rounded-full"
              style={{ color: "rgba(255,255,255,0.22)" }}>
              关闭
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      <motion.div animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}>
        <div className="w-16 h-16 relative">
          <div className="absolute inset-0 rounded-full opacity-15"
            style={{ background: "radial-gradient(circle, rgba(107,140,255,0.9), transparent)" }} />
          <div className="absolute inset-3 rounded-full flex items-center justify-center"
            style={{ background: "radial-gradient(circle at 38% 35%, rgba(107,140,255,0.18), rgba(20,15,50,0.40))", border: "1px solid rgba(107,140,255,0.14)" }}>
            <Sparkles size={15} style={{ color: "rgba(107,140,255,0.35)" }} />
          </div>
        </div>
      </motion.div>
      <div className="text-center space-y-2">
        <p className="text-[13px] tracking-wide" style={{ color: "rgba(255,255,255,0.25)" }}>
          {filtered ? "这一天没有留下任何梦" : "还没有梦境收入档案"}
        </p>
        <p className="text-[10px] tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.10)" }}>
          {filtered ? "试试选择其他日期" : "在梦境空间与 AI 对话后保存梦境"}
        </p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DreamArchiveList() {
  const [, setLocation] = useLocation();
  const [allDreams,    setAllDreams]    = useState<SavedDream[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calOpen,      setCalOpen]      = useState(false);
  const ns = useSessionNs();
  const dreamsKey = getDreamsKey(ns);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(dreamsKey);
      if (raw) setAllDreams([...JSON.parse(raw) as SavedDream[]].reverse());
    } catch { /* ignore */ }
  }, [dreamsKey]);

  // Calendar dot indicators
  const dreamsByDate = useMemo(() => {
    const map: Record<string, SavedDream[]> = {};
    for (const d of allDreams) {
      const k = toDateKey(d.createdAt);
      if (!map[k]) map[k] = [];
      map[k].push(d);
    }
    return map;
  }, [allDreams]);

  // Filtered dreams (by selected date or all)
  const filtered = useMemo(() =>
    selectedDate ? allDreams.filter(d => d.createdAt.startsWith(selectedDate)) : allDreams,
    [allDreams, selectedDate]
  );

  // Build ChromaGrid items from filtered dreams
  const chromaItems = useMemo(() =>
    filtered.map(dream => {
      const imgMsg = dream.messages.find(
        m => m.role === "user" && (m.imageUrl || m.type === "image")
      );
      const image     = imgMsg?.imageUrl ?? dream.coverImage ?? null;
      const hasAudio  = dream.messages.filter(m => m.role === "user").some(m => m.type === "audio");
      const hasImage  = !!image;
      const { date, time } = fmtArchiveDate(dream.createdAt);

      return {
        dreamId:  dream.id,
        charKey:  dream.activeCharacter as string,
        image,
        date,
        time,
        title:    dream.title,
        subtitle: dream.summary?.slice(0, 60) + (dream.summary?.length > 60 ? "…" : ""),
        hasAudio,
        hasImage,
      };
    }),
    [filtered]
  );

  return (
    <div
      className="min-h-screen w-full text-white flex flex-col"
      style={{ background: "#05050A" }}
      onClick={() => calOpen && setCalOpen(false)}
    >
      {/* Calendar modal */}
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
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.030]"
          style={{ background: "radial-gradient(circle, rgba(107,140,255,1), transparent)" }} />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full opacity-[0.022]"
          style={{ background: "radial-gradient(circle, rgba(155,124,255,1), transparent)" }} />
      </div>

      {/* ── Header ── */}
      <div className="relative z-10 flex-none px-6 pt-8 pb-4 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-5">
          {/* Back to corridor */}
          <button
            onClick={() => setLocation("/archive")}
            className="flex items-center gap-2 text-[11px] tracking-[0.20em] uppercase"
            style={{ color: "rgba(255,255,255,0.22)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.50)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.22)")}
          >
            <ArrowLeft size={13} /><span>回忆走廊</span>
          </button>

          {/* Date filter */}
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
          全部梦境
        </h1>
        <p className="mt-1.5 text-[11px] tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.16)" }}>
          {selectedDate
            ? `${selectedDate.replace(/-/g, ".")}  ·  ${filtered.length} 段梦`
            : allDreams.length > 0
              ? `共 ${allDreams.length} 段梦境收藏在档`
              : "每一段被收藏的梦，都不会消散"}
        </p>
      </div>

      {/* ── ChromaGrid ── */}
      <div className="relative z-10 flex-1 px-6 pb-16 max-w-5xl mx-auto w-full">
        {filtered.length === 0 ? (
          <EmptyState filtered={!!selectedDate} />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
          >
            <ChromaGrid
              items={chromaItems as any}
              onItemClick={(item: { dreamId: string }) => setLocation(`/archive/${item.dreamId}`)}
              radius={300}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}
