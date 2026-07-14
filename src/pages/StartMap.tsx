import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowRight, ArrowLeft, Check, Github, CreditCard, FileText, MessageSquare, Chrome, Sparkles } from "lucide-react";
import { Logo } from "@/components/atlas/Logo";
import { Button } from "@/components/ui/button";

// ── Goal category classification (keyword, no LLM) ──────────────────────────
type GoalCategory = "growth" | "engineering" | "fundraising" | "ops";

function classifyGoal(text: string): GoalCategory {
  const t = text.toLowerCase();
  if (/customer|user|signup|sign.?up|acquisition|churn|retention|revenue|mrr|arr|sales|traction|grow/.test(t))
    return "growth";
  if (/raise|seed|fund|investor|pitch|round|capital|deck/.test(t))
    return "fundraising";
  if (/ship|build|launch|feature|deploy|release|engineer|code|sprint|bug|product/.test(t))
    return "engineering";
  return "ops";
}

// ── Integration definitions ──────────────────────────────────────────────────
const INTEGRATIONS = [
  {
    id: "github",
    name: "GitHub",
    detail: "Commit velocity, PRs & releases",
    icon: <Github className="h-5 w-5" />,
    categories: ["engineering"],
  },
  {
    id: "stripe",
    name: "Stripe",
    detail: "Revenue, churn & MRR",
    icon: <CreditCard className="h-5 w-5" />,
    categories: ["growth", "fundraising"],
  },
  {
    id: "notion",
    name: "Notion",
    detail: "Docs, wikis & databases",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933z" />
      </svg>
    ),
    categories: ["ops", "fundraising"],
  },
  {
    id: "slack",
    name: "Slack",
    detail: "Team signals & conversations",
    icon: <MessageSquare className="h-5 w-5" />,
    categories: ["ops", "engineering"],
  },
  {
    id: "google",
    name: "Google Workspace",
    detail: "Docs, Sheets & Calendar",
    icon: <Chrome className="h-5 w-5" />,
    categories: ["ops", "fundraising", "growth"],
  },
];

const GOAL_EXAMPLES = [
  "Get my first 10 paying customers",
  "Ship the beta of my SaaS by end of month",
  "Raise a $500k pre-seed round",
  "Reduce churn below 3% this quarter",
];

const STEP_LABELS = ["Your name", "Your goal", "Your tools"];
const TOTAL_STEPS = 3;

// ── Animated example cycling ─────────────────────────────────────────────────
function useTypingExample(examples: string[]) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % examples.length);
        setVisible(true);
      }, 300);
    }, 3200);
    return () => clearInterval(id);
  }, [examples]);
  return { example: examples[idx], visible };
}

// ── Main component ────────────────────────────────────────────────────────────
export default function StartMap() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);

  // Step 1 — Name
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Step 2 — Goal
  const [goal, setGoal] = useState("");
  const [selectedExample, setSelectedExample] = useState<string | null>(null);
  const { example, visible } = useTypingExample(GOAL_EXAMPLES);

  // Step 3 — Integrations
  const [category, setCategory] = useState<GoalCategory>("engineering");
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>([]);

  // Derive recommended integrations from goal category
  const recommended = INTEGRATIONS.filter((i) => i.categories.includes(category));
  const others = INTEGRATIONS.filter((i) => !i.categories.includes(category));

  // Classify goal when moving to step 3
  useEffect(() => {
    if (step === 2 && goal.trim().length >= 4) {
      const cat = classifyGoal(goal);
      setCategory(cat);
      // Pre-select the recommended ones
      setSelectedIntegrations(recommended.map((i) => i.id).slice(0, 2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const toggleIntegration = (id: string) => {
    setSelectedIntegrations((cur) =>
      cur.includes(id) ? cur.filter((i) => i !== id) : [...cur, id]
    );
  };

  const canNext =
    step === 0 ? firstName.trim().length >= 2 :
    step === 1 ? goal.trim().length >= 8 :
    true; // step 2 — integrations optional

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      // Save setup intent and route to auth
      const setup = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        goal: goal.trim(),
        goalCategory: category,
        integrationIntents: selectedIntegrations,
      };
      try {
        sessionStorage.setItem("atlas.setup", JSON.stringify(setup));
        sessionStorage.setItem("atlas.auth.next", "/onboarding");
      } catch { /* non-critical */ }
      nav("/auth?mode=signup");
    }
  };

  const pickExample = (ex: string) => {
    setSelectedExample(ex);
    setGoal(ex);
  };

  const progress = ((step) / TOTAL_STEPS) * 100;

  return (
    <div className="min-h-screen bg-background grain page-fade flex flex-col">
      {/* Header */}
      <header className="container flex h-16 items-center justify-between border-b border-border/60">
        <Link to="/"><Logo /></Link>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Back
        </Link>
      </header>

      {/* Progress bar */}
      <div className="h-[2px] bg-border/50 w-full">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Ambient glow */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 select-none"
        style={{ background: "radial-gradient(ellipse 60% 50% at 50% 20%, hsla(37,72%,62%,0.10) 0%, transparent 65%)" }} />

      {/* Main content */}
      <main className="relative z-10 container flex flex-1 flex-col items-center justify-center py-16 max-w-lg mx-auto px-6">

        {/* Step indicators */}
        <div className="flex items-center gap-3 mb-10">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
                i < step ? "bg-primary text-primary-foreground" :
                i === step ? "bg-primary/15 border border-primary text-primary" :
                "bg-muted text-muted-foreground"
              }`}>
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:block transition-colors duration-300 ${
                i === step ? "text-foreground" : "text-muted-foreground"
              }`}>{label}</span>
              {i < STEP_LABELS.length - 1 && (
                <div className={`h-px w-8 transition-colors duration-500 ${i < step ? "bg-primary/50" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1 — Name */}
        {step === 0 && (
          <div className="w-full animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="eyebrow text-primary mb-3">Step 1 of 3</div>
            <h1 className="font-display text-3xl font-semibold leading-tight md:text-4xl">
              What's your name?
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Atlas will personalise your map and reports to you.
            </p>

            <div className="mt-8 space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">First name</label>
                <input
                  autoFocus
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && canNext) handleNext(); }}
                  placeholder="e.g. Alex"
                  className="w-full rounded-[12px] border border-border bg-card px-4 py-3 text-base outline-none transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-primary/15"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Last name <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && canNext) handleNext(); }}
                  placeholder="e.g. Johnson"
                  className="w-full rounded-[12px] border border-border bg-card px-4 py-3 text-base outline-none transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-primary/15"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Goal */}
        {step === 1 && (
          <div className="w-full animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="eyebrow text-primary mb-3">Step 2 of 3</div>
            <h1 className="font-display text-3xl font-semibold leading-tight md:text-4xl">
              What are you trying to achieve, {firstName}?
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              One sentence. Atlas will analyse it and build your map.
            </p>

            <div className="mt-8">
              <textarea
                autoFocus
                value={goal}
                onChange={(e) => { setGoal(e.target.value); setSelectedExample(null); }}
                placeholder={example}
                rows={3}
                className="w-full resize-none rounded-[14px] border border-border bg-card px-5 py-4 font-display text-lg leading-snug outline-none transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-primary/15"
                style={{
                  opacity: goal ? 1 : visible ? 1 : 0.7,
                  transition: "opacity 300ms ease",
                }}
              />

              {/* Example chips */}
              <div className="mt-4 flex flex-wrap gap-2">
                {GOAL_EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => pickExample(ex)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition-all duration-150 ${
                      selectedExample === ex
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {ex}
                  </button>
                ))}
              </div>

              {/* Analysis preview */}
              {goal.trim().length >= 8 && (
                <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 animate-in fade-in duration-300">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    <span className="font-medium text-foreground">Atlas detected: </span>
                    {classifyGoal(goal) === "growth" && "Growth & customer focus. Stripe + analytics signals will be most valuable."}
                    {classifyGoal(goal) === "engineering" && "Engineering & shipping focus. GitHub commit signals will be most valuable."}
                    {classifyGoal(goal) === "fundraising" && "Fundraising focus. MRR metrics and traction data will be most valuable."}
                    {classifyGoal(goal) === "ops" && "Operations focus. Notion docs and Slack signals will be most valuable."}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3 — Integrations */}
        {step === 2 && (
          <div className="w-full animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="eyebrow text-primary mb-3">Step 3 of 3</div>
            <h1 className="font-display text-3xl font-semibold leading-tight md:text-4xl">
              Which tools do you use?
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              You'll connect them after signup. Atlas will use their signals to diagnose your map.
            </p>

            <div className="mt-8 space-y-3">
              {/* Recommended */}
              {recommended.length > 0 && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Recommended for your goal</p>
                  {recommended.map((integration) => {
                    const checked = selectedIntegrations.includes(integration.id);
                    return (
                      <button
                        key={integration.id}
                        type="button"
                        onClick={() => toggleIntegration(integration.id)}
                        className={`flex w-full items-center gap-4 rounded-[14px] border p-4 text-left transition-all duration-150 ${
                          checked
                            ? "border-primary/50 bg-primary/8 shadow-sm"
                            : "border-border bg-card hover:border-border/80 hover:bg-card/80"
                        }`}
                      >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          checked ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                        }`}>
                          {integration.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{integration.name}</span>
                            <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600">Best match</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{integration.detail}</p>
                        </div>
                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 ${
                          checked ? "border-primary bg-primary" : "border-border"
                        }`}>
                          {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                      </button>
                    );
                  })}
                </>
              )}

              {/* Others */}
              {others.length > 0 && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mt-5">Other tools</p>
                  {others.map((integration) => {
                    const checked = selectedIntegrations.includes(integration.id);
                    return (
                      <button
                        key={integration.id}
                        type="button"
                        onClick={() => toggleIntegration(integration.id)}
                        className={`flex w-full items-center gap-4 rounded-[14px] border p-4 text-left transition-all duration-150 ${
                          checked
                            ? "border-primary/50 bg-primary/8 shadow-sm"
                            : "border-border bg-card hover:border-border/80"
                        }`}
                      >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          checked ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                        }`}>
                          {integration.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold">{integration.name}</span>
                          <p className="text-xs text-muted-foreground mt-0.5">{integration.detail}</p>
                        </div>
                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 ${
                          checked ? "border-primary bg-primary" : "border-border"
                        }`}>
                          {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                      </button>
                    );
                  })}
                </>
              )}

              <p className="text-xs text-muted-foreground text-center pt-2">
                No tools yet? No problem — you can connect them later.
              </p>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-10 flex w-full items-center justify-between gap-4">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          ) : (
            <div />
          )}
          <Button
            onClick={handleNext}
            disabled={!canNext}
            size="lg"
            className="h-12 min-w-[160px] px-8 gap-2"
          >
            {step < TOTAL_STEPS - 1 ? (
              <>Continue <ArrowRight className="h-4 w-4" /></>
            ) : (
              <>Build my map <ArrowRight className="h-4 w-4" /></>
            )}
          </Button>
        </div>

        {/* Sign in link */}
        {step === 0 && (
          <p className="mt-8 text-sm text-muted-foreground text-center">
            Already have an account?{" "}
            <Link to="/auth?mode=signin" className="text-primary hover:underline font-medium">Sign in</Link>
          </p>
        )}
      </main>
    </div>
  );
}
