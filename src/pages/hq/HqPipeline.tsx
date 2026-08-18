import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2, DollarSign, Clock, AlertCircle, ChevronRight,
  TrendingUp, Plus, ExternalLink, CreditCard
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { isPast } from "date-fns";

interface Deal {
  id: string;
  company_id: string;
  company_name: string;
  stage: string;
  value: number;
  probability: number;
  next_action: string | null;
  next_action_due: string | null;
  updated_at: string;
  daysSince: number;
}

const STAGES: { key: string; label: string; color: string }[] = [
  { key: "contacted",     label: "Contacted",      color: "text-muted-foreground" },
  { key: "replied",       label: "Replied",        color: "text-amber-400" },
  { key: "discovery",     label: "Discovery",      color: "text-blue-400" },
  { key: "proposal",      label: "Proposal",       color: "text-purple-400" },
  { key: "negotiation",   label: "Negotiation",    color: "text-rose-400" },
  { key: "won",           label: "Won ✓",          color: "text-emerald-400" },
  { key: "lost",          label: "Lost",           color: "text-red-400" },
];

const STAGE_BORDER: Record<string, string> = {
  contacted:     "border-border/60",
  replied:       "border-amber-500/30",
  discovery:     "border-blue-500/30",
  proposal:      "border-purple-500/30",
  negotiation:   "border-rose-500/30",
  won:           "border-emerald-500/30",
  lost:          "border-red-500/20",
};

const STAGE_BG: Record<string, string> = {
  contacted:     "",
  replied:       "bg-amber-500/3",
  discovery:     "bg-blue-500/3",
  proposal:      "bg-purple-500/3",
  negotiation:   "bg-rose-500/3",
  won:           "bg-emerald-500/5",
  lost:          "bg-red-500/3",
};

function formatMoney(n: number) {
  if (n >= 1000) return `£${(n / 1000).toFixed(1)}k`;
  return `£${Math.round(n).toLocaleString()}`;
}

export default function HqPipeline() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadDeals = useCallback(async () => {
    setLoading(true);
    let dealsData: any[] = [];
    if (user) {
      try {
        const { data, error } = await supabase
          .from("atlas_deals" as any)
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });
        if (!error && data) dealsData = data;
      } catch {}
    }

    if (dealsData.length === 0) {
      try {
        const savedDeals = JSON.parse(localStorage.getItem("atlas_deals") || "[]");
        dealsData = savedDeals;
      } catch {}
    }

    setDeals(
      dealsData.map((d: any) => ({
        ...d,
        daysSince: Math.floor((Date.now() - new Date(d.updated_at || Date.now()).getTime()) / 86400000),
      }))
    );
    setLoading(false);
  }, [user]);

  useEffect(() => { loadDeals(); }, [loadDeals]);

  const handleDrop = async (stage: string) => {
    if (!dragging || !user) return;
    setDragOver(null);
    const deal = deals.find((d) => d.id === dragging);
    if (!deal || deal.stage === stage) { setDragging(null); return; }
    setUpdatingId(dragging);
    try {
      await supabase.from("atlas_deals").update({ stage }).eq("id", dragging);
      // If moved to won, set won_at; if lost, set lost_at
      if (stage === "won") await supabase.from("atlas_deals").update({ won_at: new Date().toISOString() }).eq("id", dragging);
      if (stage === "lost") await supabase.from("atlas_deals").update({ lost_at: new Date().toISOString() }).eq("id", dragging);

      // Log event to atlas_events
      const eventType = stage === "won" ? "deal_won" : stage === "lost" ? "deal_lost" : "deal_stage_changed";
      await (supabase as any).from("atlas_events").insert({
        user_id: user.id,
        company_id: deal.company_id,
        deal_id: deal.id,
        event_type: eventType,
        source: "user",
        metadata: {
          from_stage: deal.stage,
          to_stage: stage,
          deal_value: deal.value,
          company_name: deal.company_name,
        },
      });

      toast.success(`${deal.company_name} → ${STAGES.find((s) => s.key === stage)?.label}`);
      await loadDeals();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdatingId(null);
      setDragging(null);
    }
  };

  // Pipeline metrics
  const pipelineValue = deals
    .filter((d) => !["won", "lost"].includes(d.stage))
    .reduce((sum, d) => sum + (d.value * d.probability) / 100, 0);

  const wonTotal = deals
    .filter((d) => d.stage === "won")
    .reduce((sum, d) => sum + d.value, 0);

  const totalPipeline = deals
    .filter((d) => d.stage !== "lost")
    .reduce((sum, d) => sum + d.value, 0);

  // ── Stripe payment link (fallback to clipboard instructions) ──────────────
  const [generatingLink, setGeneratingLink] = useState<string | null>(null);

  const handleGeneratePaymentLink = async (deal: Deal, e: React.MouseEvent) => {
    e.stopPropagation();
    setGeneratingLink(deal.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const base = import.meta.env.VITE_SUPABASE_URL;

      const res = await fetch(`${base}/functions/v1/create-payment-link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          company_name: deal.company_name,
          amount: deal.value,
          currency: "gbp",
          deal_id: deal.id,
        }),
      });

      if (res.ok) {
        const { url } = await res.json();
        await navigator.clipboard.writeText(url);
        toast.success(`Payment link copied! Send to ${deal.company_name}`);
      } else {
        // No Stripe key — give manual instructions
        await navigator.clipboard.writeText(
          `Payment request for ${deal.company_name}: £${formatMoney(deal.value).replace("£", "")}\n\nCreate a Stripe payment link at: https://dashboard.stripe.com/payment-links`
        );
        toast("💳 Add STRIPE_SECRET_KEY to Supabase Edge Functions to auto-generate links. Manual instructions copied.", {
          duration: 7000,
        });
      }
    } catch {
      await navigator.clipboard.writeText(
        `Payment link for ${deal.company_name}\nAmount: ${formatMoney(deal.value)}\n\nCreate at: https://dashboard.stripe.com/payment-links`
      );
      toast("💳 Stripe not connected yet — instructions copied to clipboard", { duration: 5000 });
    } finally {
      setGeneratingLink(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-sm px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-sm font-semibold">Sales Pipeline</h1>
            <p className="text-xs text-muted-foreground font-mono">
              {deals.filter((d) => !["won", "lost"].includes(d.stage)).length} active deals
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Revenue summary pills */}
            <div className="hidden md:flex items-center gap-2 text-xs font-mono">
              <div className="px-2.5 py-1 rounded-lg bg-muted/30 border border-border/40">
                <span className="text-muted-foreground">Pipeline: </span>
                <span className="text-foreground font-semibold">{formatMoney(pipelineValue)}</span>
              </div>
              <div className="px-2.5 py-1 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
                <span className="text-muted-foreground">Won: </span>
                <span className="text-emerald-400 font-semibold">{formatMoney(wonTotal)}</span>
              </div>
              <div className="px-2.5 py-1 rounded-lg bg-primary/8 border border-primary/20">
                <span className="text-muted-foreground">Total: </span>
                <span className="text-primary font-semibold">{formatMoney(totalPipeline)}</span>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => navigate("/hq/leads?new=1")}
              className="h-8 bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Add Lead
            </Button>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-6">
        {deals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-sm font-medium">No deals yet</p>
            <p className="text-xs mt-1 opacity-70">Add leads and move them to the pipeline</p>
            <Button size="sm" onClick={() => navigate("/hq/leads?new=1")} className="mt-4 bg-primary text-primary-foreground gap-1.5 h-8 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add your first lead
            </Button>
          </div>
        ) : (
          <div className="flex gap-4 min-w-max h-full">
            {STAGES.map((stage) => {
              const stageDeals = deals.filter((d) => d.stage === stage.key);
              const stageValue = stageDeals.reduce((s, d) => s + d.value, 0);
              const isDragTarget = dragOver === stage.key;

              return (
                <div
                  key={stage.key}
                  className="w-64 flex flex-col"
                  onDragOver={(e) => { e.preventDefault(); setDragOver(stage.key); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={() => handleDrop(stage.key)}
                >
                  {/* Column header */}
                  <div className={`flex items-center justify-between px-3 py-2 mb-3 rounded-lg border transition-colors ${
                    isDragTarget ? "border-primary/50 bg-primary/5" : "border-border/40 bg-muted/20"
                  }`}>
                    <div>
                      <div className={`text-xs font-semibold ${stage.color}`}>{stage.label}</div>
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {stageDeals.length} deal{stageDeals.length !== 1 ? "s" : ""} · {formatMoney(stageValue)}
                      </div>
                    </div>
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded-full bg-muted/60 border border-border/40 ${stage.color}`}>
                      {stageDeals.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className={`flex-1 space-y-2.5 min-h-24 rounded-xl transition-colors p-2 ${isDragTarget ? "bg-primary/5 border border-dashed border-primary/30" : ""}`}>
                    {stageDeals.length === 0 && !isDragTarget && (
                      <div className="h-20 rounded-lg border border-dashed border-border/30 flex items-center justify-center">
                        <span className="text-xs text-muted-foreground/40">Drop here</span>
                      </div>
                    )}
                    {stageDeals.map((deal) => {
                      const isStalled = deal.daysSince >= 7;
                      const isWarning = deal.daysSince >= 5 && deal.daysSince < 7;
                      const isUpdating = updatingId === deal.id;
                      const nextActionOverdue = deal.next_action_due && isPast(new Date(deal.next_action_due));

                      return (
                        <div
                          key={deal.id}
                          draggable
                          onDragStart={() => setDragging(deal.id)}
                          onDragEnd={() => { setDragging(null); setDragOver(null); }}
                          onClick={() => navigate(`/hq/leads/${deal.company_id}`)}
                          className={`rounded-xl border p-3.5 space-y-2.5 cursor-grab active:cursor-grabbing hover:border-primary/30 transition-all ${
                            STAGE_BORDER[deal.stage]
                          } ${STAGE_BG[deal.stage]} ${
                            dragging === deal.id ? "opacity-40 scale-95" : ""
                          } ${isUpdating ? "animate-pulse" : ""}`}
                        >
                          {/* Company name */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-sm font-semibold leading-tight">{deal.company_name}</div>
                            {isStalled && (
                              <div title={`${deal.daysSince} days no movement`}>
                                <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                              </div>
                            )}
                          </div>

                          {/* Value */}
                          <div className="flex items-center gap-1 text-xs font-mono">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            <span className="font-semibold">{formatMoney(deal.value)}</span>
                            <span className="text-muted-foreground">· {deal.probability}%</span>
                          </div>

                          {/* Next action */}
                          {deal.next_action && (
                            <div className={`text-[11px] flex items-center gap-1 ${nextActionOverdue ? "text-red-400" : "text-muted-foreground"}`}>
                              <Clock className="h-3 w-3 shrink-0" />
                              <span className="truncate">{deal.next_action}</span>
                            </div>
                          )}

                          {/* Days since + stall indicator */}
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-mono ${isStalled ? "text-red-400" : isWarning ? "text-amber-400" : "text-muted-foreground/60"}`}>
                              {deal.daysSince === 0 ? "Updated today" : `${deal.daysSince}d ago`}
                            </span>
                            <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
                          </div>

                          {/* Payment link — only on won deals */}
                          {deal.stage === "won" && (
                            <button
                              onClick={(e) => handleGeneratePaymentLink(deal, e)}
                              disabled={generatingLink === deal.id}
                              className="w-full flex items-center justify-center gap-1.5 mt-1 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 text-[10px] font-semibold transition-colors"
                            >
                              {generatingLink === deal.id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <CreditCard className="h-3 w-3" />}
                              {generatingLink === deal.id ? "Generating…" : "Generate Payment Link"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
