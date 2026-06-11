import { motion } from "framer-motion";

export type BgTheme = "void" | "rain" | "night" | "fog" | "stars";

// ── Rain ──────────────────────────────────────────────────────────────────
const RAIN = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  left:   (i * 1.27) % 100,
  height: 8 + (i % 7) * 7,
  width:  i % 5 === 0 ? 1.5 : 1,
  speed:  0.48 + (i % 8) * 0.055,
  delay:  -(i * 0.19) % 2.2,
  opacity: 0.025 + (i % 5) * 0.022,
}));

// Slow "glass drips" — thick drops near bottom of screen
const GLASS_DRIPS = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  left:  (i * 7.3) % 100,
  speed: 3.5 + (i % 4) * 0.8,
  delay: -(i * 0.6) % 4,
  opacity: 0.045 + (i % 3) * 0.02,
}));

// ── Stars ─────────────────────────────────────────────────────────────────
const STARS = Array.from({ length: 130 }, (_, i) => ({
  id: i,
  x: (i * 8.31) % 100,
  y: (i * 5.77) % 100,
  size: i % 8 === 0 ? 2 : i % 4 === 0 ? 1.5 : 1,
  dur:  2.5 + (i % 6),
  del:  (i * 0.28) % 5,
  op:   0.06 + (i % 6) * 0.07,
}));

// ── Fog orbs ──────────────────────────────────────────────────────────────
const FOG_ORBS = [
  { id:0, x:10,  y:20,  s:380, dur:22, del:0,  op:0.10 },
  { id:1, x:60,  y:60,  s:280, dur:18, del:5,  op:0.08 },
  { id:2, x:80,  y:15,  s:340, dur:26, del:10, op:0.07 },
  { id:3, x:30,  y:70,  s:300, dur:20, del:3,  op:0.09 },
  { id:4, x:50,  y:40,  s:420, dur:30, del:8,  op:0.06 },
  { id:5, x:15,  y:50,  s:260, dur:16, del:12, op:0.08 },
  { id:6, x:75,  y:80,  s:320, dur:24, del:6,  op:0.07 },
  { id:7, x:45,  y:10,  s:240, dur:19, del:15, op:0.09 },
];

// Fog floating particles
const FOG_PARTICLES = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  x: (i * 3.33) % 100,
  y: (i * 4.11) % 100,
  dur: 12 + (i % 8) * 2,
  del: (i * 0.5) % 8,
}));

interface AmbientBgProps { theme: BgTheme }

export function AmbientBg({ theme }: AmbientBgProps) {
  if (theme === "void") return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>

      {/* ── RAIN ── */}
      {theme === "rain" && (
        <>
          {/* Blue-grey cold cast */}
          <div className="absolute inset-0" style={{
            background: `
              radial-gradient(ellipse at 40% 0%, rgba(30,50,100,0.55) 0%, transparent 55%),
              linear-gradient(to bottom, rgba(10,20,50,0.5) 0%, rgba(5,5,20,0.2) 100%)
            `,
          }} />

          {/* Rain streaks */}
          {RAIN.map(d => (
            <motion.div key={d.id}
              className="absolute top-0 rounded-full"
              style={{
                left: `${d.left}%`, width: d.width, height: d.height,
                background: "linear-gradient(to bottom, transparent, rgba(170,200,255,0.7))",
                opacity: d.opacity,
              }}
              animate={{ y: ["0vh", "106vh"] }}
              transition={{ duration: d.speed, repeat: Infinity, ease: "linear", delay: d.delay }}
            />
          ))}

          {/* Glass drip effect (slow thick drops near bottom half) */}
          {GLASS_DRIPS.map(d => (
            <motion.div key={d.id}
              className="absolute rounded-full"
              style={{
                top: "45%", left: `${d.left}%`,
                width: 2.5, height: 18,
                background: "linear-gradient(to bottom, transparent, rgba(200,220,255,0.45))",
                opacity: d.opacity,
              }}
              animate={{ y: ["0px", "200px"], opacity: [d.opacity, d.opacity, 0] }}
              transition={{ duration: d.speed, repeat: Infinity, ease: "easeIn", delay: d.delay }}
            />
          ))}

          {/* Bottom glass reflection pool */}
          <div className="absolute bottom-0 left-0 right-0 h-40" style={{
            background: "linear-gradient(to top, rgba(40,70,140,0.18) 0%, transparent 100%)",
          }} />

          {/* Window vignette: dark edges */}
          <div className="absolute inset-0" style={{
            boxShadow: "inset 0 0 120px rgba(0,0,20,0.7)",
          }} />
        </>
      )}

      {/* ── NIGHT ROOM ── */}
      {theme === "night" && (
        <>
          {/* Deep indigo-blue cast */}
          <div className="absolute inset-0" style={{
            background: `
              radial-gradient(ellipse at 70% 8%, rgba(80,60,160,0.22) 0%, transparent 40%),
              radial-gradient(ellipse at 15% 90%, rgba(20,30,100,0.30) 0%, transparent 55%),
              linear-gradient(160deg, rgba(8,10,35,0.6) 0%, transparent 70%)
            `,
          }} />

          {/* Moon glow — top right */}
          <motion.div className="absolute rounded-full" style={{
            width: 220, height: 220,
            top: -60, right: -40,
            background: "radial-gradient(circle, rgba(200,210,255,0.12) 0%, rgba(150,170,255,0.06) 40%, transparent 70%)",
            filter: "blur(20px)",
          }}
            animate={{ opacity: [0.5, 0.9, 0.5] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Floor-level subtle warmth */}
          <div className="absolute bottom-0 left-0 right-0 h-24" style={{
            background: "linear-gradient(to top, rgba(30,20,60,0.25) 0%, transparent 100%)",
          }} />

          {/* Strong vignette */}
          <div className="absolute inset-0" style={{
            boxShadow: "inset 0 0 140px rgba(0,0,15,0.75)",
          }} />
        </>
      )}

      {/* ── FOGGY DREAM ── */}
      {theme === "fog" && (
        <>
          {/* Blue-grey fog base */}
          <div className="absolute inset-0" style={{
            background: `
              radial-gradient(ellipse at 50% 40%, rgba(60,80,150,0.20) 0%, transparent 60%),
              linear-gradient(to bottom, rgba(15,20,50,0.45) 0%, rgba(5,8,25,0.55) 100%)
            `,
          }} />

          {/* Large fog volumes */}
          {FOG_ORBS.map(o => (
            <motion.div key={o.id}
              className="absolute rounded-full pointer-events-none"
              style={{
                width: o.s, height: o.s,
                left: `${o.x}%`, top: `${o.y}%`,
                transform: "translate(-50%,-50%)",
                background: "radial-gradient(circle, rgba(100,130,200,0.07) 0%, transparent 70%)",
                filter: "blur(50px)",
              }}
              animate={{ x: [0, 40, -30, 0], y: [0, -25, 15, 0], opacity: [o.op * 0.5, o.op, o.op * 0.5] }}
              transition={{ duration: o.dur, repeat: Infinity, ease: "easeInOut", delay: o.del }}
            />
          ))}

          {/* Floating micro-particles */}
          {FOG_PARTICLES.map(p => (
            <motion.div key={p.id}
              className="absolute rounded-full"
              style={{
                width: 2, height: 2,
                left: `${p.x}%`, top: `${p.y}%`,
                background: "rgba(150,170,230,0.5)",
              }}
              animate={{
                y: ["0px", "-80px"],
                x: [0, (p.id % 2 === 0 ? 20 : -20)],
                opacity: [0, 0.4, 0],
              }}
              transition={{ duration: p.dur, repeat: Infinity, ease: "easeInOut", delay: p.del }}
            />
          ))}

          {/* Fog top diffusion */}
          <div className="absolute inset-0" style={{
            boxShadow: "inset 0 0 100px rgba(0,5,30,0.65)",
          }} />
        </>
      )}

      {/* ── STARRY NIGHT ── */}
      {theme === "stars" && (
        <>
          {/* Nebula glow — upper left */}
          <div className="absolute" style={{
            top: "-5%", left: "-10%", width: 600, height: 400,
            background: "radial-gradient(ellipse, rgba(80,40,160,0.12) 0%, transparent 65%)",
            filter: "blur(40px)",
          }} />
          {/* Nebula glow — lower right */}
          <div className="absolute" style={{
            bottom: "5%", right: "-5%", width: 400, height: 300,
            background: "radial-gradient(ellipse, rgba(40,80,160,0.10) 0%, transparent 65%)",
            filter: "blur(35px)",
          }} />

          {/* Stars */}
          {STARS.map(s => (
            <motion.div key={s.id}
              className="absolute rounded-full"
              style={{
                width: s.size, height: s.size,
                left: `${s.x}%`, top: `${s.y}%`,
                background: s.size >= 2 ? "rgba(200,210,255,0.9)" : "white",
                opacity: s.op,
              }}
              animate={{ opacity: [s.op * 0.3, s.op, s.op * 0.3] }}
              transition={{ duration: s.dur, repeat: Infinity, ease: "easeInOut", delay: s.del }}
            />
          ))}

          {/* Subtle vignette */}
          <div className="absolute inset-0" style={{
            boxShadow: "inset 0 0 160px rgba(0,0,10,0.7)",
          }} />
        </>
      )}
    </div>
  );
}
