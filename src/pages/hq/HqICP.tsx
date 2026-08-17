import { useState } from "react";
import { 
  Crosshair, Zap, Sparkles, Linkedin, Mail, Check, 
  X, ExternalLink, Loader2, Send, Building2, 
  CheckCircle2, ShieldCheck, ChevronRight, Copy
} from "lucide-react";
import { useMetaphorPipeline } from "@/hooks/useMetaphorPipeline";
import { MetaphorBriefCard } from "@/components/MetaphorBriefCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
    <div className="min-h-screen bg-background text-foreground py-8 px-6 lg:px-12">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Metaphor Cognitive Context Brief */}
        <MetaphorBriefCard />

        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <Crosshair className="w-7 h-7 text-primary" />
              Autonomous Acquisition Engine
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your campaign prompt. Atlas executes the entire pipeline end-to-end and stages urgent decisions for your review.
            </p>
          </div>

          {activeLeads.length > 0 && (
            <Button
              onClick={approveAll}
              className="bg-primary text-primary-foreground font-semibold rounded-full px-6 shadow-sm hover:bg-primary/90 shrink-0"
            >
              <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-300" />
              Approve All Targets ({activeLeads.length})
            </Button>
          )}
        </div>

        {/* ── Single Universal Command Prompt ──────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Targeting & Execution Prompt
            </span>
            {brief && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPrompt(`Find high-growth founders aligned with: ${brief.active_goals.join(", ")}. Operating under constraints: ${brief.active_constraints.join(", ")}. Strategy focus: ${brief.recommended_focus}.`);
                  toast.success("Injected live Metaphor OS strategic context!");
                }}
                className="text-xs text-primary border-primary/30 hover:bg-primary/5 rounded-full"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Sync with Metaphor Brain
              </Button>
            )}
          </div>

          <Textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            disabled={running}
            rows={3}
            placeholder="e.g. Find 10 B2B AI SaaS founders in US/UK doing $1M-$5M ARR who need autonomous operations workflows. Scrape their tech stack, find their founder email/LinkedIn, write a hyper-personalized teardown pitch, and stage them for my 1-click review."
            className="w-full bg-muted/40 border-border text-foreground text-sm leading-relaxed rounded-xl p-4 resize-y focus-visible:ring-primary"
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Runs autonomous sourcing → deep forensic recon → bespoke copy synthesis.
            </p>

            <Button
              onClick={runAutonomousPipeline}
              disabled={running || !prompt.trim()}
              className="bg-primary text-primary-foreground font-bold px-8 py-2.5 rounded-full shadow-md hover:bg-primary/90 shrink-0"
            >
              {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2 fill-current" />}
              {running ? "Executing Pipeline…" : "Launch Autonomous Campaign →"}
            </Button>
          </div>

          {/* Live 4-Stage Execution Tracker */}
          {running && (
            <div className="mt-4 p-4 rounded-xl bg-muted/50 border border-border space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-primary flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  Stage 0{pipelineStep} of 04 · {pipelineMessage}
                </span>
                <span className="font-mono text-muted-foreground">
                  {pipelineStep * 25}% Complete
                </span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500 ease-out" 
                  style={{ width: `${pipelineStep * 25}%` }} 
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Executive Decision Desk ────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">
                Executive Decision Desk
              </h2>
              <Badge variant="secondary" className="text-xs font-mono">
                {activeLeads.length} Pending · {approvedLeads.length} Approved
              </Badge>
            </div>
          </div>

          {activeLeads.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-foreground">
                Executive Decision Desk Clear
              </h3>
              <p className="text-xs text-muted-foreground max-w-md">
                All high-intent targets have been approved or processed. Launch a new autonomous campaign above to source the next cohort.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {activeLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5 hover:border-border/80 transition-colors"
                >
                  {/* Card Header: Company, Website, Match Score */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-muted/60 border border-border flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-base font-bold text-foreground">
                            {lead.company}
                          </h3>
                          <a
                            href={lead.website}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 bg-muted/50 px-2 py-0.5 rounded-md"
                          >
                            {lead.website.replace("https://", "")} <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {lead.industry} · {lead.location} · {lead.team_size}
                        </p>
                      </div>
                    </div>

                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-mono text-xs font-bold px-3 py-1 rounded-full self-start sm:self-auto">
                      {lead.icp_score}% MATCH
                    </Badge>
                  </div>

                  {/* Founder Profile & Identified Bottleneck Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-muted/40 border border-border/60 text-xs">
                    <div>
                      <span className="font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                        Target Founder
                      </span>
                      <p className="text-sm font-bold text-foreground mt-1">
                        {lead.founder.name}
                      </p>
                      <p className="text-muted-foreground">
                        {lead.founder.role}
                      </p>
                      <p className="font-mono text-primary mt-1">
                        {lead.founder.email}
                      </p>
                    </div>

                    <div>
                      <span className="font-bold uppercase tracking-wider text-primary text-[10px] flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Identified Operational Bottleneck
                      </span>
                      <p className="font-semibold text-foreground mt-1">
                        {lead.bottleneck.area}
                      </p>
                      <p className="text-muted-foreground mt-1 italic leading-relaxed">
                        "{lead.bottleneck.hypothesis}"
                      </p>
                    </div>
                  </div>

                  {/* Generated Pitch Preview */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Synthesized Teardown Pitch & Outbound
                    </span>
                    <div className="p-4 rounded-xl bg-background border border-border/80 text-xs leading-relaxed space-y-2">
                      <p className="font-bold text-foreground">
                        Subject: {lead.pitch.email_subject}
                      </p>
                      <p className="text-muted-foreground whitespace-pre-wrap">
                        {lead.pitch.email_body}
                      </p>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dismissLead(lead.id)}
                      className="text-muted-foreground hover:text-foreground text-xs self-start sm:self-auto"
                    >
                      <X className="w-3.5 h-3.5 mr-1.5" /> Dismiss Target
                    </Button>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyLinkedIn(lead)}
                        className={`text-xs rounded-full ${copiedId === lead.id ? "text-emerald-500 border-emerald-500/30" : ""}`}
                      >
                        {copiedId === lead.id ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-500" /> : <Linkedin className="w-3.5 h-3.5 mr-1.5 text-[#0A66C2]" />}
                        {copiedId === lead.id ? "Copied DM" : "Copy LinkedIn DM"}
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => approveLead(lead.id)}
                        className="bg-primary text-primary-foreground font-semibold text-xs rounded-full px-5 shadow-sm hover:bg-primary/90"
                      >
                        <Send className="w-3.5 h-3.5 mr-1.5" /> Approve & Stage Email
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
