/**
 * DreamAntigravityBackground
 *
 * Full-screen fixed background: deep-purple gradient + Antigravity particle
 * ring via React Three Fiber Canvas.
 *
 * - pointer-events: none  → never blocks UI interactions
 * - z-index: 0            → below all page content
 * - Graceful fallback when WebGL is unavailable (no-GPU env / older devices)
 * - ErrorBoundary prevents Canvas crashes from bubbling to the rest of the app
 */

import { Component, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Antigravity } from "./Antigravity";

// ─────────────────────────────────────────────────────────────────────────────
// WebGL capability check (runs once at module load)
// ─────────────────────────────────────────────────────────────────────────────
function checkWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
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
// ErrorBoundary — catches any runtime error inside Canvas
// ─────────────────────────────────────────────────────────────────────────────
interface BoundaryState { error: boolean }

class CanvasErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  BoundaryState
> {
  state: BoundaryState = { error: false };

  static getDerivedStateFromError() {
    return { error: true };
  }

  render() {
    if (this.state.error) return this.props.fallback;
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Static fallback gradient (shown when WebGL not available)
// ─────────────────────────────────────────────────────────────────────────────
function GradientFallback() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        background:
          "radial-gradient(ellipse 90% 70% at 50% 38%, #10062e 0%, #08041a 45%, #02020a 100%)",
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────
export function DreamAntigravityBackground() {
  if (!webGLSupported) {
    return <GradientFallback />;
  }

  return (
    <CanvasErrorBoundary fallback={<GradientFallback />}>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 90% 70% at 50% 38%, #10062e 0%, #08041a 45%, #02020a 100%)",
        }}
      >
        <Canvas
          camera={{ position: [0, 2.5, 22], fov: 48 }}
          dpr={
            isMobile
              ? 1
              : Math.min(
                  typeof window !== "undefined"
                    ? window.devicePixelRatio
                    : 1,
                  2
                )
          }
          gl={{ antialias: !isMobile, alpha: true, powerPreference: "low-power" }}
          style={{ width: "100%", height: "100%", pointerEvents: "none" }}
        >
          <Antigravity
            count={isMobile ? 140 : 220}
            magnetRadius={6}
            ringRadius={7}
            waveSpeed={0.35}
            waveAmplitude={1}
            particleSize={1.4}
            lerpSpeed={0.05}
            color="#7C5CFF"
            rotationSpeed={0.03}
            depthFactor={1}
            pulseSpeed={2.5}
            fieldStrength={10}
            particleVariance={1}
            autoAnimate={true}
          />
        </Canvas>
      </div>
    </CanvasErrorBoundary>
  );
}
