import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/atlas/Logo";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Radio, AlertTriangle } from "lucide-react";

type Profile = {
  display_name: string;
  handle: string;
  bio: string | null;
  page_visibility: string;
};

type PublishedMap = {
  id: string;
  goal_statement: string;
  confidence: "starter" | "emerging" | "established";
  updated_at: string;
  waypoints: Array<{ kind: string; title: string; confidence: string }>;
};

const confidenceMeta = {
  starter:     { label: "Starter",     bar: "w-1/4",  color: "bg-muted-foreground/30" },
  emerging:    { label: "Emerging",    bar: "w-1/2",  color: "bg-amber-400" },
  established: { label: "Established", bar: "w-3/4",  color: "bg-emerald-400" },
} as const;

function MapCard({ map }: { map: PublishedMap }) {
  const meta = confidenceMeta[map.confidence] ?? confidenceMeta.starter;
  const constraint = map.waypoints.find(w => w.kind === "constraint");
  const move = map.waypoints.find(w => w.kind === "move");
  const goal = map.waypoints.find(w => w.kind === "goal");

  return (
    <div className="rounded-[20px] border border-border bg-card overflow-hidden lift">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-border/50">
        <div className="flex items-center justify-between gap-3 mb-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
            {formatDistanceToNow(new Date(map.updated_at), { addSuffix: true })}
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
            <span className={`h-1.5 w-1.5 rounded-full ${meta.color}`} />
            {meta.label}
          </span>
        </div>
        <h3 className="font-display text-xl font-semibold leading-snug text-foreground">
          {goal?.title ?? map.goal_statement}
        </h3>
        {/* Confidence bar */}
        <div className="mt-3 h-1 w-full rounded-full bg-border/60 overflow-hidden">
          <div className={`h-full rounded-full ${meta.bar} ${meta.color} transition-all`} />
        </div>
      </div>

      {/* Constraint — alert treatment */}
      {constraint && (
        <div className="px-6 py-4 border-b border-border/40 bg-destructive/5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertTriangle className="h-3 w-3 text-destructive/70" />
            <span className="font-mono text-[9px] uppercase tracking-widest text-destructive/70 font-medium">Constraint</span>
          </div>
          <p className="text-[13px] text-foreground/85 leading-snug font-medium">{constraint.title}</p>
        </div>
      )}

      {/* Move */}
      {move && (
        <div className="px-6 py-4">
          <div className="font-mono text-[9px] uppercase tracking-widest text-primary/70 font-medium mb-1.5">Next move</div>
          <p className="text-[13px] text-foreground/80 leading-snug">{move.title}</p>
        </div>
      )}
    </div>
  );
}

export default function PublicProfile() {
  const { handle } = useParams();
  const clean = handle?.replace(/^@/, "");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [maps, setMaps] = useState<PublishedMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!clean) return;
    (async () => {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("display_name, handle, bio, page_visibility")
        .eq("handle", clean)
        .maybeSingle();

      if (!profileData || profileData.page_visibility === "private") {
        setNotFound(true); setLoading(false); return;
      }
      setProfile(profileData as Profile);

      const { data: profileUser } = await supabase
        .from("profiles").select("id").eq("handle", clean).maybeSingle();
      if (!profileUser) { setNotFound(true); setLoading(false); return; }

      const { data: mapsData } = await supabase
        .from("maps")
        .select("id, goal_statement, confidence, updated_at")
        .eq("user_id", profileUser.id)
        .eq("is_published", true)
        .order("updated_at", { ascending: false })
        .limit(10);

      const enriched: PublishedMap[] = await Promise.all(
        (mapsData ?? []).map(async (m) => {
          const { data: wps } = await supabase
            .from("waypoints").select("kind, title, confidence")
            .eq("map_id", m.id).order("position", { ascending: true });
          return { ...m, confidence: m.confidence as any, waypoints: wps ?? [] };
        })
      );
      setMaps(enriched);
      setLoading(false);
    })();
  }, [clean]);

  if (notFound) return (
    <div className="min-h-screen bg-background grain flex items-center justify-center">
      <div className="text-center px-6">
        <div className="font-display text-3xl">This page isn't available.</div>
        <p className="mt-3 text-sm text-muted-foreground">This profile is private or doesn't exist.</p>
        <Link to="/" className="mt-5 inline-flex items-center gap-1 text-sm text-primary hover:underline">← Back to Atlas</Link>
      </div>
    </div>
  );

  if (!profile || loading) return (
    <div className="min-h-screen bg-background grain">
      <div className="container flex h-16 items-center border-b border-border/60">
        <div className="h-5 w-20 animate-pulse rounded bg-border" />
      </div>
      <div className="container max-w-2xl py-16 space-y-4">
        {[1,2,3].map(i => <div key={i} className="h-40 animate-pulse rounded-[20px] bg-card border border-border" />)}
      </div>
    </div>
  );

  // Dominant constraint = constraint from the most recently-updated map
  const dominantConstraint = maps
    .flatMap(m => m.waypoints.filter(w => w.kind === "constraint"))
    .at(0);

  return (
    <div className="min-h-screen bg-background grain">
      {/* Nav */}
      <header className="container flex h-16 items-center justify-between border-b border-border/60">
        <Link to="/"><Logo /></Link>
        <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Get your own map →
        </Link>
      </header>

      <main className="container max-w-2xl py-14 md:py-20">
        {/* Identity */}
        <div className="font-mono text-xs text-muted-foreground/60">@{profile.handle}</div>
        <h1 className="mt-2 font-display text-4xl md:text-5xl font-semibold tracking-tight leading-tight">
          {profile.display_name}
        </h1>
        {profile.bio && (
          <p className="mt-4 text-[15px] text-muted-foreground leading-relaxed max-w-sm">{profile.bio}</p>
        )}

        {/* Live indicator */}
        <div className="mt-5 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <Radio className="h-2 w-2 text-primary animate-pulse absolute" />
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            Actively navigating <strong className="text-foreground">{maps.length}</strong> {maps.length === 1 ? "goal" : "goals"}
          </span>
        </div>

        {/* Dominant constraint hero */}
        {dominantConstraint && (
          <div className="mt-10 rounded-[18px] border border-destructive/25 bg-destructive/5 px-6 py-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive/70" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-destructive/70 font-semibold">Current dominant constraint</span>
            </div>
            <p className="text-[17px] font-semibold text-foreground leading-snug">{dominantConstraint.title}</p>
          </div>
        )}

        {/* Maps */}
        <div className="mt-14">
          {maps.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-border bg-card/40 px-8 py-14 text-center">
              <p className="text-sm text-muted-foreground">{profile.display_name} hasn't published any maps yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-6">
                {maps.length} published {maps.length === 1 ? "map" : "maps"}
              </div>
              {maps.map(map => <MapCard key={map.id} map={map} />)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-16 border-t border-border/60 pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Built with Atlas — Founder Intelligence
            </Link>
            <p className="mt-1 text-[11px] text-muted-foreground/50">
              Atlas finds the dominant constraint in any startup.
            </p>
          </div>
          <Link to="/auth" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
            Map your own goal <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </main>
    </div>
  );
}
