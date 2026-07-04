import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

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

  const connectGitHub = (redirectPath?: string) => {
    supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        scopes: "read:user repo",
        redirectTo: `${window.location.origin}${redirectPath ?? "/app/integrations"}`,
        queryParams: { prompt: "consent" },
      },
    });
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
    onError: (err: Error) => toast.error(err.message),
  });

  return { ...query, connectGitHub, disconnect };
}
