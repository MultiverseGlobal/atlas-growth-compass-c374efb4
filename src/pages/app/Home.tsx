import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Plus, Target, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMaps } from "@/hooks/useMaps";
import { useAuth } from "@/hooks/useAuth";
import { canCreateMap } from "@/lib/planGate";
import { UpgradeModal } from "@/components/atlas/UpgradeModal";
import { loadStarterMap } from "@/lib/starterMap";
import { formatDistanceToNow } from "date-fns";

const confidenceMeta = {
  starter: {
    label: "Starter",
    dot: "bg-muted-foreground/40",
    badge: "text-muted-foreground border-border/50",
    bar: "w-1/6",
  },
  emerging: {
    label: "Emerging",
    dot: "bg-amber-400",
    badge: "text-amber-500 border-amber-500/30",
    bar: "w-2/5",
  },
  established: {
    label: "Established",
    dot: "bg-emerald-400",
    badge: "text-emerald-500 border-emerald-500/30",
    bar: "w-full",
  },
} as const;

export default function Home() {
  const { user } = useAuth();
  const { data: maps = [], isLoading, claimStarterMap } = useMaps();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const navigate = useNavigate();

  const starterMap = loadStarterMap();
  const hasClaimedStarter = maps.length > 0;

  const handleNewMap = async () => {
    if (!user) return;
    const allowed = await canCreateMap(user.id);
    if (!allowed) { setShowUpgrade(true); return; }
    navigate("/start");
  };

  const handleClaim = async () => {
    if (!starterMap) return;
    setClaiming(true);
    await claimStarterMap.mutateAsync(starterMap.goalStatement);
    setClaiming(false);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-primary">
          <Target className="h-3.5 w-3.5" /> Your maps
        </div>
        <Button onClick={handleNewMap} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New map
        </Button>
      </div>
      <h1 className="mt-3 font-display text-4xl font-semibold leading-tight md:text-5xl">
        Where are you<br className="hidden sm:block" /> trying to get?
      </h1>
      <p className="mt-3 text-[15px] text-muted-foreground">
        Each map is a goal. Atlas diagnoses what's blocking it.
      </p>

      <div className="mt-10 space-y-3">
        {/* Unclaimed starter from localStorage */}
        {!hasClaimedStarter && starterMap && (
          <div className="flex items-center justify-between gap-4 rounded-[16px] border border-dashed border-primary/40 bg-primary/5 px-5 py-5">
            <div className="min-w-0 flex-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
                Unsaved map
              </span>
              <p className="mt-1.5 font-medium leading-snug truncate">
                {starterMap.goalStatement}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={handleClaim} disabled={claiming} className="shrink-0">
              {claiming ? "Saving…" : "Save to account"}
            </Button>
          </div>
        )}

        {/* Real maps */}
        {isLoading ? (
          <CompassLoader />
        ) : maps.length === 0 && !starterMap ? (
          <EmptyState onNew={handleNewMap} />
        ) : (
          maps.map((map) => {
            const meta = confidenceMeta[map.confidence] ?? confidenceMeta.starter;
            return (
              <Link
                key={map.id}
                to={`/app/map/${map.id}`}
                className="group block rounded-[16px] border border-border bg-card px-5 py-5 transition-all duration-200 hover:border-primary/30 hover:shadow-sm relative overflow-hidden"
              >
                {/* Cartographic grid background on hover */}
                <div className="absolute inset-0 bg-grid-dots opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                <div className="relative z-10">
                  {/* Top row */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${meta.dot}`} />
                      <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${meta.badge}`}>
                        {meta.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(map.updated_at), { addSuffix: true })}
                      </span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>

                  {/* Goal */}
                  <p className="mt-3 font-medium leading-snug text-foreground">
                    {map.goal_statement}
                  </p>

                  {/* Confidence bar */}
                  <div className="mt-4 h-[2px] w-full rounded-full bg-border/60">
                    <div className={`h-full rounded-full bg-primary/50 transition-all duration-500 ${meta.bar}`} />
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="rounded-[20px] border border-dashed border-border bg-card/40 px-8 py-16 text-center">
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card">
        <Sparkles className="h-5 w-5 text-primary" />
      </div>
      <h3 className="font-display text-xl font-semibold">No maps yet</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">
        State a goal in one sentence. Atlas maps the constraint blocking it.
      </p>
      <Button onClick={onNew} className="mt-6">
        Draw your first map
      </Button>
    </div>
  );
}

export function CompassLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-14 space-y-3.5">
      <div className="relative">
        <div className="absolute inset-0 rounded-full border border-primary/20 scale-125" />
        <svg className="h-10 w-10 text-primary compass-spin relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" fill="currentColor" fillOpacity="0.25" />
          <line x1="12" y1="2" x2="12" y2="4" strokeLinecap="round" />
          <line x1="12" y1="20" x2="12" y2="22" strokeLinecap="round" />
          <line x1="2" y1="12" x2="4" y2="12" strokeLinecap="round" />
          <line x1="20" y1="12" x2="22" y2="12" strokeLinecap="round" />
        </svg>
      </div>
      <div className="text-[10px] font-mono tracking-widest text-muted-foreground/80 uppercase animate-pulse">
        Orienting maps…
      </div>
    </div>
  );
}