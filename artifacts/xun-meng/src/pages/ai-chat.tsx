import { useState, useRef, useEffect } from "react";
import { useAiChat, useListDreams } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Send, Sparkles, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function AiChat() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialDreamId = searchParams.get("dreamId");
  
  const { data: dreams } = useListDreams();
  const chatMutation = useAiChat();
  
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "你好，我是你的解梦者。告诉我你梦到了什么，或者你对某个梦有什么疑惑？" }
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // If launched with a dreamId, auto-inject context
  const dreamContext = initialDreamId && dreams ? 
    dreams.find(d => d.id === initialDreamId)?.content : null;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input.trim();
    setInput("");
    
    const newMessages: Message[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);

    try {
      const res = await chatMutation.mutateAsync({
        data: {
          message: userMsg,
          history: messages,
          dreamContext: dreamContext || undefined
        }
      });
      
      setMessages([...newMessages, { role: "assistant", content: res.reply }]);
    } catch (error) {
      setMessages([...newMessages, { role: "assistant", content: "抱歉，我现在无法连接到星空，请稍后再试。" }]);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <header className="flex items-center gap-2 pb-4">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
          <Sparkles size={20} />
        </div>
        <div>
          <h1 className="font-serif text-lg text-foreground">解梦者</h1>
          <p className="text-xs text-muted-foreground">AI 梦境观察者</p>
        </div>
      </header>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-4 pb-4 pr-2 scrollbar-thin"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div 
                className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                  msg.role === "user" 
                    ? "bg-primary text-primary-foreground rounded-br-none" 
                    : "glass-panel bg-card/40 rounded-bl-none text-foreground/90"
                }`}
              >
                {msg.content}
              </div>
            </motion.div>
          ))}
          {chatMutation.isPending && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="glass-panel bg-card/40 rounded-2xl rounded-bl-none p-4 flex items-center gap-2 text-muted-foreground">
                <Loader2 size={16} className="animate-spin" /> 正在感应...
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="pt-2">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="relative flex items-center"
        >
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="说点什么..."
            className="w-full rounded-full bg-card/50 border-border/50 pr-12 h-12 glass-panel"
            disabled={chatMutation.isPending}
          />
          <Button 
            type="submit" 
            size="icon" 
            className="absolute right-1 w-10 h-10 rounded-full"
            disabled={!input.trim() || chatMutation.isPending}
          >
            <Send size={18} />
          </Button>
        </form>
      </div>
    </div>
  );
}
