import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Trash2, Play, Pause, Mic, X, PenLine, Music2, FolderOpen } from "lucide-react";
import type { ChatMessage, MusicSnapshot } from "@/pages/dream-space";
import { DREAMS_STORAGE_KEY, type SavedDream } from "@/pages/dream-archive";
import { useAmbientMusic, type MusicType } from "@/hooks/use-ambient-music";
import { useAmbientSound, type AmbientSoundType } from "@/hooks/use-ambient-sound";

const RESUME_STORAGE_KEY = "xm_resume_dream";

const CHAR_STYLES: Record<string, { name: string; enName: string; hsl: string; dot: string }> = {
  daoshen: { name: "岛深", enName: "Daoshan", hsl: "185 70% 55%", dot: "#6B8CFF" },
  muge:    { name: "暮歌", enName: "Muge",    hsl: "240 70% 65%", dot: "#9B7CFF" },
  anuan:   { name: "阿暖", enName: "Anuan",   hsl: "38 90% 60%",  dot: "#F2A84B" },
};

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 · ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  } catch { return ""; }
}

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

// ── Animated waveform bars ──────────────────────────────────────────────────
function WaveformBars({ isPlaying, hsl }: { isPlaying: boolean; hsl: string }) {
  const heights = [3, 8, 5, 11, 7, 14, 5, 9, 4, 12, 6, 10, 4, 8, 5, 11, 3];
  return (
    <div className="flex items-center gap-[2.5px]" style={{ height: 18 }}>
      {heights.map((h, i) => (
        <motion.div
          key={i}
          className="w-[2px] rounded-full"
          style={{ background: `hsl(${hsl})`, opacity: 0.55 }}
          animate={isPlaying ? { height: [h, h * 0.35, h * 1.4, h * 0.5, h] } : { height: h }}
          transition={isPlaying ? {
            duration: 0.7 + i * 0.055,
            repeat: Infinity,
            ease: "easeInOut",
          } : { duration: 0.3 }}
        />
      ))}
    </div>
  );
}

// ── Voice card ──────────────────────────────────────────────────────────────
function VoiceCard({
  msg,
  cs,
}: {
  msg: ChatMessage;
  cs: { hsl: string; dot: string };
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const duration = msg.audioDuration ?? 0;

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnded = () => setIsPlaying(false);
    el.addEventListener("ended", onEnded);
    return () => el.removeEventListener("ended", onEnded);
  }, []);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const hasAudio = !!msg.audioUrl;

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex items-center gap-3 px-4 py-2.5 rounded-2xl rounded-tr-sm"
        style={{
          background: "rgba(255,255,255,0.06)",
          border: `1px solid hsl(${cs.hsl} / 0.15)`,
          minWidth: "180px",
        }}
      >
        {/* Play/Pause button — only active when a real audioUrl exists */}
        <button
          onClick={hasAudio ? togglePlay : undefined}
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
          style={{
            background: `hsl(${cs.hsl} / ${hasAudio ? "0.18" : "0.07"})`,
            border: `1px solid hsl(${cs.hsl} / ${hasAudio ? "0.28" : "0.12"})`,
            cursor: hasAudio ? "pointer" : "default",
            opacity: hasAudio ? 1 : 0.38,
          }}
          title={hasAudio ? undefined : "Demo 暂不支持回放原音"}
        >
          {isPlaying
            ? <Pause size={11} style={{ color: `hsl(${cs.hsl})` }} />
            : <Play size={11} style={{ color: `hsl(${cs.hsl})`, marginLeft: 1 }} />
          }
        </button>

        {/* Waveform */}
        <WaveformBars isPlaying={isPlaying} hsl={cs.hsl} />

        {/* Duration */}
        <span
          className="flex-shrink-0 text-[10px] tabular-nums"
          style={{ color: "rgba(255,255,255,0.28)" }}
        >
          {fmtDuration(duration)}
        </span>
      </div>

      {/* No-audio hint */}
      {!hasAudio && (
        <p className="px-1 text-[10px] tracking-wide" style={{ color: "rgba(255,255,255,0.16)" }}>
          Demo 暂不支持回放原音
        </p>
      )}

      {/* Transcription subtitle */}
      {msg.content && msg.content !== "" && (
        <div className="flex items-start gap-1.5 px-1">
          <Mic size={9} style={{ color: "rgba(255,255,255,0.18)", marginTop: 2, flexShrink: 0 }} />
          <p
            className="text-[11px] leading-relaxed"
            style={{ color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}
          >
            {msg.content}
          </p>
        </div>
      )}

      {/* Hidden audio — only rendered when URL exists to avoid any src errors */}
      {hasAudio && (
        <audio ref={audioRef} src={msg.audioUrl} preload="auto" style={{ display: "none" }} />
      )}
    </div>
  );
}

// ── Chat bubble ─────────────────────────────────────────────────────────────
function ChatBubble({
  msg,
  activeCharacter,
  cs,
  onImageClick,
}: {
  msg: ChatMessage;
  activeCharacter: string;
  cs: { hsl: string; dot: string; name: string; enName: string };
  onImageClick: (url: string) => void;
}) {
  if (msg.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.24 }}
        className="flex justify-end"
      >
        <div className="max-w-[78%] flex flex-col items-end gap-1.5">
          {/* Audio type */}
          {msg.type === "audio" && (
            <VoiceCard msg={msg} cs={cs} />
          )}

          {/* Image type */}
          {msg.type === "image" && msg.imageUrl && (
            <div
              className="rounded-2xl rounded-tr-sm overflow-hidden cursor-zoom-in"
              onClick={() => onImageClick(msg.imageUrl!)}
            >
              <img
                src={msg.imageUrl}
                alt="图片"
                style={{
                  maxHeight: "200px",
                  maxWidth: "240px",
                  objectFit: "cover",
                  display: "block",
                  filter: "brightness(0.92) saturate(0.88)",
                }}
              />
            </div>
          )}

          {/* Text type (or text within audio/image messages) */}
          {msg.type !== "audio" && msg.content && msg.content !== "[图片]" && (
            <div
              className="rounded-2xl rounded-tr-sm px-4 py-2.5 text-[13px] leading-relaxed"
              style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.68)" }}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <p
                className="mt-1 text-[9px] tracking-wider text-right"
                style={{ color: "rgba(255,255,255,0.16)" }}
              >
                {msg.timestamp}
              </p>
            </div>
          )}

          {/* Timestamp for pure audio / image */}
          {(msg.type === "audio" || (msg.type === "image" && msg.content === "[图片]")) && (
            <p className="text-[9px] tracking-wider pr-1" style={{ color: "rgba(255,255,255,0.16)" }}>
              {msg.timestamp}
            </p>
          )}
        </div>
      </motion.div>
    );
  }

  // AI character bubble
  const roleKey = msg.role as string;
  const charStyle = CHAR_STYLES[roleKey] ?? cs;
  const isActive = roleKey === activeCharacter;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.24 }}
      className="flex justify-start gap-2.5 items-start"
      style={{ opacity: isActive ? 1 : 0.5 }}
    >
      {/* Mini orb */}
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
        style={{
          background: `radial-gradient(circle at 38% 35%, hsl(${charStyle.hsl} / 0.35), hsl(${charStyle.hsl} / 0.08))`,
          border: `1px solid hsl(${charStyle.hsl} / 0.20)`,
        }}
      >
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: charStyle.dot, opacity: 0.65 }} />
      </div>

      <div className="max-w-[78%] flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 px-0.5">
          <span className="text-[10px] font-medium" style={{ color: charStyle.dot }}>
            {charStyle.name}
          </span>
          <span className="text-[9px] tracking-wider" style={{ color: "rgba(255,255,255,0.18)" }}>
            {charStyle.enName}
          </span>
        </div>
        <div
          className="rounded-2xl rounded-tl-sm px-4 py-2.5 text-[13px] leading-relaxed"
          style={{
            background: `linear-gradient(135deg, hsl(${charStyle.hsl} / 0.08) 0%, rgba(255,255,255,0.016) 100%)`,
            border: `1px solid hsl(${charStyle.hsl} / 0.18)`,
            color: "rgba(255,255,255,0.60)",
          }}
        >
          <p className="whitespace-pre-wrap">{msg.content}</p>
          <p className="mt-1 text-[9px] tracking-wider" style={{ color: "rgba(255,255,255,0.16)" }}>
            {msg.timestamp}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ── Hero text overlay ───────────────────────────────────────────────────────
function HeroText({ dream, cs }: { dream: SavedDream; cs: { hsl: string } }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 px-6 pb-5">
      <h1 className="text-[21px] font-serif tracking-wide leading-snug" style={{ color: "rgba(255,255,255,0.90)" }}>
        {dream.title}
      </h1>
      <p className="mt-1 text-[10px] tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.28)" }}>
        {formatDate(dream.createdAt)}
      </p>
    </div>
  );
}

// ── Music card ───────────────────────────────────────────────────────────────
function MusicCard({ snapshot, cs }: { snapshot: MusicSnapshot; cs: { hsl: string; dot: string } }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [localFileUrl, setLocalFileUrl] = useState<string | null>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const localInputRef = useRef<HTMLInputElement | null>(null);
  const { play: playBuiltin, stop: stopBuiltin } = useAmbientMusic();
  const { play: playAmbient, stop: stopAmbient } = useAmbientSound();

  const handleToggle = () => {
    if (snapshot.source === "local") {
      if (!localFileUrl) {
        localInputRef.current?.click();
        return;
      }
      if (isPlaying) {
        localAudioRef.current?.pause();
        setIsPlaying(false);
      } else {
        localAudioRef.current?.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    } else if (snapshot.source === "builtin" && snapshot.trackId) {
      if (isPlaying) {
        stopBuiltin();
        setIsPlaying(false);
      } else {
        playBuiltin(snapshot.trackId as MusicType);
        setIsPlaying(true);
      }
    } else if (snapshot.source === "ambient" && snapshot.environmentId) {
      if (isPlaying) {
        stopAmbient();
        setIsPlaying(false);
      } else {
        playAmbient(snapshot.environmentId as AmbientSoundType);
        setIsPlaying(true);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setLocalFileUrl(url);
    if (localAudioRef.current) {
      localAudioRef.current.src = url;
      localAudioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const isLocal = snapshot.source === "local";
  const needsFile = isLocal && !localFileUrl;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-2xl"
      style={{
        background: `hsl(${cs.hsl} / 0.06)`,
        border: `1px solid hsl(${cs.hsl} / 0.14)`,
      }}
    >
      {/* Play / pick button */}
      <button
        onClick={handleToggle}
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all"
        style={{
          background: isPlaying ? `hsl(${cs.hsl} / 0.22)` : `hsl(${cs.hsl} / 0.10)`,
          border: `1px solid hsl(${cs.hsl} / 0.22)`,
        }}
      >
        {needsFile
          ? <FolderOpen size={12} style={{ color: `hsl(${cs.hsl} / 0.80)` }} />
          : isPlaying
            ? <Pause size={12} style={{ color: `hsl(${cs.hsl})` }} />
            : <Play size={12} style={{ color: `hsl(${cs.hsl})`, marginLeft: 1 }} />
        }
      </button>

      {/* Info */}
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Music2 size={9} style={{ color: `hsl(${cs.hsl} / 0.55)`, flexShrink: 0 }} />
          <span className="text-[10px] tracking-wider" style={{ color: `hsl(${cs.hsl} / 0.55)` }}>当时的声音</span>
        </div>
        <p className="text-[12px] truncate mt-0.5" style={{ color: "rgba(255,255,255,0.65)" }}>
          {snapshot.title}
        </p>
        {snapshot.artist && (
          <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.28)" }}>{snapshot.artist}</p>
        )}
        {needsFile && (
          <p className="text-[9px] mt-0.5 tracking-wide" style={{ color: "rgba(255,255,255,0.20)" }}>
            重新选择文件后可播放
          </p>
        )}
      </div>

      {/* Hidden inputs */}
      {isLocal && (
        <>
          <input
            ref={localInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          <audio
            ref={localAudioRef}
            style={{ display: "none" }}
            onEnded={() => setIsPlaying(false)}
          />
        </>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function DreamLocalDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const [dream, setDream] = useState<SavedDream | null | undefined>(undefined);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const id = (params as { id: string }).id;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DREAMS_STORAGE_KEY);
      if (raw) {
        const all = JSON.parse(raw) as SavedDream[];
        setDream(all.find(d => d.id === id) ?? null);
      } else {
        setDream(null);
      }
    } catch { setDream(null); }
  }, [id]);

  const handleDelete = () => {
    if (!window.confirm("确定要删除这段梦吗？")) return;
    try {
      const raw = localStorage.getItem(DREAMS_STORAGE_KEY);
      const all = raw ? (JSON.parse(raw) as SavedDream[]) : [];
      localStorage.setItem(DREAMS_STORAGE_KEY, JSON.stringify(all.filter(d => d.id !== id)));
    } catch { /* ignore */ }
    setLocation("/archive");
  };

  if (dream === undefined) {
    return (
      <div className="min-h-screen bg-[#05050A] text-white flex items-center justify-center">
        <motion.div
          animate={{ opacity: [0.15, 0.5, 0.15] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-[11px] tracking-[0.3em]"
          style={{ color: "rgba(255,255,255,0.3)" }}
        >
          正在感应…
        </motion.div>
      </div>
    );
  }

  if (!dream) {
    return (
      <div className="min-h-screen bg-[#05050A] text-white flex flex-col items-center justify-center gap-5">
        <p className="text-[13px] tracking-wide" style={{ color: "rgba(255,255,255,0.25)" }}>
          梦境已消散，或者从未存在过。
        </p>
        <button
          onClick={() => setLocation("/archive")}
          className="text-[11px] tracking-[0.2em] flex items-center gap-2"
          style={{ color: "rgba(255,255,255,0.20)" }}
        >
          <ArrowLeft size={12} />返回档案
        </button>
      </div>
    );
  }

  const cs = CHAR_STYLES[dream.activeCharacter] ?? CHAR_STYLES.daoshen;

  return (
    <div className="min-h-screen w-full bg-[#05050A] text-white flex flex-col relative">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[520px] h-[280px] rounded-full opacity-[0.055]"
          style={{ background: `radial-gradient(circle, hsl(${cs.hsl}), transparent)` }}
        />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-8 pb-4 max-w-xl mx-auto w-full">
        <button
          onClick={() => setLocation("/archive")}
          className="flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase transition-opacity"
          style={{ color: "rgba(255,255,255,0.22)" }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.65")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          <ArrowLeft size={13} />
          <span>梦之档案</span>
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const resume = {
                dreamId: dream.id,
                title: dream.title,
                summary: dream.summary,
                activeCharacter: dream.activeCharacter,
                messages: dream.messages,
                musicSnapshot: dream.musicSnapshot,
              };
              localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(resume));
              setLocation("/");
            }}
            className="flex items-center gap-1.5 text-[10px] tracking-wider transition-opacity"
            style={{ color: "rgba(255,255,255,0.28)" }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.75")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            <PenLine size={12} />
            <span>续写</span>
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 text-[10px] tracking-wider transition-opacity"
            style={{ color: "rgba(255,90,90,0.28)" }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.75")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            <Trash2 size={12} />
            <span>删除</span>
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="relative z-10 mx-auto w-full max-w-xl px-5 mb-5">
        {dream.coverImage ? (
          <div className="rounded-3xl overflow-hidden h-56 relative">
            <img
              src={dream.coverImage}
              alt=""
              className="w-full h-full object-cover"
              style={{ filter: "brightness(0.58) saturate(0.82)" }}
            />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(to bottom, transparent 35%, rgba(5,5,10,0.96) 100%)" }}
            />
            <HeroText dream={dream} cs={cs} />
          </div>
        ) : (
          <div
            className="rounded-3xl overflow-hidden h-44 relative"
            style={{ background: `linear-gradient(140deg, hsl(${cs.hsl} / 0.14) 0%, rgba(5,5,10,1) 80%)` }}
          >
            <div
              className="absolute top-3 right-6 w-28 h-28 rounded-full opacity-20"
              style={{ background: `radial-gradient(circle at 40% 38%, hsl(${cs.hsl} / 0.6), transparent 62%)` }}
            />
            <div
              className="absolute top-8 right-12 w-14 h-14 rounded-full"
              style={{
                background: `radial-gradient(circle at 38% 35%, hsl(${cs.hsl} / 0.20), transparent)`,
                border: `1px solid hsl(${cs.hsl} / 0.16)`,
              }}
            />
            <HeroText dream={dream} cs={cs} />
          </div>
        )}
      </div>

      {/* Character badge */}
      <div className="relative z-10 px-5 mb-6 max-w-xl mx-auto w-full">
        <div
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full"
          style={{ background: `hsl(${cs.hsl} / 0.07)`, border: `1px solid hsl(${cs.hsl} / 0.18)` }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cs.dot }} />
          <span className="text-[11px] tracking-[0.14em]" style={{ color: cs.dot }}>{cs.name}</span>
          <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.18)" }}>·</span>
          <span className="text-[10px] tracking-wide" style={{ color: "rgba(255,255,255,0.28)" }}>{cs.enName}</span>
        </div>
      </div>

      {/* Music snapshot card */}
      {dream.musicSnapshot && (
        <div className="relative z-10 px-5 mb-5 max-w-xl mx-auto w-full">
          <MusicCard snapshot={dream.musicSnapshot} cs={cs} />
        </div>
      )}

      {/* Chat history */}
      <div className="relative z-10 px-5 pb-16 max-w-xl mx-auto w-full flex flex-col gap-3.5">
        {dream.messages.map((msg, i) => (
          <ChatBubble
            key={msg.id ?? i}
            msg={msg}
            activeCharacter={dream.activeCharacter}
            cs={cs}
            onImageClick={setLightboxImg}
          />
        ))}
      </div>

      {/* Image lightbox */}
      <AnimatePresence>
        {lightboxImg && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.90)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxImg(null)}
          >
            <button
              className="absolute top-5 right-5 w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.10)" }}
              onClick={() => setLightboxImg(null)}
            >
              <X size={16} style={{ color: "rgba(255,255,255,0.65)" }} />
            </button>
            <motion.img
              src={lightboxImg}
              alt="预览"
              className="max-w-[92vw] max-h-[88vh] object-contain rounded-2xl"
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.22 }}
              onClick={e => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
