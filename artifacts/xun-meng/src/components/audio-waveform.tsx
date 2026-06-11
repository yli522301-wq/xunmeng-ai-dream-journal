import { motion } from "framer-motion";
import { CompanionColor } from "./companion-orb";

interface AudioWaveformProps {
  isActive: boolean;
  isListening: boolean;
  isThinking: boolean;
  color: CompanionColor;
}

const COLOR_HSL: Record<CompanionColor, string> = {
  amber:  "hsl(38 90% 60%)",
  indigo: "hsl(240 70% 65%)",
  teal:   "hsl(185 70% 55%)",
  purple: "hsl(255 90% 70%)",
};

// Stable height profiles per bar
const BAR_PROFILES = [
  [3, 6,  3],  [4, 10, 4], [3, 7,  3], [5, 14, 5],
  [3, 9,  3],  [4, 18, 4], [3, 8,  3], [5, 22, 5],
  [3, 16, 3],  [4, 11, 4], [3, 7,  3], [5, 13, 5],
  [3, 8,  3],  [4, 6,  4], [3, 5,  3], [4, 9,  4],
  [3, 12, 3],  [5, 20, 5], [3, 7,  3], [4, 14, 4],
];

export function AudioWaveform({ isActive, isListening, isThinking, color }: AudioWaveformProps) {
  const barColor = COLOR_HSL[color];
  const barCount = 20;

  return (
    <div className="flex items-end justify-center gap-[3px]" style={{ height: 28 }}>
      {Array.from({ length: barCount }).map((_, i) => {
        const profile = BAR_PROFILES[i % BAR_PROFILES.length];
        let heights: number[];
        let dur: number;
        let del: number;
        let opacity: number;

        if (isListening) {
          const amp = 4 + (i % 7) * 3;
          heights = [3, amp + 6, 3];
          dur = 0.3 + (i % 4) * 0.08;
          del = 0;
          opacity = 0.85;
        } else if (isThinking) {
          heights = [3, 5 + (i % 5) * 2, 3];
          dur = 1.2 + (i % 3) * 0.4;
          del = i * 0.06;
          opacity = 0.55;
        } else if (isActive) {
          const amp = profile[1] * 0.7;
          heights = [profile[0], amp, profile[0]];
          dur = 1.4 + (i % 5) * 0.3;
          del = i * 0.04;
          opacity = 0.70;
        } else {
          // Idle — very gentle, barely visible
          heights = [profile[0], profile[0] + 2, profile[0]];
          dur = 3.5 + (i % 4) * 0.8;
          del = i * 0.08;
          opacity = 0.22;
        }

        return (
          <motion.div
            key={i}
            className="rounded-full"
            style={{
              width: i === 7 || i === 12 ? 2 : 1.5,
              backgroundColor: barColor,
              opacity,
            }}
            animate={{ height: heights.map(h => `${h}px`) }}
            transition={{
              duration: dur,
              repeat: Infinity,
              ease: "easeInOut",
              delay: del,
            }}
          />
        );
      })}
    </div>
  );
}
