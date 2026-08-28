import { useState } from "react";
import { Loader2, Zap, ChevronRight, AlertCircle, TrendingUp, Clock, DollarSign, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export interface PainHypothesis {
  problem: string;
  confidence: number;
  reasoning: string;
  opportunity: string;
  estimated_value: string;
  urgency: "high" | "medium" | "low";
}

interface PainEngineProps {
  companyId: string;
  companyName: string;
  website: string;
  researchData: any;
  onBuildOffer?: (pain: PainHypothesis) => void;
  onAnalysisComplete?: (pains: PainHypothesis[]) => void;
}

const URGENCY_CONFIG = {
  high:   { color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20",    label: "High urgency" },
  medium: { color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20",  label: "Medium urgency" },
  low:    { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", label: "Low urgency" },
};

export function PainEngine({ companyId, companyName, website, researchData, onBuildOffer, onAnalysisComplete }: PainEngineProps) {
  const { user } = useAuth();
  const [pains, setPains] = useState<PainHypothesis[]>([]);
  const [loading, setLoading] = useState(false);
  const [analysed, setAnalysed] = useState(false);

  const handleAnalyse = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("sourcing-machine", {
        body: {
          action: "analyze-pain",
          company: companyName,
          website,
          research: researchData,
        },
      });

      if (error) throw new Error(error.message);
      const result: PainHypothesis[] = Array.isArray(data) ? data : (data?.pains ?? []);
      setPains(result);
      setAnalysed(true);

      // Log event to atlas_events
      if (user && result.length > 0) {
        await (supabase as any).from("atlas_events").insert(
          result.map((p) => ({
            user_id: user.id,
            company_id: companyId,
            event_type: "pain_analyzed",
            source: "ai",
            metadata: {
              problem: p.problem,
              confidence: p.confidence,
              opportunity: p.opportunity,
              urgency: p.urgency,
              estimated_value: p.estimated_value,
            },
          }))
        );
        onAnalysisComplete?.(result);
      }
    } catch (err: any) {
      toast.error("Pain analysis failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Pain Analysis</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            What expensive problems does {companyName} likely have?
          </p>
        </div>
        <Button
          onClick={handleAnalyse}
          disabled={loading}
          size="sm"
          className={`h-8 text-xs gap-1.5 ${analysed ? "bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-border/40" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
          variant={analysed ? "ghost" : "default"}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : analysed ? <RefreshCw className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
          {loading ? "Analysing..." : analysed ? "Re-analyse" : "Analyse Pain"}
        </Button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="rounded-xl border border-border/40 bg-muted/10 p-8 text-center space-y-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Identifying operational pain points...</p>
            <p className="text-xs text-muted-foreground font-mono">Cross-referencing team size, tech stack, and business model</p>
          </div>
        </div>
      )}

      {/* Empty pre-analysis */}
      {!loading && !analysed && (
        <div className="rounded-xl border border-dashed border-border/40 p-8 text-center space-y-2">
          <AlertCircle className="h-6 w-6 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">No pain analysis yet.</p>
          <p className="text-xs text-muted-foreground/60 max-w-xs mx-auto">
            Atlas will use company research, team size, tech stack, and business model to identify likely operational bottlenecks.
          </p>
        </div>
      )}

      {/* Pain hypotheses */}
      {!loading && pains.length > 0 && (
        <div className="space-y-3">
          {pains.map((pain, i) => {
            const urgency = URGENCY_CONFIG[pain.urgency] ?? URGENCY_CONFIG.medium;
            return (
              <div key={i} className={`rounded-xl border ${urgency.border} ${urgency.bg} p-4 space-y-3`}>
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <div className={`text-xs font-bold font-mono mt-0.5 shrink-0 ${urgency.color}`}>
                      #{i + 1}
                    </div>
                    <p className="text-sm font-semibold leading-snug">{pain.problem}</p>
                  </div>
                  <ConfidenceBadge score={pain.confidence} />
                </div>

                {/* Reasoning */}
                <p className="text-xs text-muted-foreground leading-relaxed pl-5">{pain.reasoning}</p>

                {/* Opportunity + value */}
                <div className="flex items-center gap-3 pl-5 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs">
                    <TrendingUp className="h-3.5 w-3.5 text-primary" />
                    <span className="text-foreground/80 font-medium">{pain.opportunity}</span>
                  </div>
                  {pain.estimated_value && (
                    <div className="flex items-center gap-1 text-xs text-emerald-400 font-mono">
                      <DollarSign className="h-3 w-3" />
                      {pain.estimated_value}
                    </div>
                  )}
                  <div className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider ${urgency.color} ${urgency.bg} border ${urgency.border}`}>
                    {urgency.label}
                  </div>
                </div>

                {/* Build Offer CTA */}
                {onBuildOffer && (
                  <div className="pl-5">
                    <button
                      onClick={() => onBuildOffer(pain)}
                      className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      Build offer from this pain <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <p className="text-[10px] text-muted-foreground/50 font-mono text-center">
            {pains.length} pain hypotheses · Saved to event log
          </p>
        </div>
      )}
    </div>
  );
}

function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 80 ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
    : score >= 60 ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
    : "text-muted-foreground border-border/40 bg-muted/20";
  return (
    <div className={`shrink-0 text-xs font-bold font-mono px-2 py-0.5 rounded border ${color}`}>
      {score}%
    </div>
  );
}
