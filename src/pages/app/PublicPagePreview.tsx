import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Globe, ExternalLink, Shield, ShieldOff, Eye, EyeOff, Radio } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

type Profile = {
  handle: string | null;
  page_visibility: "public" | "unlisted" | "private";
  display_name: string | null;
};

type MapItem = {
  id: string;
  goal_statement: string;
  confidence: string;
  is_published: boolean;
};

export default function PublicPagePreview() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [maps, setMaps] = useState<MapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [savingVisibility, setSavingVisibility] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Load profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("handle, page_visibility, display_name")
        .eq("id", user?.id)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData as Profile);
      }

      // Load all maps
      const { data: mapsData } = await supabase
        .from("maps")
        .select("id, goal_statement, confidence, is_published")
        .eq("user_id", user?.id)
        .order("updated_at", { ascending: false });

      if (mapsData) {
        setMaps(mapsData as MapItem[]);
      }
    } catch (err: any) {
      toast.error(err.message ?? "Failed to load page data");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMapPublish = async (mapId: string, currentPublished: boolean) => {
    setUpdating(mapId);
    try {
      const nextPublished = !currentPublished;
      const { error } = await supabase
        .from("maps")
        .update({ is_published: nextPublished })
        .eq("id", mapId);

      if (error) throw error;

      setMaps(prev =>
        prev.map(m => (m.id === mapId ? { ...m, is_published: nextPublished } : m))
      );
      toast.success(nextPublished ? "Map published to public page" : "Map made private");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdating(null);
    }
  };

  const handleChangeVisibility = async (val: "public" | "unlisted" | "private") => {
    if (!profile) return;
    setSavingVisibility(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ page_visibility: val })
        .eq("id", user?.id);

      if (error) throw error;

      setProfile(p => p ? { ...p, page_visibility: val } : null);
      toast.success(`Page visibility set to ${val}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingVisibility(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-8 space-y-6">
        <div className="h-8 w-44 animate-pulse rounded bg-border" />
        <div className="h-[108px] animate-pulse rounded-[16px] bg-card border border-border" />
        <div className="h-44 animate-pulse rounded-[16px] bg-card border border-border" />
      </div>
    );
  }

  const isPublicPageActive = profile?.page_visibility !== "private";
  const hasPublishedMaps = maps.some(m => m.is_published);

  return (
    <div className="relative page-hero mx-auto max-w-3xl px-4 py-10 md:px-8">
      {/* Header */}
      <div className="eyebrow text-primary">Preview</div>
      <h1 className="mt-3 font-display text-4xl font-semibold leading-tight md:text-5xl">
        Public page
      </h1>
      <p className="mt-3 text-[15px] text-muted-foreground max-w-xl">
        Share your journey. Your public page showcases published maps and updates to teammates, investors, or the public.
      </p>

      {/* Main card - Status & URL */}
      <div className="mt-10 card-warm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 ${
              isPublicPageActive ? "bg-primary/10 text-primary" : "bg-muted-foreground/10 text-muted-foreground"
            }`}>
              {isPublicPageActive ? <Globe className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </div>
            <div>
              <div className="font-mono text-sm font-medium">
                {profile?.handle ? `atlas.so/@${profile.handle}` : "No public handle set"}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground capitalize">
                <span>Page visibility: {profile?.page_visibility}</span>
                <span>·</span>
                <span>{hasPublishedMaps ? `${maps.filter(m => m.is_published).length} maps live` : "0 maps live"}</span>
              </div>
            </div>
          </div>

          {profile?.handle && isPublicPageActive && (
            <Link to={`/@${profile.handle}`} target="_blank">
              <Button size="sm" className="w-full sm:w-auto gap-1.5">
                View live <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Visibility control */}
      <div className="mt-6 card-warm p-6 space-y-4">
        <div className="eyebrow text-primary/80">
          Page visibility
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              v: "public",
              title: "Public",
              desc: "Visible to anyone, indexed by search engines.",
              icon: <Globe className="h-4 w-4 text-primary" />,
            },
            {
              v: "unlisted",
              title: "Unlisted",
              desc: "Only people with the link can view it.",
              icon: <Eye className="h-4 w-4 text-primary" />,
            },
            {
              v: "private",
              title: "Private",
              desc: "Disabled. Completely inaccessible to others.",
              icon: <EyeOff className="h-4 w-4 text-muted-foreground" />,
            },
          ].map(opt => {
            const selected = profile?.page_visibility === opt.v;
            return (
              <button
                key={opt.v}
                type="button"
                onClick={() => handleChangeVisibility(opt.v as any)}
                disabled={savingVisibility}
                className={`flex flex-col text-left rounded-xl border p-4 transition-all duration-200 ${
                  selected
                    ? "border-primary/40 bg-primary/8 shadow-sm shadow-primary/10"
                    : "border-border hover:border-primary/20 hover:bg-primary/3"
                }`}
              >
                <span className="flex items-center gap-2 font-medium text-sm">
                  {opt.icon}
                  {opt.title}
                </span>
                <span className="mt-1.5 text-xs text-muted-foreground leading-normal">
                  {opt.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Published maps list */}
      <div className="mt-6 card-warm p-6 space-y-5">
        <div>
          <div className="eyebrow text-primary/80">
            Published Maps
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose which goal maps are published on your profile page. Only published maps will be visible to external viewers.
          </p>
        </div>

        {maps.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No maps created yet. Draw a map to publish it.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {maps.map(m => (
              <div key={m.id} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      {m.confidence}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium leading-snug truncate">
                    {m.goal_statement}
                  </p>
                </div>

                <Button
                  size="sm"
                  variant={m.is_published ? "outline" : "default"}
                  onClick={() => handleToggleMapPublish(m.id, m.is_published)}
                  disabled={updating === m.id || !isPublicPageActive}
                  className="shrink-0"
                >
                  {updating === m.id
                    ? "Updating…"
                    : m.is_published
                    ? "Make private"
                    : "Publish"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
