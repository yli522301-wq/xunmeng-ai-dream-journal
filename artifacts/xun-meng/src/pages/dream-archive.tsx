/**
 * 梦境回忆走廊 — /archive
 *
 * 全屏沉浸式 CircularGallery 大画廊。
 * 右上角入口可跳转到 /archive/list（普通卡片列表）。
 *
 * 导出 DREAMS_STORAGE_KEY 和 SavedDream 供其他页面使用。
 */
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, LayoutList, Sparkles } from "lucide-react";
import type { ChatMessage, CharKey } from "@/pages/dream-space";
// @ts-ignore
import CircularGallery from "@/components/CircularGallery.jsx";

// ── Public exports (consumed by dream-local-detail, etc.) ────────────────────
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

// ── Constants ─────────────────────────────────────────────────────────────────
export const CS: Record<string, { name: string; enName: string; hsl: string; dot: string }> = {
  daoshen: { name: "岛深", enName: "Daoshan", hsl: "185 70% 55%", dot: "#6B8CFF" },
  muge:    { name: "暮歌", enName: "Muge",    hsl: "240 70% 65%", dot: "#9B7CFF" },
  anuan:   { name: "阿暖", enName: "Anuan",   hsl: "38 90% 60%",  dot: "#F2A84B" },
};

// ── Empty state ───────────────────────────────────────────────────────────────
function CorridorEmpty() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 select-none">
      <motion.div
        className="relative"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="w-24 h-24 rounded-full flex items-center justify-center relative"
          style={{ background: "radial-gradient(circle at 38% 35%, rgba(107,140,255,0.12), rgba(10,5,30,0.60))", border: "1px solid rgba(107,140,255,0.10)" }}>
          <div className="absolute inset-0 rounded-full animate-pulse opacity-10"
            style={{ background: "radial-gradient(circle, rgba(107,140,255,0.5), transparent)" }} />
          <Sparkles size={26} style={{ color: "rgba(107,140,255,0.28)" }} />
        </div>
      </motion.div>
      <div className="text-center space-y-2">
        <p className="text-[14px] tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.22)" }}>
          还没有梦境进入回忆走廊
        </p>
        <p className="text-[11px] tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.09)" }}>
          在梦境空间与 AI 对话，保存你的梦
        </p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DreamCorridor() {
  const [, setLocation] = useLocation();
  const [allDreams, setAllDreams] = useState<SavedDream[]>([]);
  const [intro, setIntro] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DREAMS_STORAGE_KEY);
      if (raw) setAllDreams([...JSON.parse(raw) as SavedDream[]].reverse());
    } catch { /* ignore */ }
    const t = setTimeout(() => setIntro(false), 600);
    return () => clearTimeout(t);
  }, []);

  const galleryItems = useMemo(() =>
    allDreams.slice(0, 50).map(dream => {
      const imgMsg = dream.messages.find(
        m => m.role === "user" && (m.imageUrl || m.type === "image")
      );
      const image = imgMsg?.imageUrl ?? dream.coverImage ?? null;
      return { image, text: dream.title, dreamId: dream.id, charKey: dream.activeCharacter as string };
    }),
    [allDreams]
  );

  return (
    <motion.div
      className="h-screen w-full text-white flex flex-col overflow-hidden select-none"
      style={{ background: "#05050A" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.55 }}
    >
      {/* ── Ambient background ── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-[700px] h-[700px] rounded-full opacity-[0.032]"
          style={{ background: "radial-gradient(circle, rgba(107,140,255,1), transparent)" }} />
        <div className="absolute bottom-0 right-1/3 w-[500px] h-[500px] rounded-full opacity-[0.024]"
          style={{ background: "radial-gradient(circle, rgba(155,124,255,1), transparent)" }} />
        <div className="absolute top-1/2 left-0 w-[300px] h-[300px] rounded-full opacity-[0.018]"
          style={{ background: "radial-gradient(circle, rgba(242,168,75,1), transparent)" }} />
      </div>

      {/* ── Header ── */}
      <div className="relative z-10 flex-none px-6 pt-7 pb-0">
        <div className="flex items-start justify-between">
          {/* Left: back + titles */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setLocation("/")}
              className="flex items-center gap-2 self-start"
              style={{ color: "rgba(255,255,255,0.22)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.50)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.22)")}
            >
              <ArrowLeft size={13} />
              <span className="text-[11px] tracking-[0.20em] uppercase">梦境空间</span>
            </button>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.55 }}
            >
              <h1 className="text-[28px] font-serif tracking-wide leading-tight"
                style={{ color: "rgba(255,255,255,0.88)" }}>
                梦境回忆走廊
              </h1>
              <p className="mt-1 text-[11px] tracking-[0.18em]"
                style={{ color: "rgba(255,255,255,0.18)" }}>
                滑动浏览被你收藏的梦境碎片
              </p>
            </motion.div>
          </div>

          {/* Right: archive list entry */}
          <motion.div
            className="flex items-center gap-2 mt-0.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <motion.button
              onClick={() => setLocation("/archive/list")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
              whileHover={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.14)" }}
              whileTap={{ scale: 0.94 }}
            >
              <LayoutList size={12} style={{ color: "rgba(255,255,255,0.35)" }} />
              <span className="text-[10px] tracking-wide" style={{ color: "rgba(255,255,255,0.30)" }}>
                全部梦境
              </span>
            </motion.button>
          </motion.div>
        </div>
      </div>

      {/* ── Gallery (fills all remaining height) ── */}
      <div className="relative z-10 flex-1 min-h-0 w-full mt-3">
        <AnimatePresence mode="wait">
          {allDreams.length === 0 && !intro ? (
            <motion.div
              key="empty"
              className="w-full h-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <CorridorEmpty />
            </motion.div>
          ) : (
            <motion.div
              key="gallery"
              className="w-full h-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.6 }}
            >
              <CircularGallery
                items={galleryItems}
                bend={3}
                borderRadius={0.06}
                scrollEase={0.038}
                scrollSpeed={2}
                onItemClick={(item: { dreamId: string }) => setLocation(`/archive/${item.dreamId}`)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer hint ── */}
      {allDreams.length > 0 && (
        <motion.div
          className="relative z-10 flex-none flex items-center justify-center gap-4 pb-5 pt-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <span className="text-[10px] tracking-[0.20em]"
            style={{ color: "rgba(255,255,255,0.12)" }}>
            拖动浏览
          </span>
          <div className="w-px h-3" style={{ background: "rgba(255,255,255,0.08)" }} />
          <span className="text-[10px] tracking-[0.20em]"
            style={{ color: "rgba(255,255,255,0.12)" }}>
            轻点卡片进入梦境详情
          </span>
          <div className="w-px h-3" style={{ background: "rgba(255,255,255,0.08)" }} />
          <button
            onClick={() => setLocation("/archive/list")}
            className="text-[10px] tracking-[0.16em] transition-opacity"
            style={{ color: "rgba(107,140,255,0.30)" }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.75")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            查看全部梦境 →
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
