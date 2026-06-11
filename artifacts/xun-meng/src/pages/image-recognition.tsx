import { useState, useRef } from "react";
import { useAiRecognizeImage, useCreateDream, getListDreamsQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, Loader2, Save, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

export default function ImageRecognition() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const recognizeMutation = useAiRecognizeImage();
  const createDreamMutation = useCreateDream();
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setResult(null); 
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRecognize = async () => {
    if (!imagePreview) return;

    // Extract base64 without prefix
    const base64Data = imagePreview.split(',')[1];
    const mimeType = imageFile?.type || "image/jpeg";

    try {
      const res = await recognizeMutation.mutateAsync({
        data: { imageBase64: base64Data, mimeType }
      });
      setResult(res);
      if (res.isMock) {
        toast({ title: "提示", description: "使用模拟数据，请在设置中配置真实API" });
      } else {
        toast({ title: "感应完成" });
      }
    } catch (error) {
      toast({ title: "感应失败", description: "无法处理此图像", variant: "destructive" });
    }
  };

  const handleSaveAsDream = async () => {
    if (!result) return;
    
    try {
      const dream = await createDreamMutation.mutateAsync({
        data: {
          title: result.suggestedTitle || "图像梦境",
          content: result.draftContent || result.description,
          mood: "strange",
          clarity: "vivid",
          isRecurring: false,
          imageUrl: imagePreview || undefined
        }
      });
      queryClient.invalidateQueries({ queryKey: getListDreamsQueryKey() });
      toast({ title: "已保存为梦境" });
      setLocation(`/dream/${dream.id}`);
    } catch (error) {
      toast({ title: "保存失败", description: String(error), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 pt-6 pb-20 animate-in fade-in">
      <header>
        <h1 className="text-2xl font-serif text-white/90">感应意象</h1>
        <p className="text-sm text-muted-foreground mt-1">上传图片，AI 将为你提炼梦境碎片</p>
      </header>

      <div className="glass-panel p-5 sm:p-6 rounded-3xl space-y-6">
        <div 
          className={`border border-dashed rounded-3xl p-8 text-center transition-all ${
            imagePreview ? 'border-primary/30 bg-primary/5' : 'border-white/20 hover:border-primary/50 hover:bg-card/40 cursor-pointer'
          }`}
          onClick={() => !imagePreview && fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleImageChange}
          />
          
          {imagePreview ? (
            <div className="space-y-4 relative">
              <img src={imagePreview} alt="Preview" className="max-h-64 mx-auto rounded-2xl shadow-xl shadow-black/50" />
              <div className="absolute -top-4 -right-4">
                <Button 
                  size="sm" 
                  variant="secondary" 
                  className="rounded-full shadow-md bg-background/80 backdrop-blur-sm border border-white/10 text-xs px-4 py-1 h-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImagePreview(null);
                    setImageFile(null);
                    setResult(null);
                  }}
                >
                  更换
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-6">
              <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-muted-foreground">
                <Upload size={28} />
              </div>
              <div className="text-sm tracking-widest text-muted-foreground/80">点击上传图片</div>
            </div>
          )}
        </div>

        {imagePreview && !result && (
          <Button 
            className="w-full py-6 text-base rounded-full shadow-lg shadow-primary/20" 
            onClick={handleRecognize}
            disabled={recognizeMutation.isPending}
          >
            {recognizeMutation.isPending ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> 正在感应图片中的意象...</>
            ) : (
              <><ScanFace className="mr-2 h-5 w-5" /> 感应图片</>
            )}
          </Button>
        )}

        {result && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5 pt-4 border-t border-white/10"
          >
            <h3 className="font-serif text-lg text-primary text-center pb-2">感应结果</h3>
            
            <div className="space-y-3">
              <div className="bg-card/20 border border-white/5 p-4 rounded-2xl">
                <div className="text-xs text-muted-foreground mb-1 uppercase tracking-widest">建议名称</div>
                <div className="font-serif text-lg text-foreground/90">{result.suggestedTitle}</div>
              </div>
              
              {result.dreamElements && result.dreamElements.length > 0 && (
                <div className="bg-card/20 border border-white/5 p-4 rounded-2xl">
                  <div className="text-xs text-muted-foreground mb-3 uppercase tracking-widest">提取元素</div>
                  <div className="flex flex-wrap gap-2">
                    {result.dreamElements.map((el: string) => (
                      <span key={el} className="text-xs px-3 py-1.5 rounded-full bg-secondary/10 text-secondary border border-secondary/20">
                        {el}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="bg-card/20 border border-white/5 p-4 rounded-2xl">
                <div className="text-xs text-muted-foreground mb-2 uppercase tracking-widest">梦境转译</div>
                <div className="text-sm text-foreground/80 leading-relaxed">{result.draftContent}</div>
              </div>
            </div>

            <Button 
              className="w-full rounded-full py-6 mt-6 shadow-lg shadow-primary/20" 
              onClick={handleSaveAsDream}
              disabled={createDreamMutation.isPending}
            >
              {createDreamMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
              一键保存为梦境
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
