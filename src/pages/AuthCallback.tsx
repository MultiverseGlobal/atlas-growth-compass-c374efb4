import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { resolvePostAuthPath } from "@/lib/postAuthRedirect";

/**
 * AuthCallback – handles the redirect after email confirmation or OAuth.
 *
 * Supabase sends the user here (configured as the redirectTo URL in Auth
 * settings and in the signUp call) with either:
 *   - A PKCE code:  /auth/callback?code=…
 *   - A legacy hash: /auth/callback#access_token=…
 *
 * We exchange the code / hash for a session, then route the user to
 * /onboarding (if they haven't finished it) or /app.
 */
export default function AuthCallback() {
  const nav = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const run = async () => {
      // exchangeCodeForSession handles both PKCE (?code=) and implicit (#access_token=) flows.
      const { data, error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );

      if (error || !data.session) {
        // Something went wrong – fall back to auth page
        console.error("[AuthCallback] session exchange failed", error);
        nav("/auth", { replace: true });
        return;
      }

      const path = await resolvePostAuthPath(data.session.user.id);
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
