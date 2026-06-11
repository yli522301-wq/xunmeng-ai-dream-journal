import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface HistoryPanelProps {
  open: boolean;
  history: Message[];
  onClose: () => void;
  charName: string;
}

export function HistoryPanel({ open, history, onClose, charName }: HistoryPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, history.length]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel — slides from right */}
          <motion.div
            className="fixed top-0 right-0 h-full z-50 flex flex-col"
            style={{
              width: "min(380px, 90vw)",
              background: "rgba(8, 8, 18, 0.95)",
              borderLeft: "1px solid rgba(255,255,255,0.05)",
              backdropFilter: "blur(24px)",
            }}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 200 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 flex-shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div>
                <p className="text-[11px] tracking-[0.2em] text-white/25 uppercase">对话记录</p>
                <p className="text-xs text-white/40 mt-0.5">{charName}</p>
              </div>
              <button
                onClick={onClose}
                className="text-white/25 hover:text-white/60 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
              style={{ scrollbarWidth: "none" }}>
              {history.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-xs text-white/20 tracking-widest">还没有对话</p>
                </div>
              ) : (
                history.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
                      style={
                        msg.role === "user"
                          ? {
                              background: "rgba(255,255,255,0.06)",
                              color: "rgba(255,255,255,0.75)",
                            }
                          : {
                              background: "rgba(255,255,255,0.03)",
                              color: "rgba(255,255,255,0.55)",
                              border: "1px solid rgba(255,255,255,0.05)",
                            }
                      }
                    >
                      {msg.role === "assistant" && (
                        <p className="text-[10px] text-white/25 mb-1.5 tracking-wider">
                          {charName}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
