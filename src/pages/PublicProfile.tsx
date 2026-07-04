import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/atlas/Logo";
import { SourceBadge } from "@/components/atlas/SourceBadge";

export default function PublicProfile() {
  const { handle } = useParams();
  const clean = handle?.replace(/^@/, "");
  const [profile, setProfile] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!clean) return;
    supabase.from("profiles").select("display_name, handle, bio, page_visibility")
      .eq("handle", clean).maybeSingle()
      .then(({ data }) => {
        if (!data || data.page_visibility === "private") setNotFound(true);
        else setProfile(data);
      });
  }, [clean]);

  if (notFound) return (
    <div className="min-h-screen bg-background grain flex items-center justify-center">
      <div className="text-center">
        <div className="font-display text-2xl">This page isn't available.</div>
        <Link to="/" className="text-sm text-primary hover:underline mt-4 inline-block">← Back to Atlas</Link>
      </div>
    </div>
  );

  if (!profile) return <div className="min-h-screen bg-background" />;

  return (
    <div className="min-h-screen bg-background grain">
      <header className="container flex h-16 items-center justify-between">
        <Link to="/"><Logo /></Link>
        <Link to="/auth"><span className="text-sm text-muted-foreground hover:text-foreground">Get your own →</span></Link>
      </header>
      <main className="container max-w-2xl py-16">
        <div className="text-xs font-mono text-muted-foreground">atlas.so/@{profile.handle}</div>
        <h1 className="font-display text-4xl md:text-5xl font-semibold mt-2 tracking-tight">{profile.display_name}</h1>
        {profile.bio && <p className="mt-4 text-muted-foreground">{profile.bio}</p>}

        <div className="mt-12 rounded-xl border border-dashed border-border p-10 text-center bg-card/50">
          <div className="text-sm text-muted-foreground">
            Verified evidence timeline will appear here as {profile.display_name} ships work.
          </div>
          <div className="mt-4 flex justify-center gap-2">
            <SourceBadge provider="github" />
            <SourceBadge provider="stripe" />
            <SourceBadge provider="linear" />
            <SourceBadge provider="posthog" />
          </div>
        </div>
      </main>
    </div>
  );
}
