/**
 * 梦境星图 — /dream-map
 *
 * 黑暗空间里，保存过的梦像模糊光点散落其中。
 * 鼠标靠近哪里，那里慢慢亮起来；点击泡泡展开预览卡。
 */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useSessionNs, getDreamsKey, getResumeKey } from "@/hooks/use-session-ns";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sparkles, Mic, X } from "lucide-react";
import { DREAMS_STORAGE_KEY, type SavedDream, CS } from "@/pages/dream-archive";

// ── Character RGB ──────────────────────────────────────────────────────────────
const CHAR_RGB: Record<string, [number, number, number]> = {
  daoshen: [107, 140, 255],
  muge:    [155, 124, 255],
  anuan:   [242, 168,  75],
};
const getCharRGB = (k: string): [number, number, number] =>
  CHAR_RGB[k] ?? [128, 152, 224];

// ── Seeded PRNG ───────────────────────────────────────────────────────────────
function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
function strHash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++)
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h;
}

// ── OrbData ───────────────────────────────────────────────────────────────────
interface OrbData {
  dream: SavedDream;
  x: number; y: number;   // % of container
  size: number;            // px
  image: string | null;
  hasAudio: boolean;
  r: number; g: number; b: number;
}

// ── Orb layout: deterministic scatter ─────────────────────────────────────────
function computeLayout(dreams: SavedDream[]): OrbData[] {
  const N = dreams.length;
  if (N === 0) return [];

  const COLS = Math.max(3, Math.ceil(Math.sqrt(N * 1.5)));
  const ROWS = Math.max(2, Math.ceil((N + COLS - 1) / COLS));

  return dreams.map((dream, i) => {
    const zone = i % (COLS * ROWS);
    const col  = zone % COLS;
    const row  = Math.floor(zone / COLS);
    const rng  = seededRng(strHash(dream.id));

    // Safe area: 8-92% horizontally, 15-92% vertically (leave header room)
    const cellW = 84 / COLS;
    const cellH = 77 / ROWS;
    const mx = 8, my = 15;

    const x = mx + col * cellW + rng() * cellW * 0.58 + cellW * 0.21;
    const y = my + row * cellH + rng() * cellH * 0.58 + cellH * 0.21;

    const imgMsg  = dream.messages.find(m => m.role === "user" && (m.imageUrl || m.type === "image"));
    const image   = imgMsg?.imageUrl ?? dream.coverImage ?? null;
    const hasAudio = dream.messages.some(m => m.role === "user" && m.type === "audio");
    const [r, g, b] = getCharRGB(dream.activeCharacter as string);

    const base = image ? 96 : hasAudio ? 76 : 62;
    const size = Math.round(base + (rng() - 0.5) * 20);

    return { dream, x, y, size, image, hasAudio, r, g, b };
  });
}

// ── Date formatter ────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyStars() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 pointer-events-none">
      <motion.div
        animate={{ scale: [1, 1.10, 1], opacity: [0.4, 0.85, 0.4] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{
            background: "radial-gradient(circle at 40% 38%, rgba(107,140,255,0.07), rgba(5,5,20,0.45))",
            border: "1px solid rgba(107,140,255,0.07)",
          }}>
          <Sparkles size={20} style={{ color: "rgba(107,140,255,0.20)" }} />
        </div>
      </motion.div>
      <div className="text-center space-y-2">
        <p className="text-[13px] tracking-[0.14em]" style={{ color: "rgba(255,255,255,0.17)" }}>
          这里还没有星星
        </p>
        <p className="text-[10px] tracking-[0.20em]" style={{ color: "rgba(255,255,255,0.07)" }}>
          保存第一段梦后，它会在这里亮起
        </p>
      </div>
    </div>
  );
}

// ── Preview card ──────────────────────────────────────────────────────────────
function PreviewCard({
  orb, cardX, cardY, onClose, onEnter, onResume,
}: {
  orb: OrbData;
  cardX: number; cardY: number;
  onClose: () => void;
  onEnter: () => void;
  onResume: () => void;
}) {
  const cs      = CS[orb.dream.activeCharacter as string] ?? CS.daoshen;
  const summary = orb.dream.summary
    ? orb.dream.summary.slice(0, 72) + (orb.dream.summary.length > 72 ? "…" : "")
    : null;

  const CARD_W = 252, CARD_H = 230;
  const safeX = Math.min(Math.max(cardX, 10), window.innerWidth  - CARD_W - 10);
  const safeY = Math.min(Math.max(cardY, 60), window.innerHeight - CARD_H - 10);

  return (
    <motion.div
      className="fixed z-50"
      style={{ left: safeX, top: safeY, width: CARD_W }}
      initial={{ opacity: 0, scale: 0.86, y: 14 }}
      animate={{ opacity: 1, scale: 1,    y: 0  }}
      exit={{    opacity: 0, scale: 0.90,  y: 8  }}
      transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
      onClick={e => e.stopPropagation()}
    >
      <div
        className="rounded-2xl overflow-hidden relative"
        style={{
          background: "rgba(6,6,16,0.97)",
          border: `1px solid rgba(${orb.r},${orb.g},${orb.b},0.30)`,
          boxShadow: `0 0 44px rgba(${orb.r},${orb.g},${orb.b},0.18), 0 16px 48px rgba(0,0,0,0.75)`,
          backdropFilter: "blur(36px)",
        }}
      >
        {/* Cover strip */}
        {orb.image && (
          <div style={{ height: 84, overflow: "hidden", position: "relative" }}>
            <img src={orb.image} alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(to bottom, rgba(6,6,16,0.08), rgba(6,6,16,0.88))",
            }} />
          </div>
        )}

        <div className="px-4 pt-3.5 pb-4">
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
          >
            <X size={10} />
          </button>

          {/* Character + date */}
          <div className="flex items-center gap-1.5 mb-2.5">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: cs.dot, display: "inline-block" }} />
            <span className="text-[9px] tracking-[0.16em] uppercase"
              style={{ color: "rgba(255,255,255,0.36)" }}>
              {cs.name}
            </span>
            <span className="ml-auto text-[9px] tabular-nums"
              style={{ color: "rgba(255,255,255,0.18)" }}>
              {fmtDate(orb.dream.createdAt)}
            </span>
          </div>

          <h3
            className="text-[14px] font-serif leading-snug tracking-wide mb-2"
            style={{ color: "rgba(255,255,255,0.87)" }}
          >
            {orb.dream.title}
          </h3>

          {summary && (
            <p className="text-[10px] leading-relaxed mb-3.5"
              style={{ color: "rgba(255,255,255,0.26)" }}>
              {summary}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={onEnter}
              className="flex-1 py-1.5 rounded-xl text-[10px] tracking-wide font-medium transition-colors"
              style={{
                background:  `rgba(${orb.r},${orb.g},${orb.b},0.16)`,
                border:      `1px solid rgba(${orb.r},${orb.g},${orb.b},0.30)`,
                color:       `rgba(${orb.r},${orb.g},${orb.b},0.92)`,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = `rgba(${orb.r},${orb.g},${orb.b},0.28)`)}
              onMouseLeave={e => (e.currentTarget.style.background = `rgba(${orb.r},${orb.g},${orb.b},0.16)`)}
            >
              进入梦境
            </button>
            <button
              onClick={onResume}
              className="flex-1 py-1.5 rounded-xl text-[10px] tracking-wide transition-colors"
              style={{
                background: "rgba(255,255,255,0.04)",
                border:     "1px solid rgba(255,255,255,0.08)",
                color:      "rgba(255,255,255,0.38)",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
            >
              续梦
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Ambient star particles (static CSS, non-interactive) ──────────────────────
const BG_STARS = Array.from({ length: 55 }, (_, i) => {
  const rng = seededRng(i * 7919 + 3571);
  return {
    x:    rng() * 100,
    y:    rng() * 100,
    r:    rng() * 1.4 + 0.3,
    op:   rng() * 0.28 + 0.04,
    dur:  rng() * 3 + 2.5,
    delay: rng() * 4,
  };
});

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DreamMap() {
  const [, setLocation] = useLocation();
  const [allDreams, setAllDreams] = useState<SavedDream[]>([]);
  const [activeOrb, setActiveOrb] = useState<{
    orb: OrbData; cardX: number; cardY: number;
  } | null>(null);
  const ns = useSessionNs();
  const dreamsKey = getDreamsKey(ns);
  const resumeKey = getResumeKey(ns);

  const containerRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);

  // Load saved dreams
  useEffect(() => {
    try {
      const raw = localStorage.getItem(dreamsKey);
      setAllDreams(raw ? [...JSON.parse(raw) as SavedDream[]].reverse() : []);
    } catch { setAllDreams([]); }
  }, [dreamsKey]);

  const orbs = useMemo(() => computeLayout(allDreams), [allDreams]);

  // ── Proximity effect — pure DOM, no React re-renders on mousemove ──
  useEffect(() => {
    const container = containerRef.current;
    const spotlight = spotlightRef.current;
    if (!container || orbs.length === 0) return;

    const RADIUS = 21; // % of container dimension

    const onMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const mx   = (e.clientX - rect.left) / rect.width  * 100;
      const my   = (e.clientY - rect.top)  / rect.height * 100;

      // Spotlight position
      if (spotlight) {
        spotlight.style.left    = `${e.clientX - rect.left}px`;
        spotlight.style.top     = `${e.clientY - rect.top}px`;
        spotlight.style.opacity = "1";
      }

      // Per-orb update
      container.querySelectorAll<HTMLElement>("[data-orb-idx]").forEach(orbEl => {
        if (orbEl.dataset.active === "true") return;

        const or  = orbEl.getBoundingClientRect();
        const cx  = (or.left + or.width  / 2 - rect.left) / rect.width  * 100;
        const cy  = (or.top  + or.height / 2 - rect.top)  / rect.height * 100;
        const dist = Math.hypot(mx - cx, my - cy);
        const prox = Math.max(0, 1 - dist / RADIUS);

        // Filter on inner
        const inner = orbEl.querySelector<HTMLElement>("[data-orb-inner]");
        if (inner) {
          const blur = (14 - prox * 12.5).toFixed(1);
          const sat  = (0.04 + prox * 0.74).toFixed(3);
          const bri  = (0.13 + prox * 0.74).toFixed(3);
          inner.style.filter = `blur(${blur}px) saturate(${sat}) brightness(${bri})`;
        }

        // Title
        const title = orbEl.querySelector<HTMLElement>("[data-orb-title]");
        if (title) title.style.opacity = (prox * 0.88).toFixed(3);

        // Glow
        const glow = orbEl.querySelector<HTMLElement>("[data-orb-glow]");
        if (glow) {
          const dr = orbEl.dataset.r ?? "107";
          const dg = orbEl.dataset.g ?? "140";
          const db = orbEl.dataset.b ?? "255";
          glow.style.opacity   = (prox * 0.75).toFixed(3);
          const gs = (24 + prox * 52).toFixed(0);
          glow.style.boxShadow = `0 0 ${gs}px rgba(${dr},${dg},${db},0.60)`;
        }
      });
    };

    const onLeave = () => {
      if (spotlight) spotlight.style.opacity = "0";
      container.querySelectorAll<HTMLElement>("[data-orb-idx]").forEach(orbEl => {
        if (orbEl.dataset.active === "true") return;
        const inner = orbEl.querySelector<HTMLElement>("[data-orb-inner]");
        if (inner) inner.style.filter = "blur(14px) saturate(0.04) brightness(0.13)";
        const title = orbEl.querySelector<HTMLElement>("[data-orb-title]");
        if (title) title.style.opacity = "0";
        const glow = orbEl.querySelector<HTMLElement>("[data-orb-glow]");
        if (glow) { glow.style.opacity = "0"; glow.style.boxShadow = "none"; }
      });
    };

    container.addEventListener("mousemove",  onMove);
    container.addEventListener("mouseleave", onLeave);
    return () => {
      container.removeEventListener("mousemove",  onMove);
      container.removeEventListener("mouseleave", onLeave);
    };
  }, [orbs]);

  // ── Sync active orb styles ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.querySelectorAll<HTMLElement>("[data-orb-idx]").forEach(el => {
      const isActive = !!activeOrb && el.dataset.dreamId === activeOrb.orb.dream.id;
      el.dataset.active = isActive ? "true" : "false";
      if (isActive) {
        const inner = el.querySelector<HTMLElement>("[data-orb-inner]");
        if (inner) inner.style.filter = "blur(0px) saturate(0.88) brightness(1.02)";
        const title = el.querySelector<HTMLElement>("[data-orb-title]");
        if (title) title.style.opacity = "1";
      } else {
        // only reset if mouse is not nearby (leave the proximity effect in charge)
        // we set it back to "invisible" and let next mousemove recalculate
        const inner = el.querySelector<HTMLElement>("[data-orb-inner]");
        if (inner) inner.style.filter = "blur(14px) saturate(0.04) brightness(0.13)";
        const title = el.querySelector<HTMLElement>("[data-orb-title]");
        if (title) title.style.opacity = "0";
      }
    });
  }, [activeOrb]);

  // ── Click handler ──
  const handleOrbClick = useCallback((orb: OrbData, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeOrb?.orb.dream.id === orb.dream.id) {
      setActiveOrb(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // Card appears above and slightly right of orb
    const cardX = rect.left + rect.width  / 2 - 126;
    const cardY = rect.top  - 240;
    setActiveOrb({ orb, cardX, cardY });
  }, [activeOrb]);

  // ── Resume dream → Dream Space ──
  const handleResume = useCallback((dreamId: string) => {
    try { localStorage.setItem(resumeKey, dreamId); } catch {}
    setLocation("/");
  }, [setLocation, resumeKey]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-screen overflow-hidden select-none"
      style={{
        background: "radial-gradient(ellipse at 48% 58%, rgba(28,16,58,0.60) 0%, #05050a 62%)",
      }}
      onClick={() => setActiveOrb(null)}
    >
      {/* ── Background: ambient glow blobs ── */}
      <div className="pointer-events-none absolute inset-0" style={{ zIndex: 0 }}>
        <div className="absolute top-1/4 left-1/3 w-[700px] h-[700px] rounded-full"
          style={{ opacity: 0.025, background: "radial-gradient(circle, rgba(107,140,255,1), transparent)" }} />
        <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] rounded-full"
          style={{ opacity: 0.018, background: "radial-gradient(circle, rgba(155,124,255,1), transparent)" }} />
        <div className="absolute top-2/3 left-1/5 w-[350px] h-[350px] rounded-full"
          style={{ opacity: 0.014, background: "radial-gradient(circle, rgba(242,168,75,1), transparent)" }} />
      </div>

      {/* ── Static background star particles ── */}
      <svg
        className="pointer-events-none absolute inset-0"
        style={{ zIndex: 1, width: "100%", height: "100%", opacity: 0.55 }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {BG_STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.05} fill="white" opacity={s.op}>
            <animate attributeName="opacity" values={`${s.op};${s.op * 2.8};${s.op}`}
              dur={`${s.dur}s`} repeatCount="indefinite" begin={`${s.delay}s`} />
          </circle>
        ))}
      </svg>

      {/* ── Mouse spotlight ── */}
      <div
        ref={spotlightRef}
        className="pointer-events-none absolute"
        style={{
          zIndex: 2,
          width: 520, height: 520,
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
          background: "radial-gradient(circle at center, rgba(108,140,255,0.14) 0%, rgba(75,48,190,0.06) 32%, transparent 64%)",
          opacity: 0,
          transition: "opacity 0.5s ease",
        }}
      />

      {/* ── Dream orbs ── */}
      {orbs.map((orb, idx) => (
        <div
          key={orb.dream.id}
          data-orb-idx={idx}
          data-dream-id={orb.dream.id}
          data-active="false"
          data-r={orb.r}
          data-g={orb.g}
          data-b={orb.b}
          className="absolute"
          style={{
            left: `${orb.x}%`,
            top:  `${orb.y}%`,
            width:  orb.size,
            height: orb.size,
            transform: "translate(-50%, -50%)",
            cursor: "pointer",
            zIndex: 10,
          }}
          onClick={e => handleOrbClick(orb, e)}
        >
          {/* Glow ring */}
          <div
            data-orb-glow
            style={{
              position: "absolute", inset: -12, borderRadius: "50%",
              opacity: 0,
              transition: "opacity 0.38s ease, box-shadow 0.38s ease",
            }}
          />

          {/* Inner circle — filter driven by proximity JS */}
          <div
            data-orb-inner
            style={{
              width: "100%", height: "100%", borderRadius: "50%",
              overflow: "hidden", position: "relative",
              filter: "blur(14px) saturate(0.04) brightness(0.13)",
              transition: "filter 0.38s ease",
            }}
          >
            {orb.image ? (
              <>
                <img
                  src={orb.image}
                  alt=""
                  draggable={false}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
                {/* Edge vignette for sphere feel */}
                <div style={{
                  position: "absolute", inset: 0, borderRadius: "50%",
                  background: `radial-gradient(circle at center, transparent 28%, rgba(5,5,10,0.55) 68%, rgba(5,5,10,0.92) 100%)`,
                }} />
              </>
            ) : (
              /* Gradient orb for no-image dreams */
              <div style={{
                width: "100%", height: "100%", borderRadius: "50%",
                background: `radial-gradient(circle at 36% 34%, rgba(${orb.r},${orb.g},${orb.b},0.95), rgba(${Math.round(orb.r*0.22)},${Math.round(orb.g*0.22)},${Math.round(orb.b*0.22)},0.30) 60%, rgba(5,5,10,0.50) 100%)`,
                boxShadow: `inset 0 0 22px rgba(${orb.r},${orb.g},${orb.b},0.16)`,
              }} />
            )}

            {/* Circular border ring */}
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              border: `1px solid rgba(${orb.r},${orb.g},${orb.b},0.20)`,
              pointerEvents: "none",
            }} />
          </div>

          {/* Audio micro-badge */}
          {orb.hasAudio && (
            <div style={{
              position: "absolute", bottom: 1, right: 1,
              width: 15, height: 15, borderRadius: "50%",
              background: `rgba(${orb.r},${orb.g},${orb.b},0.18)`,
              border: `1px solid rgba(${orb.r},${orb.g},${orb.b},0.32)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Mic size={6} style={{ color: `rgba(${orb.r},${orb.g},${orb.b},0.75)` }} />
            </div>
          )}

          {/* Title label — fades in on proximity */}
          <div
            data-orb-title
            style={{
              position: "absolute",
              top: `calc(100% + 7px)`,
              left: "50%", transform: "translateX(-50%)",
              whiteSpace: "nowrap",
              maxWidth: 150,
              overflow: "hidden", textOverflow: "ellipsis",
              fontSize: 10, letterSpacing: "0.10em",
              color: "rgba(255,255,255,0.80)",
              opacity: 0,
              transition: "opacity 0.32s ease",
              pointerEvents: "none",
              textShadow: "0 0 14px rgba(0,0,0,1), 0 0 8px rgba(0,0,0,1)",
              textAlign: "center",
            }}
          >
            {orb.dream.title}
          </div>

          {/* Active pulse ring */}
          {activeOrb?.orb.dream.id === orb.dream.id && (
            <motion.div
              style={{
                position: "absolute", inset: -5, borderRadius: "50%",
                border: `1px solid rgba(${orb.r},${orb.g},${orb.b},0.55)`,
                pointerEvents: "none",
              }}
              animate={{ scale: [1, 1.22, 1], opacity: [0.75, 0.15, 0.75] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </div>
      ))}

      {/* ── Empty state ── */}
      {allDreams.length === 0 && (
        <motion.div
          className="absolute inset-0"
          style={{ zIndex: 10 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
        >
          <EmptyStars />
        </motion.div>
      )}

      {/* ── Top scrim for header legibility ── */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0"
        style={{
          zIndex: 20, height: 110,
          background: "linear-gradient(to bottom, rgba(5,5,10,0.90) 0%, rgba(5,5,10,0.30) 72%, transparent 100%)",
        }}
      />

      {/* ── Header overlay ── */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 pt-5"
        style={{ zIndex: 30 }}>
        <button
          onClick={e => { e.stopPropagation(); setLocation("/archive"); }}
          className="flex items-center gap-2"
          style={{ color: "rgba(255,255,255,0.25)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}
        >
          <ArrowLeft size={13} />
          <span className="text-[11px] tracking-[0.20em] uppercase">回忆走廊</span>
        </button>

        {/* Title — centred absolutely */}
        <motion.div
          className="absolute left-1/2 top-5 -translate-x-1/2 text-center pointer-events-none"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <h1 className="text-[17px] font-serif tracking-[0.18em]"
            style={{ color: "rgba(255,255,255,0.66)" }}>
            梦境星图
          </h1>
          <p className="mt-0.5 text-[9px] tracking-[0.22em]"
            style={{ color: "rgba(255,255,255,0.16)" }}>
            靠近一段梦，它才会慢慢亮起来
          </p>
        </motion.div>

        {/* Star count */}
        {allDreams.length > 0 && (
          <motion.span
            className="text-[10px] tracking-wide"
            style={{ color: "rgba(255,255,255,0.13)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          >
            {allDreams.length} 颗星
          </motion.span>
        )}
      </div>

      {/* ── Preview card ── */}
      <AnimatePresence>
        {activeOrb && (
          <PreviewCard
            orb={activeOrb.orb}
            cardX={activeOrb.cardX}
            cardY={activeOrb.cardY}
            onClose={() => setActiveOrb(null)}
            onEnter={() => {
              setLocation(`/archive/${activeOrb.orb.dream.id}`);
            }}
            onResume={() => handleResume(activeOrb.orb.dream.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
