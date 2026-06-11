import { motion } from "framer-motion";
import { RainGlassCanvas } from "./rain-glass-canvas";

export type BgTheme = "void" | "rain" | "night" | "fog" | "stars";

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
const STARS = Array.from({ length: 140 }, (_, i) => ({
  id: i,
  x:   (i * 8.13) % 100,
  y:   (i * 5.71) % 100,
  size: i % 9 === 0 ? 2 : i % 4 === 0 ? 1.5 : 1,
  dur:  2.5 + (i % 6),
  del:  (i * 0.27) % 5.5,
  op:   0.05 + (i % 7) * 0.07,
}));

interface AmbientBgProps { theme: BgTheme }

export function AmbientBg({ theme }: AmbientBgProps) {
  if (theme === "void") return null;

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
            <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 110px rgba(0,5,30,0.68)" }} />
          </>
        )}

        {/* ── STARRY NIGHT ── */}
        {theme === "stars" && (
          <>
            <div className="absolute" style={{
              top: "-8%", left: "-12%", width: 650, height: 420,
              background: "radial-gradient(ellipse, rgba(75,38,155,0.11) 0%, transparent 65%)",
              filter: "blur(45px)",
            }} />
            <div className="absolute" style={{
              bottom: "4%", right: "-7%", width: 420, height: 320,
              background: "radial-gradient(ellipse, rgba(38,78,155,0.09) 0%, transparent 65%)",
              filter: "blur(38px)",
            }} />
            {STARS.map(s => (
              <motion.div key={s.id}
                className="absolute rounded-full"
                style={{
                  width: s.size, height: s.size,
                  left: `${s.x}%`, top: `${s.y}%`,
                  background: s.size >= 2 ? "rgba(210,220,255,0.92)" : "white",
                  opacity: s.op,
                }}
                animate={{ opacity: [s.op * 0.3, s.op, s.op * 0.3] }}
                transition={{ duration: s.dur, repeat: Infinity, ease: "easeInOut", delay: s.del }}
              />
            ))}
            <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 165px rgba(0,0,10,0.72)" }} />
          </>
        )}
      </div>

      {/* ── Rain canvas — separate layer so it renders on top ── */}
      {theme === "rain" && <RainGlassCanvas />}
    </>
  );
}
