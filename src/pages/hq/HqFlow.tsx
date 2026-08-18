import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Zap, Search, Play, Pause, Square, CheckCircle2,
  Copy, Send, AlertTriangle, Sparkles, Building2,
  User, ExternalLink, RefreshCw, FolderArchive,
  Terminal, ShieldCheck, Mail, Linkedin, TrendingUp,
  Settings2, Activity
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function HqFlow() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Run State
  const [activeRun, setActiveRun] = useState<any>(null);
  const [targetInput, setTargetInput] = useState("20");
  const [logs, setLogs] = useState<{ time: string; msg: string }[]>([]);
  const [pendingLead, setPendingLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Poll interval reference
  const pollInterval = useRef<any>(null);

  useEffect(() => {
    if (user) fetchActiveRun();
    return () => clearInterval(pollInterval.current);
  }, [user]);

  const addLog = (msg: string) => {
    setLogs(prev => {
      const newLogs = [{ time: new Date().toLocaleTimeString(), msg }, ...prev];
      return newLogs.slice(0, 50); // Keep last 50 logs
    });
  };

  const fetchActiveRun = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("acquisition_runs")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["idle", "running", "awaiting_approval"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setActiveRun(data);
        if (data.status === "awaiting_approval" && data.current_lead_id) {
          fetchPendingLead(data.current_lead_id);
        } else {
          setPendingLead(null);
        }
      } else {
        setActiveRun(null);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchPendingLead = async (leadId: string) => {
    const { data } = await supabase.from("kuro_pipeline_view").select("*").eq("id", leadId).single();
    if (data) {
      setPendingLead(data);
    }
  };

  const startNewRun = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("acquisition_runs")
      .insert({
        user_id: user.id,
        target: parseInt(targetInput) || 20,
        status: "running",
        current_stage: "initializing"
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to start run");
      return;
    }

    setActiveRun(data);
    addLog(`Started new acquisition run with target ${data.target}`);
    toast.success("Acquisition Runner Started");
    startPolling();
  };

  const toggleRun = async () => {
    if (!activeRun) return;
    
    const newStatus = activeRun.status === "running" ? "idle" : "running";
    const { data, error } = await supabase
      .from("acquisition_runs")
      .update({ status: newStatus })
      .eq("id", activeRun.id)
      .select()
      .single();

    if (!error && data) {
      setActiveRun(data);
      addLog(`Run ${newStatus === 'running' ? 'resumed' : 'paused'}`);
      if (newStatus === "running") {
        startPolling();
      } else {
        clearInterval(pollInterval.current);
      }
    }
  };

  const stopRun = async () => {
    if (!activeRun) return;
    const { data, error } = await supabase
      .from("acquisition_runs")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", activeRun.id)
      .select()
      .single();

    if (!error) {
      setActiveRun(null);
      clearInterval(pollInterval.current);
      addLog("Run forcefully stopped.");
      toast.success("Run completed.");
    }
  };

  const startPolling = () => {
    clearInterval(pollInterval.current);
    pollInterval.current = setInterval(async () => {
      if (!activeRun || activeRun.status !== "running") return;
      
      try {
        const { data, error } = await supabase.functions.invoke("step-acquisition", {
          body: { run_id: activeRun.id }
        });
        
        if (data && data.message) {
          addLog(data.message);
        }
        
        // Refresh state
        fetchActiveRun();
      } catch (e: any) {
        addLog(`Error: ${e.message}`);
      }
    }, 10000); // Poll every 10 seconds to step the acquisition loop
  };

  useEffect(() => {
    if (activeRun && activeRun.status === "running" && !pollInterval.current) {
      startPolling();
    } else if (activeRun?.status !== "running") {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
  }, [activeRun]);

  const approveLead = async () => {
    if (!activeRun || !pendingLead) return;
    addLog(`Approved lead: ${pendingLead.company}`);
    
    // Mark lead as contacted
    await supabase.from("kuro_pipeline_view").update({ is_contacted: true }).eq("id", pendingLead.id);
    
    // Update run
    await supabase
      .from("acquisition_runs")
      .update({ 
        status: "running", 
        contacted_count: activeRun.contacted_count + 1 
      })
      .eq("id", activeRun.id);
      
    toast.success("Lead approved and marked as contacted");
    setPendingLead(null);
    fetchActiveRun();
  };

  const rejectLead = async () => {
    if (!activeRun || !pendingLead) return;
    addLog(`Rejected lead: ${pendingLead.company}`);
    
    // Mark draft as null to re-draft or just ignore
    await supabase.from("kuro_pipeline_view").update({ is_contacted: true, notes: "Rejected by human" }).eq("id", pendingLead.id);
    
    // Resume run
    await supabase
      .from("acquisition_runs")
      .update({ status: "running" })
      .eq("id", activeRun.id);
      
    toast.info("Lead rejected");
    setPendingLead(null);
    fetchActiveRun();
  };

  if (loading) return <div className="h-screen w-screen flex items-center justify-center"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground flex flex-col relative font-sans">
      {/* HEADER */}
      <header className="h-14 border-b border-border/60 bg-card/60 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs font-mono">
            ◈
          </div>
          <span className="font-bold text-sm font-display tracking-tight text-foreground">Atlas Acquisition Engine</span>
          <div className="w-px h-4 bg-border/60" />
          <span className="text-xs text-muted-foreground font-mono flex items-center gap-2">
            <Activity className="w-3.5 h-3.5" />
            {activeRun ? `Status: ${activeRun.status.toUpperCase()}` : "IDLE"}
          </span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 md:p-12">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT COLUMN: CONTROL & METRICS */}
          <div className="lg:col-span-1 space-y-6">
            
            <div className="bg-card border border-border/80 rounded-xl p-6 space-y-6">
              <div>
                <h2 className="text-lg font-display font-bold">Acquisition Runner</h2>
                <p className="text-xs text-muted-foreground mt-1">Configure and manage continuous sourcing loops.</p>
              </div>

              {!activeRun ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-muted-foreground uppercase">Daily Target (Sent Outreach)</label>
                    <Input 
                      type="number" 
                      value={targetInput} 
                      onChange={e => setTargetInput(e.target.value)} 
                      className="bg-background"
                    />
                  </div>
                  <Button onClick={startNewRun} className="w-full gap-2">
                    <Play className="w-4 h-4" /> Start Engine
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-mono text-muted-foreground">Progress</p>
                      <p className="text-2xl font-bold font-mono">{activeRun.contacted_count} / {activeRun.target}</p>
                    </div>
                    <Badge variant={activeRun.status === "running" ? "default" : "secondary"} className="uppercase">
                      {activeRun.status}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-muted-foreground">Sourced</span>
                      <span>{activeRun.discovered_count}</span>
                    </div>
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-muted-foreground">Qualified</span>
                      <span>{activeRun.qualified_count}</span>
                    </div>
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-muted-foreground">Researched</span>
                      <span>{activeRun.researched_count}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant={activeRun.status === "running" ? "outline" : "default"} 
                      onClick={toggleRun}
                      className="gap-2"
                    >
                      {activeRun.status === "running" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      {activeRun.status === "running" ? "Pause" : "Resume"}
                    </Button>
                    <Button variant="destructive" onClick={stopRun} className="gap-2">
                      <Square className="w-4 h-4" /> Stop
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-card border border-border/80 rounded-xl overflow-hidden flex flex-col h-80">
              <div className="p-4 border-b border-border/40 bg-secondary/30 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary" />
                <span className="text-xs font-mono font-bold">Engine Logs</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#0a0a0a]">
                {logs.length === 0 ? (
                  <p className="text-xs font-mono text-muted-foreground">No activity yet...</p>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="text-[11px] font-mono flex gap-3">
                      <span className="text-muted-foreground shrink-0">[{log.time}]</span>
                      <span className="text-green-400">{log.msg}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: QUEUE & APPROVAL */}
          <div className="lg:col-span-2 space-y-6">
            
            {activeRun?.status === "awaiting_approval" && pendingLead ? (
              <div className="bg-card border-2 border-primary/50 rounded-xl p-6 shadow-lg shadow-primary/5 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-widest font-mono">
                    <AlertTriangle className="w-4 h-4" />
                    Human Approval Required
                  </div>
                  <Badge className="bg-primary/20 text-primary hover:bg-primary/20 border-primary/30">
                    Lead #{pendingLead.id.split('-')[0]}
                  </Badge>
                </div>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-2xl font-bold font-display">{pendingLead.company}</h3>
                    <p className="text-muted-foreground text-sm">{pendingLead.website}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-secondary/40 rounded-lg p-4 space-y-1">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">ICP Score</span>
                      <p className="font-bold text-lg">{pendingLead.icp_score}/100</p>
                    </div>
                    <div className="bg-secondary/40 rounded-lg p-4 space-y-1">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">Opportunity Score</span>
                      <p className="font-bold text-lg">{pendingLead.opportunity_score}/100</p>
                    </div>
                  </div>

                  {pendingLead.research_data && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold font-mono text-muted-foreground uppercase">Pain Hypothesis</h4>
                      <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-4">
                        <p className="text-sm text-rose-200">
                          {typeof pendingLead.research_data === 'string' 
                            ? pendingLead.research_data 
                            : pendingLead.research_data.bottleneck?.hypothesis || JSON.stringify(pendingLead.research_data)}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h4 className="text-sm font-bold font-mono text-muted-foreground uppercase">Drafted Outreach</h4>
                    <div className="bg-background border border-border rounded-lg p-4 font-mono text-sm whitespace-pre-wrap text-foreground/90 leading-relaxed">
                      {pendingLead.outreach_draft}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40">
                    <Button variant="ghost" onClick={rejectLead}>Reject / Skip</Button>
                    <Button className="bg-primary text-primary-foreground gap-2" onClick={approveLead}>
                      <Send className="w-4 h-4" /> Approve & Dispatch
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full border border-border/40 border-dashed rounded-xl flex flex-col items-center justify-center p-12 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Queue is Empty</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto mt-2">
                    {activeRun 
                      ? "The engine is currently sourcing and qualifying leads. Approvals will appear here." 
                      : "Start the Acquisition Engine to begin discovering and drafting targets automatically."}
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
