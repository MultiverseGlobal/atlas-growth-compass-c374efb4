import { useState, useEffect, useCallback, useRef } from "react";
import { Crosshair, Play, RefreshCw, Zap, Sparkles, Linkedin, Mail, Check, X, ExternalLink, Loader2, Send, RotateCcw } from "lucide-react";
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

// ─── Parse natural language ICP prompt into structured parameters ───────────
async function parseIcpPrompt(prompt: string, user: any, supabaseUrl: string, token: string): Promise<IcpProfile> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/atlas-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({
        messages: [{
          role: "user",
          content: `You are an ICP parser. Extract structured ICP (Ideal Customer Profile) parameters from this description and return ONLY valid JSON with these exact fields:
{
  "industries": ["string array"],
  "stages": ["string array — only: Pre-seed, Seed, Series A, Series B, Bootstrapped, SMB, Enterprise"],
  "headcount_min": number,
  "headcount_max": number,
  "geographies": ["string array — e.g. UK, US, EU, Canada"],
  "signals": ["string array — buy signals like 'Hired VP Sales', 'Raised funding recently'"],
  "pain_points": ["string array — e.g. 'Manual outreach', 'No CRM discipline'"],
  "auto_send_threshold": 70
}

ICP Description: "${prompt}"

Return ONLY the JSON object, no markdown, no explanation.`
        }],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const text = data?.reply || data?.content || data?.message || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return { ...DEFAULT_ICP, ...parsed };
      }
    }
  } catch {/* fallback below */}

  // Local fallback parser
  const lower = prompt.toLowerCase();
  const industries: string[] = [];
  const stages: string[] = [];
  const geographies: string[] = [];
  const signals: string[] = [];
  const pain_points: string[] = [];

  if (lower.includes("saas")) industries.push("B2B SaaS");
  if (lower.includes("agency") || lower.includes("agencies")) industries.push("Creative Agencies");
  if (lower.includes("fintech")) industries.push("Fintech");
  if (lower.includes("ecomm") || lower.includes("e-comm")) industries.push("E-commerce");
  if (lower.includes("health") || lower.includes("medtech")) industries.push("Health Tech");
  if (lower.includes("seed")) stages.push("Seed");
  if (lower.includes("series a")) stages.push("Series A");
  if (lower.includes("series b")) stages.push("Series B");
  if (lower.includes("bootstrap")) stages.push("Bootstrapped");
  if (lower.includes("uk")) geographies.push("UK");
  if (lower.includes(" us ") || lower.includes("united states") || lower.includes("america")) geographies.push("US");
  if (lower.includes("europe") || lower.includes(" eu ")) geographies.push("EU");
  if (lower.includes("hired") || lower.includes("vp sales")) signals.push("Hired VP Sales");
  if (lower.includes("raised") || lower.includes("funding")) signals.push("Raised funding recently");
  if (lower.includes("manual outreach")) pain_points.push("Manual outreach");
  if (lower.includes("no crm") || lower.includes("crm")) pain_points.push("No CRM discipline");
  if (lower.includes("founder doing sales") || lower.includes("founder-led")) pain_points.push("Founder doing sales");

  const headcountMatch = prompt.match(/(\d+)\s*[\-–to]+\s*(\d+)\s*(people|employees|headcount|team)/i);
  const headcount_min = headcountMatch ? parseInt(headcountMatch[1]) : 1;
  const headcount_max = headcountMatch ? parseInt(headcountMatch[2]) : 500;

  return { ...DEFAULT_ICP, industries, stages, geographies, signals, pain_points, headcount_min, headcount_max };
}

export default function HqICP() {
  const { user } = useAuth();
  const [icp, setIcp] = useState<IcpProfile>(DEFAULT_ICP);
  const [running, setRunning] = useState(false);
  const [runStatus, setRunStatus] = useState("");
  const [stats, setStats] = useState<PipelineStats>({ sourced: 0, matched: 0, sent: 0, replied: 0 });
  const [queue, setQueue] = useState<PipelineLead[]>(() => {
    try {
      const raw = localStorage.getItem("atlas_pipeline_queue");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ── Prompt box state ────────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(false);
  const [showParams, setShowParams] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      const dbSourced = a.count ?? 0;
      if (dbSourced > 0) {
        setStats({ sourced: dbSourced, matched: b.count ?? 0, sent: c.count ?? 0, replied: d.count ?? 0 });
      } else {
        // Fallback to local queue stats
        try {
          const raw = localStorage.getItem("atlas_pipeline_queue");
          const localQueue: PipelineLead[] = raw ? JSON.parse(raw) : [];
          if (localQueue.length > 0) {
            setStats({
              sourced: localQueue.length,
              matched: localQueue.filter(l => (l.icp_score || 0) >= 60).length,
              sent: 0,
              replied: 0,
            });
          }
        } catch { /* fallback */ }
      }
    } catch { /* fallback */ }
  }, [user]);

  const loadQueue = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase.from("kuro_pipeline_view")
        .select("id, prospect, company, website, icp_score, stage, source, founder_thesis, draft_message")
        .eq("user_id", user.id)
        .eq("is_contacted", false)
        .order("icp_score", { ascending: false })
        .limit(20);
      if (data && data.length > 0) {
        const mapped = data.map((l: any) => ({
          ...l,
          icp_score: (l.icp_score || 0) <= 10 ? (l.icp_score || 0) * 10 : l.icp_score,
        }));
        setQueue(mapped);
        localStorage.setItem("atlas_pipeline_queue", JSON.stringify(mapped));
      }
    } catch { /* fallback */ }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase.from("icp_profiles" as any).select("*").eq("user_id", user.id).maybeSingle().then(({ data }: any) => {
      if (data) {
        const d = data as IcpProfile;
        setIcp(d);
        // Build a human-readable prompt from existing params
        const parts: string[] = [];
        if (d.industries?.length) parts.push(d.industries.join(", "));
        if (d.stages?.length) parts.push(d.stages.join(", ") + " stage");
        if (d.geographies?.length) parts.push("in " + d.geographies.join(", "));
        if (d.headcount_min && d.headcount_max) parts.push(`${d.headcount_min}–${d.headcount_max} people`);
        if (d.pain_points?.length) parts.push("pain: " + d.pain_points.join(", "));
        setPrompt(parts.join(". "));
        setParsed(true);
      }
    });
    loadStats();
    loadQueue();
  }, [user, loadStats, loadQueue]);

  const handleParsePrompt = async () => {
    if (!prompt.trim() || !user) return;
    setParsing(true);
    setParsed(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const base = import.meta.env.VITE_SUPABASE_URL;
      const result = await parseIcpPrompt(prompt, user, base, token);
      setIcp(result);

      // Auto-save to DB
      await supabase.from("icp_profiles" as any).upsert(
        { user_id: user.id, ...result, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      setParsed(true);
      toast.success("ICP updated from your description");
    } catch (e: any) {
      toast.error("Parse failed: " + e.message);
    } finally {
      setParsing(false);
    }
  };

  const copyLinkedIn = (lead: PipelineLead) => {
    const msg = lead.draft_message || `Hey ${lead.prospect.split(" ")[0] || "there"}, noticed what you're building at ${lead.company}. Saw you're navigating ${lead.founder_thesis || "scaling challenges"} — put together a quick solution that could save you 10+ hrs/wk. Mind if I share?`;
    navigator.clipboard.writeText(msg);
    setCopiedId(lead.id);
    toast.success("LinkedIn DM copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2500);
  };

  const markLeadContacted = (leadId: string) => {
    setQueue(prev => {
      const updated = prev.filter(l => l.id !== leadId);
      localStorage.setItem("atlas_pipeline_queue", JSON.stringify(updated));
      return updated;
    });
    setStats(prev => ({ ...prev, sent: prev.sent + 1 }));
    toast.success("Lead marked as contacted");
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

      let activeIcp = icp;

      // ── Step 0: Auto-parse if prompt was pasted without clicking Parse ────────
      if (prompt.trim() && (isEmpty || !parsed)) {
        setRunStatus("Parsing your ICP description…");
        try {
          activeIcp = await parseIcpPrompt(prompt, user, base, token ?? "");
          setIcp(activeIcp);
          setParsed(true);
        } catch { /* proceed with fallback */ }
      }

      let edgeFunctionAvailable = true;

      // ── Step 1: HN Source ────────────────────────────────────────────────────
      setRunStatus("Sourcing from Hacker News…");
      try {
        const hnRes = await fetch(`${base}/functions/v1/sourcing-machine`, {
          method: "POST", headers,
          body: JSON.stringify({ action: "hn-source", query: buildQuery(activeIcp), time_range: "week" }),
          signal: AbortSignal.timeout(20000),
        });
        if (!hnRes.ok) throw new Error(`HN Edge Function: ${hnRes.status}`);
        const hnData = await hnRes.json();
        if (hnData.leads?.length) {
          toast.success(`${hnData.leads.length} leads from HN`);
        }
      } catch (edgeErr: any) {
        console.warn("Edge Function unavailable, using client-side HN fallback:", edgeErr.message);
        edgeFunctionAvailable = false;

        // ── Client-side HN Algolia fallback (no API key needed) ──────────────
        try {
          const query = buildQuery(activeIcp);
          const cutoff = Math.floor(Date.now() / 1000) - 14 * 24 * 60 * 60; // 14 days window for abundant results
          const algoliaUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&numericFilters=created_at_i>=${cutoff}&hitsPerPage=20`;
          const algoliaRes = await fetch(algoliaUrl, { signal: AbortSignal.timeout(12000) });
          if (!algoliaRes.ok) throw new Error("Algolia failed");

          const algoliaData = await algoliaRes.json();
          const hits = algoliaData.hits || [];

          // Keyword ICP scoring
          const icpKeywords = [...activeIcp.industries, ...activeIcp.signals, ...activeIcp.pain_points, ...activeIcp.stages].map(k => k.toLowerCase());
          const clientLeads: PipelineLead[] = [];

          for (const hit of hits.slice(0, 15)) {
            const text = `${hit.title || ""} ${hit.story_text || ""} ${hit.url || ""}`.toLowerCase();
            let score = 5; // Base: live active founder on HN
            for (const kw of icpKeywords) {
              if (kw && text.includes(kw)) score += 2;
            }
            if (text.includes("saas") || text.includes("startup") || text.includes("mrr") || text.includes("launch")) score += 2;
            if (text.includes("show hn")) score += 2;
            if (text.includes("bootstrap") || text.includes("solo") || text.includes("indie")) score += 1;
            score = Math.min(score, 15);
            const icpPercent = Math.round((score / 15) * 100);

            // Extract founder thesis from story or title
            const thesis = hit.story_text
              ? hit.story_text.replace(/<[^>]+>/g, " ").slice(0, 180).trim()
              : hit.title || "";

            const cleanCompany = (hit.title || "").replace(/^Show HN:\s*/i, "").split(/[–—\-:]/)[0].trim() || "Startup";

            const lead: PipelineLead = {
              id: crypto.randomUUID(),
              prospect: hit.author || "Founder",
              company: cleanCompany,
              website: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
              icp_score: icpPercent,
              stage: "Sourced",
              source: `https://news.ycombinator.com/item?id=${hit.objectID}`,
              founder_thesis: thesis,
              draft_message: `Hey ${hit.author || "there"}, saw what you're building with ${cleanCompany}. Saw you're navigating growth challenges — put together a quick solution that could save you 10+ hrs/wk. Mind if I share a 2-min breakdown?`,
            };
            clientLeads.push(lead);
          }

          // Sort by ICP score descending
          clientLeads.sort((a, b) => b.icp_score - a.icp_score);

          if (clientLeads.length > 0) {
            setQueue(clientLeads);
            localStorage.setItem("atlas_pipeline_queue", JSON.stringify(clientLeads));
            setStats({
              sourced: clientLeads.length,
              matched: clientLeads.filter(l => l.icp_score >= 60).length,
              sent: 0,
              replied: 0,
            });
            toast.success(`${clientLeads.length} ICP leads sourced from Hacker News!`);
          }
        } catch (fallbackErr: any) {
          console.warn("Client-side HN fallback also failed:", fallbackErr.message);
          toast.error("HN sourcing failed — check network connection");
        }
      }

      // ── Step 2: YC Source ────────────────────────────────────────────────────
      if (edgeFunctionAvailable) {
        setRunStatus("Sourcing from YC…");
        try {
          await fetch(`${base}/functions/v1/sourcing-machine`, {
            method: "POST", headers,
            body: JSON.stringify({ action: "yc-source", filter: activeIcp.stages.join(","), industry: activeIcp.industries.join(",") }),
            signal: AbortSignal.timeout(20000),
          });
        } catch {
          console.warn("YC source skipped — Edge Function unavailable");
        }
      }

      setRunStatus("✓ Pipeline Complete");
      setLastRun(new Date().toLocaleTimeString());
      toast.success("Pipeline run complete — review leads in Action Queue below");
    } catch (e: any) {
      setRunStatus(`Error: ${e.message}`);
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  };

  // ── First-run onboarding ──────────────────────────────────────────────────
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem("atlas_onboarding_dismissed");
  });
  const dismissOnboarding = () => { setShowOnboarding(false); localStorage.setItem("atlas_onboarding_dismissed", "1"); };

  // Auto-dismiss once ICP is parsed
  useEffect(() => { if (parsed && showOnboarding) dismissOnboarding(); }, [parsed]);

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "var(--base)", padding: "32px 40px", fontFamily: "Inter, sans-serif" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>

        {/* ── First-Run Onboarding Guide ─────────────────────────────────────── */}
        {showOnboarding && !parsed && (
          <div style={{
            background: "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(52,211,153,0.06) 100%)",
            border: "1px solid rgba(99,102,241,0.2)", borderRadius: 16,
            padding: "24px 28px", marginBottom: 24, position: "relative",
          }}>
            <button onClick={dismissOnboarding} style={{
              position: "absolute", top: 12, right: 12, background: "none", border: "none",
              color: "var(--text-muted)", cursor: "pointer", fontSize: 16, padding: 4,
            }}>✕</button>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <Zap size={18} color="#818CF8" />
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Space Grotesk, sans-serif" }}>
                Welcome to Atlas — here's how to get your first leads
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {/* Step 1 */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#818CF8", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>1</div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>Describe Your Customer</span>
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                  Type who you're selling <strong>to</strong> — not your pitch. Include industry, stage, geography, and pain points.
                </p>
                <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(0,0,0,0.2)", borderRadius: 8, fontSize: 10, color: "var(--text-secondary)", fontStyle: "italic", lineHeight: 1.5 }}>
                  "Solo SaaS founders, bootstrapped, UK/US, doing manual outreach, no CRM, pre-revenue to $10k MRR"
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#34D399", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>2</div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>Parse & Save</span>
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                  Click <strong>Parse & Save ICP</strong> — Atlas extracts structured parameters (industries, stages, signals) from your description.
                </p>
                <div style={{ marginTop: 10, display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {["B2B SaaS", "Bootstrapped", "UK", "Manual outreach"].map(t => (
                    <span key={t} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: "rgba(99,102,241,0.15)", color: "#A5B4FC", fontWeight: 600 }}>{t}</span>
                  ))}
                </div>
              </div>

              {/* Step 3 */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#FBBF24", color: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>3</div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>Run Full Pipeline</span>
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                  Searches HN + YC for matching founders, scores them against your ICP, drafts personalised LinkedIn DMs.
                </p>
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <Linkedin size={12} color="#818CF8" />
                  <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>Copy DM → send on LinkedIn</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <Mail size={12} color="#34D399" />
                  <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>Or send to Outreach Studio</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Morning Alert Banner */}
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
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Autonomous 7:00 AM Sync Active</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Auto-sends outreach for ICP score ≥ 70 · Keeps review candidates in queue below</div>
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#34D399", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 6, padding: "3px 8px" }}>● Daily Cron Ready</span>
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <Crosshair size={20} color="#818CF8" />
              <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 24, color: "var(--text-primary)", letterSpacing: "-0.02em", margin: 0 }}>ICP Command Center</h1>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Describe your ideal customer in plain English. Atlas handles the rest.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <button
              onClick={runPipeline}
              disabled={running || (isEmpty && !prompt.trim())}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: (running || (isEmpty && !prompt.trim())) ? "var(--accent-dim)" : "var(--accent)",
                border: "none", borderRadius: 12, padding: "12px 24px",
                color: (running || (isEmpty && !prompt.trim())) ? "#818CF8" : "white",
                fontWeight: 700, fontSize: 14,
                cursor: (running || (isEmpty && !prompt.trim())) ? "not-allowed" : "pointer",
                boxShadow: (running || (isEmpty && !prompt.trim())) ? "none" : "0 4px 20px rgba(99,102,241,0.4)",
                transition: "all 0.2s",
                animation: (!running && (prompt.trim() || !isEmpty) && !lastRun) ? "pulse-glow 2s ease-in-out infinite" : "none",
              }}
            >
              {running ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={15} />}
              {running ? runStatus || "Running…" : "Run Full Pipeline"}
            </button>
            {(prompt.trim() || !isEmpty) && !running && !lastRun && (
              <span style={{ fontSize: 11, color: "#818CF8", fontWeight: 600, animation: "fade-in 0.5s ease" }}>
                ↑ Ready — click to source leads instantly
              </span>
            )}
          </div>
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

        {/* ── ICP Prompt Box ──────────────────────────────────────────────────── */}
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px 28px", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Crosshair size={14} color="#818CF8" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>ICP Brief</span>
              {lastRun && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>· Last run {lastRun}</span>}
            </div>
            {!isEmpty && (
              <button
                onClick={() => setShowParams(s => !s)}
                style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "3px 10px", cursor: "pointer", color: "var(--text-muted)", fontSize: 11 }}
              >
                {showParams ? "Hide params" : "View parsed params"}
              </button>
            )}
          </div>

          {/* Natural language textarea */}
          <div style={{ position: "relative" }}>
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={e => { setPrompt(e.target.value); setParsed(false); }}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleParsePrompt(); }}
              placeholder={`Describe your ideal customer in detail. For example:\n\n"B2B SaaS or creative agencies at Seed to Series A stage, 5–50 people, UK and US focus. They've recently hired a VP of Sales or raised funding. Main pain: founder doing all outreach manually with no real CRM process. They're trying to build a repeatable pipeline but don't have the system yet."`}
              style={{
                width: "100%",
                minHeight: 140,
                background: "var(--surface)",
                border: `1px solid ${parsed ? "rgba(52,211,153,0.4)" : "var(--border)"}`,
                borderRadius: 12,
                padding: "16px",
                fontSize: 13,
                color: "var(--text-primary)",
                outline: "none",
                resize: "vertical",
                lineHeight: 1.6,
                fontFamily: "Inter, sans-serif",
                boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
            />
            {parsed && (
              <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700, color: "#34D399" }}>
                ✓ Parsed
              </div>
            )}
          </div>

          {/* Actions row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <button
              onClick={handleParsePrompt}
              disabled={parsing || !prompt.trim()}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: parsing ? "var(--accent-dim)" : "var(--accent)",
                border: "none", borderRadius: 10, padding: "10px 20px",
                color: parsing ? "#818CF8" : "white", fontWeight: 700, fontSize: 13,
                cursor: (parsing || !prompt.trim()) ? "not-allowed" : "pointer",
                transition: "all 0.2s",
              }}
            >
              {parsing ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Zap size={14} />}
              {parsing ? "Parsing…" : "Parse & Save ICP"}
            </button>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>⌘↵ to save</span>
            {!isEmpty && (
              <button
                onClick={() => { setIcp(DEFAULT_ICP); setPrompt(""); setParsed(false); }}
                style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
              >
                <RotateCcw size={11} /> Reset
              </button>
            )}
          </div>

          {/* Parsed parameters display (collapsible) */}
          {showParams && !isEmpty && (
            <div style={{ marginTop: 16, padding: "14px 16px", background: "var(--base)", border: "1px solid var(--border)", borderRadius: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", marginBottom: 10 }}>PARSED PARAMETERS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {icp.industries.length > 0 && (
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", width: 80, flexShrink: 0 }}>Industries</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {icp.industries.map(t => <span key={t} style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-border)", borderRadius: 5, padding: "2px 8px", fontSize: 11, color: "#818CF8" }}>{t}</span>)}
                    </div>
                  </div>
                )}
                {icp.stages.length > 0 && (
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", width: 80, flexShrink: 0 }}>Stage</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {icp.stages.map(t => <span key={t} style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-border)", borderRadius: 5, padding: "2px 8px", fontSize: 11, color: "#818CF8" }}>{t}</span>)}
                    </div>
                  </div>
                )}
                {icp.geographies.length > 0 && (
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", width: 80, flexShrink: 0 }}>Geography</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {icp.geographies.map(t => <span key={t} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 5, padding: "2px 8px", fontSize: 11, color: "var(--text-secondary)" }}>{t}</span>)}
                    </div>
                  </div>
                )}
                {icp.headcount_max > 0 && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", width: 80, flexShrink: 0 }}>Headcount</span>
                    <span style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 5, padding: "2px 8px", fontSize: 11, color: "var(--text-secondary)" }}>{icp.headcount_min}–{icp.headcount_max} people</span>
                  </div>
                )}
                {icp.signals.length > 0 && (
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", width: 80, flexShrink: 0 }}>Buy Signals</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {icp.signals.map(t => <span key={t} style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 5, padding: "2px 8px", fontSize: 11, color: "#34D399" }}>⚡ {t}</span>)}
                    </div>
                  </div>
                )}
                {icp.pain_points.length > 0 && (
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", width: 80, flexShrink: 0 }}>Pain Points</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {icp.pain_points.map(t => <span key={t} style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 5, padding: "2px 8px", fontSize: 11, color: "#FBBF24" }}>{t}</span>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Queue */}
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
              Queue empty — define your ICP above and click "Run Full Pipeline" to source leads.
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
                <button
                  onClick={() => copyLinkedIn(lead)}
                  title="Copy LinkedIn DM message"
                  style={{ background: copiedId === lead.id ? "rgba(52,211,153,0.15)" : "var(--surface)", border: `1px solid ${copiedId === lead.id ? "rgba(52,211,153,0.4)" : "var(--border)"}`, borderRadius: 8, padding: "5px 10px", fontSize: 11, color: copiedId === lead.id ? "#34D399" : "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                >
                  {copiedId === lead.id ? <Check size={11} /> : <Linkedin size={11} />}
                  {copiedId === lead.id ? "Copied" : "LinkedIn"}
                </button>
                <button
                  onClick={() => window.location.href = `/hq/outreach?company=${lead.id}`}
                  style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-border)", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 600, color: "#818CF8", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                >
                  <Mail size={11} /> Email
                </button>
                <button
                  onClick={() => markLeadContacted(lead.id)}
                  title="Mark this lead as contacted or dismissed"
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 8px", fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 4px 20px rgba(99,102,241,0.4); }
            50% { box-shadow: 0 4px 32px rgba(99,102,241,0.7), 0 0 48px rgba(99,102,241,0.3); }
          }
          @keyframes fade-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
      </div>
    </div>
  );
}
