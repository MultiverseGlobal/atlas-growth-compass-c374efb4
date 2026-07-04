import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SourceBadge } from "@/components/atlas/SourceBadge";
import { formatDistanceToNow } from "date-fns";
import { Sparkles } from "lucide-react";

type EventRow = {
  id: string;
  provider: "github" | "stripe" | "linear" | "posthog" | null;
  event_type: string;
  occurred_at: string;
  title: string;
  summary: string | null;
  source_url: string | null;
  is_high_signal: boolean;
};

export default function Timeline() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("events").select("id,provider,event_type,occurred_at,title,summary,source_url,is_high_signal")
      .eq("user_id", user.id).order("occurred_at", { ascending: false }).limit(100)
      .then(({ data }) => { setEvents(data ?? []); setLoading(false); });
  }, [user]);

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Timeline</h1>
        </div>
      </div>

      <div className="mt-10">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : events.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="relative border-l border-border/70 ml-2 space-y-6">
            {events.map((e) => (
              <li key={e.id} className="pl-6 relative">
                <span className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ${e.is_high_signal ? "bg-primary" : "bg-muted-foreground/40"}`} />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {e.provider && <SourceBadge provider={e.provider} href={e.source_url ?? undefined} />}
                  <span>{formatDistanceToNow(new Date(e.occurred_at), { addSuffix: true })}</span>
                </div>
                <div className="mt-1.5 font-medium">{e.title}</div>
                {e.summary && <p className="mt-1 text-sm text-muted-foreground">{e.summary}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center bg-card/50">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 mb-4">
        <Sparkles className="h-5 w-5 text-primary" />
      </div>
      <h3 className="font-display text-lg font-semibold">Your ledger is empty</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
        Connect GitHub, Stripe, Linear or PostHog on the Integrations tab. Atlas will backfill the last 90 days automatically.
      </p>
    </div>
  );
}
