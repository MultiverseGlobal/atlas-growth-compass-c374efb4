import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight, Target, MessageSquare, Check,
  Calendar, AlertTriangle, TrendingUp, Zap, ChevronRight,
  Users, Phone, DollarSign, Compass,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MapEvidenceDrawer } from "@/components/atlas/MapEvidenceDrawer";
import { ChatDrawer } from "@/components/atlas/ChatDrawer";
import { MetaphorBriefCard } from "@/components/MetaphorBriefCard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PipelineMetrics {
  prospects: number;
  responses: number;
  calls: number;
  painConfirmed: number;
  proposals: number;
  revenue: number;
}

interface BottleneckResult {
  stage: string;
  diagnosis: string;
  action: string;
  severity: "critical" | "warn" | "ok";
}

// ─── Targets (edit these when you have your 5 answers) ───────────────────────
const TARGETS = {
  prospects: 150,
  responses: 30,
  calls: 15,
  painConfirmed: 5,
  proposals: 3,
  revenue: 500,
  missionDays: 14,
  missionStart: "2026-08-11", // update to actual start date
};

// ─── Bottleneck engine ────────────────────────────────────────────────────────
function diagnoseBottleneck(m: PipelineMetrics): BottleneckResult {
  const responseRate = m.prospects > 0 ? m.responses / m.prospects : 0;
  const callRate = m.responses > 0 ? m.calls / m.responses : 0;
  const painRate = m.calls > 0 ? m.painConfirmed / m.calls : 0;
  const proposalRate = m.painConfirmed > 0 ? m.proposals / m.painConfirmed : 0;

  if (m.prospects < 20) {
    return {
      stage: "Prospect Acquisition",
      diagnosis: "Not enough prospects in pipeline to generate signal.",
      action: "Run Atlas sourcing — target 25 qualified leads today.",
      severity: "critical",
    };
  }
  if (responseRate < 0.03 && m.prospects >= 30) {
    return {
      stage: "Response Rate",
      diagnosis: `Only ${(responseRate * 100).toFixed(1)}% response rate. Outreach may be too generic or ICP is weak.`,
      action: "Audit message personalisation. Review ICP targeting for top niche.",
      severity: "critical",
    };
  }
  if (callRate < 0.20 && m.responses >= 5) {
    return {
      stage: "Call Conversion",
      diagnosis: "Responses coming in but not converting to calls. Problem framing may be weak.",
      action: "Refine reply-to-call sequence. Make booking a call frictionless.",
      severity: "warn",
    };
  }
  if (painRate < 0.30 && m.calls >= 3) {
    return {
      stage: "Pain Confirmation",
      diagnosis: "Calls happening but pain not being confirmed. Discovery questions may be too surface-level.",
      action: "Deepen discovery: ask about cost of the problem, not just the problem.",
      severity: "warn",
    };
  }
  if (proposalRate < 0.50 && m.painConfirmed >= 2) {
    return {
      stage: "Proposal Conversion",
      diagnosis: "Pain confirmed but proposals not being sent. Offer may feel uncertain.",
      action: "Tighten the offer spec. Make the proposal 1 page. Send same day.",
      severity: "warn",
    };
  }
  if (m.proposals > 0 && m.revenue === 0) {
    return {
      stage: "Closing",
      diagnosis: "Proposals sent but no payment. Trust, price, or urgency gap.",
      action: "Follow up within 24h. Ask directly what's blocking the decision.",
      severity: "warn",
    };
  }
  return {
    stage: "On Track",
    diagnosis: "Funnel is healthy. Keep pushing volume.",
    action: "Continue today's prospecting and outreach plan.",
    severity: "ok",
  };
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function daysRemaining(): number {
  const start = new Date(TARGETS.missionStart);
  const now = new Date();
  const elapsed = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return Math.max(0, TARGETS.missionDays - elapsed);
}

function dayNumber(): number {
  const start = new Date(TARGETS.missionStart);
  const now = new Date();
  const elapsed = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return Math.min(TARGETS.missionDays, elapsed + 1);
}

// ─── Metric tile ─────────────────────────────────────────────────────────────
function MetricTile({
  label, value, target, icon: Icon, prefix = "", suffix = "",
}: {
  label: string; value: number; target: number;
  icon: React.ComponentType<{ className?: string }>;
  prefix?: string; suffix?: string;
}) {
  const pct = Math.min(100, target > 0 ? (value / target) * 100 : 0);
  const colour =
    pct >= 80 ? "text-emerald-500" :
    pct >= 40 ? "text-warning" :
    "text-muted-foreground";

  return (
    <div className="card-warm rounded-xl border border-border/60 p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">{label}</span>
        <Icon className={`h-3.5 w-3.5 ${colour}`} />
      </div>
      <div className="flex items-end gap-1">
        <span className={`font-display text-2xl font-semibold ${colour}`}>
          {prefix}{value.toLocaleString()}{suffix}
        </span>
        <span className="text-xs text-muted-foreground mb-0.5">
          / {prefix}{target.toLocaleString()}{suffix}
        </span>
      </div>
      <div className="h-1 w-full bg-muted/40 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Home() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<PipelineMetrics>({
    prospects: 0, responses: 0, calls: 0,
    painConfirmed: 0, proposals: 0, revenue: 0,
  });
  const [loading, setLoading] = useState(true);

  // For the daily goal/commitment loop (kept from original Atlas logic)
  const [activeMap, setActiveMap] = useState<any>(null);
  const [activeMove, setActiveMove] = useState<any>(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // ── Load pipeline metrics from Supabase leads table ──────────────────────
  const loadMetrics = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: leads, error } = await supabase
        .from("leads")
        .select("stage, is_contacted, reply_status")
        .eq("user_id", user.id);

      if (error) throw error;

      const m: PipelineMetrics = {
        prospects: leads?.length ?? 0,
        responses: leads?.filter((l) =>
          l.reply_status && !["none", "no_reply"].includes(l.reply_status)
        ).length ?? 0,
        calls: leads?.filter((l) =>
          ["call_booked", "call_completed", "pain_confirmed", "proposal_sent",
           "negotiating", "won", "paid", "onboarding", "delivering", "complete"].includes(l.stage)
        ).length ?? 0,
        painConfirmed: leads?.filter((l) =>
          ["pain_confirmed", "proposal_sent", "negotiating", "won", "paid",
           "onboarding", "delivering", "complete"].includes(l.stage)
        ).length ?? 0,
        proposals: leads?.filter((l) =>
          ["proposal_sent", "negotiating", "won", "paid", "onboarding", "delivering", "complete"].includes(l.stage)
        ).length ?? 0,
        revenue: 0, // will be updated when payment tracking is added
      };

      setMetrics(m);
    } catch (err: any) {
      console.error("[Home] metrics load error:", err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // ── Load active goal map ──────────────────────────────────────────────────
  const loadActiveMap = useCallback(async () => {
    if (!user) return;
    try {
      const { data: maps } = await supabase
        .from("maps")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const map = maps?.[0] || null;
      setActiveMap(map);

      if (map?.id) {
        const { data: wps } = await supabase
          .from("waypoints")
          .select("*")
          .eq("map_id", map.id)
          .eq("kind", "move")
          .is("completed_at", null)
          .order("created_at", { ascending: false })
          .limit(1);
        setActiveMove(wps?.[0] || null);
      }
    } catch (err: any) {
      console.error("[Home] map load error:", err.message);
    }
  }, [user]);

  useEffect(() => {
    loadMetrics();
    loadActiveMap();
  }, [loadMetrics, loadActiveMap]);

  const bottleneck = diagnoseBottleneck(metrics);
  const dayNum = dayNumber();
  const daysLeft = daysRemaining();

  const severityColors = {
    critical: "border-destructive/40 bg-destructive/5 text-destructive",
    warn: "border-warning/40 bg-warning/5 text-warning",
    ok: "border-success/30 bg-success/5 text-success",
  };

  return (
    <div className="relative page-hero mx-auto max-w-2xl px-6 py-10 md:py-16 animate-fade-in space-y-8">

      {/* ── Mission Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border/40 pb-6">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
            14-Day Sprint
          </span>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground mt-1">
            Mission Control
          </h1>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
            Day {dayNum} of {TARGETS.missionDays}
          </div>
          <div className={`font-display text-xl font-semibold mt-0.5 ${
            daysLeft <= 3 ? "text-destructive" : daysLeft <= 7 ? "text-warning" : "text-primary"
          }`}>
            {daysLeft}d left
          </div>
        </div>
      </div>

      {/* ── Metaphor Brief ─────────────────────────────────────────────── */}
      <MetaphorBriefCard />

      {/* ── Scoreboard ─────────────────────────────────────────────────── */}
      <div>
        <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase mb-3 block">
          Pipeline
        </span>
        {loading ? (
          <CompassLoader />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <MetricTile label="Prospects" value={metrics.prospects} target={TARGETS.prospects} icon={Users} />
            <MetricTile label="Responses" value={metrics.responses} target={TARGETS.responses} icon={MessageSquare} />
            <MetricTile label="Calls" value={metrics.calls} target={TARGETS.calls} icon={Phone} />
            <MetricTile label="Pain Confirmed" value={metrics.painConfirmed} target={TARGETS.painConfirmed} icon={Target} />
            <MetricTile label="Proposals" value={metrics.proposals} target={TARGETS.proposals} icon={TrendingUp} />
            <MetricTile label="Revenue" value={metrics.revenue} target={TARGETS.revenue} icon={DollarSign} prefix="£" />
          </div>
        )}
      </div>

      {/* ── Bottleneck Diagnosis ────────────────────────────────────────── */}
      {!loading && (
        <div className={`rounded-xl border p-4 ${severityColors[bottleneck.severity]}`}>
          <div className="flex items-center gap-2 mb-2">
            {bottleneck.severity === "critical" ? (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            ) : bottleneck.severity === "warn" ? (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            ) : (
              <Check className="h-4 w-4 shrink-0" />
            )}
            <span className="text-xs font-semibold uppercase tracking-wide">
              Bottleneck: {bottleneck.stage}
            </span>
          </div>
          <p className="text-xs leading-relaxed opacity-90 mb-3">{bottleneck.diagnosis}</p>
          <div className="flex items-start gap-2 bg-background/30 rounded-lg p-3">
            <Zap className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p className="text-xs font-medium leading-relaxed">{bottleneck.action}</p>
          </div>
        </div>
      )}

      {/* ── Active Goal Move (commitment loop) ─────────────────────────── */}
      {activeMap && activeMove && (
        <div className="space-y-3">
          <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
            <Calendar className="h-3 w-3" /> Today's Move
          </span>
          <div className="card-warm rounded-xl border border-border/60 px-5 py-4 shadow-sm">
            <p className="font-sans text-sm text-foreground leading-relaxed">
              {activeMove.title}
            </p>
            <div className="mt-4 flex items-center gap-4 border-t border-border/40 pt-3">
              <button
                onClick={() => setShowEvidence(true)}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 font-medium"
              >
                Why this?
              </button>
              <span className="text-border/60 text-xs">|</span>
              <button
                onClick={() => setShowChat(true)}
                className="text-xs text-muted-foreground hover:text-foreground font-medium"
              >
                Discuss with Atlas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick nav ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-border/40 pt-5 text-xs text-muted-foreground">
        <Link
          to="/app/sourcing"
          className="flex items-center gap-1.5 hover:text-foreground transition-colors font-semibold"
        >
          <Target className="h-3.5 w-3.5" /> Sourcing Engine
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
        {activeMap && (
          <Link
            to={`/app/map/${activeMap.id}`}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors font-semibold"
          >
            Strategy Map <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {/* ── Drawers ────────────────────────────────────────────────────── */}
      {activeMap && (
        <MapEvidenceDrawer
          open={showEvidence}
          onClose={() => setShowEvidence(false)}
          mapId={activeMap.id}
          goalStatement={activeMap.goal_statement}
          mapName={activeMap.name}
        />
      )}
      {activeMap && (
        <ChatDrawer
          open={showChat}
          onClose={() => setShowChat(false)}
          mapId={activeMap.id}
          mapName={activeMap.name}
          onActionExecuted={() => {
            loadMetrics();
            loadActiveMap();
          }}
        />
      )}
    </div>
  );
}

export function CompassLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-14 space-y-3.5">
      <div className="relative">
        <div className="absolute inset-0 rounded-full border border-primary/20 scale-125" />
        <svg className="h-10 w-10 text-primary compass-spin relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" fill="currentColor" fillOpacity="0.25" />
          <line x1="12" y1="2" x2="12" y2="4" strokeLinecap="round" />
          <line x1="12" y1="20" x2="12" y2="22" strokeLinecap="round" />
          <line x1="2" y1="12" x2="4" y2="12" strokeLinecap="round" />
          <line x1="20" y1="12" x2="22" y2="12" strokeLinecap="round" />
        </svg>
      </div>
      <div className="text-[10px] font-mono tracking-widest text-muted-foreground/80 uppercase animate-pulse">
        Orienting loop…
      </div>
    </div>
  );
}