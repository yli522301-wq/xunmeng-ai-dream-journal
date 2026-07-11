import { motion } from "framer-motion";
import { RainGlassCanvas } from "./rain-glass-canvas";

export type BgTheme = "void" | "rain" | "night" | "fog" | "stars";

export interface AmbientVisualSettings {
  stars: {
    density: number;
    brightness: number;
    speed: number;
  };
  rain: {
    intensity: number;
    brightness: number;
    speed: number;
  };
}

export const DEFAULT_AMBIENT_VISUAL_SETTINGS: AmbientVisualSettings = {
  stars: {
    density: 1,
    brightness: 1,
    speed: 1,
  },
  rain: {
    intensity: 1,
    brightness: 1,
    speed: 1,
  },
};

// ── Fog orbs (dreamlike floating volumes) ────────────────────────────────
const FOG_ORBS = [
  { id:0, x:10, y:20, s:380, dur:22, del:0,  op:0.11 },
  { id:1, x:62, y:58, s:290, dur:19, del:5,  op:0.09 },
  { id:2, x:80, y:15, s:340, dur:27, del:10, op:0.08 },
  { id:3, x:28, y:72, s:310, dur:21, del:3,  op:0.10 },
  { id:4, x:50, y:42, s:430, dur:32, del:8,  op:0.07 },
  { id:5, x:15, y:55, s:260, dur:17, del:13, op:0.09 },
  { id:6, x:75, y:82, s:320, dur:25, del:6,  op:0.08 },
  { id:7, x:44, y:10, s:250, dur:20, del:16, op:0.10 },
];

const FOG_PARTICLES = Array.from({ length: 32 }, (_, i) => ({
  id: i,
  x: (i * 3.17) % 100,
  y: (i * 4.31) % 100,
  dur: 11 + (i % 9) * 2,
  del: (i * 0.55) % 9,
}));

// ── Stars ─────────────────────────────────────────────────────────────────
// Deterministic pseudo-random helpers so the sky is stable between renders.
function fract(n: number) {
  return n - Math.floor(n);
}

function seeded(i: number, salt: number) {
  return fract(Math.sin(i * 127.1 + salt * 311.7) * 43758.5453);
}

function makeStarLayer(count: number, layer: number) {
  return Array.from({ length: count }, (_, i) => {
    const r1 = seeded(i, layer + 0.11);
    const r2 = seeded(i, layer + 0.37);
    const r3 = seeded(i, layer + 0.73);
    const r4 = seeded(i, layer + 1.19);
    const upperBand = i % 3 === 0;
    const clusterBias = i % 5 === 0 || (layer >= 1 && (i % 3 === 0 || upperBand));
    const x = clusterBias ? -4 + r1 * 108 : r1 * 100;
    const y = clusterBias ? -8 + r2 * 48 : r2 * 100;

    return {
      id: `${layer}-${i}`,
      x,
      y,
      size: layer === 0 ? 0.72 + r3 * 0.98 : layer === 1 ? 1.00 + r3 * 1.42 : 1.28 + r3 * 2.05,
      op: layer === 0 ? 0.34 + r4 * 0.30 : layer === 1 ? 0.48 + r4 * 0.42 : 0.58 + r4 * 0.42,
      dur: 2.4 + r3 * 4.8,
      del: r4 * 5.6,
      blue: r2 > 0.56,
    };
  });
}

const STAR_LAYERS = [
  { id: "far", stars: makeStarLayer(340, 0), scale: 1.18, dur: 150, opacity: 0.96, drift: 18 },
  { id: "mid", stars: makeStarLayer(285, 1), scale: 1.32, dur: 118, opacity: 1.00, drift: -24 },
  { id: "near", stars: makeStarLayer(150, 2), scale: 1.48, dur: 92, opacity: 1.00, drift: 34 },
];

const STAR_DUST = Array.from({ length: 44 }, (_, i) => ({
  id: i,
  x: 6 + seeded(i, 5.2) * 88,
  y: 8 + seeded(i, 8.6) * 84,
  s: 18 + seeded(i, 10.4) * 64,
  op: 0.018 + seeded(i, 12.7) * 0.035,
  dur: 10 + seeded(i, 15.3) * 16,
  del: seeded(i, 17.8) * 8,
}));

const NIGHT_WINDOW_STARS = Array.from({ length: 92 }, (_, i) => ({
  id: i,
  x: 4 + seeded(i, 21.4) * 92,
  y: 2 + seeded(i, 22.8) * 48,
  size: 0.55 + seeded(i, 23.2) * 1.45,
  op: 0.16 + seeded(i, 24.6) * 0.40,
  dur: 3.2 + seeded(i, 25.1) * 5.8,
  del: seeded(i, 26.7) * 6,
}));

const NIGHT_GLIMMERS = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  x: 8 + seeded(i, 27.2) * 84,
  y: 6 + seeded(i, 28.5) * 58,
  dur: 8 + seeded(i, 29.8) * 10,
  del: seeded(i, 30.1) * 9,
}));

const FOG_DREAM_STARS = Array.from({ length: 118 }, (_, i) => ({
  id: i,
  x: -4 + seeded(i, 32.4) * 108,
  y: 0 + seeded(i, 33.9) * 94,
  size: 0.7 + seeded(i, 34.6) * 1.4,
  op: 0.10 + seeded(i, 35.7) * 0.28,
  dur: 5 + seeded(i, 36.8) * 9,
  del: seeded(i, 37.2) * 8,
}));

const FOG_COMETS = Array.from({ length: 9 }, (_, i) => ({
  id: i,
  x: 8 + seeded(i, 38.1) * 80,
  y: 8 + seeded(i, 39.4) * 68,
  dur: 12 + seeded(i, 40.5) * 13,
  del: seeded(i, 41.6) * 11,
}));

interface AmbientBgProps {
  theme: BgTheme;
  settings?: AmbientVisualSettings;
}

export function AmbientBg({ theme, settings = DEFAULT_AMBIENT_VISUAL_SETTINGS }: AmbientBgProps) {
  if (theme === "void") return null;

  const starSettings = settings.stars ?? DEFAULT_AMBIENT_VISUAL_SETTINGS.stars;
  const rainSettings = settings.rain ?? DEFAULT_AMBIENT_VISUAL_SETTINGS.rain;
  const starDensity = Math.max(0.35, Math.min(1.75, starSettings.density));
  const starBrightness = Math.max(0.35, Math.min(1.85, starSettings.brightness));
  const starSpeed = Math.max(0.35, Math.min(2.2, starSettings.speed));

  return (
    <>
      {/* Shared base overlay — pointer-events-none, behind everything */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>

        {/* ── RAIN NIGHT ── city lights through glass (CSS layer) ── */}
        {theme === "rain" && (
          <>
            {/* Deep blue-grey base */}
            <div className="absolute inset-0" style={{
              background: "linear-gradient(to bottom, rgba(8,12,28,0.92) 0%, rgba(5,8,20,0.95) 100%)"
            }} />

            {/* Blurry distant city lights */}
            <div className="absolute inset-0" style={{
              background: `
                radial-gradient(ellipse 160px 100px at 18% 72%, rgba(255,160,60,0.10) 0%, transparent 100%),
                radial-gradient(ellipse 260px 140px at 68% 78%, rgba(255,200,100,0.07) 0%, transparent 100%),
                radial-gradient(ellipse 100px 80px  at 42% 85%, rgba(130,160,255,0.09) 0%, transparent 100%),
                radial-gradient(ellipse 200px 90px  at 82% 65%, rgba(255,140,80,0.06)  0%, transparent 100%),
                radial-gradient(ellipse 80px  60px  at 28% 90%, rgba(220,240,255,0.05) 0%, transparent 100%)
              `,
              filter: "blur(28px)",
            }} />

            {/* Glass tint — semi-transparent dark layer */}
            <div className="absolute inset-0" style={{
              background: "rgba(10,14,30,0.38)",
            }} />

            {/* Very subtle condensation / glass texture gradient */}
            <div className="absolute inset-0" style={{
              background: "linear-gradient(to bottom, rgba(80,100,160,0.04) 0%, transparent 40%, rgba(20,30,70,0.06) 100%)",
            }} />

            {/* Vignette */}
            <div className="absolute inset-0" style={{
              boxShadow: "inset 0 0 130px rgba(0,0,15,0.80)",
            }} />
          </>
        )}

        {/* ── NIGHT ROOM ── */}
        {theme === "night" && (
          <>
            <div className="absolute inset-0" style={{
              background: `
                radial-gradient(ellipse at 72% 6%,  rgba(90,65,170,0.20) 0%, transparent 38%),
                radial-gradient(ellipse at 12% 88%, rgba(20,30,100,0.28) 0%, transparent 55%),
                linear-gradient(160deg, rgba(8,10,35,0.65) 0%, transparent 70%)
              `
            }} />
            {/* Moon */}
            <motion.div className="absolute rounded-full" style={{
              width: 240, height: 240, top: -70, right: -55,
              background: "radial-gradient(circle, rgba(210,220,255,0.13) 0%, rgba(150,175,255,0.05) 45%, transparent 70%)",
              filter: "blur(22px)",
            }}
              animate={{ opacity: [0.5, 0.9, 0.5] }}
              transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute inset-[-8%]"
              style={{
                background: `
                  linear-gradient(90deg,
                    transparent 0%,
                    rgba(135,155,210,0.035) 28%,
                    transparent 36%,
                    transparent 62%,
                    rgba(130,150,205,0.030) 70%,
                    transparent 78%),
                  linear-gradient(180deg, rgba(165,180,235,0.035) 0%, transparent 52%)
                `,
                filter: "blur(1px)",
                mixBlendMode: "screen",
              }}
              animate={{ x: [0, 12, 0], opacity: [0.42, 0.68, 0.42] }}
              transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute inset-[-18%]"
              style={{ transformOrigin: "50% 40%", mixBlendMode: "screen" }}
              animate={{ rotate: [0, 1.4, 0], x: [0, -10, 0] }}
              transition={{ duration: 55, repeat: Infinity, ease: "easeInOut" }}
            >
              {NIGHT_WINDOW_STARS.map(s => (
                <motion.span
                  key={s.id}
                  className="absolute rounded-full"
                  style={{
                    width: s.size,
                    height: s.size,
                    left: `${s.x}%`,
                    top: `${s.y}%`,
                    background: "rgba(218,230,255,0.92)",
                    boxShadow: s.size > 1.4 ? "0 0 8px rgba(170,195,255,0.34)" : "none",
                    opacity: s.op,
                  }}
                  animate={{ opacity: [s.op * 0.24, s.op, s.op * 0.42], scale: [0.82, 1.16, 0.92] }}
                  transition={{ duration: s.dur, repeat: Infinity, ease: "easeInOut", delay: s.del }}
                />
              ))}
            </motion.div>
            {NIGHT_GLIMMERS.map(g => (
              <motion.div
                key={g.id}
                className="absolute rounded-full"
                style={{
                  width: 6,
                  height: 6,
                  left: `${g.x}%`,
                  top: `${g.y}%`,
                  background: "radial-gradient(circle, rgba(225,235,255,0.60) 0%, rgba(145,170,235,0.22) 38%, transparent 72%)",
                  filter: "blur(1.5px)",
                  mixBlendMode: "screen",
                }}
                animate={{ y: [0, 18, 0], opacity: [0, 0.42, 0], scale: [0.7, 1.7, 0.9] }}
                transition={{ duration: g.dur, repeat: Infinity, ease: "easeInOut", delay: g.del }}
              />
            ))}
            <div className="absolute bottom-0 left-0 right-0 h-28" style={{
              background: "linear-gradient(to top, rgba(30,20,65,0.22) 0%, transparent 100%)"
            }} />
            <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 150px rgba(0,0,15,0.78)" }} />
          </>
        )}

        {/* ── FOGGY DREAM ── */}
        {theme === "fog" && (
          <>
            <div className="absolute inset-0" style={{
              background: `
                radial-gradient(ellipse at 50% 38%, rgba(55,75,150,0.18) 0%, transparent 58%),
                linear-gradient(to bottom, rgba(14,18,48,0.50) 0%, rgba(5,8,24,0.60) 100%)
              `
            }} />
            {FOG_ORBS.map(o => (
              <motion.div key={o.id}
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: o.s, height: o.s,
                  left: `${o.x}%`, top: `${o.y}%`,
                  transform: "translate(-50%,-50%)",
                  background: "radial-gradient(circle, rgba(95,125,200,0.07) 0%, transparent 70%)",
                  filter: "blur(55px)",
                }}
                animate={{ x: [0, 45, -32, 0], y: [0, -28, 18, 0], opacity: [o.op * 0.5, o.op, o.op * 0.5] }}
                transition={{ duration: o.dur, repeat: Infinity, ease: "easeInOut", delay: o.del }}
              />
            ))}
            {FOG_PARTICLES.map(p => (
              <motion.div key={p.id}
                className="absolute rounded-full"
                style={{ width: 2, height: 2, left: `${p.x}%`, top: `${p.y}%`, background: "rgba(140,165,225,0.5)" }}
                animate={{ y: ["0px", "-90px"], x: [0, p.id % 2 === 0 ? 22 : -22], opacity: [0, 0.45, 0] }}
                transition={{ duration: p.dur, repeat: Infinity, ease: "easeInOut", delay: p.del }}
              />
            ))}
            <motion.div
              className="absolute inset-[-15%]"
              style={{
                background: `
                  conic-gradient(from 90deg,
                    transparent 0deg,
                    rgba(130,165,220,0.035) 52deg,
                    transparent 112deg,
                    rgba(155,190,235,0.028) 188deg,
                    transparent 252deg,
                    rgba(95,140,220,0.030) 318deg,
                    transparent 360deg)
                `,
                filter: "blur(18px)",
                opacity: 0.8,
                transformOrigin: "50% 50%",
              }}
              animate={{ rotate: -360 }}
              transition={{ duration: 170, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="absolute inset-[-10%]"
              style={{ mixBlendMode: "screen", transformOrigin: "50% 52%" }}
              animate={{ rotate: [0, -2.6, 0], x: [0, 18, 0], y: [0, -10, 0] }}
              transition={{ duration: 42, repeat: Infinity, ease: "easeInOut" }}
            >
              {FOG_DREAM_STARS.map(s => (
                <motion.span
                  key={s.id}
                  className="absolute rounded-full"
                  style={{
                    width: s.size,
                    height: s.size,
                    left: `${s.x}%`,
                    top: `${s.y}%`,
                    background: "rgba(180,215,255,0.84)",
                    boxShadow: s.size > 1.5 ? "0 0 10px rgba(125,170,255,0.30)" : "none",
                    opacity: s.op,
                  }}
                  animate={{ opacity: [0, s.op, s.op * 0.35, 0], scale: [0.55, 1.2, 0.82, 0.55] }}
                  transition={{ duration: s.dur, repeat: Infinity, ease: "easeInOut", delay: s.del }}
                />
              ))}
            </motion.div>
            {FOG_COMETS.map(c => (
              <motion.div
                key={c.id}
                className="absolute rounded-full"
                style={{
                  width: 78,
                  height: 1,
                  left: `${c.x}%`,
                  top: `${c.y}%`,
                  background: "linear-gradient(90deg, transparent 0%, rgba(160,205,255,0.32) 55%, rgba(235,245,255,0.70) 100%)",
                  filter: "blur(0.6px)",
                  transform: "rotate(-18deg)",
                  mixBlendMode: "screen",
                }}
                animate={{ x: [0, -80], y: [0, 26], opacity: [0, 0.55, 0] }}
                transition={{ duration: c.dur, repeat: Infinity, ease: "easeInOut", delay: c.del }}
              />
            ))}
            <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 110px rgba(0,5,30,0.68)" }} />
          </>
        )}

        {/* ── STARRY NIGHT ── */}
        {theme === "stars" && (
          <>
            <div className="absolute inset-0" style={{
              background: `
                radial-gradient(ellipse at 52% 42%, rgba(38,55,108,0.16) 0%, transparent 48%),
                radial-gradient(ellipse at 74% 12%, rgba(45,72,128,0.10) 0%, transparent 34%),
                radial-gradient(ellipse at 20% 76%, rgba(28,42,92,0.12) 0%, transparent 42%),
                linear-gradient(180deg, rgba(0,2,8,0.92) 0%, rgba(2,4,18,0.98) 100%)
              `,
            }} />

            <motion.div
              className="absolute rounded-full"
              style={{
                width: "112vmax",
                height: "112vmax",
                left: "50%",
                top: "50%",
                x: "-50%",
                y: "-50%",
                background: `
                  conic-gradient(from 18deg,
                    transparent 0deg,
                    rgba(78,104,155,0.030) 38deg,
                    transparent 82deg,
                    rgba(110,132,190,0.025) 142deg,
                    transparent 218deg,
                    rgba(76,116,150,0.030) 292deg,
                    transparent 360deg)
                `,
                filter: "blur(22px)",
                opacity: 0.9,
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 190, repeat: Infinity, ease: "linear" }}
            />

            {STAR_DUST.map(d => (
              <motion.div
                key={d.id}
                className="absolute rounded-full"
                style={{
                  width: d.s,
                  height: d.s,
                  left: `${d.x}%`,
                  top: `${d.y}%`,
                  background: "radial-gradient(circle, rgba(190,210,255,0.22) 0%, rgba(110,145,210,0.08) 34%, transparent 72%)",
                  filter: "blur(7px)",
                  opacity: d.op * starBrightness,
                }}
                animate={{
                  opacity: [d.op * 0.35 * starBrightness, d.op * starBrightness, d.op * 0.55 * starBrightness],
                  scale: [0.82, 1.16, 0.92],
                }}
                transition={{ duration: d.dur / starSpeed, repeat: Infinity, ease: "easeInOut", delay: d.del }}
              />
            ))}

            {STAR_LAYERS.map(layer => (
              <motion.div
                key={layer.id}
                className="absolute"
                style={{
                  inset: "-24%",
                  opacity: Math.min(1, layer.opacity * (0.82 + starBrightness * 0.18)),
                  transformOrigin: "50% 50%",
                  mixBlendMode: "screen",
                }}
                animate={{
                  rotate: layer.id === "mid" ? -360 : 360,
                  x: [0, layer.drift, 0],
                  y: [0, layer.drift * 0.34, 0],
                }}
                transition={{
                  rotate: { duration: layer.dur / starSpeed, repeat: Infinity, ease: "linear" },
                  x: { duration: (layer.dur * 0.42) / starSpeed, repeat: Infinity, ease: "easeInOut" },
                  y: { duration: (layer.dur * 0.50) / starSpeed, repeat: Infinity, ease: "easeInOut" },
                }}
              >
                {layer.stars.slice(0, Math.round(layer.stars.length * starDensity)).map(s => (
                  <motion.span
                    key={s.id}
                    className="absolute rounded-full"
                    style={{
                      width: s.size,
                      height: s.size,
                      left: `${s.x}%`,
                      top: `${s.y}%`,
                      background: s.blue ? "rgba(165,196,255,0.98)" : "rgba(245,249,255,0.98)",
                      boxShadow: s.size > 1.55
                        ? `0 0 ${5 + s.size * 3.8}px ${s.blue ? "rgba(130,165,255,0.52)" : "rgba(235,242,255,0.46)"}`
                        : "none",
                      opacity: Math.min(1, s.op * starBrightness),
                    }}
                    animate={{
                      opacity: [
                        Math.min(1, s.op * 0.32 * starBrightness),
                        Math.min(1, s.op * starBrightness),
                        Math.min(1, s.op * 0.48 * starBrightness),
                      ],
                      scale: [0.72, 1.18, 0.84],
                    }}
                    transition={{ duration: s.dur / starSpeed, repeat: Infinity, ease: "easeInOut", delay: s.del }}
                  />
                ))}
              </motion.div>
            ))}

            <motion.div
              className="absolute inset-0"
              style={{
                background: `
                  radial-gradient(ellipse at 50% 50%, transparent 0%, transparent 52%, rgba(0,0,8,0.12) 100%),
                  radial-gradient(ellipse at 50% 118%, rgba(20,31,70,0.14) 0%, transparent 42%)
                `,
                boxShadow: "inset 0 0 130px rgba(0,0,10,0.54)",
              }}
              animate={{ opacity: [0.82, 0.96, 0.82] }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            />
          </>
        )}
      </div>

      {/* ── Rain canvas — separate layer so it renders on top ── */}
      {theme === "rain" && (
        <RainGlassCanvas
          intensity={rainSettings.intensity}
          brightness={rainSettings.brightness}
          speed={rainSettings.speed}
        />
      )}
    </>
  );
}
