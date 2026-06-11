/**
 * DreamAntigravityBackground
 *
 * Full-screen fixed background layer:
 *   - Deep purple / black dream gradient
 *   - Antigravity capsule-particle ring (React Three Fiber Canvas)
 *   - Mouse-tracking radial glow overlay (CSS custom properties)
 *   - Group drifts toward mouse in 3-D world via mousePosRef
 *
 * Pointer-event contract
 * ──────────────────────
 * The outer wrapper is pointer-events: none. Mouse position is captured via a
 * window-level 'mousemove' listener (passive) so no z-index stacking or
 * pointer-event bubbling is needed, and nothing interferes with page clicks.
 */

import { useRef, useEffect, Component, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Antigravity } from "./Antigravity";

// ─────────────────────────────────────────────────────────────────────────────
// One-time WebGL capability probe
// ─────────────────────────────────────────────────────────────────────────────
function checkWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext("webgl") || c.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}
const webGLSupported = checkWebGL();

const isMobile =
  typeof window !== "undefined" &&
  (/Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 768);

// ─────────────────────────────────────────────────────────────────────────────
// ErrorBoundary — Canvas crash → silent gradient fallback
// ─────────────────────────────────────────────────────────────────────────────
class CanvasErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() {
    return this.state.error ? this.props.fallback : this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gradient fallback (no WebGL / error)
// ─────────────────────────────────────────────────────────────────────────────
const GRADIENT_BG = [
  "radial-gradient(circle at 50% 35%, rgba(91,70,220,0.22), transparent 32%)",
  "radial-gradient(circle at 50% 72%, rgba(124,92,255,0.14), transparent 38%)",
  "linear-gradient(180deg, #070716 0%, #0b0820 45%, #05040c 100%)",
].join(", ");

function GradientFallback() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        background: GRADIENT_BG,
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export function DreamAntigravityBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  /** Normalised mouse [-1..1, -1..1]; updated imperatively — never causes re-renders */
  const mousePosRef = useRef({ x: 0, y: 0 });

  // Window-level listener: works regardless of pointer-events on any element
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const x =  (e.clientX / window.innerWidth)  * 2 - 1;
      const y = -((e.clientY / window.innerHeight) * 2 - 1);
      mousePosRef.current = { x, y };

      // CSS custom properties drive the glow overlay without triggering React renders
      if (containerRef.current) {
        containerRef.current.style.setProperty(
          "--mouse-x",
          `${(e.clientX / window.innerWidth) * 100}%`
        );
        containerRef.current.style.setProperty(
          "--mouse-y",
          `${(e.clientY / window.innerHeight) * 100}%`
        );
      }
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  if (!webGLSupported) return <GradientFallback />;

  return (
    <CanvasErrorBoundary fallback={<GradientFallback />}>
      {/*
        pointer-events: none — clicks pass through to page content.
        Mouse tracking is done at the window level (see above).
      */}
      <div
        ref={containerRef}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background: GRADIENT_BG,
          overflow: "hidden",
        }}
      >
        {/* ── Three.js canvas ──────────────────────────────────────────────── */}
        <Canvas
          camera={{ position: [0, 0, 50], fov: 35 }}
          dpr={
            isMobile
              ? 1
              : Math.min(
                  typeof window !== "undefined" ? window.devicePixelRatio : 1,
                  2
                )
          }
          gl={{
            antialias: !isMobile,
            alpha: true,
            powerPreference: "low-power",
          }}
          style={{ width: "100%", height: "100%", pointerEvents: "none" }}
        >
          <Antigravity
            count={isMobile ? 160 : 280}
            magnetRadius={8}
            ringRadius={8}
            waveSpeed={0.55}
            waveAmplitude={1.35}
            particleSize={isMobile ? 1.5 : 1.9}
            lerpSpeed={0.075}
            color="#8B5CFF"
            rotationSpeed={0.05}
            depthFactor={1.15}
            pulseSpeed={3.6}
            fieldStrength={12}
            particleVariance={1.25}
            autoAnimate
            mousePosRef={mousePosRef}
          />
        </Canvas>

        {/* ── Mouse glow overlay ───────────────────────────────────────────── */}
        {/*
          Uses CSS custom properties set imperatively (no React re-renders).
          mix-blend-mode: screen lets the glow bloom over the dark background.
          pointer-events: none ensures it never intercepts clicks.
        */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 1,
            background: [
              "radial-gradient(",
              "  circle at var(--mouse-x, 50%) var(--mouse-y, 50%),",
              "  rgba(139,92,255,0.28)  0%,",
              "  rgba(139,92,255,0.16) 12%,",
              "  rgba(139,92,255,0.06) 26%,",
              "  transparent 45%",
              ")",
            ].join(""),
            mixBlendMode: "screen" as const,
            transition: "background 0.08s linear",
          }}
        />
      </div>
    </CanvasErrorBoundary>
  );
}
