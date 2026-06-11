import { useGetDream, useDeleteDream, getGetDreamQueryKey, getListDreamsQueryKey } from "@workspace/api-client-react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Trash2, MessageCircle, Sparkles, Brain, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

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
      setLocation("/");
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
      <div className="text-center py-20 text-muted-foreground">
        梦境已消散，或者从未存在过。
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setLocation("/")}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="rounded-full text-primary hover:text-primary hover:bg-primary/10" onClick={() => setLocation(`/chat?dreamId=${dream.id}`)}>
            <MessageCircle size={18} />
          </Button>
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
        <div>
          <h1 className="text-3xl font-serif text-white/90 mb-2">{dream.title}</h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>{format(new Date(dream.createdAt), 'yyyy年MM月dd日 HH:mm')}</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>{MOOD_MAP[dream.mood] || dream.mood}</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>{CLARITY_MAP[dream.clarity] || dream.clarity}</span>
            {dream.isRecurring && (
              <>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span className="text-secondary/80">反复出现</span>
              </>
            )}
          </div>
        </div>

        {dream.imageUrl && (
          <div className="rounded-2xl overflow-hidden glass-panel border-white/10">
            <img src={dream.imageUrl} alt="梦境画面" className="w-full h-auto object-cover max-h-64 opacity-80 hover:opacity-100 transition-opacity" />
          </div>
        )}

        <div className="glass-panel p-6 rounded-3xl">
          <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">{dream.content}</p>
        </div>

        {(dream.summary || dream.emotionAnalysis || dream.possibleConnection) && (
          <div className="space-y-4 pt-4">
            <h3 className="text-sm font-medium text-primary flex items-center gap-2">
              <Sparkles size={16} /> AI 梦境解析
            </h3>
            
            {dream.keywords && dream.keywords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {dream.keywords.map(kw => (
                  <span key={kw} className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {kw}
                  </span>
                ))}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {dream.emotionAnalysis && (
                <div className="glass-panel p-5 rounded-2xl bg-card/20">
                  <h4 className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                    <Brain size={14} /> 情绪解析
                  </h4>
                  <p className="text-sm text-foreground/80">{dream.emotionAnalysis}</p>
                </div>
              )}
              {dream.possibleConnection && (
                <div className="glass-panel p-5 rounded-2xl bg-card/20">
                  <h4 className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                    <Sparkles size={14} /> 现实映射
                  </h4>
                  <p className="text-sm text-foreground/80">{dream.possibleConnection}</p>
                </div>
              )}
            </div>

            {dream.summary && (
              <div className="glass-panel p-5 rounded-2xl bg-card/20">
                <p className="text-sm text-foreground/80 italic border-l-2 border-primary/50 pl-4 py-1">
                  "{dream.summary}"
                </p>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
