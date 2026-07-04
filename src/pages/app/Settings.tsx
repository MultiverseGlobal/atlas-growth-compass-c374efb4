import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function Settings() {
  const { user } = useAuth();
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">("unlisted");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (!data) return;
      setHandle(data.handle ?? "");
      setDisplayName(data.display_name ?? "");
      setBio(data.bio ?? "");
      setVisibility((data.page_visibility as any) ?? "unlisted");
    });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      handle: handle.trim().toLowerCase().replace(/^@/, "") || null,
      display_name: displayName || null,
      bio: bio || null,
      page_visibility: visibility,
    }).eq("id", user.id);
    setSaving(false);
    error ? toast.error(error.message) : toast.success("Saved");
  };

  return (
    <div className="max-w-2xl mx-auto px-8 py-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
      <div className="mt-8 space-y-6">
        <div>
          <Label htmlFor="dn">Display name</Label>
          <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="handle">Handle</Label>
          <div className="mt-1.5 flex items-center rounded-md border border-input bg-input/40">
            <span className="pl-3 pr-1 font-mono text-sm text-muted-foreground">atlas.so/@</span>
            <Input id="handle" value={handle} onChange={(e) => setHandle(e.target.value)} className="border-0 bg-transparent focus-visible:ring-0 pl-0" />
          </div>
        </div>
        <div>
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} className="mt-1.5" rows={3} placeholder="Building X for Y." />
        </div>
        <div>
          <Label>Public page visibility</Label>
          <RadioGroup value={visibility} onValueChange={(v: any) => setVisibility(v)} className="mt-3 grid gap-2">
            {[
              { v: "unlisted", t: "Unlisted", d: "Only people with the link can see it." },
              { v: "public", t: "Public", d: "Indexed and discoverable." },
              { v: "private", t: "Private", d: "Only you." },
            ].map((o) => (
              <label key={o.v} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${visibility === o.v ? "border-primary bg-primary/5" : "border-border hover:bg-surface"}`}>
                <RadioGroupItem value={o.v} className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">{o.t}</div>
                  <div className="text-xs text-muted-foreground">{o.d}</div>
                </div>
              </label>
            ))}
          </RadioGroup>
        </div>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
      </div>
    </div>
  );
}
