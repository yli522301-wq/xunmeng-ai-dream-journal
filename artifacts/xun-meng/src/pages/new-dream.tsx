import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateDream, useAiOrganizeDream, getListDreamsQueryKey, getGetDreamStatsQueryKey, useGetActiveCharacter, getGetActiveCharacterQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Mic, Loader2, Save, ArrowLeft } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { CompanionOrb } from "@/components/companion-orb";

const MOOD_COLORS: Record<string, { label: string, color: string }> = {
  calm: { label: "平静", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  anxious: { label: "焦虑", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  happy: { label: "开心", color: "bg-green-500/20 text-green-300 border-green-500/30" },
  fearful: { label: "恐惧", color: "bg-red-500/20 text-red-300 border-red-500/30" },
  confused: { label: "迷茫", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  nostalgic: { label: "怀念", color: "bg-pink-500/20 text-pink-300 border-pink-500/30" },
  strange: { label: "奇怪", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" }
};

const CLARITY = [
  { value: "vague", label: "模糊" },
  { value: "moderate", label: "一般" },
  { value: "vivid", label: "清晰" }
] as const;

const formSchema = z.object({
  title: z.string().min(1, "梦境需要一个名字"),
  content: z.string().min(1, "写下你梦到了什么..."),
  mood: z.enum(["calm", "anxious", "happy", "fearful", "confused", "nostalgic", "strange"]),
  clarity: z.enum(["vague", "moderate", "vivid"]),
  isRecurring: z.boolean().default(false)
});

export default function NewDream() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createDream = useCreateDream();
  const organizeDream = useAiOrganizeDream();
  const [isListening, setIsListening] = useState(false);
  
  const { data: activeCharacter } = useGetActiveCharacter({
    query: { queryKey: getGetActiveCharacterQueryKey() }
  });

  const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition = useRef<any>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      content: "",
      mood: "strange",
      clarity: "vague",
      isRecurring: false
    }
  });

  useEffect(() => {
    if (SpeechRecognition) {
      recognition.current = new SpeechRecognition();
      recognition.current.continuous = true;
      recognition.current.interimResults = true;
      recognition.current.lang = 'zh-CN';

      recognition.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          const currentContent = form.getValues("content");
          form.setValue("content", currentContent + (currentContent ? " " : "") + finalTranscript);
        }
      };

      recognition.current.onerror = (event: any) => {
        setIsListening(false);
        toast({ title: "语音识别出错", description: event.error, variant: "destructive" });
      };

      recognition.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [SpeechRecognition, form, toast]);

  const toggleVoice = () => {
    if (!SpeechRecognition) {
      toast({ title: "不支持语音输入", description: "您的浏览器不支持语音识别功能", variant: "destructive" });
      return;
    }
    if (isListening) {
      recognition.current?.stop();
    } else {
      recognition.current?.start();
      setIsListening(true);
      toast({ title: "正在聆听...", description: "请开始描述您的梦境" });
    }
  };

  const handleAiOrganize = async () => {
    const content = form.getValues("content");
    if (!content) {
      toast({ title: "内容为空", description: "请先写下梦境内容", variant: "destructive" });
      return;
    }

    try {
      const res = await organizeDream.mutateAsync({ 
        data: { 
          content, 
          title: form.getValues("title") || undefined,
          characterSystemPrompt: activeCharacter?.systemPrompt 
        } 
      });
      if (res.isMock) {
        toast({ title: "提示", description: "使用模拟数据，请在设置中配置真实API" });
      } else {
        toast({ title: "分析完成", description: `${activeCharacter?.name || 'AI'} 已经为您梳理了梦境` });
      }
      if (res.summary) {
        form.setValue("content", res.summary); 
      }
      if (!form.getValues("title") && res.title) {
         // Assuming organize might return a title if missing, or we just keep it
      }
    } catch (error) {
      toast({ title: "分析失败", description: String(error), variant: "destructive" });
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const result = await createDream.mutateAsync({ 
        data: {
          ...values,
          characterId: activeCharacter?.id
        } 
      });
      queryClient.invalidateQueries({ queryKey: getListDreamsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDreamStatsQueryKey() });
      toast({ title: "梦境已保存" });
      setLocation(`/dream/${result.id}`);
    } catch (error) {
      toast({ title: "保存失败", description: String(error), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 pt-4 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full shrink-0" onClick={() => setLocation("/")}>
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 className="text-xl font-serif text-white/90">捕获梦境</h1>
          <p className="text-xs text-muted-foreground mt-0.5">趁着记忆还没有消散</p>
        </div>
      </header>

      <div className="glass-panel p-5 sm:p-6 rounded-3xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input 
                      placeholder="给梦起个名字" 
                      className="text-xl sm:text-2xl font-serif bg-transparent border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none h-12" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="relative">
                      <div className="absolute right-3 top-3">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className={`rounded-full shadow-md w-10 h-10 ${isListening ? 'bg-primary text-white animate-pulse' : 'bg-card text-muted-foreground hover:text-primary'}`}
                          onClick={toggleVoice}
                        >
                          <Mic size={18} />
                        </Button>
                      </div>
                      <Textarea 
                        placeholder="那是一个怎样的梦..." 
                        className="min-h-[200px] resize-none bg-background/30 border-white/5 rounded-2xl pt-4 pl-4 pr-16 pb-4 text-base leading-relaxed"
                        {...field} 
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-6">
              <FormField
                control={form.control}
                name="mood"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm text-muted-foreground">睡醒情绪</FormLabel>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {Object.entries(MOOD_COLORS).map(([val, conf]) => (
                        <div 
                          key={val}
                          onClick={() => field.onChange(val)}
                          className={`cursor-pointer px-4 py-2 rounded-full border text-sm transition-all ${
                            field.value === val ? conf.color : 'border-white/10 text-muted-foreground hover:bg-white/5'
                          }`}
                        >
                          {conf.label}
                        </div>
                      ))}
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="clarity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm text-muted-foreground">清晰度</FormLabel>
                    <div className="flex gap-2 pt-1">
                      {CLARITY.map(c => (
                        <div 
                          key={c.value}
                          onClick={() => field.onChange(c.value)}
                          className={`cursor-pointer flex-1 text-center py-2 rounded-full border text-sm transition-all ${
                            field.value === c.value ? 'bg-primary/20 text-primary border-primary/30' : 'border-white/10 text-muted-foreground hover:bg-white/5'
                          }`}
                        >
                          {c.label}
                        </div>
                      ))}
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isRecurring"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-2xl border border-white/5 bg-background/30 p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base text-foreground/80 cursor-pointer">反复出现的梦？</FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-[2] bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 hover:text-primary rounded-2xl h-12"
                onClick={handleAiOrganize}
                disabled={organizeDream.isPending}
              >
                {organizeDream.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                让{activeCharacter?.name || "AI"}帮我分析
              </Button>
              <Button 
                type="submit" 
                className="flex-[3] rounded-2xl h-12 shadow-lg shadow-primary/20"
                disabled={createDream.isPending || organizeDream.isPending}
              >
                {createDream.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                保存梦境
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
