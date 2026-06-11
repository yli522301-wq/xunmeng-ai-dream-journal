import { useGetActiveCharacter, getGetActiveCharacterQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Moon, MessageCircle, BookOpen, Users, Plus } from "lucide-react";
import { CompanionOrb } from "@/components/companion-orb";

export default function Dashboard() {
  const { data: activeCharacter, isLoading } = useGetActiveCharacter({
    query: { queryKey: getGetActiveCharacterQueryKey() }
  });

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><CompanionOrb size="sm" isSpeaking /></div>;
  }

  if (!activeCharacter) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-6 animate-in fade-in zoom-in duration-500">
        <div className="w-32 h-32 rounded-full border-2 border-dashed border-primary/30 flex items-center justify-center text-primary/30 mb-4">
          <Moon size={40} />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-serif text-white/90">还没有陪伴者</h1>
          <p className="text-muted-foreground text-sm">创建一个懂你的 AI 梦境陪伴者</p>
        </div>
        <Link 
          href="/characters/new" 
          className="bg-primary text-primary-foreground px-6 py-3 rounded-full flex items-center gap-2 hover:bg-primary/90 transition-colors"
          data-testid="link-create-character"
        >
          <Plus size={18} />
          <span>创建你的第一个角色</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)] animate-in fade-in duration-700">
      <header className="w-full flex justify-between items-center py-4 absolute top-0">
        <div className="font-serif text-xl tracking-widest text-white/80">巡梦</div>
      </header>

      <div className="flex flex-col items-center justify-center flex-1 w-full max-w-sm mx-auto space-y-10 mt-12">
        <div className="flex flex-col items-center space-y-6">
          <CompanionOrb size="lg" isSpeaking={false} />
          
          <div className="text-center space-y-1">
            <h2 className="text-3xl font-serif text-white tracking-wide">{activeCharacter.name}</h2>
            <p className="text-muted-foreground text-sm">{activeCharacter.role || "你的梦境陪伴者"}</p>
          </div>

          <div className="text-xs text-primary/70 tracking-widest px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5">
            正在等你说梦...
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full">
          <Link href="/new" className="glass-panel p-4 rounded-2xl flex flex-col items-center gap-2 hover:bg-white/5 transition-colors group" data-testid="action-new-dream">
            <div className="bg-primary/20 p-3 rounded-full text-primary group-hover:scale-110 transition-transform">
              <Moon size={20} />
            </div>
            <span className="text-sm font-medium">说一个梦</span>
          </Link>
          
          <Link href="/chat" className="glass-panel p-4 rounded-2xl flex flex-col items-center gap-2 hover:bg-white/5 transition-colors group" data-testid="action-chat">
            <div className="bg-secondary/20 p-3 rounded-full text-secondary group-hover:scale-110 transition-transform">
              <MessageCircle size={20} />
            </div>
            <span className="text-sm font-medium">开始聊天</span>
          </Link>
          
          <Link href="/dreams" className="glass-panel p-4 rounded-2xl flex flex-col items-center gap-2 hover:bg-white/5 transition-colors group" data-testid="action-dreams">
            <div className="bg-blue-500/20 p-3 rounded-full text-blue-400 group-hover:scale-110 transition-transform">
              <BookOpen size={20} />
            </div>
            <span className="text-sm font-medium">梦境记录</span>
          </Link>
          
          <Link href="/characters" className="glass-panel p-4 rounded-2xl flex flex-col items-center gap-2 hover:bg-white/5 transition-colors group" data-testid="action-characters">
            <div className="bg-purple-500/20 p-3 rounded-full text-purple-400 group-hover:scale-110 transition-transform">
              <Users size={20} />
            </div>
            <span className="text-sm font-medium">更换角色</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
