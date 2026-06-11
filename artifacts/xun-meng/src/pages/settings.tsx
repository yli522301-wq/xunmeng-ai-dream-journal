import { useGetAiSettings } from "@workspace/api-client-react";
import { Settings2, Key, Database, Info, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Settings() {
  const { data: settings, isLoading } = useGetAiSettings();

  const handleClearData = () => {
    if (confirm("确定要清空所有梦境数据吗？此操作不可恢复。")) {
      // Since we don't have a clear all endpoint in the provided hooks, we'll just show an alert
      alert("演示环境中，请通过删除单个梦境来管理数据。");
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-serif text-white/90 flex items-center gap-2">
          <Settings2 size={24} className="text-primary" /> 设置
        </h1>
      </header>

      <div className="space-y-4">
        {/* AI Configuration */}
        <section className="glass-panel p-6 rounded-3xl space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Key size={16} /> AI 模型配置
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-foreground">当前模式</span>
              <span className="text-primary font-medium">
                {isLoading ? "..." : settings?.mode === "mock" ? "模拟数据 (Mock)" : "真实 API"}
              </span>
            </div>
            
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-foreground">API 密钥状态</span>
              <span className={`flex items-center gap-1 ${settings?.hasApiKey ? 'text-green-400' : 'text-yellow-500'}`}>
                <div className={`w-2 h-2 rounded-full ${settings?.hasApiKey ? 'bg-green-400' : 'bg-yellow-500'}`} />
                {isLoading ? "..." : settings?.hasApiKey ? "已配置" : "未配置 (回退至Mock)"}
              </span>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-foreground">当前模型</span>
              <span className="text-muted-foreground text-sm">
                {isLoading ? "..." : settings?.modelName || "内置"}
              </span>
            </div>
          </div>
        </section>

        {/* Data Management */}
        <section className="glass-panel p-6 rounded-3xl space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Database size={16} /> 数据管理
          </h2>
          
          <div className="pt-2">
            <Button variant="destructive" className="w-full bg-destructive/20 text-destructive hover:bg-destructive/30 border border-destructive/20" onClick={handleClearData}>
              清空所有梦境记录
            </Button>
          </div>
        </section>

        {/* About */}
        <section className="glass-panel p-6 rounded-3xl space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Info size={16} /> 关于
          </h2>
          
          <div className="space-y-3 text-sm text-foreground/80 leading-relaxed">
            <p><strong>巡梦 (Xun Meng)</strong> 是一款私密的 AI 梦境记录工具。在这里，你的潜意识得以具象化。</p>
            
            <div className="p-3 bg-card/30 rounded-xl border border-primary/10 mt-4 flex gap-3 items-start">
              <ShieldAlert className="text-primary shrink-0 mt-0.5" size={18} />
              <p className="text-xs text-muted-foreground">所有的梦境数据均保存在本地或专属服务器中。AI 分析过程不会用于训练其他模型，请安心记录。</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
