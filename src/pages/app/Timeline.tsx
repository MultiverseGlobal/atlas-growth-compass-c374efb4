import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { Github, ExternalLink, Activity } from "lucide-react";

type SignalRow = {
  id: string;
  title: string;
  score: number | null;
  occurred_at: string;
  payload: Record<string, any> | null;
  maps: { goal_statement: string; id: string } | null;
};

type WaypointRow = {
  id: string;
  kind: string;
  title: string;
  confidence: string;
  created_at: string;
  maps: { goal_statement: string; id: string } | null;
};

type FeedItem =
  | { type: "signal"; data: SignalRow; ts: string }
  | { type: "diagnosis"; data: WaypointRow; ts: string };

const PROVIDER_ICON: Record<string, React.ReactNode> = {
  github: <Github className="h-3.5 w-3.5" />,
};

function SignalItem({ data }: { data: SignalRow }) {
  const isNote = data.title === "__manual_note";
  const noteText = isNote && data.payload?.note ? data.payload.note as string : null;

  return (
    <div className="pl-6 relative">
      <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-muted-foreground/30 border-2 border-background" />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="text-foreground/60">{PROVIDER_ICON["github"] ?? <Activity className="h-3.5 w-3.5" />}</span>
        <span>Signal · {formatDistanceToNow(new Date(data.occurred_at), { addSuffix: true })}</span>
      </div>
      <p className="mt-1 text-sm font-medium text-foreground/90">
        {isNote ? `Context added: "${noteText?.slice(0, 80)}${(noteText?.length ?? 0) > 80 ? "…" : ""}"` : data.title}
      </p>
      {data.maps && (
        <Link to={`/app/map/${data.maps.id}`} className="mt-0.5 inline-block text-xs text-muted-foreground hover:text-primary">
          ↳ {data.maps.goal_statement.slice(0, 60)}{data.maps.goal_statement.length > 60 ? "…" : ""}
        </Link>
      )}
    </div>
  );
}

function DiagnosisItem({ data }: { data: WaypointRow }) {
  if (data.kind !== "constraint") return null;
  return (
    <div className="pl-6 relative">
      <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary/70 border-2 border-background" />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono uppercase tracking-widest text-primary text-[10px]">Diagnosis</span>
        <span>· {formatDistanceToNow(new Date(data.created_at), { addSuffix: true })}</span>
      </div>
      <p className="mt-1 text-sm font-medium text-foreground/90">{data.title}</p>
      {data.maps && (
        <Link to={`/app/map/${data.maps.id}`} className="mt-0.5 inline-block text-xs text-muted-foreground hover:text-primary">
          ↳ {data.maps.goal_statement.slice(0, 60)}{data.maps.goal_statement.length > 60 ? "…" : ""}
        </Link>
      )}
    </div>
  );
}

export default function Timeline() {
  const { user } = useAuth();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [signalsRes, waypointsRes] = await Promise.all([
        supabase
          .from("signals")
          .select("id, title, score, occurred_at, payload, maps(id, goal_statement)")
          .eq("user_id", user.id)
          .order("occurred_at", { ascending: false })
          .limit(60),
        supabase
          .from("waypoints")
          .select("id, kind, title, confidence, created_at, maps(id, goal_statement)")
          .eq("user_id", user.id)
          .eq("kind", "constraint")
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

      const signals: FeedItem[] = (signalsRes.data ?? []).map(s => ({
        type: "signal" as const,
        data: s as any,
        ts: s.occurred_at,
      }));

      const diagnoses: FeedItem[] = (waypointsRes.data ?? []).map(w => ({
        type: "diagnosis" as const,
        data: w as any,
        ts: w.created_at,
      }));

      const merged = [...signals, ...diagnoses].sort((a, b) =>
        new Date(b.ts).getTime() - new Date(a.ts).getTime()
      );

      setFeed(merged);
      setLoading(false);
    })();
  }, [user]);

  // Group by date
  const grouped: Record<string, FeedItem[]> = {};
  feed.forEach(item => {
    const date = new Date(item.ts).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(item);
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">
      <div className="text-xs font-mono uppercase tracking-widest text-primary">Activity</div>
      <h1 className="mt-2 font-display text-4xl font-semibold leading-tight md:text-5xl">Timeline</h1>
      <p className="mt-3 text-[15px] text-muted-foreground">
        A chronological record of every signal Atlas has read and every diagnosis it has made.
      </p>

      <div className="mt-10">
        {loading ? (
          <div className="space-y-6">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-card border border-border" />
            ))}
          </div>
        ) : feed.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([date, items]) => (
              <div key={date}>
                <div className="mb-4 text-xs font-mono text-muted-foreground/60 uppercase tracking-widest">
                  {date}
                </div>
                <ul className="relative border-l border-border/50 ml-2 space-y-5">
                  {items.map((item, i) => (
                    <li key={i}>
                      {item.type === "signal"
                        ? <SignalItem data={item.data as SignalRow} />
                        : <DiagnosisItem data={item.data as WaypointRow} />}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[20px] border border-dashed border-border bg-card/40 px-8 py-16 text-center">
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card">
        <Activity className="h-5 w-5 text-primary" />
      </div>
      <h3 className="font-display text-xl font-semibold">Nothing here yet</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
        Connect GitHub on the Integrations tab, then sync a map. Every signal and diagnosis appears here.
      </p>
    </div>
  );
}
