import { supabase } from "@/integrations/supabase/client";

export async function resolvePostAuthPath(userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("handle, onboarded_at")
    .eq("id", userId)
    .maybeSingle();
  if (!data || !data.handle || !data.onboarded_at) return "/onboarding";
  return "/app";
}
