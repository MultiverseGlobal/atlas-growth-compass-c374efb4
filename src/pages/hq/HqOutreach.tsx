import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  MessageSquare, Clock, Send, Copy, Check, Loader2,
  ChevronDown, Filter, RefreshCw, Building2, Zap, X,
  Mail, Linkedin, Phone, FileText, Video
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatDistanceToNow, isPast, format } from "date-fns";

interface Lead { id: string; company: string; website: string | null; research_data: any; }
interface OutreachMsg {
  id: string;
  company_id: string;
  company_name?: string;
  type: string;
  subject: string | null;
  body: string;
  status: string;
  sent_at: string | null;
  follow_up_due: string | null;
  created_at: string;
}

const OUTREACH_TYPES = [
  { key: "cold_email",   label: "Cold Email",   icon: Mail },
  { key: "linkedin",     label: "LinkedIn DM",  icon: Linkedin },
  { key: "followup",     label: "Follow-up",    icon: MessageSquare },
  { key: "call_script",  label: "Call Script",  icon: Phone },
  { key: "loom",         label: "Loom Script",  icon: Video },
];

const FOLLOW_UP_DAYS: Record<string, number> = {
  cold_email: 3,
  linkedin: 4,
  followup: 7,
  call_script: 1,
  loom: 3,
};

function statusBadge(s: string) {
  const map: Record<string, string> = {
    draft: "bg-muted/60 text-muted-foreground border-border/40",
    sent: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    opened: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    replied: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    booked: "bg-primary/10 text-primary border-primary/20",
    declined: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return map[s] ?? "bg-muted/60 text-muted-foreground border-border/40";
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
  const [selectedType, setSelectedType] = useState("cold_email");
  const [context, setContext] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<{ subject?: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [priorMessages, setPriorMessages] = useState<OutreachMsg[]>([]);

  // Status update
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("company")) {
      setShowGenerator(true);
      setSelectedCompanyId(searchParams.get("company") ?? "");
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [leadsRes, outRes] = await Promise.all([
        supabase.from("kuro_pipeline_view").select("id, company, website, research_data").eq("user_id", user.id).order("company"),
        supabase.from("atlas_outreach").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      if (leadsRes.error) throw leadsRes.error;
      if (outRes.error) throw outRes.error;
      setLeads((leadsRes.data ?? []) as Lead[]);

      // Enrich outreach with company names
      const companyMap: Record<string, string> = {};
      (leadsRes.data ?? []).forEach((l: Lead) => { companyMap[l.id] = l.company; });
      const enriched = (outRes.data ?? []).map((o: any) => ({
        ...o,
        company_name: companyMap[o.company_id] ?? "Unknown",
      })) as OutreachMsg[];
      setOutreach(enriched);

      // Queue = follow-up due + not yet handled
      const today = new Date().toISOString().split("T")[0];
      setQueue(
        enriched.filter((o) => o.follow_up_due && o.follow_up_due <= today && ["sent", "draft"].includes(o.status))
      );
    } catch (err: any) {
      toast.error("Load error: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load prior messages when company changes
  useEffect(() => {
    if (!selectedCompanyId) { setPriorMessages([]); return; }
    const prior = outreach.filter((o) => o.company_id === selectedCompanyId).slice(0, 3);
    setPriorMessages(prior);
  }, [selectedCompanyId, outreach]);

  const handleGenerate = async () => {
    if (!selectedCompanyId) { toast.error("Select a company first"); return; }
    const lead = leads.find((l) => l.id === selectedCompanyId);
    if (!lead) return;

    setGenerating(true);
    setGenerated(null);
    try {
      const { data, error } = await supabase.functions.invoke("sourcing-machine", {
        body: {
          action: "generate-outreach",
          lead: {
            id: lead.id,
            company: lead.company,
            website: lead.website ?? "",
            prospect: "",
            founder_thesis: "",
            icp_score: 5,
            source: "manual",
            stage: "contacted",
            is_contacted: false,
            notes: context || null,
          },
          outreach_type: selectedType,
          context: context || null,
          prior_messages: priorMessages.map((m) => ({ type: m.type, body: m.body, sent_at: m.sent_at })),
          research: lead.research_data,
        },
      });
      if (error) throw new Error(error.message);

      // Parse response — sourcing-machine may return different shapes
      let subject: string | undefined;
      let body = "";
      if (typeof data === "string") {
        body = data;
      } else if (data?.body) {
        body = data.body;
        subject = data.subject;
      } else if (data?.email_body || data?.message) {
        body = data.email_body ?? data.message;
        subject = data.subject ?? data.email_subject;
      } else if (data?.content) {
        body = data.content;
        subject = data.subject;
      } else {
        body = JSON.stringify(data, null, 2);
      }

      setGenerated({ subject, body });
    } catch (err: any) {
      toast.error("Generation failed: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generated) return;
    const text = generated.subject ? `Subject: ${generated.subject}\n\n${generated.body}` : generated.body;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  };

  const handleMarkSent = async () => {
    if (!generated || !selectedCompanyId || !user) return;
    setSaving(true);
    try {
      const followUpDate = new Date();
      followUpDate.setDate(followUpDate.getDate() + (FOLLOW_UP_DAYS[selectedType] ?? 3));

      await supabase.from("atlas_outreach").insert({
        user_id: user.id,
        company_id: selectedCompanyId,
        type: selectedType,
        subject: generated.subject ?? null,
        body: generated.body,
        status: "sent",
        sent_at: new Date().toISOString(),
        follow_up_due: followUpDate.toISOString().split("T")[0],
      });

      // Update kuro_pipeline_view stage to contacted if still "new"
      const lead = leads.find((l) => l.id === selectedCompanyId);
      if (lead) {
        await supabase.from("kuro_pipeline_view")
          .update({ is_contacted: true, stage: "contacted" })
          .eq("id", selectedCompanyId)
          .eq("stage", "new");
      }

      // Log event to atlas_events
      await (supabase as any).from("atlas_events").insert({
        user_id: user.id,
        company_id: selectedCompanyId,
        event_type: "outreach_sent",
        source: "user",
        metadata: {
          type: selectedType,
          subject: generated.subject ?? null,
          body_preview: generated.body.slice(0, 200),
          follow_up_due: followUpDate.toISOString().split("T")[0],
        },
      });

      toast.success(`Marked as sent · Follow-up due in ${FOLLOW_UP_DAYS[selectedType]} days`);
      setGenerated(null);
      setContext("");
      setShowGenerator(false);
      setSearchParams({});
      await loadData();
    } catch (err: any) {
      toast.error("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Send Email via Resend (or fallback to copy) ────────────────────────────
  const [sending, setSending] = useState(false);
  const handleSendEmail = async () => {
    if (!generated || !selectedCompanyId || !user) return;
    const lead = leads.find((l) => l.id === selectedCompanyId);
    if (!lead) return;

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const base = import.meta.env.VITE_SUPABASE_URL;

      const res = await fetch(`${base}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: "", // Will be populated by Edge Function from lead research_data
          company_id: selectedCompanyId,
          subject: generated.subject ?? `Quick idea for ${lead.company}`,
          body: generated.body,
          type: selectedType,
        }),
      });

      if (res.ok) {
        toast.success("Email sent via Resend!");
        await handleMarkSent();
      } else {
        const err = await res.json().catch(() => ({ error: "Unknown" }));
        if (err?.error?.includes("RESEND_API_KEY") || res.status === 500) {
          // No Resend key configured — fall back to copy
          const text = generated.subject
            ? `Subject: ${generated.subject}\n\n${generated.body}`
            : generated.body;
          await navigator.clipboard.writeText(text);
          toast("📋 Copied to clipboard — Add a Resend API key to your Supabase Edge Function to enable direct sending", {
            duration: 6000,
          });
        } else {
          toast.error(`Send failed: ${err.error || err.message || "Unknown error"}`);
        }
      }
    } catch {
      // Edge Function doesn't exist yet — fall back to copy
      const text = generated.subject
        ? `Subject: ${generated.subject}\n\n${generated.body}`
        : generated.body;
      await navigator.clipboard.writeText(text);
      toast("📋 Copied to clipboard — send-email Edge Function not deployed yet. Paste into Gmail/Outlook.", {
        duration: 5000,
      });
    } finally {
      setSending(false);
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      await supabase.from("atlas_outreach").update({ status }).eq("id", id);
      await loadData();
      toast.success(`Status → ${status}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const selectedLead = leads.find((l) => l.id === selectedCompanyId);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-sm px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-sm font-semibold">Outreach</h1>
            <p className="text-xs text-muted-foreground font-mono">
              {queue.length} follow-up{queue.length !== 1 ? "s" : ""} due · {outreach.length} total messages
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => { setShowGenerator(true); setGenerated(null); }}
            className="h-8 bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 text-xs"
          >
            <Zap className="h-3.5 w-3.5" /> Generate Outreach
          </Button>
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Generator Panel */}
        {showGenerator && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Generate Outreach</h2>
              </div>
              <button onClick={() => { setShowGenerator(false); setGenerated(null); setSearchParams({}); }}>
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            </div>

            {/* Company + Type selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Company</label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="w-full h-9 text-sm bg-background border border-border/60 rounded-lg px-3 focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground"
                >
                  <option value="">Select company...</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>{l.company}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Message type</label>
                <div className="flex flex-wrap gap-1.5">
                  {OUTREACH_TYPES.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setSelectedType(t.key)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                        selectedType === t.key
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border/40 text-muted-foreground hover:border-border/70"
                      }`}
                    >
                      <t.icon className="h-3 w-3" />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Context */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Additional context (optional)</label>
              <Input
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder='e.g. "Met at conference", "Saw their job posting for ops manager"'
                className="h-9 text-sm bg-background border-border/60"
              />
            </div>

            {/* Prior messages */}
            {priorMessages.length > 0 && (
              <div className="rounded-lg border border-border/40 bg-muted/10 p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Prior messages to this company (for context):</p>
                {priorMessages.map((m) => (
                  <div key={m.id} className="text-xs text-muted-foreground border-l-2 border-border/40 pl-2">
                    <span className="font-medium capitalize">{m.type}</span> · {m.sent_at ? format(new Date(m.sent_at), "d MMM") : "draft"}
                    <p className="mt-0.5 line-clamp-1">{m.body}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Generate button */}
            <Button
              onClick={handleGenerate}
              disabled={generating || !selectedCompanyId}
              className="h-9 bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {generating ? "Generating..." : "Generate"}
            </Button>

            {/* Generated output */}
            {generated && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3 animate-in fade-in duration-300">
                {generated.subject && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">Subject:</p>
                    <p className="text-sm font-medium">{generated.subject}</p>
                  </div>
                )}
                <div className="space-y-1">
                  {generated.subject && <p className="text-xs font-semibold text-muted-foreground">Body:</p>}
                  <p className="text-sm whitespace-pre-wrap font-mono text-xs leading-relaxed">{generated.body}</p>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {/* Primary: Send Email via Resend (falls back to copy) */}
                  <Button
                    size="sm"
                    onClick={handleSendEmail}
                    disabled={sending || saving}
                    className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
                  >
                    {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                    {sending ? "Sending…" : "Send Email"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCopy} className="h-8 text-xs gap-1.5 border-border/60">
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleMarkSent}
                    disabled={saving}
                    variant="outline"
                    className="h-8 text-xs gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Mark as Sent
                  </Button>
                  <p className="text-xs text-muted-foreground self-center w-full mt-0.5">
                    Follow-up reminder set for {FOLLOW_UP_DAYS[selectedType]} days · Add Resend API key to Supabase to enable direct sending
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border/60">
          {(["queue", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 text-xs font-medium border-b-2 transition-all capitalize flex items-center gap-1.5 ${
                activeTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "queue" ? <Clock className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
              {t}{t === "queue" && queue.length > 0 && (
                <span className="font-mono text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/20 px-1.5 rounded-full">{queue.length}</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : activeTab === "queue" ? (
          /* QUEUE */
          <div>
            {queue.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">No follow-ups due</p>
                <p className="text-xs mt-1 opacity-70">Your queue is clear — go send some fresh outreach</p>
              </div>
            ) : (
              <div className="space-y-3">
                {queue.map((msg) => {
                  const due = msg.follow_up_due ? new Date(msg.follow_up_due) : null;
                  const overdue = due && isPast(due);
                  return (
                    <div key={msg.id} className={`rounded-xl border p-4 space-y-3 ${overdue ? "border-red-500/20 bg-red-500/5" : "border-amber-500/20 bg-amber-500/5"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{msg.company_name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusBadge(msg.status)}`}>{msg.status}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {msg.type?.replace("_", " ")} · {due ? (overdue ? `${formatDistanceToNow(due)} overdue` : `Due ${formatDistanceToNow(due, { addSuffix: true })}`) : ""}
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/hq/outreach?company=${msg.company_id}`)}
                            className="h-7 text-xs border-border/60 gap-1"
                          >
                            <Zap className="h-3 w-3" /> Follow up
                          </Button>
                        </div>
                      </div>
                      {msg.subject && <p className="text-xs font-semibold">{msg.subject}</p>}
                      <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">{msg.body}</p>
                      {/* Status update */}
                      <div className="flex gap-1.5 flex-wrap">
                        {["replied", "booked", "declined"].map((s) => (
                          <button
                            key={s}
                            onClick={() => handleStatusUpdate(msg.id, s)}
                            disabled={updatingId === msg.id}
                            className="text-[10px] px-2 py-0.5 rounded-full border border-border/40 text-muted-foreground hover:text-foreground hover:border-border/70 transition-all capitalize"
                          >
                            {s === "booked" ? "✓ Meeting booked" : s === "replied" ? "✉ Replied" : "✗ Declined"}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* HISTORY */
          <div>
            {outreach.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No outreach sent yet</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {outreach.map((msg) => (
                  <div
                    key={msg.id}
                    className="rounded-xl border border-border/60 bg-card p-4 space-y-2 hover:border-border/80 transition-colors cursor-pointer"
                    onClick={() => navigate(`/hq/leads/${msg.company_id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{msg.company_name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusBadge(msg.status)}`}>{msg.status}</span>
                        <span className="text-[10px] text-muted-foreground capitalize">{msg.type?.replace("_", " ")}</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    {msg.subject && <p className="text-xs font-semibold">{msg.subject}</p>}
                    <p className="text-sm text-muted-foreground line-clamp-2">{msg.body}</p>
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
