import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type CompanionColor = "amber" | "indigo" | "teal" | "purple";

interface CompanionOrbProps {
  size?: "lg" | "sm" | "xs";
  isSpeaking?: boolean;
  isThinking?: boolean;
  isListening?: boolean;
  color?: CompanionColor;
  className?: string;
  onTap?: () => void;
}

const COLOR_MAP: Record<CompanionColor, {
  h: string;
  glow: string;
  rgb: [number, number, number];
  tint: [number, number, number];
}> = {
  amber:  { h: "38 90% 60%",  glow: "rgba(245,166,35,",  rgb: [218, 196, 156], tint: [238, 177, 88] },
  indigo: { h: "232 72% 67%", glow: "rgba(92,107,192,",  rgb: [190, 194, 218], tint: [126, 146, 255] },
  teal:   { h: "185 70% 55%", glow: "rgba(77,208,225,",  rgb: [185, 212, 216], tint: [94, 222, 214] },
  purple: { h: "258 84% 70%", glow: "rgba(140,82,255,",  rgb: [202, 194, 220], tint: [165, 126, 255] },
};

type SpherePoint = {
  seed: number;
  theta: number;
  phi: number;
  band: number;
  meridian: number;
  baseAlpha: number;
};

function makeSpherePoints(latCount: number, lonCount: number): SpherePoint[] {
  const points: SpherePoint[] = [];
  let seed = 1;
  for (let i = 1; i < latCount; i += 1) {
    const v = i / latCount;
    const phi = v * Math.PI;
    const rowScale = Math.sin(phi);
    const rowLon = Math.max(12, Math.round(lonCount * rowScale));
    for (let j = 0; j < rowLon; j += 1) {
      points.push({
        seed,
        theta: (j / rowLon) * Math.PI * 2,
        phi,
        band: v,
        meridian: j / rowLon,
        baseAlpha: 0.40 + rowScale * 0.38,
      });
      seed += 1;
    }
  }
  return points;
}

const LARGE_SPHERE = makeSpherePoints(46, 92);
const SMALL_SPHERE = makeSpherePoints(14, 28);

export function CompanionOrb({
  size = "lg",
  isSpeaking = false,
  isThinking = false,
  isListening = false,
  color = "purple",
  className,
  onTap,
}: CompanionOrbProps) {
  const [tapped, setTapped] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ isSpeaking, isThinking, isListening, color });

  const c = COLOR_MAP[color];
  const orbPx = size === "lg" ? 400 : size === "sm" ? 48 : 20;

  const handleTap = () => {
    setTapped(true);
    setTimeout(() => setTapped(false), 600);
    onTap?.();
  };

  useEffect(() => {
    stateRef.current = { isSpeaking, isThinking, isListening, color };
  }, [isSpeaking, isThinking, isListening, color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let raf = 0;
    const points = size === "lg" ? LARGE_SPHERE : SMALL_SPHERE;

    const resize = () => {
      const dpr = Math.min(1.75, Math.max(1, window.devicePixelRatio || 1));
      canvas.width = Math.round(orbPx * dpr);
      canvas.height = Math.round(orbPx * dpr);
      canvas.style.width = `${orbPx}px`;
      canvas.style.height = `${orbPx}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (nowMs: number) => {
      const now = nowMs * 0.001;
      const state = stateRef.current;
      const palette = COLOR_MAP[state.color];
      const active = state.isSpeaking;
      const cx = orbPx / 2;
      const cy = orbPx / 2;
      const baseR = orbPx * (size === "lg" ? 0.405 : 0.34);
      const breath = active ? 1 + Math.sin(now * 6.6) * 0.046 : 1;
      const rotY = active ? now * 0.42 : now * 0.045;
      const rotX = active ? -0.18 + Math.sin(now * 0.7) * 0.035 : -0.18;
      const wavePower = active ? 0.18 : 0;

      ctx.clearRect(0, 0, orbPx, orbPx);

      const bgGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbPx * 0.55);
      bgGlow.addColorStop(0, `rgba(${palette.tint[0]},${palette.tint[1]},${palette.tint[2]},0.045)`);
      bgGlow.addColorStop(0.72, `rgba(${palette.tint[0]},${palette.tint[1]},${palette.tint[2]},0.018)`);
      bgGlow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bgGlow;
      ctx.fillRect(0, 0, orbPx, orbPx);

      const rendered = points.map(p => {
        const speakWave =
          Math.sin(p.theta * 6.5 + now * 8.6 + p.band * 2.2) * 0.50 +
          Math.sin(p.phi * 10.5 - now * 6.9 + p.meridian * 5.0) * 0.34 +
          Math.sin((p.theta - p.phi) * 4.7 + now * 4.1) * 0.26 +
          Math.sin(p.theta * 13.0 + p.phi * 5.0 - now * 10.8) * 0.18;
        const rimWeight = Math.pow(Math.sin(p.phi), 1.7);
        const edgeRipple = speakWave * wavePower * rimWeight;
        const r = baseR * breath * (1 + edgeRipple);

        let x = Math.sin(p.phi) * Math.cos(p.theta + rotY) * r;
        let y = Math.cos(p.phi) * r;
        let z = Math.sin(p.phi) * Math.sin(p.theta + rotY) * r;

        const y2 = y * Math.cos(rotX) - z * Math.sin(rotX);
        const z2 = y * Math.sin(rotX) + z * Math.cos(rotX);
        y = y2;
        z = z2;

        const depth = (z / baseR + 1) / 2;
        const perspective = 0.82 + depth * 0.24;
        const rim = Math.min(1, Math.abs(x) / (baseR * 0.94));
        const topLight = Math.max(0, -y / baseR);
        const meridianFade = 0.64 + Math.pow(Math.sin(p.meridian * Math.PI * 10 + now * 0.25), 2) * 0.16;
        const alpha = (0.13 + depth * 0.50 + rim * 0.36 + topLight * 0.12) * p.baseAlpha * meridianFade;
        const tintMix = active ? 0.42 : 0.25;
        const rCol = palette.rgb[0] * (1 - tintMix) + palette.tint[0] * tintMix;
        const gCol = palette.rgb[1] * (1 - tintMix) + palette.tint[1] * tintMix;
        const bCol = palette.rgb[2] * (1 - tintMix) + palette.tint[2] * tintMix;

        return {
          x: cx + x * perspective,
          y: cy + y * perspective,
          z,
          alpha,
          size: (size === "lg" ? 0.76 : 0.46) * (0.55 + depth * 0.80 + rim * 0.34) * (active ? 1.10 : 1),
          color: [rCol, gCol, bCol] as [number, number, number],
        };
      }).sort((a, b) => a.z - b.z);

      ctx.globalCompositeOperation = "lighter";
      for (const p of rendered) {
        const [r, g, b] = p.color;
        ctx.globalAlpha = Math.max(0.034, Math.min(0.72, p.alpha));
        ctx.fillStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      if (active && size === "lg") {
        ctx.globalCompositeOperation = "screen";
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i += 1) {
          const pulse = 1 + Math.sin(now * 4.7 + i * 1.1) * 0.025;
          ctx.globalAlpha = state.isSpeaking ? 0.12 - i * 0.026 : 0.065 - i * 0.014;
          ctx.strokeStyle = `rgb(${palette.tint[0]},${palette.tint[1]},${palette.tint[2]})`;
          ctx.beginPath();
          for (let a = 0; a <= Math.PI * 2 + 0.05; a += 0.055) {
            const wave =
              Math.sin(a * 7.0 + now * 8.4 + i) * 6.2 +
              Math.sin(a * 13.0 - now * 5.9 + i * 0.7) * 3.2 +
              Math.sin(a * 4.0 + now * 3.6) * 2.0;
            const rr = baseR * (0.99 + i * 0.035) * pulse + wave;
            const x = cx + Math.cos(a) * rr;
            const y = cy + Math.sin(a) * rr * 0.93;
            if (a === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(draw);
    };

    resize();
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [orbPx, size]);

  return (
    <div
      className={cn("relative flex items-center justify-center select-none", className)}
      style={{ width: orbPx, height: orbPx }}
    >
      <AnimatePresence>
        {tapped && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ border: `1px solid ${c.glow}0.52)` }}
            initial={{ scale: 0.92, opacity: 0.5 }}
            animate={{ scale: 1.42, opacity: 0 }}
            exit={{}}
            transition={{ duration: 0.55, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      <motion.div
        className="absolute inset-0 rounded-full cursor-pointer"
        style={{ background: "transparent" }}
        animate={{
          scale: tapped
            ? [1.0, 1.08, 0.985, 1.0]
            : isSpeaking
            ? [0.992, 1.022, 0.992]
            : 1,
        }}
        transition={
          tapped
            ? { duration: 0.5, ease: "easeOut" }
            : { duration: isSpeaking ? 1.35 : 0.2, ease: "easeInOut", repeat: isSpeaking ? Infinity : 0 }
        }
        onTap={handleTap}
        whileHover={size === "lg" ? { scale: 1.018 } : {}}
      />

      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          zIndex: 6,
          mixBlendMode: "screen",
          filter: "contrast(1.04) saturate(0.92)",
        }}
      />
    </div>
  );
}
