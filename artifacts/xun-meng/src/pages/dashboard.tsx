import React from "react";
import { useListDreams, useGetDreamStats } from "@workspace/api-client-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Sparkles, Calendar, Wind } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: dreams, isLoading } = useListDreams();
  const { data: stats } = useGetDreamStats();

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-8">
      <header className="text-center pt-8 pb-4">
        <h1 className="text-4xl font-serif text-transparent bg-clip-text bg-gradient-to-br from-white to-primary/60 tracking-wider mb-2">巡梦</h1>
        <p className="text-muted-foreground text-sm tracking-widest">记录梦，理解自己</p>
      </header>

      {/* Stats Summary */}
      {stats && stats.total > 0 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }} 
          className="glass-panel rounded-2xl p-5 flex justify-between items-center"
        >
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground">梦境总数</div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{stats.recurringCount}</div>
            <div className="text-xs text-muted-foreground">反复出现</div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <div className="text-2xl font-bold text-secondary">{stats.recentKeywords?.[0] || '-'}</div>
            <div className="text-xs text-muted-foreground">核心意象</div>
          </div>
        </motion.div>
      )}

      {/* Dreams List */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium flex items-center gap-2 text-foreground/80 px-1">
          <Sparkles size={18} className="text-primary" /> 近期梦境
        </h2>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-panel h-28 rounded-2xl animate-pulse bg-card/20" />
            ))}
          </div>
        ) : dreams && dreams.length > 0 ? (
          <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
            {dreams.map(dream => (
              <motion.div key={dream.id} variants={item}>
                <Link href={`/dream/${dream.id}`} className="block glass-panel rounded-2xl p-5 hover:bg-card/60 transition-colors group">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">{dream.title}</h3>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-4 flex items-center gap-1">
                      <Calendar size={12} /> {format(new Date(dream.createdAt), 'MM/dd')}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{dream.content}</p>
                  <div className="flex items-center gap-2">
                    {dream.keywords?.slice(0, 3).map(kw => (
                      <span key={kw} className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary/80 border border-primary/20">
                        {kw}
                      </span>
                    ))}
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="text-center py-16 glass-panel rounded-3xl mt-4">
            <Wind size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">还没有记录过梦境</p>
            <p className="text-xs text-muted-foreground/60 mt-1">闭上眼，去星空里走走</p>
          </div>
        )}
      </div>
    </div>
  );
}
