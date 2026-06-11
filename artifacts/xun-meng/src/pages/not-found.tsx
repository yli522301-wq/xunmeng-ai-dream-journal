import { FileQuestion } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-4">
      <div className="glass-panel p-8 rounded-full mb-6">
        <FileQuestion size={48} className="text-primary/50" />
      </div>
      <h1 className="text-2xl font-serif mb-2 text-foreground">迷失在梦境深处</h1>
      <p className="text-muted-foreground mb-8 text-sm">你寻找的页面似乎不存在，或者已经醒来。</p>
      <Link href="/">
        <Button className="rounded-full px-8 bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20">
          返回现实
        </Button>
      </Link>
    </div>
  );
}
