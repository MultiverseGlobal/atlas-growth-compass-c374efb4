import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { resolvePostAuthPath } from "@/lib/postAuthRedirect";
import { toast } from "sonner";

/**
 * AuthCallback – handles the redirect after email confirmation or OAuth.
 *
 * Supabase sends the user here (configured as the redirectTo URL in Auth
 * settings and in the signUp call) with either:
 *   - A PKCE code:  /auth/callback?code=…
 *   - A legacy hash: /auth/callback#access_token=…
 *
 * We exchange the code / hash for a session, then route the user to
 * the ?next= destination, /onboarding (if not yet onboarded), or /app.
 */
export default function AuthCallback() {
  const nav = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const errorParam = params.get("error");
      const errorCode = params.get("error_code");
      const errorDesc = params.get("error_description");

      if (errorParam) {
        console.error("[AuthCallback] OAuth callback error:", errorParam, errorCode, errorDesc);
        let msg = errorDesc || "Authentication failed";
        if (errorCode === "identity_already_exists") {
          msg = "This GitHub account is already linked to another Atlas account.";
        }
        toast.error(msg, { duration: 6000 });

        const next = params.get("next") || sessionStorage.getItem("atlas.auth.next") || "/app/integrations";
        sessionStorage.removeItem("atlas.auth.next");
        nav(next, { replace: true });
        return;
      }

      // Extract provider_token from hash or search parameters if present (implicit / PKCE linked identity fallback)
      let pToken = params.get("provider_token");
      if (!pToken && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        pToken = hashParams.get("provider_token");
      }

      if (pToken) {
        const { error: rpcError } = await supabase.rpc("upsert_github_token" as any, {
          p_token: pToken,
          p_scopes: "read:user repo",
          p_expires_at: null,
        });
        if (rpcError) {
          console.warn("[AuthCallback] failed to save token via RPC:", rpcError.message);
        }
      }

      // Check if we already have a valid session (identity link flow)
      const { data: existingSession } = await supabase.auth.getSession();
      if (existingSession?.session) {
        // Already logged in, just redirect back
        const savedNext = sessionStorage.getItem("atlas.auth.next");
        sessionStorage.removeItem("atlas.auth.next");
        if (savedNext) {
          nav(savedNext, { replace: true });
          return;
        }
        const path = await resolvePostAuthPath(existingSession.session.user.id);
        nav(path, { replace: true });
        return;
      }

      // exchangeCodeForSession handles both PKCE (?code=) and implicit (#access_token=) flows.
      const { data, error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );

      if (error || !data.session) {
        // If code exchange fails, it's likely a link-identity flow returning to an existing session.
        // Check if we actually do have a valid session already (linkIdentity succeeds without a code).
        const { data: existingSession } = await supabase.auth.getSession();
        if (existingSession?.session) {
          // We have a live session — route based on stored destination or profile
          const savedNext = sessionStorage.getItem("atlas.auth.next");
          sessionStorage.removeItem("atlas.auth.next");
          if (savedNext) {
            nav(savedNext, { replace: true });
            return;
          }
          const path = await resolvePostAuthPath(existingSession.session.user.id);
          nav(path, { replace: true });
          return;
        }
        console.warn("[AuthCallback] session exchange failed or no code present", error?.message);
        const savedNext = sessionStorage.getItem("atlas.auth.next");
        sessionStorage.removeItem("atlas.auth.next");
        if (savedNext) {
          nav(savedNext, { replace: true });
          return;
        }
        nav("/auth", { replace: true });
        return;
      }

      const { session } = data;
      const userId = session.user.id;

      // If this is a GitHub OAuth callback, ensure an integrations row exists
      // immediately so the destination page sees GitHub as connected.
      const githubIdentity = session.user.identities?.find(
        (i) => i.provider === "github"
      );
      if (githubIdentity) {
        const label =
          session.user.user_metadata?.user_name ||
          session.user.user_metadata?.full_name ||
          "Connected GitHub";

        // Upsert integrations row (ignore conflict — row may already exist)
        await supabase.from("integrations").upsert(
          {
            user_id: userId,
            provider: "github",
            status: "active",
            external_account_label: label,
            external_account_id: githubIdentity.id,
          },
          { onConflict: "user_id,provider", ignoreDuplicates: false }
        );

        // Also persist the provider_token if present
        if (session.provider_token) {
          await (supabase as any).rpc("upsert_github_token", {
            p_token: session.provider_token,
            p_scopes: "read:user repo",
            p_expires_at: null,
          });
        }
      }

      // Check for an explicit ?next= redirect target (set by connectGitHub)
      const next = params.get("next") || sessionStorage.getItem("atlas.auth.next");
      sessionStorage.removeItem("atlas.auth.next");
      if (next) {
        nav(next, { replace: true });
        return;
      }

      // Otherwise resolve based on profile completion
      const path = await resolvePostAuthPath(userId);
      nav(path, { replace: true });
    };

    run();
  }, [nav]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-muted-foreground">
        {/* Simple spinner */}
        <svg
          className="h-8 w-8 animate-spin text-primary"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
        <p className="text-sm font-mono">Verifying your account…</p>
      </div>
    </div>
  );
}

