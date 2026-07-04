import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/atlas/Logo";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight } from "lucide-react";

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
  waypoints: Array<{
    kind: string;
    title: string;
    confidence: string;
  }>;
};

const confidenceMeta = {
  starter:     { label: "Starter",     dot: "bg-muted-foreground/40", badge: "text-muted-foreground border-border/50" },
  emerging:    { label: "Emerging",    dot: "bg-amber-400",            badge: "text-amber-500 border-amber-500/30" },
  established: { label: "Established", dot: "bg-emerald-400",          badge: "text-emerald-500 border-emerald-500/30" },
} as const;

const kindLabel: Record<string, string> = {
  goal: "Goal",
  constraint: "Constraint",
  evidence: "Evidence",
  move: "Next move",
};

function MapCard({ map }: { map: PublishedMap }) {
  const meta = confidenceMeta[map.confidence] ?? confidenceMeta.starter;
  const constraint = map.waypoints.find(w => w.kind === "constraint");
  const move = map.waypoints.find(w => w.kind === "move");

  return (
    <div className="rounded-[20px] border border-border bg-card overflow-hidden">
      {/* Card header */}
      <div className="px-6 pt-6 pb-4 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <span className={`h-2 w-2 rounded-full shrink-0 ${meta.dot}`} />
          <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${meta.badge}`}>
            {meta.label}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(map.updated_at), { addSuffix: true })}
          </span>
        </div>
        <h3 className="mt-3 font-display text-xl font-semibold leading-snug">
          {map.goal_statement}
        </h3>
      </div>

      {/* Waypoints — show constraint + move only */}
      <div className="divide-y divide-border/50">
        {[constraint, move].filter(Boolean).map((wp, i) => wp && (
          <div key={i} className="px-6 py-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {kindLabel[wp.kind] ?? wp.kind}
            </div>
            <p className="mt-1 text-sm text-foreground/90 leading-relaxed">{wp.title}</p>
          </div>
        ))}
      </div>
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
      // 1. Load profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("display_name, handle, bio, page_visibility")
        .eq("handle", clean)
        .maybeSingle();

      if (!profileData || profileData.page_visibility === "private") {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProfile(profileData as Profile);

      // 2. Load published maps for this user
      const { data: profileUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("handle", clean)
        .maybeSingle();

      if (!profileUser) { setNotFound(true); setLoading(false); return; }

      const { data: mapsData } = await supabase
        .from("maps")
        .select("id, goal_statement, confidence, updated_at")
        .eq("user_id", profileUser.id)
        .eq("is_published", true)
        .order("updated_at", { ascending: false })
        .limit(10);

      // 3. Load waypoints for each map
      const enriched: PublishedMap[] = await Promise.all(
        (mapsData ?? []).map(async (m) => {
          const { data: wps } = await supabase
            .from("waypoints")
            .select("kind, title, confidence")
            .eq("map_id", m.id)
            .order("position", { ascending: true });
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
        <p className="mt-3 text-sm text-muted-foreground">
          This profile is private, or the handle doesn't exist.
        </p>
        <Link to="/" className="mt-5 inline-flex items-center gap-1 text-sm text-primary hover:underline">
          ← Back to Atlas
        </Link>
      </div>
    </div>
  );

  if (!profile || loading) return (
    <div className="min-h-screen bg-background grain">
      <div className="container flex h-16 items-center border-b border-border/60">
        <div className="h-5 w-20 animate-pulse rounded bg-border" />
      </div>
      <div className="container max-w-2xl py-16 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 animate-pulse rounded-[20px] bg-card border border-border" />
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background grain">
      <header className="container flex h-16 items-center justify-between border-b border-border/60">
        <Link to="/"><Logo /></Link>
        <Link to="/auth">
          <span className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Get your own map →
          </span>
        </Link>
      </header>

      <main className="container max-w-2xl py-14 md:py-20">
        {/* Profile identity */}
        <div className="text-xs font-mono text-muted-foreground">atlas.so/@{profile.handle}</div>
        <h1 className="mt-2 font-display text-4xl md:text-5xl font-semibold tracking-tight leading-tight">
          {profile.display_name}
        </h1>
        {profile.bio && (
          <p className="mt-4 text-[15px] text-muted-foreground leading-relaxed">{profile.bio}</p>
        )}

        {/* Maps */}
        <div className="mt-14">
          {maps.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-border bg-card/40 px-8 py-14 text-center">
              <p className="text-sm text-muted-foreground">
                {profile.display_name} hasn't published any maps yet.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-6">
                {maps.length} published {maps.length === 1 ? "map" : "maps"}
              </div>
              {maps.map(map => (
                <MapCard key={map.id} map={map} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-16 border-t border-border/60 pt-8 flex items-center justify-between">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Built with Atlas
          </Link>
          <Link to="/auth" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            Map your own goal <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </main>
    </div>
  );
}
