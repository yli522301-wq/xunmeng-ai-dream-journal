// @ts-nocheck
/* eslint-disable */
/**
 * CircularGallery — 巡梦沉浸式弧形梦境走廊
 *
 * 功能：
 *   • 弧形排列，5 张左右同时可见
 *   • 默认黑白/低饱和，hover 时卡片慢慢恢复彩色 + 边缘发光
 *   • 拖拽惯性滚动（鼠标 + 触摸）
 *   • 切换到新卡片时播放轻微滑动音效（Web Audio API，首次交互后解锁）
 *   • 点击卡片进入详情（拖动时不误触）
 *
 * 坐标系：
 *   所有 mesh 保持 position.x=0，uOffset = 该卡片当前世界 x 中心
 *   顶点着色器直接输出弯曲后世界坐标，modelViewMatrix 只含相机变换
 */
import { useEffect, useRef } from "react";
import "./CircularGallery.css";

// ── GLSL ─────────────────────────────────────────────────────────────────────
const vertex = /* glsl */`
  attribute vec3 position;
  attribute vec2 uv;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uOffset;
  uniform float uBend;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    float xW = position.x + uOffset;
    float b = abs(uBend) < 0.001 ? 0.001 : uBend;
    float theta = xW * b;
    float finalX = sin(theta) / b;
    float finalZ = (cos(theta) - 1.0) / b;
    gl_Position = projectionMatrix * modelViewMatrix *
                  vec4(finalX, position.y, finalZ, 1.0);
  }
`;

const fragment = /* glsl */`
  precision highp float;
  uniform sampler2D tMap;
  uniform float uGray;      /* 0=full color, 1=full gray */
  uniform float uBright;    /* brightness multiplier     */
  uniform float uRadius;    /* corner rounding 0..0.5    */
  varying vec2 vUv;

  void main() {
    vec4 c = texture2D(tMap, vUv);

    /* Grayscale + brightness */
    float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    vec3 gray = vec3(lum * 0.60);
    vec3 col = mix(c.rgb, gray, uGray) * uBright;

    /* Edge glow when hovered (uGray near 0) */
    float edgeDist = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    float glow = smoothstep(0.06, 0.0, edgeDist) * (1.0 - uGray) * 0.55;
    col += vec3(0.40, 0.52, 1.0) * glow;

    /* Rounded corners */
    float alpha = c.a;
    if (uRadius > 0.001) {
      vec2 uvN = abs(vUv - 0.5) * 2.0;
      float r = uRadius * 2.0;
      vec2 q = max(uvN - (1.0 - r), 0.0);
      float d = length(q) / r;
      alpha *= 1.0 - smoothstep(0.80, 1.0, d);
    }

    gl_FragColor = vec4(col, alpha);
  }
`;

// ── Audio system ──────────────────────────────────────────────────────────────
let _audioCtx = null;
let _audioUnlocked = false;

function _unlockAudio() {
  if (!_audioCtx) {
    try {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      _audioUnlocked = true;
    } catch {}
  }
}

function _playSwipe() {
  if (!_audioUnlocked || !_audioCtx) return;
  try {
    const ctx = _audioCtx;
    const dur = 0.20;
    const sr  = ctx.sampleRate;
    const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const t   = i / sr;
      const env = Math.exp(-t * 22) * (1 - Math.exp(-t * 280));
      d[i] = (Math.random() * 2 - 1) * env * 0.14;
    }
    const src  = ctx.createBufferSource();
    src.buffer = buf;
    const hpf  = ctx.createBiquadFilter();
    hpf.type   = "highpass";
    hpf.frequency.value = 900;
    hpf.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(hpf);
    hpf.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  } catch {}
}

// ── Canvas texture builders ───────────────────────────────────────────────────
const CVS_W = 640;
const CVS_H = 480;

const CHAR_PAL = {
  daoshen: { a: "#081830", b: "#030410", glow: "rgba(107,140,255,0.60)" },
  muge:    { a: "#120830", b: "#050310", glow: "rgba(155,124,255,0.60)" },
  anuan:   { a: "#401c04", b: "#060308", glow: "rgba(242,168,75,0.60)"  },
  default: { a: "#090820", b: "#030310", glow: "rgba(120,155,255,0.50)" },
};

function _addStars(ctx, n) {
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = Math.random() * 0.55 + 0.08;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(Math.random() * CVS_W, Math.random() * CVS_H, Math.random() * 1.4 + 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function _stampTitle(ctx, title) {
  if (!title) return;
  ctx.save();
  ctx.font = "500 22px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.shadowColor = "rgba(0,0,0,0.98)";
  ctx.shadowBlur = 20;
  const maxW  = CVS_W - 60;
  const chars = [...String(title)];
  const lines = [];
  let line    = "";
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line.length) { lines.push(line); line = ch; }
    else line = test;
  }
  lines.push(line);
  let y = CVS_H - 22;
  for (let i = lines.length - 1; i >= 0; i--) {
    ctx.fillStyle = "rgba(240,235,255,0.92)";
    ctx.fillText(lines[i], CVS_W / 2, y);
    y -= 30;
  }
  ctx.restore();
}

function _makeFallback(charKey, title) {
  const cvs = document.createElement("canvas");
  cvs.width = CVS_W; cvs.height = CVS_H;
  const ctx = cvs.getContext("2d");
  const pal = CHAR_PAL[charKey] || CHAR_PAL.default;
  const g   = ctx.createLinearGradient(0, 0, CVS_W, CVS_H);
  g.addColorStop(0, pal.a); g.addColorStop(1, pal.b);
  ctx.fillStyle = g; ctx.fillRect(0, 0, CVS_W, CVS_H);
  _addStars(ctx, 80);
  const rg = ctx.createRadialGradient(CVS_W/2, CVS_H*0.38, 0, CVS_W/2, CVS_H*0.38, 130);
  rg.addColorStop(0, pal.glow); rg.addColorStop(1, "transparent");
  ctx.fillStyle = rg; ctx.fillRect(0, 0, CVS_W, CVS_H);
  const bg = ctx.createLinearGradient(0, CVS_H * 0.48, 0, CVS_H);
  bg.addColorStop(0, "transparent"); bg.addColorStop(1, "rgba(2,2,10,0.96)");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, CVS_W, CVS_H);
  _stampTitle(ctx, title);
  return cvs;
}

function _makeImageCanvas(src, charKey, title) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const cvs = document.createElement("canvas");
      cvs.width = CVS_W; cvs.height = CVS_H;
      const ctx = cvs.getContext("2d");
      const ar = CVS_W / CVS_H, ai = img.width / img.height;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (ai > ar) { sw = img.height * ar; sx = (img.width - sw) / 2; }
      else         { sh = img.width / ar;  sy = (img.height - sh) / 2; }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, CVS_W, CVS_H);
      ctx.fillStyle = "rgba(4,4,14,0.38)"; ctx.fillRect(0, 0, CVS_W, CVS_H);
      const bg = ctx.createLinearGradient(0, CVS_H * 0.45, 0, CVS_H);
      bg.addColorStop(0, "transparent"); bg.addColorStop(1, "rgba(3,3,12,0.94)");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, CVS_W, CVS_H);
      _stampTitle(ctx, title);
      resolve(cvs);
    };
    img.onerror = () => resolve(_makeFallback(charKey, title));
    img.src = src;
  });
}

async function _buildCanvas(item) {
  if (item.image) return _makeImageCanvas(item.image, item.charKey, item.text);
  return _makeFallback(item.charKey, item.text);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CircularGallery({
  items        = [],
  bend         = 3,
  borderRadius = 0.06,
  scrollEase   = 0.04,
  scrollSpeed  = 2,
  onItemClick,
}) {
  const mountRef   = useRef(null);
  const cleanupRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container || items.length === 0) return;

    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }

    let destroyed  = false;
    let rafId      = null;

    // Pad to at least 6 cards
    const MIN  = 6;
    let padded = [...items];
    while (padded.length < MIN) padded = [...padded, ...items];
    padded = padded.slice(0, Math.max(MIN, items.length * 2 <= 30 ? items.length : 30));

    (async () => {
      let ogl;
      try { ogl = await import("ogl"); }
      catch (e) { console.error("[CircularGallery] ogl import failed", e); return; }
      if (destroyed) return;

      const { Renderer, Camera, Transform, Program, Mesh, Plane, Texture } = ogl;

      // Renderer
      const renderer = new Renderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
      const gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);
      const canvas = gl.canvas;
      canvas.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;cursor:grab;";
      container.appendChild(canvas);

      // Camera
      const FOV  = 40;
      const camera = new Camera(gl, { fov: FOV });
      camera.position.set(0, 0, 5);

      const scene = new Transform();

      // Resize
      function resize() {
        const w = container.clientWidth, h = container.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h);
        camera.perspective({ aspect: w / h });
      }
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(container);

      // Textures
      const canvases = await Promise.all(padded.map(_buildCanvas));
      if (destroyed) return;

      // Card geometry: wider cards, ~5 visible in view
      const CARD_W = 1.72;
      const CARD_H = 1.32;
      const STEP   = 1.88;
      const N      = padded.length;
      const totalW = (N - 1) * STEP;

      // Build slides
      const slides = padded.map((item, i) => {
        const tex = new Texture(gl, {
          image: canvases[i],
          generateMipmaps: false,
          minFilter: gl.LINEAR,
          magFilter: gl.LINEAR,
          wrapS: gl.CLAMP_TO_EDGE,
          wrapT: gl.CLAMP_TO_EDGE,
        });

        const prog = new Program(gl, {
          vertex,
          fragment,
          uniforms: {
            tMap:    { value: tex },
            uOffset: { value: 0 },
            uBend:   { value: bend },
            uGray:   { value: 0.92 },
            uBright: { value: 0.70 },
            uRadius: { value: borderRadius },
          },
          transparent: true,
          depthTest:   false,
          depthWrite:  false,
        });

        const geo  = new Plane(gl, { width: CARD_W, height: CARD_H, widthSegments: 32, heightSegments: 1 });
        const mesh = new Mesh(gl, { geometry: geo, program: prog });
        mesh.setParent(scene);

        return {
          prog,
          item,
          baseX: i * STEP - totalW / 2,
        };
      });

      // Scroll state
      let scrollX  = 0;
      let targetX  = 0;
      const maxScr = totalW / 2;

      // Sound cooldown
      let lastSoundMs = 0;
      let centerIdx   = -1;

      // Mouse NDC x (-1..1), null if outside canvas
      let mouseNDX = null;

      // Pointer drag state
      let pDown = false, pStartX = 0, pStartScr = 0, pDelta = 0, pLast = 0, vel = 0;
      const cx = e => e.touches ? e.touches[0].clientX : e.clientX;

      // Audio unlock on first interaction
      const unlockOnce = () => { _unlockAudio(); };
      window.addEventListener("pointerdown", unlockOnce, { once: true });

      const onWheel = e => {
        e.preventDefault();
        targetX = Math.max(-maxScr, Math.min(maxScr, targetX + (e.deltaX || e.deltaY) * 0.005 * scrollSpeed));
      };

      const onDown = e => {
        pDown = true;
        pStartX = cx(e); pStartScr = targetX;
        pDelta = 0; pLast = pStartX; vel = 0;
        canvas.style.cursor = "grabbing";
      };

      const onMove = e => {
        if (!pDown) return;
        const x = cx(e);
        vel = x - pLast; pLast = x;
        pDelta = Math.abs(x - pStartX);
        targetX = Math.max(-maxScr, Math.min(maxScr, pStartScr + (pStartX - x) * 0.0044 * scrollSpeed));
      };

      const onMouseMove = e => {
        const rect = canvas.getBoundingClientRect();
        mouseNDX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      };
      const onMouseLeave = () => { mouseNDX = null; };

      const onUp = e => {
        if (!pDown) return;
        pDown = false;
        canvas.style.cursor = "grab";
        // Inertia
        targetX = Math.max(-maxScr, Math.min(maxScr, targetX - vel * 0.06 * scrollSpeed));

        // Tap → click
        if (pDelta < 8 && onItemClick) {
          const tapX  = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
          const rect  = canvas.getBoundingClientRect();
          const ndcX  = ((tapX - rect.left) / rect.width) * 2 - 1;
          const aspect = gl.canvas.width / gl.canvas.height;
          const vph   = 2 * camera.position.z * Math.tan((FOV / 2) * Math.PI / 180);
          const vpw   = vph * aspect;
          const worldX = ndcX * vpw * 0.5;
          let best = null, bestD = Infinity;
          for (const s of slides) {
            const d = Math.abs(s.prog.uniforms.uOffset.value - worldX);
            if (d < bestD) { bestD = d; best = s; }
          }
          if (best && bestD < CARD_W * 0.60) onItemClick(best.item);
        }
      };

      canvas.addEventListener("wheel",      onWheel, { passive: false });
      canvas.addEventListener("mousedown",  onDown);
      canvas.addEventListener("touchstart", onDown, { passive: true });
      canvas.addEventListener("mousemove",  onMouseMove);
      canvas.addEventListener("mouseleave", onMouseLeave);
      window.addEventListener("mousemove",  onMove);
      window.addEventListener("touchmove",  onMove, { passive: true });
      window.addEventListener("mouseup",    onUp);
      window.addEventListener("touchend",   onUp);

      // Render loop
      const tick = () => {
        if (destroyed) return;
        rafId = requestAnimationFrame(tick);

        scrollX += (targetX - scrollX) * scrollEase;

        const aspect = (gl.canvas.width || 1) / (gl.canvas.height || 1);
        const vph    = 2 * camera.position.z * Math.tan((FOV / 2) * Math.PI / 180);
        const vpw    = vph * aspect;

        // Determine hovered slide via mouse world-x
        let hoveredIdx = -1;
        if (mouseNDX !== null) {
          const mWorldX = mouseNDX * vpw * 0.5;
          let bd = Infinity;
          for (let i = 0; i < slides.length; i++) {
            const off = slides[i].baseX - scrollX;
            const d   = Math.abs(off - mWorldX);
            if (d < bd) { bd = d; hoveredIdx = i; }
          }
          if (bd > CARD_W * 0.62) hoveredIdx = -1;
        }

        // Determine center slide (for sound)
        let newCenter = 0, bc = Infinity;
        for (let i = 0; i < slides.length; i++) {
          const off = slides[i].baseX - scrollX;
          const d   = Math.abs(off);
          if (d < bc) { bc = d; newCenter = i; }
        }
        const now = performance.now();
        if (newCenter !== centerIdx && bc < STEP * 0.45 && now - lastSoundMs > 280) {
          centerIdx   = newCenter;
          lastSoundMs = now;
          _playSwipe();
        }

        // Update per-slide uniforms
        for (let i = 0; i < slides.length; i++) {
          const s       = slides[i];
          const isHover = i === hoveredIdx;
          const gT = isHover ? 0.0  : 0.92;
          const bT = isHover ? 1.06 : 0.70;
          const ease = 0.085;
          s.prog.uniforms.uOffset.value  = s.baseX - scrollX;
          s.prog.uniforms.uGray.value   += (gT - s.prog.uniforms.uGray.value)   * ease;
          s.prog.uniforms.uBright.value += (bT - s.prog.uniforms.uBright.value) * ease;
        }

        renderer.render({ scene, camera });
      };
      tick();

      // Cleanup
      cleanupRef.current = () => {
        destroyed = true;
        if (rafId) cancelAnimationFrame(rafId);
        ro.disconnect();
        canvas.removeEventListener("wheel",      onWheel);
        canvas.removeEventListener("mousedown",  onDown);
        canvas.removeEventListener("touchstart", onDown);
        canvas.removeEventListener("mousemove",  onMouseMove);
        canvas.removeEventListener("mouseleave", onMouseLeave);
        window.removeEventListener("mousemove",  onMove);
        window.removeEventListener("touchmove",  onMove);
        window.removeEventListener("mouseup",    onUp);
        window.removeEventListener("touchend",   onUp);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        try { gl.getExtension("WEBGL_lose_context")?.loseContext(); } catch {}
      };
    })();

    return () => {
      destroyed = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(items.map(i => `${i.image}|${i.text}|${i.dreamId}`))]);

  return <div ref={mountRef} className="cg-root" />;
}
