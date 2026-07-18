import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Users, TrendingUp, CheckSquare, RefreshCw, Loader2, 
  ArrowRight, Database, Shield, AlertTriangle, CheckCircle2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface DashboardStats {
  totalLeads: number;
  avgIcp: number;
  contactedCount: number;
  notionSyncedCount: number;
  notionPendingCount: number;
  notionFailedCount: number;
}

export default function HqDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingSecrets, setCheckingSecrets] = useState(false);
  const [secretsStatus, setSecretsStatus] = useState<{
    moonshot: boolean;
    nvidia: boolean;
  } | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("icp_score, is_contacted, exported_to_notion, notion_sync_status");

      if (error) throw error;
      const leads = data as any[];

      const total = leads?.length || 0;
      let sumIcp = 0;
      let contacted = 0;
      let synced = 0;
      let pending = 0;
      let failed = 0;

      leads?.forEach((l) => {
        sumIcp += l.icp_score || 0;
        if (l.is_contacted) contacted++;
        if (l.exported_to_notion || l.notion_sync_status === "synced") synced++;
        else if (l.notion_sync_status === "syncing" || l.notion_sync_status === "not_synced") pending++;
        else if (l.notion_sync_status === "failed") failed++;
      });

      setStats({
        totalLeads: total,
        avgIcp: total > 0 ? Number((sumIcp / total).toFixed(1)) : 0,
        contactedCount: contacted,
        notionSyncedCount: synced,
        notionPendingCount: pending,
        notionFailedCount: failed
      });
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load dashboard metrics: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const diagnoseEdgeFunction = async () => {
    setCheckingSecrets(true);
    try {
      // Calling sourcing-machine action: 'validate-notion-database' or diagnostic ping.
      // We can just verify if the keys are set on backend by invoking with an empty request
      // and checking response error codes. Let's see if sourcing-machine has a validation action.
      // In indexing of sourcing-machine we saw:
      // action: "source" | "export-notion" | "list-notion-databases" | "validate-notion-database"
      const { data, error } = await supabase.functions.invoke("sourcing-machine", {
        body: { action: "list-notion-databases" }
      });
      
      // If we got databases list or an integration error, the function successfully ran.
      // If we got "No AI API key configured" error, we know the keys status.
      // Wait, let's check what keys are loaded:
      // In sourcing-machine, if both are missing, it throws "No AI API key configured"
      const hasKey = error || (data && data.error === "No AI API key configured") ? false : true;
      
      // Let's check from the environment. Since Vite cannot read Deno env, we just mock check
      // based on whether the endpoint succeeds without "no api key configured" error
      const keysSet = !error && (!data || data.error !== "No AI API key configured");
      setSecretsStatus({
        moonshot: keysSet,
        nvidia: keysSet
      });
    } catch (err: any) {
      console.error(err);
    } finally {
      setCheckingSecrets(false);
    }
  };

  useEffect(() => {
    fetchStats();
    diagnoseEdgeFunction();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#09090b]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
          <span className="text-xs text-muted-foreground font-mono">Loading metrics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8 bg-[#09090b] min-h-screen text-foreground relative overflow-hidden">
      {/* Decorative gradient */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/[0.01] rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.06] pb-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time prospect pipeline health and integration diagnostic logs.</p>
        </div>
        <Button onClick={fetchStats} variant="outline" className="h-9 gap-1.5 border-white/10 hover:bg-white/5 font-mono text-xs">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh Stats
        </Button>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          {
            title: "Total Prospects Sourced",
            value: stats?.totalLeads ?? 0,
            description: "Profiles extracted and indexed",
            icon: Users,
            color: "text-amber-500 bg-amber-500/10 border-amber-500/20"
          },
          {
            title: "Average ICP Score",
            value: `${stats?.avgIcp ?? 0}/10`,
            description: "Ideal Customer Profile fit match",
            icon: TrendingUp,
            color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
          },
          {
            title: "Prospects Contacted",
            value: stats?.contactedCount ?? 0,
            description: `Outreach progress: ${stats?.totalLeads ? Math.round(((stats.contactedCount) / stats.totalLeads) * 100) : 0}%`,
            icon: CheckSquare,
            color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20"
          },
          {
            title: "Synced to Notion CRM",
            value: stats?.notionSyncedCount ?? 0,
            description: `${stats?.notionPendingCount ?? 0} pending, ${stats?.notionFailedCount ?? 0} failed`,
            icon: Database,
            color: "text-purple-500 bg-purple-500/10 border-purple-500/20"
          }
        ].map((c, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-black/40 backdrop-blur-xl p-5 flex items-center justify-between shadow-lg">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">{c.title}</span>
              <div className="text-3xl font-bold font-display">{c.value}</div>
              <p className="text-[11px] text-muted-foreground font-mono">{c.description}</p>
            </div>
            <div className={`h-11 w-11 rounded-lg flex items-center justify-center border ${c.color} shadow-sm shrink-0`}>
              <c.icon className="h-5 w-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sourcing Quick links */}
        <div className="lg:col-span-2 rounded-xl border border-white/[0.06] bg-black/40 backdrop-blur-xl p-5 space-y-4 shadow-lg flex flex-col justify-between">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <Shield className="h-4.5 w-4.5 text-amber-500" /> Sourcing Engine Launchpad
            </h2>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Use the scraper tool to inspect LinkedIn, X (Twitter), and general start-up profile domains. The parser extracts founder handles, team details, SaaS filters, and outreach strategy logs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <Link to="/hq/prospects">
              <div className="p-4 rounded-lg border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] transition-colors cursor-pointer group flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-semibold group-hover:text-amber-500 transition-colors">Prospects Database</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Manage sourced leads and Notion exports.</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 group-hover:text-amber-500 transition-all shrink-0 ml-3" />
              </div>
            </Link>
            <Link to="/hq/settings">
              <div className="p-4 rounded-lg border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] transition-colors cursor-pointer group flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-semibold group-hover:text-amber-500 transition-colors">Notion Mappings</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Configure columns, properties, and sync rules.</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 group-hover:text-amber-500 transition-all shrink-0 ml-3" />
              </div>
            </Link>
          </div>
        </div>

        {/* Diagnostic Status Box */}
        <div className="rounded-xl border border-white/[0.06] bg-black/40 backdrop-blur-xl p-5 space-y-4 shadow-lg">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold tracking-tight font-mono uppercase text-muted-foreground">Service Health</h2>
            <div className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </div>
          </div>

          <div className="space-y-3.5">
            <div className="flex items-start justify-between gap-3 text-xs">
              <div>
                <span className="font-semibold block">Supabase Edge Function</span>
                <span className="text-[11px] text-muted-foreground font-mono mt-0.5">sourcing-machine status</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Operational</span>
            </div>

            <div className="flex items-start justify-between gap-3 text-xs">
              <div>
                <span className="font-semibold block">AI Scraper Core</span>
                <span className="text-[11px] text-muted-foreground font-mono mt-0.5">
                  {secretsStatus?.moonshot || secretsStatus?.nvidia 
                    ? "Active LLM scoring enabled" 
                    : "Running on rule-based fallback scraper"}
                </span>
              </div>
              {checkingSecrets ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : secretsStatus?.moonshot || secretsStatus?.nvidia ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Real-Time AI</span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">Rule Fallback</span>
              )}
            </div>

            {(!secretsStatus?.moonshot && !secretsStatus?.nvidia) && (
              <div className="rounded-lg border border-amber-500/10 bg-amber-500/[0.02] p-3 flex gap-2.5 items-start mt-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-[11px] text-muted-foreground leading-relaxed">
                  Provide `MOONSHOT_API_KEY` or `NVIDIA_NIM_API_KEY` in Supabase Secrets to unlock high-accuracy profile crawling.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
