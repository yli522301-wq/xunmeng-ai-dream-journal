import { useEffect, useRef } from "react";

interface MineradioParticlesProps {
  playing?: boolean;
  cover?: string | null;
  opacity?: number;
  colors?: {
    primary?: string;
    secondary?: string;
    highlight?: string;
    glow?: string;
  };
}

interface Particle {
  seed: number;
  x: number;
  y: number;
  lane: number;
  z: number;
  size: number;
}

function hexToRgb(hex?: string, fallback = "#9cffdf") {
  let value = String(hex || fallback).trim();
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    value = `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  if (!/^#[0-9a-f]{6}$/i.test(value)) value = fallback;
  return {
    r: parseInt(value.slice(1, 3), 16),
    g: parseInt(value.slice(3, 5), 16),
    b: parseInt(value.slice(5, 7), 16),
  };
}

function rgba(hex: string | undefined, alpha: number) {
  const c = hexToRgb(hex);
  return `rgba(${c.r},${c.g},${c.b},${alpha})`;
}

function rand(seed: number) {
  return Math.abs(Math.sin(seed * 3187.917) * 43758.5453) % 1;
}

export function MineradioParticles({
  playing = false,
  cover = null,
  opacity = 0.58,
  colors,
}: MineradioParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ playing, cover, opacity, colors });

  useEffect(() => {
    stateRef.current = { playing, cover, opacity, colors };
  }, [playing, cover, opacity, colors]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let width = 1;
    let height = 1;
    let dpr = 1;
    let raf = 0;
    let coverImg: HTMLImageElement | null = null;
    let coverSrc = "";
    const particles: Particle[] = [];

    const ensureParticles = () => {
      const target = Math.min(560, Math.max(260, Math.round((window.innerWidth * window.innerHeight) / 6200)));
      while (particles.length < target) {
        const i = particles.length + 1;
        particles.push({
          seed: i * 11.37,
          x: rand(i),
          y: rand(i * 2.7),
          lane: rand(i * 5.9),
          z: rand(i * 8.1),
          size: 0.45 + rand(i * 4.2) * 1.9,
        });
      }
      if (particles.length > target + 80) particles.length = target;
    };

    const resize = () => {
      dpr = Math.min(1.35, Math.max(1, window.devicePixelRatio || 1));
      width = Math.max(1, Math.floor(window.innerWidth * dpr));
      height = Math.max(1, Math.floor(window.innerHeight * dpr));
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ensureParticles();
    };

    const syncCover = () => {
      const src = stateRef.current.cover || "";
      if (src === coverSrc) return;
      coverSrc = src;
      coverImg = null;
      if (!src) return;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (coverSrc === src) coverImg = img;
      };
      img.onerror = () => {
        if (coverSrc === src) coverImg = null;
      };
      img.src = src;
    };

    const drawCover = (now: number) => {
      if (!coverImg) return;
      const side = Math.min(window.innerWidth, window.innerHeight) * (0.36 + Math.sin(now * 0.21) * 0.012);
      const x = window.innerWidth * 0.5 - side * 0.5;
      const y = window.innerHeight * 0.5 - side * 0.5 + Math.sin(now * 0.37) * 8;
      ctx.save();
      ctx.globalAlpha = 0.12 * (stateRef.current.opacity || 1);
      ctx.filter = "blur(34px) saturate(1.25)";
      ctx.drawImage(coverImg, x - side * 0.12, y - side * 0.12, side * 1.24, side * 1.24);
      ctx.filter = "none";
      ctx.globalAlpha = 0.10 * (stateRef.current.opacity || 1);
      ctx.drawImage(coverImg, x, y, side, side);
      ctx.restore();
    };

    const draw = (nowMs: number) => {
      const now = nowMs * 0.001;
      const state = stateRef.current;
      syncCover();
      ensureParticles();

      const alpha = Math.max(0.2, Math.min(1, state.opacity || 1));
      const primary = state.colors?.primary || "#d6f8ff";
      const secondary = state.colors?.secondary || "#9cffdf";
      const highlight = state.colors?.highlight || "#fff0b8";
      const glow = state.colors?.glow || secondary;

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const bg = ctx.createLinearGradient(0, 0, window.innerWidth, window.innerHeight);
      bg.addColorStop(0, "rgba(5,6,8,0)");
      bg.addColorStop(0.52, rgba(primary, 0.055 * alpha));
      bg.addColorStop(1, rgba(secondary, 0.05 * alpha));
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

      drawCover(now);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const cx = window.innerWidth * 0.5;
      const cy = window.innerHeight * 0.5 + Math.sin(now * 0.28) * window.innerHeight * 0.018;
      const rx = window.innerWidth * 0.38;
      const ry = window.innerHeight * 0.28;

      for (const p of particles) {
        const speed = 0.009 + rand(p.seed) * 0.021 + (state.playing ? 0.013 : 0);
        const angle = (p.x * Math.PI * 2 + now * speed + Math.sin(now * 0.07 + p.seed) * 0.14) % (Math.PI * 2);
        const ring = 0.18 + p.z * 0.82;
        const wobble = Math.sin(now * (0.22 + rand(p.seed) * 0.18) + p.seed) * 12;
        const x = cx + Math.cos(angle) * rx * ring + Math.sin(now * 0.11 + p.seed) * 24;
        const y = cy + Math.sin(angle * (1 + rand(p.seed * 2) * 0.16)) * ry * ring + wobble;
        const twinkle = Math.pow(0.5 + 0.5 * Math.sin(now * (0.5 + rand(p.seed) * 0.42) + p.seed), 4);
        const radius = Math.max(0.7, p.size * (0.8 + twinkle * 1.2));
        const color = twinkle > 0.74 ? highlight : p.lane > 0.55 ? secondary : glow;
        ctx.globalAlpha = (0.035 + twinkle * 0.13 + (state.playing ? 0.04 : 0)) * alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(window.innerWidth, window.innerHeight) * 0.54);
      aura.addColorStop(0, rgba(highlight, 0.08 * alpha));
      aura.addColorStop(0.34, rgba(secondary, 0.055 * alpha));
      aura.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = aura;
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.restore();

      raf = requestAnimationFrame(draw);
    };

    window.addEventListener("resize", resize);
    resize();
    raf = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 2,
        mixBlendMode: "screen",
        opacity,
      }}
    />
  );
}
