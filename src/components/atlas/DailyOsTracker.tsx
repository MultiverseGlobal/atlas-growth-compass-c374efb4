import { useState, useEffect } from "react";
import { CheckCircle2, Circle, Target, Users, MessageSquare, Video, ArrowRight, Zap, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface TouchTarget {
  id: string;
  category: "Direct" | "Partner" | "LinkedIn" | "Proof";
  label: string;
  current: number;
  target: number;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

export function DailyOsTracker() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<{ direct: number; partner: number; linkedin: number; proof: number }>({ direct: 0, partner: 0, linkedin: 0, proof: 0 });
  const [recordId, setRecordId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchToday = async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from("founder_execution_loop")
        .select("id, metrics")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

      if (data) {
        setRecordId(data.id);
        if (data.metrics) {
          setCounts(data.metrics as any);
        }
      } else {
        const defaultMetrics = { direct: 0, partner: 0, linkedin: 0, proof: 0 };
        const { data: newData } = await supabase
          .from("founder_execution_loop")
          .insert({
            user_id: user.id,
            date: today,
            metrics: defaultMetrics
          })
          .select("id")
          .single();
        
        if (newData) {
          setRecordId(newData.id);
          setCounts(defaultMetrics);
        }
      }
    };
    fetchToday();
  }, [user]);

  const increment = async (key: "direct" | "partner" | "linkedin" | "proof") => {
    const nextCounts = { ...counts, [key]: counts[key] + 1 };
    setCounts(nextCounts);
    toast.success(`Logged touch in Daily OS!`);

    if (recordId) {
      await supabase
        .from("founder_execution_loop")
        .update({ metrics: nextCounts })
        .eq("id", recordId);
    }
  };

  const totalTouches = counts.direct + counts.partner + counts.linkedin + counts.proof;
  const targetTotal = 22;
  const progressPct = Math.min(100, Math.round((totalTouches / targetTotal) * 100));

  const touches: TouchTarget[] = [
    {
      id: "direct",
      category: "Direct",
      label: "High-Signal Prospects",
      current: counts.direct,
      target: 10,
      icon: Target,
      description: "Targeted outreach to agencies showing operational/tech bottlenecks."
    },
    {
      id: "partner",
      category: "Partner",
      label: "Complementary Partners",
      current: counts.partner,
      target: 5,
      icon: Users,
      description: "Engage web/SEO agencies & RevOps consultants as their implementation layer."
    },
    {
      id: "linkedin",
      category: "LinkedIn",
      label: "Meaningful Interactions",
      current: counts.linkedin,
      target: 5,
      icon: MessageSquare,
      description: "Observe → Engage → Diagnose: Problem-specific discussions on LinkedIn."
    },
    {
      id: "proof",
      category: "Proof",
      label: "Diagnostic Assets",
      current: counts.proof,
      target: 2,
      icon: Video,
      description: "3-minute workflow teardown videos & operational gap maps."
    }
  ];

  return (
    <div className="rounded-xl border border-border/70 bg-[#0F1117]/80 backdrop-blur-sm p-4 space-y-3.5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-white tracking-wide uppercase">Daily Acquisition OS</h3>
              <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                22 Touches Focus
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Measuring real conversations and diagnostic opportunities, not mass cold emails.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <span className="text-xs font-mono font-semibold text-white">
            {totalTouches} / {targetTotal} Touches
          </span>
          <span className="text-xs font-mono font-bold text-primary">
            ({progressPct}%)
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 via-primary to-sky-400 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* 4 Touch Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
        {touches.map((item) => {
          const Icon = item.icon;
          const isDone = item.current >= item.target;
          return (
            <div
              key={item.id}
              className={`p-2.5 rounded-lg border transition-all flex flex-col justify-between ${
                isDone
                  ? "bg-emerald-500/5 border-emerald-500/20"
                  : "bg-black/30 border-border/50 hover:border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-1.5 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Icon className={`h-3.5 w-3.5 ${isDone ? "text-emerald-400" : "text-primary"}`} />
                  <span className="text-xs font-medium text-foreground">{item.label}</span>
                </div>
                <button
                  onClick={() => increment(item.id as any)}
                  className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/5 hover:bg-primary/20 hover:text-primary transition-colors text-muted-foreground"
                  title="Click to log touch"
                >
                  +{item.current}/{item.target}
                </button>
              </div>

              <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                {item.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
