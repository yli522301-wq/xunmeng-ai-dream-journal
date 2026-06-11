import { motion } from "framer-motion";
import { CompanionColor } from "./companion-orb";

interface AudioWaveformProps {
  isActive: boolean;
  isListening: boolean;
  isThinking: boolean;
  color: CompanionColor;
}

export function AudioWaveform({ isActive, isListening, isThinking, color }: AudioWaveformProps) {
  const bars = 16;
  
  const colorMap: Record<CompanionColor, string> = {
    amber: "hsl(38 90% 60%)",
    indigo: "hsl(240 70% 65%)",
    teal: "hsl(185 70% 55%)",
    purple: "hsl(var(--primary))"
  };

  const currentColor = colorMap[color];

  return (
    <div className="flex items-end justify-center h-[24px] gap-1">
      {Array.from({ length: bars }).map((_, i) => {
        const defaultHeight = 4 + Math.sin(i) * 2;
        
        let heights = [defaultHeight, defaultHeight, defaultHeight];
        let duration = 2;
        
        if (isListening) {
          heights = [
            4 + Math.random() * 8, 
            10 + Math.random() * 14, 
            4 + Math.random() * 8
          ];
          duration = 0.4 + Math.random() * 0.2;
        } else if (isThinking) {
          heights = [4, 12, 4];
          duration = 1.5;
        } else if (isActive) {
          heights = [
            4 + Math.random() * 4,
            8 + Math.random() * 6,
            4 + Math.random() * 4
          ];
          duration = 1 + Math.random() * 1;
        }

        return (
          <motion.div
            key={i}
            className="w-1 rounded-full opacity-80"
            style={{ backgroundColor: currentColor }}
            animate={{ height: heights.map(h => `${h}px`) }}
            transition={{
              duration,
              repeat: Infinity,
              ease: "easeInOut",
              delay: isThinking ? i * 0.1 : (isListening ? 0 : i * 0.05),
            }}
          />
        );
      })}
    </div>
  );
}
