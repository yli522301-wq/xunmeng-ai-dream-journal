import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CompanionOrbProps {
  size?: "lg" | "sm" | "xs";
  isSpeaking?: boolean;
  className?: string;
}

export function CompanionOrb({ size = "lg", isSpeaking = false, className }: CompanionOrbProps) {
  const sizeMap = {
    lg: "w-[200px] h-[200px]",
    sm: "w-[48px] h-[48px]",
    xs: "w-[20px] h-[20px]",
  };

  const orbSize = sizeMap[size];

  return (
    <div className={cn("relative flex items-center justify-center", orbSize, className)}>
      {/* Outer pulsing ring */}
      <motion.div
        className="absolute inset-0 rounded-full border border-primary/30"
        animate={{
          scale: isSpeaking ? [1, 1.25, 1] : [1.05, 1.15, 1.05],
          opacity: isSpeaking ? [0.2, 0.6, 0.2] : [0, 0.3, 0],
        }}
        transition={{
          duration: isSpeaking ? 2 : 6,
          ease: "easeInOut",
          repeat: Infinity,
        }}
      />

      {/* Main orb */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(circle at center, hsl(var(--primary) / 0.8), transparent 70%)",
        }}
        animate={{
          scale: isSpeaking ? [0.95, 1.1, 0.95] : [0.97, 1.03, 0.97],
          opacity: isSpeaking ? [0.7, 1, 0.7] : [0.8, 1, 0.8],
        }}
        transition={{
          duration: isSpeaking ? 1.5 : 4,
          ease: "easeInOut",
          repeat: Infinity,
        }}
      />

      {/* Inner shimmer */}
      <motion.div
        className="absolute inset-[20%] rounded-full bg-white/20 blur-md"
        animate={{
          scale: isSpeaking ? [0.9, 1.2, 0.9] : [1, 1.05, 1],
        }}
        transition={{
          duration: isSpeaking ? 1 : 3,
          ease: "easeInOut",
          repeat: Infinity,
        }}
      />

      {/* Particles (only for lg) */}
      {size === "lg" && (
        <div className="absolute inset-[-50%] pointer-events-none">
          {[...Array(10)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full bg-primary/40 blur-[1px]"
              initial={{
                x: "50%",
                y: "50%",
                opacity: 0,
              }}
              animate={{
                x: ["50%", `${50 + (Math.random() - 0.5) * 100}%`],
                y: ["50%", `${50 + (Math.random() - 0.5) * 100}%`],
                opacity: [0, 0.8, 0],
                scale: [0.5, 1.5, 0.5],
              }}
              transition={{
                duration: 3 + Math.random() * 4,
                ease: "easeInOut",
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
