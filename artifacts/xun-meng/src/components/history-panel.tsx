import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { ChatMessage, CharKey } from "@/pages/dream-space";

// ── Types ──────────────────────────────────────────────────────────────────
interface CharInfo {
  name: string;
  enName: string;
  particleColor: string;
}

interface HistoryPanelProps {
  messages: ChatMessage[];
  charMap: Record<string, CharInfo>;
  avatars: Record<string, string | null>;
  onAvatarChange: (key: CharKey, dataUrl: string) => void;
  typingMsgId?: string | null;
  typingContent?: string;
}

const CONTENT_H = 340;

// ── Dream-sphere avatar ─────────────────────────────────────────────────────
function DreamSphereAvatar({
  charKey, info, avatar, size = 28, onClick,
}: {
  charKey: string;
  info: CharInfo;
  avatar: string | null;
  size?: number;
  onClick?: () => void;
}) {
  const color = info.particleColor;
  return (
    <div
      onClick={onClick}
      title={onClick ? `点击更换${info.name}头像` : undefined}
      style={{
        width: size, height: size, borderRadius: "50%",
        overflow: "hidden", flexShrink: 0, position: "relative",
        cursor: onClick ? "pointer" : "default",
        boxShadow: `0 0 ${Math.round(size * 0.45)}px ${color}55, 0 0 ${Math.round(size * 0.18)}px ${color}33 inset`,
        border: `1px solid ${color}44`,
      }}
    >
      {avatar ? (
        <>
          <img
            src={avatar}
            alt={info.name}
            style={{
              width: "108%", height: "108%",
              objectFit: "cover",
              filter: "blur(0.6px) saturate(1.25)",
              transform: "translate(-4%, -4%) scale(1.08)",
            }}
          />
          {/* radial highlight */}
          <div style={{
            position: "absolute", inset: 0,
            background: `radial-gradient(circle at 32% 28%, ${color}55 0%, transparent 55%)`,
            mixBlendMode: "screen",
          }} />
          {/* edge vignette */}
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(circle at 50% 50%, transparent 38%, rgba(0,0,0,0.55) 100%)",
          }} />
        </>
      ) : (
        // Default dream-orb (gradient sphere, no image)
        <div style={{
          width: "100%", height: "100%",
          background: `radial-gradient(circle at 34% 30%, ${color}cc 0%, ${color}55 40%, rgba(5,5,15,0.9) 100%)`,
        }}>
          {/* specular highlight */}
          <div style={{
            position: "absolute",
            top: "14%", left: "22%",
            width: "32%", height: "22%",
            background: "radial-gradient(ellipse, rgba(255,255,255,0.32) 0%, transparent 100%)",
            borderRadius: "50%",
          }} />
        </div>
      )}
    </div>
  );
}

// ── Single message bubble ──────────────────────────────────────────────────
function MessageBubble({
  msg, charMap, avatars, onAvatarChange, fileInputRef, avatarUploadTarget, setAvatarUploadTarget,
  typingMsgId, typingContent,
}: {
  msg: ChatMessage;
  charMap: Record<string, CharInfo>;
  avatars: Record<string, string | null>;
  onAvatarChange: (key: CharKey, dataUrl: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  avatarUploadTarget: string | null;
  setAvatarUploadTarget: (k: string | null) => void;
  typingMsgId?: string | null;
  typingContent?: string;
}) {
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.28 }}
        className="flex justify-end"
      >
        <div
          className="max-w-[78%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-[13px] leading-relaxed"
          style={{
            background: "rgba(255,255,255,0.07)",
            color: "rgba(255,255,255,0.68)",
          }}
        >
          {msg.imageUrl && (
            <img
              src={msg.imageUrl}
              alt="图片"
              className="rounded-xl max-w-full mb-2"
              style={{ maxHeight: "160px", objectFit: "cover", display: "block" }}
            />
          )}
          {msg.content !== "[图片]" && (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          )}
          <p className="mt-1 text-[9px] tracking-wider text-right" style={{ color: "rgba(255,255,255,0.18)" }}>
            {msg.timestamp}
          </p>
        </div>
      </motion.div>
    );
  }

  // AI character bubble
  const key  = msg.role as CharKey;
  const info = charMap[key];
  if (!info) return null;
  const color = info.particleColor;

  const triggerUpload = () => {
    setAvatarUploadTarget(key);
    fileInputRef.current?.click();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28 }}
      className="flex justify-start gap-2.5 items-start"
    >
      <DreamSphereAvatar
        charKey={key}
        info={info}
        avatar={avatars[key] ?? null}
        size={26}
        onClick={triggerUpload}
      />

      <div className="max-w-[78%] flex flex-col gap-1">
        {/* Character name header */}
        <div className="flex items-center gap-1.5 px-0.5">
          <span className="text-[10px] font-medium" style={{ color }}>
            {info.name}
          </span>
          <span className="text-[9px] tracking-wider" style={{ color: "rgba(255,255,255,0.20)" }}>
            {info.enName}
          </span>
        </div>

        <div
          className="rounded-2xl rounded-tl-sm px-4 py-2.5 text-[13px] leading-relaxed"
          style={{
            background: `linear-gradient(135deg, ${color}0a 0%, rgba(255,255,255,0.018) 100%)`,
            border: `1px solid ${color}22`,
            color: "rgba(255,255,255,0.60)",
          }}
        >
          {(() => {
            const isTyping = typingMsgId === msg.id;
            const shown = isTyping ? (typingContent ?? "") : msg.content;
            return (
              <p className="whitespace-pre-wrap">
                {shown}
                {isTyping && (
                  <motion.span
                    className="inline-block w-[1px] h-[1em] ml-[1px] align-middle rounded-full"
                    style={{ backgroundColor: color, opacity: 0.7 }}
                    animate={{ opacity: [0.7, 0, 0.7] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                )}
              </p>
            );
          })()}
          <p className="mt-1 text-[9px] tracking-wider" style={{ color: "rgba(255,255,255,0.18)" }}>
            {msg.timestamp}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function HistoryBottomSheet({ messages, charMap, avatars, onAvatarChange, typingMsgId, typingContent }: HistoryPanelProps) {
  const [isOpen,            setIsOpen]            = useState(false);
  const [avatarUploadTarget, setAvatarUploadTarget] = useState<string | null>(null);
  const scrollRef   = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragControls = useDragControls();

  // Auto-scroll to bottom on new messages while open
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isOpen]);

  const toggle = () => setIsOpen(s => !s);

  const handleDragEnd = (_: unknown, info: { offset: { y: number } }) => {
    if (info.offset.y < -40) setIsOpen(true);
    if (info.offset.y >  40) setIsOpen(false);
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !avatarUploadTarget) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      onAvatarChange(avatarUploadTarget as CharKey, dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
    setAvatarUploadTarget(null);
  };

  // Count turns (user messages)
  const turnCount = messages.filter(m => m.role === "user").length;

  return (
    <div className="w-full max-w-md mx-auto px-5 flex-shrink-0 relative" style={{ zIndex: 25 }}>

      {/* Hidden file input for avatar upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarFileChange}
      />

      {/* ── Handle bar ── */}
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
        <div className="w-10 h-1 rounded-full mb-2" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Handle row */}
        <div className="w-full flex items-center justify-between px-3 py-2 rounded-xl"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.22)" }}>
              对话
            </span>
            {turnCount > 0 && (
              <span className="text-[10px] tabular-nums" style={{ color: "rgba(255,255,255,0.22)" }}>
                {turnCount} 轮
              </span>
            )}
          </div>
          <motion.div animate={{ rotate: isOpen ? 0 : 180 }} transition={{ duration: 0.25 }}>
            <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.18)" }} />
          </motion.div>
        </div>
      </motion.div>

      {/* ── Expandable content ── */}
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
              {messages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center h-full">
                  <p className="text-[11px] tracking-widest" style={{ color: "rgba(255,255,255,0.13)" }}>
                    还没有对话
                  </p>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <MessageBubble
                    key={msg.id ?? i}
                    msg={msg}
                    charMap={charMap}
                    avatars={avatars}
                    onAvatarChange={onAvatarChange}
                    fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
                    avatarUploadTarget={avatarUploadTarget}
                    setAvatarUploadTarget={setAvatarUploadTarget}
                    typingMsgId={typingMsgId}
                    typingContent={typingContent}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
