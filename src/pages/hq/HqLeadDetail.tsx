import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Brain, Loader2, Globe, Building2, User2,
  Plus, MessageSquare, Phone, Mail, Linkedin, FileText,
  Clock, CheckCircle2, Edit2, Save, X, ExternalLink,
  TrendingUp, Zap, ChevronDown, ChevronUp, RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

type Tab = "overview" | "research" | "contacts" | "timeline" | "outreach" | "deal";

interface Lead {
  id: string;
  company: string;
  website: string | null;
  stage: string;
  icp_score: number;
  is_contacted: boolean;
  source: string | null;
  notes: string | null;
  created_at: string;
  research_data: any;
  founder_thesis: string | null;
  priority: string | null;
}

interface ResearchData {
  summary?: string;
  what_they_sell?: string;
  customer_type?: string;
  team_size?: string;
  tech_stack?: string[];
  recent_signals?: string[];
  pain_hypotheses?: string[];
  decision_makers?: string[];
  outreach_angles?: string[];
  suggested_offer?: string;
  // Legacy sourcing-machine fields
  company?: string;
  website?: string;
  description?: string;
  icp_score?: number;
}

interface Interaction {
  id: string;
  type: string;
  direction: string;
  subject: string | null;
  content: string;
  occurred_at: string;
}

interface Contact {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  linkedin: string | null;
  phone: string | null;
  notes: string | null;
}

interface Deal {
  id: string;
  stage: string;
  value: number;
  probability: number;
  next_action: string | null;
  next_action_due: string | null;
  notes: string | null;
}

const TYPE_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  linkedin: Linkedin,
  call: Phone,
  meeting: User2,
  note: FileText,
};

function typeLabel(t: string) {
  const map: Record<string, string> = {
    email: "Email",
    linkedin: "LinkedIn",
    call: "Call",
    meeting: "Meeting",
    note: "Note",
  };
  return map[t] ?? t;
}

function stageLabel(s: string) {
  const map: Record<string, string> = {
    new: "New", researched: "Researched", contacted: "Contacted",
    interested: "Interested", proposal_sent: "Proposal Sent", won: "Won", lost: "Lost",
  };
  return map[s] ?? s;
}

function dealStageLabel(s: string) {
  const map: Record<string, string> = {
    contacted: "Contacted", interested: "Interested", call_booked: "Call Booked",
    proposal_sent: "Proposal Sent", won: "Won", lost: "Lost",
  };
  return map[s] ?? s;
}

const DEAL_STAGES = ["contacted", "interested", "call_booked", "proposal_sent", "won", "lost"];

export default function HqLeadDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [lead, setLead] = useState<Lead | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [outreach, setOutreach] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [researching, setResearching] = useState(false);

  // Inline note form
  const [addingNote, setAddingNote] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");

  // Research expand
  const [researchExpanded, setResearchExpanded] = useState(true);

  const load = useCallback(async () => {
    if (!user || !id) return;
    setLoading(true);
    try {
      const [leadRes, intRes, contactRes, dealRes, outRes] = await Promise.all([
        supabase.from("pipeline_crm").select("*").eq("id", id).eq("user_id", user.id).maybeSingle(),
        supabase.from("atlas_interactions").select("*").eq("company_id", id).eq("user_id", user.id).order("occurred_at", { ascending: false }).limit(50),
        supabase.from("atlas_contacts").select("*").eq("company_id", id).eq("user_id", user.id),
        supabase.from("atlas_deals").select("*").eq("company_id", id).eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("atlas_outreach").select("*").eq("company_id", id).eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      ]);

      if (leadRes.error) throw leadRes.error;
      setLead(leadRes.data as Lead);
      setNotesValue(leadRes.data?.notes ?? "");
      setInteractions((intRes.data ?? []) as Interaction[]);
      setContacts((contactRes.data ?? []) as Contact[]);
      setDeal(dealRes.data as Deal | null);
      setOutreach(outRes.data ?? []);
    } catch (err: any) {
      toast.error("Failed to load: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [user, id]);

  useEffect(() => { load(); }, [load]);

  const handleResearch = async () => {
    if (!lead?.website) {
      toast.error("Add a website URL first");
      return;
    }
    setResearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("sourcing-machine", {
        body: { action: "source", url: lead.website },
      });
      if (error) throw new Error(error.message);
      await supabase.from("pipeline_crm").update({
        research_data: data,
        stage: lead.stage === "new" ? "researched" : lead.stage,
      }).eq("id", id);
      toast.success("Research complete");
      await load();
      setTab("research");
    } catch (err: any) {
      toast.error("Research failed: " + err.message);
    } finally {
      setResearching(false);
    }
  };

  const handleSaveNote = async () => {
    if (!noteContent.trim() || !user || !id) return;
    setSavingNote(true);
    try {
      await supabase.from("atlas_interactions").insert({
        user_id: user.id,
        company_id: id,
        type: "note",
        direction: "sent",
        content: noteContent.trim(),
        occurred_at: new Date().toISOString(),
      });
      setNoteContent("");
      setAddingNote(false);
      await load();
      toast.success("Note added");
    } catch (err: any) {
      toast.error("Failed to save note: " + err.message);
    } finally {
      setSavingNote(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!id) return;
    await supabase.from("pipeline_crm").update({ notes: notesValue }).eq("id", id);
    setEditingNotes(false);
    await load();
    toast.success("Notes saved");
  };

  const handleStageChange = async (newStage: string) => {
    if (!id) return;
    await supabase.from("pipeline_crm").update({ stage: newStage }).eq("id", id);
    await load();
    toast.success(`Stage → ${stageLabel(newStage)}`);
  };

  const handleCreateDeal = async () => {
    if (!user || !id || !lead) return;
    const { data, error } = await supabase.from("atlas_deals").insert({
      user_id: user.id,
      company_id: id,
      company_name: lead.company,
      stage: "contacted",
      value: 0,
      probability: 25,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setDeal(data as Deal);
    toast.success("Deal created");
    setTab("deal");
  };

  const handleDealUpdate = async (field: string, value: any) => {
    if (!deal) return;
    await supabase.from("atlas_deals").update({ [field]: value }).eq("id", deal.id);
    await load();
  };

  const handlePushNotion = async () => {
    if (!lead || !user) return;
    try {
      const { error } = await supabase.functions.invoke("sourcing-machine", {
        body: {
          action: "export-notion",
          lead: {
            id: lead.id,
            prospect: lead.founder_thesis ?? "",
            company: lead.company,
            website: lead.website ?? "",
            founder_thesis: lead.founder_thesis ?? "",
            icp_score: lead.icp_score ?? 5,
            source: lead.source ?? "manual",
            stage: lead.stage,
            is_contacted: lead.is_contacted,
            notes: lead.notes ?? "",
          },
        },
      });
      if (error) throw new Error(error.message);
      toast.success(`${lead.company} pushed to Notion`);
    } catch (err: any) {
      toast.error("Notion push failed: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Company not found</p>
          <Button variant="ghost" onClick={() => navigate("/hq/leads")} className="mt-3">← Back to leads</Button>
        </div>
      </div>
    );
  }

  const research: ResearchData | null = lead.research_data ?? null;
  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "research", label: "Research", count: research ? 1 : 0 },
    { key: "contacts", label: "Contacts", count: contacts.length },
    { key: "timeline", label: "Timeline", count: interactions.length },
    { key: "outreach", label: "Outreach", count: outreach.length },
    { key: "deal", label: "Deal", count: deal ? 1 : 0 },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-sm px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/hq/leads")} className="h-7 w-7 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold truncate">{lead.company}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted/50 border border-border/40 text-muted-foreground">
                {stageLabel(lead.stage)}
              </span>
            </div>
            {lead.website && (
              <a href={lead.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors" onClick={e => e.stopPropagation()}>
                <Globe className="h-2.5 w-2.5" /> {lead.website.replace(/^https?:\/\//, "")}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePushNotion} className="h-7 text-xs border-border/60 gap-1.5">
              Notion ↗
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResearch}
              disabled={researching || !lead.website}
              className="h-7 text-xs border-border/60 gap-1.5 hover:border-primary/50"
            >
              {researching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
              {research ? "Re-research" : "Research"}
            </Button>
            <Button size="sm" onClick={() => navigate(`/hq/outreach?company=${id}`)} className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5">
              <MessageSquare className="h-3 w-3" /> Outreach
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border/60 px-6">
        <div className="flex gap-0.5 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="text-[10px] font-mono bg-muted/60 px-1.5 py-0.5 rounded-full">{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto">
        {/* OVERVIEW TAB */}
        {tab === "overview" && (
          <div className="space-y-5">
            {/* Stage selector */}
            <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lead Stage</h2>
              <div className="flex flex-wrap gap-2">
                {["new", "researched", "contacted", "interested", "proposal_sent", "won", "lost"].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStageChange(s)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      lead.stage === s
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border/40 text-muted-foreground hover:border-border/70 hover:text-foreground"
                    }`}
                  >
                    {stageLabel(s)}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</h2>
                {!editingNotes
                  ? <Button variant="ghost" size="sm" onClick={() => setEditingNotes(true)} className="h-6 px-2 text-xs gap-1"><Edit2 className="h-3 w-3" /> Edit</Button>
                  : <div className="flex gap-1.5">
                      <Button size="sm" onClick={handleSaveNotes} className="h-6 px-2 text-xs bg-primary text-primary-foreground"><Save className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => { setEditingNotes(false); setNotesValue(lead.notes ?? ""); }} className="h-6 px-2 text-xs"><X className="h-3 w-3" /></Button>
                    </div>
                }
              </div>
              {editingNotes ? (
                <textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  rows={4}
                  placeholder="Any notes about this company..."
                  className="w-full text-sm bg-background border border-border/60 rounded-lg p-3 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              ) : (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{lead.notes || "No notes yet. Click Edit to add some."}</p>
              )}
            </div>

            {/* Quick log interaction */}
            <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Log Interaction</h2>
                {!addingNote && (
                  <Button variant="ghost" size="sm" onClick={() => setAddingNote(true)} className="h-6 px-2 text-xs gap-1">
                    <Plus className="h-3 w-3" /> Add Note
                  </Button>
                )}
              </div>
              {addingNote ? (
                <div className="space-y-2">
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    rows={3}
                    placeholder="What happened? What did they say? What did you learn?"
                    className="w-full text-sm bg-background border border-border/60 rounded-lg p-3 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveNote} disabled={savingNote || !noteContent.trim()} className="h-7 text-xs bg-primary text-primary-foreground">
                      {savingNote ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save Note
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setAddingNote(false); setNoteContent(""); }} className="h-7 text-xs">Cancel</Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Keep a record of every touchpoint with this company.</p>
              )}
            </div>

            {/* Meta */}
            <div className="rounded-xl border border-border/60 bg-card p-5">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Details</h2>
              <dl className="space-y-2 text-xs">
                {[
                  { label: "Source", value: lead.source ?? "Manual" },
                  { label: "ICP Score", value: `${lead.icp_score ?? 5}/10` },
                  { label: "Contacted", value: lead.is_contacted ? "Yes" : "No" },
                  { label: "Added", value: format(new Date(lead.created_at), "d MMM yyyy") },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between">
                    <dt className="text-muted-foreground">{item.label}</dt>
                    <dd className="font-medium">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}

        {/* RESEARCH TAB */}
        {tab === "research" && (
          <div className="space-y-4">
            {!research ? (
              <div className="rounded-xl border border-dashed border-border/60 p-12 text-center">
                <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-sm font-semibold mb-1">No research yet</h3>
                <p className="text-xs text-muted-foreground mb-4">{lead.website ? "Click Research to analyze this company with AI" : "Add a website URL first, then click Research"}</p>
                <Button onClick={handleResearch} disabled={researching || !lead.website} size="sm" className="bg-primary text-primary-foreground gap-1.5">
                  {researching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
                  Research {lead.company}
                </Button>
              </div>
            ) : (
              <>
                {/* Summary */}
                {(research.summary || research.description) && (
                  <div className="rounded-xl border border-border/60 bg-card p-5 space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Summary</h3>
                    <p className="text-sm text-foreground">{research.summary || research.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Quick facts */}
                  <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Facts</h3>
                    <dl className="space-y-2 text-xs">
                      {research.what_they_sell && <div className="space-y-0.5"><dt className="text-muted-foreground">What they sell</dt><dd>{research.what_they_sell}</dd></div>}
                      {research.customer_type && <div className="space-y-0.5"><dt className="text-muted-foreground">Their customers</dt><dd>{research.customer_type}</dd></div>}
                      {research.team_size && <div className="space-y-0.5"><dt className="text-muted-foreground">Team size</dt><dd>{research.team_size}</dd></div>}
                    </dl>
                  </div>

                  {/* Tech stack */}
                  {research.tech_stack && research.tech_stack.length > 0 && (
                    <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tech Stack</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {research.tech_stack.map((t: string) => (
                          <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Pain Hypotheses */}
                {research.pain_hypotheses && research.pain_hypotheses.length > 0 && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-3">
                    <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5" /> Pain Hypotheses
                    </h3>
                    <ul className="space-y-2">
                      {research.pain_hypotheses.map((p: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-amber-400 font-mono text-xs mt-0.5">{i + 1}.</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Outreach Angles */}
                {research.outreach_angles && research.outreach_angles.length > 0 && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3">
                    <h3 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" /> Outreach Angles
                    </h3>
                    <ul className="space-y-2">
                      {research.outreach_angles.map((a: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-primary font-mono text-xs mt-0.5">{i + 1}.</span>
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Suggested Offer */}
                {research.suggested_offer && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-2">
                    <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Suggested Offer</h3>
                    <p className="text-sm">{research.suggested_offer}</p>
                  </div>
                )}

                {/* Decision Makers */}
                {research.decision_makers && research.decision_makers.length > 0 && (
                  <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Likely Decision Makers</h3>
                    <div className="flex flex-wrap gap-2">
                      {research.decision_makers.map((d: string) => (
                        <span key={d} className="text-xs px-2 py-0.5 rounded-full bg-muted/50 border border-border/40">{d}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent signals */}
                {research.recent_signals && research.recent_signals.length > 0 && (
                  <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Signals</h3>
                    <ul className="space-y-1.5">
                      {research.recent_signals.map((s: string, i: number) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-primary mt-0.5">·</span><span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* CONTACTS TAB */}
        {tab === "contacts" && (
          <div className="space-y-4">
            {contacts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-muted-foreground">
                <User2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No contacts yet</p>
                <p className="text-xs mt-1 opacity-70">Add people you know at this company</p>
              </div>
            ) : (
              contacts.map((c) => (
                <div key={c.id} className="rounded-xl border border-border/60 bg-card p-4 flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-xs font-semibold text-primary">
                    {c.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{c.name}</div>
                    {c.role && <div className="text-xs text-muted-foreground">{c.role}</div>}
                    <div className="flex flex-wrap gap-3 mt-2">
                      {c.email && <a href={`mailto:${c.email}`} className="text-xs text-primary flex items-center gap-1 hover:underline"><Mail className="h-3 w-3" />{c.email}</a>}
                      {c.linkedin && <a href={c.linkedin} target="_blank" rel="noreferrer" className="text-xs text-blue-400 flex items-center gap-1 hover:underline"><Linkedin className="h-3 w-3" />LinkedIn</a>}
                      {c.phone && <a href={`tel:${c.phone}`} className="text-xs text-muted-foreground flex items-center gap-1 hover:underline"><Phone className="h-3 w-3" />{c.phone}</a>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TIMELINE TAB */}
        {tab === "timeline" && (
          <div className="space-y-4">
            <Button variant="outline" size="sm" onClick={() => setAddingNote(!addingNote)} className="h-8 text-xs gap-1.5 border-border/60">
              <Plus className="h-3.5 w-3.5" /> Log Interaction
            </Button>
            {addingNote && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  rows={3}
                  placeholder="What happened? What did they say?"
                  className="w-full text-sm bg-background border border-border/60 rounded-lg p-3 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveNote} disabled={savingNote || !noteContent.trim()} className="h-7 text-xs bg-primary text-primary-foreground">Save</Button>
                  <Button variant="ghost" size="sm" onClick={() => { setAddingNote(false); setNoteContent(""); }} className="h-7 text-xs">Cancel</Button>
                </div>
              </div>
            )}
            {interactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No interactions yet</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-border/40" />
                <div className="space-y-4 ml-10">
                  {interactions.map((i) => {
                    const Icon = TYPE_ICONS[i.type] ?? FileText;
                    return (
                      <div key={i.id} className="relative">
                        <div className="absolute -left-6 top-3 h-4 w-4 rounded-full bg-muted border border-border/60 flex items-center justify-center">
                          <Icon className="h-2 w-2 text-muted-foreground" />
                        </div>
                        <div className="rounded-xl border border-border/40 bg-card p-4">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-medium text-muted-foreground">{typeLabel(i.type)} · {i.direction}</span>
                            <span className="text-xs text-muted-foreground font-mono">{formatDistanceToNow(new Date(i.occurred_at), { addSuffix: true })}</span>
                          </div>
                          {i.subject && <div className="text-xs font-semibold mb-1">{i.subject}</div>}
                          <p className="text-sm whitespace-pre-wrap">{i.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* OUTREACH TAB */}
        {tab === "outreach" && (
          <div className="space-y-4">
            <Button size="sm" onClick={() => navigate(`/hq/outreach?company=${id}`)} className="h-8 text-xs bg-primary text-primary-foreground gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> Generate New Outreach
            </Button>
            {outreach.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No outreach sent yet</p>
              </div>
            ) : (
              outreach.map((o) => (
                <div key={o.id} className="rounded-xl border border-border/60 bg-card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium capitalize">{o.type?.replace("_", " ")}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-mono ${
                        o.status === "replied" || o.status === "booked" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                        o.status === "sent" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                        "bg-muted/50 text-muted-foreground border-border/40"
                      }`}>{o.status}</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">{formatDistanceToNow(new Date(o.created_at), { addSuffix: true })}</span>
                  </div>
                  {o.subject && <div className="text-xs font-semibold">{o.subject}</div>}
                  <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">{o.body}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* DEAL TAB */}
        {tab === "deal" && (
          <div className="space-y-4">
            {!deal ? (
              <div className="rounded-xl border border-dashed border-border/60 p-12 text-center">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <h3 className="text-sm font-semibold mb-1">No deal yet</h3>
                <p className="text-xs text-muted-foreground mb-4">Create a deal to track value and pipeline stage</p>
                <Button size="sm" onClick={handleCreateDeal} className="bg-primary text-primary-foreground gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Create Deal
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Deal stage */}
                <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Deal Stage</h3>
                  <div className="flex flex-wrap gap-2">
                    {DEAL_STAGES.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleDealUpdate("stage", s)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          deal.stage === s
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border/40 text-muted-foreground hover:border-border/70"
                        }`}
                      >
                        {dealStageLabel(s)}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Value + probability */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2">
                    <label className="text-xs text-muted-foreground">Deal Value (£)</label>
                    <Input
                      type="number"
                      defaultValue={deal.value}
                      onBlur={(e) => handleDealUpdate("value", Number(e.target.value))}
                      className="h-9 text-sm font-mono bg-background border-border/60"
                    />
                  </div>
                  <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2">
                    <label className="text-xs text-muted-foreground">Probability (%)</label>
                    <Input
                      type="number"
                      min={0} max={100}
                      defaultValue={deal.probability}
                      onBlur={(e) => handleDealUpdate("probability", Number(e.target.value))}
                      className="h-9 text-sm font-mono bg-background border-border/60"
                    />
                  </div>
                </div>
                {/* Next action */}
                <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Next Action</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      defaultValue={deal.next_action ?? ""}
                      placeholder="e.g. Send proposal"
                      onBlur={(e) => handleDealUpdate("next_action", e.target.value || null)}
                      className="h-9 text-sm bg-background border-border/60"
                    />
                    <Input
                      type="date"
                      defaultValue={deal.next_action_due ?? ""}
                      onBlur={(e) => handleDealUpdate("next_action_due", e.target.value || null)}
                      className="h-9 text-sm bg-background border-border/60"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
