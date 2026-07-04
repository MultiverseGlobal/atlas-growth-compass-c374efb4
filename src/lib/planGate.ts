import { supabase } from "@/integrations/supabase/client";

export async function canCreateMap(userId: string): Promise<boolean> {
  // Check plan first
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.plan === "atlas") return true;

  // Free plan: max 1 active map
  const { count } = await supabase
    .from("maps")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  return (count ?? 0) < 1;
}
