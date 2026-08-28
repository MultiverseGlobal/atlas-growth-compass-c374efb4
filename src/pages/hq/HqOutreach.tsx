import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  MessageSquare, Clock, Send, Copy, Check, Loader2,
  RefreshCw, Building2, Zap, X,
  Mail, Linkedin, Video, Sparkles, ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDistanceToNow, isPast, format } from "date-fns";

interface Lead { 
  id: string; 
  company: string; 
  website: string | null; 
  research_data: any; 
  outreach_draft?: string;
  founder?: { name?: string; email?: string; role?: string };
}

interface OutreachMsg {
  id: string;
  company_id: string;
  company_name?: string;
  to_email?: string;
  to_name?: string;
  type: string;
  subject: string | null;
  body: string;
  status: string;
  sent_at: string | null;
  follow_up_due: string | null;
  created_at?: string;
}

type ChannelKey = "email" | "linkedin_dm" | "loom";

const CHANNELS: { key: ChannelKey; label: string; icon: any; type: string }[] = [
  { key: "email",       label: "Email",       icon: Mail,     type: "cold_email" },
  { key: "linkedin_dm", label: "LinkedIn DM", icon: Linkedin, type: "linkedin" },
  { key: "loom",        label: "Loom Script", icon: Video,    type: "loom" },
];

const FOLLOW_UP_DAYS: Record<string, number> = {
  cold_email: 3,
  linkedin: 4,
  followup: 5,
  loom: 3,
};

function statusBadge(s: string) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground border-border/40",
    sent: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    opened: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    replied: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    booked: "bg-primary/10 text-primary border-primary/20",
    declined: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return map[s] ?? "bg-muted text-muted-foreground border-border/40";
}

export default function HqOutreach() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [outreach, setOutreach] = useState<OutreachMsg[]>([]);
  const [queue, setQueue] = useState<OutreachMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"queue" | "history">("queue");

  // Generator state
  const [showGenerator, setShowGenerator] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState(searchParams.get("company") ?? "");
  const [activeChannel, setActiveChannel] = useState<ChannelKey>("email");
  const [generating, setGenerating] = useState(false);
  const [allDrafts, setAllDrafts] = useState<{ email: { subject: string; body: string }; linkedin_dm: string; loom_script: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [priorMessages, setPriorMessages] = useState<OutreachMsg[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("company")) {
      setShowGenerator(true);
      setSelectedCompanyId(searchParams.get("company") ?? "");
    }
  }, [searchParams]);

  const loadData = useCallback(async () => {
    setLoading(true);
    let leadsData: any[] = [];
    let outData: any[] = [];

    // 1. Try Supabase DB
    if (user) {
      try {
        const [leadsRes, outRes] = await Promise.all([
          supabase.from("kuro_pipeline_view" as any).select("id, company, website, research_data, outreach_draft").eq("user_id", user.id).order("company"),
          supabase.from("outreach_messages" as any).select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        ]);
        if (!leadsRes.error && leadsRes.data) leadsData = leadsRes.data;
        if (!outRes.error && outRes.data) outData = outRes.data;
      } catch {}
    }

    // 2. Fallback / Merge with Local Storage
    try {
      const savedLeads = JSON.parse(localStorage.getItem("atlas_autonomous_leads") || "[]");
      if (leadsData.length === 0) {
        leadsData = savedLeads.map((l: any) => ({
          id: l.id,
          company: l.company,
          website: l.website,
          research_data: l,
          founder: l.founder,
        }));
      }

      const savedOutreach = JSON.parse(localStorage.getItem("atlas_outreach_messages") || "[]");
      if (outData.length === 0) {
        outData = savedOutreach;
      } else if (savedOutreach.length > 0) {
        // Merge without duplicates
        const existingIds = new Set(outData.map(o => o.id));
        savedOutreach.forEach((so: any) => {
          if (!existingIds.has(so.id)) outData.push(so);
        });
      }
    } catch {}

    setLeads(leadsData as Lead[]);

    const companyMap: Record<string, string> = {};
    leadsData.forEach((l: Lead) => { companyMap[l.id] = l.company; });

    const enriched = outData.map((o: any) => ({
      ...o,
      company_name: o.company_name || companyMap[o.company_id] || "Target Account",
    })) as OutreachMsg[];

    setOutreach(enriched);

    // Active Queue: All active outreach sequences (both pending follow-ups and active threads)
    setQueue(
      enriched.filter((o) => ["sent", "draft", "opened"].includes(o.status))
    );

    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load prior messages when company changes
  useEffect(() => {
    if (!selectedCompanyId) { setPriorMessages([]); return; }
    const prior = outreach.filter((o) => o.company_id === selectedCompanyId).slice(0, 3);
    setPriorMessages(prior);
  }, [selectedCompanyId, outreach]);

  // ── LLM-Powered Multi-Channel Outreach Generator ─────────────────────────
  const handleGenerate = async () => {
    if (!selectedCompanyId) { toast.error("Select a company first"); return; }
    const lead = leads.find((l) => l.id === selectedCompanyId);
    if (!lead) return;

    setGenerating(true);
    setAllDrafts(null);

    try {
      const rd = lead.research_data || {};
      const bt = rd.bottleneck || rd[0] || {};

      const { data, error } = await supabase.functions.invoke("generate-outreach", {
        body: {
          company:       lead.company,
          founder_name:  lead.founder?.name || rd.founder?.name || null,
          founder_role:  lead.founder?.role || rd.founder?.role || null,
          team_size:     rd.team_size || null,
          research_data: rd,
          bottleneck:    bt,
          approach_angle: rd.approach_angle || null,
          sender_name:   "Ben",
        },
      });

      if (error) throw new Error(error.message);

      setAllDrafts(data);
      setActiveChannel("email");
      toast.success("AI drafted all 3 channel formats!");
    } catch (e: any) {
      toast.error(`Generation failed: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  // ── Get the currently selected channel's content for copy/send ───────────
  const getActiveDraft = () => {
    if (!allDrafts) return null;
    if (activeChannel === "email")       return { subject: allDrafts.email.subject, body: allDrafts.email.body, type: "cold_email" };
    if (activeChannel === "linkedin_dm") return { subject: null, body: allDrafts.linkedin_dm, type: "linkedin" };
    if (activeChannel === "loom")        return { subject: null, body: allDrafts.loom_script, type: "loom" };
    return null;
  };

  const handleCopy = () => {
    const draft = getActiveDraft();
    if (!draft) return;
    const text = draft.subject ? `Subject: ${draft.subject}\n\n${draft.body}` : draft.body;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard!");
  };

  const sendGeneratedViaGmail = () => {
    if (!allDrafts || !selectedCompanyId) return;
    const lead = leads.find(l => l.id === selectedCompanyId);
    const toEmail = lead?.founder?.email || "";
    const subject = encodeURIComponent(allDrafts.email.subject || "");
    const body = encodeURIComponent(allDrafts.email.body);
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${toEmail}&su=${subject}&body=${body}`;
    window.open(gmailUrl, "_blank");
    handleSaveOutreach("sent");
  };

  const openLoom = () => {
    window.open("https://www.loom.com/record", "_blank");
    toast.success("Loom opened! Use the script as your guide, then paste the link back here.");
  };

  const handleSaveOutreach = async (status: string = "sent") => {
    const draft = getActiveDraft();
    if (!draft || !selectedCompanyId) return;
    setSaving(true);
    const lead = leads.find((l) => l.id === selectedCompanyId);
    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + (FOLLOW_UP_DAYS[draft.type] ?? 3));

    const newMsg: OutreachMsg = {
      id: `msg-${Date.now()}`,
      company_id: selectedCompanyId,
      company_name: lead?.company || "Target Account",
      type: draft.type,
      subject: draft.subject ?? null,
      body: draft.body,
      status,
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      follow_up_due: followUpDate.toISOString(),
    };

    // 1. Save to local storage
    try {
      const savedOutreach = JSON.parse(localStorage.getItem("atlas_outreach_messages") || "[]");
      savedOutreach.unshift(newMsg);
      localStorage.setItem("atlas_outreach_messages", JSON.stringify(savedOutreach));
    } catch {}

    // 2. Save to Supabase DB if user logged in
    if (user) {
      try {
        await supabase.from("outreach_messages" as any).insert({
          user_id: user.id,
          company_id: selectedCompanyId,
          type: draft.type,
          subject: draft.subject ?? null,
          body: draft.body,
          status,
          sent_at: new Date().toISOString(),
          follow_up_due: followUpDate.toISOString(),
        });
      } catch {}
    }

    toast.success(`Outreach recorded · Next follow-up scheduled for ${format(followUpDate, "MMM d")}`);
    setAllDrafts(null);
    setShowGenerator(false);
    setSearchParams({});
    setSaving(false);
    await loadData();
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    setUpdatingId(id);

    // Update in local storage
    try {
      const savedOutreach = JSON.parse(localStorage.getItem("atlas_outreach_messages") || "[]");
      const updated = savedOutreach.map((o: any) => o.id === id ? { ...o, status: newStatus } : o);
      localStorage.setItem("atlas_outreach_messages", JSON.stringify(updated));
    } catch {}

    // Update in Supabase DB
    if (user) {
      try {
        await supabase.from("outreach_messages" as any).update({ status: newStatus }).eq("id", id);
      } catch {}
    }

    toast.success(`Status updated to ${newStatus}`);
    setUpdatingId(null);
    await loadData();
  };

  const openFollowUpInGmail = (msg: OutreachMsg) => {
    const lead = leads.find(l => l.id === msg.company_id);
    const toEmail = lead?.founder?.email || "";
    const subject = encodeURIComponent(`Re: ${msg.subject || `${msg.company_name} operational bottleneck`}`);
    const body = encodeURIComponent(
      `Hi ${lead?.founder?.name || "there"},\n\nFollowing up on my previous note regarding the $500 / 5-day AI Operations Sprint for ${msg.company_name}.\n\nLet me know if this week works for a brief 5-minute chat.`
    );
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${toEmail}&su=${subject}&body=${body}`;
    window.open(gmailUrl, "_blank");
    toast.success("Opened follow-up compose in Gmail!");
  };

  return (
    <div className="min-h-screen bg-background text-foreground py-8 px-6 lg:px-12">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
              <MessageSquare className="w-6 h-6 text-primary" />
              Outreach Studio & Follow-up Queue
            </h1>
            <p className="text-xs font-mono text-muted-foreground mt-1">
              {queue.length} active sequences · {outreach.length} total logged touchpoints
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              className="rounded-full text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Sync
            </Button>
            <Button
              onClick={() => setShowGenerator(v => !v)}
              className="bg-primary text-primary-foreground font-semibold rounded-full text-xs px-5 shadow-sm"
            >
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              {showGenerator ? "Close Generator" : "Draft New Sequence"}
            </Button>
          </div>
        </div>

        {/* ── GENERATOR DRAWER ──────────────────────────────────────────────── */}
        {showGenerator && (
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4 animate-in fade-in-50 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Sparkles className="w-4 h-4 text-primary" />
                AI Outreach Generator — 3 Channels
              </div>
              <button onClick={() => setShowGenerator(false)} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
            </div>

            {/* Company selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Target Company</label>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full h-10 text-sm bg-muted/40 border border-border rounded-xl px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select target company…</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>{l.company}</option>
                ))}
              </select>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generating || !selectedCompanyId}
              className="w-full bg-primary text-primary-foreground font-bold rounded-xl text-xs px-6 h-10"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-1.5 fill-current" />}
              {generating ? "AI is writing your outreach…" : "Generate Email + LinkedIn DM + Loom Script →"}
            </Button>

            {/* Multi-channel draft tabs */}
            {allDrafts && (
              <div className="space-y-3">
                {/* Channel Tabs */}
                <div className="flex gap-1 p-1 bg-muted/40 rounded-xl border border-border">
                  {CHANNELS.map((ch) => (
                    <button
                      key={ch.key}
                      onClick={() => setActiveChannel(ch.key)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        activeChannel === ch.key
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <ch.icon className="w-3.5 h-3.5" />
                      {ch.label}
                    </button>
                  ))}
                </div>

                {/* Draft Preview */}
                <div className="rounded-xl bg-muted/30 border border-border p-4 space-y-2">
                  {activeChannel === "email" && (
                    <>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Subject</div>
                      <div className="text-xs font-semibold text-foreground mb-3">{allDrafts.email.subject}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Body</div>
                      <div className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">{allDrafts.email.body}</div>
                    </>
                  )}
                  {activeChannel === "linkedin_dm" && (
                    <>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">LinkedIn DM</div>
                      <div className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">{allDrafts.linkedin_dm}</div>
                    </>
                  )}
                  {activeChannel === "loom" && (
                    <>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">60-Second Loom Script</div>
                      <div className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed italic">{allDrafts.loom_script}</div>
                    </>
                  )}
                </div>

                {/* Action buttons — change based on active channel */}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={handleCopy} className="text-xs rounded-full">
                    {copied ? <Check className="w-3 h-3 mr-1.5 text-emerald-500" /> : <Copy className="w-3 h-3 mr-1.5" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>

                  {activeChannel === "email" && (
                    <Button variant="outline" size="sm" onClick={sendGeneratedViaGmail} className="text-xs rounded-full text-red-500 border-red-500/30 hover:bg-red-500/10">
                      <Mail className="w-3.5 h-3.5 mr-1.5 text-red-500" /> Send in Gmail
                    </Button>
                  )}

                  {activeChannel === "loom" && (
                    <Button variant="outline" size="sm" onClick={openLoom} className="text-xs rounded-full text-violet-400 border-violet-500/30 hover:bg-violet-500/10">
                      <Video className="w-3.5 h-3.5 mr-1.5" /> Open Loom & Record
                    </Button>
                  )}

                  <Button size="sm" onClick={() => handleSaveOutreach("sent")} disabled={saving} className="bg-primary text-primary-foreground font-semibold text-xs rounded-full px-5">
                    {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
                    Save & Queue Follow-Up
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tabs Navigation ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 border-b border-border text-sm font-semibold">
          <button
            onClick={() => setActiveTab("queue")}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "queue"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="w-4 h-4" />
            Active Follow-up Queue ({queue.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "history"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Full Outreach History ({outreach.length})
          </button>
        </div>

        {/* ── TAB 1: ACTIVE QUEUE ───────────────────────────────────────────── */}
        {activeTab === "queue" && (
          <div className="space-y-4">
            {queue.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3">
                <Clock className="w-8 h-8 text-muted-foreground opacity-30" />
                <h3 className="text-sm font-bold text-foreground">Follow-up Queue Clear</h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  No active sequences pending. Launch a campaign from ICP & Offer (/hq/icp) to add new founders to your queue.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {queue.map((msg) => {
                  const due = msg.follow_up_due ? new Date(msg.follow_up_due) : null;
                  const overdue = due && isPast(due);
                  return (
                    <div
                      key={msg.id}
                      className={`rounded-2xl border p-5 space-y-3 bg-card shadow-sm transition-all ${
                        overdue ? "border-red-500/30" : "border-border"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center text-primary shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-foreground">
                                {msg.company_name}
                              </span>
                              <Badge variant="outline" className={`text-[10px] uppercase font-mono ${statusBadge(msg.status)}`}>
                                {msg.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                              Step: {msg.type?.replace("_", " ")} · {due ? (overdue ? `${formatDistanceToNow(due)} overdue` : `Follow-up due ${formatDistanceToNow(due, { addSuffix: true })}`) : ""}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openFollowUpInGmail(msg)}
                            className="h-8 text-xs rounded-full text-red-500 border-red-500/30 hover:bg-red-500/10 gap-1.5"
                          >
                            <Mail className="w-3.5 h-3.5 text-red-500" /> Send in Gmail
                          </Button>
                        </div>
                      </div>

                      {msg.subject && (
                        <p className="text-xs font-semibold text-foreground pt-1">
                          Subject: {msg.subject}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap leading-relaxed">
                        {msg.body}
                      </p>

                      {/* Quick Stage Status Updater */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                        <span className="text-muted-foreground text-[11px]">
                          Update reply state:
                        </span>
                        <div className="flex gap-1.5">
                          {["replied", "booked", "declined"].map((s) => (
                            <button
                              key={s}
                              onClick={() => handleStatusUpdate(msg.id, s)}
                              disabled={updatingId === msg.id}
                              className="text-[10px] px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-all capitalize"
                            >
                              {s === "booked" ? "🎉 Booked Call" : s === "replied" ? "✉ Replied" : "✕ Archived"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: FULL HISTORY ──────────────────────────────────────────── */}
        {activeTab === "history" && (
          <div className="space-y-3">
            {outreach.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3">
                <MessageSquare className="w-8 h-8 text-muted-foreground opacity-30" />
                <h3 className="text-sm font-bold text-foreground">No Outreach Logged Yet</h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Dispatched outreach emails will appear here automatically with delivery timestamps.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {outreach.map((msg) => (
                  <div
                    key={msg.id}
                    className="rounded-2xl border border-border bg-card p-5 space-y-2 hover:border-border/80 transition-colors shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-bold text-foreground">
                          {msg.company_name}
                        </span>
                        <Badge variant="outline" className={`text-[10px] uppercase font-mono ${statusBadge(msg.status)}`}>
                          {msg.status}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground capitalize font-mono">
                          {msg.type?.replace("_", " ")}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        {formatDistanceToNow(new Date(msg.created_at || msg.sent_at || Date.now()), { addSuffix: true })}
                      </span>
                    </div>

                    {msg.subject && (
                      <p className="text-xs font-semibold text-foreground">
                        Subject: {msg.subject}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed whitespace-pre-wrap">
                      {msg.body}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
