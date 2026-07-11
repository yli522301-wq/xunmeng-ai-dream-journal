/**
 * Rain-on-glass canvas simulation.
 *
 * Three layers (all on a single canvas):
 *  1. Tiny spray dots — static, very faint, always present
 *  2. Static droplets  — appear, grow, then start sliding
 *  3. Sliding droplets — leave a fading streak as they fall
 *
 * City lights background is rendered via CSS (in AmbientBg), so this canvas
 * only needs to draw the glass-surface drops on top of it.
 */

import { useEffect, useRef } from "react";

interface Droplet {
  x: number;
  y: number;
  r: number;
  maxR: number;
  speed: number;
  trailTopY: number;
  opacity: number;
  exiting: boolean;
}

const MAX_DROPS = 50;
const SPRAY_COUNT = 80;

interface RainGlassCanvasProps {
  intensity?: number;
  brightness?: number;
  speed?: number;
}

export function RainGlassCanvas({
  intensity = 1,
  brightness = 1,
  speed = 1,
}: RainGlassCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rainIntensity = Math.max(0.35, Math.min(1.8, intensity));
    const rainBrightness = Math.max(0.35, Math.min(1.8, brightness));
    const rainSpeed = Math.max(0.35, Math.min(2.2, speed));

    // Seed spray dots once
    const spray: { x: number; y: number; r: number }[] = Array.from(
      { length: Math.round(SPRAY_COUNT * rainIntensity) },
      () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight * 0.88,
        r: 0.35 + Math.random() * 1.1,
      })
    );

    const drops: Droplet[] = [];

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const spawnDrop = () => {
      drops.push({
        x: 24 + Math.random() * (canvas.width - 48),
        y: 30 + Math.random() * canvas.height * 0.55,
        r: 1.4,
        maxR: 4 + Math.random() * 5,
        speed: 0,
        trailTopY: 0,
        opacity: 1,
        exiting: false,
      });
    };

    // Warm the simulation
    for (let i = 0; i < Math.round(14 * rainIntensity); i++) spawnDrop();

    let lastT = performance.now();
    let raf = 0;

    const update = () => {
      if (drops.length < MAX_DROPS * rainIntensity && Math.random() < 0.028 * rainIntensity) spawnDrop();

      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];

        if (d.exiting) {
          d.opacity -= 0.025;
          if (d.opacity <= 0) { drops.splice(i, 1); continue; }
          continue;
        }

        if (d.speed === 0) {
          // Growing phase
          d.r += 0.012;
          if (d.r >= d.maxR) {
            d.speed = (0.55 + Math.random() * 1.5) * rainSpeed;
            d.trailTopY = d.y;
          }
        } else {
          // Sliding phase
          d.y += d.speed;
          // Absorb smaller static drops along path
          for (let j = drops.length - 1; j >= 0; j--) {
            if (j === i) continue;
            const o = drops[j];
            if (o.speed > 0 || o.exiting) continue;
            const dx = o.x - d.x;
            const dy = o.y - d.y;
            if (dx * dx + dy * dy < (d.r + o.r + 3) ** 2) {
              d.r = Math.min(d.r + o.r * 0.25, d.maxR + 3);
              drops.splice(j, 1);
              if (j < i) i--;
            }
          }
          if (d.y > canvas.height + 24) {
            drops.splice(i, 1);
          }
        }
      }
    };

    const draw = (ctx: CanvasRenderingContext2D) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // ── 1. Spray dots ───────────────────────────────────────────────
      for (const s of spray) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(160,195,235,${0.065 * rainBrightness})`;
        ctx.fill();
      }

      // ── 2 & 3. Drops ────────────────────────────────────────────────
      for (const d of drops) {
        const a = d.opacity;

        // Trail for sliding drops
        if (d.speed > 0) {
          const trailH = d.y - d.r - d.trailTopY;
          if (trailH > 1) {
            const tw = d.r * 0.52;
            const grad = ctx.createLinearGradient(d.x, d.trailTopY, d.x, d.y - d.r);
            grad.addColorStop(0, `rgba(140,180,230,0)`);
            grad.addColorStop(1, `rgba(140,180,230,${0.13 * a * rainBrightness})`);
            ctx.beginPath();
            // Slightly wavy path for realism
            ctx.moveTo(d.x - tw * 0.55, d.trailTopY);
            ctx.bezierCurveTo(
              d.x - tw * 1.1, d.trailTopY + trailH * 0.35,
              d.x + tw * 0.6,  d.trailTopY + trailH * 0.65,
              d.x - tw * 0.55, d.y - d.r
            );
            ctx.lineTo(d.x + tw * 0.55, d.y - d.r);
            ctx.bezierCurveTo(
              d.x + tw * 1.1, d.trailTopY + trailH * 0.65,
              d.x - tw * 0.6,  d.trailTopY + trailH * 0.35,
              d.x + tw * 0.55, d.trailTopY
            );
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();
          }
        }

        // Drop body — radial gradient (bright core → darker edge)
        const bg = ctx.createRadialGradient(
          d.x - d.r * 0.28, d.y - d.r * 0.28, d.r * 0.04,
          d.x,              d.y,              d.r
        );
        bg.addColorStop(0,   `rgba(215,230,255,${0.24 * a * rainBrightness})`);
        bg.addColorStop(0.5, `rgba(155,190,235,${0.16 * a * rainBrightness})`);
        bg.addColorStop(1,   `rgba(90,140,210,${0.07 * a * rainBrightness})`);

        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.fill();

        // Specular highlight (light refraction simulation)
        ctx.beginPath();
        ctx.arc(d.x - d.r * 0.3, d.y - d.r * 0.26, d.r * 0.27, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.30 * a * rainBrightness})`;
        ctx.fill();

        // Very faint secondary highlight (lens flare feel)
        if (d.r > 4) {
          ctx.beginPath();
          ctx.arc(d.x + d.r * 0.28, d.y + d.r * 0.18, d.r * 0.12, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${0.10 * a * rainBrightness})`;
          ctx.fill();
        }

        // Thin rim
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(100,150,220,${0.09 * a * rainBrightness})`;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
    };

    const frame = (now: number) => {
      lastT = now;
      const ctx = canvas.getContext("2d");
      if (ctx) { update(); draw(ctx); }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [intensity, brightness, speed]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}
