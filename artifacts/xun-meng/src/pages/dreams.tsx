import { useListDreams, getListDreamsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { BookOpen, Calendar, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

const MOOD_COLORS: Record<string, string> = {
  calm: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  anxious: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  happy: "bg-green-500/20 text-green-300 border-green-500/30",
  fearful: "bg-red-500/20 text-red-300 border-red-500/30",
  confused: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  nostalgic: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  strange: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
};

const MOOD_LABELS: Record<string, string> = {
  calm: "平静", anxious: "焦虑", happy: "开心", fearful: "恐惧", 
  confused: "迷茫", nostalgic: "怀念", strange: "奇怪"
};

const CLARITY_LABELS: Record<string, string> = {
  vague: "模糊", moderate: "一般", vivid: "清晰"
};

export default function DreamsList() {
  const { data: dreams, isLoading } = useListDreams();

  return (
    <div className="space-y-6 pt-6 animate-in fade-in max-w-2xl mx-auto px-4">
      <header className="flex items-center gap-4">
        <Link href="/" className="w-10 h-10 flex items-center justify-center rounded-full glass-panel hover:bg-white/10 transition-colors">
          <ArrowLeft size={20} className="text-white/70" />
        </Link>
        <div>
          <h1 className="text-2xl font-serif text-white/90">梦境陈列室</h1>
          <p className="text-sm text-muted-foreground mt-1">那些夜晚的碎片</p>
        </div>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-32 glass-panel rounded-3xl animate-pulse" />)}
        </div>
      ) : dreams?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <BookOpen size={40} className="text-white/10" />
          <p className="text-muted-foreground text-sm tracking-widest">还没有梦境记录</p>
          <Link href="/" className="px-6 py-2 rounded-full border border-white/20 text-sm hover:bg-white/5 transition-colors">
            返回梦境空间
          </Link>
        </div>
      ) : (
        <div className="space-y-4 pb-10">
          {dreams?.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((dream, i) => (
            <motion.div 
              key={dream.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link href={`/dream/${dream.id}`} className="block glass-panel p-5 rounded-3xl hover:bg-white/5 transition-colors group relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-10 mix-blend-screen transition-opacity group-hover:opacity-20 ${MOOD_COLORS[dream.mood]?.split(' ')[0]}`} />
                
                <div className="flex justify-between items-start mb-3 relative z-10">
                  <h3 className="font-serif text-lg text-white/90 line-clamp-1 pr-4">{dream.title}</h3>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 bg-background/50 px-2 py-1 rounded-full">
                    <Calendar size={12} />
                    {format(new Date(dream.createdAt), 'MM/dd')}
                  </div>
                </div>

                <p className="text-sm text-muted-foreground line-clamp-2 mb-4 relative z-10 leading-relaxed">
                  {dream.summary || dream.content}
                </p>

                <div className="flex flex-wrap items-center gap-2 relative z-10">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${MOOD_COLORS[dream.mood] || 'bg-white/10 text-white/70'}`}>
                    {MOOD_LABELS[dream.mood] || dream.mood}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/60 border border-white/10">
                    {CLARITY_LABELS[dream.clarity] || dream.clarity}
                  </span>
                  {dream.symbols?.slice(0, 2).map(sym => (
                    <span key={sym} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary/80 border border-primary/20">
                      {sym}
                    </span>
                  ))}
                </div>
              </Link>
            </motion.div>
          ))}
          
          <div className="pt-4 flex justify-center">
            <Link href="/" className="px-6 py-2 rounded-full border border-white/10 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors">
              返回梦境空间
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
