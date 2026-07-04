import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Globe, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

export default function PublicPagePreview() {
  const { user } = useAuth();
  const [handle, setHandle] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("handle, page_visibility").eq("id", user.id).maybeSingle()
      .then(({ data }) => { setHandle(data?.handle ?? null); setVisibility(data?.page_visibility ?? null); });
  }, [user]);

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Public page</h1>
      <p className="text-sm text-muted-foreground mt-1">Your evidence-backed founder credibility page.</p>

      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="font-mono text-sm">atlas.so/@{handle ?? "your-handle"}</div>
            <div className="text-xs text-muted-foreground mt-0.5 capitalize">{visibility ?? "unlisted"}</div>
          </div>
          {handle && (
            <Link to={`/@${handle}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              View <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
