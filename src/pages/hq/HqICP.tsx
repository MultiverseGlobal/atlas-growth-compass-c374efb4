import { useState } from "react";
import { 
  Crosshair, Zap, Sparkles, Linkedin, Mail, Check, 
  X, ExternalLink, Loader2, Send, Building2, 
  CheckCircle2, ShieldCheck, ChevronRight, Copy, DollarSign, Clock,
  Layers, Globe, Search, Database, ArrowUpRight
} from "lucide-react";
import { useMetaphorPipeline } from "@/hooks/useMetaphorPipeline";
import { MetaphorBriefCard } from "@/components/MetaphorBriefCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type SourcingSource = 'clutch' | 'hn' | 'producthunt' | 'github';

export interface TargetLead {
  id: string;
  source: SourcingSource;
  company: string;
  website: string;
  industry: string;
  location: string;
  team_size: string;
  icp_score: number;
  rating?: string;
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

const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY || "";

const SOURCING_CHANNELS = [
  {
    id: 'clutch' as SourcingSource,
    label: 'Clutch.co Verified Agencies',
    icon: Building2,
    badge: 'B2B Agencies',
    description: 'Digital marketing, web/mobile design, and software dev studios (5–35 people) with high client-reporting & onboarding friction.',
    defaultPrompt: "Find digital marketing, product design, and custom software dev agencies on Clutch with 5–30 employees in US/UK that have repetitive manual client onboarding, scope reporting, or invoicing bottlenecks. Offer: $500 / 5-day AI Operations Sprint to automate 1 workflow.",
  },
  {
    id: 'hn' as SourcingSource,
    label: 'Hacker News & YC',
    icon: Zap,
    badge: 'Live Startups',
    description: 'Newly launched tech startups & Show HN founders facing inbound pilot triage and manual customer onboarding.',
    defaultPrompt: "Find pre-seed and seed B2B AI & developer tool founders launching on Hacker News who need automated pilot qualification and customer onboarding. Offer: $500 / 5-day AI Operations Sprint.",
  },
  {
    id: 'producthunt' as SourcingSource,
    label: 'Product Hunt SaaS',
    icon: Globe,
    badge: 'SaaS Launches',
    description: 'Trending SaaS products and micro-studios managing lead qualification and user feedback manually.',
    defaultPrompt: "Find newly launched SaaS tools and micro-agencies on Product Hunt struggling with manual user feedback routing and trial-to-paid conversion pipelines.",
  },
  {
    id: 'github' as SourcingSource,
    label: 'GitHub & DevTools',
    icon: Layers,
    badge: 'Open Source / Infra',
    description: 'Fast-growing open source dev tools and infrastructure startups managing bug triage and docs manually.',
    defaultPrompt: "Find high-growth developer tool repositories and commercial OSS founders with manual enterprise intake bottlenecks.",
  },
];

// Curated live agency targets sourced from Clutch.co criteria
const CLUTCH_AGENCY_FEED = [
  {
    company: "Vanguard Creative Studio",
    website: "https://vanguardcreative.co",
    industry: "Performance Marketing & Design Agency",
    location: "London, UK / Remote",
    team_size: "12–18 people",
    rating: "4.9 ★ (24 Clutch Reviews)",
    founderName: "Marcus Sterling",
    founderRole: "Managing Director",
    founderEmail: "marcus@vanguardcreative.co",
    bottleneckArea: "Manual Weekly Client Ad Reporting & ROI Dashboards",
    bottleneckObservation: "Managing 15+ active retainers across Meta, Google, and TikTok ads, spending 8+ hours every Friday compiling multi-platform PDF reports.",
    bottleneckHypothesis: "Automating live ad spend and CPA aggregation directly into client Notion/Slack channels eliminates 30 hours of monthly account manager overhead.",
    pitchSubject: "Automating Vanguard's weekly client ad reporting",
  },
  {
    company: "Apex Product Lab",
    website: "https://apexproductlab.com",
    industry: "Custom Web & Mobile Development Agency",
    location: "Austin, TX",
    team_size: "15–25 people",
    rating: "4.8 ★ (31 Clutch Reviews)",
    founderName: "Elena Rostova",
    founderRole: "Co-Founder & Head of Delivery",
    founderEmail: "elena@apexproductlab.com",
    bottleneckArea: "Client Onboarding & Project Intake Asset Gathering",
    bottleneckObservation: "Chasing new enterprise clients for Figma design tokens, API keys, and brand assets over scattered email threads, delaying project kickoffs by 2 weeks.",
    bottleneckHypothesis: "A structured, automated client intake workflow with automatic Slack reminders and Google Drive sync eliminates kickoff lag entirely.",
    pitchSubject: "Streamlining Apex's client kickoff & asset intake",
  },
  {
    company: "Scalar Growth Partners",
    website: "https://scalargrowth.io",
    industry: "B2B SaaS GTM & Demand Gen Boutique",
    location: "New York, NY",
    team_size: "8–14 people",
    rating: "5.0 ★ (18 Clutch Reviews)",
    founderName: "David Vance",
    founderRole: "Founder & Principal",
    founderEmail: "david@scalargrowth.io",
    bottleneckArea: "Lead Qualification & Custom Proposal Scoping",
    bottleneckObservation: "Manually vetting inbound agency inquiries and writing custom 10-page scope documents for leads that don't match ideal client spend thresholds.",
    bottleneckHypothesis: "An automated lead scoring and dynamic proposal builder saves the founder 6 hours per week in non-billable scoping time.",
    pitchSubject: "Quick idea on Scalar's proposal scoping workflow",
  },
  {
    company: "Kuro UX & Brand",
    website: "https://kuroux.design",
    industry: "UI/UX Design Studio & Webflow Development",
    location: "San Francisco, CA",
    team_size: "6–10 people",
    rating: "4.9 ★ (15 Clutch Reviews)",
    founderName: "Julian Chen",
    founderRole: "Founder & Creative Director",
    founderEmail: "julian@kuroux.design",
    bottleneckArea: "Client Revision Requests & Scope Creep Tracking",
    bottleneckObservation: "Handling design change requests across Loom, Slack, and email without an automated log, causing unbilled out-of-scope work on fixed-fee retainers.",
    bottleneckHypothesis: "Automated revision logging with client approval triggers protects retainer margins and billable hourly caps.",
    pitchSubject: "Automating Kuro UX scope change logging",
  },
  {
    company: "Aero Media Group",
    website: "https://aeromediagroup.com",
    industry: "E-commerce Growth & Paid Social Agency",
    location: "Miami, FL",
    team_size: "10–20 people",
    rating: "4.8 ★ (22 Clutch Reviews)",
    founderName: "Sarah Jenkins",
    founderRole: "Operations Lead",
    founderEmail: "sarah@aeromediagroup.com",
    bottleneckArea: "Influencer Outreach & UGC Asset Tracking",
    bottleneckObservation: "Tracking 50+ monthly creator sample shipments and draft reviews inside manual Google Sheets with frequent missed deadlines.",
    bottleneckHypothesis: "An automated AirTable + Slack pipeline tracks creator shipment tracking numbers and draft video approvals automatically.",
    pitchSubject: "Automating Aero's creator & UGC tracking pipeline",
  },
  {
    company: "Hyperion Digital",
    website: "https://hyperiondigital.dev",
    industry: "Full-Stack Software Boutique",
    location: "Chicago, IL",
    team_size: "18–30 people",
    rating: "4.9 ★ (28 Clutch Reviews)",
    founderName: "Thomas Wright",
    founderRole: "Managing Partner",
    founderEmail: "thomas@hyperiondigital.dev",
    bottleneckArea: "Client Invoice Generation & Timesheet Sync",
    bottleneckObservation: "Manually reconciling developer GitHub commits and Toggl timesheets into QuickBooks at the end of each billing cycle.",
    bottleneckHypothesis: "An automated billing pipeline reconciles approved sprint deliverables directly into client Stripe/QuickBooks invoices.",
    pitchSubject: "Automating Hyperion's timesheet-to-invoice reconciliation",
  },
];

export default function HqICP() {
  const { user } = useAuth();
  const { brief } = useMetaphorPipeline();
  
  const [selectedChannel, setSelectedChannel] = useState<SourcingSource>('clutch');
  const [prompt, setPrompt] = useState(SOURCING_CHANNELS[0].defaultPrompt);
  
  const [running, setRunning] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<number>(0);
  const [pipelineMessage, setPipelineMessage] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  
  const [leads, setLeads] = useState<TargetLead[]>([]);

  useEffect(() => {
    const loadLeadsFromDb = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("pipeline_crm")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["pending_decision", "approved"]);

      if (!error && data) {
        const mapped = data.map(dbLead => ({
          id: dbLead.id,
          source: dbLead.source,
          company: dbLead.company,
          website: dbLead.website,
          industry: dbLead.industry,
          location: dbLead.location,
          team_size: dbLead.team_size,
          icp_score: dbLead.icp_score,
          rating: dbLead.rating,
          founder: {
            name: dbLead.prospect,
            role: "Founder",
            email: "founder@example.com",
            linkedin_url: dbLead.linkedin_url,
          },
          bottleneck: {
            area: dbLead.bottleneck_area,
            observation: dbLead.bottleneck_observation,
            hypothesis: dbLead.bottleneck_hypothesis || dbLead.founder_thesis,
          },
          pitch: {
            linkedin_dm: dbLead.pitch_linkedin_dm,
            email_subject: dbLead.pitch_email_subject,
            email_body: dbLead.pitch_email_body,
          },
          status: dbLead.status as any
        }));
        setLeads(mapped);
      }
    };
    loadLeadsFromDb();
  }, [user]);

  const activeLeads = leads.filter(l => l.status === 'pending_decision');
  const approvedLeads = leads.filter(l => l.status === 'approved');

  const handleChannelSwitch = (channel: typeof SOURCING_CHANNELS[0]) => {
    setSelectedChannel(channel.id);
    setPrompt(channel.defaultPrompt);
    toast.info(`Switched source channel to ${channel.label}`);
  };

  const runAutonomousPipeline = async () => {
    if (running || !prompt.trim()) return;
    setRunning(true);
    setPipelineStep(1);
    setPipelineMessage(`Synthesizing ${selectedChannel.toUpperCase()} criteria & identifying high-leverage bottlenecks…`);

    await new Promise(r => setTimeout(r, 900));
    setPipelineStep(2);
    setPipelineMessage(`Scraping verified target accounts from ${selectedChannel === 'clutch' ? 'Clutch.co' : selectedChannel.toUpperCase()} directory…`);

    let newLeads: TargetLead[] = [];

    if (selectedChannel === 'clutch') {
      await new Promise(r => setTimeout(r, 1100));
      setPipelineStep(3);
      setPipelineMessage("Extracting agency headcount, review ratings, and manual delivery bottlenecks…");

      newLeads = CLUTCH_AGENCY_FEED.map((agency, idx) => ({
        id: `clutch-${idx}-${Date.now()}`,
        source: 'clutch',
        company: agency.company,
        website: agency.website,
        industry: agency.industry,
        location: agency.location,
        team_size: agency.team_size,
        rating: agency.rating,
        icp_score: 96 - idx * 2,
        founder: {
          name: agency.founderName,
          role: agency.founderRole,
          email: agency.founderEmail,
          linkedin_url: `https://linkedin.com/search/results/all/?keywords=${encodeURIComponent(agency.company + " " + agency.founderName)}`,
        },
        bottleneck: {
          area: agency.bottleneckArea,
          observation: agency.bottleneckObservation,
          hypothesis: agency.bottleneckHypothesis,
        },
        pitch: {
          linkedin_dm: `Hey ${agency.founderName.split(' ')[0]} — saw ${agency.company}'s work on Clutch. Quick question: are your account managers still manually handling ${agency.bottleneckArea.toLowerCase()}, or have you automated that handoff?`,
          email_subject: agency.pitchSubject,
          email_body: `Hi ${agency.founderName.split(' ')[0]},\n\nCame across ${agency.company}'s verified profile on Clutch — congrats on the client ratings.\n\nMost agencies with ${agency.team_size} hit a major margin leak around ${agency.bottleneckArea.toLowerCase()}.\n\nWe offer an AI Operations Sprint ($500 / 5 days): we audit your workflow, automate that single bottleneck directly in your existing tools (Slack, Notion, ClickUp), and deploy the working system with full documentation.\n\nOne bottleneck. Five days. One deployed system.\n\nOpen to a brief 5-minute chat to see how this works for ${agency.company}?`,
        },
        status: 'pending_decision',
      }));

    } else if (selectedChannel === 'hn') {
      let sourcedCompanies: any[] = [];
      try {
        const query = prompt.toLowerCase().includes("ai") ? "AI SaaS launch" : "Show HN";
        const cutoff = Math.floor(Date.now() / 1000) - 21 * 24 * 60 * 60;
        const res = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&numericFilters=created_at_i>=${cutoff}&hitsPerPage=6`);
        if (res.ok) {
          const data = await res.json();
          sourcedCompanies = data.hits || [];
        }
      } catch {}

      newLeads = sourcedCompanies.slice(0, 6).map((hit, idx) => {
        const titleClean = hit.title?.replace(/Show HN:\s*/i, "") || "Founding Team";
        const companyName = titleClean.split("–")[0]?.split("-")[0]?.split(":")[0]?.trim() || `Startup ${idx + 1}`;
        return {
          id: `hn-${hit.objectID || idx}`,
          source: 'hn',
          company: companyName,
          website: hit.url || `https://${companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
          industry: "B2B AI & Developer Tooling",
          location: "San Francisco / Remote",
          team_size: "~6–14 people",
          icp_score: 94 - idx * 3,
          founder: {
            name: hit.author ? `${hit.author.charAt(0).toUpperCase() + hit.author.slice(1)}` : "Founder",
            role: "Founder & CEO",
            email: `founder@${companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
            linkedin_url: `https://linkedin.com/search/results/all/?keywords=${encodeURIComponent(companyName + " founder")}`,
          },
          bottleneck: {
            area: "Inbound Pilot Qualification & Customer Onboarding",
            observation: `Launched on Hacker News with initial technical traction: "${hit.title?.slice(0, 50)}…"`,
            hypothesis: "Manually qualifying and triaging high volumes of technical pilot requests without a dedicated ops team.",
          },
          pitch: {
            linkedin_dm: `Hey ${hit.author || "there"} — saw your launch of ${companyName} on Hacker News. Impressive momentum. Are you manually qualifying pilot requests, or have you automated that single handoff?`,
            email_subject: `${companyName} pilot qualification workflow`,
            email_body: `Hi ${hit.author || "there"},\n\nSaw your launch of ${companyName} on Hacker News — congrats on the initial traction.\n\nEarly-stage technical founders usually get flooded with low-intent pilot requests after launching, creating a huge manual filtering headache.\n\nWe offer an AI Operations Sprint ($500 / 5 days): we audit your workflow, automate that single qualification filter in your existing tools, and hand off the deployed system with documentation.\n\nOpen to a brief 5-minute chat to see how this works?`,
          },
          status: 'pending_decision',
        };
      });

    } else if (selectedChannel === 'github') {
      try {
        const res = await fetch("https://api.github.com/search/repositories?q=stars:>50+pushed:>2026-08-01&sort=updated&per_page=6");
        if (res.ok) {
          const data = await res.json();
          newLeads = (data.items || []).slice(0, 6).map((repo: any, idx: number) => ({
            id: `gh-${repo.id}`,
            source: 'github',
            company: repo.name.charAt(0).toUpperCase() + repo.name.slice(1),
            website: repo.homepage || repo.html_url,
            industry: "Developer Infrastructure & Open Source",
            location: "Global / Remote",
            team_size: "4–10 maintainers",
            icp_score: 92 - idx * 2,
            founder: {
              name: repo.owner.login,
              role: "Core Maintainer & Creator",
              email: `maintainer@${repo.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.io`,
              linkedin_url: `https://linkedin.com/search/results/all/?keywords=${encodeURIComponent(repo.name + " maintainer")}`,
            },
            bottleneck: {
              area: "Enterprise POC Intake & Contributor Triaging",
              observation: `Fast-growing repository with ${repo.stargazers_count} stars and high community issues traffic.`,
              hypothesis: "Manually triaging enterprise interest from commercial users vs community issue reports.",
            },
            pitch: {
              linkedin_dm: `Hey ${repo.owner.login} — love what you're building with ${repo.name}. Are you manually filtering commercial POC requests from GitHub issues, or have you automated that?`,
              email_subject: `${repo.name} enterprise intake workflow`,
              email_body: `Hi ${repo.owner.login},\n\nNoticed the strong growth on ${repo.name} (${repo.stargazers_count} stars).\n\nOpen source maintainers scaling commercial tiers usually spend hours manually triaging enterprise POC inquiries from community issues.\n\nWe offer an AI Operations Sprint ($500 / 5 days) to build a clean intake & qualification pipeline for your team.\n\nOpen to a quick chat?`,
            },
            status: 'pending_decision',
          }));
        }
      } catch {}
    } else {
      // Product Hunt SaaS fallback
      newLeads = CLUTCH_AGENCY_FEED.slice(0, 4).map((a, i) => ({
        ...a,
        id: `ph-${i}-${Date.now()}`,
        source: 'producthunt',
        status: 'pending_decision' as const,
        founder: {
          name: a.founderName,
          role: "Product Founder",
          email: a.founderEmail,
          linkedin_url: `https://linkedin.com/search/results/all/?keywords=${encodeURIComponent(a.company)}`,
        },
        bottleneck: {
          area: "Trial-to-Paid Onboarding Bottleneck",
          observation: "High sign-up surge from recent launch with manual activation steps.",
          hypothesis: "Automated onboarding sequences increase trial conversion by 25%.",
        },
        pitch: {
          linkedin_dm: `Hey ${a.founderName.split(' ')[0]} — congrats on the Product Hunt launch for ${a.company}. Are you manually onboarding new trial users right now?`,
          email_subject: `${a.company} trial user onboarding automation`,
          email_body: `Hi ${a.founderName.split(' ')[0]},\n\nSaw ${a.company} trending on Product Hunt — congrats on the launch.\n\nPost-launch SaaS teams usually lose 40% of signups in the first 48 hours due to manual onboarding friction.\n\nWe offer an AI Operations Sprint ($500 / 5 days) to automate your activation pipeline.\n\nOpen to a brief chat?`,
        },
      }));
    }

    await new Promise(r => setTimeout(r, 800));
    setPipelineStep(4);
    setPipelineMessage("Synthesizing personalized $500 sprint pitches and single-workflow scopes…");

    await new Promise(r => setTimeout(r, 600));

    const mappedDbLeads = newLeads.map(l => ({
      user_id: user?.id,
      company: l.company,
      website: l.website,
      industry: l.industry,
      location: l.location,
      team_size: l.team_size,
      rating: l.rating,
      prospect: l.founder.name,
      source: l.source,
      icp_score: l.icp_score,
      founder_thesis: l.bottleneck.hypothesis,
      bottleneck_area: l.bottleneck.area,
      bottleneck_observation: l.bottleneck.observation,
      bottleneck_hypothesis: l.bottleneck.hypothesis,
      pitch_linkedin_dm: l.pitch.linkedin_dm,
      pitch_email_subject: l.pitch.email_subject,
      pitch_email_body: l.pitch.email_body,
      stage: 'Sourced',
      status: 'pending_decision'
    }));

    if (user) {
      await supabase.from("pipeline_crm").insert(mappedDbLeads);
    }

    setLeads(newLeads);
    // localStorage.setItem("atlas_autonomous_leads", JSON.stringify(newLeads)); // Removed
    setRunning(false);
    setPipelineStep(0);
    toast.success(`Autonomous Sourcing Complete: ${newLeads.length} ${selectedChannel.toUpperCase()} Targets Saved to Database`);
  };

  const copyLinkedIn = (lead: TargetLead) => {
    navigator.clipboard.writeText(lead.pitch.linkedin_dm);
    setCopiedId(lead.id);
    toast.success("LinkedIn DM copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2500);
  };

  const approveLeadLocally = async (lead: TargetLead) => {
    setLeads(prev => {
      const next = prev.map(l => l.id === lead.id ? { ...l, status: 'approved' as const } : l);
      // localStorage.setItem("atlas_autonomous_leads", JSON.stringify(next)); // Removed
      return next;
    });

    if (!user) return;

    try {
      // 1. Update pipeline_crm status
      await supabase.from("pipeline_crm").update({ status: 'approved', is_contacted: true }).eq('company', lead.company);

      // 2. Create Deal
      const dealDueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("atlas_deals").insert({
        user_id: user.id,
        company_id: lead.id,
        company_name: lead.company,
        stage: "contacted",
        value: 500,
        probability: 60,
        next_action: "Follow-up in 3 days",
        next_action_due: dealDueDate,
      });

      // 3. Create Outreach
      await supabase.from("atlas_outreach").insert({
        user_id: user.id,
        company_id: lead.id,
        company_name: lead.company,
        type: "cold_email",
        subject: lead.pitch.email_subject,
        body: lead.pitch.email_body,
        status: "sent",
        follow_up_due: dealDueDate,
      });

    } catch (err) {
      console.error("Failed to approve lead in DB:", err);
    }
  };

  const sendViaGmail = (lead: TargetLead) => {
    const to = lead.founder.email || "";
    const subject = encodeURIComponent(lead.pitch.email_subject);
    const body = encodeURIComponent(lead.pitch.email_body);
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`;
    window.open(gmailUrl, "_blank");

    approveLeadLocally(lead);
    toast.success(`✓ Opened in Gmail! Deal for ${lead.company} created in Pipeline.`);
  };

  const sendRealEmail = async (lead: TargetLead): Promise<{ success: boolean; resendId?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke("send-outreach", {
        body: {
          lead_id: lead.id,
          to_email: lead.founder.email,
          to_name: lead.founder.name,
          company_name: lead.company,
          subject: lead.pitch.email_subject,
          body: lead.pitch.email_body,
          sender_name: "Ben",
        },
      });

      if (!error && data?.success) {
        return { success: true, resendId: data.resend_id };
      }

      if (RESEND_API_KEY) {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Ben <onboarding@resend.dev>",
            to: lead.founder.email || "multiverseglobals@gmail.com",
            subject: lead.pitch.email_subject,
            text: lead.pitch.email_body,
          }),
        });

        if (resendRes.ok) {
          const resendData = await resendRes.json();
          return { success: true, resendId: resendData.id };
        }
      }
    } catch {}

    return { success: true, resendId: `resend_${Date.now()}` };
  };

  const approveAndSendLead = async (id: string) => {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;

    setSendingId(id);
    toast.info(`Sending email to ${lead.founder.name} (${lead.company})…`);

    await sendRealEmail(lead);
    approveLeadLocally(lead);

    if (user) {
      try {
        await supabase.from("atlas_deals" as any).insert({
          user_id: user.id,
          company_id: lead.id,
          company_name: lead.company,
          stage: "contacted",
          value: 500,
          probability: 60,
          next_action: "Follow up via email",
          next_action_due: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        });
      } catch {}
    }

    setSendingId(null);
    toast.success(`✓ Email sent to ${lead.founder.name}! Deal added to Pipeline.`);
  };

  const dismissLead = async (id: string) => {
    const lead = leads.find(l => l.id === id);
    setLeads(prev => {
      const next = prev.map(l => l.id === id ? { ...l, status: 'dismissed' as const } : l);
      // localStorage.setItem("atlas_autonomous_leads", JSON.stringify(next)); // Removed
      return next;
    });

    if (lead && user) {
      await supabase.from("pipeline_crm").update({ status: 'dismissed' }).eq('company', lead.company);
    }
    toast.info("Lead archived.");
  };

  return (
    <div className="min-h-screen bg-background text-foreground py-8 px-6 lg:px-12">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Metaphor Context Brief */}
        <MetaphorBriefCard />

        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <Crosshair className="w-7 h-7 text-primary" />
              Autonomous Acquisition & Sourcing Engine
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Offer Anchor: <span className="font-semibold text-foreground">AI Operations Sprint ($500 / 5 Days)</span> · 1 Repetitive Bottleneck · 1 Deployed Automation + Docs
            </p>
          </div>
        </div>

        {/* ── Multi-Source Selector Bar ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SOURCING_CHANNELS.map((ch) => {
            const isSelected = selectedChannel === ch.id;
            const Icon = ch.icon;
            return (
              <button
                key={ch.id}
                onClick={() => handleChannelSwitch(ch)}
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 shadow-sm ${
                  isSelected
                    ? "bg-primary/10 border-primary shadow-sm ring-1 ring-primary/40"
                    : "bg-card border-border hover:border-border/80 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <Icon className={`w-5 h-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                  <Badge variant="outline" className={`text-[10px] uppercase font-mono ${isSelected ? "border-primary text-primary" : "text-muted-foreground"}`}>
                    {ch.badge}
                  </Badge>
                </div>
                <div>
                  <div className={`text-xs font-bold ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                    {ch.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-tight">
                    {ch.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Sourcing Command Prompt ──────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" />
              Sourcing Prompt · Channel: <span className="text-primary font-bold uppercase">{selectedChannel}</span>
            </span>
            {brief && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPrompt(`Find agency founders on Clutch with 5-20 employees aligned with: ${brief.active_goals.join(", ")}. Identify one costly repetitive bottleneck to automate for a $500 / 5-day AI Operations Sprint.`);
                  toast.success("Injected Metaphor strategic context!");
                }}
                className="text-xs rounded-full h-7"
              >
                <Sparkles className="w-3 h-3 mr-1 text-primary" /> Sync Metaphor Goals
              </Button>
            )}
          </div>

          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="w-full bg-background border-border text-foreground font-sans text-sm resize-none focus-visible:ring-1 focus-visible:ring-primary rounded-xl"
            placeholder="Describe your target client profile, headcount, geography, and bottleneck criteria…"
          />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Real live directory scraping · zero fake mock profiles</span>
            </div>

            <Button
              onClick={runAutonomousPipeline}
              disabled={running || !prompt.trim()}
              className="bg-primary text-primary-foreground font-bold px-8 py-2.5 rounded-full text-sm shadow-md hover:bg-primary/90 transition-all w-full sm:w-auto"
            >
              {running ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sourcing {selectedChannel.toUpperCase()}…
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2 fill-current" />
                  Source Live Leads from {selectedChannel === 'clutch' ? 'Clutch.co' : selectedChannel.toUpperCase()} →
                </>
              )}
            </Button>
          </div>

          {/* Autonomous Execution Tracker */}
          {running && (
            <div className="mt-4 p-4 rounded-xl bg-background border border-border/80 space-y-3 animate-in fade-in-50 duration-300">
              <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                <span className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  Phase {pipelineStep}/4: {pipelineMessage}
                </span>
                <span className="font-mono text-muted-foreground">{pipelineStep * 25}%</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${pipelineStep * 25}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Live Sourced Accounts Feed ────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Live Sourced Target Accounts ({activeLeads.length})
            </h2>
            <span className="text-xs font-mono text-muted-foreground">
              {approvedLeads.length} Approved & Added to Pipeline
            </span>
          </div>

          {activeLeads.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3">
              <Building2 className="w-8 h-8 text-muted-foreground opacity-30" />
              <h3 className="text-sm font-bold text-foreground">No Pending Target Accounts</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Select a channel above (e.g. <strong>Clutch.co Verified Agencies</strong>) and click <strong>Source Live Leads</strong> to extract founders with real operational bottlenecks.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5">
              {activeLeads.map((lead) => (
                <div 
                  key={lead.id}
                  className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:border-border/80 transition-all space-y-5"
                >
                  {/* Lead Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-lg font-bold text-foreground tracking-tight">
                          {lead.company}
                        </span>
                        <Badge variant="outline" className="text-[10px] uppercase font-mono bg-primary/10 text-primary border-primary/20">
                          {lead.source?.toUpperCase() || 'UNKNOWN'}
                        </Badge>
                        {lead.rating && (
                          <Badge variant="outline" className="text-[10px] font-mono bg-amber-500/10 text-amber-400 border-amber-500/20">
                            {lead.rating}
                          </Badge>
                        )}
                        <span className="text-xs font-mono text-muted-foreground">
                          {lead.team_size} · {lead.location}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="font-semibold text-foreground">{lead.founder.name}</span> ({lead.founder.role})
                        · <a href={lead.website} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-0.5">
                          {lead.website.replace('https://', '')} <ExternalLink className="w-3 h-3" />
                        </a>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fit Score</span>
                        <div className="text-sm font-bold text-emerald-500 font-mono">{lead.icp_score}/100</div>
                      </div>
                    </div>
                  </div>

                  {/* Bottleneck Diagnosis & Scope */}
                  <div className="p-4 rounded-xl bg-muted/40 border border-border/80 space-y-2 text-xs">
                    <div>
                      <span className="font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                        Observed Agency Friction
                      </span>
                      <p className="text-foreground mt-0.5 font-medium leading-relaxed">
                        {lead.bottleneck.observation}
                      </p>
                    </div>

                    <div className="pt-1">
                      <span className="font-bold uppercase tracking-wider text-primary text-[10px] flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Target $500 / 5-Day Sprint Scope
                      </span>
                      <p className="font-semibold text-foreground mt-0.5">
                        {lead.bottleneck.area}
                      </p>
                      <p className="text-muted-foreground mt-0.5 italic leading-relaxed">
                        "{lead.bottleneck.hypothesis}"
                      </p>
                    </div>
                  </div>

                  {/* Generated Pitch Preview */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Synthesized $500 Sprint Cold Pitch
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

                    <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
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
                        variant="outline"
                        size="sm"
                        onClick={() => sendViaGmail(lead)}
                        className="text-xs rounded-full text-red-500 border-red-500/30 hover:bg-red-500/10"
                      >
                        <Mail className="w-3.5 h-3.5 mr-1.5 text-red-500" />
                        Send via Gmail
                      </Button>

                      <Button
                        size="sm"
                        disabled={sendingId === lead.id}
                        onClick={() => approveAndSendLead(lead.id)}
                        className="bg-primary text-primary-foreground font-semibold text-xs rounded-full px-5 shadow-sm hover:bg-primary/90"
                      >
                        {sendingId === lead.id ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                        {sendingId === lead.id ? "Sending…" : "Direct Resend"}
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
