import { useListCharacters, useDeleteCharacter, useActivateCharacter, getListCharactersQueryKey, getGetActiveCharacterQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompanionOrb } from "@/components/companion-orb";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Characters() {
  const { data: characters, isLoading } = useListCharacters();
  const deleteMutation = useDeleteCharacter();
  const activateMutation = useActivateCharacter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleActivate = async (id: string) => {
    try {
      await activateMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListCharactersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetActiveCharacterQueryKey() });
      toast({ title: "已切换陪伴者" });
    } catch (e) {
      toast({ title: "切换失败", variant: "destructive" });
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("确定要删除这个角色吗？")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListCharactersQueryKey() });
      toast({ title: "角色已删除" });
    } catch (e) {
      toast({ title: "删除失败", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 pt-6 animate-in fade-in">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-serif text-white/90">你的陪伴者</h1>
          <p className="text-sm text-muted-foreground mt-1">他们在这里倾听你的梦境</p>
        </div>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-40 glass-panel rounded-2xl animate-pulse" />)}
        </div>
      ) : characters?.length === 0 ? (
        <div className="text-center py-20 glass-panel rounded-3xl space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full border border-dashed border-white/20 flex items-center justify-center text-white/30">
            <Plus size={24} />
          </div>
          <p className="text-muted-foreground">还没有陪伴者</p>
          <Button asChild className="rounded-full">
            <Link href="/characters/new">创建你的第一个角色</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pb-20">
          {characters?.map(char => (
            <div 
              key={char.id} 
              onClick={() => handleActivate(char.id)}
              className={`relative glass-panel p-5 rounded-2xl flex flex-col items-center text-center cursor-pointer transition-all ${
                char.isActive ? 'border-primary/50 bg-primary/5 shadow-[0_0_15px_rgba(var(--primary),0.1)]' : 'hover:bg-white/5'
              }`}
            >
              {char.isActive && (
                <div className="absolute top-3 left-3 text-primary">
                  <CheckCircle2 size={16} />
                </div>
              )}
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-1 right-1 w-8 h-8 rounded-full text-muted-foreground hover:text-destructive opacity-0 hover:opacity-100 md:opacity-100"
                onClick={(e) => handleDelete(e, char.id)}
              >
                <Trash2 size={14} />
              </Button>
              
              <CompanionOrb size="sm" isSpeaking={char.isActive} className="mb-4" />
              <h3 className="font-serif font-medium text-foreground mb-1 line-clamp-1">{char.name}</h3>
              <p className="text-[11px] text-muted-foreground line-clamp-2">{char.role}</p>
            </div>
          ))}
        </div>
      )}

      <Link 
        href="/characters/new" 
        className="fixed bottom-24 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg shadow-primary/30 hover:scale-105 transition-transform z-40"
      >
        <Plus size={24} />
      </Link>
    </div>
  );
}
