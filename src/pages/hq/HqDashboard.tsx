import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp, AlertCircle, ArrowRight, RefreshCw,
  DollarSign, Target, MessageSquare, Clock, Zap, ChevronRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, isToday, isPast, formatDistanceToNow } from "date-fns";

interface AcquisitionData {
  target: number;
  contacted: number;
  discovered: number;
  qualified: number;
  researched: number;
  status: string;
}

interface FollowUp {
  id: string;
  company_id: string;
  company_name: string;
  subject: string | null;
  type: string;
  follow_up_due: string;
  status: string;
}

interface StalledDeal {
  id: string;
  company_name: string;
  stage: string;
  value: number;
  next_action: string | null;
  next_action_due: string | null;
  updated_at: string;
  daysSince: number;
}

interface OutreachStats {
  sentThisWeek: number;
  repliesThisWeek: number;
}

function stageLabel(s: string) {
  const map: Record<string, string> = {
    contacted: "Contacted",
    interested: "Interested",
    call_booked: "Call Booked",
    proposal_sent: "Proposal Sent",
    won: "Won",
    lost: "Lost",
  };
  return map[s] ?? s;
}

function typeLabel(t: string) {
  const map: Record<string, string> = {
    cold_email: "Cold Email",
    linkedin: "LinkedIn",
    followup: "Follow-up",
    call_script: "Call Script",
    loom: "Loom",
  };
  return map[t] ?? t;
}

export default function HqDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [acquisition, setAcquisition] = useState<AcquisitionData | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [stalled, setStalled] = useState<StalledDeal[]>([]);
  const [outreachStats, setOutreachStats] = useState<OutreachStats>({ sentThisWeek: 0, repliesThisWeek: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nba, setNba] = useState<{ company: string; companyId: string; action: string; reason: string; value: string; confidence: number } | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // 1. Acquisition summary
      let acq: AcquisitionData = { target: 20, contacted: 0, discovered: 0, qualified: 0, researched: 0, status: "idle" };
      try {
        const { data: runRow } = await supabase
          .from("acquisition_runs")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (runRow) {
          acq = {
            target: runRow.target ?? 20,
            contacted: runRow.contacted_count ?? 0,
            discovered: runRow.discovered_count ?? 0,
            qualified: runRow.qualified_count ?? 0,
            researched: runRow.researched_count ?? 0,
            status: runRow.status ?? "idle"
          };
        }
      } catch (e) {
        console.warn("Acquisition fetch fallback:", e);
      }
      setAcquisition(acq);

      // 2. Follow-ups due
      try {
        const todayStr = new Date().toISOString().split("T")[0];
        const { data: fuData } = await supabase
          .from("atlas_outreach")
          .select("id, company_id, subject, type, follow_up_due, status")
          .eq("user_id", user.id)
          .lte("follow_up_due", todayStr)
          .in("status", ["sent", "draft"])
          .order("follow_up_due", { ascending: true })
          .limit(8);

        const fuCompanyIds = [...new Set((fuData ?? []).map((f: any) => f.company_id))];
        let fuCompanyMap: Record<string, string> = {};
        if (fuCompanyIds.length > 0) {
          const { data: comps } = await supabase
            .from("kuro_pipeline_view")
            .select("id, company")
            .in("id", fuCompanyIds);
          (comps ?? []).forEach((c: any) => { fuCompanyMap[c.id] = c.company; });
        }
        setFollowUps((fuData ?? []).map((f: any) => ({ ...f, company_name: fuCompanyMap[f.company_id] ?? "Unknown" })));
      } catch (e) {
        console.warn("Follow-ups fetch fallback:", e);
      }

      // 3. Stalled deals (no update in 5+ days, not won/lost)
      try {
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        const { data: dealData } = await supabase
          .from("atlas_deals")
          .select("id, company_name, stage, value, next_action, next_action_due, updated_at")
          .eq("user_id", user.id)
          .not("stage", "in", "(won,lost)")
          .lte("updated_at", fiveDaysAgo.toISOString())
          .order("updated_at", { ascending: true })
          .limit(5);

        setStalled(
          (dealData ?? []).map((d: any) => ({
            ...d,
            daysSince: Math.floor((Date.now() - new Date(d.updated_at).getTime()) / 86400000),
          }))
        );
      } catch (e) {
        console.warn("Stalled deals fetch fallback:", e);
      }

      // 4. Outreach stats this week
      try {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const { data: outData } = await supabase
          .from("atlas_outreach")
          .select("status")
          .eq("user_id", user.id)
          .gte("created_at", weekAgo.toISOString());

        const sentThisWeek = (outData ?? []).filter((o: any) => o.status !== "draft").length;
        const repliesThisWeek = (outData ?? []).filter((o: any) => ["replied", "booked"].includes(o.status)).length;
        setOutreachStats({ sentThisWeek, repliesThisWeek });
      } catch (e) {
        console.warn("Outreach stats fetch fallback:", e);
      }

      // 5. Next Best Action
      try {
        const { data: topDeal } = await supabase
          .from("atlas_deals")
          .select("id, company_name, company_id, stage, value, next_action, next_action_due, updated_at")
          .eq("user_id", user.id)
          .not("stage", "in", "(won,lost)")
          .order("value", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (topDeal) {
          const daysSince = Math.floor((Date.now() - new Date(topDeal.updated_at).getTime()) / 86400000);
          const isOverdue = topDeal.next_action_due && isPast(new Date(topDeal.next_action_due));
          const action = isOverdue
            ? `Follow up on ${topDeal.company_name}`
            : topDeal.stage === "proposal_sent"
            ? `Chase proposal with ${topDeal.company_name}`
            : `Move ${topDeal.company_name} forward`;
          const reason = isOverdue
            ? `Follow-up was due ${formatDistanceToNow(new Date(topDeal.next_action_due!))} ago — deals go cold fast.`
            : daysSince >= 5
            ? `No contact for ${daysSince} days. Deals stall, not fail — one message changes this.`
            : `Highest value active deal at £${topDeal.value?.toLocaleString()}. Keep the momentum.`;
          setNba({
            company: topDeal.company_name,
            companyId: topDeal.company_id ?? topDeal.id,
            action,
            reason,
            value: `£${topDeal.value?.toLocaleString() ?? "—"}`,
            confidence: isOverdue ? 95 : daysSince >= 5 ? 87 : 78,
          });
        }
      } catch (e) {
        console.warn("NBA calculation fallback:", e);
      }

    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      loadDashboard();
    }
  }, [authLoading, loadDashboard]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
  };

  const acqPercent = acquisition ? Math.min(100, Math.round((acquisition.contacted / acquisition.target) * 100)) : 0;
  const today = format(new Date(), "EEEE, d MMMM yyyy");

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-xs text-muted-foreground font-mono">Loading mission control...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground grain overflow-hidden">
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-border-subtle bg-surface-1/40 backdrop-blur-2xl px-8 py-5 flex items-center justify-between pds-animate-enter" style={{ animationDelay: "50ms" }}>
        <div>
          <h1 className="text-xl font-display text-foreground tracking-tight">14-Day Sprint · Mission Control</h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">{today}</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Engine Status */}
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20">
            <Zap className="h-3 w-3 text-accent" />
            <span className="text-accent font-semibold uppercase">{acquisition?.status || "IDLE"}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-8 w-8 p-0 border-border/60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="p-8 space-y-8 max-w-7xl mx-auto pds-animate-enter" style={{ animationDelay: "100ms" }}>
        {/* Acquisition Progress */}
        <div className="rounded-2xl border border-border-subtle pds-glass p-6 space-y-5 shadow-card hover:shadow-card-hover transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-4xl font-display text-foreground tracking-tight flex items-baseline gap-2">
                {acquisition?.contacted ?? 0}
                <span className="text-sm font-normal text-muted-foreground ml-2">/ {acquisition?.target ?? 20} daily target sent</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{acqPercent}% of daily acquisition quota</p>
            </div>
            <div className="text-right">
              <Button size="sm" variant="default" onClick={() => navigate("/hq/flow")} className="gap-2 text-xs">
                Open Engine <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-700"
              style={{ width: `${acqPercent}%` }}
            />
          </div>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            {[
              { label: "Contacted today", value: acquisition?.contacted ?? 0, unit: "sent", color: "text-accent" },
              { label: "Researched today", value: acquisition?.researched ?? 0, unit: "leads", color: "text-foreground" },
              { label: "Qualified today", value: acquisition?.qualified ?? 0, unit: "leads", color: "text-foreground" },
              { label: "Sourced today", value: acquisition?.discovered ?? 0, unit: "leads", color: "text-foreground", raw: true },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-surface-2/40 border border-border-subtle p-4 hover:bg-surface-2 transition-colors cursor-default">
                <div className={`text-2xl font-display ${stat.color}`}>
                  {stat.raw ? stat.value : stat.value}{!stat.raw && <span className="text-xs font-sans text-muted-foreground ml-1">{stat.unit}</span>}
                </div>
                <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-semibold">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ⚡ Next Best Action */}
        {nba ? (
          <div className="rounded-2xl border border-accent/20 bg-gradient-to-br from-accent-dim to-transparent p-6 space-y-4 shadow-[var(--pds-shadow-glow)] backdrop-blur-md pds-animate-enter" style={{ animationDelay: "150ms" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-accent" fill="currentColor" />
                <span className="text-xs font-bold text-accent uppercase tracking-widest font-mono">Next Best Action</span>
              </div>
              <div className="flex items-center gap-1 text-xs font-mono text-accent/70">
                <span>{nba.confidence}% confidence</span>
              </div>
            </div>
            <div>
              <p className="text-base font-bold tracking-tight">{nba.action}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{nba.reason}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-status-success border border-status-success/20 bg-status-success/10 px-2 py-0.5 rounded">Deal value: {nba.value}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => navigate(`/hq/leads/${nba.companyId}?tab=outreach`)} className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" /> Log Interaction
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate(`/hq/leads/${nba.companyId}`)} className="h-8 text-xs border-border/60 gap-1.5">
                <ArrowRight className="h-3.5 w-3.5" /> View Company
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate(`/hq/leads/${nba.companyId}/proposal`)} className="h-8 text-xs border-border/60 gap-1.5">
                <Target className="h-3.5 w-3.5" /> Proposal
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 flex items-start gap-3">
            <Zap className="h-4 w-4 text-accent shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-accent mb-0.5 uppercase tracking-wider">Atlas Chief of Staff</div>
              <p className="text-sm text-foreground">Add leads and deals to activate your Next Best Action engine.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pds-animate-enter" style={{ animationDelay: "200ms" }}>
          {/* Follow-ups Due */}
          <div className="lg:col-span-2 rounded-2xl border border-border-subtle pds-glass p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-status-warning" />
                <h2 className="text-sm font-semibold">Follow-ups Due</h2>
                {followUps.length > 0 && (
                  <span className="text-xs font-mono bg-status-warning/15 text-status-warning border border-status-warning/20 px-1.5 py-0.5 rounded-full">
                    {followUps.length}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/hq/outreach")}
                className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
              >
                View all <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
            {followUps.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No follow-ups due</p>
                <p className="text-xs mt-1 opacity-70">Go send some outreach</p>
              </div>
            ) : (
              <div className="space-y-2">
                {followUps.map((fu) => {
                  const due = new Date(fu.follow_up_due);
                  const overdue = isPast(due) && !isToday(due);
                  return (
                    <div
                      key={fu.id}
                      onClick={() => navigate(`/hq/leads/${fu.company_id}`)}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border-subtle bg-surface-2/40 hover:bg-surface-2 cursor-pointer transition-colors group"
                    >
                      <div className={`h-2 w-2 rounded-full shrink-0 ${overdue ? "bg-status-danger" : "bg-status-warning"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{fu.company_name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {typeLabel(fu.type)}{fu.subject ? ` · ${fu.subject}` : ""}
                        </div>
                      </div>
                      <div className={`text-xs font-mono shrink-0 ${overdue ? "text-status-danger" : "text-status-warning"}`}>
                        {overdue ? formatDistanceToNow(due, { addSuffix: true }) : "Today"}
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Outreach this week */}
            <div className="rounded-2xl border border-border-subtle pds-glass p-6 space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-accent" />
                <h2 className="text-sm font-semibold tracking-wide uppercase">This Week</h2>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: "Outreach sent", value: outreachStats.sentThisWeek, color: "text-foreground" },
                  {
                    label: "Replies received",
                    value: outreachStats.repliesThisWeek,
                    color: outreachStats.repliesThisWeek > 0 ? "text-status-success" : "text-muted-foreground"
                  },
                  {
                    label: "Reply rate",
                    value: outreachStats.sentThisWeek > 0
                      ? `${Math.round((outreachStats.repliesThisWeek / outreachStats.sentThisWeek) * 100)}%`
                      : "—",
                    color: "text-accent"
                  },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className={`font-mono font-semibold ${row.color}`}>{row.value}</span>
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                onClick={() => navigate("/hq/outreach")}
                className="w-full h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 mt-1"
              >
                <MessageSquare className="h-3.5 w-3.5" /> Generate Outreach
              </Button>
            </div>

            {/* Quick actions */}
            <div className="rounded-2xl border border-border-subtle pds-glass p-6 space-y-3">
              <h2 className="text-sm font-semibold tracking-wide uppercase mb-4">Quick Actions</h2>
              {[
                { label: "Add a new lead", icon: Target, path: "/hq/leads?new=1" },
                { label: "View pipeline", icon: TrendingUp, path: "/hq/pipeline" },
                { label: "Weekly report", icon: AlertCircle, path: "/hq/report" },
              ].map((action) => (
                <button
                  key={action.label}
                  onClick={() => navigate(action.path)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/40 bg-muted/10 hover:bg-muted/30 transition-colors text-left group"
                >
                  <action.icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{action.label}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground ml-auto" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stalled Deals */}
        {stalled.length > 0 && (
          <div className="rounded-xl border border-status-danger/20 bg-status-danger/5 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-status-danger" />
              <h2 className="text-sm font-semibold text-status-danger">Stalled Deals</h2>
              <span className="text-xs font-mono bg-status-danger/15 text-status-danger border border-status-danger/20 px-1.5 py-0.5 rounded-full">
                {stalled.length} need attention
              </span>
            </div>
            <div className="space-y-2">
              {stalled.map((deal) => (
                <div
                  key={deal.id}
                  onClick={() => navigate(`/hq/leads/${deal.company_id || deal.id}`)}
                  className="flex items-center gap-3 p-3 rounded-lg border border-status-danger/15 bg-status-danger/5 hover:bg-status-danger/10 cursor-pointer transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{deal.company_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {stageLabel(deal.stage)} · {formatMoney(deal.value)}
                      {deal.next_action ? ` · Next: ${deal.next_action}` : ""}
                    </div>
                  </div>
                  <div className="text-xs font-mono text-status-danger shrink-0">{deal.daysSince}d stalled</div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-status-danger shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
