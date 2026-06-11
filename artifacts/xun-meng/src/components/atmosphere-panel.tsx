import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { BgTheme } from "./ambient-bg";
import type { AmbientSoundType } from "../hooks/use-ambient-sound";

interface AtmospherePanelProps {
  open: boolean;
  theme: BgTheme;
  sound: AmbientSoundType;
  onTheme: (t: BgTheme) => void;
  onSound: (s: AmbientSoundType) => void;
  onClose: () => void;
}

const THEMES: { id: BgTheme; label: string; icon: string; desc: string }[] = [
  { id: "void",  icon: "◯", label: "纯净",    desc: "无背景" },
  { id: "rain",  icon: "⛆", label: "雨夜窗边", desc: "轻雨声" },
  { id: "night", icon: "☾", label: "深夜房间", desc: "月光柔和" },
  { id: "fog",   icon: "◌", label: "雾蓝梦境", desc: "飘浮粒子" },
  { id: "stars", icon: "✦", label: "安静星夜", desc: "极少星点" },
];

const SOUNDS: { id: AmbientSoundType; label: string; icon: string }[] = [
  { id: "none",  icon: "—",  label: "安静" },
  { id: "rain",  icon: "⛆", label: "雨声" },
  { id: "night", icon: "♩",  label: "夜色" },
  { id: "fire",  icon: "⬡",  label: "壁炉" },
];

export function AtmospherePanel({ open, theme, sound, onTheme, onSound, onClose }: AtmospherePanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Bottom sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-3xl"
            style={{
              background: "rgba(8, 8, 18, 0.97)",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              backdropFilter: "blur(28px)",
              paddingBottom: "env(safe-area-inset-bottom, 16px)",
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 220 }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/10" />
            </div>

            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-5">
                <p className="text-[11px] tracking-[0.2em] text-white/30 uppercase">氛围空间</p>
                <button onClick={onClose} className="text-white/20 hover:text-white/50 transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* Background themes */}
              <p className="text-[10px] text-white/20 tracking-widest mb-3 uppercase">背景</p>
              <div className="flex gap-2 mb-6 flex-wrap">
                {THEMES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => onTheme(t.id)}
                    className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl transition-all"
                    style={{
                      background: theme === t.id ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                      border: theme === t.id ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(255,255,255,0.04)",
                      minWidth: 64,
                    }}
                  >
                    <span className="text-lg text-white/70">{t.icon}</span>
                    <span className="text-[10px] text-white/50 whitespace-nowrap">{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Ambient sounds */}
              <p className="text-[10px] text-white/20 tracking-widest mb-3 uppercase">环境音</p>
              <div className="flex gap-2 mb-2">
                {SOUNDS.map(s => (
                  <button
                    key={s.id}
                    onClick={() => onSound(s.id)}
                    className="flex flex-col items-center gap-1.5 px-5 py-3 rounded-2xl transition-all flex-1"
                    style={{
                      background: sound === s.id ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                      border: sound === s.id ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <span className="text-base text-white/70">{s.icon}</span>
                    <span className="text-[10px] text-white/50">{s.label}</span>
                  </button>
                ))}
              </div>

              <p className="text-[9px] text-white/15 text-center mt-3 tracking-wider">
                声音由浏览器合成 · 仅作氛围演示
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
