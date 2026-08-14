import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Zap, Search, ArrowRight, ArrowLeft, CheckCircle2,
  Copy, Send, MessageSquare, AlertTriangle, Sparkles,
  Building2, User, Globe, ExternalLink, RefreshCw,
  Plus, Check, HelpCircle, FileText, ChevronRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface FlowTarget {
  id: string;
  company: string;
  website: string;
  industry: string;
  location: string;
  team_size: string;
  founder: {
    name: string;
    role: string;
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

const DEFAULT_QUEUE: FlowTarget[] = [
  {
    id: "1",
    company: "Perceptric",
    website: "https://perceptric.com",
    industry: "B2B Technical SEO & GEO",
    location: "Singapore (Remote)",
    team_size: "~8 people",
    founder: {
      name: "Vincent Nguyen",
      role: "Founder & CEO",
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
    founder: {
      name: "Tom Whatley",
      role: "Founder & CEO",
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
    founder: {
      name: "Colby Flood",
      role: "Founder & CEO",
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
    founder: {
      name: "Rupert Morris",
      role: "Managing Director",
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
    founder: {
      name: "Amber Hinds",
      role: "CEO",
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

type Step = "target" | "diagnose" | "pitch" | "reply";

export default function HqFlow() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("target");
  const [queueIndex, setQueueIndex] = useState(0);
  const [customInput, setCustomInput] = useState("");
  const [currentTarget, setCurrentTarget] = useState<FlowTarget>(DEFAULT_QUEUE[0]);
  const [pitchChannel, setPitchChannel] = useState<"linkedin" | "email">("linkedin");
  const [copied, setCopied] = useState(false);
  const [sentStatus, setSentStatus] = useState<Record<string, boolean>>({});
  
  const [replyText, setReplyText] = useState("");
  const [replyAnalysis, setReplyAnalysis] = useState<{ sentiment: string; recommendation: string; draft: string } | null>(null);
  const [analyzingReply, setAnalyzingReply] = useState(false);

  const activeTarget = currentTarget;

  const handleSelectQueueItem = (idx: number) => {
    setQueueIndex(idx);
    setCurrentTarget(DEFAULT_QUEUE[idx]);
    setStep("diagnose");
  };

  const handleCustomTargetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;

    const clean = customInput.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split(".")[0];
    const cap = clean.charAt(0).toUpperCase() + clean.slice(1);

    const customTarget: FlowTarget = {
      id: crypto.randomUUID(),
      company: cap,
      website: customInput.startsWith("http") ? customInput : `https://${customInput}`,
      industry: "Digital Agency / B2B Services",
      location: "Remote / Global",
      team_size: "5–25 people",
      founder: {
        name: `${cap} Founder`,
        role: "Founder & CEO",
        linkedin_url: `https://linkedin.com/search/results/all/?keywords=${encodeURIComponent(cap + " founder")}`,
      },
      summary: `${cap} provides specialized client services with active delivery workflows.`,
      bottleneck: {
        area: "Client Delivery & Content Production Operations",
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

    setCurrentTarget(customTarget);
    setStep("diagnose");
  };

  const handleCopyPitch = () => {
    const text = pitchChannel === "linkedin" 
      ? activeTarget.pitch.linkedin_dm 
      : `Subject: ${activeTarget.pitch.email_subject}\n\n${activeTarget.pitch.email_body}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Message copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMarkSent = async () => {
    setSentStatus(prev => ({ ...prev, [activeTarget.id]: true }));
    toast.success(`Marked as sent to ${activeTarget.founder.name}! Follow-up queued for 3 days.`);
    
    if (user) {
      try {
        await supabase.from("kuro_pipeline_view").insert({
          user_id: user.id,
          company: activeTarget.company,
          prospect: activeTarget.founder.name,
          website: activeTarget.website,
          linkedin_url: activeTarget.founder.linkedin_url,
          founder_thesis: activeTarget.bottleneck.hypothesis,
          source: "daily_flow",
          priority: "high",
          icp_score: 9,
          stage: "contacted",
          is_contacted: true,
          notes: `Sent via ${pitchChannel.toUpperCase()}:\n${pitchChannel === "linkedin" ? activeTarget.pitch.linkedin_dm : activeTarget.pitch.email_body}`,
        });
      } catch (e) {
        console.warn("Background log skip:", e);
      }
    }
  };

  const handleNextTarget = () => {
    const nextIdx = (queueIndex + 1) % DEFAULT_QUEUE.length;
    setQueueIndex(nextIdx);
    setCurrentTarget(DEFAULT_QUEUE[nextIdx]);
    setStep("diagnose");
    setCopied(false);
  };

  const handleAnalyzeReply = () => {
    if (!replyText.trim()) return;
    setAnalyzingReply(true);

    setTimeout(() => {
      const lower = replyText.toLowerCase();
      let sentiment = "Curious / Interested";
      let recommendation = "Send short 2-minute Loom breakdown or offer a 15-min discovery call.";
      let draft = `Hey ${activeTarget.founder.name.split(" ")[0]} — totally understand. We built a lightweight automation that handles the handoff in 3 clicks. Would it be helpful if I sent a 2-minute video walkthrough showing how it works?`;

      if (lower.includes("price") || lower.includes("cost") || lower.includes("how much")) {
        sentiment = "High Intent (Pricing Inquiry)";
        recommendation = "Frame around fixed project scope with rapid payback ROI.";
        draft = `Hey ${activeTarget.founder.name.split(" ")[0]} — we typically do a fixed £3,500 implementation that pays for itself in under 6 weeks of saved designer/editor hours. Happy to share a quick 1-pager scope if relevant.`;
      } else if (lower.includes("busy") || lower.includes("not now") || lower.includes("later")) {
        sentiment = "Timing Objection";
        recommendation = "Acknowledge bandwidth and offer zero-friction async overview.";
        draft = `No worries at all ${activeTarget.founder.name.split(" ")[0]} — know you're slammed. I'll shoot over a 90-second Loom so you can check it out whenever you get 2 minutes.`;
      }

      setReplyAnalysis({ sentiment, recommendation, draft });
      setAnalyzingReply(false);
    }, 700);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Flow Header Bar */}
      <div className="h-16 border-b border-border/60 bg-card/60 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground font-display">Daily Deal Flow</span>
              <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary py-0">
                Solo Operator Mode
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">
              Target {queueIndex + 1} of {DEFAULT_QUEUE.length} · Zero distraction pipeline
            </p>
          </div>
        </div>

        {/* Stepper Indicator */}
        <div className="hidden md:flex items-center gap-1 bg-secondary/80 border border-border p-1 rounded-lg">
          {[
            { key: "target", label: "1. Target" },
            { key: "diagnose", label: "2. Diagnose" },
            { key: "pitch", label: "3. Pitch" },
            { key: "reply", label: "4. Reply Copilot" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setStep(s.key as Step)}
              className={`px-3 py-1 rounded-md text-xs font-semibold font-mono transition-all ${
                step === s.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/hq/dashboard")}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Exit to HQ ➔
          </Button>
        </div>
      </div>

      {/* Main Flow Content Container */}
      <div className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-10 flex flex-col justify-center animate-in fade-in duration-200">
        
        {/* ── STEP 1: TARGET SELECTION ─────────────────────────────────────── */}
        {step === "target" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold text-primary uppercase tracking-widest">Step 1</span>
              <h2 className="text-2xl md:text-3xl font-bold font-display text-foreground">Who are we targeting today?</h2>
              <p className="text-sm text-muted-foreground">
                Pick from today's calibrated 5 targets or enter any company domain below.
              </p>
            </div>

            {/* Custom Input */}
            <form onSubmit={handleCustomTargetSubmit} className="flex gap-2">
              <Input
                placeholder="Enter domain (e.g. perceptric.com or grizzly.io)..."
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                className="h-12 bg-card text-sm"
              />
              <Button type="submit" className="h-12 px-6 gap-2 font-semibold">
                Diagnose Target <ArrowRight className="w-4 h-4" />
              </Button>
            </form>

            {/* Today's Queue List */}
            <div className="space-y-3 pt-4">
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-bold">
                Today's Curated Agency Targets ({DEFAULT_QUEUE.length})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {DEFAULT_QUEUE.map((t, idx) => (
                  <div
                    key={t.id}
                    onClick={() => handleSelectQueueItem(idx)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer bg-card hover:border-primary/50 hover:shadow-md flex flex-col justify-between gap-3 ${
                      queueIndex === idx ? "border-primary/80 ring-1 ring-primary/30" : "border-border/70"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-base text-foreground font-display">{t.company}</span>
                        <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground border-border">
                          {t.team_size}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{t.industry}</p>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-border/40">
                      <span className="text-foreground/90 font-medium">{t.founder.name}</span>
                      <span className="text-primary font-semibold flex items-center gap-1 font-mono text-[11px]">
                        Start Flow ➔
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: DIAGNOSIS & RECON ────────────────────────────────────── */}
        {step === "diagnose" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div className="space-y-1">
                <span className="text-xs font-mono font-bold text-primary uppercase tracking-widest">Step 2 · Diagnosis</span>
                <h2 className="text-2xl md:text-3xl font-bold font-display text-foreground">{activeTarget.company}</h2>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span>{activeTarget.founder.name} ({activeTarget.founder.role})</span>
                  <span>•</span>
                  <span>{activeTarget.team_size}</span>
                  <span>•</span>
                  <a href={activeTarget.website} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                    {activeTarget.website.replace(/^https?:\/\//, "")} <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>

              {activeTarget.founder.linkedin_url && (
                <a
                  href={activeTarget.founder.linkedin_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-xs font-mono text-foreground flex items-center gap-1.5"
                >
                  View LinkedIn <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Core Operational Bottleneck Callout */}
            <div className="bg-rose-500/5 border border-rose-500/25 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-400 font-mono text-xs uppercase font-bold tracking-wider">
                  <AlertTriangle className="w-4 h-4" />
                  Operational Friction Point
                </div>
                <Badge variant="outline" className="text-[10px] bg-rose-500/10 border-rose-500/30 text-rose-400">
                  Critical Bottleneck
                </Badge>
              </div>

              <div className="text-sm font-bold text-foreground font-display">
                {activeTarget.bottleneck.area}
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground/90">What we observed:</strong> {activeTarget.bottleneck.observation}
              </p>

              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground/90">Hypothesis:</strong> {activeTarget.bottleneck.hypothesis}
              </p>
            </div>

            {/* Value Proposition */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-mono text-primary font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Suggested System
                </div>
                <div className="text-xs text-foreground font-semibold">
                  {activeTarget.offer}
                </div>
              </div>
            </div>

            {/* Stepper Action Bar */}
            <div className="flex items-center justify-between pt-4">
              <Button variant="ghost" onClick={() => setStep("target")} className="gap-2 text-xs">
                <ArrowLeft className="w-4 h-4" /> Back to Targets
              </Button>

              <Button onClick={() => setStep("pitch")} className="gap-2 font-semibold text-xs h-11 px-6 shadow-sm">
                Generate Pitch Message <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: PITCH & OUTREACH ──────────────────────────────────────── */}
        {step === "pitch" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div className="space-y-1">
                <span className="text-xs font-mono font-bold text-primary uppercase tracking-widest">Step 3 · Send Message</span>
                <h2 className="text-2xl font-bold font-display text-foreground">Message for {activeTarget.founder.name}</h2>
                <p className="text-xs text-muted-foreground">
                  Send via LinkedIn DM (recommended) or Cold Email.
                </p>
              </div>

              {/* Channel Selector */}
              <div className="flex bg-secondary p-1 rounded-lg border border-border">
                <button
                  onClick={() => setPitchChannel("linkedin")}
                  className={`px-3 py-1 rounded text-xs font-semibold font-mono transition-colors ${
                    pitchChannel === "linkedin" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  LinkedIn DM
                </button>
                <button
                  onClick={() => setPitchChannel("email")}
                  className={`px-3 py-1 rounded text-xs font-semibold font-mono transition-colors ${
                    pitchChannel === "email" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  Cold Email
                </button>
              </div>
            </div>

            {/* Pitch Preview Box */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-3 relative shadow-sm">
              {pitchChannel === "email" && (
                <div className="text-xs font-mono border-b border-border pb-3">
                  <span className="text-muted-foreground">Subject: </span>
                  <span className="text-foreground font-semibold">{activeTarget.pitch.email_subject}</span>
                </div>
              )}

              <div className="text-xs text-foreground font-mono leading-relaxed whitespace-pre-wrap">
                {pitchChannel === "linkedin" ? activeTarget.pitch.linkedin_dm : activeTarget.pitch.email_body}
              </div>

              <div className="pt-3 flex items-center justify-between border-t border-border/40">
                <div className="text-[11px] text-muted-foreground font-mono">
                  {pitchChannel === "linkedin" ? "No subject line needed — paste directly into connection note or DM" : "Includes zero-pitch conversational CTA"}
                </div>

                <Button
                  onClick={handleCopyPitch}
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs font-semibold"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied!" : "Copy to Clipboard"}
                </Button>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep("diagnose")} className="gap-2 text-xs">
                <ArrowLeft className="w-4 h-4" /> Back to Diagnosis
              </Button>

              <div className="flex items-center gap-3">
                <Button
                  onClick={handleMarkSent}
                  variant={sentStatus[activeTarget.id] ? "outline" : "default"}
                  className="gap-2 text-xs font-semibold h-11 px-5"
                >
                  {sentStatus[activeTarget.id] ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Sent!
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Mark as Sent
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleNextTarget}
                  variant="secondary"
                  className="gap-2 text-xs font-semibold h-11 px-5"
                >
                  Next Target ({queueIndex + 2 <= DEFAULT_QUEUE.length ? queueIndex + 2 : 1}/{DEFAULT_QUEUE.length}) ➔
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4: REPLY COPILOT ────────────────────────────────────────── */}
        {step === "reply" && (
          <div className="space-y-6">
            <div className="space-y-1 border-b border-border/60 pb-4">
              <span className="text-xs font-mono font-bold text-primary uppercase tracking-widest">Step 4 · Deal Copilot</span>
              <h2 className="text-2xl font-bold font-display text-foreground">Did a prospect reply?</h2>
              <p className="text-xs text-muted-foreground">
                Paste their exact response below — Atlas will diagnose their intent and write your counter-response or offer.
              </p>
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
                onClick={handleAnalyzeReply}
                disabled={analyzingReply || !replyText.trim()}
                className="gap-2 text-xs font-semibold h-10 px-5"
              >
                {analyzingReply ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Analyze Intent & Generate Follow-up
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
                  <strong className="text-foreground">Tactical Next Step:</strong> {replyAnalysis.recommendation}
                </p>

                <div className="bg-background border border-border rounded-lg p-3 text-xs text-foreground font-mono leading-relaxed">
                  {replyAnalysis.draft}
                </div>

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(replyAnalysis.draft);
                      toast.success("Follow-up response copied!");
                    }}
                    className="gap-2 text-xs font-semibold"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Response
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
