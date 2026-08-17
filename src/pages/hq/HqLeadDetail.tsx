import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Brain, Loader2, Globe, Building2, User2,
  Plus, MessageSquare, Phone, Mail, Linkedin, FileText,
  Clock, CheckCircle2, Edit2, Save, X, ExternalLink,
  TrendingUp, Zap, ChevronDown, ChevronRight, RefreshCw,
  Target, BarChart2, Sparkles, Activity, Send, BookOpen,
  AlertTriangle, DollarSign, CalendarClock, Star
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { PainEngine } from "@/components/atlas/PainEngine";
import { OfferBuilder } from "@/components/atlas/OfferBuilder";
import type { PainHypothesis } from "@/components/atlas/PainEngine";

type Tab = "overview" | "research" | "pain" | "offer" | "outreach" | "timeline" | "proposal" | "notes";

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

interface AtlasEvent {
  id: string;
  event_type: string;
  source: string;
  metadata: any;
  occurred_at: string;
}

const TYPE_ICONS: Record<string, typeof Mail> = {
  email: Mail, linkedin: Linkedin, call: Phone,
  meeting: User2, note: FileText,
};

const TABS: { id: Tab; label: string; icon: typeof Target }[] = [
  { id: "overview",  label: "Overview",  icon: BarChart2 },
  { id: "research",  label: "Research",  icon: Brain },
  { id: "pain",      label: "Pain",      icon: AlertTriangle },
  { id: "offer",     label: "Offer",     icon: Zap },
  { id: "outreach",  label: "Outreach",  icon: Send },
  { id: "timeline",  label: "Timeline",  icon: Activity },
  { id: "proposal",  label: "Proposal",  icon: FileText },
  { id: "notes",     label: "Notes",     icon: BookOpen },
];

const STAGE_STEPS = ["new", "researched", "contacted", "interested", "proposal_sent", "won"];

function stageLabel(s: string) {
  const map: Record<string, string> = {
    new: "New", researched: "Researched", contacted: "Contacted",
    interested: "Interested", proposal_sent: "Proposal Sent", won: "Won", lost: "Lost",
  };
  return map[s] ?? s;
}

export default function HqLeadDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [lead, setLead] = useState<Lead | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [events, setEvents] = useState<AtlasEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>((searchParams.get("tab") as Tab) ?? "overview");

  // Pain → Offer bridge
  const [selectedPain, setSelectedPain] = useState<PainHypothesis | null>(null);

  // Research state
  const [researching, setResearching] = useState(false);

  // Notes state
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Interaction log
  const [logType, setLogType] = useState("note");
  const [logContent, setLogContent] = useState("");
  const [logSubject, setLogSubject] = useState("");
  const [loggingInteraction, setLoggingInteraction] = useState(false);
  const [showLogForm, setShowLogForm] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    let leadData: any = null;
    let interactionsData: any[] = [];
    let contactsData: any[] = [];
    let dealData: any = null;
    let eventsData: any[] = [];

    if (user) {
      try {
        const [leadRes, interactionsRes, contactsRes, dealRes, eventsRes] = await Promise.all([
          supabase.from("kuro_pipeline_view" as any).select("*").eq("id", id).eq("user_id", user.id).maybeSingle(),
          supabase.from("atlas_interactions" as any).select("*").eq("company_id", id).eq("user_id", user.id).order("occurred_at", { ascending: false }).limit(50),
          supabase.from("atlas_contacts" as any).select("*").eq("company_id", id).eq("user_id", user.id),
          supabase.from("atlas_deals" as any).select("*").eq("company_id", id).eq("user_id", user.id).not("stage", "in", "(won,lost)").order("created_at", { ascending: false }).limit(1).maybeSingle(),
          (supabase as any).from("atlas_events").select("*").eq("company_id", id).eq("user_id", user.id).order("occurred_at", { ascending: false }).limit(50),
        ]);
        if (!leadRes.error && leadRes.data) leadData = leadRes.data;
        if (!interactionsRes.error && interactionsRes.data) interactionsData = interactionsRes.data;
        if (!contactsRes.error && contactsRes.data) contactsData = contactsRes.data;
        if (!dealRes.error && dealRes.data) dealData = dealRes.data;
        if (!eventsRes.error && eventsRes.data) eventsData = eventsRes.data;
      } catch {}
    }

    if (!leadData) {
      try {
        const savedLeads = JSON.parse(localStorage.getItem("atlas_autonomous_leads") || "[]");
        const found = savedLeads.find((l: any) => l.id === id);
        if (found) {
          leadData = {
            id: found.id,
            company: found.company,
            website: found.website,
            stage: found.status === 'approved' ? 'contacted' : 'new',
            icp_score: found.icp_score || 90,
            prospect: found.founder?.name || '',
            linkedin_url: found.founder?.linkedin_url || '',
            founder_thesis: found.bottleneck?.hypothesis || '',
            research_data: found,
            notes: found.bottleneck?.observation || '',
            is_contacted: found.status === 'approved',
            created_at: new Date().toISOString(),
          };
        }
      } catch {}
    }

    setLead(leadData as Lead);
    setInteractions(interactionsData as Interaction[]);
    setContacts(contactsData as Contact[]);
    setDeal(dealData as Deal | null);
    setEvents(eventsData as AtlasEvent[]);
    setLoading(false);
  }, [user, id]);

  useEffect(() => { load(); }, [load]);

  const handleResearch = async () => {
    if (!lead?.website) { toast.error("No website set — add one first"); return; }
    setResearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("sourcing-machine", {
        body: { action: "source", url: lead.website },
      });
      if (error) throw new Error(error.message);
      if (!data) throw new Error("No data returned");

      await supabase.from("kuro_pipeline_view").update({
        research_data: data,
        stage: lead.stage === "new" ? "researched" : lead.stage,
      }).eq("id", id);

      // Log event
      await (supabase as any).from("atlas_events").insert({
        user_id: user?.id,
        company_id: id,
        event_type: "lead_researched",
        source: "ai",
        metadata: { website: lead.website },
      });

      toast.success("Research complete");
      load();
      setTab("research");
    } catch (err: any) {
      toast.error("Research failed: " + err.message);
    } finally {
      setResearching(false);
    }
  };

  const handleLogInteraction = async () => {
    if (!logContent.trim() || !user || !id) return;
    setLoggingInteraction(true);
    try {
      await supabase.from("atlas_interactions").insert({
        user_id: user.id,
        company_id: id,
        type: logType,
        direction: "sent",
        subject: logSubject || null,
        content: logContent,
        occurred_at: new Date().toISOString(),
      });
      // Also log to atlas_events
      await (supabase as any).from("atlas_events").insert({
        user_id: user.id,
        company_id: id,
        event_type: logType === "call" ? "call_completed" : `outreach_sent`,
        source: "user",
        metadata: { type: logType, subject: logSubject, preview: logContent.slice(0, 200) },
      });
      setLogContent(""); setLogSubject(""); setShowLogForm(false);
      toast.success("Logged");
      load();
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    } finally {
      setLoggingInteraction(false);
    }
  };

  const handleSaveNote = async () => {
    if (!noteText.trim() || !user || !id) return;
    setSavingNote(true);
    try {
      await supabase.from("kuro_pipeline_view").update({ notes: noteText }).eq("id", id);
      await (supabase as any).from("atlas_events").insert({
        user_id: user.id,
        company_id: id,
        event_type: "note_added",
        source: "user",
        metadata: { preview: noteText.slice(0, 200) },
      });
      toast.success("Note saved");
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-3">
        <p className="text-muted-foreground">Company not found</p>
        <Button variant="ghost" size="sm" onClick={() => navigate("/hq/leads")}>Back to Leads</Button>
      </div>
    );
  }

  const research = lead.research_data as any;
  const stageIdx = STAGE_STEPS.indexOf(lead.stage);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/hq/leads")} className="h-7 w-7 p-0 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>

          {/* Company identity */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold truncate">{lead.company}</h1>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase border shrink-0 ${
                  lead.stage === "won" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" :
                  lead.stage === "lost" ? "text-red-400 border-red-500/30 bg-red-500/10" :
                  "text-primary border-primary/30 bg-primary/10"
                }`}>{stageLabel(lead.stage)}</span>
              </div>
              {lead.website && (
                <a href={lead.website} target="_blank" rel="noreferrer"
                  className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                  {lead.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
          </div>

          {/* ICP Score */}
          <div className="hidden sm:flex items-center gap-1 shrink-0">
            <Star className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-mono text-amber-400 font-bold">{lead.icp_score}/10</span>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={handleResearch}
              disabled={researching}
              className="h-7 text-xs border-border/60 gap-1.5"
            >
              {researching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
              {researching ? "Researching..." : research ? "Re-research" : "Research"}
            </Button>
            <Button
              size="sm"
              onClick={() => navigate(`/hq/leads/${id}/proposal`)}
              className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
            >
              <FileText className="h-3 w-3" /> Proposal
            </Button>
          </div>
        </div>

        {/* Stage progress */}
        <div className="px-5 pb-2 flex items-center gap-1">
          {STAGE_STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className={`h-1 flex-1 rounded-full transition-all ${i <= stageIdx ? "bg-primary" : "bg-border/40"}`} />
              {i === stageIdx && (
                <span className="text-[9px] text-primary font-mono uppercase tracking-wider whitespace-nowrap shrink-0">{stageLabel(s)}</span>
              )}
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-0 px-5 overflow-x-auto scrollbar-hide">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 p-5 max-w-4xl mx-auto w-full space-y-5">

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div className="space-y-4">
            {/* Deal card */}
            {deal && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Active Deal</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono border text-emerald-400 border-emerald-500/30 bg-emerald-500/10`}>
                    {stageLabel(deal.stage)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div><div className="text-[10px] text-muted-foreground font-mono">VALUE</div><div className="text-lg font-bold text-emerald-400">£{deal.value?.toLocaleString()}</div></div>
                  <div><div className="text-[10px] text-muted-foreground font-mono">PROBABILITY</div><div className="text-lg font-bold">{deal.probability}%</div></div>
                  <div><div className="text-[10px] text-muted-foreground font-mono">NEXT ACTION</div><div className="text-sm font-medium truncate">{deal.next_action ?? "—"}</div></div>
                </div>
              </div>
            )}

            {/* Quick stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "ICP Score", value: `${lead.icp_score}/10`, icon: Star, color: "text-amber-400" },
                { label: "Interactions", value: String(interactions.length), icon: MessageSquare, color: "text-primary" },
                { label: "Contacts", value: String(contacts.length), icon: User2, color: "text-blue-400" },
                { label: "Events", value: String(events.length), icon: Activity, color: "text-purple-400" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="rounded-xl border border-border/60 bg-card p-3 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Icon className={`h-3.5 w-3.5 ${color}`} />
                    <span className="text-[10px] text-muted-foreground font-mono uppercase">{label}</span>
                  </div>
                  <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
                </div>
              ))}
            </div>

            {/* Research summary if exists */}
            {research?.summary && (
              <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Company Summary</div>
                <p className="text-sm leading-relaxed">{research.summary}</p>
                <button onClick={() => setTab("research")} className="text-xs text-primary flex items-center gap-1 hover:text-primary/80">
                  Full research <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Contacts */}
            {contacts.length > 0 && (
              <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Decision Makers</div>
                <div className="space-y-2">
                  {contacts.map((c) => (
                    <div key={c.id} className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-full bg-muted/30 flex items-center justify-center shrink-0">
                        <User2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{c.name}</div>
                        {c.role && <div className="text-xs text-muted-foreground truncate">{c.role}</div>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {c.email && <a href={`mailto:${c.email}`} className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted/30 transition-colors"><Mail className="h-3 w-3 text-muted-foreground" /></a>}
                        {c.linkedin && <a href={c.linkedin} target="_blank" rel="noreferrer" className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted/30 transition-colors"><Linkedin className="h-3 w-3 text-muted-foreground" /></a>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent activity */}
            {interactions.length > 0 && (
              <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Activity</div>
                  <button onClick={() => setTab("timeline")} className="text-xs text-primary hover:text-primary/80">View all</button>
                </div>
                <div className="space-y-2">
                  {interactions.slice(0, 3).map((i) => {
                    const Icon = TYPE_ICONS[i.type] ?? FileText;
                    return (
                      <div key={i.id} className="flex items-start gap-2.5">
                        <div className="h-6 w-6 rounded bg-muted/20 flex items-center justify-center shrink-0 mt-0.5">
                          <Icon className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          {i.subject && <div className="text-xs font-medium truncate">{i.subject}</div>}
                          <div className="text-xs text-muted-foreground truncate">{i.content.slice(0, 80)}</div>
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono shrink-0">{formatDistanceToNow(new Date(i.occurred_at), { addSuffix: true })}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Source info */}
            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lead Info</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground text-xs">Source</span><div className="font-medium">{lead.source ?? "Manual"}</div></div>
                <div><span className="text-muted-foreground text-xs">Added</span><div className="font-medium">{format(new Date(lead.created_at), "d MMM yyyy")}</div></div>
                {lead.priority && <div><span className="text-muted-foreground text-xs">Priority</span><div className="font-medium capitalize">{lead.priority}</div></div>}
              </div>
            </div>
          </div>
        )}

        {/* ── RESEARCH ── */}
        {tab === "research" && (
          <div className="space-y-4">
            {!research ? (
              <div className="rounded-xl border border-dashed border-border/40 p-12 text-center space-y-3">
                <Brain className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                <p className="text-sm font-medium text-muted-foreground">No research yet</p>
                <p className="text-xs text-muted-foreground/60">Click Research in the header to analyse {lead.company}'s website.</p>
                <Button onClick={handleResearch} disabled={researching} size="sm" className="h-8 text-xs gap-1.5">
                  {researching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
                  Research Now
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary */}
                {research.summary && <ResearchCard title="Summary" icon="📋" content={research.summary} />}

                {/* Business overview grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {research.what_they_sell && <ResearchCard title="What They Sell" icon="💼" content={research.what_they_sell} compact />}
                  {research.customer_type && <ResearchCard title="Customer Type" icon="👥" content={research.customer_type} compact />}
                  {research.team_size && <ResearchCard title="Team Size" icon="🏢" content={research.team_size} compact />}
                  {research.suggested_offer && <ResearchCard title="Suggested Offer" icon="⚡" content={research.suggested_offer} compact highlight />}
                </div>

                {/* Tech Stack */}
                {research.tech_stack?.length > 0 && (
                  <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">🔧 Tech Stack</div>
                    <div className="flex flex-wrap gap-1.5">
                      {research.tech_stack.map((t: string) => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded bg-muted/30 border border-border/40 font-mono">{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Signals */}
                {research.recent_signals?.length > 0 && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
                    <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider">📡 Signals</div>
                    <ul className="space-y-1">
                      {research.recent_signals.map((s: string, i: number) => (
                        <li key={i} className="text-sm flex items-start gap-2"><span className="text-amber-400 text-xs mt-0.5">→</span>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Pain hypotheses from research (v1) */}
                {research.pain_hypotheses?.length > 0 && (
                  <div className="rounded-xl border border-red-500/10 bg-red-500/5 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">💢 Research Pain Hints</div>
                      <button onClick={() => setTab("pain")} className="text-xs text-primary flex items-center gap-1 hover:text-primary/80">
                        Run Pain Engine <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                    <ul className="space-y-1">
                      {research.pain_hypotheses.map((p: string, i: number) => (
                        <li key={i} className="text-sm flex items-start gap-2"><span className="text-red-400 text-xs mt-0.5">!</span>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Decision makers from research */}
                {research.decision_makers?.length > 0 && (
                  <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">👤 Decision Makers</div>
                    <ul className="space-y-1">
                      {research.decision_makers.map((d: string, i: number) => (
                        <li key={i} className="text-sm flex items-start gap-2"><span className="text-primary text-xs mt-0.5">→</span>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Outreach angles */}
                {research.outreach_angles?.length > 0 && (
                  <div className="rounded-xl border border-primary/10 bg-primary/5 p-4 space-y-2">
                    <div className="text-xs font-semibold text-primary uppercase tracking-wider">📨 Outreach Angles</div>
                    <ul className="space-y-1">
                      {research.outreach_angles.map((a: string, i: number) => (
                        <li key={i} className="text-sm flex items-start gap-2"><span className="text-primary text-xs mt-0.5">→</span>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="text-[10px] text-muted-foreground/40 font-mono text-center">
                  Last researched · {format(new Date(lead.created_at), "d MMM yyyy")}
                  {" · "}<button onClick={handleResearch} disabled={researching} className="hover:text-primary transition-colors">Re-research</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PAIN ENGINE ── */}
        {tab === "pain" && (
          <PainEngine
            companyId={id!}
            companyName={lead.company}
            website={lead.website ?? ""}
            researchData={research}
            onBuildOffer={(pain) => {
              setSelectedPain(pain);
              setTab("offer");
            }}
            onAnalysisComplete={() => {}}
          />
        )}

        {/* ── OFFER BUILDER ── */}
        {tab === "offer" && (
          <OfferBuilder
            companyId={id!}
            companyName={lead.company}
            website={lead.website ?? ""}
            researchData={research}
            initialPain={selectedPain}
          />
        )}

        {/* ── OUTREACH ── */}
        {tab === "outreach" && (
          <div className="space-y-4">
            {/* Log interaction */}
            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Log Interaction</div>
                <Button variant="ghost" size="sm" onClick={() => setShowLogForm(!showLogForm)} className="h-7 text-xs gap-1">
                  {showLogForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  {showLogForm ? "Cancel" : "Log"}
                </Button>
              </div>
              {showLogForm && (
                <div className="space-y-3 animate-in fade-in duration-200">
                  <div className="flex gap-2">
                    {["email", "linkedin", "call", "meeting", "note"].map((t) => (
                      <button key={t}
                        onClick={() => setLogType(t)}
                        className={`text-xs px-2.5 py-1 rounded-md border capitalize transition-all ${logType === t ? "border-primary/40 bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-primary/30"}`}
                      >{t}</button>
                    ))}
                  </div>
                  <Input value={logSubject} onChange={(e) => setLogSubject(e.target.value)} placeholder="Subject / topic" className="h-8 text-sm border-border/60" />
                  <textarea
                    value={logContent} onChange={(e) => setLogContent(e.target.value)}
                    placeholder="What happened? Include key phrases, objections, or outcomes..."
                    rows={3}
                    className="w-full text-sm bg-background border border-border/60 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                  <Button onClick={handleLogInteraction} disabled={loggingInteraction || !logContent.trim()} size="sm" className="h-8 text-xs">
                    {loggingInteraction ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
                  </Button>
                </div>
              )}
            </div>

            {/* Interaction history */}
            {interactions.length > 0 ? (
              <div className="space-y-2">
                {interactions.map((i) => {
                  const Icon = TYPE_ICONS[i.type] ?? FileText;
                  return (
                    <div key={i.id} className="rounded-xl border border-border/60 bg-card p-4 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold capitalize">{i.type}</span>
                        <span className="text-[10px] text-muted-foreground font-mono ml-auto">{format(new Date(i.occurred_at), "d MMM, HH:mm")}</span>
                      </div>
                      {i.subject && <p className="text-xs font-medium text-foreground/80">{i.subject}</p>}
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{i.content}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/40 p-8 text-center">
                <p className="text-sm text-muted-foreground">No interactions logged yet</p>
              </div>
            )}
          </div>
        )}

        {/* ── TIMELINE (atlas_events) ── */}
        {tab === "timeline" && (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground font-mono">
              Full event log — every action, forever. {events.length} events recorded.
            </div>
            {events.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/40 p-8 text-center">
                <Activity className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No events yet. Events are recorded automatically as you use Atlas.</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-border/40" />
                <div className="space-y-3 pl-10">
                  {events.map((ev) => (
                    <div key={ev.id} className="relative">
                      <div className="absolute -left-6 top-2 h-2 w-2 rounded-full bg-primary/60 border border-primary/30" />
                      <div className="rounded-xl border border-border/60 bg-card p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono text-primary font-semibold">{ev.event_type.replace(/_/g, " ")}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-muted-foreground/60 px-1.5 py-0.5 rounded bg-muted/20 border border-border/30">{ev.source}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{formatDistanceToNow(new Date(ev.occurred_at), { addSuffix: true })}</span>
                          </div>
                        </div>
                        {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                          <div className="text-[11px] text-muted-foreground/70 font-mono">
                            {Object.entries(ev.metadata).filter(([k]) => k !== "offer").slice(0, 3).map(([k, v]) => (
                              <span key={k} className="mr-3">{k}: {String(v).slice(0, 60)}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PROPOSAL ── */}
        {tab === "proposal" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Generate Proposal</div>
              <p className="text-sm text-muted-foreground">
                Build a full proposal for {lead.company} — scope, deliverables, timeline, and investment.
                Uses research data and pain analysis automatically.
              </p>
              <Button
                onClick={() => navigate(`/hq/leads/${id}/proposal`)}
                className="h-9 bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
              >
                <FileText className="h-4 w-4" /> Open Proposal Generator
              </Button>
            </div>
            <p className="text-xs text-muted-foreground/50 font-mono text-center">
              Tip: Run Pain Analysis and build an Offer first. Proposals with a clear pain → solution chain convert better.
            </p>
          </div>
        )}

        {/* ── NOTES ── */}
        {tab === "notes" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Company Notes</div>
              <textarea
                value={noteText || lead.notes || ""}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add anything you want to remember about this company — context, conversations, ideas..."
                rows={8}
                className="w-full text-sm bg-background border border-border/60 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <Button onClick={handleSaveNote} disabled={savingNote} size="sm" className="h-8 text-xs gap-1.5">
                {savingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save Note
              </Button>
            </div>
            <p className="text-xs text-muted-foreground/40 font-mono text-center">Notes are saved to the event log automatically.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ResearchCard({ title, icon, content, compact, highlight }: { title: string; icon: string; content: string; compact?: boolean; highlight?: boolean }) {
  const border = highlight ? "border-primary/20" : "border-border/60";
  const bg = highlight ? "bg-primary/5" : "bg-card";
  const titleCol = highlight ? "text-primary" : "text-muted-foreground";
  return (
    <div className={`rounded-xl border ${border} ${bg} ${compact ? "p-3" : "p-4"} space-y-1.5`}>
      <div className={`text-xs font-semibold uppercase tracking-wider ${titleCol}`}>{icon} {title}</div>
      <p className={`${compact ? "text-xs" : "text-sm"} leading-relaxed text-foreground/90`}>{content}</p>
    </div>
  );
}
