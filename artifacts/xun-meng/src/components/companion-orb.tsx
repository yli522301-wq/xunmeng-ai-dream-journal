import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type CompanionColor = 'amber' | 'indigo' | 'teal' | 'purple';

interface CompanionOrbProps {
  size?: "lg" | "sm" | "xs";
  isSpeaking?: boolean;
  isThinking?: boolean;
  color?: CompanionColor;
  className?: string;
}

export function CompanionOrb({ 
  size = "lg", 
  isSpeaking = false, 
  isThinking = false,
  color = 'purple', 
  className 
}: CompanionOrbProps) {
  const sizeMap = {
    lg: "w-[180px] h-[180px] sm:w-[200px] sm:h-[200px]",
    sm: "w-[48px] h-[48px]",
    xs: "w-[20px] h-[20px]",
  };

  const orbSize = sizeMap[size];

  // Color values
  const colorMap: Record<CompanionColor, { hsl: string, hex: string }> = {
    amber: { hsl: "38 90% 60%", hex: "#F5A623" },
    indigo: { hsl: "240 70% 65%", hex: "#5C6BC0" },
    teal: { hsl: "185 70% 55%", hex: "#4DD0E1" },
    purple: { hsl: "var(--primary)", hex: "hsl(var(--primary))" }
  };

  const currentColor = colorMap[color];

  return (
    <div className={cn("relative flex items-center justify-center", orbSize, className)}>
      {/* Outer pulsing rings */}
      <motion.div
        className="absolute inset-[-10%] rounded-full opacity-0"
        style={{ border: `1px solid hsl(${currentColor.hsl} / 0.3)` }}
        animate={{
          scale: isSpeaking ? [1.1, 1.3, 1.1] : [1.05, 1.2, 1.05],
          opacity: isSpeaking ? [0.2, 0.4, 0.2] : [0, 0.25, 0],
          rotate: isThinking ? 180 : 0
        }}
        transition={{
          duration: isSpeaking ? 2 : 5,
          ease: "easeInOut",
          repeat: Infinity,
        }}
      />
      <motion.div
        className="absolute inset-[-5%] rounded-full opacity-0"
        style={{ border: `1px solid hsl(${currentColor.hsl} / 0.4)` }}
        animate={{
          scale: isSpeaking ? [1.05, 1.2, 1.05] : [1, 1.1, 1],
          opacity: isSpeaking ? [0.3, 0.5, 0.3] : [0.1, 0.3, 0.1],
        }}
        transition={{
          duration: isSpeaking ? 1.5 : 7,
          ease: "easeInOut",
          repeat: Infinity,
          delay: 0.5
        }}
      />

      {/* Main orb */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle at center, hsl(${currentColor.hsl} / 0.8) 0%, hsl(${currentColor.hsl} / 0.4) 40%, transparent 80%)`,
          boxShadow: `0 0 40px hsl(${currentColor.hsl} / 0.3)`
        }}
        animate={{
          scale: isSpeaking ? [0.94, 1.08, 0.94] : [0.96, 1.04, 0.96],
          opacity: isSpeaking ? [0.8, 1, 0.8] : [0.85, 1, 0.85],
          rotate: isThinking ? 360 : 0
        }}
        transition={{
          scale: { duration: isSpeaking ? 1.5 : 4, ease: "easeInOut", repeat: Infinity },
          opacity: { duration: isSpeaking ? 1.5 : 4, ease: "easeInOut", repeat: Infinity },
          rotate: { duration: 10, ease: "linear", repeat: Infinity }
        }}
      />

      {/* Inner sparkle */}
      <motion.div
        className="absolute inset-[30%] rounded-full flex items-center justify-center text-white mix-blend-overlay"
        animate={{
          scale: isSpeaking ? [0.9, 1.2, 0.9] : [0.95, 1.05, 0.95],
          opacity: isThinking ? [0.5, 1, 0.5] : 1
        }}
        transition={{
          duration: isSpeaking ? 1 : 3,
          ease: "easeInOut",
          repeat: Infinity,
        }}
      >
        {size === 'lg' && <span className="text-2xl leading-none">✦</span>}
      </motion.div>
    </div>
  );
}
