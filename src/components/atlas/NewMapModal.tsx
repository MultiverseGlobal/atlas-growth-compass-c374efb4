import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Compass, Code2, Layout, TrendingUp, Briefcase, Rocket, Users, GitPullRequest, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface NewMapModalProps {
  open: boolean;
  onClose: () => void;
}

const examples = [
  "Get my first 10 customers for Calrio",
  "Ship the beta of my scheduling app by end of month",
  "Raise a $500k pre-seed round",
  "Hire a founding engineer",
];

const areas = [
  { id: "engineering", label: "Engineering & Dev", icon: <Code2 className="h-4 w-4" /> },
  { id: "product", label: "Product & UX", icon: <Layout className="h-4 w-4" /> },
  { id: "marketing", label: "Growth & Sales", icon: <TrendingUp className="h-4 w-4" /> },
  { id: "operations", label: "Operations & Finance", icon: <Briefcase className="h-4 w-4" /> },
];

const constraints = [
  { id: "velocity", label: "Shipping Velocity", icon: <Rocket className="h-4 w-4" /> },
  { id: "acquisition", label: "User Acquisition", icon: <Users className="h-4 w-4" /> },
  { id: "alignment", label: "Team Alignment", icon: <GitPullRequest className="h-4 w-4" /> },
  { id: "fundraising", label: "Fundraising & MRR", icon: <Coins className="h-4 w-4" /> },
];

function generateStarterWaypoints(
  mapId: string,
  userId: string,
  goalStatement: string,
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

export function NewMapModal({ open, onClose }: NewMapModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState("");
  const [operatingArea, setOperatingArea] = useState("engineering");
  const [primaryConstraint, setPrimaryConstraint] = useState("velocity");
  const [submitting, setSubmitting] = useState(false);

  const canContinue = goal.trim().length >= 4;

  const handleNext = () => {
    if (canContinue) setStep(2);
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleSubmit = async () => {
    if (!user || !canContinue) return;
    setSubmitting(true);
    try {
      // 1. Create the Map
      const { data: mapData, error: mapError } = await supabase
        .from("maps")
        .insert({
          user_id: user.id,
          goal_statement: goal.trim(),
          confidence: "starter",
          is_published: false,
        })
        .select("id")
        .single();

      if (mapError) throw mapError;

      if (mapData?.id) {
        // 2. Generate starter waypoints
        const starterWaypoints = generateStarterWaypoints(
          mapData.id,
          user.id,
          goal.trim(),
          primaryConstraint
        );
        const { error: wpError } = await supabase
          .from("waypoints")
          .insert(starterWaypoints);
        
        if (wpError) throw wpError;

        toast.success("Map created successfully!");
        onClose();
        navigate(`/app/map/${mapData.id}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create map");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setGoal("");
    setOperatingArea("engineering");
    setPrimaryConstraint("velocity");
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) { onClose(); handleReset(); } }}>
      <DialogContent className="max-w-md w-full bg-card p-6 rounded-[24px]">
        {step === 1 ? (
          <div className="space-y-4">
            <DialogHeader>
              <div className="flex items-center gap-2 eyebrow text-primary">
                <Compass className="h-3.5 w-3.5 animate-spin" /> Draw a new map
              </div>
              <DialogTitle className="font-display text-2xl font-semibold leading-tight text-foreground">
                What are you trying to do?
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                State your goal in one sentence. We will configure your strategy canvas.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Get my first 10 customers for Calrio"
                rows={3}
                className="w-full resize-none rounded-xl border border-border/80 bg-background/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground/60"
                autoFocus
              />

              <div className="space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60">Examples:</div>
                <div className="flex flex-wrap gap-1.5">
                  {examples.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setGoal(ex)}
                      className="rounded-full border border-border/60 bg-background/30 hover:border-primary/50 hover:bg-primary/5 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-all duration-150"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border/40">
              <Button onClick={handleNext} disabled={!canContinue} className="rounded-full px-5 h-10 gap-1 text-xs font-mono">
                Continue <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl font-semibold leading-tight text-foreground">
                Align operating focus
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                Help Atlas orient your strategy and bottleneck monitoring.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground/80">Primary operating area</label>
                <div className="grid grid-cols-2 gap-2">
                  {areas.map((a) => {
                    const active = operatingArea === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setOperatingArea(a.id)}
                        className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition-all duration-200 text-xs ${
                          active ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20" : "border-border/60 bg-background/30 hover:bg-muted/10 text-muted-foreground"
                        }`}
                      >
                        <span className={active ? "text-primary" : "text-muted-foreground/60"}>{a.icon}</span>
                        <span className="font-medium text-foreground">{a.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground/80">Main priority bottleneck</label>
                <div className="grid grid-cols-2 gap-2">
                  {constraints.map((c) => {
                    const active = primaryConstraint === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setPrimaryConstraint(c.id)}
                        className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition-all duration-200 text-xs ${
                          active ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20" : "border-border/60 bg-background/30 hover:bg-muted/10 text-muted-foreground"
                        }`}
                      >
                        <span className={active ? "text-primary" : "text-muted-foreground/60"}>{c.icon}</span>
                        <span className="font-medium text-foreground">{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-border/40">
              <Button variant="ghost" onClick={handleBack} disabled={submitting} className="rounded-full h-10 gap-1 text-xs font-mono text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <Button onClick={handleSubmit} disabled={submitting} className="rounded-full px-5 h-10 gap-1 text-xs font-mono bg-foreground text-background hover:bg-foreground/90">
                {submitting ? "Creating Map…" : "Draw strategy map"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
