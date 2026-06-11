import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface HistoryPanelProps {
  history: Message[];
  charName: string;
}

type SheetState = "closed" | "open";

// The handle height is always visible; the content area expands below it
const CONTENT_H = 320; // px when open

export function HistoryBottomSheet({ history, charName }: HistoryPanelProps) {
  const [state, setState] = useState<SheetState>("closed");
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  const isOpen = state === "open";

  // Auto-scroll to bottom when new message arrives while open
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history.length, isOpen]);

  const toggle = () => setState(s => s === "closed" ? "open" : "closed");

  const handleDragEnd = (_: unknown, info: { offset: { y: number } }) => {
    if (info.offset.y < -40) setState("open");
    if (info.offset.y >  40) setState("closed");
  };

  const hasNew = history.length > 0;

  return (
    <div className="w-full max-w-md mx-auto px-5 flex-shrink-0 relative z-25" style={{ zIndex: 25 }}>
      {/* Handle bar — always visible, drag target */}
      <motion.div
        className="flex flex-col items-center cursor-pointer select-none"
        drag="y"
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        onClick={toggle}
      >
        {/* Drag pill */}
        <div className="w-10 h-1 rounded-full mb-2" style={{ background: "rgba(255,255,255,0.10)" }} />

        {/* Handle content */}
        <div className="w-full flex items-center justify-between px-3 py-2 rounded-xl"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="flex items-center gap-2">
            <span className="text-[10px] tracking-[0.2em] text-white/20 uppercase">对话</span>
            {hasNew && (
              <span className="text-[10px] text-white/30 tabular-nums">{history.length}</span>
            )}
          </div>
          <motion.div
            animate={{ rotate: isOpen ? 0 : 180 }}
            transition={{ duration: 0.25 }}
          >
            <ChevronDown size={14} className="text-white/18" />
          </motion.div>
        </div>
      </motion.div>

      {/* Expandable content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: CONTENT_H, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 200 }}
            style={{ overflow: "hidden" }}
          >
            <div
              ref={scrollRef}
              className="flex flex-col gap-3 py-3 overflow-y-auto"
              style={{
                height: CONTENT_H,
                scrollbarWidth: "none",
                WebkitOverflowScrolling: "touch",
              } as React.CSSProperties}
            >
              {history.length === 0 ? (
                <div className="flex-1 flex items-center justify-center h-full">
                  <p className="text-[11px] text-white/15 tracking-widest">还没有对话</p>
                </div>
              ) : (
                history.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.15) }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className="max-w-[82%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed"
                      style={
                        msg.role === "user"
                          ? { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)" }
                          : {
                              background: "rgba(255,255,255,0.03)",
                              color: "rgba(255,255,255,0.5)",
                              border: "1px solid rgba(255,255,255,0.05)",
                            }
                      }
                    >
                      {msg.role === "assistant" && (
                        <p className="text-[9px] text-white/22 mb-1.5 tracking-wider">{charName}</p>
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
