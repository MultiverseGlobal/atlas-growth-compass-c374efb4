import { useState, useEffect, useCallback } from "react";
import { 
  Building2, MessageSquare, Zap, Loader2, Check, Copy, Send,
  Target, BarChart2, Mail, ExternalLink, ChevronRight 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";

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
  const activeLead = leads.find(l => l.id === activeCompanyId);

  // Actions
  const handleGenerate = async () => {
    if (!activeLead) return;
    setGenerating(true);
    try {
      const rd = activeLead.research_data || {};
      const bt = rd.bottleneck || rd[0] || {};

      const { data, error } = await supabase.functions.invoke("generate-outreach", {
        body: {
          company: activeLead.company,
          founder_name: activeLead.founder?.name || rd.founder?.name || null,
          team_size: rd.team_size || null,
          research_data: rd,
          bottleneck: bt,
          sender_name: "Ben",
        },
      });

      if (error) throw new Error(error.message);
      setDrafts(data);
      toast.success("Draft generated.");
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
      <div className="flex h-screen bg-white items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-56px)] bg-white text-slate-900 font-sans">
      
      {/* ── Left Sidebar: Pipeline ────────────────────────────────────────── */}
      <div className="w-80 border-r border-slate-200 bg-slate-50/50 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold tracking-tight">Pipeline</h2>
          <p className="text-xs text-slate-500 mt-0.5">{deals.length} active opportunities</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {deals.map(deal => {
            const isSelected = deal.company_id === activeCompanyId;
            return (
              <button
                key={deal.id}
                onClick={() => setActiveCompanyId(deal.company_id)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  isSelected 
                    ? "bg-white border-blue-500/50 shadow-sm ring-1 ring-blue-500/20" 
                    : "bg-white border-slate-200 hover:border-slate-300 shadow-sm opacity-80"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold truncate">{deal.company_name}</span>
                  <span className="text-xs font-mono text-slate-500">£{deal.value}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    {deal.stage}
                  </span>
                  <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? "text-blue-500" : "text-slate-300"}`} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Center: Command Center ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {activeLead ? (
          <>
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">{activeLead.company}</h1>
                <a href={activeLead.website || "#"} target="_blank" className="flex items-center text-sm text-blue-600 hover:underline mt-1">
                  {activeLead.website || "No website"} <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </div>
              <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800 rounded-full px-5 shadow-sm text-xs h-8">
                Update Deal Stage
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              
              {/* Research Summary */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Research & Hypothesis</h3>
                <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 text-sm leading-relaxed text-slate-700">
                  <p><strong>Target:</strong> {activeLead.founder?.name || "Founder"} ({activeLead.founder?.role || "CEO"})</p>
                  <p className="mt-2"><strong>Bottleneck Hypothesis:</strong></p>
                  <pre className="mt-2 text-xs font-mono bg-white p-3 rounded border border-slate-200 whitespace-pre-wrap">
                    {JSON.stringify(activeLead.research_data, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Outreach Generator */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Outreach Action</h3>
                  {!drafts && (
                    <Button onClick={handleGenerate} disabled={generating} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 rounded-full shadow-sm">
                      {generating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-1.5" />}
                      Generate Outreach
                    </Button>
                  )}
                </div>

                {drafts ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 space-y-4">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Subject</div>
                      <div className="text-sm font-semibold text-slate-900">{drafts.email.subject}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Body</div>
                      <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed bg-white p-4 rounded-lg border border-slate-200">
                        {drafts.email.body}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={handleCopy} className="h-8 text-xs rounded-full bg-white text-slate-700">
                        <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
                      </Button>
                      <Button size="sm" onClick={handleSaveOutreach} className="h-8 text-xs rounded-full bg-blue-600 hover:bg-blue-700 text-white">
                        <Check className="w-3.5 h-3.5 mr-1.5" /> Mark as Sent
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="h-32 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-sm bg-slate-50/50">
                    No active draft. Generate one to send.
                  </div>
                )}
              </div>

            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <Target className="w-12 h-12 mb-4 opacity-20" />
            <p>Select a deal from the pipeline to start.</p>
          </div>
        )}
      </div>

    </div>
  );
}
