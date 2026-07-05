import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";

export type IntegrationRow = {
  id: string;
  provider: "github" | "stripe" | "linear" | "posthog";
  status: "active" | "error" | "disconnected" | "syncing";
  external_account_label: string | null;
  last_sync_at: string | null;
};

export function useIntegrations() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["integrations", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Check if user has GitHub identity linked
      const githubIdentity = user.identities?.find((i) => i.provider === "github");
      if (githubIdentity) {
        // Persist the provider_token now — it's only available in the live session.
        // We use a security-definer RPC so the token is stored server-side without
        // exposing it to other authenticated reads.
        const { data: sessionData } = await supabase.auth.getSession();
        const providerToken = sessionData.session?.provider_token;
        if (providerToken) {
          // Fire-and-forget — don't block the UI on this
          (supabase as any).rpc("upsert_github_token", {
            p_token: providerToken,
            p_scopes: "read:user repo",
            p_expires_at: null,
          }).then(({ error }: { error: any }) => {
            if (error) console.warn("[integrations] upsert_github_token failed:", error.message);
          });
        }

        // Ensure the integrations row exists (without the token column, just the label)
        const { data: existing } = await supabase
          .from("integrations")
          .select("id")
          .eq("user_id", user.id)
          .eq("provider", "github")
          .maybeSingle();

        if (!existing) {
          const label = user.user_metadata?.user_name || user.user_metadata?.full_name || "Connected GitHub";
          await supabase.from("integrations").insert({
            user_id: user.id,
            provider: "github",
            status: "active",
            external_account_label: label,
            external_account_id: githubIdentity.id,
          });
        }
      }

      const { data, error } = await supabase
        .from("integrations")
        .select("id, provider, status, external_account_label, last_sync_at")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []) as IntegrationRow[];
    },
    enabled: !!user,
  });

  const connectGitHub = async (redirectPath?: string) => {
    try {
      const redirectTo = `${window.location.origin}${redirectPath ?? "/app/integrations"}`;
      const { error } = await supabase.auth.linkIdentity({
        provider: "github",
        options: {
          scopes: "read:user repo",
          redirectTo,
          queryParams: { prompt: "consent" },
        },
      });
      if (error) {
        // linkIdentity requires manual linking enabled in Supabase project settings.
        // Fall back to signInWithOAuth if the method isn't supported.
        if (error.message?.includes("not supported") || error.message?.includes("not enabled")) {
          const { error: oauthErr } = await supabase.auth.signInWithOAuth({
            provider: "github",
            options: { scopes: "read:user repo", redirectTo },
          });
          if (oauthErr) throw oauthErr;
        } else {
          throw error;
        }
      }
    } catch (err: unknown) {
      toast.error(friendlyError(err));
    }
  };

  const disconnect = useMutation({
    mutationFn: async (integrationId: string) => {
      const { error } = await supabase
        .from("integrations")
        .delete()
        .eq("id", integrationId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations", user?.id] });
      toast.success("Integration disconnected");
    },
    onError: (err: Error) => toast.error(friendlyError(err)),
  });

  return { ...query, connectGitHub, disconnect };
}
