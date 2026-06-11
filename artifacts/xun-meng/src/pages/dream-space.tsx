import { useState, useRef, useEffect } from "react";
import { useGetActiveCharacter, useListCharacters, useActivateCharacter, useGetAiSettings, useAiChat, useCreateDream, useAiRecognizeImage } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Mic, Square, Image as ImageIcon, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CompanionOrb, CompanionColor } from "@/components/companion-orb";
import { AudioWaveform } from "@/components/audio-waveform";

const CHIP_POOL = [
  "我梦见深夜下雨", "一扇沉重的铁制大门", "感觉自己在悬浮飞行", "小时候的自己在招手",
  "一条没有尽头的走廊", "镜子里的我在哭", "被一种光追着跑", "一片很安静的海",
  "站在楼顶往下看", "一个陌生又熟悉的声音", "找不到回家的路", "梦见一个已经离开的人"
];

function getRandomChips(count: number) {
  const shuffled = [...CHIP_POOL].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

export default function DreamSpace() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: activeChar, refetch: refetchActive } = useGetActiveCharacter();
  const { data: characters } = useListCharacters();
  const { data: settings } = useGetAiSettings();
  const activateMutation = useActivateCharacter();
  const chatMutation = useAiChat();
  const createDreamMutation = useCreateDream();
  const recognizeMutation = useAiRecognizeImage();

  const [currentResponse, setCurrentResponse] = useState<{sceneDesc: string; reply: string; time: string} | null>(null);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<{role:'user'|'assistant', content:string}[]>([]);
  const [chips, setChips] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition = useRef<any>(null);

  useEffect(() => {
    setChips(getRandomChips(4));
  }, []);

  useEffect(() => {
    if (SpeechRecognition) {
      recognition.current = new SpeechRecognition();
      recognition.current.continuous = false;
      recognition.current.interimResults = false;

      recognition.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(prev => prev + transcript);
        setIsListening(false);
        // Auto send after tiny delay if we have text
        setTimeout(() => {
          handleSend(transcript);
        }, 500);
      };

      recognition.current.onerror = () => setIsListening(false);
      recognition.current.onend = () => setIsListening(false);
    }
  }, [SpeechRecognition, activeChar]);

  const getColorForChar = (name: string): CompanionColor => {
    if (name.includes("阿暖")) return "amber";
    if (name.includes("暮歌")) return "indigo";
    if (name.includes("岛深")) return "teal";
    return "purple";
  };

  const getPrefixForChar = (name: string) => {
    if (name.includes("阿暖")) return "●";
    if (name.includes("暮歌")) return "☽";
    if (name.includes("岛深")) return "✦";
    return "●";
  };

  const getEnglishName = (name: string) => {
    if (name.includes("阿暖")) return "Anuan";
    if (name.includes("暮歌")) return "Muge";
    if (name.includes("岛深")) return "Daoshan";
    return "";
  };

  const getQuoteForChar = (name: string) => {
    if (name.includes("阿暖")) return "「正在静静聆听风吹松针的温度」";
    if (name.includes("暮歌")) return "「月光在等你告诉它你刚醒来看见了什么」";
    if (name.includes("岛深")) return "「已准备好为你梳理那些混沌的线索」";
    return "「正在等你说梦...」";
  };

  const generateSceneDesc = (name: string) => {
    if (name.includes("阿暖")) {
      const descs = ["（阿暖为你翻开梦之手记，浮起一抹鹅黄暖光）", "（阿暖轻轻拉开椅子，在你对面坐下）", "（阿暖把手心覆在你说的那个梦上面）"];
      return descs[Math.floor(Math.random() * descs.length)];
    }
    if (name.includes("暮歌")) {
      const descs = ["（暮歌在月光里抬起眼睛，看向你）", "（暮歌翻开一页没有字的纸，等你说）", "（暮歌轻声说，我听见了）"];
      return descs[Math.floor(Math.random() * descs.length)];
    }
    if (name.includes("岛深")) {
      const descs = ["（岛深打开记录，开始梳理你说的线索）", "（岛深抬头，把你说的话复述了一遍）", "（岛深沉默了一下，然后说）"];
      return descs[Math.floor(Math.random() * descs.length)];
    }
    return "（陪伴者正在倾听你的梦境）";
  };

  const handleTabClick = async (id: string) => {
    if (activeChar?.id === id) return;
    await activateMutation.mutateAsync({ id });
    refetchActive();
    setCurrentResponse(null);
    setConversationHistory([]);
  };

  const playVoice = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = activeChar?.language === 'en' ? 'en-US' : 'zh-CN';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async (textToUse?: string) => {
    const text = textToUse || inputText;
    if (!text.trim() || !activeChar) return;
    
    setInputText("");
    setIsThinking(true);
    
    const newHistory = [...conversationHistory, { role: "user" as const, content: text }];
    setConversationHistory(newHistory);

    try {
      const res = await chatMutation.mutateAsync({
        data: {
          message: text,
          history: newHistory.slice(-10),
          characterSystemPrompt: activeChar.systemPrompt,
        }
      });
      
      setConversationHistory(prev => [...prev, { role: "assistant", content: res.reply }]);
      
      const now = new Date();
      setCurrentResponse({
        sceneDesc: generateSceneDesc(activeChar.name),
        reply: res.reply,
        time: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
      });
      
      playVoice(res.reply);
    } catch (error) {
      toast({ title: "感应失败，请重试", variant: "destructive" });
    } finally {
      setIsThinking(false);
    }
  };

  const toggleMic = () => {
    if (!SpeechRecognition) {
      toast({ title: "不支持语音输入", variant: "destructive" });
      return;
    }
    if (isListening) {
      recognition.current?.stop();
    } else {
      if (activeChar) {
        recognition.current.lang = activeChar.language === 'en' ? 'en-US' : 'zh-CN';
      }
      recognition.current?.start();
      setIsListening(true);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChar) return;

    setIsThinking(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const base64 = dataUrl.split(',')[1];
      const mimeType = file.type || 'image/jpeg';
      try {
        const res = await recognizeMutation.mutateAsync({
          data: {
            imageBase64: base64,
            mimeType,
          }
        });
        
        const replyText = `${res.description}\n\n${res.draftContent}`;
        setConversationHistory(prev => [
          ...prev, 
          { role: "user", content: "[上传了一张图片]" },
          { role: "assistant", content: replyText }
        ]);
        
        const now = new Date();
        setCurrentResponse({
          sceneDesc: "（AI正在感应图片中的梦境元素）",
          reply: replyText,
          time: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
        });
        playVoice(replyText);
      } catch (err) {
        toast({ title: "图片感应失败", variant: "destructive" });
      } finally {
        setIsThinking(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveDream = async () => {
    if (!activeChar || conversationHistory.length === 0) {
      toast({ title: "还没有梦境内容可以保存" });
      return;
    }

    const firstUserMsg = conversationHistory.find(m => m.role === 'user')?.content || "未命名的梦";
    const title = firstUserMsg.slice(0, 15) + (firstUserMsg.length > 15 ? "..." : "");
    const content = conversationHistory.map(m => `[${m.role === 'user' ? '你' : activeChar.name}] ${m.content}`).join('\n\n');

    try {
      await createDreamMutation.mutateAsync({
        data: {
          title,
          content,
          mood: "calm",
          clarity: "moderate",
          isRecurring: false,
          companionReply: currentResponse?.reply,
          characterId: activeChar.id
        }
      });
      toast({ title: "已保存到梦境手账" });
    } catch (err) {
      toast({ title: "保存失败", variant: "destructive" });
    }
  };

  if (!activeChar && characters && characters.length > 0) {
    // If no active char but chars exist, might be loading still or need selection
    return <div className="min-h-screen bg-[#0A0A1A] text-white flex items-center justify-center">Loading...</div>;
  }

  if (!activeChar && characters && characters.length === 0) {
    return (
      <div className="min-h-screen bg-[#0A0A1A] text-white flex flex-col items-center justify-center space-y-6">
        <p>还没有陪伴者</p>
        <Link href="/characters/new" className="px-6 py-2 bg-primary/20 text-primary rounded-full">创建角色</Link>
      </div>
    );
  }

  const charColor = activeChar ? getColorForChar(activeChar.name) : "purple";

  return (
    <div className="flex-1 flex flex-col items-center justify-between w-full h-full relative z-10 px-4 pt-4 pb-8 overflow-hidden bg-[#05050A]">
      {/* Top Bar */}
      <header className="w-full flex items-center justify-between py-3 px-4 glass-panel rounded-2xl border border-white/5 backdrop-blur-md sticky top-4 z-50">
        <div className="flex items-center gap-4">
          <Link href="/dreams" className="text-white/60 hover:text-white/90">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex flex-col hidden sm:flex">
            <span className="text-xs font-serif tracking-widest text-white/80">DREAM SPACE / 巡梦进行中</span>
            <span className="text-[10px] text-green-400/80 flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              {settings?.hasApiKey ? "已连接 API" : "Demo 模拟模式"}
            </span>
          </div>
        </div>

        <div className="flex gap-2 p-1 bg-white/5 rounded-full">
          {characters?.map(c => (
            <button
              key={c.id}
              onClick={() => handleTabClick(c.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeChar?.id === c.id 
                  ? 'bg-white/10 text-white shadow-sm' 
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {getPrefixForChar(c.name)} {c.name.replace(/[a-zA-Z\s]/g, '')}
            </button>
          ))}
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleSaveDream}
          className="border-white/20 text-white/80 hover:bg-white/10 hover:text-white bg-transparent rounded-full h-9 px-4 hidden sm:flex"
        >
          ✦ 保存梦手账
        </Button>
      </header>

      {/* Center Soul Area */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl mt-8 sm:mt-0 relative z-20">
        {activeChar && (
          <div className="flex flex-col items-center gap-6">
            <CompanionOrb 
              size="lg" 
              color={charColor} 
              isSpeaking={!!currentResponse && !isThinking} 
              isThinking={isThinking} 
            />
            
            <div className="text-center space-y-2 mt-4">
              <h2 className="text-2xl font-serif text-white tracking-wide flex items-center justify-center gap-2">
                {activeChar.name.replace(/[a-zA-Z]/g, '').trim()} <span className="font-sans text-xl opacity-60">{getEnglishName(activeChar.name)}</span>
                <motion.div 
                  className={`w-2 h-2 rounded-full`}
                  style={{ backgroundColor: `hsl(${charColor === 'amber' ? '38 90% 60%' : charColor === 'indigo' ? '240 70% 65%' : charColor === 'teal' ? '185 70% 55%' : 'var(--primary)'})` }}
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </h2>
              <p className="text-sm italic" style={{ color: 'hsl(280 30% 65%)' }}>
                {getQuoteForChar(activeChar.name)}
              </p>
            </div>

            <div className="mt-4">
              <AudioWaveform 
                isActive={!!currentResponse} 
                isListening={isListening} 
                isThinking={isThinking} 
                color={charColor} 
              />
            </div>
          </div>
        )}

        {/* Response Card Area */}
        <div className="w-full mt-10 min-h-[160px] flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            {!currentResponse && !isThinking ? (
              <motion.div 
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-white/30 text-sm tracking-widest"
              >
                正在等你说梦...
              </motion.div>
            ) : currentResponse ? (
              <motion.div
                key="response"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 backdrop-blur-md text-center flex flex-col items-center gap-4 shadow-xl"
              >
                <p className="text-xs text-white/50 italic">{currentResponse.sceneDesc}</p>
                <p className="text-base text-white/90 leading-relaxed max-w-lg whitespace-pre-wrap">
                  {currentResponse.reply}
                </p>
                <p className="text-[10px] text-white/30 tracking-widest uppercase">
                  COMPANION RESPONSE • {currentResponse.time}
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Chips */}
        <div className="flex flex-wrap justify-center gap-2 mt-8 max-w-lg">
          {chips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(chip)}
              className="px-4 py-2 rounded-full border border-white/10 bg-transparent text-xs text-white/50 hover:text-white/80 hover:border-white/30 transition-all hover:shadow-[0_0_10px_rgba(255,255,255,0.1)]"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Input Area */}
      <div className="w-full max-w-2xl glass-panel rounded-3xl p-4 mt-8 backdrop-blur-xl border border-white/10 relative z-30">
        {isListening && (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs text-white/60 animate-pulse">
            正在聆听...
          </div>
        )}
        
        <div className="flex items-center justify-between gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className={`w-10 h-10 rounded-full shrink-0 transition-opacity ${inputText.trim() ? 'opacity-100 text-white' : 'opacity-0 pointer-events-none'}`}
            onClick={() => handleSend()}
          >
            <Send size={18} />
          </Button>

          <button
            onClick={toggleMic}
            className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 transition-all shadow-lg"
            style={{ 
              backgroundColor: `hsl(${charColor === 'amber' ? '38 90% 60%' : charColor === 'indigo' ? '240 70% 65%' : charColor === 'teal' ? '185 70% 55%' : 'var(--primary)'} / ${isListening ? 1 : 0.2})`,
              boxShadow: isListening ? `0 0 30px hsl(${charColor === 'amber' ? '38 90% 60%' : charColor === 'indigo' ? '240 70% 65%' : charColor === 'teal' ? '185 70% 55%' : 'var(--primary)'} / 0.5)` : 'none',
              color: isListening ? '#fff' : `hsl(${charColor === 'amber' ? '38 90% 60%' : charColor === 'indigo' ? '240 70% 65%' : charColor === 'teal' ? '185 70% 55%' : 'var(--primary)'})`
            }}
          >
            {isListening ? <Square size={24} className="fill-current" /> : <Mic size={28} />}
          </button>

          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleImageUpload}
          />
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-10 h-10 rounded-full shrink-0 text-white/50 hover:text-white/90"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon size={20} />
          </Button>
        </div>

        <div className="mt-4 px-4">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="也可以输入一句话…说一个刚醒来还没散掉的梦"
            className="w-full bg-transparent border-b border-white/10 pb-2 text-center text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors"
          />
        </div>
      </div>
    </div>
  );
}
