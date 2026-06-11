/**
 * Antigravity — gravitational-field ring particle system
 *
 * Particles orbit a central ring (toroidal formation), driven by a helical
 * magnetic wave. Each capsule-shaped particle lerps toward its target each
 * frame, producing a soft flowing motion.
 *
 * Parameters match the spec:
 *   count          desktop 220 / mobile 140
 *   magnetRadius   6      — harmonic multiplier for the vertical wave
 *   ringRadius     7      — base radius of the orbital ring
 *   waveSpeed      0.35   — wave animation speed
 *   waveAmplitude  1      — vertical displacement amplitude
 *   particleSize   1.4    — base scale factor
 *   lerpSpeed      0.05   — position smoothing per frame
 *   color          #7C5CFF
 *   rotationSpeed  0.03   — ring rotation speed (rad/s)
 *   depthFactor    1      — z-axis scale
 *   pulseSpeed     2.5    — individual pulse oscillation frequency
 *   fieldStrength  10     — vertical field compression (unused in base algo)
 *   particleVariance 1    — radial / positional scatter
 *   autoAnimate    true
 *   particleShape  capsule
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
}

export function Antigravity({
  count = 220,
  magnetRadius = 6,
  ringRadius = 7,
  waveSpeed = 0.35,
  waveAmplitude = 1,
  particleSize = 1.4,
  lerpSpeed = 0.05,
  color = "#7C5CFF",
  rotationSpeed = 0.03,
  depthFactor = 1,
  pulseSpeed = 2.5,
  particleVariance = 1,
  autoAnimate = true,
}: AntigravityProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Pre-compute stable per-particle data (recalculated only when params change)
  const particleData = useMemo(() => {
    const angles = new Float32Array(count);
    const radii  = new Float32Array(count);
    const phases = new Float32Array(count);
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

  // Per-particle current positions for smooth lerp
  const currentPos = useMemo(
    () => Array.from({ length: count }, () => new THREE.Vector3()),
    [count]
  );

  const dummy  = useMemo(() => new THREE.Object3D(), []);
  const target = useMemo(() => new THREE.Vector3(), []);

  // Seed initial positions so particles don't all start at origin
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
    // Push initial matrices
    for (let i = 0; i < count; i++) {
      dummy.position.copy(currentPos[i]);
      dummy.scale.setScalar(particleSize * 0.1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [count, particleData, magnetRadius, waveAmplitude, depthFactor, particleSize, currentPos, dummy]);

  useFrame(({ clock }) => {
    if (!meshRef.current || !autoAnimate) return;
    const t = clock.getElapsedTime();
    const { angles, radii, phases, xJitter, zJitter } = particleData;

    for (let i = 0; i < count; i++) {
      const baseAngle = angles[i];
      const animAngle = baseAngle + t * rotationSpeed;
      const r = radii[i];

      // Target: ring orbit + helical wave displacement
      const tx = r * Math.cos(animAngle) + xJitter[i];
      const ty = Math.sin(baseAngle * magnetRadius + t * waveSpeed) * waveAmplitude;
      const tz = r * Math.sin(animAngle) * depthFactor + zJitter[i];

      target.set(tx, ty, tz);
      currentPos[i].lerp(target, lerpSpeed);

      // Per-particle pulse
      const pulse = 1 + Math.sin(t * pulseSpeed + phases[i]) * 0.12;
      const scale = particleSize * pulse * 0.1;

      dummy.position.copy(currentPos[i]);
      // Orient capsule tangent to the ring motion direction
      dummy.rotation.set(0, 0, animAngle + Math.PI * 0.5);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      {/* Capsule: radius=0.06, length=0.28, capSegments=4, radialSegments=8 */}
      <capsuleGeometry args={[0.06, 0.28, 4, 8]} />
      <meshBasicMaterial color={color} transparent opacity={0.72} />
    </instancedMesh>
  );
}
