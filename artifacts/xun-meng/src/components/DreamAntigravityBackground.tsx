/**
 * DreamAntigravityBackground
 *
 * Full-screen fixed background layer:
 *   - Deep-purple gradient base (responds to active character via glowColor)
 *   - Antigravity capsule-particle ring (React Three Fiber Canvas)
 *   - Mouse-tracking radial glow overlay (CSS custom properties)
 *   - Orbit glow ellipse centred on the ring
 *
 * Props
 * ─────
 * particleColor  hex string for particle fill  (default "#9B7CFF")
 * glowColor      rgba string for orbit + mouse glow (default "rgba(155,124,255,0.28)")
 *
 * Pointer-event contract
 * ──────────────────────
 * Everything is pointer-events: none. Mouse position is tracked via a
 * window-level 'mousemove' listener (passive) — never interferes with clicks.
 */

import { useRef, useEffect, Component, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Antigravity } from "./Antigravity";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Replaces the last numeric group (opacity) in an rgba() string */
function withOpacity(rgba: string, opacity: number): string {
  return rgba.replace(/[\d.]+\)$/, `${opacity})`);
}

function checkWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext("webgl") || c.getContext("experimental-webgl"))
    );
  } catch { return false; }
}
const webGLSupported = checkWebGL();

const isMobile =
  typeof window !== "undefined" &&
  (/Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 768);

// ─────────────────────────────────────────────────────────────────────────────
// ErrorBoundary
// ─────────────────────────────────────────────────────────────────────────────
class CanvasErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? this.props.fallback : this.props.children; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gradient fallback (no WebGL)
// ─────────────────────────────────────────────────────────────────────────────
const BASE_BG = "linear-gradient(180deg, #070716 0%, #0b0820 45%, #05040c 100%)";

function GradientFallback({ glowColor }: { glowColor: string }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        background: [
          `radial-gradient(circle at 50% 35%, ${withOpacity(glowColor, 0.18)}, transparent 32%)`,
          `radial-gradient(circle at 50% 72%, ${withOpacity(glowColor, 0.10)}, transparent 38%)`,
          BASE_BG,
        ].join(", "),
        transition: "background 0.45s ease",
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  particleColor?: string;
  glowColor?: string;
}

export function DreamAntigravityBackground({
  particleColor = "#9B7CFF",
  glowColor = "rgba(155,124,255,0.28)",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mousePosRef  = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mousePosRef.current = {
        x:  (e.clientX / window.innerWidth)  * 2 - 1,
        y: -((e.clientY / window.innerHeight) * 2 - 1),
      };
      if (containerRef.current) {
        containerRef.current.style.setProperty("--mouse-x", `${(e.clientX / window.innerWidth)  * 100}%`);
        containerRef.current.style.setProperty("--mouse-y", `${(e.clientY / window.innerHeight) * 100}%`);
      }
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  if (!webGLSupported) return <GradientFallback glowColor={glowColor} />;

  const bgLayers = [
    `radial-gradient(circle at 50% 35%, ${withOpacity(glowColor, 0.18)}, transparent 32%)`,
    `radial-gradient(circle at 50% 72%, ${withOpacity(glowColor, 0.10)}, transparent 38%)`,
    BASE_BG,
  ].join(", ");

  return (
    <CanvasErrorBoundary fallback={<GradientFallback glowColor={glowColor} />}>
      <div
        ref={containerRef}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background: bgLayers,
          overflow: "hidden",
          transition: "background 0.45s ease",
        }}
      >
        {/* ── Orbit glow — elliptical bloom centred on the ring ── */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 520,
            height: 200,
            transform: "translate(-50%, -12%)",
            backgroundColor: withOpacity(glowColor, 0.20),
            borderRadius: "50%",
            filter: "blur(44px)",
            pointerEvents: "none",
            zIndex: 0,
            transition: "background-color 0.45s ease",
          }}
        />

        {/* ── Canvas ── */}
        <Canvas
          camera={{ position: [0, 0, 50], fov: 35 }}
          dpr={isMobile ? 1 : Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2)}
          gl={{ antialias: !isMobile, alpha: true, powerPreference: "low-power" }}
          style={{ width: "100%", height: "100%", pointerEvents: "none", position: "relative", zIndex: 0 }}
        >
          <Antigravity
            count={isMobile ? 180 : 360}
            magnetRadius={9}
            ringRadius={8.5}
            waveSpeed={0.55}
            waveAmplitude={1.25}
            particleSize={isMobile ? 1.7 : 2.25}
            lerpSpeed={0.08}
            color={particleColor}
            rotationSpeed={0.045}
            depthFactor={1.1}
            pulseSpeed={3.2}
            fieldStrength={14}
            particleVariance={1.15}
            autoAnimate
            mousePosRef={mousePosRef}
          />
        </Canvas>

        {/* ── Mouse glow overlay (CSS-var driven, no React re-renders) ── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 1,
            background: [
              "radial-gradient(",
              "  circle at var(--mouse-x, 50%) var(--mouse-y, 50%),",
              `  ${withOpacity(glowColor, 0.26)}  0%,`,
              `  ${withOpacity(glowColor, 0.14)} 12%,`,
              `  ${withOpacity(glowColor, 0.05)} 26%,`,
              "  transparent 45%",
              ")",
            ].join(""),
            mixBlendMode: "screen" as const,
            transition: "opacity 0.45s ease",
          }}
        />
      </div>
    </CanvasErrorBoundary>
  );
}
