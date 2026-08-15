import { useState, useEffect, useCallback } from "react";
import { Crosshair, Play, RefreshCw, Zap, Edit2, X, Plus, Linkedin, Mail, Check, ExternalLink, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface IcpProfile {
  industries: string[];
  stages: string[];
  headcount_min: number;
  headcount_max: number;
  geographies: string[];
  signals: string[];
  pain_points: string[];
  auto_send_threshold: number;
}

interface PipelineLead {
  id: string;
  prospect: string;
  company: string;
  website: string;
  icp_score: number;
  stage: string;
  source: string;
  founder_thesis: string;
  draft_message?: string | null;
}

interface PipelineStats {
  sourced: number;
  matched: number;
  sent: number;
  replied: number;
}

const DEFAULT_ICP: IcpProfile = {
  industries: [], stages: [], headcount_min: 1, headcount_max: 500,
  geographies: [], signals: [], pain_points: [], auto_send_threshold: 70,
};

const STAGE_OPTIONS = ["Pre-seed","Seed","Series A","Series B","Bootstrapped","SMB","Enterprise"];
const GEO_OPTIONS = ["UK","US","EU","Canada","Australia","Global"];

function TagEditor({ label, tags, onChange, placeholder, suggestions }: {
  label: string; tags: string[]; onChange: (t: string[]) => void; placeholder: string; suggestions?: string[];
}) {
  const [input, setInput] = useState("");
  const add = (val: string) => { const v = val.trim(); if (v && !tags.includes(v)) onChange([...tags, v]); setInput(""); };
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
        {tags.map(t => (
          <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--accent-dim)", border: "1px solid var(--accent-border)", borderRadius: 6, padding: "3px 8px", fontSize: 12, color: "#818CF8" }}>
            {t}
            <button onClick={() => onChange(tags.filter(x => x !== t))} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, lineHeight: 1 }}><X size={10} /></button>
          </span>
        ))}
        {suggestions?.filter(s => !tags.includes(s)).slice(0,4).map(s => (
          <button key={s} onClick={() => add(s)} style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }}>+ {s}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && add(input)} placeholder={placeholder}
          style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "var(--text-primary)", outline: "none" }} />
        <button onClick={() => add(input)} style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-border)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "#818CF8" }}><Plus size={13} /></button>
      </div>
    </div>
  );
}

export default function HqICP() {
  const { user } = useAuth();
  const [icp, setIcp] = useState<IcpProfile>(DEFAULT_ICP);
  const [editing, setEditing] = useState(false);
  const [running, setRunning] = useState(false);
  const [runStatus, setRunStatus] = useState("");
  const [stats, setStats] = useState<PipelineStats>({ sourced: 0, matched: 0, sent: 0, replied: 0 });
  const [queue, setQueue] = useState<PipelineLead[]>([]);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isEmpty = icp.industries.length === 0 && icp.stages.length === 0 && icp.geographies.length === 0;

  const loadStats = useCallback(async () => {
    if (!user) return;
    try {
      const [a, b, c, d] = await Promise.all([
        supabase.from("kuro_pipeline_view").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("kuro_pipeline_view").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("icp_score", 7),
        supabase.from("kuro_pipeline_view").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_contacted", true),
        supabase.from("kuro_pipeline_view").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("reply_status", "replied"),
      ]);
      setStats({ sourced: a.count ?? 0, matched: b.count ?? 0, sent: c.count ?? 0, replied: d.count ?? 0 });
    } catch {
      // fallback
    }
  }, [user]);

  const loadQueue = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase.from("kuro_pipeline_view")
        .select("id, prospect, company, website, icp_score, stage, source, founder_thesis, draft_message")
        .eq("user_id", user.id)
        .eq("is_contacted", false)
        .order("icp_score", { ascending: false })
        .limit(10);
      if (data) {
        setQueue(data.map((l: any) => ({
          ...l,
          icp_score: (l.icp_score || 0) <= 10 ? (l.icp_score || 0) * 10 : l.icp_score,
        })));
      }
    } catch {
      // fallback
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase.from("icp_profiles" as any).select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) setIcp(data as IcpProfile); else setEditing(true);
    });
    loadStats();
    loadQueue();
  }, [user, loadStats, loadQueue]);

  const saveIcp = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from("icp_profiles" as any).upsert({ user_id: user.id, ...icp, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    setSaving(false);
    setEditing(false);
    toast.success("ICP settings saved");
  };

  const copyLinkedIn = (lead: PipelineLead) => {
    const msg = lead.draft_message || `Hey ${lead.prospect.split(" ")[0] || "there"}, noticed what you're building at ${lead.company}. Saw you're navigating ${lead.founder_thesis || "scaling challenges"} — put together a quick solution that could save you 10+ hrs/wk. Mind if I share?`;
    navigator.clipboard.writeText(msg);
    setCopiedId(lead.id);
    toast.success("LinkedIn DM copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2500);
  };

  const buildQuery = (p: IcpProfile) => [...p.industries, ...p.stages, ...p.signals].filter(Boolean).join(" ") || "B2B SaaS";

  const runPipeline = async () => {
    if (running) return;
    setRunning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const base = import.meta.env.VITE_SUPABASE_URL;
      const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };

      setRunStatus("Sourcing from Hacker News…");
      await fetch(`${base}/functions/v1/sourcing-machine`, { method: "POST", headers, body: JSON.stringify({ action: "hn-source", query: buildQuery(icp), time_range: "week" }) });

      setRunStatus("Sourcing from YC…");
      await fetch(`${base}/functions/v1/sourcing-machine`, { method: "POST", headers, body: JSON.stringify({ action: "yc-source", filter: icp.stages.join(","), industry: icp.industries.join(",") }) });

      setRunStatus("Auto-scoring and drafting outreach…");
      const { data: top } = await supabase.from("kuro_pipeline_view").select("*").eq("user_id", user!.id).gte("icp_score", 7).eq("is_contacted", false).limit(10);
      for (const lead of top ?? []) {
        await fetch(`${base}/functions/v1/sourcing-machine`, { method: "POST", headers, body: JSON.stringify({ action: "auto-enrich", lead_id: lead.id }) });
      }

      setRunStatus("✓ Pipeline Complete");
      setLastRun(new Date().toLocaleTimeString());
      toast.success("Pipeline run complete — new leads ready for outreach");
      await loadStats();
      await loadQueue();
    } catch (e: any) {
      setRunStatus(`Error: ${e.message}`);
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "var(--base)", padding: "32px 40px", fontFamily: "Inter, sans-serif" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>

        {/* Morning Alert / Daily Status Banner */}
        <div style={{
          background: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(167,139,250,0.06) 100%)",
          border: "1px solid rgba(99,102,241,0.25)",
          borderRadius: 14, padding: "14px 20px", marginBottom: 28,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={16} color="#818CF8" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                Autonomous 7:00 AM Sync Active
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Auto-sends outreach for ICP score ≥ 70 · Keeps review candidates in queue below
              </div>
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#34D399", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 6, padding: "3px 8px" }}>
            ● Daily Cron Ready
          </span>
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <Crosshair size={20} color="#818CF8" />
              <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 24, color: "var(--text-primary)", letterSpacing: "-0.02em", margin: 0 }}>ICP Command Center</h1>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Define your ICP parameters. Let Atlas source, qualify, and draft outreach.</p>
          </div>
          <button onClick={runPipeline} disabled={running} style={{ display: "flex", alignItems: "center", gap: 8, background: running ? "var(--accent-dim)" : "var(--accent)", border: "none", borderRadius: 12, padding: "12px 24px", color: "white", fontWeight: 700, fontSize: 14, cursor: running ? "not-allowed" : "pointer", boxShadow: running ? "none" : "0 4px 20px rgba(99,102,241,0.4)" }}>
            {running ? <RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={15} />}
            {running ? runStatus || "Running…" : "Run Full Pipeline"}
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
          {[["Sourced Leads", stats.sourced, "var(--text-secondary)"], ["ICP Matches (≥70)", stats.matched, "#818CF8"], ["Outreach Sent", stats.sent, "#34D399"], ["Replies Won", stats.replied, "#FBBF24"]].map(([l, v, c]) => (
            <div key={l as string} style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: c as string, fontFamily: "Space Grotesk, sans-serif", letterSpacing: "-0.02em" }}>{v as number}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{l as string}</div>
            </div>
          ))}
        </div>

        {/* ICP Card */}
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px 28px", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Active ICP Parameters</span>
              {lastRun && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>· Last run {lastRun}</span>}
            </div>
            <button onClick={() => setEditing(e => !e)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", color: "var(--text-secondary)", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
              <Edit2 size={11} /> {editing ? "Cancel" : "Edit"}
            </button>
          </div>
          {editing ? (
            <div>
              <TagEditor label="INDUSTRY" tags={icp.industries} onChange={v => setIcp(p => ({ ...p, industries: v }))} placeholder="e.g. B2B SaaS, Creative Agencies, Fintech…" />
              <TagEditor label="FUNDING STAGE" tags={icp.stages} onChange={v => setIcp(p => ({ ...p, stages: v }))} placeholder="e.g. Seed, Series A…" suggestions={STAGE_OPTIONS} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                {[["MIN HEADCOUNT", "headcount_min"], ["MAX HEADCOUNT", "headcount_max"]].map(([label, key]) => (
                  <div key={key}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
                    <input type="number" value={icp[key as keyof IcpProfile] as number} onChange={e => setIcp(p => ({ ...p, [key]: +e.target.value }))} style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }} />
                  </div>
                ))}
              </div>
              <TagEditor label="GEOGRAPHY" tags={icp.geographies} onChange={v => setIcp(p => ({ ...p, geographies: v }))} placeholder="e.g. UK, US, EU…" suggestions={GEO_OPTIONS} />
              <TagEditor label="BUY SIGNALS" tags={icp.signals} onChange={v => setIcp(p => ({ ...p, signals: v }))} placeholder="e.g. Hired VP Sales, Raised funding recently…" />
              <TagEditor label="PAIN POINTS" tags={icp.pain_points} onChange={v => setIcp(p => ({ ...p, pain_points: v }))} placeholder="e.g. Manual outreach, No CRM discipline, Founder doing sales…" />
              <button onClick={saveIcp} disabled={saving} style={{ background: "var(--accent)", border: "none", borderRadius: 10, padding: "10px 24px", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer", marginTop: 8 }}>
                {saving ? "Saving…" : "Save ICP"}
              </button>
            </div>
          ) : isEmpty ? (
            <div style={{ padding: "16px 0", textAlign: "center" }}>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 10 }}>No ICP defined yet</p>
              <button onClick={() => setEditing(true)} style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-border)", borderRadius: 8, padding: "7px 16px", color: "#818CF8", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Define ICP</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[...icp.industries, ...icp.stages, ...icp.geographies].map(t => <span key={t} style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-border)", borderRadius: 6, padding: "3px 10px", fontSize: 12, color: "#818CF8" }}>{t}</span>)}
              {icp.headcount_max > 0 && <span style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 10px", fontSize: 12, color: "var(--text-secondary)" }}>{icp.headcount_min}–{icp.headcount_max} people</span>}
              {icp.signals.map(s => <span key={s} style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 6, padding: "3px 10px", fontSize: 12, color: "#34D399" }}>⚡ {s}</span>)}
            </div>
          )}
        </div>

        {/* Queue */}
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Zap size={14} color="#FBBF24" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Action Queue</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>· ≥70 ICP auto-drafted, ready for email send / LinkedIn copy</span>
            </div>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "Space Mono, monospace" }}>{queue.length} in queue</span>
          </div>

          {queue.length === 0 ? (
            <div style={{ padding: "36px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              Queue empty — click "Run Full Pipeline" above to source and qualify new leads.
            </div>
          ) : queue.map((lead, i) => (
            <div key={lead.id} style={{ display: "flex", alignItems: "center", padding: "14px 24px", borderBottom: i < queue.length - 1 ? "1px solid var(--border)" : "none", gap: 14 }}>
              <div style={{ width: 44, flexShrink: 0, textAlign: "center" }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: lead.icp_score >= 70 ? "#818CF8" : "var(--text-secondary)", fontFamily: "Space Grotesk, sans-serif", lineHeight: 1 }}>{lead.icp_score}</div>
                <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>ICP</div>
              </div>
              <div style={{ width: 56, height: 3, background: "var(--surface)", borderRadius: 2, flexShrink: 0 }}>
                <div style={{ height: "100%", width: `${lead.icp_score}%`, background: lead.icp_score >= 70 ? "var(--accent)" : "var(--text-muted)", borderRadius: 2 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {lead.prospect || lead.company}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {lead.company} · {lead.source || "Sourced"} {lead.founder_thesis && `· "${lead.founder_thesis.slice(0, 45)}…"`}
                </div>
              </div>
              <span style={{ background: lead.icp_score >= 70 ? "rgba(99,102,241,0.1)" : "var(--surface)", border: `1px solid ${lead.icp_score >= 70 ? "var(--accent-border)" : "var(--border)"}`, borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700, color: lead.icp_score >= 70 ? "#818CF8" : "var(--text-muted)", flexShrink: 0 }}>
                {lead.icp_score >= 70 ? "AUTO-SEND" : "REVIEW"}
              </span>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {/* LinkedIn Copy */}
                <button
                  onClick={() => copyLinkedIn(lead)}
                  title="Copy LinkedIn DM message"
                  style={{
                    background: copiedId === lead.id ? "rgba(52,211,153,0.15)" : "var(--surface)",
                    border: `1px solid ${copiedId === lead.id ? "rgba(52,211,153,0.4)" : "var(--border)"}`,
                    borderRadius: 8, padding: "5px 10px", fontSize: 11,
                    color: copiedId === lead.id ? "#34D399" : "var(--text-secondary)",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  {copiedId === lead.id ? <Check size={11} /> : <Linkedin size={11} />}
                  {copiedId === lead.id ? "Copied" : "LinkedIn"}
                </button>
                {/* Email / Detail */}
                <button
                  onClick={() => window.location.href = `/hq/outreach?company=${lead.id}`}
                  style={{
                    background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
                    borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 600,
                    color: "#818CF8", cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  <Mail size={11} /> Email
                </button>
                <button
                  onClick={() => supabase.from("kuro_pipeline_view").update({ stage: "archived" }).eq("id", lead.id).then(() => setQueue(p => p.filter(l => l.id !== lead.id)))}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 8px", fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }}
                >
                  Skip
                </button>
              </div>
            </div>
          ))}
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
