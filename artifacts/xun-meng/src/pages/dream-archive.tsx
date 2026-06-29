/**
 * 梦境回忆走廊 — /archive
 *
 * 全屏沉浸式 CircularGallery 走廊。
 * Gallery 铺满整个视口；顶部/底部 UI 以透明叠加层浮在画面上方。
 * 右上角"全部梦境"跳转 /archive/list。
 *
 * 导出 DREAMS_STORAGE_KEY / SavedDream / CS 供其他页面使用。
 */
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useSessionNs, getDreamsKey } from "@/hooks/use-session-ns";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, LayoutList, Sparkles } from "lucide-react";
import type { ChatMessage, CharKey } from "@/pages/dream-space";
// @ts-ignore
import CircularGallery from "@/components/CircularGallery.jsx";

// ── Public exports ────────────────────────────────────────────────────────────
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
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="w-28 h-28 rounded-full flex items-center justify-center relative"
          style={{
            background: "radial-gradient(circle at 38% 35%, rgba(107,140,255,0.10), rgba(10,5,30,0.55))",
            border: "1px solid rgba(107,140,255,0.09)",
          }}>
          <div className="absolute inset-0 rounded-full animate-pulse opacity-10"
            style={{ background: "radial-gradient(circle, rgba(107,140,255,0.6), transparent)" }} />
          <Sparkles size={30} style={{ color: "rgba(107,140,255,0.26)" }} />
        </div>
      </motion.div>
      <div className="text-center space-y-2">
        <p className="text-[15px] tracking-[0.14em]" style={{ color: "rgba(255,255,255,0.22)" }}>
          还没有梦境进入回忆走廊
        </p>
        <p className="text-[11px] tracking-[0.20em]" style={{ color: "rgba(255,255,255,0.08)" }}>
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
  const ns = useSessionNs();
  const dreamsKey = getDreamsKey(ns);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(dreamsKey);
      if (raw) setAllDreams([...JSON.parse(raw) as SavedDream[]].reverse());
    } catch { /* ignore */ }
    const t = setTimeout(() => setIntro(false), 400);
    return () => clearTimeout(t);
  }, [dreamsKey]);

  const galleryItems = useMemo(() => {
    // Expand each dream into multiple gallery items:
    //   • one card per image (deduplicated)
    //   • one card per audio message (gradient cover, transcription as caption)
    //   • one text/gradient card for dreams with no images and no audio
    const items: Array<{ image: string | null; text: string; dreamId: string; charKey: string }> = [];

    for (const dream of allDreams.slice(0, 30)) {
      const msgs = dream.messages ?? [];

      // Collect all image URLs from user messages in order
      const imgUrls: string[] = [];
      const audioCaptions: string[] = [];

      for (const m of msgs) {
        if (m.role !== "user") continue;
        if (m.imageUrl) {
          if (!imgUrls.includes(m.imageUrl)) imgUrls.push(m.imageUrl);
        }
        if (m.type === "audio") {
          const caption = (m.transcription && m.transcription.slice(0, 24)) || dream.title;
          audioCaptions.push(caption);
        }
      }

      // Upgrade the first thumbnail to the 600 px cover when available
      if (dream.coverImage) {
        if (imgUrls.length > 0) {
          imgUrls[0] = dream.coverImage;
        } else {
          imgUrls.push(dream.coverImage);
        }
      }

      // Image cards — one per unique image
      for (const img of imgUrls) {
        items.push({ image: img, text: dream.title, dreamId: dream.id, charKey: dream.activeCharacter as string });
      }

      // Audio cards — gradient cover with transcription snippet
      for (const caption of audioCaptions) {
        items.push({ image: null, text: caption, dreamId: dream.id, charKey: dream.activeCharacter as string });
      }

      // Fallback: dream has no images and no audio → one text/gradient card
      if (imgUrls.length === 0 && audioCaptions.length === 0) {
        items.push({ image: null, text: dream.title, dreamId: dream.id, charKey: dream.activeCharacter as string });
      }
    }

    // DEV: inject 5 gradient test cards when localStorage has no dreams
    if (items.length === 0) {
      return [
        { image: null, text: "潮汐与月亮", dreamId: "t1", charKey: "daoshen" },
        { image: null, text: "消失的城市", dreamId: "t2", charKey: "muge" },
        { image: null, text: "玻璃阶梯", dreamId: "t3", charKey: "anuan" },
        { image: null, text: "白色森林", dreamId: "t4", charKey: "daoshen" },
        { image: null, text: "镜中影", dreamId: "t5", charKey: "muge" },
      ];
    }
    return items;
  }, [allDreams]);

  // Use galleryItems.length so test-injected items also trigger gallery display
  const hasDreams = galleryItems.length > 0;

  return (
    <motion.div
      className="fixed inset-0 w-full h-screen overflow-hidden select-none text-white"
      style={{ background: "#05050A" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      {/* ── Ambient background ── */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-[800px] h-[800px] rounded-full opacity-[0.030]"
          style={{ background: "radial-gradient(circle, rgba(107,140,255,1), transparent)" }} />
        <div className="absolute bottom-0 right-1/3 w-[600px] h-[600px] rounded-full opacity-[0.022]"
          style={{ background: "radial-gradient(circle, rgba(155,124,255,1), transparent)" }} />
        <div className="absolute top-1/2 left-0 w-[400px] h-[400px] rounded-full opacity-[0.016]"
          style={{ background: "radial-gradient(circle, rgba(242,168,75,1), transparent)" }} />
      </div>

      {/* ── Gallery — horizontal strip, vertically centred ── */}
      <div className="absolute inset-0 z-0 flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {!intro && !hasDreams ? (
            <motion.div key="empty" className="w-full h-full"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CorridorEmpty />
            </motion.div>
          ) : (
            <motion.div
              key="gallery"
              className="w-full"
              style={{ height: "clamp(560px, 65vh, 680px)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.7 }}
            >
              <CircularGallery
                items={galleryItems as any}
                bend={0.30}
                borderRadius={0.048}
                scrollEase={0.038}
                scrollSpeed={2}
                cardWidth={1.60}
                cardHeight={2.00}
                cardStep={1.75}
                cameraZ={5}
                fov={40}
                onItemClick={(item: { dreamId: string }) => setLocation(`/archive/${item.dreamId}`)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Top gradient scrim (makes header text legible over gallery) ── */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-36 z-10"
        style={{ background: "linear-gradient(to bottom, rgba(5,5,10,0.82) 0%, rgba(5,5,10,0.30) 70%, transparent 100%)" }} />

      {/* ── Header overlay ── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-start justify-between px-6 pt-5">
        {/* Back to Dream Space */}
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 mt-0.5"
          style={{ color: "rgba(255,255,255,0.28)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.60)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.28)")}
        >
          <ArrowLeft size={13} />
          <span className="text-[11px] tracking-[0.20em] uppercase">梦境空间</span>
        </button>

        {/* Centre title */}
        <motion.div
          className="absolute left-1/2 top-5 -translate-x-1/2 text-center pointer-events-none"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.55 }}
        >
          <h1 className="text-[18px] font-serif tracking-[0.18em]"
            style={{ color: "rgba(255,255,255,0.72)" }}>
            梦境回忆走廊
          </h1>
          <p className="mt-0.5 text-[10px] tracking-[0.22em]"
            style={{ color: "rgba(255,255,255,0.20)" }}>
            {allDreams.length > 0 ? `${galleryItems.length} 段梦境碎片` : "滑动浏览梦境碎片"}
          </p>
        </motion.div>

        {/* Right: archive list only */}
        <motion.button
          onClick={() => setLocation("/archive/list")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full mt-0.5"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.09)",
            backdropFilter: "blur(12px)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          whileHover={{ background: "rgba(255,255,255,0.10)", borderColor: "rgba(255,255,255,0.16)" }}
          whileTap={{ scale: 0.94 }}
        >
          <LayoutList size={11} style={{ color: "rgba(255,255,255,0.38)" }} />
          <span className="text-[10px] tracking-wide" style={{ color: "rgba(255,255,255,0.34)" }}>
            档案列表
          </span>
        </motion.button>
      </div>

      {/* ── Bottom gradient scrim ── */}
      {hasDreams && (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 z-10"
          style={{ background: "linear-gradient(to top, rgba(5,5,10,0.72) 0%, rgba(5,5,10,0.20) 70%, transparent 100%)" }} />
      )}

      {/* ── Footer hint ── */}
      {hasDreams && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center gap-4 pb-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <span className="text-[10px] tracking-[0.22em]"
            style={{ color: "rgba(255,255,255,0.12)" }}>
            拖动浏览
          </span>
          <div className="w-px h-3" style={{ background: "rgba(255,255,255,0.06)" }} />
          <span className="text-[10px] tracking-[0.22em]"
            style={{ color: "rgba(255,255,255,0.12)" }}>
            轻点卡片进入梦境
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}
