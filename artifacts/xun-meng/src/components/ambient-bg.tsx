import { motion } from "framer-motion";

export type BgTheme = "void" | "rain" | "night" | "fog" | "stars";

// Precomputed rain drops (stable across renders)
const RAIN_DROPS = Array.from({ length: 55 }, (_, i) => ({
  id: i,
  left: (i * 1.857) % 100,
  height: 10 + (i % 5) * 6,
  width: i % 4 === 0 ? 1.5 : 1,
  duration: 0.55 + (i % 7) * 0.06,
  delay: -(i * 0.22) % 2.0,
  opacity: 0.03 + (i % 4) * 0.025,
}));

// Fog orbs
const FOG_ORBS = Array.from({ length: 6 }, (_, i) => ({
  id: i,
  x: [15, 35, 50, 70, 85, 20][i],
  y: [20, 50, 30, 60, 40, 70][i],
  size: [280, 200, 350, 220, 260, 180][i],
  duration: [18, 22, 16, 25, 20, 30][i],
  delay: [0, 4, 8, 2, 12, 6][i],
}));

// Stars
const STARS = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  x: (i * 12.3) % 100,
  y: (i * 7.7) % 100,
  size: i % 4 === 0 ? 2 : 1,
  duration: 2 + (i % 5),
  delay: (i * 0.3) % 4,
  opacity: 0.08 + (i % 5) * 0.06,
}));

interface AmbientBgProps {
  theme: BgTheme;
}

export function AmbientBg({ theme }: AmbientBgProps) {
  if (theme === "void") return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>

      {/* ── RAIN ── */}
      {theme === "rain" && (
        <>
          {/* Dark rain overlay gradient */}
          <div className="absolute inset-0"
            style={{
              background: "radial-gradient(ellipse at 30% 20%, rgba(30,40,80,0.4) 0%, transparent 60%), linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 100%)"
            }}
          />
          {/* Rain streaks */}
          {RAIN_DROPS.map(d => (
            <motion.div
              key={d.id}
              className="absolute top-0 rounded-full"
              style={{
                left: `${d.left}%`,
                width: d.width,
                height: d.height,
                background: "linear-gradient(to bottom, transparent 0%, rgba(180,200,255,0.6) 100%)",
                opacity: d.opacity,
              }}
              animate={{ y: ["0vh", "105vh"] }}
              transition={{
                duration: d.duration,
                repeat: Infinity,
                ease: "linear",
                delay: d.delay,
              }}
            />
          ))}
          {/* Window glass reflection */}
          <div className="absolute inset-0"
            style={{
              background: "radial-gradient(ellipse at 50% 110%, rgba(40,60,120,0.12) 0%, transparent 55%)"
            }}
          />
        </>
      )}

      {/* ── NIGHT ROOM ── */}
      {theme === "night" && (
        <>
          <div className="absolute inset-0"
            style={{
              background: "radial-gradient(ellipse at 20% 80%, rgba(20,30,80,0.35) 0%, transparent 55%), radial-gradient(ellipse at 80% 10%, rgba(60,40,120,0.2) 0%, transparent 45%)"
            }}
          />
          {/* Soft moonlight beam */}
          <motion.div
            className="absolute"
            style={{
              top: 0, left: "55%", width: 180, height: "60%",
              background: "linear-gradient(to bottom, rgba(200,210,255,0.04) 0%, transparent 100%)",
              transform: "skewX(-8deg)",
            }}
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      )}

      {/* ── FOGGY DREAM ── */}
      {theme === "fog" && (
        <>
          {FOG_ORBS.map(orb => (
            <motion.div
              key={orb.id}
              className="absolute rounded-full pointer-events-none"
              style={{
                width: orb.size,
                height: orb.size,
                left: `${orb.x}%`,
                top: `${orb.y}%`,
                transform: "translate(-50%, -50%)",
                background: "radial-gradient(circle, rgba(120,140,200,0.055) 0%, transparent 70%)",
                filter: "blur(40px)",
              }}
              animate={{
                x: [0, 30, -20, 0],
                y: [0, -20, 10, 0],
                opacity: [0.5, 1, 0.7, 0.5],
              }}
              transition={{
                duration: orb.duration,
                repeat: Infinity,
                ease: "easeInOut",
                delay: orb.delay,
              }}
            />
          ))}
        </>
      )}

      {/* ── STARRY NIGHT ── */}
      {theme === "stars" && (
        <>
          {STARS.map(s => (
            <motion.div
              key={s.id}
              className="absolute rounded-full"
              style={{
                width: s.size,
                height: s.size,
                left: `${s.x}%`,
                top: `${s.y}%`,
                background: "white",
                opacity: s.opacity,
              }}
              animate={{ opacity: [s.opacity * 0.4, s.opacity, s.opacity * 0.4] }}
              transition={{
                duration: s.duration,
                repeat: Infinity,
                ease: "easeInOut",
                delay: s.delay,
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}
