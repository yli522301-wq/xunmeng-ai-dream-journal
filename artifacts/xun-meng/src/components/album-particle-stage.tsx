import { useEffect, useRef, type MutableRefObject } from "react";
import * as THREE from "three";

const PLANE_SIZE = 7.4;
const GRID = 119;

export type ParticleAudioMetrics = {
  bass: number;
  mid: number;
  treble: number;
  beat: number;
  energy: number;
};

const ZERO_METRICS: ParticleAudioMetrics = { bass: 0, mid: 0, treble: 0, beat: 0, energy: 0 };

export function getDefaultAlbumParticleCover() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
      <defs>
        <radialGradient id="g" cx="45%" cy="34%" r="76%">
          <stop offset="0%" stop-color="#fff2b8"/>
          <stop offset="42%" stop-color="#ad6928"/>
          <stop offset="74%" stop-color="#342019"/>
          <stop offset="100%" stop-color="#06060d"/>
        </radialGradient>
        <linearGradient id="v" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18"/>
          <stop offset="52%" stop-color="#d78533" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.76"/>
        </linearGradient>
      </defs>
      <rect width="800" height="800" fill="#05060d"/>
      <rect width="800" height="800" fill="url(#g)"/>
      <circle cx="300" cy="260" r="210" fill="#fff4c8" opacity="0.14"/>
      <circle cx="575" cy="565" r="260" fill="#06060d" opacity="0.56"/>
      <rect width="800" height="800" fill="url(#v)"/>
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function makeDotTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 31);
  gradient.addColorStop(0, "rgba(255,255,255,0.98)");
  gradient.addColorStop(0.28, "rgba(255,255,255,0.84)");
  gradient.addColorStop(0.5, "rgba(255,255,255,0.34)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function makeSquareTextureCanvas(image: HTMLImageElement, size = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const side = Math.min(width, height);
  ctx.drawImage(image, (width - side) / 2, (height - side) / 2, side, side, 0, 0, size, size);
  return canvas;
}

function buildGeometry() {
  const count = GRID * GRID;
  const positions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const randoms = new Float32Array(count);
  const texelStep = 1 / GRID;

  for (let i = 0; i < count; i += 1) {
    const gx = i % GRID;
    const gy = Math.floor(i / GRID);
    const px = gx / (GRID - 1);
    const py = gy / (GRID - 1);
    positions[i * 3] = (px - 0.5) * PLANE_SIZE;
    positions[i * 3 + 1] = (py - 0.5) * PLANE_SIZE;
    positions[i * 3 + 2] = 0;
    uvs[i * 2] = (gx + 0.5) * texelStep;
    uvs[i * 2 + 1] = (gy + 0.5) * texelStep;
    randoms[i] = Math.random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aUv", new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute("aRand", new THREE.BufferAttribute(randoms, 1));
  return geometry;
}

const NOISE_GLSL = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289v(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 perm(vec4 x){return mod289v(((x*34.0)+1.0)*x);}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=perm(perm(perm(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=inversesqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
vec2 safeCoverUv(vec2 uv){return clamp(uv,vec2(0.0012),vec2(0.9988));}
`;

const VERTEX_SHADER = NOISE_GLSL + `
uniform float uTime, uBass, uMid, uTreble, uBeat, uEnergy;
uniform float uIntensity, uSpeed, uDepth, uPointScale, uBrightness, uPixel, uBloomSize;
uniform sampler2D uCoverTex;
attribute vec2 aUv;
attribute float aRand;
varying vec3 vColor;
varying float vBright;
varying float vRipple;
varying float vAlpha;
varying float vSourceLum;

void main(){
  float t = uTime * uSpeed;
  vec3 pos = position;
  vec3 coverColor = texture2D(uCoverTex, safeCoverUv(aUv)).rgb;
  vColor = pow(max(coverColor, vec3(0.0)), vec3(1.0 / max(0.35, uBrightness)));
  vAlpha = 1.0;

  float K = uIntensity * 1.55;
  float midN = snoise(vec3(pos.x*1.4, pos.y*1.4, t*0.55)) * 0.6
             + snoise(vec3(pos.x*2.8+5.0, pos.y*2.8-3.0, t*0.85)) * 0.4;
  float midMask = 0.55 + 0.45 * snoise(vec3(pos.x*0.4, pos.y*0.4, t*0.18));
  float midDisp = midN * uMid * 0.48 * midMask * K;
  float trebleJ = snoise(vec3(pos.x*6.5, pos.y*6.5, t*3.5 + aRand*4.0)) * uTreble * 0.12 * K;
  float bassBreath = snoise(vec3(pos.x*0.35, pos.y*0.35, t*0.4)) * uBass * 0.34 * K;
  float distanceFromCenter = length(pos.xy);
  float beatRipple = uBeat * 0.28 * K * (0.5 + 0.5 * sin(t * 2.8 + aRand * 6.2831));
  float rippleZ = beatRipple * exp(-distanceFromCenter * 1.65) * 0.30;
  pos.z = (rippleZ * 1.18 + midDisp + trebleJ + bassBreath) * uDepth;

  vSourceLum = dot(max(vColor, vec3(0.0)), vec3(0.299, 0.587, 0.114));
  float motion = max(max(uBass, uMid), max(uTreble, uBeat));
  vBright = 0.82 + uBass * 0.10 + uEnergy * 0.05 + motion * 0.04;
  vRipple = clamp(abs(rippleZ) * 2.0 + motion * 0.20, 0.0, 1.0);

  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
  float depthSize = 36.0 / max(0.5, -mvPos.z);
  float audioBoost = 1.0 + uBass * 0.18 + uBeat * 0.22 + uTreble * 0.08;
  float size = clamp(depthSize * audioBoost, 1.05, 4.95);
  gl_PointSize = size * uPixel * uPointScale * uBloomSize;
  gl_Position = projectionMatrix * mvPos;
}
`;

const FRAGMENT_SHADER = `
precision highp float;
uniform sampler2D uDotTex;
uniform float uAlpha;
varying vec3 vColor;
varying float vBright;
varying float vRipple;
varying float vAlpha;
varying float vSourceLum;

void main(){
  vec4 tex = texture2D(uDotTex, gl_PointCoord);
  if (tex.a < 0.035) discard;
  vec3 color = vColor * vBright;
  color = mix(color, color * 1.2, vRipple * 0.4);
  float dotDistance = length(gl_PointCoord - vec2(0.5)) * 2.0;
  float rim = smoothstep(0.54, 0.94, dotDistance) * (1.0 - smoothstep(0.94, 1.08, dotDistance)) * tex.a;
  float outputLum = dot(color, vec3(0.299, 0.587, 0.114));
  float keepBlack = 1.0 - smoothstep(0.025, 0.115, vSourceLum);
  float nonBlack = 1.0 - keepBlack;
  float lightParticle = smoothstep(0.50, 0.82, outputLum) * nonBlack;
  float darkParticle = (1.0 - smoothstep(0.20, 0.50, outputLum)) * nonBlack;
  color = mix(color, vec3(0.0), rim * lightParticle * 0.38);
  color = mix(color, vec3(1.0), rim * darkParticle * 0.20);
  color = clamp(color, vec3(0.0), vec3(1.6));
  gl_FragColor = vec4(color, tex.a * uAlpha * vAlpha * 0.98);
}
`;

const BLOOM_FRAGMENT_SHADER = `
precision highp float;
uniform sampler2D uDotTex;
uniform float uAlpha, uBloomStrength;
varying vec3 vColor;
varying float vBright;
varying float vRipple;
varying float vAlpha;
varying float vSourceLum;

void main(){
  vec4 tex = texture2D(uDotTex, gl_PointCoord);
  if (tex.a < 0.01) discard;
  float soft = tex.a * tex.a;
  vec3 color = clamp(vColor * (0.55 + vBright * 0.62), vec3(0.0), vec3(1.8));
  float pulse = 1.0 + vRipple * 0.65;
  float keepBlack = 1.0 - smoothstep(0.025, 0.115, vSourceLum);
  float bloomKeep = 1.0 - keepBlack * 0.92;
  gl_FragColor = vec4(color, soft * uAlpha * uBloomStrength * pulse * 0.55 * vAlpha * bloomKeep);
}
`;

export function AlbumParticleStage({
  cover,
  metricsRef,
  active = false,
}: {
  cover: string;
  metricsRef?: MutableRefObject<ParticleAudioMetrics>;
  active?: boolean;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rotationRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(6.6);
  const activeRef = useRef(active);

  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x05060d, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.z = zoomRef.current;

    const fallbackCanvas = document.createElement("canvas");
    fallbackCanvas.width = fallbackCanvas.height = 16;
    const fallbackContext = fallbackCanvas.getContext("2d")!;
    fallbackContext.fillStyle = "#241b18";
    fallbackContext.fillRect(0, 0, 16, 16);
    let coverTexture: THREE.Texture = new THREE.CanvasTexture(fallbackCanvas);
    const dotTexture = makeDotTexture();

    const uniforms = {
      uTime: { value: 0 }, uBass: { value: 0 }, uMid: { value: 0 }, uTreble: { value: 0 },
      uBeat: { value: 0 }, uEnergy: { value: 0 }, uIntensity: { value: 0.86 }, uSpeed: { value: 1 },
      uDepth: { value: 0.92 }, uPointScale: { value: 1 }, uBrightness: { value: 1.1 },
      uPixel: { value: renderer.getPixelRatio() }, uBloomSize: { value: 1 }, uBloomStrength: { value: 0.62 },
      uAlpha: { value: 1 }, uCoverTex: { value: coverTexture }, uDotTex: { value: dotTexture },
    };
    const bloomUniforms = THREE.UniformsUtils.clone(uniforms);
    bloomUniforms.uCoverTex.value = coverTexture;
    bloomUniforms.uDotTex.value = dotTexture;
    bloomUniforms.uBloomSize.value = 2.65;

    const geometry = buildGeometry();
    const material = new THREE.ShaderMaterial({
      uniforms, vertexShader: VERTEX_SHADER, fragmentShader: FRAGMENT_SHADER,
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    });
    const bloomMaterial = new THREE.ShaderMaterial({
      uniforms: bloomUniforms, vertexShader: VERTEX_SHADER, fragmentShader: BLOOM_FRAGMENT_SHADER,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    const bloomPoints = new THREE.Points(geometry, bloomMaterial);
    const points = new THREE.Points(geometry, material);
    scene.add(bloomPoints, points);

    let alive = true;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (!alive) return;
      const next = new THREE.CanvasTexture(makeSquareTextureCanvas(image));
      next.minFilter = THREE.LinearFilter;
      next.magFilter = THREE.LinearFilter;
      next.colorSpace = THREE.SRGBColorSpace;
      coverTexture.dispose();
      coverTexture = next;
      uniforms.uCoverTex.value = next;
      bloomUniforms.uCoverTex.value = next;
    };
    image.src = cover;

    let dragging = false;
    let previous = { x: 0, y: 0 };
    const pointerDown = (event: PointerEvent) => {
      dragging = true;
      previous = { x: event.clientX, y: event.clientY };
      mount.setPointerCapture?.(event.pointerId);
    };
    const pointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      previous = { x: event.clientX, y: event.clientY };
      rotationRef.current.y += dx * 0.006;
      rotationRef.current.x += dy * 0.006;
    };
    const pointerUp = (event: PointerEvent) => {
      dragging = false;
      mount.releasePointerCapture?.(event.pointerId);
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomRef.current = Math.max(3.8, Math.min(13.5, zoomRef.current + event.deltaY * 0.006));
    };
    const resize = () => {
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      uniforms.uPixel.value = renderer.getPixelRatio();
      bloomUniforms.uPixel.value = renderer.getPixelRatio();
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
    };

    mount.addEventListener("pointerdown", pointerDown);
    mount.addEventListener("pointermove", pointerMove);
    mount.addEventListener("pointerup", pointerUp);
    mount.addEventListener("pointerleave", pointerUp);
    mount.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("resize", resize);

    let frame = 0;
    const clock = new THREE.Clock();
    const tick = () => {
      const dt = Math.min(clock.getDelta(), 0.1);
      const external = metricsRef?.current ?? ZERO_METRICS;
      const fallbackPulse = activeRef.current && !metricsRef
        ? 0.18 + Math.sin(uniforms.uTime.value * 2.8) * 0.06
        : 0;
      // WebRTC can briefly report silence while its analyser is attaching. Keep a
      // restrained breath during active speech, then let real audio energy take over.
      const measured = Math.max(external.bass, external.mid, external.energy);
      const voiceBreath = activeRef.current && metricsRef && measured < 0.035
        ? 0.10 + Math.sin(uniforms.uTime.value * 2.25) * 0.035
        : 0;
      const metrics = metricsRef ? {
        bass: Math.max(external.bass, voiceBreath),
        mid: Math.max(external.mid, voiceBreath * 0.86),
        treble: Math.max(external.treble, voiceBreath * 0.38),
        beat: Math.max(external.beat, voiceBreath * 0.18),
        energy: Math.max(external.energy, voiceBreath),
      } : {
        bass: fallbackPulse, mid: fallbackPulse * 0.92, treble: fallbackPulse * 0.55,
        beat: fallbackPulse * 0.35, energy: fallbackPulse,
      };
      uniforms.uTime.value += dt;
      uniforms.uBass.value += (metrics.bass - uniforms.uBass.value) * 0.26;
      uniforms.uMid.value += (metrics.mid - uniforms.uMid.value) * 0.18;
      uniforms.uTreble.value += (metrics.treble - uniforms.uTreble.value) * 0.18;
      uniforms.uEnergy.value += (metrics.energy - uniforms.uEnergy.value) * 0.16;
      uniforms.uBeat.value = Math.max(uniforms.uBeat.value * Math.pow(0.36, dt), metrics.beat);

      bloomUniforms.uTime.value = uniforms.uTime.value;
      bloomUniforms.uBass.value = uniforms.uBass.value;
      bloomUniforms.uMid.value = uniforms.uMid.value;
      bloomUniforms.uTreble.value = uniforms.uTreble.value;
      bloomUniforms.uBeat.value = uniforms.uBeat.value;
      bloomUniforms.uEnergy.value = uniforms.uEnergy.value;
      bloomUniforms.uIntensity.value = uniforms.uIntensity.value;
      bloomUniforms.uSpeed.value = uniforms.uSpeed.value;
      bloomUniforms.uDepth.value = uniforms.uDepth.value;
      bloomUniforms.uBrightness.value = uniforms.uBrightness.value;
      bloomUniforms.uPointScale.value = uniforms.uPointScale.value;

      points.rotation.set(rotationRef.current.x, rotationRef.current.y, 0);
      bloomPoints.rotation.copy(points.rotation);
      camera.position.z += (zoomRef.current - camera.position.z) * 0.1;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      mount.removeEventListener("pointerdown", pointerDown);
      mount.removeEventListener("pointermove", pointerMove);
      mount.removeEventListener("pointerup", pointerUp);
      mount.removeEventListener("pointerleave", pointerUp);
      mount.removeEventListener("wheel", wheel);
      window.removeEventListener("resize", resize);
      geometry.dispose(); material.dispose(); bloomMaterial.dispose(); dotTexture.dispose(); coverTexture.dispose();
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [cover, metricsRef]);

  return <div ref={mountRef} className="absolute inset-0 touch-none" />;
}
