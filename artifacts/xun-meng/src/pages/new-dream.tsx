import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateDream, useAiOrganizeDream, getListDreamsQueryKey, getGetDreamStatsQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Mic, Loader2, Save } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const MOODS = [
  { value: "calm", label: "平静" },
  { value: "anxious", label: "焦虑" },
  { value: "happy", label: "开心" },
  { value: "fearful", label: "恐惧" },
  { value: "confused", label: "迷茫" },
  { value: "nostalgic", label: "怀念" },
  { value: "strange", label: "奇怪" }
] as const;

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
      const res = await organizeDream.mutateAsync({ data: { content, title: form.getValues("title") } });
      if (res.isMock) {
        toast({ title: "提示", description: "使用模拟数据，请在设置中配置真实API" });
      } else {
        toast({ title: "分析完成", description: "AI已经为您梳理了梦境" });
      }
      if (res.summary) {
        form.setValue("content", res.summary); // Use summary as updated content, or perhaps user wants to keep original? Let's just update for demo
      }
    } catch (error) {
      toast({ title: "分析失败", description: String(error), variant: "destructive" });
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const result = await createDream.mutateAsync({ data: values });
      queryClient.invalidateQueries({ queryKey: getListDreamsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDreamStatsQueryKey() });
      toast({ title: "梦境已保存" });
      setLocation(`/dream/${result.id}`);
    } catch (error) {
      toast({ title: "保存失败", description: String(error), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h1 className="text-2xl font-serif text-white/90">捕获梦境</h1>
        <p className="text-sm text-muted-foreground mt-1">趁着记忆还没有消散</p>
      </header>

      <div className="glass-panel p-6 rounded-3xl">
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
                      className="text-xl bg-transparent border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none" 
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
                      <Textarea 
                        placeholder="那是一个怎样的梦..." 
                        className="min-h-[200px] resize-none bg-background/50 border-border/50 rounded-xl"
                        {...field} 
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className={`absolute bottom-3 right-3 rounded-full ${isListening ? 'bg-primary text-white animate-pulse' : 'bg-background/80 text-muted-foreground'}`}
                        onClick={toggleVoice}
                      >
                        <Mic size={18} />
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="mood"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">主要情绪</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background/50 border-border/50">
                          <SelectValue placeholder="选择情绪" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MOODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="clarity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">清晰度</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background/50 border-border/50">
                          <SelectValue placeholder="选择清晰度" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CLARITY.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isRecurring"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border/50 bg-background/30 p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base text-foreground/80">反复出现的梦？</FormLabel>
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
                className="flex-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 hover:text-primary"
                onClick={handleAiOrganize}
                disabled={organizeDream.isPending}
              >
                {organizeDream.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                AI 整理
              </Button>
              <Button 
                type="submit" 
                className="flex-1"
                disabled={createDream.isPending}
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
