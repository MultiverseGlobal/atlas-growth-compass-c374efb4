import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, FileText, Loader2, Zap, Copy, Check,
  Download, Save, Building2, DollarSign, Clock, ChevronDown, Edit3
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Lead {
  id: string;
  company: string;
  website: string | null;
  research_data: any;
  notes: string | null;
}

interface ProposalForm {
  what_they_need: string;
  budget_range: string;
  timeline: string;
  your_approach: string;
}

interface GeneratedProposal {
  executive_summary: string;
  problem_statement: string;
  proposed_solution: string;
  scope: string[];
  deliverables: string[];
  timeline: string;
  investment: string;
  why_us: string;
  next_steps: string;
  raw?: string;
}

const BUDGET_OPTIONS = [
  "£500 – £1,000",
  "£1,000 – £2,500",
  "£2,500 – £5,000",
  "£5,000 – £10,000",
  "£10,000+",
  "To be discussed",
];

const TIMELINE_OPTIONS = [
  "1–2 weeks",
  "2–4 weeks",
  "1–2 months",
  "2–3 months",
  "Ongoing retainer",
];

export default function HqProposal() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState(id ?? searchParams.get("company") ?? "");
  const [form, setForm] = useState<ProposalForm>({
    what_they_need: "",
    budget_range: "£2,500 – £5,000",
    timeline: "2–4 weeks",
    your_approach: "",
  });
  const [generating, setGenerating] = useState(false);
  const [proposal, setProposal] = useState<GeneratedProposal | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Load leads
  useEffect(() => {
    let leadsList: any[] = [];
    if (user) {
      supabase.from("kuro_pipeline_view" as any)
        .select("id, company, website, research_data, notes")
        .eq("user_id", user.id)
        .order("company")
        .then(({ data, error }) => {
          if (!error && data && data.length > 0) {
            setLeads(data as Lead[]);
            if (selectedLeadId) {
              const found = data.find((l: any) => l.id === selectedLeadId);
              if (found) setSelectedLead(found as Lead);
            }
            return;
          }
        });
    }
  }, [user, selectedLeadId]);

  const handleLeadChange = (lid: string) => {
    setSelectedLeadId(lid);
    const found = leads.find((l) => l.id === lid);
    setSelectedLead(found ?? null);
    setProposal(null);
  };

  const handleGenerate = async () => {
    if (!selectedLead) { toast.error("Select a company first"); return; }
    if (!form.what_they_need.trim()) { toast.error("Describe what they need"); return; }
    setGenerating(true);
    setProposal(null);
    try {
      const { data, error } = await supabase.functions.invoke("sourcing-machine", {
        body: {
          action: "generate-proposal",
          lead: {
            company: selectedLead.company,
            website: selectedLead.website ?? "",
            notes: selectedLead.notes ?? "",
          },
          research: selectedLead.research_data,
          form: {
            what_they_need: form.what_they_need,
            budget_range: form.budget_range,
            timeline: form.timeline,
            your_approach: form.your_approach,
          },
        },
      });
      if (error) throw new Error(error.message);
      if (!data) throw new Error("No data returned");

      // Parse — sourcing-machine returns JSON
      let parsed: GeneratedProposal;
      if (data.executive_summary) {
        parsed = data as GeneratedProposal;
      } else if (typeof data === "string") {
        try { parsed = JSON.parse(data); }
        catch { parsed = { executive_summary: "", problem_statement: "", proposed_solution: data, scope: [], deliverables: [], timeline: form.timeline, investment: form.budget_range, why_us: "", next_steps: "", raw: data }; }
      } else {
        parsed = { executive_summary: "", problem_statement: "", proposed_solution: JSON.stringify(data), scope: [], deliverables: [], timeline: form.timeline, investment: form.budget_range, why_us: "", next_steps: "" };
      }
      setProposal(parsed);
    } catch (err: any) {
      toast.error("Generation failed: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const buildPlainText = () => {
    if (!proposal || !selectedLead) return "";
    const lines: string[] = [];
    lines.push(`PROPOSAL FOR ${selectedLead.company.toUpperCase()}`);
    lines.push(`Prepared by: Benjamin | ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`);
    lines.push("");
    if (proposal.executive_summary) { lines.push("EXECUTIVE SUMMARY"); lines.push(proposal.executive_summary); lines.push(""); }
    if (proposal.problem_statement) { lines.push("THE PROBLEM"); lines.push(proposal.problem_statement); lines.push(""); }
    if (proposal.proposed_solution) { lines.push("PROPOSED SOLUTION"); lines.push(proposal.proposed_solution); lines.push(""); }
    if (proposal.scope?.length) { lines.push("SCOPE OF WORK"); proposal.scope.forEach((s, i) => lines.push(`${i + 1}. ${s}`)); lines.push(""); }
    if (proposal.deliverables?.length) { lines.push("DELIVERABLES"); proposal.deliverables.forEach((d, i) => lines.push(`${i + 1}. ${d}`)); lines.push(""); }
    if (proposal.timeline) { lines.push("TIMELINE"); lines.push(proposal.timeline); lines.push(""); }
    if (proposal.investment) { lines.push("INVESTMENT"); lines.push(proposal.investment); lines.push(""); }
    if (proposal.why_us) { lines.push("WHY WORK WITH ME"); lines.push(proposal.why_us); lines.push(""); }
    if (proposal.next_steps) { lines.push("NEXT STEPS"); lines.push(proposal.next_steps); }
    return lines.join("\n");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(buildPlainText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Proposal copied to clipboard");
  };

  const handleSaveToDeal = async () => {
    if (!proposal || !user || !selectedLeadId) return;
    setSaving(true);
    try {
      const text = buildPlainText();
      // Save as an interaction note + update deal notes
      await supabase.from("atlas_interactions").insert({
        user_id: user.id,
        company_id: selectedLeadId,
        type: "note",
        direction: "sent",
        subject: `Proposal for ${selectedLead?.company}`,
        content: text,
        occurred_at: new Date().toISOString(),
      });
      // Update deal stage to proposal_sent if exists
      await supabase.from("atlas_deals")
        .update({ stage: "proposal_sent", next_action: "Follow up on proposal", next_action_due: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0] })
        .eq("company_id", selectedLeadId)
        .eq("user_id", user.id)
        .not("stage", "in", "(won,lost)");
      // Update lead stage
      await supabase.from("kuro_pipeline_view")
        .update({ stage: "proposal_sent" })
        .eq("id", selectedLeadId);
      toast.success("Proposal saved — deal stage → Proposal Sent");
    } catch (err: any) {
      toast.error("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-sm px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(id ? `/hq/leads/${id}` : "/hq/leads")} className="h-7 w-7 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-sm font-semibold">Proposal Generator</h1>
            <p className="text-xs text-muted-foreground font-mono">Scope · Deliverables · Timeline · Investment</p>
          </div>
          {proposal && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy} className="h-8 text-xs border-border/60 gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" onClick={handleSaveToDeal} disabled={saving} className="h-8 text-xs bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save & Mark Sent
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Form */}
        <div className="rounded-xl border border-border/60 bg-card p-5 space-y-5">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Project Details</h2>

          {/* Company selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Company *</label>
              <select
                value={selectedLeadId}
                onChange={(e) => handleLeadChange(e.target.value)}
                className="w-full h-9 text-sm bg-background border border-border/60 rounded-lg px-3 focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground"
              >
                <option value="">Select company...</option>
                {leads.map((l) => <option key={l.id} value={l.id}>{l.company}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Budget range</label>
              <select
                value={form.budget_range}
                onChange={(e) => setForm({ ...form, budget_range: e.target.value })}
                className="w-full h-9 text-sm bg-background border border-border/60 rounded-lg px-3 focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground"
              >
                {BUDGET_OPTIONS.map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
          </div>

          {/* What they need */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">What do they need? *</label>
            <textarea
              value={form.what_they_need}
              onChange={(e) => setForm({ ...form, what_they_need: e.target.value })}
              placeholder='e.g. "They need a client portal to replace their current spreadsheet-based onboarding process. They manage 40+ clients and everything breaks when a team member leaves."'
              rows={3}
              className="w-full text-sm bg-background border border-border/60 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>

          {/* Timeline + approach */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Timeline</label>
              <select
                value={form.timeline}
                onChange={(e) => setForm({ ...form, timeline: e.target.value })}
                className="w-full h-9 text-sm bg-background border border-border/60 rounded-lg px-3 focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground"
              >
                {TIMELINE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Your approach / tech (optional)</label>
              <Input
                value={form.your_approach}
                onChange={(e) => setForm({ ...form, your_approach: e.target.value })}
                placeholder='e.g. "Next.js + Supabase, hosted on Vercel"'
                className="h-9 text-sm bg-background border-border/60"
              />
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating || !selectedLeadId || !form.what_they_need.trim()}
            className="h-9 bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {generating ? "Writing proposal..." : "Generate Proposal"}
          </Button>

          {generating && (
            <p className="text-xs text-muted-foreground font-mono animate-pulse">
              Atlas is writing your scope, deliverables, and investment...
            </p>
          )}
        </div>

        {/* Generated Proposal */}
        {proposal && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">Proposal for {selectedLead?.company}</h2>
                <p className="text-xs text-muted-foreground font-mono">
                  {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
            </div>

            {/* Executive Summary */}
            {proposal.executive_summary && (
              <ProposalSection title="Executive Summary" icon="📋" content={proposal.executive_summary} />
            )}

            {/* Problem */}
            {proposal.problem_statement && (
              <ProposalSection title="The Problem" icon="🎯" content={proposal.problem_statement} highlight="amber" />
            )}

            {/* Solution */}
            {proposal.proposed_solution && (
              <ProposalSection title="Proposed Solution" icon="⚡" content={proposal.proposed_solution} highlight="primary" />
            )}

            {/* Scope + Deliverables side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {proposal.scope?.length > 0 && (
                <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Scope of Work</h3>
                  <ol className="space-y-2">
                    {proposal.scope.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-primary font-mono font-bold text-xs mt-0.5 shrink-0">{i + 1}.</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {proposal.deliverables?.length > 0 && (
                <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Deliverables</h3>
                  <ol className="space-y-2">
                    {proposal.deliverables.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-emerald-400 font-mono text-xs mt-0.5 shrink-0">✓</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            {/* Timeline + Investment side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {proposal.timeline && (
                <div className="rounded-xl border border-border/60 bg-card p-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timeline</h3>
                  </div>
                  <p className="text-sm">{proposal.timeline}</p>
                </div>
              )}
              {proposal.investment && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-400" />
                    <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Investment</h3>
                  </div>
                  <p className="text-sm font-medium">{proposal.investment}</p>
                </div>
              )}
            </div>

            {/* Why us */}
            {proposal.why_us && (
              <ProposalSection title="Why Work With Me" icon="👤" content={proposal.why_us} />
            )}

            {/* Next steps */}
            {proposal.next_steps && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-2">
                <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">Next Steps</h3>
                <p className="text-sm font-medium">{proposal.next_steps}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleCopy} className="h-9 text-xs border-border/60 gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied!" : "Copy full proposal"}
              </Button>
              <Button onClick={handleSaveToDeal} disabled={saving} className="h-9 text-xs bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save & mark proposal sent
              </Button>
              <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={generating} className="h-9 text-xs text-muted-foreground gap-1.5">
                <Zap className="h-3.5 w-3.5" /> Regenerate
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProposalSection({ title, icon, content, highlight }: { title: string; icon: string; content: string; highlight?: "amber" | "primary" }) {
  const borderColor = highlight === "amber" ? "border-amber-500/20" : highlight === "primary" ? "border-primary/20" : "border-border/60";
  const bgColor = highlight === "amber" ? "bg-amber-500/5" : highlight === "primary" ? "bg-primary/5" : "bg-card";
  const titleColor = highlight === "amber" ? "text-amber-400" : highlight === "primary" ? "text-primary" : "text-muted-foreground";

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-5 space-y-2`}>
      <h3 className={`text-xs font-semibold ${titleColor} uppercase tracking-wider`}>{icon} {title}</h3>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
    </div>
  );
}
