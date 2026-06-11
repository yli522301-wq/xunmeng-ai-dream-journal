import { useState, useRef, useEffect } from "react";
import { useAiChat, useGetChatHistory, getGetChatHistoryQueryKey, useGetActiveCharacter, getGetActiveCharacterQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Send, Mic, Volume2, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { CompanionOrb } from "@/components/companion-orb";
import { useToast } from "@/hooks/use-toast";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function AiChat() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const dreamContext = searchParams.get("dreamContext") || undefined;
  const { toast } = useToast();

  const { data: activeCharacter } = useGetActiveCharacter({
    query: { queryKey: getGetActiveCharacterQueryKey() }
  });

  const { data: history } = useGetChatHistory(
    { characterId: activeCharacter?.id },
    { query: { enabled: !!activeCharacter?.id, queryKey: getGetChatHistoryQueryKey({ characterId: activeCharacter?.id }) } }
  );

  const chatMutation = useAiChat();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isListening, setIsListening] = useState(false);
  
  const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition = useRef<any>(null);

  useEffect(() => {
    if (history && messages.length === 0) {
      setMessages(history.map(h => ({ role: h.role, content: h.content })));
    }
  }, [history]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, chatMutation.isPending]);

  useEffect(() => {
    if (SpeechRecognition) {
      recognition.current = new SpeechRecognition();
      recognition.current.continuous = false;
      recognition.current.interimResults = false;
      recognition.current.lang = activeCharacter?.language === 'en' ? 'en-US' : 'zh-CN';

      recognition.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + transcript);
        setIsListening(false);
      };

      recognition.current.onerror = () => {
        setIsListening(false);
      };
      recognition.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [SpeechRecognition, activeCharacter]);

  const toggleVoice = () => {
    if (!SpeechRecognition) {
      toast({ title: "不支持语音输入", variant: "destructive" });
      return;
    }
    if (isListening) {
      recognition.current?.stop();
    } else {
      recognition.current?.start();
      setIsListening(true);
    }
  };

  const playVoice = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = activeCharacter?.language === 'en' ? 'en-US' : 'zh-CN';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async () => {
    if (!input.trim() || !activeCharacter) return;
    
    const userMsg = input.trim();
    setInput("");
    
    const newMessages: Message[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);

    try {
      const res = await chatMutation.mutateAsync({
        data: {
          message: userMsg,
          history: messages.slice(-20),
          characterSystemPrompt: activeCharacter.systemPrompt,
          dreamContext
        }
      });
      
      setMessages(prev => [...prev, { role: "assistant", content: res.reply }]);
    } catch (error) {
      toast({ title: "发送失败", variant: "destructive" });
    }
  };

  if (!activeCharacter) {
    return <div className="p-8 text-center text-muted-foreground">需要先选择一个陪伴者</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-20px)] max-h-[100dvh] pt-4">
      <header className="flex items-center gap-3 pb-4 border-b border-white/5 shrink-0 px-2">
        <Button variant="ghost" size="icon" className="rounded-full shrink-0" onClick={() => setLocation("/")}>
          <ArrowLeft size={20} />
        </Button>
        <CompanionOrb size="xs" isSpeaking={chatMutation.isPending} />
        <div className="flex-1">
          <h1 className="font-serif text-lg text-foreground leading-tight">{activeCharacter.name}</h1>
          <p className="text-xs text-muted-foreground">{chatMutation.isPending ? "正在思考..." : activeCharacter.role}</p>
        </div>
      </header>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-6 py-6 px-2 scrollbar-none"
      >
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-10">
            和 {activeCharacter.name} 打个招呼吧
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start gap-2"}`}
            >
              {msg.role === "assistant" && (
                <div className="shrink-0 mt-1">
                  <CompanionOrb size="xs" />
                </div>
              )}
              <div 
                className={`max-w-[80%] rounded-2xl p-3.5 text-sm leading-relaxed ${
                  msg.role === "user" 
                    ? "bg-primary/90 text-primary-foreground rounded-br-sm shadow-sm" 
                    : "glass-panel bg-card/40 rounded-bl-sm text-foreground/90"
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
              className="flex justify-start gap-2"
            >
              <div className="shrink-0 mt-1">
                <CompanionOrb size="xs" isSpeaking />
              </div>
              <div className="glass-panel bg-card/40 rounded-2xl rounded-bl-sm p-4 flex items-center gap-1.5 text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="pt-2 pb-6 px-2 shrink-0">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="relative flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`和 ${activeCharacter.name} 说点什么...`}
              className="w-full rounded-full bg-card/60 border-white/10 pl-4 pr-20 h-12 glass-panel shadow-inner"
              disabled={chatMutation.isPending}
            />
            <div className="absolute right-1 top-1 flex items-center">
              {messages.length > 0 && messages[messages.length-1].role === 'assistant' && (
                <Button 
                  type="button" 
                  size="icon" 
                  variant="ghost"
                  className="w-10 h-10 rounded-full text-muted-foreground hover:text-primary"
                  onClick={() => playVoice(messages[messages.length-1].content)}
                >
                  <Volume2 size={18} />
                </Button>
              )}
              <Button 
                type="button" 
                size="icon" 
                variant="ghost"
                className={`w-10 h-10 rounded-full ${isListening ? 'text-primary animate-pulse' : 'text-muted-foreground hover:text-primary'}`}
                onClick={toggleVoice}
              >
                <Mic size={18} />
              </Button>
            </div>
          </div>
          <Button 
            type="submit" 
            size="icon" 
            className="shrink-0 w-12 h-12 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
            disabled={!input.trim() || chatMutation.isPending}
          >
            <Send size={18} className="ml-1" />
          </Button>
        </form>
      </div>
    </div>
  );
}
