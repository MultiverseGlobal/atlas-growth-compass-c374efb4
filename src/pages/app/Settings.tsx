import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { LogOut, Trash2, User, Globe, CreditCard } from "lucide-react";

type Profile = {
  handle: string;
  display_name: string;
  bio: string;
  page_visibility: "public" | "unlisted" | "private";
  plan: "free" | "atlas" | null;
  email?: string;
};

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile>({
    handle: "",
    display_name: "",
    bio: "",
    page_visibility: "unlisted",
    plan: "free",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (!data) return;
      setProfile({
        handle: data.handle ?? "",
        display_name: data.display_name ?? "",
        bio: data.bio ?? "",
        page_visibility: (data.page_visibility as any) ?? "unlisted",
        plan: (data.plan as any) ?? "free",
        email: user.email ?? "",
      });
    });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const cleanHandle = profile.handle.trim().toLowerCase().replace(/^@/, "");
    const { error } = await supabase.from("profiles").update({
      handle: cleanHandle || null,
      display_name: profile.display_name.trim() || null,
      bio: profile.bio.trim() || null,
      page_visibility: profile.page_visibility,
    }).eq("id", user.id);
    setSaving(false);
    error ? toast.error(error.message) : toast.success("Profile saved");
  };

  const [upgrading, setUpgrading] = useState(false);
  const handleUpgrade = async () => {
    if (!user) return;
    setUpgrading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const { error } = await supabase
        .from("profiles")
        .update({ plan: "atlas" })
        .eq("id", user.id);

      if (error) throw error;
      setProfile(p => ({ ...p, plan: "atlas" }));
      toast.success("Successfully upgraded to Atlas!");
    } catch (err: any) {
      toast.error(err.message ?? "Upgrade failed");
    } finally {
      setUpgrading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    // Delete all user data in order (foreign keys)
    await supabase.from("activity_logs").delete().eq("user_id", user.id);
    await supabase.from("waypoints").delete().eq("user_id", user.id);
    await supabase.from("signals").delete().eq("user_id", user.id);
    await supabase.from("sources").delete().eq("user_id", user.id);
    await supabase.from("maps").delete().eq("user_id", user.id);
    await supabase.from("integrations").delete().eq("user_id", user.id);
    await supabase.from("profiles").delete().eq("id", user.id);
    await supabase.auth.signOut();
    navigate("/");
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="rounded-[16px] border border-border bg-card px-6 py-6 space-y-5">
      <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{title}</div>
      {children}
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:px-8 space-y-5">
      <div className="text-xs font-mono uppercase tracking-widest text-primary">Account</div>
      <h1 className="font-display text-4xl font-semibold leading-tight">Settings</h1>

      {/* Profile */}
      <Section title="Profile">
        <div>
          <Label htmlFor="dn">Display name</Label>
          <Input
            id="dn"
            value={profile.display_name}
            onChange={e => setProfile(p => ({ ...p, display_name: e.target.value }))}
            className="mt-1.5"
            placeholder="Jane Founder"
          />
        </div>
        <div>
          <Label htmlFor="handle">Handle</Label>
          <div className="mt-1.5 flex items-center rounded-md border border-input bg-input/40 focus-within:ring-2 focus-within:ring-ring">
            <span className="pl-3 pr-1 font-mono text-sm text-muted-foreground">atlas.so/@</span>
            <Input
              id="handle"
              value={profile.handle}
              onChange={e => setProfile(p => ({ ...p, handle: e.target.value }))}
              className="border-0 bg-transparent pl-0 focus-visible:ring-0"
              placeholder="janef"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={profile.bio}
            onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
            className="mt-1.5"
            rows={2}
            placeholder="Building X for Y."
          />
        </div>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
      </Section>

      {/* Public page */}
      <Section title="Public page">
        <p className="text-sm text-muted-foreground">
          Your public page lives at{" "}
          <span className="font-mono text-foreground">atlas.so/@{profile.handle || "your-handle"}</span>
        </p>
        <RadioGroup
          value={profile.page_visibility}
          onValueChange={v => setProfile(p => ({ ...p, page_visibility: v as any }))}
          className="grid gap-2"
        >
          {[
            { v: "public", t: "Public", d: "Indexed and discoverable." },
            { v: "unlisted", t: "Unlisted", d: "Only people with the link can see it." },
            { v: "private", t: "Private", d: "Only you." },
          ].map(o => (
            <label key={o.v} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${profile.page_visibility === o.v ? "border-primary bg-primary/5" : "border-border hover:bg-surface"}`}>
              <RadioGroupItem value={o.v} className="mt-0.5" />
              <div>
                <div className="text-sm font-medium">{o.t}</div>
                <div className="text-xs text-muted-foreground">{o.d}</div>
              </div>
            </label>
          ))}
        </RadioGroup>
        <Button onClick={save} disabled={saving} variant="outline" size="sm">{saving ? "Saving…" : "Save visibility"}</Button>
      </Section>

      {/* Plan */}
      <Section title="Plan">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${profile.plan === "atlas" ? "text-primary border-primary/40 bg-primary/5" : "text-muted-foreground border-border"}`}>
                {profile.plan === "atlas" ? "Atlas" : "Free"}
              </span>
              <span className="text-sm text-muted-foreground">
                {profile.plan === "atlas" ? "All features unlocked" : "1 active map"}
              </span>
            </div>
            {profile.plan !== "atlas" && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Upgrade to Atlas for unlimited maps and advanced signals.
              </p>
            )}
          </div>
          {profile.plan !== "atlas" && (
            <Button size="sm" variant="outline" onClick={handleUpgrade} disabled={upgrading}>
              {upgrading ? "Upgrading…" : "Upgrade"}
            </Button>
          )}
        </div>
      </Section>

      {/* Account */}
      <Section title="Account">
        <div className="text-sm text-muted-foreground">
          Signed in as <span className="font-mono text-foreground">{user?.email}</span>
        </div>
        <div className="flex flex-wrap gap-3 pt-1">
          <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </Button>
        </div>
      </Section>

      {/* Danger zone */}
      <div className="rounded-[16px] border border-destructive/30 bg-destructive/5 px-6 py-6 space-y-4">
        <div className="text-xs font-mono uppercase tracking-widest text-destructive/80">Danger zone</div>
        <div>
          <div className="text-sm font-medium">Delete account</div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Permanently deletes all your maps, signals, and data. This cannot be undone.
          </p>
        </div>
        {!confirmDelete ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive gap-2"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete my account
          </Button>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm text-destructive font-medium">This will delete everything. Are you sure?</p>
            <Button
              size="sm"
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 text-white gap-2"
            >
              <Trash2 className="h-3.5 w-3.5" /> {deleting ? "Deleting…" : "Yes, delete everything"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </div>
        )}
      </div>
    </div>
  );
}
