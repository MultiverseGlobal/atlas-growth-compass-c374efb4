import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Plus, Map, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMaps } from "@/hooks/useMaps";
import { useAuth } from "@/hooks/useAuth";
import { canCreateMap } from "@/lib/planGate";
import { UpgradeModal } from "@/components/atlas/UpgradeModal";
import { loadStarterMap } from "@/lib/starterMap";
import { formatDistanceToNow } from "date-fns";

const confidenceColors = {
  starter: "text-muted-foreground border-border",
  emerging: "text-source border-source/40",
  established: "text-success border-success/40",
} as const;

export default function Home() {
  const { user } = useAuth();
  const { data: maps = [], isLoading, claimStarterMap } = useMaps();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const starterMap = loadStarterMap();
  const hasClaimedStarter = maps.length > 0;

  const handleNewMap = async () => {
    if (!user) return;
    const allowed = await canCreateMap(user.id);
    if (!allowed) {
      setShowUpgrade(true);
      return;
    }
    window.location.href = "/start";
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
          <Map className="h-3.5 w-3.5" /> Maps
        </div>
        <Button onClick={handleNewMap} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New map
        </Button>
      </div>
      <h1 className="mt-4 font-display text-4xl font-semibold leading-tight md:text-5xl">
        Your maps.
      </h1>

      <div className="mt-10 space-y-3">
        {/* Unclaimed starter map from localStorage */}
        {!hasClaimedStarter && starterMap && (
          <div className="group flex items-center justify-between gap-4 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Starter
                </span>
              </div>
              <p className="mt-2 truncate font-medium leading-snug">
                {starterMap.goalStatement}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleClaim}
              disabled={claiming}
              className="shrink-0"
            >
              {claiming ? "Saving…" : "Save to account"}
            </Button>
          </div>
        )}

        {/* Real maps from DB */}
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : maps.length === 0 && !starterMap ? (
          <EmptyState />
        ) : (
          maps.map((map) => (
            <div
              key={map.id}
              className="group flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/30"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${confidenceColors[map.confidence]}`}
                  >
                    {map.confidence}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(map.updated_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="mt-2 truncate font-medium leading-snug">
                  {map.goal_statement}
                </p>
              </div>
              <Link to={`/app/map/${map.id}`}>
                <Button size="sm" variant="ghost" className="shrink-0 gap-1">
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          ))
        )}
      </div>

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border p-12 text-center">
      <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="h-5 w-5 text-primary" />
      </div>
      <h3 className="font-display text-lg font-semibold">No maps yet</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        One sentence draws the first map.
      </p>
      <Link to="/start" className="mt-5 inline-block">
        <Button>Draw a map</Button>
      </Link>
    </div>
  );
}