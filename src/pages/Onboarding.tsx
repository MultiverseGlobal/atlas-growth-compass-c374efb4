import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Logo } from "@/components/atlas/Logo";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ShieldCheck,
  Globe,
  Plug,
  Target,
  Briefcase,
  Rocket,
  Users,
  Coins,
  FileText,
  Layout,
  Code2,
  TrendingUp,
  GitPullRequest,
  Sparkles,
  MapPin,
  ArrowUpRight,
} from "lucide-react";
import { loadStarterMap } from "@/lib/starterMap";
import { useIntegrations } from "@/hooks/useIntegrations";
import { friendlyError } from "@/lib/errors";

const FORM_STEPS = ["Profile", "Context", "Data sources", "Outcome"];
const TOTAL_FORM_STEPS = FORM_STEPS.length;
const CELEBRATE_STEP = TOTAL_FORM_STEPS; // step index 4 = celebration

const sources = [
  {
    id: "github", name: "GitHub", detail: "PRs, issues, releases",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
      </svg>
    ),
  },
  {
    id: "stripe", name: "Stripe", detail: "Revenue and churn",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
        <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
      </svg>
    ),
  },
  {
    id: "notion", name: "Notion", detail: "Docs and databases",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933z" />
      </svg>
    ),
  },
  {
    id: "slack", name: "Slack", detail: "Team conversations",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5">
        <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"/>
        <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"/>
        <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z"/>
        <path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
      </svg>
    ),
  },
  {
    id: "manual", name: "Manual context", detail: "Notes and file uploads",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
];

const areas = [
  { id: "engineering", label: "Engineering & Dev", description: "Monitor commit velocity, code review times, and deployment blockers.", icon: <Code2 className="h-4.5 w-4.5" /> },
  { id: "product", label: "Product & UX", description: "Align milestone deliveries, cycle times, and shipping deadlines.", icon: <Layout className="h-4.5 w-4.5" /> },
  { id: "marketing", label: "Growth & Sales", description: "Ingest client conversions, sign-ups, and user acquisition funnels.", icon: <TrendingUp className="h-4.5 w-4.5" /> },
  { id: "operations", label: "Operations & Finance", description: "Audit Stripe MRR checkpoints, team updates, and active contracts.", icon: <Briefcase className="h-4.5 w-4.5" /> },
];

const constraints = [
  { id: "velocity", label: "Shipping Velocity", description: "Accelerate feature shipping and reduce development bottlenecks.", icon: <Rocket className="h-4.5 w-4.5" /> },
  { id: "acquisition", label: "User Acquisition", description: "Improve active sign-up conversions and outbound funnels.", icon: <Users className="h-4.5 w-4.5" /> },
  { id: "alignment", label: "Team Alignment", description: "Coordinate cross-functional tasks and resolve resource locks.", icon: <GitPullRequest className="h-4.5 w-4.5" /> },
  { id: "fundraising", label: "Fundraising & MRR", description: "Structure reporting sheets, capture MRR growth, prepare pitches.", icon: <Coins className="h-4.5 w-4.5" /> },
];

const outcomes = [
  { id: "weekly", label: "Weekly Advisory Report", description: "A detailed diagnosis of recent signals, constraints, and recommendations.", icon: <FileText className="h-4.5 w-4.5" /> },
  { id: "investor", label: "Investor Operating Summary", description: "High-level summary of velocity and traction formatted for shareouts.", icon: <ShieldCheck className="h-4.5 w-4.5" /> },
  { id: "public", label: "Public Progress Page", description: "A shareable roadmap dashboard for customers and stakeholders.", icon: <Globe className="h-4.5 w-4.5" /> },
  { id: "map", label: "Strategy Roadmapping", description: "Visual map trails tracing goals directly to operational action items.", icon: <Target className="h-4.5 w-4.5" /> },
];

function generateStarterWaypoints(
  mapId: string,
  userId: string,
  goalStatement: string,
  area: string,
  constraint: string
) {
  let constraintTitle = "Connect a source to generate a constraint.";
  let evidenceTitle = "No signals yet.";
  let moveTitle = "Link GitHub or add a manual note below.";

  if (constraint === "velocity") {
    constraintTitle = "Engineering throughput is limited by task completion velocity.";
    evidenceTitle = "GitHub repository connection pending. Baseline velocity is set to starter metrics.";
    moveTitle = "Connect GitHub to start monitoring automated commit and PR signals.";
  } else if (constraint === "acquisition") {
    constraintTitle = "Customer acquisition funnels are undocumented and unmeasured.";
    evidenceTitle = "Data integration for Stripe and analytics is pending. Manual traction tracking active.";
    moveTitle = "Submit a manual note detailing your current week-over-week user growth rate.";
  } else if (constraint === "alignment") {
    constraintTitle = "Cross-functional dependencies are slowing down release iterations.";
    evidenceTitle = "Notion and Slack data sources are offline. Strategy alignments are self-reported.";
    moveTitle = "Document your current active milestone in the timeline view.";
  } else if (constraint === "fundraising") {
    constraintTitle = "Operating metrics are not aggregated into standard investor disclosures.";
    evidenceTitle = "Investor update template initialized. Financial signals require Stripe integration.";
    moveTitle = "Configure the investor report output in your settings to schedule weekly sends.";
  }

  return [
    { map_id: mapId, user_id: userId, kind: "goal" as const, title: goalStatement, confidence: "established" as const, position: 0 },
    { map_id: mapId, user_id: userId, kind: "constraint" as const, title: constraintTitle, confidence: "emerging" as const, position: 1 },
    { map_id: mapId, user_id: userId, kind: "evidence" as const, title: evidenceTitle, confidence: "emerging" as const, position: 2 },
    { map_id: mapId, user_id: userId, kind: "move" as const, title: moveTitle, confidence: "established" as const, position: 3 },
  ];
}

export default function Onboarding() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStep = searchParams.get("step") ? parseInt(searchParams.get("step")!) : 0;
  const [step, setStep] = useState(initialStep);
  const [celebrationProgress, setCelebrationProgress] = useState(0);
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>(["github"]);
  const [saving, setSaving] = useState(false);

  // Guided context states
  const starterMap = loadStarterMap();
  const [goal, setGoal] = useState(starterMap?.goalStatement ?? "");
  const [operatingArea, setOperatingArea] = useState("engineering");
  const [primaryConstraint, setPrimaryConstraint] = useState("velocity");
  const [desiredOutcome, setDesiredOutcome] = useState("weekly");

  const { data: integrations = [], connectGitHub } = useIntegrations();
  const isGitHubConnected = integrations.some(i => i.provider === "github" && i.status === "active");

  const goToStep = (s: number) => {
    setStep(s);
    // Don't push celebration step into URL
    if (s < TOTAL_FORM_STEPS) {
      setSearchParams(s > 0 ? { step: String(s) } : {}, { replace: true });
    }
  };

  useEffect(() => {
    if (!loading && !user) nav("/auth");
  }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("handle, display_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setHandle(data.handle ?? "");
        setDisplayName(data.display_name ?? "");
      });
    return () => { cancelled = true; };
  }, [user]);

  const cleanHandle = useMemo(() => handle.trim().toLowerCase().replace(/^@/, ""), [handle]);
  const validHandle = /^[a-z0-9_]{3,20}$/.test(cleanHandle);

  const canContinue =
    step === 0 ? validHandle :
    step === 1 ? (goal.trim().length >= 4 && !!operatingArea && !!primaryConstraint) :
    step === 2 ? true :
    step === 3 ? !!desiredOutcome : true;

  // Celebration auto-redirect
  useEffect(() => {
    if (step !== CELEBRATE_STEP) return;
    setCelebrationProgress(0);
    const DURATION = 4200; // ms before redirect
    const TICK = 50;
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += TICK;
      setCelebrationProgress(Math.min((elapsed / DURATION) * 100, 100));
      if (elapsed >= DURATION) {
        clearInterval(timer);
        nav("/app", { replace: true });
      }
    }, TICK);
    return () => clearInterval(timer);
  }, [step, nav]);

  const toggleSource = (id: string) => {
    setSelectedSources((cur) => cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id]);
  };

  const saveProfileDraft = async () => {
    if (!user || !validHandle) return false;
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      handle: cleanHandle,
      display_name: displayName.trim() || cleanHandle,
    }, { onConflict: "id" });
    if (error) { toast.error(friendlyError(error)); return false; }
    return true;
  };

  const next = async () => {
    if (step === 0) {
      if (!validHandle) { toast.error("Handle must be 3–20 chars: a-z, 0-9, _"); return; }
      setSaving(true);
      const ok = await saveProfileDraft();
      setSaving(false);
      if (!ok) return;
    }
    if (!canContinue) return;
    goToStep(Math.min(step + 1, steps.length - 1));
  };

  const handleConnectGitHub = async () => {
    if (step === 2 && validHandle) await saveProfileDraft();
    connectGitHub("/onboarding?step=2");
  };

  const finish = async () => {
    if (!user) return;
    if (!validHandle) { toast.error("Choose a valid public handle first."); setStep(0); return; }

    setSaving(true);

    // Save profile
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      handle: cleanHandle,
      display_name: displayName.trim() || cleanHandle,
      onboarded_at: new Date().toISOString(),
    }, { onConflict: "id" });

    if (profileError) {
      toast.error(friendlyError(profileError));
      if (profileError.message?.includes("handle")) setStep(0);
      setSaving(false);
      return;
    }

    const finalGoal = goal.trim() || (starterMap ? starterMap.goalStatement : "Grow my business");

    // Insert the map
    const { data: mapData, error: mapError } = await supabase
      .from("maps")
      .insert({
        user_id: user.id,
        goal_statement: finalGoal,
        confidence: "starter",
        is_published: false,
      })
      .select("id")
      .single();

    if (mapError) {
      toast.error(friendlyError(mapError));
      setSaving(false);
      return;
    }

    if (mapData?.id) {
      // Generate and insert waypoints
      const starterWaypoints = generateStarterWaypoints(
        mapData.id,
        user.id,
        finalGoal,
        operatingArea,
        primaryConstraint
      );
      const { error: wpError } = await supabase
        .from("waypoints")
        .insert(starterWaypoints);
      
      if (wpError) {
        toast.error("Failed to initialize map waypoints: " + wpError.message);
      }
    }

    // Clean up local storage
    try {
      localStorage.removeItem("atlas.starter");
      localStorage.removeItem("atlas.setup");
    } catch { /* non-critical */ }

    setSaving(false);
    // Go to celebration step instead of immediately navigating
    goToStep(CELEBRATE_STEP);
  };

  if (loading || !user) return <div className="min-h-screen bg-background" />;

  // ─── Celebration screen (step 4) ──────────────────────────────────────────────
  if (step === CELEBRATE_STEP) {
    const firstOutcomeLabel = outcomes.find(o => o.id === desiredOutcome)?.label ?? "your first report";
    const finalGoal = goal.trim() || (starterMap?.goalStatement ?? "Grow my business");

    return (
      <div className="min-h-screen bg-background grain flex flex-col items-center justify-center px-6 py-16 relative overflow-hidden">
        {/* Ambient glow blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-primary/8 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full bg-primary/5 blur-[100px]" />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center max-w-md">
          {/* Animated compass mark */}
          <div className="relative mb-8">
            {/* Sonar rings */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-24 w-24 rounded-full border border-primary/20 sonar-ring" style={{ animationDelay: "0s" }} />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-24 w-24 rounded-full border border-primary/15 sonar-ring" style={{ animationDelay: "0.7s" }} />
            </div>
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 border border-primary/30">
              <svg
                className="h-9 w-9 text-primary compass-spin"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" fill="currentColor" fillOpacity="0.25" />
                <line x1="12" y1="2" x2="12" y2="4" strokeLinecap="round" />
                <line x1="12" y1="20" x2="12" y2="22" strokeLinecap="round" />
                <line x1="2" y1="12" x2="4" y2="12" strokeLinecap="round" />
                <line x1="20" y1="12" x2="22" y2="12" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* Eyebrow */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-primary mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            Map initialized
          </div>

          {/* Headline */}
          <h1 className="font-display text-4xl font-semibold leading-tight md:text-5xl">
            Your map is being built.
          </h1>

          {/* Goal preview */}
          <div className="mt-6 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-left">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm text-foreground/80 leading-relaxed">
              <span className="font-medium text-foreground">Goal →</span> {finalGoal}
            </p>
          </div>

          {/* What's happening */}
          <div className="mt-6 grid grid-cols-1 gap-2 w-full">
            {[
              { text: "Waypoints initialized", done: true },
              { text: "Constraint baseline set", done: true },
              { text: `Outcome configured: ${firstOutcomeLabel}`, done: true },
              { text: "GitHub signals pending first sync", done: false },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-card/60 px-3 py-2.5"
                style={{ animationDelay: `${i * 0.15}s` }}
              >
                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                  item.done ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground/40"
                }`}>
                  {item.done ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 animate-pulse" />
                  )}
                </div>
                <span className={`text-xs ${
                  item.done ? "text-foreground/80" : "text-muted-foreground/60"
                }`}>{item.text}</span>
              </div>
            ))}
          </div>

          {/* Progress bar + redirect message */}
          <div className="mt-8 w-full">
            <div className="h-[3px] w-full rounded-full bg-border overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all ease-linear"
                style={{ width: `${celebrationProgress}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Opening your workspace…
            </p>
          </div>

          {/* Skip */}
          <button
            onClick={() => nav("/app", { replace: true })}
            className="mt-6 inline-flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            Go now <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  // ─── Onboarding form (steps 0-3) ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background grain">
      <header className="container flex h-16 items-center justify-between border-b border-border/60">
        <Logo />
        <div className="hidden text-xs font-mono uppercase text-muted-foreground sm:block">Intake setup</div>
      </header>

      <main className="container max-w-xl py-12 md:py-20">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {FORM_STEPS.map((label, index) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-mono ${
                index < step ? "bg-primary text-primary-foreground" :
                index === step ? "border-2 border-primary text-primary" :
                "border border-border text-muted-foreground"
              }`}>
                {index < step ? <Check className="h-3 w-3" /> : index + 1}
              </div>
              <span className={`text-xs md:text-sm ${index === step ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {label}
              </span>
              {index < FORM_STEPS.length - 1 && (
                <div className={`h-px w-4 md:w-6 ${index < step ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
          {/* STEP 0: Public identity */}
          {step === 0 && (
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-primary">Public identity</div>
              <h2 className="mt-2 font-display text-2xl font-semibold">Set your public handle.</h2>
              <p className="text-xs text-muted-foreground mt-1">This sets up your default showcase URL at atlas.so/@handle.</p>
              <div className="mt-7 grid gap-5">
                <div>
                  <Label htmlFor="dn">Display name</Label>
                  <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jane Founder" className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="handle">Handle</Label>
                  <div className="mt-1.5 flex items-center rounded-md border border-input bg-input/40 focus-within:ring-2 focus-within:ring-ring">
                    <span className="pl-3 pr-1 font-mono text-sm text-muted-foreground">atlas.so/@</span>
                    <Input id="handle" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="janef" className="border-0 bg-transparent pl-0 focus-visible:ring-0" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 1: Business context */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <div className="text-xs font-mono uppercase tracking-widest text-primary">Context intake</div>
                <h2 className="mt-2 font-display text-2xl font-semibold">Tell us about your goal.</h2>
                <p className="text-xs text-muted-foreground mt-1">Stating your objective allows Atlas to align operating signals correctly.</p>
              </div>

              <div>
                <Label htmlFor="onboarding-goal">Your primary objective</Label>
                <textarea
                  id="onboarding-goal"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g. Launch the scheduler beta and onboard 10 beta testers"
                  rows={2}
                  className="mt-1.5 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <Label>Primary operating area</Label>
                <div className="mt-2 grid gap-2 grid-cols-1 sm:grid-cols-2">
                  {areas.map((a) => {
                    const active = operatingArea === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setOperatingArea(a.id)}
                        className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                          active ? "border-primary bg-primary/5" : "border-border bg-background/50 hover:bg-muted/30"
                        }`}
                      >
                        <span className={`mt-0.5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}>
                          {a.icon}
                        </span>
                        <div>
                          <div className="font-semibold text-xs text-foreground">{a.label}</div>
                          <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{a.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>Main priority bottleneck</Label>
                <div className="mt-2 grid gap-2 grid-cols-1 sm:grid-cols-2">
                  {constraints.map((c) => {
                    const active = primaryConstraint === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setPrimaryConstraint(c.id)}
                        className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                          active ? "border-primary bg-primary/5" : "border-border bg-background/50 hover:bg-muted/30"
                        }`}
                      >
                        <span className={`mt-0.5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}>
                          {c.icon}
                        </span>
                        <div>
                          <div className="font-semibold text-xs text-foreground">{c.label}</div>
                          <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{c.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Data sources */}
          {step === 2 && (
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-primary">Data connections</div>
              <h2 className="mt-2 font-display text-2xl font-semibold">Select your data sources.</h2>
              <p className="text-xs text-muted-foreground mt-1">Connecting sources unlocks high-signal analysis of operational constraints.</p>
              
              <div className="mt-6 grid gap-2">
                {sources.map((source) => {
                  const isGitHub = source.id === "github";
                  const selected = selectedSources.includes(source.id);
                  
                  if (isGitHub) {
                    return (
                      <div
                        key={source.id}
                        className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-all ${
                          isGitHubConnected ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-surface"
                        }`}
                      >
                        <span className={`shrink-0 ${isGitHubConnected ? "text-emerald-500" : "text-foreground/70"}`}>
                          {source.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm">{source.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {isGitHubConnected ? "Active and monitored" : source.detail}
                          </div>
                        </div>
                        {isGitHubConnected ? (
                          <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-500 font-medium">
                            <ShieldCheck className="h-4 w-4" /> Connected
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleConnectGitHub()}
                            className="shrink-0 gap-1.5 h-8 text-xs font-mono"
                          >
                            <Plug className="h-3 w-3" /> Connect
                          </Button>
                        )}
                      </div>
                    );
                  }

                  return (
                    <button
                      key={source.id}
                      type="button"
                      onClick={() => toggleSource(source.id)}
                      className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                        selected ? "border-primary bg-primary/5" : "border-border bg-surface hover:bg-surface-2"
                      }`}
                    >
                      <span className={`shrink-0 ${selected ? "text-primary" : "text-foreground/70"}`}>
                        {source.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm flex items-center gap-1.5">
                          {source.name}
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground uppercase">
                            Pilot mock
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">{source.detail}</div>
                      </div>
                      {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Outcome output */}
          {step === 3 && (
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-primary">Strategic outcomes</div>
              <h2 className="mt-2 font-display text-2xl font-semibold">Select your first outcome.</h2>
              <p className="text-xs text-muted-foreground mt-1">Determine the primary deliverable Atlas will compile for you.</p>

              <div className="mt-6 grid gap-3">
                {outcomes.map((o) => {
                  const active = desiredOutcome === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setDesiredOutcome(o.id)}
                      className={`flex items-start gap-4 rounded-xl border p-4 text-left transition-all ${
                        active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-background hover:bg-muted/30"
                      }`}
                    >
                      <span className={`mt-0.5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}>
                        {o.icon}
                      </span>
                      <div>
                        <div className="font-semibold text-sm text-foreground">{o.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{o.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
            <Button variant="ghost" onClick={() => setStep((cur) => Math.max(cur - 1, 0))} disabled={step === 0 || saving}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {step < TOTAL_FORM_STEPS - 1 ? (
              <Button onClick={next} disabled={!canContinue} className="h-11 px-5">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={finish} disabled={saving || !canContinue} className="h-11 px-5">
                {saving ? "Generating Maps…" : "Initialize Workspace"} <ShieldCheck className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}