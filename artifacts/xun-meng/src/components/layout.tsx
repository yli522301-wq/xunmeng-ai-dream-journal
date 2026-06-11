import React from "react";
import { Link, useLocation } from "wouter";
import { Moon, Plus, MessageCircle, Image as ImageIcon, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: Moon, label: "记梦" },
    { href: "/chat", icon: MessageCircle, label: "对话" },
    { href: "/image", icon: ImageIcon, label: "识图" },
    { href: "/settings", icon: Settings, label: "设置" },
  ];

  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col relative overflow-hidden dark">
      {/* Ambient background glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/10 blur-[100px] pointer-events-none" />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pt-6 pb-24 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating Navigation */}
      <div className="fixed bottom-6 left-0 w-full flex justify-center z-50 pointer-events-none px-4">
        <nav className="glass-panel rounded-full px-6 py-3 flex items-center gap-8 pointer-events-auto">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 group relative">
                <div className={`p-2 rounded-full transition-colors ${isActive ? 'bg-primary/20 text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
                  <Icon size={20} />
                </div>
                {isActive && (
                  <motion.div 
                    layoutId="nav-indicator" 
                    className="absolute -bottom-2 w-1 h-1 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Floating Action Button (New Dream) */}
      {location === "/" && (
        <Link href="/new" className="fixed bottom-24 right-6 sm:right-[calc(50%-20rem+1.5rem)] z-40 bg-primary text-primary-foreground p-4 rounded-full shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-105 transition-all">
          <Plus size={24} />
        </Link>
      )}
    </div>
  );
}
