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

interface RevenueData {
  revenue_this_month: number;
  pipeline_weighted: number;
  deals_won_this_month: number;
  deals_lost_this_month: number;
  avg_deal_size: number;
  active_deals: number;
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

const GOAL = 10000;
const CURRENCY = "£";

function formatMoney(n: number) {
  if (n >= 1000) return `${CURRENCY}${(n / 1000).toFixed(1)}k`;
  return `${CURRENCY}${Math.round(n).toLocaleString()}`;
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
  const { user } = useAuth();
  const navigate = useNavigate();

  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [stalled, setStalled] = useState<StalledDeal[]>([]);
  const [outreachStats, setOutreachStats] = useState<OutreachStats>({ sentThisWeek: 0, repliesThisWeek: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nba, setNba] = useState<{ company: string; companyId: string; action: string; reason: string; value: string; confidence: number } | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    try {
      // Revenue summary
      const { data: revRow } = await supabase
        .from("atlas_revenue_summary")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      const rev: RevenueData = revRow
        ? {
            revenue_this_month: Number(revRow.revenue_this_month ?? 0),
            pipeline_weighted: Number(revRow.pipeline_weighted ?? 0),
            deals_won_this_month: Number(revRow.deals_won_this_month ?? 0),
            deals_lost_this_month: Number(revRow.deals_lost_this_month ?? 0),
            avg_deal_size: Number(revRow.avg_deal_size ?? 0),
            active_deals: Number(revRow.active_deals ?? 0),
          }
        : { revenue_this_month: 0, pipeline_weighted: 0, deals_won_this_month: 0, deals_lost_this_month: 0, avg_deal_size: 0, active_deals: 0 };
      setRevenue(rev);

      // Follow-ups due
      const today = new Date().toISOString().split("T")[0];
      const { data: fuData } = await supabase
        .from("atlas_outreach")
        .select("id, company_id, subject, type, follow_up_due, status")
        .eq("user_id", user.id)
        .lte("follow_up_due", today)
        .in("status", ["sent", "draft"])
        .order("follow_up_due", { ascending: true })
        .limit(8);

      // Get company names for follow-ups
      const fuCompanyIds = [...new Set((fuData ?? []).map((f: any) => f.company_id))];
      let fuCompanyMap: Record<string, string> = {};
      if (fuCompanyIds.length > 0) {
        const { data: comps } = await supabase
          .from("pipeline_crm")
          .select("id, company")
          .in("id", fuCompanyIds);
        (comps ?? []).forEach((c: any) => { fuCompanyMap[c.id] = c.company; });
      }
      setFollowUps((fuData ?? []).map((f: any) => ({ ...f, company_name: fuCompanyMap[f.company_id] ?? "Unknown" })));

      // Stalled deals (no update in 5+ days, not won/lost)
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

      // Outreach stats this week
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

      // Next Best Action — computed from real data, not AI prose
      // Priority: overdue follow-up on highest value deal > stalled deal > no outreach sent
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

    } catch (err: any) {
      console.error(err);
      toast.error("Dashboard load error: " + err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);



  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
  };

  const revenuePercent = revenue ? Math.min(100, Math.round((revenue.revenue_this_month / GOAL) * 100)) : 0;
  const today = format(new Date(), "EEEE, d MMMM yyyy");

  if (loading) {
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
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-sm px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-foreground">Morning Brief</h1>
          <p className="text-xs text-muted-foreground font-mono">{today}</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Revenue ticker */}
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
            <DollarSign className="h-3 w-3 text-emerald-400" />
            <span className="text-emerald-400 font-semibold">{formatMoney(revenue?.revenue_this_month ?? 0)}</span>
            <span className="text-muted-foreground">/ {formatMoney(GOAL)} goal</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">Pipeline: {formatMoney(revenue?.pipeline_weighted ?? 0)}</span>
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

      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Revenue Progress */}
        <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-foreground font-mono tracking-tight">
                {formatMoney(revenue?.revenue_this_month ?? 0)}
                <span className="text-sm font-normal text-muted-foreground ml-2">/ {formatMoney(GOAL)} goal</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{revenuePercent}% of monthly target</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Pipeline (weighted)</div>
              <div className="text-lg font-bold font-mono text-primary mt-0.5">{formatMoney(revenue?.pipeline_weighted ?? 0)}</div>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700"
              style={{ width: `${revenuePercent}%` }}
            />
          </div>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            {[
              { label: "Won this month", value: revenue?.deals_won_this_month ?? 0, unit: "deals", color: "text-emerald-400" },
              { label: "Lost this month", value: revenue?.deals_lost_this_month ?? 0, unit: "deals", color: "text-red-400" },
              { label: "Active deals", value: revenue?.active_deals ?? 0, unit: "open", color: "text-primary" },
              { label: "Avg deal size", value: formatMoney(revenue?.avg_deal_size ?? 0), unit: "", color: "text-amber-400", raw: true },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg bg-muted/20 border border-border/40 p-3">
                <div className={`text-lg font-bold font-mono ${stat.color}`}>
                  {stat.raw ? stat.value : stat.value}{!stat.raw && <span className="text-xs text-muted-foreground ml-1">{stat.unit}</span>}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ⚡ Next Best Action */}
        {nba && (
          <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-primary uppercase tracking-wider">Next Best Action</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-mono text-primary/70">
                <span>{nba.confidence}% confidence</span>
              </div>
            </div>
            <div>
              <p className="text-base font-bold tracking-tight">{nba.action}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{nba.reason}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 rounded">Deal value: {nba.value}</span>
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
        )}

        {/* Legacy insight for when no NBA is available */}
        {!nba && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
            <Zap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-primary mb-0.5 uppercase tracking-wider">Atlas</div>
              <p className="text-sm text-foreground">{aiInsight}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Follow-ups Due */}
          <div className="lg:col-span-2 rounded-xl border border-border/60 bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-semibold">Follow-ups Due</h2>
                {followUps.length > 0 && (
                  <span className="text-xs font-mono bg-amber-500/15 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
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
                      className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-muted/10 hover:bg-muted/30 cursor-pointer transition-colors group"
                    >
                      <div className={`h-2 w-2 rounded-full shrink-0 ${overdue ? "bg-red-400" : "bg-amber-400"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{fu.company_name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {typeLabel(fu.type)}{fu.subject ? ` · ${fu.subject}` : ""}
                        </div>
                      </div>
                      <div className={`text-xs font-mono shrink-0 ${overdue ? "text-red-400" : "text-amber-400"}`}>
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
          <div className="space-y-4">
            {/* Outreach this week */}
            <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">This Week</h2>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: "Outreach sent", value: outreachStats.sentThisWeek, color: "text-foreground" },
                  {
                    label: "Replies received",
                    value: outreachStats.repliesThisWeek,
                    color: outreachStats.repliesThisWeek > 0 ? "text-emerald-400" : "text-muted-foreground"
                  },
                  {
                    label: "Reply rate",
                    value: outreachStats.sentThisWeek > 0
                      ? `${Math.round((outreachStats.repliesThisWeek / outreachStats.sentThisWeek) * 100)}%`
                      : "—",
                    color: "text-primary"
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
            <div className="rounded-xl border border-border/60 bg-card p-5 space-y-2">
              <h2 className="text-sm font-semibold mb-3">Quick Actions</h2>
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
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <h2 className="text-sm font-semibold text-red-400">Stalled Deals</h2>
              <span className="text-xs font-mono bg-red-500/15 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-full">
                {stalled.length} need attention
              </span>
            </div>
            <div className="space-y-2">
              {stalled.map((deal) => (
                <div
                  key={deal.id}
                  onClick={() => navigate(`/hq/leads/${deal.company_id || deal.id}`)}
                  className="flex items-center gap-3 p-3 rounded-lg border border-red-500/15 bg-red-500/5 hover:bg-red-500/10 cursor-pointer transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{deal.company_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {stageLabel(deal.stage)} · {formatMoney(deal.value)}
                      {deal.next_action ? ` · Next: ${deal.next_action}` : ""}
                    </div>
                  </div>
                  <div className="text-xs font-mono text-red-400 shrink-0">{deal.daysSince}d stalled</div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-red-400 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
