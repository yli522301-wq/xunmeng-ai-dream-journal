import { motion } from "framer-motion";
import { CompanionColor } from "./companion-orb";

interface AudioWaveformProps {
  isActive: boolean;
  isListening: boolean;
  isThinking: boolean;
  color: CompanionColor;
}

const COLOR_HSL: Record<CompanionColor, string> = {
  amber:  "38 90% 60%",
  indigo: "240 70% 65%",
  teal:   "185 70% 55%",
  purple: "255 90% 70%",
};

// Pre-baked speaking envelope: center bars tall, edges short (voice-like shape)
const SPEAK_HEIGHTS = [3, 5, 9, 13, 18, 24, 20, 28, 22, 28, 26, 28, 24, 20, 16, 12, 8, 5, 3, 2];
const SPEAK_DELAYS  = [0, 0.04, 0.07, 0.10, 0.12, 0.14, 0.11, 0.08, 0.05, 0, 0.03, 0.07, 0.10, 0.12, 0.09, 0.06, 0.04, 0.02, 0, 0];

const LISTEN_HEIGHTS = [2, 4, 7, 10, 14, 18, 16, 14, 10, 8, 8, 10, 14, 16, 18, 14, 10, 7, 4, 2];

export function AudioWaveform({ isActive, isListening, isThinking, color }: AudioWaveformProps) {
  const hsl   = COLOR_HSL[color];
  const bars  = 20;

  return (
    <div className="flex items-end justify-center" style={{ height: 32, gap: "3px" }}>
      {Array.from({ length: bars }).map((_, i) => {
        let h1: number, h2: number, h3: number;
        let duration: number;
        let delay: number;
        let opacity: number;

        if (isListening) {
          // Input mode: medium bars, fast pulse, colour slightly different (use full brightness)
          const amp = LISTEN_HEIGHTS[i];
          h1 = 2;
          h2 = amp;
          h3 = 2;
          duration = 0.35 + (i % 5) * 0.06;
          delay    = 0;
          opacity  = 0.75;
        } else if (isActive) {
          // Speaking: tall, rhythmic, obviously alive
          const peak = SPEAK_HEIGHTS[i];
          h1 = 2;
          h2 = peak;
          h3 = 2;
          duration = 0.7 + (i % 4) * 0.15;
          delay    = SPEAK_DELAYS[i];
          opacity  = 0.90;
        } else if (isThinking) {
          // Thinking: gentle side-to-side ripple, low amplitude
          h1 = 2;
          h2 = 6 + (i % 4) * 2;
          h3 = 2;
          duration = 1.4 + (i % 3) * 0.5;
          delay    = i * 0.07;
          opacity  = 0.35;
        } else {
          // IDLE: completely flat — 2px tall, barely noticeable
          h1 = 2;
          h2 = 2;
          h3 = 2;
          duration = 6;
          delay    = 0;
          opacity  = 0.10;
        }

        return (
          <motion.div
            key={i}
            className="rounded-full flex-shrink-0"
            style={{
              width: 2,
              backgroundColor: `hsl(${hsl})`,
              opacity,
              originY: 1,
            }}
            animate={{ height: [`${h1}px`, `${h2}px`, `${h1}px`] }}
            transition={{
              duration,
              repeat: Infinity,
              ease: "easeInOut",
              delay,
            }}
          />
        );
      })}
    </div>
  );
}
