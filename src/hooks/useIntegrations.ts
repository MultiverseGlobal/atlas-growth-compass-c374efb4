import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";

export type IntegrationRow = {
  id: string;
  provider: "github" | "stripe" | "notion" | "slack" | "google";
  status: "active" | "error" | "disconnected" | "syncing";
  external_account_label: string | null;
  last_sync_at: string | null;
};

export function useIntegrations() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const location = useLocation();

  // ── Handle OAuth return: ?connected=<provider> or ?oauth_error=<msg> ───────
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const connected = params.get("connected");
    const oauthError = params.get("oauth_error");

    if (connected) {
      const name = connected.charAt(0).toUpperCase() + connected.slice(1);
      toast.success(`${name} connected successfully! 🎉`);
      qc.invalidateQueries({ queryKey: ["integrations", user?.id] });
      // Clean up URL params without full reload
      window.history.replaceState({}, "", location.pathname);
    }

    if (oauthError) {
      const friendlyMessages: Record<string, string> = {
        invalid_state: "OAuth session expired or invalid. Please try again.",
        state_expired: "OAuth session expired. Please try again.",
        provider_mismatch: "OAuth provider mismatch. Please try again.",
        store_failed: "Failed to save the connection. Please try again.",
        access_denied: "You cancelled the connection.",
        missing_params: "OAuth flow was incomplete. Please try again.",
      };
      const msg = friendlyMessages[oauthError] ?? `OAuth error: ${oauthError}`;
      toast.error(msg);
      window.history.replaceState({}, "", location.pathname);
    }
  }, [location.search]);

  // ── Fetch integrations ────────────────────────────────────────────────────
  const query = useQuery({
    queryKey: ["integrations", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Auto-register GitHub if the user signed in with GitHub OAuth
      const githubIdentity = user.identities?.find((i) => i.provider === "github");
      if (githubIdentity) {
        const { data: sessionData } = await supabase.auth.getSession();
        const providerToken = sessionData.session?.provider_token;
        if (providerToken) {
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

      const { data, error } = await supabase
        .from("integrations")
        .select("id, provider, status, external_account_label, last_sync_at")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []) as IntegrationRow[];
    },
    enabled: !!user,
  });

  // ── GitHub OAuth (uses Supabase built-in) ────────────────────────────────
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

  // ── Generic OAuth via Edge Function ──────────────────────────────────────
  const connectViaEdgeFunction = async (provider: "notion" | "slack" | "google") => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        toast.error("Please sign in again to connect integrations.");
        return;
      }

      const supabaseUrl = (supabase as any).supabaseUrl as string;
      const res = await fetch(
        `${supabaseUrl}/functions/v1/oauth-initiate?provider=${provider}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(body.error ?? `Failed to initiate ${provider} OAuth`);
      }

      const { url } = await res.json();
      if (!url) throw new Error("No OAuth URL returned from server.");

      // Redirect the user to the provider's OAuth page
      window.location.href = url;
    } catch (err: unknown) {
      toast.error(friendlyError(err));
    }
  };

  const connectNotion = () => connectViaEdgeFunction("notion");
  const connectSlack = () => connectViaEdgeFunction("slack");
  const connectGoogle = () => connectViaEdgeFunction("google");

  // ── Disconnect ────────────────────────────────────────────────────────────
  const disconnect = useMutation({
    mutationFn: async (integrationId: string) => {
      const { data: integration } = await supabase
        .from("integrations")
        .select("provider")
        .eq("id", integrationId)
        .maybeSingle();

      if (integration?.provider === "github" && user) {
        const githubIdentity = user.identities?.find((i) => i.provider === "github");
        if (githubIdentity) {
          const { error: unlinkError } = await supabase.auth.unlinkIdentity(githubIdentity as any);
          if (unlinkError) {
            console.warn("Failed to unlink GitHub identity:", unlinkError.message);
          }
        }
      }

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

  return { ...query, connectGitHub, connectNotion, connectSlack, connectGoogle, disconnect };
}
