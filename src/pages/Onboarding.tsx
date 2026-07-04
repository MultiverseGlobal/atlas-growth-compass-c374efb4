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
  { id: "github", name: "GitHub", detail: "PRs, issues, releases" },
  { id: "stripe", name: "Stripe", detail: "Revenue and churn" },
  { id: "notion", name: "Notion", detail: "Docs and databases" },
  { id: "slack", name: "Slack", detail: "Team conversations" },
  { id: "manual", name: "Manual upload", detail: "Files and notes" },
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
                      className={`flex items-center justify-between rounded-lg border p-4 text-left transition-colors ${
                        selected ? "border-primary bg-primary/10" : "border-border bg-surface hover:bg-surface-2"
                      }`}
                    >
                      <div>
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