import { useState, useEffect, useCallback } from "react";
import { 
  Building2, MessageSquare, Zap, Loader2, Check, Copy, Send,
  Target, BarChart2, Mail, ExternalLink, ChevronRight, Activity, Globe
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

// Types based on the actual DB schema
interface Deal {
  id: string;
  company_id: string;
  company_name: string;
  stage: string;
  value: number;
  probability: number;
  updated_at: string;
}

interface Lead { 
  id: string; 
  company_id?: string;
  company: string; 
  website: string | null; 
  research_data: any; 
  founder?: { name?: string; email?: string; role?: string };
}

interface OutreachMsg {
  id: string;
  company_id: string;
  type: string;
  subject: string | null;
  body: string;
  status: string;
  sent_at: string | null;
}

const STAGES = ["contacted", "replied", "discovery", "proposal", "negotiation", "won"];

export default function HqRevenueEngine() {
  const { user } = useAuth();
  
  // State
  const [deals, setDeals] = useState<Deal[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Generator State
  const [generating, setGenerating] = useState(false);
  const [drafts, setDrafts] = useState<{ email: { subject: string; body: string } } | null>(null);

  // Load Data
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [dealsRes, leadsRes] = await Promise.all([
        supabase.from("atlas_deals" as any).select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
        supabase.from("kuro_pipeline_view" as any).select("*").eq("user_id", user.id)
      ]);
      
      if (dealsRes.data) setDeals(dealsRes.data);
      if (leadsRes.data) setLeads(leadsRes.data);
      
      // Auto-select first active deal if none selected
      if (!activeCompanyId && dealsRes.data && dealsRes.data.length > 0) {
        setActiveCompanyId(dealsRes.data[0].company_id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, activeCompanyId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Derived State
  const activeDeal = deals.find(d => d.company_id === activeCompanyId);
  const activeLead = leads.find(l => (l.company_id === activeCompanyId) || (l.id === activeCompanyId) || (l.company === activeDeal?.company_name));

  // Actions
  const handleGenerate = async () => {
    if (!activeDeal && !activeLead) return;
    setGenerating(true);
    try {
      const rd = activeLead?.research_data || {};
      const bt = rd.bottleneck || rd[0] || {};
      const companyName = activeLead?.company || activeDeal?.company_name || "Unknown Company";

      const { data, error } = await supabase.functions.invoke("generate-outreach", {
        body: {
          company: companyName,
          founder_name: activeLead?.founder?.name || rd.founder?.name || null,
          team_size: rd.team_size || null,
          research_data: rd,
          bottleneck: bt,
          sender_name: "Atlas",
        },
      });

      if (error) throw new Error(error.message);
      setDrafts(data);
      toast.success("Draft generated.", { icon: <Zap className="w-4 h-4 text-[#10b981]" /> });
    } catch (e: any) {
      toast.error(`Generation failed: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!drafts) return;
    navigator.clipboard.writeText(`Subject: ${drafts.email.subject}\n\n${drafts.email.body}`);
    toast.success("Copied to clipboard!");
  };

  const handleSaveOutreach = async () => {
    if (!drafts || !activeCompanyId || !user) return;
    try {
      await supabase.from("outreach_messages" as any).insert({
        user_id: user.id,
        company_id: activeCompanyId,
        type: "cold_email",
        subject: drafts.email.subject,
        body: drafts.email.body,
        status: "sent",
        sent_at: new Date().toISOString(),
      });
      toast.success("Outreach logged.");
      setDrafts(null);
    } catch (e: any) {
      toast.error("Failed to save.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-56px)] bg-[var(--pds-canvas)] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--pds-text-muted)]" />
          <span className="text-[11px] font-mono tracking-widest text-[var(--pds-text-muted)] uppercase">Calibrating Engine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-56px)] bg-[var(--pds-canvas)] text-[var(--pds-text-primary)] font-sans">
      
      {/* ── Left Sidebar: Pipeline ────────────────────────────────────────── */}
      <div className="w-[340px] border-r border-[var(--pds-border-mid)] bg-[var(--pds-surface-2)] flex flex-col shrink-0">
        <div className="p-5 border-b border-[var(--pds-border-subtle)] flex items-center justify-between">
          <div>
            <h2 className="font-display text-[15px] tracking-tight font-bold">PIPELINE</h2>
            <p className="text-[11px] font-mono text-[var(--pds-text-muted)] mt-1">{deals.length} active engagements</p>
          </div>
          <Activity className="w-4 h-4 text-[var(--pds-text-muted)]" />
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {deals.map(deal => {
            const isSelected = deal.company_id === activeCompanyId;
            return (
              <button
                key={deal.id}
                onClick={() => setActiveCompanyId(deal.company_id)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  isSelected 
                    ? "bg-[var(--pds-surface-1)] border-[var(--pds-accent-dim)] shadow-[var(--pds-shadow-glow)]" 
                    : "bg-[var(--pds-surface-3)] border-[var(--pds-border-subtle)] hover:border-[var(--pds-border-mid)] shadow-[var(--pds-shadow-sm)] opacity-80 hover:opacity-100"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[14px] font-bold tracking-tight truncate pr-2">{deal.company_name}</span>
                  <span className="text-[12px] font-mono text-[var(--pds-text-secondary)]">£{deal.value.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`pds-status-badge ${deal.stage === 'contacted' ? 'active' : ''}`}>
                    <div className={`pds-status-dot ${deal.stage === 'contacted' ? 'active' : ''}`} />
                    {deal.stage}
                  </span>
                  <ChevronRight className={`w-4 h-4 ${isSelected ? "text-[var(--pds-text-primary)]" : "text-[var(--pds-text-muted)]"}`} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Center: Command Center ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--pds-canvas)] grain">
        {(activeDeal || activeLead) ? (
          <div className="relative z-10 flex flex-col h-full">
            {/* Header */}
            <div className="px-10 py-8 border-b border-[var(--pds-border-subtle)] flex items-start justify-between bg-[var(--pds-surface-1)]/50 backdrop-blur-xl">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl font-display font-bold tracking-tight text-[var(--pds-text-primary)]">
                    {activeDeal?.company_name || activeLead?.company}
                  </h1>
                  <span className="pds-status-badge">£{(activeDeal?.value || 0).toLocaleString()}</span>
                </div>
                {activeLead?.website && (
                  <a href={activeLead.website} target="_blank" rel="noreferrer" className="inline-flex items-center text-[12px] font-mono text-[var(--pds-text-secondary)] hover:text-[var(--pds-text-primary)] transition-colors mt-2">
                    <Globe className="w-3.5 h-3.5 mr-1.5" />
                    {activeLead.website.replace(/^https?:\/\//, '')}
                    <ExternalLink className="w-3 h-3 ml-1.5 opacity-50" />
                  </a>
                )}
              </div>
              <button className="pds-btn-ghost">
                Update Stage
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 space-y-10">
              
              {/* Grid Layout for Recon & Synthesis */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                
                {/* Recon Data */}
                <div className="pds-data-card p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <Target className="w-4 h-4 text-[var(--pds-accent)]" />
                    <span className="pds-label !mb-0">Reconnaissance</span>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-[var(--pds-surface-2)] border border-[var(--pds-border-subtle)]">
                        <span className="block text-[10px] font-mono text-[var(--pds-text-muted)] uppercase mb-1">Primary Target</span>
                        <span className="block text-[13px] font-semibold">{activeLead?.founder?.name || "Unknown"}</span>
                        <span className="block text-[11px] text-[var(--pds-text-secondary)] mt-0.5">{activeLead?.founder?.role || "Decision Maker"}</span>
                      </div>
                      <div className="p-4 rounded-lg bg-[var(--pds-surface-2)] border border-[var(--pds-border-subtle)]">
                        <span className="block text-[10px] font-mono text-[var(--pds-text-muted)] uppercase mb-1">Deal Probability</span>
                        <span className="block text-[13px] font-semibold">{activeDeal?.probability || 0}%</span>
                        <div className="mt-2 h-1 w-full bg-[var(--pds-surface-4)] rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--pds-success)] rounded-full" style={{ width: `${activeDeal?.probability || 0}%` }} />
                        </div>
                      </div>
                    </div>
                    {activeLead?.research_data && (
                      <div className="mt-4">
                        <span className="block text-[10px] font-mono text-[var(--pds-text-muted)] uppercase mb-2">Hypothesis Raw Data</span>
                        <div className="p-4 rounded-lg bg-[var(--pds-surface-4)] border border-[var(--pds-border-strong)] overflow-x-auto">
                          <pre className="text-[11px] font-mono text-[var(--pds-text-secondary)] whitespace-pre-wrap">
                            {JSON.stringify(activeLead.research_data, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Outreach Engine */}
                <div className="pds-card p-6 flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[var(--pds-accent)]" />
                      <span className="pds-label !mb-0">Outreach Engine</span>
                    </div>
                    {!drafts && (
                      <button onClick={handleGenerate} disabled={generating} className="pds-btn-primary !w-auto !min-h-[32px] !text-[11px]">
                        {generating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-1.5" />}
                        {generating ? "Synthesizing..." : "Generate Angle"}
                      </button>
                    )}
                  </div>

                  {drafts ? (
                    <div className="flex-1 flex flex-col rounded-xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-2)] p-6 shadow-inner relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-[var(--pds-info)]" />
                      
                      <div className="mb-4">
                        <span className="block text-[10px] font-mono text-[var(--pds-text-muted)] uppercase mb-1">Subject Line</span>
                        <div className="text-[14px] font-semibold text-[var(--pds-text-primary)]">{drafts.email.subject}</div>
                      </div>
                      
                      <div className="flex-1 flex flex-col min-h-0">
                        <span className="block text-[10px] font-mono text-[var(--pds-text-muted)] uppercase mb-1">Message Body</span>
                        <div className="flex-1 text-[13px] text-[var(--pds-text-secondary)] whitespace-pre-wrap leading-relaxed bg-[var(--pds-surface-1)] p-5 rounded-lg border border-[var(--pds-border-subtle)] overflow-y-auto shadow-sm">
                          {drafts.email.body}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-end gap-3 pt-5 mt-auto">
                        <button onClick={handleCopy} className="pds-btn-ghost !min-h-[36px]">
                          <Copy className="w-3.5 h-3.5" /> Copy Text
                        </button>
                        <button onClick={handleSaveOutreach} className="pds-btn-primary !w-auto !min-h-[36px] bg-[var(--pds-info)] text-white">
                          <Send className="w-3.5 h-3.5" /> Log as Sent
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 rounded-xl border border-dashed border-[var(--pds-border-strong)] flex flex-col items-center justify-center text-[var(--pds-text-muted)] bg-[var(--pds-surface-2)]/50 p-8 text-center">
                      <MessageSquare className="w-8 h-8 mb-3 opacity-20" />
                      <p className="text-[13px] font-medium text-[var(--pds-text-secondary)]">Awaiting Synthesis</p>
                      <p className="text-[11px] mt-1 max-w-[200px]">Generate a hyper-personalized outreach draft using Atlas AI.</p>
                    </div>
                  )}
                </div>

              </div>

            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--pds-text-muted)] relative z-10">
            <Target className="w-16 h-16 mb-6 opacity-10" />
            <h3 className="font-display text-xl text-[var(--pds-text-secondary)] mb-2">No Target Selected</h3>
            <p className="text-[13px] max-w-sm text-center">Select an opportunity from the pipeline to initialize the Revenue Engine and begin tactical outreach.</p>
          </div>
        )}
      </div>

    </div>
  );
}
