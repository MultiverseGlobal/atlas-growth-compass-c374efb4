import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Zap, Search, ArrowRight, ArrowLeft, CheckCircle2,
  Copy, Send, AlertTriangle, Sparkles, Building2,
  User, ExternalLink, RefreshCw, Plus, Check,
  FolderArchive, X, ChevronRight, MessageSquare, TrendingUp,
  Mail, Linkedin, Sliders, ShieldCheck, FileText, CheckCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ─── TYPES ───────────────────────────────────────────────────────────────────

type FlowPhase = "icp" | "recon" | "outreach" | "close";

interface Target {
  id: string;
  company: string;
  website: string;
  industry: string;
  location: string;
  team_size: string;
  selected: boolean;
  founder: {
    name: string;
    role: string;
    email?: string;
    linkedin_url?: string;
  };
  summary: string;
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
  offer: string;
}

const DEFAULT_TARGETS: Target[] = [
  {
    id: "1",
    company: "Perceptric",
    website: "https://perceptric.com",
    industry: "B2B Technical SEO & GEO",
    location: "Singapore (Remote)",
    team_size: "~8 people",
    selected: true,
    founder: {
      name: "Vincent Nguyen",
      role: "Founder & CEO",
      email: "vincent@perceptric.com",
      linkedin_url: "https://linkedin.com/in/vincent-nguyen-perceptric",
    },
    summary: "Specialist B2B SEO agency producing high-intent technical content using practitioner subject-matter writers.",
    bottleneck: {
      area: "Subject-Matter Writer Coordination & Briefing",
      observation: "They hire developers and fintech pros rather than regular generalist writers.",
      hypothesis: "Briefing non-writing specialists and managing the editorial/CMS handoffs creates a heavy manual load that Vincent manages personally.",
    },
    pitch: {
      linkedin_dm: "Hey Vincent — noticed Perceptric uses practitioner writers (devs, fintech folks) for technical SEO. Is coordinating those briefs and edit handoffs across specialist contractors something you're still doing manually, or have you built a system for it?",
      email_subject: "quick question about your writer workflow",
      email_body: "Hey Vincent,\n\nNoticed Perceptric uses practitioners (devs, fintech folks) as your technical writers rather than generalists — smart move for quality, but I imagine briefing and editing that type of writer is a very different animal than a regular content op.\n\nCurious: is coordinating those handoffs (brief → draft → design → CMS) something you're still doing manually, or have you figured out a system for it?\n\nNo pitch — genuinely curious how agencies at your scale are handling the production side.",
    },
    offer: "Automated Technical Brief & Specialist Writer Handoff System.",
  },
  {
    id: "2",
    company: "Grizzle",
    website: "https://grizzle.io",
    industry: "B2B SaaS Content & Demand Gen",
    location: "United Kingdom",
    team_size: "~15 people",
    selected: true,
    founder: {
      name: "Tom Whatley",
      role: "Founder & CEO",
      email: "tom@grizzle.io",
      linkedin_url: "https://linkedin.com/in/tomwhatley",
    },
    summary: "Content marketing and demand generation agency dedicated to scaling high-growth B2B SaaS companies.",
    bottleneck: {
      area: "Multi-Format Asset Deconstruction & Handoff",
      observation: "High volume of long-form strategy needing multi-channel micro-assets (slides, clips, carousels).",
      hypothesis: "Managing the brief → writer → edit → CMS handoff chain across 12+ freelancers creates operational drag during content scaling.",
    },
    pitch: {
      linkedin_dm: "Hey Tom — saw the piece on how you moved off spreadsheets to ClickUp. Now that ops are cleaner, is the friction still at the briefing stage, or is it more the edit → CMS handoff across 12+ freelancers?",
      email_subject: "question about running freelancers at Grizzle",
      email_body: "Hey Tom,\n\nSaw the piece on how you moved off spreadsheets to ClickUp — that migration is usually a sign things got pretty painful before they got better.\n\nCurious: now that ops are cleaner, where does the friction actually live? Is it still at the briefing stage, or is it more the edit → CMS handoff across 12+ freelancers?\n\nNot pitching anything — just trying to understand where agencies at your stage are still losing time.",
    },
    offer: "Automated Multi-Format Asset Deconstruction & Freelancer Handoff Studio.",
  },
  {
    id: "3",
    company: "Brighter Click",
    website: "https://brighterclick.com",
    industry: "DTC Paid Media & Creative",
    location: "United States",
    team_size: "~18 people",
    selected: true,
    founder: {
      name: "Colby Flood",
      role: "Founder & CEO",
      email: "colby@brighterclick.com",
      linkedin_url: "https://linkedin.com/in/colby-flood",
    },
    summary: "Performance marketing and creative strategy agency helping DTC brands scale paid social and ad creative testing.",
    bottleneck: {
      area: "Creative Iteration & Variation Fatigue",
      observation: "High-velocity testing across dozens of creative variations weekly.",
      hypothesis: "Rapidly cutting video ad hooks and generating fresh carousel variations creates a massive production bottleneck on his designers.",
    },
    pitch: {
      linkedin_dm: "Hey Colby — saw your breakdowns on ad fatigue and creative testing. When you're testing dozens of variations a week, is slicing new video hooks and carousels something your designers still do by hand?",
      email_subject: "quick question on creative testing velocity",
      email_body: "Hey Colby,\n\nSaw your breakdowns on ad fatigue and high-velocity creative testing for DTC. Also noticed you're balancing Brighter Click while building DataAlly.\n\nCurious: when you're testing dozens of creative variations a week for clients, is the actual asset slicing and variation handoff (cutting clips, making carousels) something your designers are still doing by hand, or have you automated that pipeline?\n\nNo pitch — just studying how dual agency/SaaS founders protect their delivery bandwidth.",
    },
    offer: "Automated Video Hook Deconstructor & High-Velocity Variation Engine.",
  },
  {
    id: "4",
    company: "The Munro Agency",
    website: "https://munro.agency",
    industry: "B2B Marketing Automation & Inbound",
    location: "United Kingdom",
    team_size: "~12 people",
    selected: true,
    founder: {
      name: "Rupert Morris",
      role: "Managing Director",
      email: "rupert@munro.agency",
      linkedin_url: "https://linkedin.com/in/rupertmorris",
    },
    summary: "Inbound marketing and automation agency specializing in HubSpot implementation and lead nurturing systems.",
    bottleneck: {
      area: "Client Onboarding & Pipeline Mapping",
      observation: "Complex marketing automation setups with bespoke client integrations.",
      hypothesis: "Discovery and mapping client legacy pipelines into automated workflows consumes substantial founder/lead consultant bandwidth.",
    },
    pitch: {
      linkedin_dm: "Hey Rupert — noticed Munro Agency handles both multi-channel inbound and HubSpot marketing automation architecture for B2B clients. Is initial client workflow discovery and legacy pipeline mapping still a manual process during onboarding?",
      email_subject: "question on inbound automation onboarding",
      email_body: "Hey Rupert,\n\nNoticed Munro Agency handles both multi-channel inbound and HubSpot marketing automation architecture for B2B clients.\n\nWith bespoke automation setups, is the initial client workflow discovery and legacy pipeline mapping something your team still does manually during onboarding, or have you built internal tooling for that?\n\nNo pitch at all — just curious how you keep client onboarding velocity high with complex automation setups.",
    },
    offer: "Automated Pipeline Discovery & Workflow Blueprint Generator.",
  },
  {
    id: "5",
    company: "Equalize Digital",
    website: "https://equalizedigital.com",
    industry: "Web Accessibility & Compliance",
    location: "United States",
    team_size: "~10 people",
    selected: true,
    founder: {
      name: "Amber Hinds",
      role: "CEO",
      email: "amber@equalizedigital.com",
      linkedin_url: "https://linkedin.com/in/amberhinds",
    },
    summary: "Accessibility audit and WordPress compliance agency, and maker of the Accessibility Checker plugin.",
    bottleneck: {
      area: "Audit Report Remediation Handoffs",
      observation: "High-compliance audits requiring technical issue translation for client dev teams.",
      hypothesis: "Turning dense accessibility audit findings into actionable dev tickets/checklists for clients is a time-consuming manual handoff.",
    },
    pitch: {
      linkedin_dm: "Hey Amber — saw your work with the Accessibility Checker plugin and Equalize Digital's agency audits. When delivering remediation reports, is turning audit findings into client dev tickets still drafted manually?",
      email_subject: "question on accessibility remediation handoffs",
      email_body: "Hey Amber,\n\nSaw your work with the Accessibility Checker plugin and Equalize Digital's agency audits. Running both a product and an audit agency in a high-compliance space like accessibility is impressive.\n\nCurious: when your team delivers accessibility audit remediation reports to clients, is turning audit findings into actionable dev tickets/checklists something you're still drafting manually?\n\nNo pitch — genuinely curious how you manage the dual agency/product workload.",
    },
    offer: "Automated Audit-to-Dev Ticket Remediation Engine.",
  },
];

const PHASES: FlowPhase[] = ["icp", "recon", "outreach", "close"];

export default function HqFlow() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // State Machine
  const [phase, setPhase] = useState<FlowPhase>("icp");
  const [targets, setTargets] = useState<Target[]>(DEFAULT_TARGETS);
  const [activeTargetIdx, setActiveTargetIdx] = useState(0);
  const [customInput, setCustomInput] = useState("");
  const [pitchChannel, setPitchChannel] = useState<"linkedin" | "email">("linkedin");
  const [copied, setCopied] = useState(false);
  const [sentRecords, setSentRecords] = useState<Record<string, boolean>>({});

  // ICP Radar Filters
  const [icpNiche, setIcpNiche] = useState("B2B Marketing & Content Agencies");
  const [icpTeamSize, setIcpTeamSize] = useState("5–25 people");
  const [icpRegion, setIcpRegion] = useState("UK & North America");
  const [isScanningRadar, setIsScanningRadar] = useState(false);

  // Vault / Archive Drawer State
  const [vaultOpen, setVaultOpen] = useState(false);

  // Close / Deal Reply Copilot
  const [replyText, setReplyText] = useState("");
  const [replyAnalysis, setReplyAnalysis] = useState<{ sentiment: string; recommendation: string; draft: string } | null>(null);
  const [analyzingReply, setAnalyzingReply] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);

  const selectedTargets = targets.filter(t => t.selected);
  const currentTarget = selectedTargets[activeTargetIdx] || selectedTargets[0] || targets[0];

  // ── Handlers ──────────────────────────────────────────────────────────────

  const scanIcpRadar = () => {
    setIsScanningRadar(true);
    setTimeout(() => {
      setIsScanningRadar(false);
      toast.success(`Radar matched ${targets.length} high-intent founders matching "${icpNiche}"`);
    }, 900);
  };

  const toggleTarget = (id: string) => {
    setTargets(prev => prev.map(t => t.id === id ? { ...t, selected: !t.selected } : t));
  };

  const addCustomTarget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;

    const clean = customInput.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split(".")[0];
    const cap = clean.charAt(0).toUpperCase() + clean.slice(1);

    const newTarget: Target = {
      id: crypto.randomUUID(),
      company: cap,
      website: customInput.startsWith("http") ? customInput : `https://${customInput}`,
      industry: icpNiche,
      location: icpRegion,
      team_size: icpTeamSize,
      selected: true,
      founder: {
        name: `${cap} Founder`,
        role: "Founder & CEO",
        email: `founder@${customInput.replace(/^https?:\/\//, "").split("/")[0]}`,
        linkedin_url: `https://linkedin.com/search/results/all/?keywords=${encodeURIComponent(cap + " founder")}`,
      },
      summary: `${cap} provides specialized client services with active delivery workflows.`,
      bottleneck: {
        area: "Client Delivery & Content Operations",
        observation: "High-touch service delivery requiring manual handoffs across strategy and production.",
        hypothesis: `Managing client handoffs and custom asset production likely represents the primary operational bottleneck for ${cap}'s leadership.`,
      },
      pitch: {
        linkedin_dm: `Hey — noticed ${cap}'s work in the B2B space. When scaling your client delivery, are you finding that manual asset assembly and handoffs are taking up too much team bandwidth?`,
        email_subject: `quick question on ${cap}'s workflow`,
        email_body: `Hey,\n\nNoticed ${cap}'s work in the B2B space.\n\nWhen scaling your client delivery, are you finding that manual asset assembly and handoffs are taking up too much team bandwidth?\n\nNo pitch — just curious how you handle the production operations at your scale.`,
      },
      offer: "Automated Asset Studio & Operational Delivery Engine.",
    };

    setTargets(prev => [newTarget, ...prev]);
    setCustomInput("");
    toast.success(`Added ${newTarget.company} to today's queue!`);
  };

  const copyPitch = () => {
    const text = pitchChannel === "linkedin"
      ? currentTarget.pitch.linkedin_dm
      : `Subject: ${currentTarget.pitch.email_subject}\n\n${currentTarget.pitch.email_body}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Message copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  // ── GMAIL AUTOMATION ────────────────────────────────────────────────────────
  const launchGmail = () => {
    const email = currentTarget.founder.email || "hello@" + currentTarget.website.replace(/^https?:\/\//, "").split("/")[0];
    const subject = encodeURIComponent(currentTarget.pitch.email_subject);
    const body = encodeURIComponent(currentTarget.pitch.email_body);
    
    // Direct Gmail Web App Composer URL
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${subject}&body=${body}`;
    window.open(gmailUrl, "_blank");
    markSent();
    toast.success(`Opened Gmail compose for ${currentTarget.founder.name}`);
  };

  // ── LINKEDIN AUTOMATION ─────────────────────────────────────────────────────
  const launchLinkedIn = () => {
    // 1. Copy message automatically
    navigator.clipboard.writeText(currentTarget.pitch.linkedin_dm);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    // 2. Open LinkedIn profile / messaging directly
    const targetUrl = currentTarget.founder.linkedin_url || `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(currentTarget.founder.name + " " + currentTarget.company)}`;
    window.open(targetUrl, "_blank");
    markSent();
    toast.success("Copied note & opened LinkedIn!");
  };

  const markSent = async () => {
    setSentRecords(prev => ({ ...prev, [currentTarget.id]: true }));

    if (user) {
      try {
        await supabase.from("kuro_pipeline_view").insert({
          user_id: user.id,
          company: currentTarget.company,
          prospect: currentTarget.founder.name,
          website: currentTarget.website,
          linkedin_url: currentTarget.founder.linkedin_url,
          founder_thesis: currentTarget.bottleneck.hypothesis,
          source: "acquisition_flow",
          priority: "high",
          icp_score: 9,
          stage: "contacted",
          is_contacted: true,
          notes: `Sent via ${pitchChannel.toUpperCase()}:\n${pitchChannel === "linkedin" ? currentTarget.pitch.linkedin_dm : currentTarget.pitch.email_body}`,
        });
      } catch (e) {
        console.warn("Background log error:", e);
      }
    }
  };

  const analyzeReply = () => {
    if (!replyText.trim()) return;
    setAnalyzingReply(true);

    setTimeout(() => {
      const lower = replyText.toLowerCase();
      let sentiment = "Curious / Interested";
      let recommendation = "Send a short 2-minute video walkthrough showing how the automation works.";
      let draft = `Hey ${currentTarget.founder.name.split(" ")[0]} — totally understand. We built a lightweight automation that handles the handoff in 3 clicks. Would it be helpful if I sent a 2-minute video walkthrough showing how it works?`;

      if (lower.includes("price") || lower.includes("cost") || lower.includes("how much")) {
        sentiment = "High Intent (Pricing Inquiry)";
        recommendation = "Frame around fixed project scope with rapid payback ROI.";
        draft = `Hey ${currentTarget.founder.name.split(" ")[0]} — we typically do a fixed £3,500 implementation that pays for itself in under 6 weeks of saved designer/editor hours. Happy to share a quick 1-pager scope if relevant.`;
      } else if (lower.includes("busy") || lower.includes("not now") || lower.includes("later")) {
        sentiment = "Timing Objection";
        recommendation = "Acknowledge bandwidth and offer zero-friction async overview.";
        draft = `No worries at all ${currentTarget.founder.name.split(" ")[0]} — know you're slammed. I'll shoot over a 90-second Loom so you can check it out whenever you get 2 minutes.`;
      }

      setReplyAnalysis({ sentiment, recommendation, draft });
      setAnalyzingReply(false);
    }, 600);
  };

  const phaseIndex = PHASES.indexOf(phase);

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground flex flex-col relative font-sans">
      
      {/* ── TOP STUDIO BREADCRUMB & HEADER (CLARIO STYLE) ──────────────────── */}
      <header className="h-14 border-b border-border/60 bg-card/60 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-30">
        
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs font-mono">
            ◈
          </div>
          <span className="font-bold text-sm font-display tracking-tight text-foreground">Atlas Deal Engine</span>
          <div className="w-px h-4 bg-border/60" />
          <span className="text-xs text-muted-foreground font-mono">
            {phase === "icp" && "1. ICP Radar & Queue"}
            {phase === "recon" && `2. Recon · ${currentTarget.company}`}
            {phase === "outreach" && `3. Dispatch · ${currentTarget.founder.name}`}
            {phase === "close" && "4. Deal Closer & Copilot"}
          </span>
        </div>

        {/* Center: Phase Dots Indicator */}
        <div className="flex items-center gap-2 bg-secondary/80 border border-border/80 px-3 py-1.5 rounded-full shadow-inner">
          {PHASES.map((p, idx) => (
            <div key={p} className="flex items-center gap-2">
              {idx > 0 && <div className={`w-6 h-0.5 ${idx <= phaseIndex ? "bg-primary" : "bg-border"}`} />}
              <button
                onClick={() => setPhase(p)}
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                  phase === p
                    ? "bg-primary text-primary-foreground shadow-sm scale-110"
                    : idx < phaseIndex
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {idx + 1}
              </button>
            </div>
          ))}
        </div>

        {/* Right: The Vault & History Drawer Trigger */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVaultOpen(true)}
            className="text-xs gap-2 font-mono border-border bg-card hover:border-primary/40"
          >
            <FolderArchive className="w-3.5 h-3.5 text-primary" />
            The Vault
          </Button>
        </div>
      </header>

      {/* ── MAIN STUDIO WORKSPACE ─────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto flex items-center justify-center p-6 md:p-12 relative">
        <div className="w-full max-w-4xl space-y-6 animate-in fade-in duration-200">

          {/* ── PHASE 1: ICP RADAR & INTAKE ─────────────────────────────────── */}
          {phase === "icp" && (
            <div className="space-y-6">
              
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-mono font-bold text-primary uppercase tracking-widest">Phase 1 · ICP Radar</span>
                  <h1 className="text-3xl font-bold font-display text-foreground">Target Qualification & Radar</h1>
                  <p className="text-xs text-muted-foreground">
                    Define your Ideal Customer Profile. Atlas calibrates and extracts high-margin founder targets.
                  </p>
                </div>

                <Button
                  onClick={scanIcpRadar}
                  disabled={isScanningRadar}
                  className="gap-2 font-semibold text-xs h-10 px-4 bg-primary text-primary-foreground"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanningRadar ? "animate-spin" : ""}`} />
                  {isScanningRadar ? "Scanning Radar..." : "Auto-Scan Radar"}
                </Button>
              </div>

              {/* ICP Control Bar */}
              <div className="bg-card border border-border/80 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-semibold uppercase text-muted-foreground">Target Niche</label>
                  <Input
                    value={icpNiche}
                    onChange={e => setIcpNiche(e.target.value)}
                    className="h-9 text-xs bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-semibold uppercase text-muted-foreground">Headcount</label>
                  <Input
                    value={icpTeamSize}
                    onChange={e => setIcpTeamSize(e.target.value)}
                    className="h-9 text-xs bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-semibold uppercase text-muted-foreground">Region / Geography</label>
                  <Input
                    value={icpRegion}
                    onChange={e => setIcpRegion(e.target.value)}
                    className="h-9 text-xs bg-background"
                  />
                </div>
              </div>

              {/* Add target input */}
              <form onSubmit={addCustomTarget} className="flex gap-2">
                <Input
                  placeholder="Or paste any company domain on the fly (e.g. perceptric.com, grizzly.io)..."
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  className="h-11 bg-card text-xs"
                />
                <Button type="submit" variant="secondary" className="h-11 px-5 font-semibold text-xs gap-2">
                  <Plus className="w-4 h-4" /> Add to Batch
                </Button>
              </form>

              {/* Target Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {targets.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => toggleTarget(t.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer bg-card flex items-start justify-between gap-3 ${
                      t.selected
                        ? "border-primary/80 bg-primary/5 shadow-sm ring-1 ring-primary/30"
                        : "border-border/60 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm font-display text-foreground">{t.company}</span>
                        <Badge variant="outline" className="text-[9px] font-mono border-border">
                          {t.team_size}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{t.industry}</p>
                      <p className="text-xs text-foreground/90 font-medium pt-0.5">
                        Founder: {t.founder.name} ({t.founder.role})
                      </p>
                    </div>

                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                      t.selected ? "bg-primary border-primary text-primary-foreground" : "border-border"
                    }`}>
                      {t.selected && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Action */}
              <div className="flex items-center justify-between pt-4 border-t border-border/40">
                <span className="text-xs font-mono text-muted-foreground">
                  {selectedTargets.length} targets active in today's acquisition loop
                </span>

                <Button
                  onClick={() => {
                    setActiveTargetIdx(0);
                    setPhase("recon");
                  }}
                  disabled={selectedTargets.length === 0}
                  className="h-11 px-6 font-semibold gap-2"
                >
                  Proceed to Recon <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ── PHASE 2: RECON / DIAGNOSIS ─────────────────────────────────── */}
          {phase === "recon" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <div>
                  <span className="text-xs font-mono font-bold text-primary uppercase tracking-widest">
                    Phase 2 · Recon ({activeTargetIdx + 1}/{selectedTargets.length})
                  </span>
                  <h1 className="text-3xl font-bold font-display text-foreground">{currentTarget.company}</h1>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span>{currentTarget.founder.name} ({currentTarget.founder.role})</span>
                    <span>•</span>
                    <span>{currentTarget.team_size}</span>
                    <span>•</span>
                    <a href={currentTarget.website} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                      {currentTarget.website.replace(/^https?:\/\//, "")} <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>

                {currentTarget.founder.linkedin_url && (
                  <a
                    href={currentTarget.founder.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-xs font-mono text-foreground flex items-center gap-1.5"
                  >
                    <Linkedin className="w-3.5 h-3.5 text-sky-400" /> Founder Profile <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {/* Operational Bottleneck Callout */}
              <div className="bg-rose-500/5 border border-rose-500/25 rounded-xl p-5 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-rose-400 font-mono text-xs uppercase font-bold tracking-wider">
                    <AlertTriangle className="w-4 h-4" />
                    Operational Vulnerability
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-rose-500/10 border-rose-500/30 text-rose-400">
                    High Leverage Pain
                  </Badge>
                </div>

                <div className="text-sm font-bold text-foreground font-display">
                  {currentTarget.bottleneck.area}
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Observed:</strong> {currentTarget.bottleneck.observation}
                </p>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Hypothesis:</strong> {currentTarget.bottleneck.hypothesis}
                </p>
              </div>

              {/* System Offer */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-mono text-primary font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Tailored Acquisition Offer
                  </div>
                  <div className="text-xs text-foreground font-semibold">
                    {currentTarget.offer}
                  </div>
                </div>
              </div>

              {/* Navigation Bar */}
              <div className="flex items-center justify-between pt-4 border-t border-border/40">
                <Button variant="ghost" onClick={() => setPhase("icp")} className="gap-2 text-xs">
                  <ArrowLeft className="w-4 h-4" /> Back to ICP Radar
                </Button>

                <Button onClick={() => setPhase("outreach")} className="h-11 px-6 font-semibold gap-2">
                  Draft Outreach <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ── PHASE 3: OUTREACH & AUTOMATED DISPATCH ───────────────────────── */}
          {phase === "outreach" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <div>
                  <span className="text-xs font-mono font-bold text-primary uppercase tracking-widest">
                    Phase 3 · Dispatch ({activeTargetIdx + 1}/{selectedTargets.length})
                  </span>
                  <h1 className="text-2xl font-bold font-display text-foreground">Message for {currentTarget.founder.name}</h1>
                </div>

                {/* Channel Switcher */}
                <div className="flex bg-secondary p-1 rounded-lg border border-border">
                  <button
                    onClick={() => setPitchChannel("linkedin")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold font-mono transition-colors ${
                      pitchChannel === "linkedin" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    <Linkedin className="w-3.5 h-3.5 text-sky-400" /> LinkedIn DM
                  </button>
                  <button
                    onClick={() => setPitchChannel("email")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold font-mono transition-colors ${
                      pitchChannel === "email" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5 text-rose-400" /> Cold Email
                  </button>
                </div>
              </div>

              {/* Pitch Box */}
              <div className="bg-card border border-border rounded-xl p-5 space-y-3 relative shadow-sm">
                {pitchChannel === "email" && (
                  <div className="text-xs font-mono border-b border-border pb-3 flex items-center justify-between">
                    <div>
                      <span className="text-muted-foreground">To: </span>
                      <span className="text-foreground font-semibold">{currentTarget.founder.email || "founder@" + currentTarget.website.replace(/^https?:\/\//, "")}</span>
                      <span className="text-muted-foreground ml-3">Subject: </span>
                      <span className="text-foreground font-semibold">{currentTarget.pitch.email_subject}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                      Gmail Ready
                    </Badge>
                  </div>
                )}

                <div className="text-xs text-foreground font-mono leading-relaxed whitespace-pre-wrap">
                  {pitchChannel === "linkedin" ? currentTarget.pitch.linkedin_dm : currentTarget.pitch.email_body}
                </div>

                <div className="pt-3 flex items-center justify-between border-t border-border/40">
                  <div className="text-[11px] text-muted-foreground font-mono">
                    {pitchChannel === "linkedin"
                      ? "Zero-pitch peer question · High response rate"
                      : "Conversational question format · 0% spam flags"}
                  </div>

                  <div className="flex items-center gap-2">
                    {pitchChannel === "email" ? (
                      <Button
                        onClick={launchGmail}
                        className="gap-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white"
                        size="sm"
                      >
                        <Mail className="w-3.5 h-3.5" /> Launch in Gmail
                      </Button>
                    ) : (
                      <Button
                        onClick={launchLinkedIn}
                        className="gap-2 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white"
                        size="sm"
                      >
                        <Linkedin className="w-3.5 h-3.5" /> Auto-Open LinkedIn
                      </Button>
                    )}

                    <Button
                      onClick={copyPitch}
                      variant="outline"
                      size="sm"
                      className="gap-2 text-xs font-semibold"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" onClick={() => setPhase("recon")} className="gap-2 text-xs">
                  <ArrowLeft className="w-4 h-4" /> Back to Recon
                </Button>

                <div className="flex items-center gap-3">
                  <Button
                    onClick={markSent}
                    variant={sentRecords[currentTarget.id] ? "outline" : "default"}
                    className="gap-2 text-xs font-semibold h-11 px-5"
                  >
                    {sentRecords[currentTarget.id] ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Sent!
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" /> Log as Sent
                      </>
                    )}
                  </Button>

                  {activeTargetIdx + 1 < selectedTargets.length ? (
                    <Button
                      onClick={() => {
                        setActiveTargetIdx(prev => prev + 1);
                        setPhase("recon");
                        setCopied(false);
                      }}
                      variant="secondary"
                      className="gap-2 text-xs font-semibold h-11 px-5"
                    >
                      Next Target ({activeTargetIdx + 2}/{selectedTargets.length}) ➔
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setPhase("close")}
                      className="gap-2 text-xs font-semibold h-11 px-5 bg-primary text-primary-foreground"
                    >
                      Finish Sourcing & Open Deals ➔
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── PHASE 4: CLOSE / DEAL COPILOT & PROPOSAL ───────────────────── */}
          {phase === "close" && (
            <div className="space-y-6">
              <div className="flex items-start justify-between border-b border-border/60 pb-4">
                <div className="space-y-1">
                  <span className="text-xs font-mono font-bold text-primary uppercase tracking-widest">Phase 4 · Deal Closer</span>
                  <h1 className="text-3xl font-bold font-display text-foreground">Reply Copilot & Proposal Scope</h1>
                  <p className="text-xs text-muted-foreground">
                    Paste replies to score intent, generate counter-offers, or generate a 1-click £3,500 fixed scope.
                  </p>
                </div>

                <Button
                  onClick={() => setShowProposalModal(true)}
                  className="gap-2 text-xs font-semibold h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <FileText className="w-4 h-4" /> 1-Click Scope Proposal
                </Button>
              </div>

              <div className="space-y-3">
                <Textarea
                  rows={4}
                  placeholder="Paste prospect response here (e.g. 'Hey, we actually do that in ClickUp but it's pretty messy right now, what do you charge?')..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="bg-card text-xs font-mono"
                />

                <Button
                  onClick={analyzeReply}
                  disabled={analyzingReply || !replyText.trim()}
                  className="gap-2 text-xs font-semibold h-10 px-5"
                >
                  {analyzingReply ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Generate Counter-Offer
                </Button>
              </div>

              {replyAnalysis && (
                <div className="bg-card border border-primary/30 rounded-xl p-5 space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-mono font-bold text-primary uppercase tracking-wider">
                      Intent: {replyAnalysis.sentiment}
                    </div>
                    <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                      AI Scored
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    <strong className="text-foreground">Closing Tactic:</strong> {replyAnalysis.recommendation}
                  </p>

                  <div className="bg-background border border-border rounded-lg p-3 text-xs text-foreground font-mono leading-relaxed">
                    {replyAnalysis.draft}
                  </div>

                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(replyAnalysis.draft);
                        toast.success("Response copied to clipboard!");
                      }}
                      className="gap-2 text-xs font-semibold"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy Pitch
                    </Button>
                  </div>
                </div>
              )}

              <div className="pt-6 border-t border-border/40 flex justify-between">
                <Button variant="ghost" onClick={() => setPhase("icp")} className="gap-2 text-xs">
                  <RefreshCw className="w-4 h-4" /> Start New Acquisition Batch
                </Button>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ── PROPOSAL SCOPE MODAL ──────────────────────────────────────────── */}
      {showProposalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base font-display">Client Implementation Scope</h3>
              </div>
              <button onClick={() => setShowProposalModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono bg-background p-4 rounded-xl border border-border/60">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Deliverable:</span>
                <span className="text-foreground font-semibold">{currentTarget.offer}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Turnaround:</span>
                <span className="text-foreground font-semibold">14 Business Days</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Investment:</span>
                <span className="text-emerald-400 font-bold text-sm">£3,500 Fixed Fee</span>
              </div>
              <div className="pt-2 text-muted-foreground leading-relaxed">
                Includes full architecture setup, team onboarding workshop, and 30-day post-launch optimization support.
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowProposalModal(false)}>
                Close
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold"
                onClick={() => {
                  const prop = `IMPLEMENTATION SCOPE FOR ${currentTarget.company.toUpperCase()}\n\nDeliverable: ${currentTarget.offer}\nTimeline: 14 Days\nInvestment: £3,500 Fixed\nROI Guarantee: Saves an estimated 15-20 hours/week of internal contractor management.\n\nReady to kick off this week.`;
                  navigator.clipboard.writeText(prop);
                  toast.success("1-Page Scope copied to clipboard!");
                  setShowProposalModal(false);
                }}
              >
                <Copy className="w-3.5 h-3.5" /> Copy Scope Proposal
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── THE VAULT (SLIDE-OVER HISTORY DRAWER) ─────────────────────────── */}
      {vaultOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-card border-l border-border h-full p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
            
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <div className="flex items-center gap-2">
                  <FolderArchive className="w-5 h-5 text-primary" />
                  <h2 className="font-bold text-lg font-display text-foreground">The Vault</h2>
                </div>
                <button
                  onClick={() => setVaultOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest">
                  Quick Access Archives
                </div>
                
                {[
                  { label: "Leads CRM Database", path: "/hq/leads", icon: User, count: "5 Leads" },
                  { label: "Pipeline Deal Stages", path: "/hq/pipeline", icon: TrendingUp, count: "£17.5k" },
                  { label: "Outreach Touchpoint Logs", path: "/hq/outreach", icon: MessageSquare, count: "5 Drafts" },
                ].map((item) => (
                  <div
                    key={item.label}
                    onClick={() => {
                      setVaultOpen(false);
                      navigate(item.path);
                    }}
                    className="p-3.5 rounded-xl border border-border/60 hover:border-primary/50 bg-background/50 hover:bg-background cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-4 h-4 text-primary" />
                      <span className="text-xs font-semibold text-foreground">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-muted-foreground">{item.count}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-border/40 text-center">
              <p className="text-[11px] text-muted-foreground font-mono">
                Atlas Operating System · Solo Acquisition Loop
              </p>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
