// @ts-nocheck
/* eslint-disable */
/**
 * ChromaGrid — 巡梦梦境档案网格
 *
 * 默认全卡低饱和/黑白；鼠标移近时 GSAP 动态恢复颜色与亮度，
 * 像沉睡梦境被光唤醒。点击卡片调用 onItemClick(item)，无外链。
 *
 * item 数据结构:
 *   { dreamId, charKey, image, date, time, title, subtitle,
 *     hasAudio, hasImage }
 */
import { useRef, useEffect } from "react";
import gsap from "gsap";
import "./ChromaGrid.css";

// ── Character palette ────────────────────────────────────────────────────────
const CHAR = {
  daoshen: {
    name: "岛深",
    dot:  "#6B8CFF",
    r: 107, g: 140, b: 255,
    grad: "linear-gradient(145deg, #081a36 0%, #04091e 55%, #020310 100%)",
    glowGrad: "radial-gradient(ellipse at 50% 30%, rgba(107,140,255,0.35) 0%, transparent 70%)",
  },
  muge: {
    name: "暮歌",
    dot:  "#9B7CFF",
    r: 155, g: 124, b: 255,
    grad: "linear-gradient(145deg, #150828 0%, #0a0418 55%, #04020e 100%)",
    glowGrad: "radial-gradient(ellipse at 50% 30%, rgba(155,124,255,0.35) 0%, transparent 70%)",
  },
  anuan: {
    name: "阿暖",
    dot:  "#F2A84B",
    r: 242, g: 168, b:  75,
    grad: "linear-gradient(145deg, #3c1b04 0%, #1e0d02 55%, #060205 100%)",
    glowGrad: "radial-gradient(ellipse at 50% 30%, rgba(242,168,75,0.30) 0%, transparent 70%)",
  },
};
const CHAR_DEFAULT = {
  name: "梦",
  dot:  "#8098E0",
  r: 128, g: 152, b: 224,
  grad: "linear-gradient(145deg, #09091e 0%, #040410 100%)",
  glowGrad: "radial-gradient(ellipse at 50% 30%, rgba(128,152,224,0.25) 0%, transparent 70%)",
};

// ── Tiny SVG icon helpers ─────────────────────────────────────────────────────
function MicSVG() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>
    </svg>
  );
}
function ImgSVG() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  );
}
function TxtSVG() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ChromaGrid({
  items = [],
  onItemClick,
  className = "",
  radius = 300,
}) {
  const containerRef = useRef(null);

  // Re-run when item list changes (new dreams, filter change, etc.)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const cards = [...container.querySelectorAll(".cgrid-card")];
    if (cards.length === 0) return;

    // One proxy object per card; GSAP animates `.ci` and we write to CSS var
    const proxies = cards.map(() => ({ ci: 0 }));

    const onMove = (e) => {
      const mx = e.clientX;
      const my = e.clientY;

      cards.forEach((card, i) => {
        const rect = card.getBoundingClientRect();
        const cx   = rect.left + rect.width  / 2;
        const cy   = rect.top  + rect.height / 2;
        const dist = Math.hypot(mx - cx, my - cy);
        const tgt  = Math.max(0, 1 - dist / radius);

        gsap.to(proxies[i], {
          ci:        tgt,
          duration:  tgt > proxies[i].ci ? 0.18 : 0.50,
          ease:      "power2.out",
          overwrite: true,
          onUpdate() {
            card.style.setProperty("--ci", proxies[i].ci.toFixed(4));
          },
        });
      });
    };

    const onLeave = () => {
      cards.forEach((card, i) => {
        gsap.to(proxies[i], {
          ci:        0,
          duration:  0.80,
          ease:      "power2.out",
          overwrite: true,
          onUpdate() {
            card.style.setProperty("--ci", proxies[i].ci.toFixed(4));
          },
        });
      });
    };

    container.addEventListener("mousemove",  onMove);
    container.addEventListener("mouseleave", onLeave);

    return () => {
      container.removeEventListener("mousemove",  onMove);
      container.removeEventListener("mouseleave", onLeave);
      gsap.killTweensOf(proxies);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, radius]);

  if (items.length === 0) return null;

  return (
    <div ref={containerRef} className={`cgrid-root ${className}`}>
      <div className="cgrid-grid">
        {items.map((item, idx) => {
          const c = CHAR[item.charKey] ?? CHAR_DEFAULT;

          return (
            <div
              key={item.dreamId ?? idx}
              className="cgrid-card"
              style={{
                "--cr": c.r,
                "--cg": c.g,
                "--cb": c.b,
                "--ci": "0",
              }}
              onClick={() => onItemClick?.(item)}
            >
              {/* ── Cover ── */}
              <div
                className="cgrid-cover"
                style={
                  item.image
                    ? { backgroundImage: `url(${item.image})`, backgroundSize: "cover", backgroundPosition: "center" }
                    : { background: c.grad }
                }
              >
                {/* Fallback glow orb */}
                {!item.image && (
                  <div className="cgrid-fallback-glow" style={{ background: c.glowGrad }} />
                )}

                {/* Dark gradient overlay */}
                <div className="cgrid-cover-vignette" />

                {/* Character badge */}
                <div className="cgrid-cover-char">
                  <span className="cgrid-char-dot" style={{ backgroundColor: c.dot }} />
                  <span className="cgrid-char-name">{c.name}</span>
                </div>

                {/* Date + time */}
                <div className="cgrid-cover-date">
                  <span className="cgrid-date-main">{item.date}</span>
                  <span className="cgrid-date-time">{item.time}</span>
                </div>
              </div>

              {/* ── Content ── */}
              <div className="cgrid-content">
                {/* Left accent line */}
                <div
                  className="cgrid-accent-line"
                  style={{ background: `linear-gradient(to bottom, ${c.dot}66, transparent)` }}
                />

                <h3 className="cgrid-title">{item.title}</h3>

                {item.subtitle && (
                  <p className="cgrid-summary">{item.subtitle}</p>
                )}

                <div className="cgrid-types">
                  {item.hasAudio && (
                    <span className="cgrid-type-tag">
                      <MicSVG /><span>语音</span>
                    </span>
                  )}
                  {item.hasImage && (
                    <span className="cgrid-type-tag">
                      <ImgSVG /><span>图片</span>
                    </span>
                  )}
                  {!item.hasAudio && !item.hasImage && (
                    <span className="cgrid-type-tag">
                      <TxtSVG /><span>文字</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
