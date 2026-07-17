import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Send, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";

export type CharKey = "daoshen" | "muge" | "anuan";
type Status = "idle" | "thinking" | "speaking";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const CHARS: Record<CharKey, {
  name: string;
  enName: string;
  hsl: string;
  color: string;
  cover: string;
  hint: string;
}> = {
  daoshen: {
    name: "岛深",
    enName: "Daoshen",
    hsl: "226 78% 66%",
    color: "#6B8CFF",
    cover: makeCoverSvg("#071024", "#6B8CFF", "#B9C7FF", "岛"),
    hint: "深蓝粒子 · 冷静引路",
  },
  muge: {
    name: "暮歌",
    enName: "Muge",
    hsl: "258 84% 70%",
    color: "#9B7CFF",
    cover: makeCoverSvg("#16091f", "#9B7CFF", "#FFD0F7", "暮"),
    hint: "紫色梦尘 · 诗意回声",
  },
  anuan: {
    name: "阿暖",
    enName: "Anuan",
    hsl: "38 90% 60%",
    color: "#F5A623",
    cover: makeCoverSvg("#1e1308", "#F5A623", "#FFE4A8", "暖"),
    hint: "暖金光晕 · 低声陪伴",
  },
};

function makeCoverSvg(bg: string, primary: string, secondary: string, text: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <defs>
        <radialGradient id="g" cx="50%" cy="42%" r="64%">
          <stop offset="0%" stop-color="${secondary}" stop-opacity="0.86"/>
          <stop offset="42%" stop-color="${primary}" stop-opacity="0.38"/>
          <stop offset="100%" stop-color="${bg}" stop-opacity="1"/>
        </radialGradient>
        <filter id="blur"><feGaussianBlur stdDeviation="16"/></filter>
      </defs>
      <rect width="512" height="512" fill="${bg}"/>
      <circle cx="256" cy="230" r="190" fill="url(#g)" filter="url(#blur)" opacity="0.88"/>
      <circle cx="184" cy="330" r="88" fill="${primary}" opacity="0.16"/>
      <circle cx="342" cy="140" r="72" fill="${secondary}" opacity="0.15"/>
      <text x="256" y="292" text-anchor="middle" font-size="164" font-family="serif" fill="${secondary}" opacity="0.92">${text}</text>
    </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function getParticleCharacterCover(key: CharKey) {
  return CHARS[key]?.cover ?? CHARS.anuan.cover;
}

function makeDotTexture() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  const ctx = cv.getContext("2d");
  if (!ctx) return new THREE.Texture();
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 31);
  g.addColorStop(0.00, "rgba(255,255,255,0.96)");
  g.addColorStop(0.42, "rgba(255,255,255,0.78)");
  g.addColorStop(0.72, "rgba(255,255,255,0.22)");
  g.addColorStop(1.00, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function makeSquareCoverCanvas(img: HTMLImageElement, size = 512) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const cx = cv.getContext("2d");
  if (!cx) return cv;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const s = Math.min(iw, ih);
  cx.drawImage(img, (iw - s) / 2, (ih - s) / 2, s, s, 0, 0, size, size);
  return cv;
}

const PLANE_SIZE = 4.8;
const GRID_SIZE = 119;

function buildCoverParticleGeometry(grid = GRID_SIZE) {
  const count = grid * grid;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const rands = new Float32Array(count);
  const texelStep = 1 / grid;

  for (let i = 0; i < count; i += 1) {
    const gx = i % grid;
    const gy = Math.floor(i / grid);
    const u = (gx + 0.5) * texelStep;
    const v = (gy + 0.5) * texelStep;
    const px = gx / (grid - 1);
    const py = gy / (grid - 1);
    positions[i * 3] = (px - 0.5) * PLANE_SIZE;
    positions[i * 3 + 1] = (py - 0.5) * PLANE_SIZE;
    positions[i * 3 + 2] = 0;
    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
    rands[i] = Math.random();
  }

  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aUv", new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute("aRand", new THREE.BufferAttribute(rands, 1));
  return geo;
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
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=perm(perm(perm(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
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
uniform float uTime, uBass, uMid, uTreble, uBeat, uEnergy, uBurstAmt;
uniform float uIntensity, uSpeed, uCoverRes, uTintStrength;
uniform sampler2D uCoverTex;
uniform vec3 uTintColor;
attribute vec2 aUv;
attribute float aRand;
varying vec3 vColor;
varying float vBright, vRipple, vAlpha, vSourceLum;

void main(){
  float t = uTime * uSpeed;
  vec3 pos = position;
  vec2 sampleUv = safeCoverUv(aUv);
  vec3 coverColor = texture2D(uCoverTex, sampleUv).rgb;
  vec3 defaultColor = mix(
    vec3(0.36, 0.28, 0.72),
    mix(vec3(0.85, 0.55, 0.95), vec3(0.45, 0.78, 0.95), aUv.x),
    aUv.y
  );
  vColor = mix(defaultColor, coverColor, 1.0);
  vAlpha = 1.0;

  float K = uIntensity * 1.6;
  float midN = snoise(vec3(pos.x*1.4, pos.y*1.4, t*0.55)) * 0.6
             + snoise(vec3(pos.x*2.8+5.0, pos.y*2.8-3.0, t*0.85)) * 0.4;
  float midMask = 0.55 + 0.45 * snoise(vec3(pos.x*0.4, pos.y*0.4, t*0.18));
  float midDisp = midN * uMid * 0.55 * midMask * K;
  float trebleJ = snoise(vec3(pos.x*6.5, pos.y*6.5, t*3.5 + aRand*4.0)) * uTreble * 0.18 * K;
  float bassBreath = snoise(vec3(pos.x*0.35, pos.y*0.35, t*0.4)) * uBass * 0.42 * K;
  float distFromCenter = length(pos.xy);
  float beatPulse = uBass * 0.38 * K * (0.5 + 0.5 * sin(t * 2.8 + aRand * 6.28));
  float rippleZ = beatPulse * exp(-distFromCenter * 1.8) * 0.35;

  pos.z = rippleZ * 1.30 + midDisp + trebleJ + bassBreath;
  float angle = t * 0.08;
  float cs = cos(angle), sn = sin(angle);
  pos.xy = mat2(cs, -sn, sn, cs) * pos.xy;

  vSourceLum = dot(max(vColor, vec3(0.0)), vec3(0.299, 0.587, 0.114));
  vBright = 0.82 + uBass * 0.10 + uEnergy * 0.05 + uBurstAmt * 0.40;
  vRipple = clamp(abs(rippleZ) * 2.5, 0.0, 1.0);

  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
  float depthSize = 36.0 / max(0.5, -mvPos.z);
  float audioBoost = 1.0 + uBass * 0.30 + uBeat * 0.30 + uBurstAmt * 0.5;
  float sz = clamp(depthSize * audioBoost, 1.05, 4.95);
  gl_PointSize = sz * 1.0;
  gl_Position = projectionMatrix * mvPos;
}
`;

const FRAGMENT_SHADER = `
precision highp float;
uniform sampler2D uDotTex;
uniform float uAlpha, uParticleDim;
varying vec3 vColor;
varying float vBright, vRipple, vAlpha, vSourceLum;

void main(){
  vec4 tex = texture2D(uDotTex, gl_PointCoord);
  if (tex.a < 0.02) discard;
  vec3 col = vColor * vBright;
  col = mix(col, col * 1.2, vRipple * 0.4);
  float dotDist = length(gl_PointCoord - vec2(0.5)) * 2.0;
  float readableRim = smoothstep(0.44, 0.94, dotDist) * (1.0 - smoothstep(0.94, 1.08, dotDist)) * tex.a;
  float outLum = dot(col, vec3(0.299, 0.587, 0.114));
  float lightParticle = smoothstep(0.50, 0.82, outLum) * 1.0;
  float darkParticle = (1.0 - smoothstep(0.20, 0.50, outLum)) * 1.0;
  col = mix(col, vec3(0.0), readableRim * lightParticle * 0.38);
  col = mix(col, vec3(1.0), readableRim * darkParticle * 0.20);
  col = clamp(col, vec3(0.0), vec3(1.6));
  gl_FragColor = vec4(col, tex.a * uAlpha * uParticleDim * vAlpha);
}
`;

const BLOOM_VS = VERTEX_SHADER.replace("gl_PointSize = sz * 1.0;", "gl_PointSize = sz * 2.65;");
const BLOOM_FS = `
precision highp float;
uniform sampler2D uDotTex;
uniform float uAlpha, uBloomStrength, uParticleDim;
varying vec3 vColor;
varying float vBright, vRipple, vAlpha, vSourceLum;

void main(){
  vec4 tex = texture2D(uDotTex, gl_PointCoord);
  if (tex.a < 0.01) discard;
  float soft = tex.a * tex.a;
  vec3 col = vColor * (0.55 + vBright * 0.62);
  col = clamp(col, vec3(0.0), vec3(1.8));
  float pulse = 1.0 + vRipple * 0.65;
  float keepBlack = 1.0 - smoothstep(0.025, 0.115, vSourceLum);
  float bloomKeep = 1.0 - keepBlack * 0.92;
  gl_FragColor = vec4(col, soft * uAlpha * uBloomStrength * uParticleDim * pulse * 0.55 * vAlpha * bloomKeep);
}
`;

export function ParticleCover({
  cover,
  status,
  beat,
  color,
}: {
  cover: string;
  status: Status;
  beat: number;
  color: string;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const beatRef = useRef(0);
  const alphaTargetRef = useRef(1);
  const statusRef = useRef<Status>(status);

  useEffect(() => {
    beatRef.current = 1;
  }, [beat]);

  useEffect(() => {
    statusRef.current = status;
    alphaTargetRef.current = status === "speaking" ? 1 : status === "thinking" ? 0.82 : 1;
  }, [status]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const fallbackCanvas = document.createElement("canvas");
    fallbackCanvas.width = fallbackCanvas.height = 512;
    const fallbackCtx = fallbackCanvas.getContext("2d");
    if (fallbackCtx) {
      const gradient = fallbackCtx.createRadialGradient(256, 220, 0, 256, 256, 320);
      gradient.addColorStop(0, color);
      gradient.addColorStop(0.42, "rgba(255,255,255,0.18)");
      gradient.addColorStop(1, "#03040a");
      fallbackCtx.fillStyle = gradient;
      fallbackCtx.fillRect(0, 0, 512, 512);
    }

    const dotTexture = makeDotTexture();
    let coverTexture: THREE.Texture = new THREE.CanvasTexture(fallbackCanvas);
    coverTexture.minFilter = THREE.LinearFilter;
    coverTexture.magFilter = THREE.LinearFilter;
    coverTexture.colorSpace = THREE.SRGBColorSpace;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.z = 6.5;

    const uniforms = {
      uTime: { value: 0 },
      uBass: { value: 0.08 },
      uMid: { value: 0.06 },
      uTreble: { value: 0.04 },
      uBeat: { value: 0 },
      uEnergy: { value: 0.08 },
      uBurstAmt: { value: 0 },
      uIntensity: { value: 0.86 },
      uSpeed: { value: 1 },
      uCoverRes: { value: 1 },
      uTintStrength: { value: 0 },
      uCoverTex: { value: coverTexture },
      uTintColor: { value: new THREE.Color(color) },
      uDotTex: { value: dotTexture },
      uAlpha: { value: 1 },
      uParticleDim: { value: 1 },
      uBloomStrength: { value: 0.62 },
    };

    const geometry = buildCoverParticleGeometry(GRID_SIZE);
    const mainMaterial = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const bloomMaterial = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: BLOOM_VS,
      fragmentShader: BLOOM_FS,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });

    const bloomPoints = new THREE.Points(geometry, bloomMaterial);
    bloomPoints.renderOrder = 0;
    bloomPoints.frustumCulled = false;
    const mainPoints = new THREE.Points(geometry, mainMaterial);
    mainPoints.renderOrder = 1;
    mainPoints.frustumCulled = false;
    scene.add(bloomPoints);
    scene.add(mainPoints);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const nextTexture = new THREE.CanvasTexture(makeSquareCoverCanvas(img, 512));
      nextTexture.minFilter = THREE.LinearFilter;
      nextTexture.magFilter = THREE.LinearFilter;
      nextTexture.colorSpace = THREE.SRGBColorSpace;
      const oldTexture = coverTexture;
      coverTexture = nextTexture;
      uniforms.uCoverTex.value = nextTexture;
      oldTexture.dispose();
    };
    img.src = cover;

    let raf = 0;
    const clock = new THREE.Clock();
    const rot = { x: -0.08, y: 0 };
    const zoom = { value: 6.5 };
    let dragging = false;
    let previous = { x: 0, y: 0 };

    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      previous = { x: event.clientX, y: event.clientY };
      mount.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      previous = { x: event.clientX, y: event.clientY };
      rot.y += dx * 0.005;
      rot.x += dy * 0.005;
    };
    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      mount.releasePointerCapture?.(event.pointerId);
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoom.value = Math.max(4.2, Math.min(9.4, zoom.value + event.deltaY * 0.004));
    };

    window.addEventListener("resize", onResize);
    mount.addEventListener("pointerdown", onPointerDown);
    mount.addEventListener("pointermove", onPointerMove);
    mount.addEventListener("pointerup", onPointerUp);
    mount.addEventListener("pointerleave", onPointerUp);
    mount.addEventListener("wheel", onWheel, { passive: false });

    const tick = () => {
      const dt = Math.min(clock.getDelta(), 0.1);
      const active = statusRef.current !== "idle";
      const thinking = statusRef.current === "thinking";
      const speaking = statusRef.current === "speaking";
      const beatNow = beatRef.current;

      uniforms.uTime.value += dt;
      uniforms.uAlpha.value += (alphaTargetRef.current - uniforms.uAlpha.value) * 0.045;
      uniforms.uBeat.value = beatNow;
      uniforms.uBass.value += ((active ? 0.16 : 0.07) + beatNow * 0.88 - uniforms.uBass.value) * 0.18;
      uniforms.uMid.value += ((speaking ? 0.30 : thinking ? 0.16 : 0.05) + beatNow * 0.28 - uniforms.uMid.value) * 0.14;
      uniforms.uTreble.value += ((speaking ? 0.22 : 0.04) + beatNow * 0.30 - uniforms.uTreble.value) * 0.16;
      uniforms.uEnergy.value += ((speaking ? 0.36 : thinking ? 0.20 : 0.08) + beatNow * 0.44 - uniforms.uEnergy.value) * 0.12;
      uniforms.uBurstAmt.value = Math.max(uniforms.uBurstAmt.value * 0.86, beatNow * 0.72);

      beatRef.current *= 0.78;
      if (beatRef.current < 0.001) beatRef.current = 0;

      if (!dragging && active) {
        rot.y += dt * (speaking ? 0.22 : 0.06);
        rot.x += Math.sin(uniforms.uTime.value * 0.55) * dt * 0.015;
      }
      mainPoints.rotation.set(rot.x, rot.y, 0);
      bloomPoints.rotation.copy(mainPoints.rotation);
      camera.position.z += (zoom.value - camera.position.z) * 0.08;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      mount.removeEventListener("pointerdown", onPointerDown);
      mount.removeEventListener("pointermove", onPointerMove);
      mount.removeEventListener("pointerup", onPointerUp);
      mount.removeEventListener("pointerleave", onPointerUp);
      mount.removeEventListener("wheel", onWheel);
      geometry.dispose();
      mainMaterial.dispose();
      bloomMaterial.dispose();
      dotTexture.dispose();
      coverTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [cover, color]);

  return <div ref={mountRef} className="absolute inset-0" />;
}

export default function ChatParticle() {
  const [activeKey, setActiveKey] = useState<CharKey>("anuan");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "这里是封面粒子聊天风格。你说一句梦，我会让粒子跟着回应。" },
  ]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [beat, setBeat] = useState(0);
  const typingTimerRef = useRef<number | null>(null);

  const char = CHARS[activeKey];

  const pulse = () => setBeat(v => v + 1);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) window.clearInterval(typingTimerRef.current);
    };
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || status !== "idle") return;

    setInput("");
    setMessages(prev => [...prev, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setStatus("thinking");
    pulse();

    let reply = "";
    try {
      const resp = await fetch("/api/ai/dream-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activeCharacter: activeKey,
          history: messages.map(m => ({ role: m.role, content: m.content })),
          userInput: text,
          imageUrl: null,
          musicContext: null,
          dialect: "standard",
          songSearch: false,
        }),
      });
      const data = await resp.json() as { reply?: string };
      reply = data.reply?.trim() || "我听见了。这个梦先不要急着解释，我们让它在这里慢慢显影。";
    } catch {
      reply = "我现在像隔着一层雾听你说话，但这句话我收到了。我们可以先把梦停在这里。";
    }

    setStatus("speaking");
    let i = 0;
    if (typingTimerRef.current) window.clearInterval(typingTimerRef.current);
    typingTimerRef.current = window.setInterval(() => {
      i += 1;
      const next = reply.slice(0, i);
      setMessages(prev => prev.map((m, idx) => idx === prev.length - 1 ? { ...m, content: next } : m));
      if (i % 2 === 0) pulse();
      if (i >= reply.length) {
        if (typingTimerRef.current) window.clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
        window.setTimeout(() => setStatus("idle"), 900);
      }
    }, 32);
  };

  const lastAssistant = useMemo(() => {
    return [...messages].reverse().find(m => m.role === "assistant")?.content ?? "";
  }, [messages]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#03040a] text-white">
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `
          radial-gradient(circle at 50% 38%, hsl(${char.hsl} / 0.18) 0%, transparent 36%),
          radial-gradient(circle at 20% 80%, hsl(${char.hsl} / 0.08) 0%, transparent 34%),
          linear-gradient(180deg, #060713 0%, #020309 100%)
        `,
      }} />

      <ParticleCover cover={char.cover} status={status} beat={beat} color={char.color} />

      <header className="relative z-10 flex items-center justify-between px-5 py-4">
        <Link href="/">
          <button className="flex items-center gap-2 text-xs tracking-wide text-white/35 transition hover:text-white/70">
            <ArrowLeft size={16} />
            返回星球风格
          </button>
        </Link>
        <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] tracking-[0.22em] text-white/32">
          PARTICLE CHAT
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-72px)] max-w-3xl flex-col items-center justify-between px-5 pb-8 pt-4">
        <div className="flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] p-1 backdrop-blur-xl">
          {(Object.keys(CHARS) as CharKey[]).map(key => {
            const active = activeKey === key;
            return (
              <button
                key={key}
                onClick={() => setActiveKey(key)}
                className="rounded-full px-3 py-1.5 text-xs transition"
                style={{
                  color: active ? "rgba(255,255,255,0.86)" : "rgba(255,255,255,0.30)",
                  background: active ? `hsl(${CHARS[key].hsl} / 0.16)` : "transparent",
                  border: active ? `1px solid hsl(${CHARS[key].hsl} / 0.22)` : "1px solid transparent",
                }}
              >
                {CHARS[key].name}
              </button>
            );
          })}
        </div>

        <section className="flex flex-1 flex-col items-center justify-center text-center">
          <motion.div
            key={activeKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-[42vh]"
          >
            <div className="text-2xl font-serif tracking-wide text-white/86">{char.name}</div>
            <div className="mt-1 text-xs tracking-[0.22em] text-white/30">{char.enName} · {char.hint}</div>
          </motion.div>
        </section>

        <div className="relative z-20 w-full max-w-xl">
          <AnimatePresence mode="wait">
            {lastAssistant && (
              <motion.div
                key={lastAssistant.slice(0, 18)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-4 rounded-3xl border border-white/8 bg-black/24 px-5 py-4 text-sm leading-7 text-white/58 backdrop-blur-2xl"
              >
                {lastAssistant}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/32 p-2 backdrop-blur-2xl">
            <Sparkles size={16} style={{ color: `hsl(${char.hsl} / 0.72)` }} />
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") void send();
              }}
              placeholder={`对${char.name}说一个梦里的画面…`}
              className="min-w-0 flex-1 bg-transparent text-sm text-white/68 outline-none placeholder:text-white/24"
            />
            <button
              onClick={() => void send()}
              disabled={!input.trim() || status !== "idle"}
              className="flex h-9 w-9 items-center justify-center rounded-full transition disabled:opacity-30"
              style={{ background: `hsl(${char.hsl} / 0.18)`, color: `hsl(${char.hsl} / 0.88)` }}
            >
              <Send size={15} />
            </button>
          </div>

          <p className="mt-3 text-center text-[10px] tracking-wide text-white/18">
            {status === "thinking" && "粒子正在听见你的梦…"}
            {status === "speaking" && "AI 回复时，封面粒子会跟随文字脉冲。"}
            {status === "idle" && "独立实验页，不影响当前星球粒子聊天。"}
          </p>
        </div>
      </main>
    </div>
  );
}
