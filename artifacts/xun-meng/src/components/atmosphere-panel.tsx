import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, SlidersHorizontal, X } from "lucide-react";
import type { AmbientVisualSettings, BgTheme } from "./ambient-bg";
import type { AmbientSoundType } from "../hooks/use-ambient-sound";
import type { MusicType } from "../hooks/use-ambient-music";
import { useState } from "react";

interface AtmospherePanelProps {
  open: boolean;
  theme: BgTheme;
  sound: AmbientSoundType;
  music: MusicType;
  onTheme: (t: BgTheme) => void;
  onSound: (s: AmbientSoundType) => void;
  onMusic: (m: MusicType) => void;
  visualSettings: AmbientVisualSettings;
  onVisualSettingsChange: (settings: AmbientVisualSettings) => void;
  onVisualSettingsReset: (theme: BgTheme) => void;
  onClose: () => void;
}

const SCENES: { id: BgTheme; icon: string; label: string }[] = [
  { id: "void",  icon: "◯", label: "纯净" },
  { id: "rain",  icon: "⛆", label: "雨夜窗边" },
  { id: "night", icon: "☾", label: "深夜房间" },
  { id: "fog",   icon: "◌", label: "雾蓝梦境" },
  { id: "stars", icon: "✦", label: "安静星夜" },
];

const SOUNDS: { id: AmbientSoundType; icon: string; label: string }[] = [
  { id: "none",  icon: "—", label: "无" },
  { id: "rain",  icon: "⛆", label: "雨声" },
  { id: "night", icon: "♩", label: "夜色" },
  { id: "ocean",  icon: "~", label: "深海" },
];

const MUSIC: { id: MusicType; icon: string; label: string }[] = [
  { id: "none",       icon: "—", label: "无音乐" },
  { id: "piano",      icon: "♪", label: "钢琴微光" },
  { id: "fog",        icon: "◌", label: "雾蓝氛围" },
  { id: "strings",    icon: "∿", label: "夜色弦音" },
  { id: "piano-rain", icon: "⛆", label: "雨夜钢琴" },
];

function OptionBtn({
  active, icon, label, onClick,
}: {
  active: boolean; icon: string; label: string; onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl transition-all flex-1 min-w-[52px]"
      style={{
        background: active ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.025)",
        border: active ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(255,255,255,0.04)",
      }}
      whileTap={{ scale: 0.95 }}
    >
      <span className="text-base leading-none" style={{ color: active ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.4)" }}>
        {icon}
      </span>
      <span className="text-[9px] tracking-wider whitespace-nowrap"
        style={{ color: active ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.25)" }}>
        {label}
      </span>
    </motion.button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] tracking-[0.22em] uppercase mb-2" style={{ color: "rgba(255,255,255,0.18)" }}>
      {children}
    </p>
  );
}

function SettingSlider({
  label,
  value,
  min = 0.35,
  max = 1.8,
  step = 0.05,
  leftLabel,
  rightLabel,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  leftLabel: string;
  rightLabel: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-wide" style={{ color: "rgba(255,255,255,0.42)" }}>{label}</span>
        <span className="text-[9px] tabular-nums" style={{ color: "rgba(255,255,255,0.22)" }}>
          {Math.round(value * 100)}%
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.currentTarget.value))}
        className="w-full accent-white/70"
      />
      <div className="flex justify-between text-[8px] tracking-wide" style={{ color: "rgba(255,255,255,0.16)" }}>
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

export function AtmospherePanel({
  open,
  theme,
  sound,
  music,
  visualSettings,
  onTheme,
  onSound,
  onMusic,
  onVisualSettingsChange,
  onVisualSettingsReset,
  onClose,
}: AtmospherePanelProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const updateStars = (key: keyof AmbientVisualSettings["stars"], value: number) => {
    onVisualSettingsChange({
      ...visualSettings,
      stars: { ...visualSettings.stars, [key]: value },
    });
  };

  const updateRain = (key: keyof AmbientVisualSettings["rain"], value: number) => {
    onVisualSettingsChange({
      ...visualSettings,
      rain: { ...visualSettings.rain, [key]: value },
    });
  };

  const canTune = theme === "stars" || theme === "rain";

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Tap-outside dismiss */}
          <motion.div
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Bottom sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl"
            style={{
              background: "rgba(6,6,18,0.97)",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              backdropFilter: "blur(30px)",
              paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 220 }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-0.5">
              <div className="w-9 h-[3px] rounded-full" style={{ background: "rgba(255,255,255,0.10)" }} />
            </div>

            <div className="px-5 pt-3 pb-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] tracking-[0.22em] uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>
                  氛围空间
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSettingsOpen(v => !v)}
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-all"
                    style={{
                      color: settingsOpen ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.24)",
                      background: settingsOpen ? "rgba(255,255,255,0.075)" : "rgba(255,255,255,0.025)",
                      border: "1px solid rgba(255,255,255,0.055)",
                    }}
                    title="调节当前场景"
                  >
                    <SlidersHorizontal size={12} />
                    <span className="text-[9px] tracking-wider">调节</span>
                  </button>
                  <button onClick={onClose} className="transition-colors"
                    style={{ color: "rgba(255,255,255,0.20)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.20)")}>
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* ① Scene */}
              <div className="mb-4">
                <SectionLabel>场景</SectionLabel>
                <div className="flex gap-1.5 flex-wrap">
                  {SCENES.map(s => (
                    <OptionBtn key={s.id} active={theme === s.id} icon={s.icon} label={s.label}
                      onClick={() => onTheme(s.id)} />
                  ))}
                </div>
              </div>

              <AnimatePresence>
                {settingsOpen && (
                  <motion.div
                    className="mb-4 rounded-2xl px-3.5 py-3"
                    style={{
                      background: "rgba(255,255,255,0.035)",
                      border: "1px solid rgba(255,255,255,0.055)",
                    }}
                    initial={{ opacity: 0, y: -6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -6, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-[10px] tracking-[0.18em] uppercase" style={{ color: "rgba(255,255,255,0.36)" }}>
                          场景参数
                        </p>
                        <p className="text-[9px] mt-1" style={{ color: "rgba(255,255,255,0.18)" }}>
                          {canTune ? "滑动后立即生效" : "这个场景暂时没有可调参数"}
                        </p>
                      </div>
                      <button
                        onClick={() => onVisualSettingsReset(theme)}
                        disabled={!canTune}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-all disabled:opacity-30"
                        style={{
                          color: "rgba(255,255,255,0.36)",
                          background: "rgba(255,255,255,0.035)",
                          border: "1px solid rgba(255,255,255,0.055)",
                        }}
                      >
                        <RotateCcw size={11} />
                        <span className="text-[9px] tracking-wide">默认</span>
                      </button>
                    </div>

                    {theme === "stars" && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <SettingSlider
                          label="星空密度"
                          value={visualSettings.stars.density}
                          leftLabel="稀疏"
                          rightLabel="星河"
                          onChange={v => updateStars("density", v)}
                        />
                        <SettingSlider
                          label="星星亮度"
                          value={visualSettings.stars.brightness}
                          leftLabel="暗"
                          rightLabel="亮"
                          onChange={v => updateStars("brightness", v)}
                        />
                        <SettingSlider
                          label="运动速度"
                          value={visualSettings.stars.speed}
                          max={2.2}
                          leftLabel="慢"
                          rightLabel="快"
                          onChange={v => updateStars("speed", v)}
                        />
                      </div>
                    )}

                    {theme === "rain" && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <SettingSlider
                          label="雨滴强度"
                          value={visualSettings.rain.intensity}
                          leftLabel="少雨"
                          rightLabel="大雨"
                          onChange={v => updateRain("intensity", v)}
                        />
                        <SettingSlider
                          label="雨滴亮度"
                          value={visualSettings.rain.brightness}
                          leftLabel="暗"
                          rightLabel="亮"
                          onChange={v => updateRain("brightness", v)}
                        />
                        <SettingSlider
                          label="下落速度"
                          value={visualSettings.rain.speed}
                          max={2.2}
                          leftLabel="慢"
                          rightLabel="快"
                          onChange={v => updateRain("speed", v)}
                        />
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Divider */}
              <div className="w-full h-px mb-4" style={{ background: "rgba(255,255,255,0.04)" }} />

              {/* ② Ambient sound */}
              <div className="mb-4">
                <SectionLabel>环境音</SectionLabel>
                <div className="flex gap-1.5">
                  {SOUNDS.map(s => (
                    <OptionBtn key={s.id} active={sound === s.id} icon={s.icon} label={s.label}
                      onClick={() => onSound(s.id)} />
                  ))}
                </div>
              </div>

              {/* ③ Music */}
              <div>
                <SectionLabel>纯音乐</SectionLabel>
                <div className="flex gap-1.5 flex-wrap">
                  {MUSIC.map(m => (
                    <OptionBtn key={m.id} active={music === m.id} icon={m.icon} label={m.label}
                      onClick={() => onMusic(m.id)} />
                  ))}
                </div>
              </div>

              {/* Hint */}
              <p className="text-center mt-4 text-[9px] tracking-widest" style={{ color: "rgba(255,255,255,0.12)" }}>
                声音由浏览器合成 · 选择场景自动联动
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
