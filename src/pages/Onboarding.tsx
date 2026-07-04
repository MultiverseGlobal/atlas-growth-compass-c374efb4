import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { loadStarterMap } from "@/lib/starterMap";

const steps = ["Public page", "Data sources", "Done"];

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
    id: "manual", name: "Manual upload", detail: "Files and notes",
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

export default function Onboarding() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>(["github"]);
  const [saving, setSaving] = useState(false);

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
    step === 1 ? selectedSources.length > 0 : true;

  const toggleSource = (id: string) => {
    setSelectedSources((cur) => cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id]);
  };

  const next = () => {
    if (step === 0 && !validHandle) {
      toast.error("Handle must be 3–20 chars: a-z, 0-9, _");
      return;
    }
    if (!canContinue) return;
    setStep((cur) => Math.min(cur + 1, steps.length - 1));
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
      toast.error(profileError.message);
      setSaving(false);
      return;
    }

    // Claim starter map if one exists in localStorage
    const starterMap = loadStarterMap();
    if (starterMap) {
      await supabase.from("maps").insert({
        user_id: user.id,
        goal_statement: starterMap.goalStatement,
        confidence: "starter",
        is_published: false,
      });
      try {
        localStorage.removeItem("atlas.starter");
        localStorage.removeItem("atlas.setup");
      } catch { /* non-critical */ }
    }

    setSaving(false);
    toast.success("You're in");
    nav("/app", { replace: true });
  };

  if (loading || !user) return <div className="min-h-screen bg-background" />;

  return (
    <div className="min-h-screen bg-background grain">
      <header className="container flex h-16 items-center justify-between border-b border-border/60">
        <Logo />
        <div className="hidden text-xs font-mono uppercase text-muted-foreground sm:block">Setup</div>
      </header>

      <main className="container max-w-lg py-12 md:py-20">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((label, index) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-mono ${
                index < step ? "bg-primary text-primary-foreground" :
                index === step ? "border-2 border-primary text-primary" :
                "border border-border text-muted-foreground"
              }`}>
                {index < step ? <Check className="h-3 w-3" /> : index + 1}
              </div>
              <span className={`text-sm ${index === step ? "text-foreground" : "text-muted-foreground"}`}>
                {label}
              </span>
              {index < steps.length - 1 && (
                <div className={`h-px w-6 ${index < step ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-border bg-card p-6 md:p-8">
          {step === 0 && (
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-primary">Public identity</div>
              <h2 className="mt-2 font-display text-2xl font-semibold">Set your public handle.</h2>
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

          {step === 1 && (
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-primary">Integrations</div>
              <h2 className="mt-2 font-display text-2xl font-semibold">What will you connect?</h2>
              <div className="mt-7 grid gap-2">
                {sources.map((source) => {
                  const selected = selectedSources.includes(source.id);
                  return (
                    <button
                      key={source.id}
                      type="button"
                      onClick={() => toggleSource(source.id)}
                      className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                        selected ? "border-primary bg-primary/10" : "border-border bg-surface hover:bg-surface-2"
                      }`}
                    >
                      <span className={`shrink-0 ${selected ? "text-primary" : "text-foreground/70"}`}>
                        {source.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{source.name}</div>
                        <div className="text-xs text-muted-foreground">{source.detail}</div>
                      </div>
                      {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-primary">Ready</div>
              <h2 className="mt-2 font-display text-2xl font-semibold">Your maps workspace is ready.</h2>
              {loadStarterMap() && (
                <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <div className="text-xs font-mono uppercase tracking-widest text-primary mb-1">Starter map detected</div>
                  <p className="text-sm font-medium truncate">{loadStarterMap()?.goalStatement}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Will be saved to your account.</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
            <Button variant="ghost" onClick={() => setStep((cur) => Math.max(cur - 1, 0))} disabled={step === 0 || saving}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {step < steps.length - 1 ? (
              <Button onClick={next} disabled={!canContinue} className="h-11">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={finish} disabled={saving} className="h-11">
                Open Maps <ShieldCheck className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}