import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Play, Pause, Square, CheckCircle2,
  Send, AlertTriangle, Activity, Check,
  ChevronRight, Sparkles, User, Info, Building
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

export default function HqFlow() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Run State
  const [activeRun, setActiveRun] = useState<any>(null);
  const [targetInput, setTargetInput] = useState("20");
  const [logs, setLogs] = useState<{ time: string; msg: string; type?: string }[]>([]);
  const [pendingLead, setPendingLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Use a ref for activeRun to avoid stale closures in setInterval
  const activeRunRef = useRef<any>(null);
  useEffect(() => {
    activeRunRef.current = activeRun;
  }, [activeRun]);

  // Poll interval reference
  const pollInterval = useRef<any>(null);

  useEffect(() => {
    if (user) fetchActiveRun();
    return () => clearInterval(pollInterval.current);
  }, [user]);

  const addLog = (msg: string, type: string = "info") => {
    setLogs(prev => {
      const newLogs = [{ time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), msg, type }, ...prev];
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
        .in("status", ["idle", "running", "awaiting_approval", "completed", "failed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setActiveRun(data);
        if (data.current_lead_id) {
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
    addLog(`Started new acquisition run with target ${data.target}`, "success");
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
      addLog(`Run ${newStatus === 'running' ? 'resumed' : 'paused'}`, "info");
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
      setActiveRun(data);
      clearInterval(pollInterval.current);
      addLog("Run forcefully stopped.", "warning");
      toast.success("Run completed.");
    }
  };

  const startPolling = () => {
    clearInterval(pollInterval.current);
    pollInterval.current = setInterval(async () => {
      const currentRun = activeRunRef.current;
      if (!currentRun || currentRun.status !== "running") return;
      
      try {
        const { data, error } = await supabase.functions.invoke("step-acquisition", {
          body: { run_id: currentRun.id }
        });
        
        if (error) {
          addLog(`Edge Function Error: ${error.message}`, "error");
        } else if (data && data.message) {
          addLog(data.message, data.message.toLowerCase().includes("sent") ? "success" : "info");
        }
        
        fetchActiveRun();
      } catch (e: any) {
        addLog(`Error: ${e.message}`, "error");
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
    addLog(`Copying email for ${pendingLead.company}...`, "info");
    
    try {
      let emailSubject = `Quick question regarding ${pendingLead.company}`;
      let emailBody = pendingLead.outreach_draft || pendingLead.draft_message || "Hello";

      try {
        if (emailBody.trim().startsWith('{')) {
          const parsed = JSON.parse(emailBody);
          if (parsed.subject) emailSubject = parsed.subject;
          if (parsed.body) emailBody = parsed.body;
        }
      } catch (e) {
        // Fallback to raw
      }

      // Copy to clipboard
      const textToCopy = `Subject: ${emailSubject}\n\n${emailBody}`;
      try {
        await navigator.clipboard.writeText(textToCopy);
        addLog(`✓ Draft copied to clipboard! Paste into Gmail.`, "success");
      } catch (e) {
        addLog(`✓ Marked as contacted. (Please copy draft manually)`, "success");
      }
      
      // Update pipeline view
      await supabase.from("kuro_pipeline_view").update({ is_contacted: true, stage: "contacted" }).eq("id", pendingLead.id);
      
      await supabase
        .from("acquisition_runs")
        .update({ 
          status: "running", 
          contacted_count: activeRun.contacted_count + 1,
          current_stage: "sending"
        })
        .eq("id", activeRun.id);
        
      setPendingLead(null);
      fetchActiveRun();
    } catch (e: any) {
      addLog(`Failed: ${e.message}`, "error");
    }
  };

  const rejectLead = async () => {
    if (!activeRun || !pendingLead) return;
    addLog(`Skipped lead: ${pendingLead.company}`, "warning");
    
    await supabase.from("kuro_pipeline_view").update({ is_contacted: true, notes: "Rejected by human" }).eq("id", pendingLead.id);
    
    await supabase
      .from("acquisition_runs")
      .update({ status: "running" })
      .eq("id", activeRun.id);
      
    setPendingLead(null);
    fetchActiveRun();
  };

  if (loading && !activeRun) return <div className="h-full flex items-center justify-center bg-background"><div className="animate-pulse w-8 h-8 rounded-full bg-primary/20" /></div>;

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const isRunning = activeRun?.status === "running";
  const isCompleted = activeRun?.status === "completed";
  const isAwaiting = activeRun?.status === "awaiting_approval";
  const target = activeRun?.target || parseInt(targetInput) || 20;
  const contacted = activeRun?.contacted_count || 0;
  const progressPercent = Math.min(100, Math.round((contacted / target) * 100));

  // Determine header status
  let headerStatus = "Ready";
  let headerColor = "text-muted-foreground";
  if (isRunning) { headerStatus = "● RUNNING"; headerColor = "text-emerald-500 animate-pulse"; }
  else if (isCompleted) { headerStatus = "✓ DAILY TARGET REACHED"; headerColor = "text-primary"; }
  else if (isAwaiting) { headerStatus = "● NEEDS ATTENTION"; headerColor = "text-amber-500"; }
  else if (activeRun?.status === "idle") { headerStatus = "● PAUSED"; headerColor = "text-amber-500"; }

  return (
    <div className="h-full w-full overflow-y-auto bg-background text-foreground flex flex-col font-sans">
      
      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header className="px-8 py-6 border-b border-border/40 shrink-0">
        <h1 className="text-2xl font-display font-bold uppercase tracking-wide">Acquisition</h1>
        <div className="flex items-center gap-4 mt-1">
          <span className="text-sm text-muted-foreground">{today}</span>
          <span className="text-muted-foreground/30">|</span>
          <span className={`text-sm font-bold tracking-widest uppercase transition-colors duration-300 ${headerColor}`}>
            {headerStatus}
          </span>
        </div>
      </header>

      <main className="flex-1 p-8">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* ── LEFT COLUMN (Progress & Live Ops) ─────────────────────────── */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* HERO PROGRESS SYSTEM */}
            <section className="bg-card border border-border/60 rounded-2xl p-8 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="flex justify-between items-end mb-4 relative z-10">
                <div className="space-y-1">
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-display font-bold tabular-nums transition-all duration-300 ease-out">{contacted}</span>
                    <span className="text-2xl font-display text-muted-foreground">/ {target}</span>
                  </div>
                  <p className="text-sm font-bold tracking-widest text-muted-foreground uppercase">Contacted Today</p>
                </div>
                <div className="text-right space-y-1">
                  <span className="text-2xl font-display font-bold text-primary transition-all duration-300">{progressPercent}%</span>
                  <p className="text-sm font-bold tracking-widest text-muted-foreground uppercase">{Math.max(0, target - contacted)} Remaining</p>
                </div>
              </div>

              <div className="relative z-10 mt-6 h-3 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="absolute top-0 left-0 h-full bg-primary transition-all duration-700 ease-out shadow-[0_0_15px_rgba(var(--primary),0.5)]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="mt-8 flex gap-3 relative z-10">
                {!activeRun || isCompleted ? (
                  <div className="flex w-full gap-3">
                    <div className="flex-1">
                      <Input 
                        type="number" 
                        value={targetInput} 
                        onChange={e => setTargetInput(e.target.value)} 
                        className="h-12 bg-background border-border/50 text-center font-mono text-lg"
                        placeholder="Daily Target"
                        disabled={!!activeRun && !isCompleted}
                      />
                    </div>
                    <Button onClick={startNewRun} className="flex-2 h-12 px-8 font-bold tracking-widest uppercase transition-all duration-200">
                      Run Acquisition
                    </Button>
                  </div>
                ) : (
                  <div className="flex w-full gap-3">
                    <Button 
                      variant={isRunning ? "outline" : "default"} 
                      onClick={toggleRun}
                      className="flex-1 h-12 font-bold tracking-widest uppercase transition-all duration-200"
                    >
                      {isRunning ? "● Acquisition Running" : "► Resume Run"}
                    </Button>
                    <Button variant="ghost" onClick={stopRun} className="h-12 px-6 hover:bg-destructive/10 hover:text-destructive transition-colors">
                      Stop
                    </Button>
                  </div>
                )}
              </div>
            </section>

            {/* LIVE OPERATION CARD */}
            {activeRun && !isCompleted && (
              <section className="bg-surface-2 border border-border/50 rounded-2xl p-6 transition-all duration-300">
                <div className="flex items-center gap-2 mb-6">
                  <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  <span className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Live Operation</span>
                </div>

                <div className="space-y-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-primary mb-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-1">
                      ● {activeRun.current_stage || "INITIALIZING"}
                    </span>
                    {pendingLead ? (
                      <div className="animate-in fade-in slide-in-from-right-2 duration-300 ease-out">
                        <h3 className="text-2xl font-display font-bold">{pendingLead.company}</h3>
                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                          <Building className="w-3.5 h-3.5" /> 
                          {pendingLead.website || "Unknown location"}
                        </p>
                      </div>
                    ) : (
                      <div className="h-16 flex items-center">
                        <span className="text-muted-foreground italic text-sm">Scanning directories for qualified targets...</span>
                      </div>
                    )}
                  </div>

                  {pendingLead && (
                    <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-500 delay-150 fill-mode-both">
                      <div className="border border-border/40 bg-background/50 rounded-lg p-4">
                        <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">ICP FIT</span>
                        <div className="text-xl font-mono mt-1">{pendingLead.icp_score || "--"}</div>
                      </div>
                      <div className="border border-border/40 bg-background/50 rounded-lg p-4">
                        <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">OPPORTUNITY</span>
                        <div className="text-xl font-mono mt-1">{pendingLead.opportunity_score || "--"}</div>
                      </div>
                    </div>
                  )}

                  {pendingLead?.research_data && (
                    <div className="border border-border/40 bg-background/50 rounded-lg p-4 animate-in fade-in duration-500 delay-300 fill-mode-both">
                      <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">Current Hypothesis</span>
                      <p className="text-sm mt-2 text-foreground/90">
                        {typeof pendingLead.research_data === 'string' 
                          ? pendingLead.research_data 
                          : pendingLead.research_data.bottleneck?.hypothesis || "Identifying operational bottlenecks..."}
                      </p>
                    </div>
                  )}

                  <div className="pt-2">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mr-2">NEXT:</span>
                    <span className="text-sm">{
                      isAwaiting ? "Awaiting human approval" :
                      activeRun.current_stage === 'sourcing' ? "Qualify leads" :
                      activeRun.current_stage === 'researching' ? "Prepare outreach" :
                      "Proceed to next stage"
                    }</span>
                  </div>
                </div>
              </section>
            )}

            {isCompleted && (
              <section className="bg-primary/10 border border-primary/20 rounded-2xl p-8 text-center animate-in zoom-in-95 duration-500 ease-out">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-display font-bold text-primary mb-2">Daily Target Reached</h3>
                <p className="text-muted-foreground">Today's acquisition run has completed successfully.</p>
                <div className="mt-6 flex justify-center gap-4">
                  <Button variant="outline" onClick={() => navigate("/hq/pipeline")}>View Pipeline</Button>
                  <Button onClick={() => setActiveRun(null)}>Configure Next Run</Button>
                </div>
              </section>
            )}
          </div>

          {/* ── RIGHT COLUMN (Attention & Stream) ─────────────────────────── */}
          <div className="lg:col-span-5 space-y-8 flex flex-col h-full">
            
            {/* NEEDS ATTENTION QUEUE */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold tracking-widest uppercase text-foreground">Needs You</span>
                {isAwaiting && <span className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-full font-bold">1</span>}
              </div>

              {isAwaiting && pendingLead ? (
                <div className="bg-card border-l-4 border-l-primary border-y border-r border-border rounded-r-xl p-5 shadow-lg animate-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-primary">Approval Required</span>
                    <span className="text-xs text-muted-foreground font-mono">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <h4 className="font-bold text-lg mb-1">{pendingLead.company}</h4>
                  <div className="flex gap-3 text-xs text-muted-foreground font-mono mb-4">
                    <span>ICP {pendingLead.icp_score}</span>
                    <span>OPP {pendingLead.opportunity_score}</span>
                  </div>
                  
                  {/* Outreach Preview */}
                  <div className="bg-background rounded border border-border p-3 text-sm font-mono text-muted-foreground mb-4 max-h-32 overflow-y-auto">
                    {pendingLead.outreach_draft || "Draft not found..."}
                  </div>

                  <div className="flex gap-2">
                    <Button className="flex-1 gap-2" onClick={approveLead}>
                      <Send className="w-4 h-4" /> Send
                    </Button>
                    <Button variant="ghost" onClick={rejectLead}>Skip</Button>
                  </div>
                </div>
              ) : (
                <div className="border border-border/40 border-dashed rounded-xl p-8 text-center text-muted-foreground">
                  <Sparkles className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Queue is empty</p>
                </div>
              )}
            </section>

            {/* ACQUISITION ACTIVITY STREAM */}
            <section className="flex-1 flex flex-col min-h-[300px]">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold tracking-widest uppercase text-foreground">Activity Stream</span>
              </div>
              
              <div className="flex-1 bg-surface-2/50 border border-border/50 rounded-xl p-4 overflow-y-auto relative">
                <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-surface-2/50 to-transparent pointer-events-none z-10" />
                <div className="space-y-4 pt-2">
                  {logs.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center mt-4">No activity yet...</p>
                  ) : (
                    logs.map((log, i) => (
                      <div 
                        key={i} 
                        className={`flex gap-3 text-sm ${i === 0 ? 'opacity-100 font-medium' : 'opacity-60'} transition-opacity animate-in fade-in slide-in-from-left-2 duration-300`}
                      >
                        <span className="text-muted-foreground font-mono text-xs shrink-0 pt-0.5">{log.time}</span>
                        <span className={`${
                          log.type === 'success' ? 'text-primary' : 
                          log.type === 'warning' ? 'text-amber-500' : 
                          log.type === 'error' ? 'text-rose-500' : 'text-foreground'
                        }`}>{log.msg}</span>
                      </div>
                    ))
                  )}
                  {isRunning && (
                    <div className="flex gap-3 text-sm opacity-50 animate-pulse">
                      <span className="text-muted-foreground font-mono text-xs shrink-0 pt-0.5">...</span>
                      <span>Processing...</span>
                    </div>
                  )}
                </div>
              </div>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
}
