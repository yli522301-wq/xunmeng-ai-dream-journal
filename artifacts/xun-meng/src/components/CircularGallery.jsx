// @ts-nocheck
/* eslint-disable */
/**
 * CircularGallery — WebGL curved gallery built with OGL.
 * 巡梦专属版：深色梦境风格，弯曲排列，拖拽滚动，点击进入详情。
 *
 * 坐标系说明：
 *   所有 mesh 的 position 保持在原点 (0,0,0)。
 *   uOffset = 当前卡片的世界 x 中心位置（由滚动偏移计算）。
 *   顶点着色器直接输出弯曲后的世界坐标，modelViewMatrix 只含相机变换。
 */
import { useEffect, useRef } from "react";
import "./CircularGallery.css";

// ── GLSL ─────────────────────────────────────────────────────────────────────
const vertex = /* glsl */`
  attribute vec3 position;
  attribute vec2 uv;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uOffset;   /* 该卡片当前世界 x 中心 */
  uniform float uBend;     /* 弯曲强度 */

  varying vec2 vUv;

  void main() {
    vUv = uv;

    /* 顶点世界 x = 局部 x + 卡片中心世界 x */
    float xW = position.x + uOffset;

    /* 保护 bend=0 */
    float b = abs(uBend) < 0.001 ? 0.001 : uBend;

    float theta = xW * b;
    float finalX = sin(theta) / b;
    float finalZ = (cos(theta) - 1.0) / b;

    /* mesh 在原点，modelViewMatrix 只有相机变换 */
    gl_Position = projectionMatrix * modelViewMatrix *
                  vec4(finalX, position.y, finalZ, 1.0);
  }
`;

const fragment = /* glsl */`
  precision highp float;
  uniform sampler2D tMap;
  varying vec2 vUv;
  void main() {
    gl_FragColor = texture2D(tMap, vUv);
  }
`;

// ── Canvas texture builders ───────────────────────────────────────────────────
const CVS_W = 512;
const CVS_H = 384;

const CHAR_PAL = {
  daoshen: { a: "#0a1e48", b: "#050510", glow: "rgba(107,140,255,0.55)" },
  muge:    { a: "#100a35", b: "#050510", glow: "rgba(155,124,255,0.55)" },
  anuan:   { a: "#3d1e04", b: "#050510", glow: "rgba(242,168,75,0.55)"  },
  default: { a: "#0a0a28", b: "#050510", glow: "rgba(120,150,255,0.45)" },
};

function addStars(ctx, n) {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * CVS_W;
    const y = Math.random() * CVS_H;
    const r = Math.random() * 1.2 + 0.3;
    ctx.globalAlpha = Math.random() * 0.5 + 0.08;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function stampTitle(ctx, title) {
  if (!title) return;
  ctx.save();
  ctx.font = "500 20px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.shadowColor = "rgba(0,0,0,0.95)";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "rgba(237,235,255,0.90)";

  const maxW = CVS_W - 52;
  const chars = [...String(title)];
  const lines = [];
  let line = "";
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line.length) {
      lines.push(line); line = ch;
    } else { line = test; }
  }
  lines.push(line);

  let y = CVS_H - 20;
  for (let i = lines.length - 1; i >= 0; i--) {
    ctx.fillText(lines[i], CVS_W / 2, y);
    y -= 28;
  }
  ctx.restore();
}

function makeFallback(charKey, title) {
  const cvs = document.createElement("canvas");
  cvs.width = CVS_W; cvs.height = CVS_H;
  const ctx = cvs.getContext("2d");
  const pal = CHAR_PAL[charKey] || CHAR_PAL.default;

  const g = ctx.createLinearGradient(0, 0, CVS_W, CVS_H);
  g.addColorStop(0, pal.a); g.addColorStop(1, pal.b);
  ctx.fillStyle = g; ctx.fillRect(0, 0, CVS_W, CVS_H);

  addStars(ctx, 65);

  // Glow orb
  const rg = ctx.createRadialGradient(CVS_W/2, CVS_H*0.40, 0, CVS_W/2, CVS_H*0.40, 110);
  rg.addColorStop(0, pal.glow); rg.addColorStop(1, "transparent");
  ctx.fillStyle = rg; ctx.fillRect(0, 0, CVS_W, CVS_H);

  // Bottom fade for text
  const bg = ctx.createLinearGradient(0, CVS_H * 0.52, 0, CVS_H);
  bg.addColorStop(0, "transparent"); bg.addColorStop(1, "rgba(3,3,12,0.94)");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, CVS_W, CVS_H);

  stampTitle(ctx, title);
  return cvs;
}

function makeImageCanvas(src, charKey, title) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const cvs = document.createElement("canvas");
      cvs.width = CVS_W; cvs.height = CVS_H;
      const ctx = cvs.getContext("2d");

      // Cover-crop
      const ar = CVS_W / CVS_H, ai = img.width / img.height;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (ai > ar) { sw = img.height * ar; sx = (img.width - sw) / 2; }
      else         { sh = img.width / ar;  sy = (img.height - sh) / 2; }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, CVS_W, CVS_H);

      ctx.fillStyle = "rgba(5,5,16,0.40)"; ctx.fillRect(0, 0, CVS_W, CVS_H);

      const bg = ctx.createLinearGradient(0, CVS_H * 0.48, 0, CVS_H);
      bg.addColorStop(0, "transparent"); bg.addColorStop(1, "rgba(4,4,12,0.92)");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, CVS_W, CVS_H);

      stampTitle(ctx, title);
      resolve(cvs);
    };
    img.onerror = () => resolve(makeFallback(charKey, title));
    img.src = src;
  });
}

async function buildCanvas(item) {
  if (item.image) return makeImageCanvas(item.image, item.charKey, item.text);
  return makeFallback(item.charKey, item.text);
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
  const mountRef  = useRef(null);
  const cleanupRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container || items.length === 0) return;

    // Kill any previous instance
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }

    let destroyed = false;
    let rafId = null;

    // Pad items so we always have at least 6 visible cards
    const MIN_CARDS = 6;
    let paddedItems = [...items];
    if (paddedItems.length < MIN_CARDS) {
      while (paddedItems.length < MIN_CARDS) {
        paddedItems = [...paddedItems, ...items];
      }
      paddedItems = paddedItems.slice(0, Math.max(MIN_CARDS, items.length));
    }

    (async () => {
      let ogl;
      try { ogl = await import("ogl"); }
      catch (e) { console.error("[CircularGallery] ogl load failed", e); return; }
      if (destroyed) return;

      const { Renderer, Camera, Transform, Program, Mesh, Plane, Texture } = ogl;

      // ── Renderer (transparent background)
      const renderer = new Renderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
      const gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);

      const canvas = gl.canvas;
      canvas.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;";
      container.appendChild(canvas);

      // ── Camera
      const FOV  = 40;
      const camera = new Camera(gl, { fov: FOV });
      camera.position.set(0, 0, 5);

      // ── Scene
      const scene = new Transform();

      // ── Resize helper
      function resize() {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h);
        camera.perspective({ aspect: w / h });
      }
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(container);

      // ── Build textures
      const canvases = await Promise.all(paddedItems.map(buildCanvas));
      if (destroyed) return;

      // Card dimensions
      const CARD_W  = 1.6;
      const CARD_H  = 1.2;
      const STEP    = CARD_W + 0.24;
      const N       = paddedItems.length;
      const totalW  = (N - 1) * STEP;

      // Create slides — ALL meshes at origin; shader handles world positioning
      const slides = paddedItems.map((item, i) => {
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

        const geo  = new Plane(gl, { width: CARD_W, height: CARD_H, widthSegments: 30, heightSegments: 1 });
        const mesh = new Mesh(gl, { geometry: geo, program: prog });
        // IMPORTANT: mesh stays at origin — shader handles world x
        mesh.setParent(scene);

        const baseX = i * STEP - totalW / 2;
        return { prog, item: paddedItems[i], baseX };
      });

      // ── Scroll state
      let scrollX  = 0;
      let targetX  = 0;
      const maxScr = totalW / 2;

      // ── Input
      let pDown = false, pStartX = 0, pStartScr = 0, pDelta = 0, pLast = 0, vel = 0;

      const cx = e => e.touches ? e.touches[0].clientX : e.clientX;

      const onWheel = e => {
        e.preventDefault();
        targetX += (e.deltaX || e.deltaY) * 0.004 * scrollSpeed;
        targetX = Math.max(-maxScr, Math.min(maxScr, targetX));
      };
      const onDown = e => {
        pDown = true; pStartX = cx(e); pStartScr = targetX;
        pDelta = 0; pLast = pStartX; vel = 0;
        canvas.style.cursor = "grabbing";
      };
      const onMove = e => {
        if (!pDown) return;
        const x = cx(e);
        vel = x - pLast; pLast = x;
        pDelta = Math.abs(x - pStartX);
        targetX = pStartScr + (pStartX - x) * 0.0042 * scrollSpeed;
        targetX = Math.max(-maxScr, Math.min(maxScr, targetX));
      };
      const onUp = e => {
        if (!pDown) return;
        pDown = false;
        canvas.style.cursor = "grab";

        // Inertia
        targetX -= vel * 0.05 * scrollSpeed;
        targetX = Math.max(-maxScr, Math.min(maxScr, targetX));

        // Tap detection
        if (pDelta < 7 && onItemClick) {
          const tapX  = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
          const rect  = canvas.getBoundingClientRect();
          const ndcX  = ((tapX - rect.left) / rect.width) * 2 - 1;
          const aspect = canvas.width / canvas.height;
          const vph   = 2 * camera.position.z * Math.tan((FOV / 2) * Math.PI / 180);
          const vpw   = vph * aspect;
          const worldX = ndcX * vpw * 0.5;

          // Nearest slide whose world x is close to tap
          let best = null, bestD = Infinity;
          for (const s of slides) {
            const sx = s.baseX - scrollX;
            const d  = Math.abs(sx - worldX);
            if (d < bestD) { bestD = d; best = s; }
          }
          if (best && bestD < CARD_W * 0.65) {
            onItemClick(best.item);
          }
        }
      };

      canvas.addEventListener("wheel",      onWheel, { passive: false });
      canvas.addEventListener("mousedown",  onDown);
      canvas.addEventListener("touchstart", onDown, { passive: true });
      window.addEventListener("mousemove",  onMove);
      window.addEventListener("touchmove",  onMove, { passive: true });
      window.addEventListener("mouseup",    onUp);
      window.addEventListener("touchend",   onUp);

      // ── Render loop
      const tick = () => {
        if (destroyed) return;
        rafId = requestAnimationFrame(tick);
        scrollX += (targetX - scrollX) * scrollEase;

        for (const s of slides) {
          // uOffset = this slide's current world x center
          s.prog.uniforms.uOffset.value = s.baseX - scrollX;
        }
        renderer.render({ scene, camera });
      };
      tick();

      // ── Cleanup
      cleanupRef.current = () => {
        destroyed = true;
        if (rafId) cancelAnimationFrame(rafId);
        ro.disconnect();
        canvas.removeEventListener("wheel",      onWheel);
        canvas.removeEventListener("mousedown",  onDown);
        canvas.removeEventListener("touchstart", onDown);
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
  // Re-init when item identities change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(items.map(i => `${i.image}|${i.text}|${i.dreamId}`))]);

  if (items.length === 0) {
    return (
      <div className="cg-root flex items-center justify-center">
        <p style={{ color: "rgba(255,255,255,0.18)", fontSize: 12, letterSpacing: "0.15em" }}>
          还没有梦境被收入档案。
        </p>
      </div>
    );
  }

  return <div ref={mountRef} className="cg-root" />;
}
