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
        const { data: sessionData } = await supabase.auth.getSession();
        const providerToken = sessionData.session?.provider_token;
        if (providerToken && sessionData.session?.user?.app_metadata?.provider === "github") {
          (supabase as any).rpc("upsert_github_token", {
            p_token: providerToken,
            p_scopes: "read:user repo",
            p_expires_at: null,
          }).then(({ error }: { error: any }) => {
            if (error) console.warn("[integrations] upsert_github_token failed:", error.message);
          });
        }

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

      // Check if user has Notion identity linked
      const notionIdentity = user.identities?.find((i) => i.provider === "notion");
      if (notionIdentity) {
        const { data: sessionData } = await supabase.auth.getSession();
        const providerToken = sessionData.session?.provider_token;
        
        if (providerToken && sessionData.session?.user?.app_metadata?.provider === "notion") {
          (supabase as any).rpc("upsert_notion_token", {
            p_token: providerToken,
          }).catch((err: any) => {
            console.warn("[integrations] upsert_notion_token failed:", err.message);
          });
        }

        const { data: existing } = await supabase
          .from("integrations")
          .select("id")
          .eq("user_id", user.id)
          .eq("provider", "notion")
          .maybeSingle();

        if (!existing) {
          const label = user.user_metadata?.user_name || user.user_metadata?.full_name || "Connected Notion";
          await supabase.from("integrations").insert({
            user_id: user.id,
            provider: "notion",
            status: "active",
            external_account_label: label,
            external_account_id: notionIdentity.id,
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
    const destination = redirectPath ?? "/app/integrations";
    const callbackUrl = `${window.location.origin}/auth/callback`;
    try {
      sessionStorage.setItem("atlas.auth.next", destination);
    } catch (e) {
      console.warn("[integrations] failed to set sessionStorage", e);
    }
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "github",
        options: {
          scopes: "read:user repo",
          redirectTo: callbackUrl,
          queryParams: { prompt: "consent" },
        },
      });
      if (error) {
        try { sessionStorage.setItem("atlas.auth.next", destination); } catch {}
        const { error: oauthErr } = await supabase.auth.signInWithOAuth({
          provider: "github",
          options: { scopes: "read:user repo", redirectTo: callbackUrl },
        });
        if (oauthErr) throw oauthErr;
      }
    } catch (err: unknown) {
      toast.error(friendlyError(err));
    }
  };

  const connectNotion = async (redirectPath?: string) => {
    const destination = redirectPath ?? "/app/integrations";
    const callbackUrl = `${window.location.origin}/auth/callback`;
    try {
      sessionStorage.setItem("atlas.auth.next", destination);
    } catch (e) {
      console.warn("[integrations] failed to set sessionStorage", e);
    }
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "notion",
        options: {
          redirectTo: callbackUrl,
        },
      });
      if (error) {
        try { sessionStorage.setItem("atlas.auth.next", destination); } catch {}
        const { error: oauthErr } = await supabase.auth.signInWithOAuth({
          provider: "notion",
          options: { redirectTo: callbackUrl },
        });
        if (oauthErr) throw oauthErr;
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

  return { ...query, connectGitHub, connectNotion, disconnect };
}
