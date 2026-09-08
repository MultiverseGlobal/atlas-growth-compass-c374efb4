import { useState, useEffect, useCallback } from "react";
import { 
  Building2, MessageSquare, Zap, Loader2, Check, Copy, Send,
  Target, BarChart2, Mail, ExternalLink, ChevronRight, Activity, Globe,
  Lock, Focus, Plus
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { AtlasIcon } from "@/components/atlas/EcosystemIcons";

interface Opportunity {
  id: string;
  organization_name: string;
  primary_domain: string;
  pipeline_stage: string;
  fit_score: number;
  deal_value_usd: number | null;
  updated_at: string;
  industry: string;
}

interface Contact {
  id: string;
  opportunity_id: string;
  full_name: string;
  job_title: string;
  email: string | null;
}

export default function HqRevenueEngine() {
  const { user } = useAuth();
  
  // State
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [activeOpportunityId, setActiveOpportunityId] = useState<string | null>(null);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Generator State
  const [generating, setGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState(0);
  const [drafts, setDrafts] = useState<{ email: { subject: string; body: string } } | null>(null);

  const generationSteps = [
    "Retrieving context from database...",
    "Analyzing operational bottlenecks...",
    "Applying Atlas framework...",
    "Drafting personalized sequence...",
    "Finalizing copy..."
  ];

  // Load Data
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("atlas_opportunities")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      
      if (error) throw error;
      
      if (data) {
        setOpportunities(data);
        if (!activeOpportunityId && data.length > 0) {
          setActiveOpportunityId(data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, activeOpportunityId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load active contact whenever activeOpportunityId changes
  useEffect(() => {
    async function loadContact() {
      if (!activeOpportunityId) {
        setActiveContact(null);
        return;
      }
      const { data } = await supabase
        .from("atlas_contacts")
        .select("*")
        .eq("opportunity_id", activeOpportunityId)
        .limit(1)
        .single();
      
      setActiveContact(data || null);
    }
    loadContact();
  }, [activeOpportunityId]);

  const activeOpp = opportunities.find(o => o.id === activeOpportunityId);

  const handleGenerate = async () => {
    if (!activeOpp) return;
    setGenerating(true);
    setGeneratingStep(0);
    
    // Simulate step progression for UX
    const stepInterval = setInterval(() => {
      setGeneratingStep((prev) => (prev < generationSteps.length - 1 ? prev + 1 : prev));
    }, 1500);

    try {
      const companyName = activeOpp.organization_name;

      const { data, error } = await supabase.functions.invoke("generate-outreach", {
        body: {
          company: companyName,
          founder_name: activeContact?.full_name || null,
          sender_name: "Atlas",
        },
      });

      clearInterval(stepInterval);
      setGeneratingStep(generationSteps.length - 1);

      if (error) throw new Error(error.message);
      setDrafts(data);
      toast.success("Draft generated.");
    } catch (e: any) {
      clearInterval(stepInterval);
      toast.error(`Generation failed: ${e.message}`);
    } finally {
      setTimeout(() => setGenerating(false), 500);
    }
  };

  const handleCopy = () => {
    if (!drafts) return;
    navigator.clipboard.writeText(`Subject: ${drafts.email.subject}\n\n${drafts.email.body}`);
    toast.success("Copied to clipboard!");
  };

  const handleSaveOutreach = async () => {
    if (!drafts || !activeOpportunityId || !user) return;
    try {
      await supabase.from("atlas_outreach").insert({
        user_id: user.id,
        opportunity_id: activeOpportunityId,
        contact_id: activeContact?.id || null,
        channel: "email",
        draft_subject: drafts.email.subject,
        draft_body: drafts.email.body,
        status: "manually_sent",
        sent_at: new Date().toISOString(),
      });
      
      // Also update the opportunity stage
      await supabase.from("atlas_opportunities")
        .update({ pipeline_stage: "contacted" })
        .eq("id", activeOpportunityId);
        
      loadData();
      toast.success("Outreach logged.");
      setDrafts(null);
    } catch (e: any) {
      toast.error("Failed to save.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen pt-[72px] bg-background items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <motion.div
            animate={{ scale: [1, 1.05, 1], opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <AtlasIcon size={32} className="text-foreground" />
          </motion.div>
          <div className="flex flex-col items-center gap-1">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Revenue Engine</span>
            <span className="font-mono text-[9px] text-muted-foreground/50 uppercase tracking-widest">Calibrating</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen pt-[72px] bg-background grain text-foreground font-sans overflow-hidden">
      
      {/* ── Left Sidebar: Pipeline ────────────────────────────────────────── */}
      <div className="w-[340px] border-r border-border/60 bg-card/20 backdrop-blur-xl flex flex-col shrink-0">
        <div className="p-5 border-b border-border/60 flex items-center justify-between bg-card/40 backdrop-blur-md">
          <div>
            <h2 className="font-display text-sm tracking-tight font-bold">PIPELINE</h2>
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{opportunities.length} active opportunities</p>
          </div>
          <Button 
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', metaKey: true }))}
            size="sm" 
            className="h-8 w-8 p-0 rounded-lg bg-foreground text-background"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {opportunities.map(opp => {
            const isSelected = opp.id === activeOpportunityId;
            return (
              <button
                key={opp.id}
                onClick={() => setActiveOpportunityId(opp.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  isSelected 
                    ? "bg-card/60 backdrop-blur-xl border-foreground/30 shadow-md" 
                    : "bg-background/40 backdrop-blur-md border-border/40 hover:border-foreground/20 opacity-80 hover:opacity-100"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[14px] font-bold tracking-tight truncate pr-2">{opp.organization_name}</span>
                  <span className="text-[12px] font-mono text-muted-foreground">£{(opp.deal_value_usd || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${opp.pipeline_stage === 'contacted' ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10' : 'border-border/60 text-muted-foreground bg-muted/50'}`}>
                    {opp.pipeline_stage.replace('_', ' ')}
                  </span>
                  <ChevronRight className={`w-4 h-4 ${isSelected ? "text-foreground" : "text-muted-foreground"}`} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Center: Command Center ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-transparent relative">
        {activeOpp ? (
          <div className="relative z-10 flex flex-col h-full">
            {/* Header */}
            <div className="px-10 py-8 border-b border-border/60 bg-card/40 backdrop-blur-xl shrink-0">
              <div className="max-w-5xl mx-auto w-full flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
                      {activeOpp.organization_name}
                    </h1>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full border border-foreground/20 bg-foreground/5 text-foreground">£{(activeOpp.deal_value_usd || 0).toLocaleString()}</span>
                  </div>
                  {activeOpp.primary_domain && (
                    <a href={`https://${activeOpp.primary_domain}`} target="_blank" rel="noreferrer" className="inline-flex items-center text-[12px] font-mono text-muted-foreground hover:text-foreground transition-colors mt-2">
                      <Globe className="w-3.5 h-3.5 mr-1.5" />
                      {activeOpp.primary_domain}
                      <ExternalLink className="w-3 h-3 ml-1.5 opacity-50" />
                    </a>
                  )}
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs font-semibold">
                  Update Stage
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-10">
              <div className="max-w-5xl mx-auto w-full space-y-10">
                
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  
                  {/* Recon Data */}
                  <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                      <Target className="w-4 h-4 text-foreground" />
                      <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-muted-foreground">Reconnaissance</span>
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-background border border-border/60">
                          <span className="block text-[10px] font-mono text-muted-foreground uppercase mb-1">Primary Target</span>
                          <span className="block text-sm font-semibold">{activeContact?.full_name || "Unknown"}</span>
                          <span className="block text-[11px] text-muted-foreground mt-0.5">{activeContact?.job_title || "Decision Maker"}</span>
                        </div>
                        <div className="p-4 rounded-lg bg-background border border-border/60">
                          <span className="block text-[10px] font-mono text-muted-foreground uppercase mb-1">Fit Score</span>
                          <span className="block text-sm font-semibold">{activeOpp.fit_score || 0}%</span>
                          <div className="mt-2 h-1 w-full bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-foreground rounded-full" style={{ width: `${activeOpp.fit_score || 0}%` }} />
                          </div>
                        </div>
                      </div>
                      
                      
                      <div className="mt-4 space-y-2">
                        <span className="block text-[10px] font-mono text-muted-foreground uppercase">Strategic Intelligence</span>
                        <div className="p-4 rounded-xl bg-background border border-border/60 space-y-3">
                          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                            <div className="p-2.5 rounded-lg bg-card border border-border/60">
                              <span className="text-[9px] text-muted-foreground block uppercase font-semibold">Industry</span>
                              <span className="text-foreground block mt-0.5">{activeOpp.industry}</span>
                            </div>
                            <div className="p-2.5 rounded-lg bg-card border border-border/60">
                              <span className="text-[9px] text-muted-foreground block uppercase font-semibold">Pipeline Stage</span>
                              <span className="text-foreground font-medium block mt-0.5 capitalize">{activeOpp.pipeline_stage.replace('_', ' ')}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Outreach Engine */}
                  <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-xl p-6 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-foreground" />
                        <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-muted-foreground">Outreach Engine</span>
import { AnimatePresence } from "framer-motion";
// Need to add this import if not already present, but motion is already imported. I will just replace the rendering.

                      </div>
                      {!drafts && (
                        <Button onClick={handleGenerate} disabled={generating} size="sm" className="h-8 text-xs bg-foreground text-background hover:bg-foreground/90 transition-all duration-300 w-[140px]">
                          {generating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-1.5" />}
                          {generating ? "Synthesizing..." : "Generate Angle"}
                        </Button>
                      )}
                    </div>

                    <div className="flex-1 flex flex-col relative min-h-[200px]">
                      <AnimatePresence mode="wait">
                        {generating ? (
                          <motion.div 
                            key="generating"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute inset-0 flex flex-col items-center justify-center bg-card/60 backdrop-blur-sm rounded-xl border border-border/40"
                          >
                            <Loader2 className="w-6 h-6 text-foreground animate-spin mb-4" />
                            <div className="h-5 overflow-hidden relative w-full flex justify-center">
                              <AnimatePresence mode="popLayout">
                                <motion.div
                                  key={generatingStep}
                                  initial={{ y: 20, opacity: 0 }}
                                  animate={{ y: 0, opacity: 1 }}
                                  exit={{ y: -20, opacity: 0 }}
                                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                  className="text-[12px] font-mono text-foreground tracking-wide absolute"
                                >
                                  {generationSteps[generatingStep]}
                                </motion.div>
                              </AnimatePresence>
                            </div>
                          </motion.div>
                        ) : drafts ? (
                          <motion.div 
                            key="drafts"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex-1 flex flex-col rounded-xl border border-border/60 bg-background p-6 relative overflow-hidden"
                          >
                            <div className="absolute top-0 left-0 w-1 h-full bg-foreground" />
                            
                            <div className="mb-4">
                              <span className="block text-[10px] font-mono text-muted-foreground uppercase mb-1">Subject Line</span>
                              <div className="text-sm font-semibold text-foreground">{drafts.email.subject}</div>
                            </div>
                            
                            <div className="flex-1 flex flex-col min-h-0">
                              <span className="block text-[10px] font-mono text-muted-foreground uppercase mb-1">Message Body</span>
                              <div className="flex-1 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed bg-card p-4 rounded-lg border border-border/60 overflow-y-auto">
                                {drafts.email.body}
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-end gap-3 pt-5 mt-auto">
                              <Button variant="outline" size="sm" onClick={handleCopy} className="h-8 text-xs">
                                <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Text
                              </Button>
                              <Button size="sm" onClick={handleSaveOutreach} className="h-8 text-xs bg-foreground text-background">
                                <Send className="w-3.5 h-3.5 mr-1.5" /> Log as Sent
                              </Button>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div 
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute inset-0 rounded-xl border border-dashed border-border/60 flex flex-col items-center justify-center text-muted-foreground bg-background/50 p-8 text-center"
                          >
                            <MessageSquare className="w-8 h-8 mb-3 opacity-20" />
                            <p className="text-[13px] font-medium text-foreground/70">Awaiting Synthesis</p>
                            <p className="text-[11px] mt-1 max-w-[200px]">Generate a hyper-personalized outreach draft using Atlas AI.</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground relative z-10">
            <Target className="w-16 h-16 mb-6 opacity-10" />
            <h3 className="font-display text-xl text-foreground/60 mb-2">No Target Selected</h3>
            <p className="text-[13px] max-w-sm text-center">Select an opportunity from the pipeline to initialize the Revenue Engine and begin tactical outreach.</p>
          </div>
        )}
      </div>
    </div>
  );
}
