import { useState, useEffect, useCallback } from "react";
import {
  FileText, Loader2, RefreshCw, ChevronLeft, ChevronRight,
  TrendingUp, MessageSquare, DollarSign, AlertCircle, Zap,
  Calendar, ArrowRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, subWeeks, addWeeks } from "date-fns";

interface WeeklyReport {
  id: string;
  week_start: string;
  week_end: string;
  generated_at: string;
  content: {
    revenue_this_month: number;
    pipeline_weighted: number;
    deals_won: number;
    deals_lost: number;
    outreach_sent: number;
    replies: number;
    advanced: Array<{ company: string; from_stage: string; to_stage: string }>;
    stalled: Array<{ company: string; days: number }>;
    lost_deals: Array<{ company: string; reason: string | null }>;
    whats_working: string;
    whats_not: string;
    next_week_priorities: string[];
    the_decision: string;
  };
}

function formatMoney(n: number) {
  if (n >= 1000) return `£${(n / 1000).toFixed(1)}k`;
  return `£${Math.round(n).toLocaleString()}`;
}

const GOAL = 10000;

export default function HqReport() {
  const { user } = useAuth();

  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadReports = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Load from atlas-specific reports in Supabase reports table or a local cache
      // For now, generate fresh report data from actual data
      setReports([]);
    } catch (err: any) {
      toast.error("Failed to load reports: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const generateReport = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Fetch all necessary data
      const [revRes, outRes, dealRes] = await Promise.all([
        supabase.from("atlas_revenue_summary").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("atlas_outreach").select("status").eq("user_id", user.id).gte("created_at", weekStart.toISOString()),
        supabase.from("atlas_deals").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
      ]);

      const rev = revRes.data ?? {};
      const outData = outRes.data ?? [];
      const deals = (dealRes.data ?? []) as any[];

      const outreach_sent = outData.filter((o: any) => o.status !== "draft").length;
      const replies = outData.filter((o: any) => ["replied", "booked"].includes(o.status)).length;

      const wonDeals = deals.filter((d) => d.stage === "won");
      const lostDeals = deals.filter((d) => d.stage === "lost");
      const activeDeals = deals.filter((d) => !["won", "lost"].includes(d.stage));
      const stalledDeals = activeDeals
        .map((d) => ({ ...d, daysSince: Math.floor((Date.now() - new Date(d.updated_at).getTime()) / 86400000) }))
        .filter((d) => d.daysSince >= 5)
        .slice(0, 3);

      const revenue_this_month = Number(rev.revenue_this_month ?? 0);
      const pipeline_weighted = Number(rev.pipeline_weighted ?? 0);
      const replyRate = outreach_sent > 0 ? Math.round((replies / outreach_sent) * 100) : 0;
      const pct = Math.round((revenue_this_month / GOAL) * 100);

      // Generate AI narrative for the key sections
      let aiContent: { whats_working: string; whats_not: string; the_decision: string } = {
        whats_working: "",
        whats_not: "",
        the_decision: "",
      };

      try {
        const { data: aiData } = await supabase.functions.invoke("sourcing-machine", {
          body: {
            action: "generate-report",
            report_data: {
              revenue_this_month, pipeline_weighted, outreach_sent, replies, replyRate,
              deals_won: wonDeals.length, deals_lost: lostDeals.length,
              active_deals: activeDeals.length, stalled_deals: stalledDeals.length,
              goal: GOAL, pct_of_goal: pct,
            },
          },
        });
        if (aiData) {
          aiContent.whats_working = aiData.whats_working ?? aiData.what_is_working ?? generateWorkingInsight(outreach_sent, replies, replyRate, wonDeals.length);
          aiContent.whats_not = aiData.whats_not ?? aiData.what_is_not ?? generateNotWorkingInsight(stalledDeals.length, outreach_sent, replyRate);
          aiContent.the_decision = aiData.the_decision ?? aiData.decision ?? generateDecision(outreach_sent, stalledDeals, activeDeals, pct);
        }
      } catch {
        // Fall back to rule-based insights
        aiContent.whats_working = generateWorkingInsight(outreach_sent, replies, replyRate, wonDeals.length);
        aiContent.whats_not = generateNotWorkingInsight(stalledDeals.length, outreach_sent, replyRate);
        aiContent.the_decision = generateDecision(outreach_sent, stalledDeals, activeDeals, pct);
      }

      const report: WeeklyReport = {
        id: `report-${Date.now()}`,
        week_start: weekStart.toISOString(),
        week_end: weekEnd.toISOString(),
        generated_at: now.toISOString(),
        content: {
          revenue_this_month,
          pipeline_weighted,
          deals_won: wonDeals.length,
          deals_lost: lostDeals.length,
          outreach_sent,
          replies,
          advanced: [],
          stalled: stalledDeals.map((d) => ({ company: d.company_name, days: d.daysSince })),
          lost_deals: lostDeals.slice(0, 3).map((d) => ({ company: d.company_name, reason: d.lost_reason })),
          whats_working: aiContent.whats_working,
          whats_not: aiContent.whats_not,
          next_week_priorities: generatePriorities(stalledDeals, outreach_sent, activeDeals, pct),
          the_decision: aiContent.the_decision,
        },
      };

      setReports((prev) => [report, ...prev]);
      setCurrentIdx(0);
      toast.success("Weekly report generated");
    } catch (err: any) {
      toast.error("Report generation failed: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  function generateWorkingInsight(sent: number, replies: number, rate: number, won: number): string {
    if (won > 0) return `You closed ${won} deal${won > 1 ? "s" : ""} this period — that's evidence the process works. Double down on what you did to close them.`;
    if (rate > 20) return `${rate}% reply rate — above average for cold outreach. The positioning is working. Send more.`;
    if (sent > 10 && rate > 0) return `${replies} repl${replies === 1 ? "y" : "ies"} from ${sent} messages sent. It's working — not every message converts, that's expected.`;
    if (sent > 0) return `You're in motion — ${sent} message${sent > 1 ? "s" : ""} sent this week. That's the only stat that actually matters right now.`;
    return "The week is blank. No outreach recorded. The system can only show you what's working when you work it.";
  }

  function generateNotWorkingInsight(stalled: number, sent: number, rate: number): string {
    if (sent === 0) return "Nothing went out this week. Zero outreach means zero data. That's the only real problem right now.";
    if (stalled > 2) return `${stalled} deals have gone quiet for 5+ days. Stalled pipeline is not revenue — it's a to-do list that isn't getting done.`;
    if (rate === 0 && sent > 5) return "0% reply rate after multiple messages. The list or the message needs to change — probably the list.";
    return "No critical blockers detected. The constraint right now is volume, not quality.";
  }

  function generateDecision(sent: number, stalled: any[], active: any[], pct: number): string {
    if (stalled.length > 0) {
      const topStall = stalled[0];
      return `Follow up with ${topStall.company} — it's been ${topStall.daysSince} days. One message could reopen this. If no reply in 3 more days, close it and move on.`;
    }
    if (sent < 5) return "Send 10 outreach messages before the end of the week. Nothing else matters more than this right now.";
    if (pct >= 80) return `You're ${pct}% of the way to your £10,000 goal. One deal closes it. Focus exclusively on the most likely deal to close this week.`;
    if (active.length === 0) return "No active deals in the pipeline. Add 10 leads, research 5, and contact 3 before the week ends.";
    return `Pipeline has ${active.length} active deals. Pick the most likely to close and make it your only focus until it's decided.`;
  }

  function generatePriorities(stalled: any[], sent: number, active: any[], pct: number): string[] {
    const p: string[] = [];
    if (stalled.length > 0) p.push(`Follow up with ${stalled.map((d) => d.company).join(", ")} — all stalled 5+ days`);
    if (sent < 10) p.push("Send at least 10 outreach messages this week");
    if (active.length < 5) p.push("Add 5 new leads to the pipeline");
    if (pct < 50) p.push("Research 5 companies and generate personalized outreach for each");
    p.push("Log every interaction — your memory is not a system");
    return p.slice(0, 5);
  }

  const report = reports[currentIdx];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-sm px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-sm font-semibold">Weekly Founder Report</h1>
            <p className="text-xs text-muted-foreground font-mono">Evidence-backed. One decision per week.</p>
          </div>
          <div className="flex items-center gap-2">
            {reports.length > 1 && (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setCurrentIdx((i) => Math.min(i + 1, reports.length - 1))} disabled={currentIdx >= reports.length - 1} className="h-7 w-7 p-0 border-border/60">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground font-mono px-1">{currentIdx + 1}/{reports.length}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentIdx((i) => Math.max(i - 1, 0))} disabled={currentIdx <= 0} className="h-7 w-7 p-0 border-border/60">
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <Button
              size="sm"
              onClick={generateReport}
              disabled={generating}
              className="h-8 bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 text-xs"
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {generating ? "Generating..." : "Generate Report"}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !report ? (
          <div className="rounded-xl border border-dashed border-border/60 p-16 text-center">
            <FileText className="h-14 w-14 mx-auto mb-4 opacity-20" />
            <h3 className="text-sm font-semibold mb-1">No report yet</h3>
            <p className="text-xs text-muted-foreground mb-6 max-w-xs mx-auto">
              Generate your first weekly report. It pulls live data from your pipeline and outreach to give you one clear decision.
            </p>
            <Button
              onClick={generateReport}
              disabled={generating}
              className="bg-primary text-primary-foreground gap-2"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {generating ? "Generating..." : "Generate First Report"}
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Report header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">
                  Week of {format(new Date(report.week_start), "d MMM")} – {format(new Date(report.week_end), "d MMM yyyy")}
                </h2>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">Generated {format(new Date(report.generated_at), "d MMM · HH:mm")}</p>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            {/* Revenue section */}
            <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                <DollarSign className="h-4 w-4 text-emerald-400" />
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Revenue</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "This month", value: formatMoney(report.content.revenue_this_month), color: "text-emerald-400" },
                  { label: "Pipeline (weighted)", value: formatMoney(report.content.pipeline_weighted), color: "text-primary" },
                  { label: "Deals won", value: report.content.deals_won, color: "text-emerald-400" },
                  { label: "Deals lost", value: report.content.deals_lost, color: "text-red-400" },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg bg-muted/20 border border-border/30 p-3">
                    <div className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
              {/* Goal progress */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Monthly goal: {formatMoney(GOAL)}</span>
                  <span className="font-mono">{Math.round((report.content.revenue_this_month / GOAL) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                    style={{ width: `${Math.min(100, Math.round((report.content.revenue_this_month / GOAL) * 100))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Outreach section */}
            <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                <MessageSquare className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Outreach</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Sent this week", value: report.content.outreach_sent, color: "text-foreground" },
                  { label: "Replies", value: report.content.replies, color: report.content.replies > 0 ? "text-emerald-400" : "text-muted-foreground" },
                  {
                    label: "Reply rate",
                    value: report.content.outreach_sent > 0
                      ? `${Math.round((report.content.replies / report.content.outreach_sent) * 100)}%`
                      : "—",
                    color: "text-primary"
                  },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg bg-muted/20 border border-border/30 p-3">
                    <div className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stalled deals */}
            {report.content.stalled.length > 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                  <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Stalled Deals</h3>
                </div>
                <div className="space-y-1.5">
                  {report.content.stalled.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span>{d.company}</span>
                      <span className="text-xs font-mono text-amber-400">{d.days} days no movement</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* What's working */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">What's Working</h3>
              </div>
              <p className="text-sm">{report.content.whats_working}</p>
            </div>

            {/* What's not */}
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider">What's Not</h3>
              </div>
              <p className="text-sm">{report.content.whats_not}</p>
            </div>

            {/* Next week priorities */}
            <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Next Week Priorities</h3>
              <ol className="space-y-2">
                {report.content.next_week_priorities.map((p, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <span className="text-primary font-mono font-bold text-xs mt-0.5 shrink-0">{i + 1}.</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* The Decision */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">The Decision</h3>
              </div>
              <p className="text-sm font-medium">{report.content.the_decision}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
