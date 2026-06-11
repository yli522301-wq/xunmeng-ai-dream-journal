import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateCharacter, useActivateCharacter, getListCharactersQueryKey, getGetActiveCharacterQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const formSchema = z.object({
  name: z.string().min(1, "需要一个名字"),
  role: z.string().min(1, "一句话描述身份"),
  personality: z.array(z.string()).min(1, "至少添加一个性格关键词"),
  speakingStyle: z.string(),
  relationship: z.string(),
  language: z.enum(["zh", "en"]),
  voiceType: z.string(),
  systemPrompt: z.string().optional(),
});

export default function CharacterNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateCharacter();
  const activateMutation = useActivateCharacter();

  const [tagInput, setTagInput] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      role: "",
      personality: [],
      speakingStyle: "温柔细腻",
      relationship: "自定义",
      language: "zh",
      voiceType: "中性清澈",
      systemPrompt: ""
    }
  });

  const personalityTags = form.watch("personality");

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = tagInput.trim();
      if (val && personalityTags.length < 5 && !personalityTags.includes(val)) {
        form.setValue("personality", [...personalityTags, val]);
        setTagInput("");
      }
    }
  };

  const removeTag = (tag: string) => {
    form.setValue("personality", personalityTags.filter(t => t !== tag));
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const char = await createMutation.mutateAsync({ 
        data: { ...values, isActive: true } 
      });
      await activateMutation.mutateAsync({ id: char.id });
      
      queryClient.invalidateQueries({ queryKey: getListCharactersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetActiveCharacterQueryKey() });
      
      toast({ title: "陪伴者已就绪" });
      setLocation("/");
    } catch (e) {
      toast({ title: "创建失败", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 pt-4 pb-20 animate-in fade-in max-w-2xl mx-auto px-4">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setLocation("/")}>
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-xl font-serif text-white/90">孕育新灵魂</h1>
      </header>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="glass-panel p-5 rounded-3xl space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">呼唤TA的名字</FormLabel>
                  <FormControl>
                    <Input placeholder="例如：白泽" className="bg-background/50 border-white/5" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">身份设定</FormLabel>
                  <FormControl>
                    <Input placeholder="例如：来自深海的梦境解读者" className="bg-background/50 border-white/5" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="personality"
              render={() => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">性格特质 (回车添加, 最多5个)</FormLabel>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {personalityTags.map(tag => (
                        <div key={tag} className="flex items-center gap-1 bg-primary/15 text-primary border border-primary/20 px-2 py-1 rounded-md text-xs">
                          {tag}
                          <button type="button" onClick={() => removeTag(tag)} className="opacity-50 hover:opacity-100">
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <Input 
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={handleAddTag}
                      disabled={personalityTags.length >= 5}
                      placeholder={personalityTags.length >= 5 ? "已达到上限" : "输入关键词..."} 
                      className="bg-background/50 border-white/5" 
                    />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="speakingStyle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">说话风格</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="bg-background/50 border-white/5"><SelectValue/></SelectTrigger></FormControl>
                      <SelectContent>
                        {["温柔细腻", "轻松活泼", "理性克制", "神秘深沉", "活泼可爱"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="relationship"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">与我的关系</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="bg-background/50 border-white/5"><SelectValue/></SelectTrigger></FormControl>
                      <SelectContent>
                        {["童年好友", "心理陪伴者", "梦境观察者", "温柔姐姐", "冷静顾问", "自定义"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">沟通语言</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="bg-background/50 border-white/5"><SelectValue/></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="zh">中文</SelectItem>
                        <SelectItem value="en">英文 (English)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="voiceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">声音倾向</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="bg-background/50 border-white/5"><SelectValue/></SelectTrigger></FormControl>
                      <SelectContent>
                        {["女声温柔", "男声低沉", "中性清澈", "童声可爱"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="systemPrompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">底层灵魂指令 (系统提示词)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="在这里详细描述TA应该如何回应你..." 
                      className="min-h-[100px] resize-none bg-background/50 border-white/5 text-xs" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button type="submit" className="w-full rounded-full py-6 text-base shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90" disabled={createMutation.isPending}>
            {createMutation.isPending ? <Loader2 className="animate-spin" /> : "唤醒陪伴者"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
