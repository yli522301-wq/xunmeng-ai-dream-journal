/**
 * Antigravity — gravitational-field ring particle system
 *
 * Particles orbit a central ring (toroidal formation), driven by a helical
 * magnetic wave. The entire group gently drifts toward the normalised mouse
 * position passed in via `mousePosRef` (x/y in [-1, 1]).
 */

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface AntigravityProps {
  count?: number;
  magnetRadius?: number;
  ringRadius?: number;
  waveSpeed?: number;
  waveAmplitude?: number;
  particleSize?: number;
  lerpSpeed?: number;
  color?: string;
  rotationSpeed?: number;
  depthFactor?: number;
  pulseSpeed?: number;
  fieldStrength?: number;
  particleVariance?: number;
  autoAnimate?: boolean;
  /** Normalised mouse position { x, y } in [-1, 1]. Updated every frame by ref — no re-renders. */
  mousePosRef?: React.MutableRefObject<{ x: number; y: number }>;
}

export function Antigravity({
  count = 220,
  magnetRadius = 8,
  ringRadius = 8,
  waveSpeed = 0.55,
  waveAmplitude = 1.35,
  particleSize = 1.9,
  lerpSpeed = 0.075,
  color = "#8B5CFF",
  rotationSpeed = 0.05,
  depthFactor = 1.15,
  pulseSpeed = 3.6,
  particleVariance = 1.25,
  autoAnimate = true,
  mousePosRef,
}: AntigravityProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef  = useRef<THREE.InstancedMesh>(null);

  // ─── stable per-particle data ────────────────────────────────────────────
  const particleData = useMemo(() => {
    const angles  = new Float32Array(count);
    const radii   = new Float32Array(count);
    const phases  = new Float32Array(count);
    const xJitter = new Float32Array(count);
    const zJitter = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      angles[i]  = (i / count) * Math.PI * 2;
      radii[i]   = ringRadius + (Math.random() - 0.5) * particleVariance * 2;
      phases[i]  = Math.random() * Math.PI * 2;
      xJitter[i] = (Math.random() - 0.5) * particleVariance * 0.4;
      zJitter[i] = (Math.random() - 0.5) * particleVariance * 0.4;
    }
    return { angles, radii, phases, xJitter, zJitter };
  }, [count, ringRadius, particleVariance]);

  const currentPos = useMemo(
    () => Array.from({ length: count }, () => new THREE.Vector3()),
    [count]
  );

  const dummy  = useMemo(() => new THREE.Object3D(), []);
  const target = useMemo(() => new THREE.Vector3(), []);

  // ─── seed initial positions ───────────────────────────────────────────────
  useEffect(() => {
    if (!meshRef.current) return;
    const { angles, radii } = particleData;
    for (let i = 0; i < count; i++) {
      const a = angles[i];
      const r = radii[i];
      currentPos[i].set(
        r * Math.cos(a),
        Math.sin(a * magnetRadius) * waveAmplitude,
        r * Math.sin(a) * depthFactor
      );
    }
    for (let i = 0; i < count; i++) {
      dummy.position.copy(currentPos[i]);
      dummy.scale.setScalar(particleSize * 0.1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [count, particleData, magnetRadius, waveAmplitude, depthFactor, particleSize, currentPos, dummy]);

  // ─── per-frame animation ──────────────────────────────────────────────────
  useFrame(({ clock }) => {
    if (!meshRef.current || !autoAnimate) return;
    const t = clock.getElapsedTime();
    const { angles, radii, phases, xJitter, zJitter } = particleData;

    // ── 1. drift the whole group toward mouse position ──────────────────────
    if (groupRef.current && mousePosRef) {
      const mx = mousePosRef.current.x;
      const my = mousePosRef.current.y;
      // Map normalised [-1,1] to gentle world-space offset (max ±6 / ±4 units)
      const targetX = mx * 6;
      const targetY = my * 4;
      groupRef.current.position.x +=
        (targetX - groupRef.current.position.x) * 0.025;
      groupRef.current.position.y +=
        (targetY - groupRef.current.position.y) * 0.025;
    }

    // ── 2. per-particle ring animation ─────────────────────────────────────
    for (let i = 0; i < count; i++) {
      const baseAngle = angles[i];
      const animAngle = baseAngle + t * rotationSpeed;
      const r = radii[i];

      const tx = r * Math.cos(animAngle) + xJitter[i];
      const ty =
        Math.sin(baseAngle * magnetRadius + t * waveSpeed) * waveAmplitude;
      const tz = r * Math.sin(animAngle) * depthFactor + zJitter[i];

      target.set(tx, ty, tz);
      currentPos[i].lerp(target, lerpSpeed);

      const pulse = 1 + Math.sin(t * pulseSpeed + phases[i]) * 0.14;
      const scale = particleSize * pulse * 0.1;

      dummy.position.copy(currentPos[i]);
      dummy.rotation.set(0, 0, animAngle + Math.PI * 0.5);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={groupRef}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
        {/* Capsule: radius=0.065, length=0.30 */}
        <capsuleGeometry args={[0.065, 0.30, 4, 8]} />
        {/*
          toneMapped={false} keeps the raw colour unaffected by tone-mapping,
          making the particles appear brighter and more vivid.
        */}
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.95}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}
