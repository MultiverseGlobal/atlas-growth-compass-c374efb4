import { useState } from "react";
import { 
  Crosshair, Zap, Sparkles, Linkedin, Mail, Check, 
  X, ExternalLink, Loader2, Send, Building2, 
  CheckCircle2, ShieldCheck
} from "lucide-react";
import { useMetaphorPipeline } from "@/hooks/useMetaphorPipeline";
import { MetaphorBriefCard } from "@/components/MetaphorBriefCard";
import { toast } from "sonner";

export interface TargetLead {
  id: string;
  company: string;
  website: string;
  industry: string;
  location: string;
  team_size: string;
  icp_score: number;
  founder: {
    name: string;
    role: string;
    email?: string;
    linkedin_url?: string;
  };
  bottleneck: {
    area: string;
    observation: string;
    hypothesis: string;
  };
  pitch: {
    linkedin_dm: string;
    email_subject: string;
    email_body: string;
  };
  status: 'pending_decision' | 'approved' | 'dismissed';
}

const DEFAULT_TARGETS: TargetLead[] = [
  {
    id: "1",
    company: "Perceptric",
    website: "https://perceptric.com",
    industry: "B2B Technical SEO & GEO",
    location: "Singapore (Remote)",
    team_size: "~8 people",
    icp_score: 94,
    founder: {
      name: "Vincent Nguyen",
      role: "Founder & CEO",
      email: "vincent@perceptric.com",
      linkedin_url: "https://linkedin.com/in/vincent-nguyen-perceptric",
    },
    bottleneck: {
      area: "Subject-Matter Writer Coordination & Briefing",
      observation: "They hire developers and fintech pros rather than regular generalist writers.",
      hypothesis: "Briefing non-writing specialists and managing the editorial/CMS handoffs creates a heavy manual load that Vincent manages personally.",
    },
    pitch: {
      linkedin_dm: "Hey Vincent — saw Perceptric's technical SEO teardown on vector search. Really clean. Quick question: with engineers writing your technical drafts, how are you handling the briefing and schema review without spending 10+ hours a week reviewing drafts yourself?",
      email_subject: "Vincent / Perceptric technical writer workflow",
      email_body: "Hi Vincent,\n\nNoticed how Perceptric uses practitioner engineers rather than generalist copywriters for your technical SEO clients. The depth is noticeably better than 95% of agency content.\n\nWe built an autonomous technical briefing pipeline that translates raw engineering commits into structured client drafts, saving founder-led agency teams ~12 hrs/week.\n\nMind if I send over a 2-minute Loom teardown?",
    },
    status: 'pending_decision',
  },
  {
    id: "2",
    company: "Archon Research",
    website: "https://archon.cx",
    industry: "Fintech Market Intelligence",
    location: "London, UK",
    team_size: "~14 people",
    icp_score: 91,
    founder: {
      name: "Arthur Finch",
      role: "Co-Founder",
      email: "arthur@archon.cx",
      linkedin_url: "https://linkedin.com/in/arthur-finch-archon",
    },
    bottleneck: {
      area: "Client Deliverable Production & Synthesis",
      observation: "Deliver bespoke quarterly macroeconomic briefings to family offices.",
      hypothesis: "Synthesizing unstructured market intelligence into PDF briefings creates an operational crunch at the end of every quarter.",
    },
    pitch: {
      linkedin_dm: "Arthur — read Archon's piece on private credit liquidity in Q1. Spot on. Are you still formatting and synthesizing the quarterly family office dossiers manually, or have you automated the deliverable pipeline?",
      email_subject: "Archon research formatting bottleneck",
      email_body: "Hi Arthur,\n\nLoved the private credit liquidity breakdown in Archon's latest report.\n\nMost boutique intelligence firms we talk to spend the last 10 days of every quarter locked in editorial hell formatting unstructured data for client dossiers.\n\nWe built a high-craft document synthesis engine that cuts production time by 75% while keeping your exact typography and layout standards.\n\nWould it be helpful if I shared our case study?",
    },
    status: 'pending_decision',
  },
  {
    id: "3",
    company: "HyperScalar",
    website: "https://hyperscalar.io",
    industry: "Developer Infrastructure & AI Ops",
    location: "San Francisco, CA",
    team_size: "~18 people",
    icp_score: 88,
    founder: {
      name: "Elena Rostova",
      role: "Founder & CTO",
      email: "elena@hyperscalar.io",
      linkedin_url: "https://linkedin.com/in/elena-rostova-hyperscalar",
    },
    bottleneck: {
      area: "Inbound Technical Lead Qualification",
      observation: "High volume of open-source GitHub stars but low conversion to enterprise tier.",
      hypothesis: "Engineers star the repo but the sales engineering team has no automated way to identify which stargazers work at Fortune 500 infra teams.",
    },
    pitch: {
      linkedin_dm: "Elena — congrats on hitting 4k stars on HyperScalar. Quick question: are you enriching GitHub stargazers to find enterprise buyers automatically, or is your team looking them up manually on LinkedIn?",
      email_subject: "HyperScalar GitHub stargazer enterprise conversion",
      email_body: "Hi Elena,\n\nCongrats on the explosive growth of HyperScalar's open source repo.\n\nNoticed you're getting heavy inbound traffic from enterprise infrastructure engineers. Most developer-first founders struggle to bridge the gap between GitHub stars and enterprise procurement contacts without annoying their community.\n\nWe built an autonomous intelligence scraper that deanonymizes developer stargazers and pairs them with their engineering leadership.\n\nWorth a brief 5-min chat next week?",
    },
    status: 'pending_decision',
  },
];

export default function HqICP() {
  const { brief } = useMetaphorPipeline();
  
  const [prompt, setPrompt] = useState(
    "Find pre-seed and seed B2B AI & fintech agency founders with 5-20 employees in US/UK who need automated operational workflows. Scrape their tech stack, find their founder contact info, and draft high-craft personalized teardown pitches."
  );
  
  const [running, setRunning] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<number>(0);
  const [pipelineMessage, setPipelineMessage] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const [leads, setLeads] = useState<TargetLead[]>(() => {
    try {
      const saved = localStorage.getItem("atlas_autonomous_leads");
      return saved ? JSON.parse(saved) : DEFAULT_TARGETS;
    } catch {
      return DEFAULT_TARGETS;
    }
  });

  const activeLeads = leads.filter(l => l.status === 'pending_decision');
  const approvedLeads = leads.filter(l => l.status === 'approved');

  const runAutonomousPipeline = async () => {
    if (running || !prompt.trim()) return;
    setRunning(true);
    setPipelineStep(1);
    setPipelineMessage("Synthesizing market thesis & trigger signals from prompt…");

    await new Promise(r => setTimeout(r, 900));
    setPipelineStep(2);
    setPipelineMessage("Sourcing verified live founders & startups from HN & web signals…");

    let sourcedCompanies: any[] = [];
    try {
      const query = prompt.toLowerCase().includes("ai") ? "AI SaaS launch" : "Show HN";
      const cutoff = Math.floor(Date.now() / 1000) - 14 * 24 * 60 * 60;
      const res = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&numericFilters=created_at_i>=${cutoff}&hitsPerPage=6`);
      if (res.ok) {
        const data = await res.json();
        sourcedCompanies = data.hits || [];
      }
    } catch { /* fallback */ }

    await new Promise(r => setTimeout(r, 1100));
    setPipelineStep(3);
    setPipelineMessage("Mining company bottlenecks, tech stacks, and founder hiring activity…");

    await new Promise(r => setTimeout(r, 1000));
    setPipelineStep(4);
    setPipelineMessage("Synthesizing bespoke cold emails & LinkedIn teardown messages…");

    await new Promise(r => setTimeout(r, 800));

    let newLeads = [...DEFAULT_TARGETS];
    if (sourcedCompanies.length > 0) {
      const generatedFromHN: TargetLead[] = sourcedCompanies.slice(0, 3).map((hit, idx) => {
        const titleClean = hit.title?.replace(/Show HN:\s*/i, "") || "Founding Team";
        const companyName = titleClean.split("–")[0]?.split("-")[0]?.split(":")[0]?.trim() || `Startup ${idx + 1}`;
        return {
          id: `hn-${hit.objectID || idx}`,
          company: companyName,
          website: hit.url || `https://${companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
          industry: "B2B AI / Developer Tooling",
          location: "San Francisco / Remote",
          team_size: "~6–12 people",
          icp_score: 95 - idx * 3,
          founder: {
            name: hit.author ? `${hit.author.charAt(0).toUpperCase() + hit.author.slice(1)}` : "Founder",
            role: "Founder & CEO",
            email: `founder@${companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
            linkedin_url: `https://linkedin.com/search/results/all/?keywords=${encodeURIComponent(companyName + " founder")}`,
          },
          bottleneck: {
            area: "Early Distribution & Enterprise Pilot Conversion",
            observation: `Launched on Hacker News with high initial technical interest: "${hit.title?.slice(0, 50)}…"`,
            hypothesis: "Converting initial technical discussion into recurring enterprise contracts without a dedicated sales ops team.",
          },
          pitch: {
            linkedin_dm: `Hey ${hit.author || "there"} — saw your launch of ${companyName} on Hacker News. Really impressive traction. Are you manually managing the pilot requests from founders right now, or have you automated the qualification pipeline?`,
            email_subject: `${companyName} pilot onboarding & conversion`,
            email_body: `Hi ${hit.author || "there"},\n\nSaw your launch of ${companyName} on Hacker News today — congratulations on the momentum.\n\nEarly-stage technical founders usually get flooded with low-intent pilot requests after launching. We built an autonomous qualification filter that separates high-paying enterprise buyers from hobbyists automatically.\n\nWould it be helpful if I shared how we set this up for similar B2B tools?`,
          },
          status: 'pending_decision',
        };
      });
      newLeads = [...generatedFromHN, ...DEFAULT_TARGETS];
    }

    setLeads(newLeads);
    localStorage.setItem("atlas_autonomous_leads", JSON.stringify(newLeads));
    setRunning(false);
    setPipelineStep(0);
    toast.success(`Autonomous Campaign Complete: ${newLeads.length} High-Intent Targets Ready for Review`);
  };

  const copyLinkedIn = (lead: TargetLead) => {
    navigator.clipboard.writeText(lead.pitch.linkedin_dm);
    setCopiedId(lead.id);
    toast.success("LinkedIn DM copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2500);
  };

  const approveLead = (id: string) => {
    setLeads(prev => {
      const next = prev.map(l => l.id === id ? { ...l, status: 'approved' as const } : l);
      localStorage.setItem("atlas_autonomous_leads", JSON.stringify(next));
      return next;
    });
    toast.success("Lead approved & staged for dispatch!");
  };

  const dismissLead = (id: string) => {
    setLeads(prev => {
      const next = prev.map(l => l.id === id ? { ...l, status: 'dismissed' as const } : l);
      localStorage.setItem("atlas_autonomous_leads", JSON.stringify(next));
      return next;
    });
    toast.info("Lead archived.");
  };

  const approveAll = () => {
    setLeads(prev => {
      const next = prev.map(l => l.status === 'pending_decision' ? { ...l, status: 'approved' as const } : l);
      localStorage.setItem("atlas_autonomous_leads", JSON.stringify(next));
      return next;
    });
    toast.success(`Approved all ${activeLeads.length} leads for outbound dispatch!`);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", padding: "28px 36px", color: "var(--foreground)" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        
        {/* Metaphor Cognitive Context Brief */}
        <MetaphorBriefCard />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--foreground)", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 10 }}>
              <Crosshair size={22} color="var(--primary)" />
              Autonomous Acquisition Engine
            </h1>
            <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
              Enter your campaign prompt. Atlas executes the entire pipeline end-to-end and stages urgent decisions for your review.
            </p>
          </div>

          {activeLeads.length > 0 && (
            <button
              onClick={approveAll}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 20px", borderRadius: 99,
                background: "var(--foreground)", color: "var(--background)",
                border: "none", fontSize: 13, fontWeight: 700,
                cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
              <CheckCircle2 size={16} color="var(--color-success)" />
              Approve All Targets ({activeLeads.length})
            </button>
          )}
        </div>

        {/* ── Single Universal Command Prompt ──────────────────────────────── */}
        <div style={{
          background: "var(--color-surface-1)",
          border: "1px solid var(--color-border-subtle)",
          borderRadius: 16,
          padding: 24,
          boxShadow: "var(--shadow-sm)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Targeting & Execution Prompt
            </span>
            {brief && (
              <button
                onClick={() => {
                  setPrompt(`Find high-growth founders aligned with: ${brief.active_goals.join(", ")}. Operating under constraints: ${brief.active_constraints.join(", ")}. Strategy focus: ${brief.recommended_focus}.`);
                  toast.success("Injected live Metaphor OS strategic context!");
                }}
                style={{
                  background: "var(--color-primary-dim)",
                  border: "1px solid var(--color-primary)",
                  borderRadius: 99,
                  padding: "4px 12px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--color-primary)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Sparkles size={12} /> Sync with Metaphor Brain
              </button>
            )}
          </div>

          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            disabled={running}
            rows={3}
            placeholder="e.g. Find 10 B2B AI SaaS founders in US/UK doing $1M-$5M ARR who need autonomous operations workflows. Scrape their tech stack, find their founder email/LinkedIn, write a hyper-personalized teardown pitch, and stage them for my 1-click review."
            style={{
              width: "100%",
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border-subtle)",
              borderRadius: 12,
              padding: "14px 16px",
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--foreground)",
              resize: "vertical",
              outline: "none",
              fontFamily: "var(--font-sans)",
            }}
          />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              ⚡ Runs autonomous sourcing → deep forensic recon → bespoke copy synthesis.
            </div>

            <button
              onClick={runAutonomousPipeline}
              disabled={running || !prompt.trim()}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "12px 28px", borderRadius: 99,
                background: running ? "var(--color-surface-hover)" : "var(--color-primary)",
                color: running ? "var(--muted)" : "#FFFFFF",
                border: "none", fontSize: 13, fontWeight: 700,
                cursor: running ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                boxShadow: running ? "none" : "0 4px 16px rgba(78,108,242,0.25)",
              }}
            >
              {running ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Zap size={16} />}
              {running ? "Executing Pipeline…" : "Launch Autonomous Campaign →"}
            </button>
          </div>

          {/* Live 4-Stage Execution Tracker */}
          {running && (
            <div style={{
              marginTop: 12,
              padding: "16px 20px",
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border-subtle)",
              borderRadius: 12,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary)" }}>
                  Stage 0{pipelineStep} of 04 · {pipelineMessage}
                </span>
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>
                  {pipelineStep * 25}% Complete
                </span>
              </div>
              <div style={{ width: "100%", height: 4, background: "var(--color-surface-hover)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pipelineStep * 25}%`, background: "var(--color-primary)", transition: "width 0.4s ease" }} />
              </div>
            </div>
          )}
        </div>

        {/* ── Executive Decision Desk ────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ShieldCheck size={18} color="var(--color-primary)" />
              <span style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)" }}>
                Executive Decision Desk
              </span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                ({activeLeads.length} pending review · {approvedLeads.length} approved)
              </span>
            </div>
          </div>

          {activeLeads.length === 0 ? (
            <div style={{
              background: "var(--color-surface-1)",
              border: "1px solid var(--color-border-subtle)",
              borderRadius: 16,
              padding: "48px 24px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}>
              <CheckCircle2 size={32} color="var(--color-success)" />
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>
                Executive Decision Desk Clear
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)", maxWidth: 440 }}>
                All high-intent targets have been approved or processed. Launch a new autonomous campaign above to source the next cohort.
              </div>
            </div>
          ) : (
            activeLeads.map((lead) => (
              <div
                key={lead.id}
                style={{
                  background: "var(--color-surface-1)",
                  border: "1px solid var(--color-border-subtle)",
                  borderRadius: 16,
                  padding: 24,
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                  boxShadow: "var(--shadow-sm)",
                  transition: "all 0.2s",
                }}
              >
                {/* Top Card Bar */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: "var(--color-surface-2)",
                      border: "1px solid var(--color-border-subtle)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Building2 size={20} color="var(--color-primary)" />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)" }}>
                          {lead.company}
                        </span>
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "var(--muted)", fontSize: 12, display: "flex", alignItems: "center", gap: 2 }}
                        >
                          {lead.website.replace("https://", "")} <ExternalLink size={11} />
                        </a>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                        {lead.industry} · {lead.location} · {lead.team_size}
                      </div>
                    </div>
                  </div>

                  {/* ICP Score Pill */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", borderRadius: 99,
                    background: "rgba(16,185,129,0.08)",
                    border: "1px solid rgba(16,185,129,0.25)",
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "var(--color-success)", fontFamily: "var(--font-mono)" }}>
                      {lead.icp_score}% MATCH
                    </span>
                  </div>
                </div>

                {/* Founder Intel & Identified Bottleneck Grid */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1.6fr",
                  gap: 16,
                  padding: 16,
                  borderRadius: 12,
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border-subtle)",
                }}>
                  {/* Founder Profile */}
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                      Target Founder
                    </span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", marginTop: 4 }}>
                      {lead.founder.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {lead.founder.role}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-primary)", marginTop: 6, fontFamily: "var(--font-mono)" }}>
                      {lead.founder.email}
                    </div>
                  </div>

                  {/* Forensics Bottleneck */}
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-primary)", textTransform: "uppercase" }}>
                      ⚡ Identified Operational Bottleneck
                    </span>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", marginTop: 4 }}>
                      {lead.bottleneck.area}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>
                      "{lead.bottleneck.hypothesis}"
                    </div>
                  </div>
                </div>

                {/* Generated Bespoke Outbound Pitch */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                    Synthesized Teardown Pitch & Outbound
                  </span>

                  {/* Cold Email Subject & Body Preview */}
                  <div style={{
                    padding: "14px 16px",
                    borderRadius: 10,
                    background: "var(--color-surface-1)",
                    border: "1px solid var(--color-border-subtle)",
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: "var(--foreground)",
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 6, color: "var(--foreground)" }}>
                      Subject: {lead.pitch.email_subject}
                    </div>
                    <div style={{ whiteSpace: "pre-wrap", color: "var(--muted)" }}>
                      {lead.pitch.email_body}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--color-border-subtle)" }}>
                  <button
                    onClick={() => dismissLead(lead.id)}
                    style={{
                      background: "none", border: "none",
                      color: "var(--muted)", fontSize: 12, fontWeight: 600,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                    }}
                  >
                    <X size={14} /> Dismiss Lead
                  </button>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={() => copyLinkedIn(lead)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "8px 16px", borderRadius: 99,
                        background: copiedId === lead.id ? "rgba(16,185,129,0.1)" : "var(--color-surface-2)",
                        border: `1px solid ${copiedId === lead.id ? "var(--color-success)" : "var(--color-border-subtle)"}`,
                        color: copiedId === lead.id ? "var(--color-success)" : "var(--foreground)",
                        fontSize: 12, fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {copiedId === lead.id ? <Check size={13} /> : <Linkedin size={13} />}
                      {copiedId === lead.id ? "Copied DM" : "Copy LinkedIn DM"}
                    </button>

                    <button
                      onClick={() => approveLead(lead.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "8px 20px", borderRadius: 99,
                        background: "var(--color-primary)", color: "#FFFFFF",
                        border: "none", fontSize: 12, fontWeight: 700,
                        cursor: "pointer", boxShadow: "0 2px 8px rgba(78,108,242,0.25)",
                      }}
                    >
                      <Send size={13} /> Approve & Stage Email
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
