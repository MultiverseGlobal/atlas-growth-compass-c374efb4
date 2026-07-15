import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Plus, Target, Sparkles, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMaps } from "@/hooks/useMaps";
import { useAuth } from "@/hooks/useAuth";
import { canCreateMap } from "@/lib/planGate";
import { UpgradeModal } from "@/components/atlas/UpgradeModal";
import { loadStarterMap, clearStarterMap } from "@/lib/starterMap";
import { formatDistanceToNow } from "date-fns";
import { NewMapModal } from "@/components/atlas/NewMapModal";
import { supabase } from "@/integrations/supabase/client";

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
    badge: "text-amber-600 border-amber-400/40 bg-amber-400/10",
    bar: "w-2/5",
  },
  established: {
    label: "Established",
    dot: "bg-emerald-500",
    badge: "text-emerald-600 border-emerald-400/40 bg-emerald-400/10",
    bar: "w-full",
  },
} as const;

export default function Home() {
  const { user } = useAuth();
  const { data: maps = [], isLoading, claimStarterMap } = useMaps();
  const [showNewMapModal, setShowNewMapModal] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const navigate = useNavigate();

  const [trackRecord, setTrackRecord] = useState<{ held: number; total: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchTrackRecord = async () => {
      const { data } = await supabase
        .from("waypoints")
        .select("result_status")
        .eq("user_id", user.id)
        .in("result_status", ["held", "missed"]);
      
      if (data && data.length >= 3) {
        const total = data.length;
        const held = data.filter(w => w.result_status === "held").length;
        setTrackRecord({ held, total });
      }
    };
    fetchTrackRecord();
  }, [user]);

  const starterMap = loadStarterMap();
  const hasClaimedStarter = maps.length > 0;

  // If this user already has maps, any localStorage starter map is stale
  // (left over from a previous user's session on the same browser). Clear it.
  useEffect(() => {
    if (hasClaimedStarter) clearStarterMap();
  }, [hasClaimedStarter]);

  // Also clear when user identity changes (different account logged in)
  useEffect(() => {
    if (user?.id) clearStarterMap();
  }, [user?.id]);

  const handleNewMap = async () => {
    if (!user) return;
    const allowed = await canCreateMap(user.id);
    if (!allowed) { setShowUpgrade(true); return; }
    setShowNewMapModal(true);
  };

  const handleClaim = async () => {
    if (!starterMap) return;
    setClaiming(true);
    await claimStarterMap.mutateAsync({
      name: starterMap.goalStatement.slice(0, 60),
      goalStatement: starterMap.goalStatement,
    });
    setClaiming(false);
  };

  return (
    <div className="relative page-hero mx-auto max-w-2xl px-4 py-10 md:px-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 eyebrow text-primary">
          <Target className="h-3.5 w-3.5" /> Your maps
        </div>
        <Button
          onClick={handleNewMap}
          size="sm"
          className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" /> New map
        </Button>
      </div>

      <h1 className="mt-4 font-display text-3xl font-semibold leading-tight md:text-4xl">
        Where are you<br className="hidden sm:block" /> trying to get?
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Each map is a goal. Atlas diagnoses what's blocking it.
      </p>
      {trackRecord && (
        <p className="mt-1 text-xs text-muted-foreground/80">
          Right {trackRecord.held} of {trackRecord.total} times so far.
        </p>
      )}

      <div className="mt-10 space-y-3">
        {/* Unclaimed starter from localStorage */}
        {!hasClaimedStarter && starterMap && (
          <div className="flex items-center justify-between gap-4 rounded-[16px] border border-dashed border-primary/40 bg-primary/5 px-5 py-5">
            <div className="min-w-0 flex-1">
              <span className="eyebrow text-primary">
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
          maps.map((map, idx) => {
            const meta = confidenceMeta[map.confidence] ?? confidenceMeta.starter;
            return (
              <Link
                key={map.id}
                to={`/app/map/${map.id}`}
                className="group card-warm block px-5 py-5 relative overflow-hidden animate-slide-up opacity-0"
                style={{ animationDelay: `${idx * 80}ms` }}
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

                  {/* Name + Goal */}
                  <p className="mt-3 font-semibold leading-snug text-foreground">
                    {map.name || map.goal_statement}
                  </p>
                  {map.name && (
                    <p className="mt-1 text-xs text-muted-foreground leading-snug truncate">
                      {map.goal_statement}
                    </p>
                  )}

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
      <NewMapModal open={showNewMapModal} onClose={() => setShowNewMapModal(false)} />
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="rounded-[20px] border border-dashed border-border bg-card/40 px-8 py-16 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-primary">
        <Sparkles className="h-6 w-6" />
      </div>
      <h3 className="font-display text-xl font-semibold">No maps yet</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">
        State a goal in one sentence. Atlas maps the constraint blocking it.
      </p>
      <Button onClick={onNew} className="mt-6 gap-2 bg-primary hover:bg-primary/90">
        <Compass className="h-4 w-4" />
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