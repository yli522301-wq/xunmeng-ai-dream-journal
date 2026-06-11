import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type CompanionColor = 'amber' | 'indigo' | 'teal' | 'purple';

interface CompanionOrbProps {
  size?: "lg" | "sm" | "xs";
  isSpeaking?: boolean;
  isThinking?: boolean;
  isListening?: boolean;
  color?: CompanionColor;
  className?: string;
  onTap?: () => void;
}

const COLOR_MAP: Record<CompanionColor, { h: string; glow: string; particle: string }> = {
  amber:  { h: "38 90% 60%",   glow: "rgba(245,166,35,",   particle: "rgba(255,210,80," },
  indigo: { h: "240 70% 65%",  glow: "rgba(92,107,192,",   particle: "rgba(140,160,255," },
  teal:   { h: "185 70% 55%",  glow: "rgba(77,208,225,",   particle: "rgba(100,230,220," },
  purple: { h: "255 90% 70%",  glow: "rgba(140,82,255,",   particle: "rgba(180,130,255," },
};

// Stable pre-generated particles (deterministic, no Math.random at render time)
const PARTICLES = [
  { id:0,  ax:  0.82, ay: -0.57, r: 1.00, dur: 5.2, del: 0.0,  op: 0.55 },
  { id:1,  ax: -0.34, ay:  0.94, r: 0.88, dur: 6.8, del: 0.5,  op: 0.40 },
  { id:2,  ax:  0.60, ay:  0.80, r: 1.10, dur: 4.5, del: 1.0,  op: 0.65 },
  { id:3,  ax: -0.95, ay: -0.31, r: 0.75, dur: 7.2, del: 1.4,  op: 0.35 },
  { id:4,  ax:  0.18, ay: -0.98, r: 1.20, dur: 5.8, del: 0.3,  op: 0.50 },
  { id:5,  ax: -0.71, ay:  0.71, r: 0.92, dur: 6.1, del: 2.0,  op: 0.45 },
  { id:6,  ax:  0.98, ay:  0.20, r: 0.80, dur: 8.0, del: 0.8,  op: 0.30 },
  { id:7,  ax: -0.45, ay: -0.89, r: 1.05, dur: 4.9, del: 1.7,  op: 0.60 },
  { id:8,  ax:  0.30, ay:  0.95, r: 0.70, dur: 6.5, del: 2.5,  op: 0.38 },
  { id:9,  ax: -0.87, ay:  0.49, r: 1.15, dur: 5.4, del: 0.6,  op: 0.52 },
  { id:10, ax:  0.54, ay: -0.84, r: 0.85, dur: 7.5, del: 1.2,  op: 0.42 },
  { id:11, ax: -0.14, ay:  0.99, r: 1.00, dur: 6.0, del: 2.2,  op: 0.48 },
];

export function CompanionOrb({
  size = "lg",
  isSpeaking = false,
  isThinking = false,
  isListening = false,
  color = 'purple',
  className,
  onTap,
}: CompanionOrbProps) {
  const [tapped, setTapped] = useState(false);

  const c = COLOR_MAP[color];

  const orbPx = size === "lg" ? 200 : size === "sm" ? 48 : 20;
  const halfOrb = orbPx / 2;

  const handleTap = () => {
    setTapped(true);
    setTimeout(() => setTapped(false), 600);
    onTap?.();
  };

  const isActive = isSpeaking || isListening;

  return (
    <div
      className={cn("relative flex items-center justify-center select-none", className)}
      style={{ width: orbPx, height: orbPx }}
    >
      {/* Floating particles — only on lg */}
      {size === "lg" && PARTICLES.map(p => {
        const baseX = p.ax * halfOrb * p.r;
        const baseY = p.ay * halfOrb * p.r;
        const driftX = -p.ay * 8 * (isActive ? 1.8 : 1);
        const driftY =  p.ax * 8 * (isActive ? 1.8 : 1);
        const particleSize = p.id % 3 === 0 ? 2.5 : p.id % 3 === 1 ? 2 : 1.5;
        const activeOp = isSpeaking ? p.op * 1.6 : isListening ? p.op * 1.3 : p.op;

        return (
          <motion.div
            key={p.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: particleSize,
              height: particleSize,
              backgroundColor: `${c.particle}${activeOp})`,
              left: halfOrb - particleSize / 2,
              top:  halfOrb - particleSize / 2,
              filter: "blur(0.4px)",
            }}
            animate={{
              x: [baseX, baseX + driftX, baseX - driftX * 0.5, baseX],
              y: [baseY, baseY + driftY, baseY - driftY * 0.5, baseY],
              opacity: [activeOp * 0.4, activeOp, activeOp * 0.6, activeOp * 0.4],
              scale: isSpeaking ? [1, 1.6, 1] : [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: p.dur * (isSpeaking ? 0.6 : isListening ? 0.8 : 1),
              repeat: Infinity,
              ease: "easeInOut",
              delay: p.del,
            }}
          />
        );
      })}

      {/* Tap ripple */}
      <AnimatePresence>
        {tapped && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ border: `1px solid ${c.glow}0.6)` }}
            initial={{ scale: 1, opacity: 0.7 }}
            animate={{ scale: 2.2, opacity: 0 }}
            exit={{}}
            transition={{ duration: 0.55, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {/* Outer pulse ring — active states only */}
      <motion.div
        className="absolute inset-[-12%] rounded-full pointer-events-none"
        style={{ border: `1px solid ${c.glow}0.22)` }}
        animate={{
          scale:   isSpeaking ? [1.0, 1.25, 1.0] : isListening ? [1.0, 1.15, 1.0] : [1.0, 1.08, 1.0],
          opacity: isSpeaking ? [0.15, 0.35, 0.15] : isListening ? [0.1, 0.28, 0.1] : [0, 0.12, 0],
        }}
        transition={{ duration: isSpeaking ? 1.8 : isListening ? 2.2 : 5, ease: "easeInOut", repeat: Infinity }}
      />

      {/* Mid glow ring */}
      <motion.div
        className="absolute inset-[-4%] rounded-full pointer-events-none"
        style={{ border: `1px solid ${c.glow}0.3)` }}
        animate={{
          scale:   isSpeaking ? [1.0, 1.15, 1.0] : isListening ? [1.0, 1.10, 1.0] : [1.0, 1.04, 1.0],
          opacity: isSpeaking ? [0.2, 0.5, 0.2] : isListening ? [0.15, 0.35, 0.15] : [0.05, 0.18, 0.05],
        }}
        transition={{ duration: isSpeaking ? 1.4 : isListening ? 1.8 : 6, ease: "easeInOut", repeat: Infinity, delay: 0.4 }}
      />

      {/* Main orb — clickable */}
      <motion.div
        className="absolute inset-0 rounded-full cursor-pointer"
        style={{
          background: `radial-gradient(circle at 40% 35%,
            hsl(${c.h} / 0.92) 0%,
            hsl(${c.h} / 0.55) 35%,
            hsl(${c.h} / 0.18) 65%,
            transparent 85%)`,
          boxShadow: `0 0 ${isSpeaking ? 60 : isListening ? 45 : 30}px ${c.glow}${isSpeaking ? 0.35 : isListening ? 0.25 : 0.18}),
                      0 0 ${isSpeaking ? 120 : isListening ? 90 : 60}px ${c.glow}${isSpeaking ? 0.12 : isListening ? 0.09 : 0.06})`,
        }}
        animate={{
          scale: tapped
            ? [1.0, 1.18, 0.96, 1.04, 1.0]
            : isSpeaking
            ? [0.93, 1.07, 0.93]
            : isThinking
            ? [0.97, 1.03, 0.97]
            : isListening
            ? [0.95, 1.05, 0.95]
            : [0.96, 1.03, 0.96],
          opacity: isSpeaking ? [0.82, 1.0, 0.82] : [0.88, 1.0, 0.88],
          rotate: isThinking ? 360 : 0,
        }}
        transition={
          tapped
            ? { duration: 0.55, ease: "easeOut" }
            : {
                scale:   { duration: isSpeaking ? 1.4 : isListening ? 2.0 : 3.8, ease: "easeInOut", repeat: Infinity },
                opacity: { duration: isSpeaking ? 1.4 : 4, ease: "easeInOut", repeat: Infinity },
                rotate:  { duration: 12, ease: "linear", repeat: Infinity },
              }
        }
        onTap={handleTap}
        whileHover={size === "lg" ? { scale: 1.06 } : {}}
      />

      {/* Floating highlight */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: "28%",
          height: "22%",
          top: "18%",
          left: "26%",
          background: `radial-gradient(ellipse, rgba(255,255,255,0.22) 0%, transparent 80%)`,
          filter: "blur(2px)",
        }}
        animate={{ opacity: [0.4, 0.75, 0.4], y: [0, -2, 0] }}
        transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
      />

      {/* Center sparkle — lg only */}
      {size === "lg" && (
        <motion.span
          className="relative z-10 text-white/80 pointer-events-none"
          style={{ fontSize: 22, lineHeight: 1, mixBlendMode: "overlay" }}
          animate={{
            scale:   isSpeaking ? [0.85, 1.25, 0.85] : isThinking ? [1, 1.1, 1] : [0.95, 1.05, 0.95],
            opacity: isSpeaking ? [0.6, 1.0, 0.6] : isThinking ? [0.4, 0.9, 0.4] : [0.5, 0.8, 0.5],
          }}
          transition={{ duration: isSpeaking ? 1.2 : isThinking ? 1.8 : 4, ease: "easeInOut", repeat: Infinity }}
        >
          ✦
        </motion.span>
      )}
    </div>
  );
}
