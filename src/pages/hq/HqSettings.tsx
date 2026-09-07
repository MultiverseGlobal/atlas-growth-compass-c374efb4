import { useState, useEffect } from "react";
import { 
  Database, RefreshCw, CheckCircle2, AlertTriangle, 
  Settings, Loader2, Link2, Info, Palette, Compass, Moon, Sun, SlidersHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIntegrations } from "@/hooks/useIntegrations";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTheme } from "@/hooks/useTheme";
import { useNavigate } from "react-router-dom";

export default function HqSettings() {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="p-6 pt-[120px] md:p-8 md:pt-[120px] bg-background min-h-screen text-foreground overflow-hidden flex flex-col items-center">
      <div className="w-full max-w-5xl space-y-8">
        <div className="border-b border-border/60 pb-5 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display flex items-center gap-3">
              <Settings className="h-8 w-8 text-foreground" />
              Settings
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure visual preferences and portal context transition settings.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8">
          <div className="space-y-8">
            {/* Theme Preference Settings */}
            <div className="rounded-xl border border-border/60 bg-card p-6 space-y-6 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-foreground/5 flex items-center justify-center border border-border/60">
                  <Palette className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">HQ Console Theme Preference</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Select a personalized aesthetic style for your administration dashboard.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                {[
                  { 
                    id: "clean", 
                    name: "Clean Light", 
                    desc: "Minimalist, sleek, light theme.", 
                    icon: Sun 
                  },
                  { 
                    id: "paper", 
                    name: "Paper Sepia", 
                    desc: "Nordic warm parchment theme.", 
                    icon: Palette 
                  },
                  { 
                    id: "dark", 
                    name: "Midnight Dark", 
                    desc: "Carbon theme with glow highlights.", 
                    icon: Moon 
                  }
                ].map((t) => {
                  const isActive = theme === t.id;
                  const IconComponent = t.icon;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setTheme(t.id as any)}
                      className={`cursor-pointer rounded-lg border p-4 transition-all hover:border-primary/50 relative ${
                        isActive 
                          ? "border-primary bg-primary/[0.02] shadow-[0_0_12px_rgba(var(--primary),0.05)]" 
                          : "border-border/60 bg-card/50"
                      }`}
                    >
                      {isActive && (
                        <span className="absolute top-2 right-2 text-[8px] font-mono uppercase bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                      <IconComponent className={`h-4.5 w-4.5 mb-2.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="text-xs font-semibold text-foreground">{t.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-1 leading-normal">{t.desc}</div>
import { useState, useEffect } from "react";
import { 
  Database, RefreshCw, CheckCircle2, AlertTriangle, 
  Settings, Loader2, Link2, Info, Palette, Compass, Moon, Sun, SlidersHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIntegrations } from "@/hooks/useIntegrations";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTheme } from "@/hooks/useTheme";
import { useNavigate } from "react-router-dom";

export default function HqSettings() {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="p-6 pt-[120px] md:p-8 md:pt-[120px] bg-background min-h-screen text-foreground overflow-hidden flex flex-col items-center">
      <div className="w-full max-w-5xl space-y-8">
        <div className="border-b border-border/60 pb-5 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display flex items-center gap-3">
              <Settings className="h-8 w-8 text-foreground" />
              Settings
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure visual preferences and portal context transition settings.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8">
          <div className="space-y-8">
            {/* Theme Preference Settings */}
            <div className="rounded-xl border border-border/60 bg-card p-6 space-y-6 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-foreground/5 flex items-center justify-center border border-border/60">
                  <Palette className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">HQ Console Theme Preference</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Select a personalized aesthetic style for your administration dashboard.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                {[
                  { 
                    id: "clean", 
                    name: "Clean Light", 
                    desc: "Minimalist, sleek, light theme.", 
                    icon: Sun 
                  },
                  { 
                    id: "paper", 
                    name: "Paper Sepia", 
                    desc: "Nordic warm parchment theme.", 
                    icon: Palette 
                  },
                  { 
                    id: "dark", 
                    name: "Midnight Dark", 
                    desc: "Carbon theme with glow highlights.", 
                    icon: Moon 
                  }
                ].map((t) => {
                  const isActive = theme === t.id;
                  const IconComponent = t.icon;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setTheme(t.id as any)}
                      className={`cursor-pointer rounded-lg border p-4 transition-all hover:border-primary/50 relative ${
                        isActive 
                          ? "border-primary bg-primary/[0.02] shadow-[0_0_12px_rgba(var(--primary),0.05)]" 
                          : "border-border/60 bg-card/50"
                      }`}
                    >
                      {isActive && (
                        <span className="absolute top-2 right-2 text-[8px] font-mono uppercase bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                      <IconComponent className={`h-4.5 w-4.5 mb-2.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="text-xs font-semibold text-foreground">{t.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-1 leading-normal">{t.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
