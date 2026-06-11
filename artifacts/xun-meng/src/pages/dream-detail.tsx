import { useGetDream, useDeleteDream, getGetDreamQueryKey, getListDreamsQueryKey } from "@workspace/api-client-react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Trash2, MessageCircle, Sparkles, Brain, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { CompanionOrb } from "@/components/companion-orb";

const MOOD_COLORS: Record<string, string> = {
  calm: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  anxious: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  happy: "bg-green-500/20 text-green-300 border-green-500/30",
  fearful: "bg-red-500/20 text-red-300 border-red-500/30",
  confused: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  nostalgic: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  strange: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
};

const MOOD_MAP: Record<string, string> = {
  calm: "平静", anxious: "焦虑", happy: "开心", fearful: "恐惧", 
  confused: "迷茫", nostalgic: "怀念", strange: "奇怪"
};

const CLARITY_MAP: Record<string, string> = {
  vague: "模糊", moderate: "一般", vivid: "清晰"
};

export default function DreamDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const { data: dream, isLoading, error } = useGetDream(id, { 
    query: { enabled: !!id, queryKey: getGetDreamQueryKey(id) } 
  });
  
  const deleteDream = useDeleteDream();

  const handleDelete = async () => {
    if (!confirm("确定要删除这个梦境吗？")) return;
    try {
      await deleteDream.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListDreamsQueryKey() });
      toast({ title: "梦境已删除" });
      setLocation("/dreams");
    } catch (err) {
      toast({ title: "删除失败", description: String(err), variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  if (error || !dream) {
    return (
      <div className="text-center py-20 text-muted-foreground flex flex-col items-center gap-4 animate-in fade-in">
        <ArrowLeft size={48} className="text-white/10" />
        <p>梦境已消散，或者从未存在过。</p>
        <Button variant="outline" onClick={() => setLocation("/dreams")}>返回列表</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4 pb-20">
      <header className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setLocation("/dreams")}>
          <ArrowLeft size={20} />
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDelete} disabled={deleteDream.isPending}>
            <Trash2 size={18} />
          </Button>
        </div>
      </header>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="space-y-4">
          <h1 className="text-3xl font-serif text-white/90 leading-tight">{dream.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 text-muted-foreground border border-white/5">
              {format(new Date(dream.createdAt), 'yyyy/MM/dd HH:mm')}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full border ${MOOD_COLORS[dream.mood] || 'bg-white/10 text-white/70'}`}>
              {MOOD_MAP[dream.mood] || dream.mood}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 text-white/60 border border-white/10">
              {CLARITY_MAP[dream.clarity] || dream.clarity}
            </span>
            {dream.isRecurring && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-secondary/10 text-secondary/80 border border-secondary/20">
                反复出现
              </span>
            )}
          </div>
        </div>

        {dream.imageUrl && (
          <div className="rounded-3xl overflow-hidden glass-panel border-white/10 p-1">
            <img src={dream.imageUrl} alt="梦境画面" className="w-full h-auto object-cover max-h-72 rounded-2xl opacity-90 hover:opacity-100 transition-opacity" />
          </div>
        )}

        <div className="glass-panel p-6 sm:p-8 rounded-3xl relative overflow-hidden">
          <div className={`absolute top-0 right-0 w-64 h-64 rounded-bl-full opacity-5 mix-blend-screen pointer-events-none ${MOOD_COLORS[dream.mood]?.split(' ')[0]}`} />
          <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap text-base relative z-10">{dream.content}</p>
        </div>

        {(dream.summary || dream.emotionAnalysis || dream.possibleConnection || dream.companionReply) && (
          <div className="space-y-4 pt-2">
            
            {dream.companionReply && (
              <div className="glass-panel p-5 sm:p-6 rounded-3xl bg-primary/5 border-primary/20 relative">
                <div className="flex items-center gap-3 mb-4">
                  <CompanionOrb size="sm" isSpeaking={false} />
                  <h4 className="font-serif text-primary">陪伴者的回应</h4>
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed italic pr-2">
                  "{dream.companionReply}"
                </p>
              </div>
            )}

            {dream.symbols && dream.symbols.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {dream.symbols.map(sym => (
                  <span key={sym} className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {sym}
                  </span>
                ))}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {dream.emotionAnalysis && (
                <div className="glass-panel p-5 rounded-3xl bg-card/20 border-white/5">
                  <h4 className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
                    <Brain size={14} /> 情绪解析
                  </h4>
                  <p className="text-sm text-foreground/80 leading-relaxed">{dream.emotionAnalysis}</p>
                </div>
              )}
              {dream.possibleConnection && (
                <div className="glass-panel p-5 rounded-3xl bg-card/20 border-white/5">
                  <h4 className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
                    <Sparkles size={14} /> 现实映射
                  </h4>
                  <p className="text-sm text-foreground/80 leading-relaxed">{dream.possibleConnection}</p>
                </div>
              )}
            </div>

            {dream.summary && (
              <div className="glass-panel p-5 rounded-3xl bg-card/20 border-white/5">
                <p className="text-sm text-foreground/80 italic border-l-2 border-primary/30 pl-4 py-1">
                  "{dream.summary}"
                </p>
              </div>
            )}
          </div>
        )}

        <div className="pt-6">
          <Button 
            className="w-full rounded-full py-6 text-base shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90"
            onClick={() => setLocation(`/chat?dreamContext=${encodeURIComponent(dream.content)}`)}
          >
            <MessageCircle className="mr-2 h-5 w-5" />
            聊聊这个梦
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
