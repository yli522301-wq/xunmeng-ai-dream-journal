// @ts-nocheck
/* eslint-disable */
/**
 * CircularGallery — WebGL curved gallery built with OGL.
 * 巡梦专属版：深色梦境风格，支持 onItemClick 点击进入详情。
 */
import { useEffect, useRef } from "react";
import "./CircularGallery.css";

// ── GLSL ─────────────────────────────────────────────────────────────────────
const vertex = /* glsl */ `
  attribute vec3 position;
  attribute vec2 uv;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uOffset;
  uniform float uBend;

  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Map x world position to cylinder arc
    float xWorld = pos.x + uOffset;
    float r      = 1.0 / max(abs(uBend), 0.0001) * sign(uBend == 0.0 ? 1.0 : uBend);
    float theta  = xWorld * uBend;
    float sinT   = sin(theta);
    float cosT   = cos(theta);

    // Curved x and z; keep y (height) flat
    pos.x = sinT / uBend - uOffset;
    pos.z = (cosT - 1.0) / uBend;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tMap;
  varying vec2 vUv;
  void main() {
    gl_FragColor = texture2D(tMap, vUv);
  }
`;

// ── Canvas texture helpers ────────────────────────────────────────────────────
const CVS_W = 512;
const CVS_H = 384;

const CHAR_COLORS = {
  daoshen: { from: "rgba(40,100,180,0.85)", to: "rgba(5,5,20,0.95)", star: "rgba(107,140,255,0.70)" },
  muge:    { from: "rgba(60,30,160,0.85)",  to: "rgba(5,5,20,0.95)", star: "rgba(155,124,255,0.70)" },
  anuan:   { from: "rgba(160,90,20,0.80)",  to: "rgba(5,5,20,0.95)", star: "rgba(242,168,75,0.70)" },
  default: { from: "rgba(30,30,100,0.85)",  to: "rgba(5,5,20,0.95)", star: "rgba(130,160,255,0.60)" },
};

function scatterStars(ctx, count, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = Math.random() * CVS_W;
    const y = Math.random() * CVS_H;
    const r = Math.random() * 1.4 + 0.3;
    const a = Math.random() * 0.55 + 0.1;
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawTitle(ctx, title) {
  if (!title) return;
  ctx.save();
  ctx.font = "500 22px 'Noto Serif SC', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.shadowColor = "rgba(0,0,0,0.90)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "rgba(237,235,255,0.92)";

  // Simple CJK line-wrap
  const maxW = CVS_W - 56;
  const chars = [...title];
  const lines = [];
  let line = "";
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line.length > 0) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  lines.push(line);

  const lh = 30;
  let y = CVS_H - 22;
  for (let i = lines.length - 1; i >= 0; i--) {
    ctx.fillText(lines[i], CVS_W / 2, y);
    y -= lh;
  }
  ctx.restore();
}

function buildFallbackCanvas(charKey, title) {
  const cvs = document.createElement("canvas");
  cvs.width = CVS_W;
  cvs.height = CVS_H;
  const ctx = cvs.getContext("2d");
  const pal = CHAR_COLORS[charKey] || CHAR_COLORS.default;

  // Gradient background
  const grd = ctx.createLinearGradient(0, 0, CVS_W, CVS_H);
  grd.addColorStop(0, pal.from);
  grd.addColorStop(1, pal.to);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, CVS_W, CVS_H);

  // Stars
  scatterStars(ctx, 70, pal.star);

  // Central glow
  const rg = ctx.createRadialGradient(CVS_W / 2, CVS_H * 0.42, 0, CVS_W / 2, CVS_H * 0.42, 120);
  rg.addColorStop(0, pal.star.replace("0.70", "0.28"));
  rg.addColorStop(1, "transparent");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, CVS_W, CVS_H);

  // Bottom gradient for text legibility
  const bg = ctx.createLinearGradient(0, CVS_H * 0.55, 0, CVS_H);
  bg.addColorStop(0, "transparent");
  bg.addColorStop(1, "rgba(5,5,14,0.92)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CVS_W, CVS_H);

  drawTitle(ctx, title);
  return cvs;
}

function buildImageCanvas(imgSrc, charKey, title) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const cvs = document.createElement("canvas");
      cvs.width = CVS_W;
      cvs.height = CVS_H;
      const ctx = cvs.getContext("2d");

      // Cover-fill the image
      const aspect = CVS_W / CVS_H;
      const ia = img.width / img.height;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (ia > aspect) {
        sw = img.height * aspect;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / aspect;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, CVS_W, CVS_H);

      // Dark vignette overlay
      ctx.fillStyle = "rgba(5,5,16,0.40)";
      ctx.fillRect(0, 0, CVS_W, CVS_H);

      // Bottom gradient for text
      const bg = ctx.createLinearGradient(0, CVS_H * 0.50, 0, CVS_H);
      bg.addColorStop(0, "transparent");
      bg.addColorStop(1, "rgba(5,5,12,0.90)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, CVS_W, CVS_H);

      drawTitle(ctx, title);
      resolve(cvs);
    };
    img.onerror = () => resolve(buildFallbackCanvas(charKey, title));
    img.src = imgSrc;
  });
}

async function buildTextureCanvas(item) {
  if (item.image) return buildImageCanvas(item.image, item.charKey, item.text);
  return buildFallbackCanvas(item.charKey, item.text);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CircularGallery({
  items = [],
  bend = 3,
  textColor = "#EDEBFF",
  borderRadius = 0.05,
  scrollEase = 0.05,
  scrollSpeed = 2,
  onItemClick,
}) {
  const mountRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current || items.length === 0) return;

    const container = mountRef.current;
    let destroyed = false;
    let raf = null;

    // Avoid double-init in React StrictMode
    if (container.dataset.glInit === "1") return;
    container.dataset.glInit = "1";

    let cleanupFns = [];

    (async () => {
      let ogl;
      try {
        ogl = await import("ogl");
      } catch (e) {
        console.error("[CircularGallery] ogl import failed", e);
        return;
      }
      if (destroyed) return;

      const { Renderer, Camera, Transform, Program, Mesh, Plane, Texture } = ogl;

      // ── Renderer
      const renderer = new Renderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      const gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);
      container.appendChild(gl.canvas);
      gl.canvas.style.display = "block";
      gl.canvas.style.width = "100%";
      gl.canvas.style.height = "100%";

      // ── Camera
      const FOV = 45;
      const camera = new Camera(gl, { fov: FOV });
      camera.position.z = 5;

      // ── Scene
      const scene = new Transform();

      // ── Resize
      const onResize = () => {
        if (!container) return;
        renderer.setSize(container.clientWidth, container.clientHeight);
        camera.perspective({ aspect: gl.canvas.width / gl.canvas.height });
      };
      onResize();
      window.addEventListener("resize", onResize);
      cleanupFns.push(() => window.removeEventListener("resize", onResize));

      // ── Build textures from canvases
      const canvases = await Promise.all(items.map(buildTextureCanvas));
      if (destroyed) return;

      // ── Card dimensions (4∶3 proportion)
      const CARD_W = 1.65;
      const CARD_H = 1.24;
      const GAP    = 0.22;
      const STEP   = CARD_W + GAP;

      const slides = items.map((item, i) => {
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
          },
          transparent: true,
          depthTest: false,
          depthWrite: false,
        });

        const geo  = new Plane(gl, { width: CARD_W, height: CARD_H, widthSegments: 24 });
        const mesh = new Mesh(gl, { geometry: geo, program: prog });

        const baseX = i * STEP - ((items.length - 1) * STEP) / 2;
        mesh.position.x = baseX;
        mesh.setParent(scene);

        return { mesh, prog, item, baseX };
      });

      // ── Scroll state
      let scrollX    = 0;
      let targetX    = 0;
      const maxScroll = ((items.length - 1) * STEP) / 2;

      // ── Input
      let pointerDown   = false;
      let dragStartX    = 0;
      let dragStartScrl = 0;
      let dragDelta     = 0;
      let lastX         = 0;
      let momentum      = 0;

      const onWheel = (e) => {
        e.preventDefault();
        targetX += e.deltaX * 0.005 * scrollSpeed + e.deltaY * 0.003 * scrollSpeed;
        targetX = Math.max(-maxScroll, Math.min(maxScroll, targetX));
      };

      const getClientX = (e) =>
        e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;

      const onDown = (e) => {
        pointerDown   = true;
        dragStartX    = getClientX(e);
        dragStartScrl = targetX;
        dragDelta     = 0;
        lastX         = dragStartX;
        momentum      = 0;
      };

      const onMove = (e) => {
        if (!pointerDown) return;
        const cx = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
        momentum  = cx - lastX;
        lastX     = cx;
        dragDelta = Math.abs(cx - dragStartX);
        targetX   = dragStartScrl + (dragStartX - cx) * 0.005 * scrollSpeed;
        targetX   = Math.max(-maxScroll, Math.min(maxScroll, targetX));
      };

      const onUp = (e) => {
        if (!pointerDown) return;
        pointerDown = false;

        // Inertia
        targetX -= momentum * 0.04 * scrollSpeed;
        targetX  = Math.max(-maxScroll, Math.min(maxScroll, targetX));

        // Click detection: tiny movement = tap
        if (dragDelta < 6 && onItemClick) {
          const tapX = e.type === "touchend"
            ? e.changedTouches[0].clientX
            : e.clientX;
          const rect   = gl.canvas.getBoundingClientRect();
          const ndcX   = ((tapX - rect.left) / rect.width) * 2 - 1;
          const aspect = gl.canvas.width / gl.canvas.height;
          const vpH    = 2 * camera.position.z * Math.tan((FOV / 2) * Math.PI / 180);
          const vpW    = vpH * aspect;
          const worldX = ndcX * vpW * 0.5;

          // Find nearest slide to tap world-x
          let best = null;
          let bestD = Infinity;
          for (const s of slides) {
            const sx = s.baseX - scrollX;
            const d  = Math.abs(sx - worldX);
            if (d < bestD) { bestD = d; best = s; }
          }
          if (best && bestD < CARD_W * 0.7) {
            onItemClick(best.item);
          }
        }
      };

      gl.canvas.addEventListener("wheel",      onWheel,  { passive: false });
      gl.canvas.addEventListener("mousedown",  onDown);
      gl.canvas.addEventListener("touchstart", onDown,   { passive: true });
      window.addEventListener(   "mousemove",  onMove);
      window.addEventListener(   "touchmove",  onMove,   { passive: true });
      window.addEventListener(   "mouseup",    onUp);
      window.addEventListener(   "touchend",   onUp);

      cleanupFns.push(() => {
        gl.canvas.removeEventListener("wheel",      onWheel);
        gl.canvas.removeEventListener("mousedown",  onDown);
        gl.canvas.removeEventListener("touchstart", onDown);
        window.removeEventListener(   "mousemove",  onMove);
        window.removeEventListener(   "touchmove",  onMove);
        window.removeEventListener(   "mouseup",    onUp);
        window.removeEventListener(   "touchend",   onUp);
        if (gl.canvas.parentNode) gl.canvas.parentNode.removeChild(gl.canvas);
        try { gl.getExtension("WEBGL_lose_context")?.loseContext(); } catch {}
      });

      // ── Render loop
      const loop = () => {
        if (destroyed) return;
        raf = requestAnimationFrame(loop);
        scrollX += (targetX - scrollX) * scrollEase;

        for (const s of slides) {
          const xPos = s.baseX - scrollX;
          s.mesh.position.x = xPos;
          s.prog.uniforms.uOffset.value = xPos;
        }
        renderer.render({ scene, camera });
      };
      loop();
    })();

    return () => {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      for (const fn of cleanupFns) fn();
      container.dataset.glInit = "";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(items.map(i => i.image + i.text + i.dreamId))]);

  return <div ref={mountRef} className="cg-root" />;
}
