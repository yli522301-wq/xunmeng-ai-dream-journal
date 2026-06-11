import { useGetAiSettings, useClearChatHistory, getGetChatHistoryQueryKey } from "@workspace/api-client-react";
import { Settings2, Key, Database, Info, ShieldAlert, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Settings() {
  const { data: settings, isLoading } = useGetAiSettings();
  const clearChatHistory = useClearChatHistory();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleClearData = () => {
    if (confirm("确定要清空所有梦境数据吗？此操作不可恢复。")) {
      toast({ title: "演示环境中，请通过删除单个梦境来管理数据。" });
    }
  };

  const handleClearChat = async () => {
    if (confirm("确定要清空所有聊天记录吗？此操作不可恢复。")) {
      try {
        await clearChatHistory.mutateAsync({});
        queryClient.invalidateQueries({ queryKey: getGetChatHistoryQueryKey() });
        toast({ title: "聊天记录已清空" });
      } catch (err) {
        toast({ title: "清空失败", variant: "destructive" });
      }
    }
  };

  return (
    <div className="space-y-6 pt-6 pb-20 animate-in fade-in">
      <header>
        <h1 className="text-2xl font-serif text-white/90 flex items-center gap-2">
          <Settings2 size={24} className="text-primary" /> 设置
        </h1>
      </header>

      <div className="space-y-4">
        {/* AI Configuration */}
        <section className="glass-panel p-6 rounded-3xl space-y-4 border border-white/5">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-2">
            <Key size={14} /> AI 核心
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-sm text-foreground/80">当前模式</span>
              <span className="text-sm text-primary/90 font-medium bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                {isLoading ? "..." : settings?.mode === "mock" ? "模拟回路" : "真实感应"}
              </span>
            </div>
            
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-sm text-foreground/80">密钥状态</span>
              <span className={`text-sm flex items-center gap-1.5 ${settings?.hasApiKey ? 'text-green-400' : 'text-yellow-500'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${settings?.hasApiKey ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]' : 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)] animate-pulse'}`} />
                {isLoading ? "..." : settings?.hasApiKey ? "已连接" : "未连接 (Mock)"}
              </span>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-foreground/80">思考模型</span>
              <span className="text-muted-foreground text-xs bg-black/20 px-2 py-1 rounded-md">
                {isLoading ? "..." : settings?.modelName || "内置"}
              </span>
            </div>
          </div>
        </section>

        {/* Data Management */}
        <section className="glass-panel p-6 rounded-3xl space-y-4 border border-white/5">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-2">
            <Database size={14} /> 记忆管理
          </h2>
          
          <div className="pt-2 space-y-3">
            <Button variant="outline" className="w-full rounded-xl border-white/10 hover:bg-white/5 h-12 text-sm" onClick={handleClearChat} disabled={clearChatHistory.isPending}>
              {clearChatHistory.isPending ? <Loader2 className="animate-spin" /> : "清空所有对话记忆"}
            </Button>
            <Button variant="outline" className="w-full rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive h-12 text-sm" onClick={handleClearData}>
              抹除所有梦境记录
            </Button>
          </div>
        </section>

        {/* About */}
        <section className="glass-panel p-6 rounded-3xl space-y-4 border border-white/5">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-2">
            <Info size={14} /> 关于巡梦
          </h2>
          
          <div className="space-y-4 text-sm text-foreground/70 leading-relaxed">
            <p className="flex items-start gap-2">
              <Sparkles className="text-secondary shrink-0 mt-0.5" size={16} />
              <span>在这里，潜意识得以具象化。你的陪伴者将倾听每一个光怪陆离的夜晚。</span>
            </p>
            
            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex gap-3 items-start">
              <ShieldAlert className="text-primary shrink-0 mt-0.5" size={16} />
              <p className="text-xs text-primary/80 leading-relaxed">你的梦境纯属私密。所有的记录均受到保护，AI 感应过程亦不会被用于模型训练。</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
