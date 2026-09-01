import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const isProd = window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
const METAPHOR_API = isProd ? "https://metaphor-backend.onrender.com/api/v1/mcp" : "http://localhost:8000/api/v1/mcp";
const ATLAS_CLIENT_ID = "atlas";
// Fix 4: redirect_uri uses the correct host dynamically
const ATLAS_REDIRECT_URI = `${window.location.origin}/auth/metaphor/callback`;

export default function MetaphorAuthCallback() {
  const nav = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const error = params.get("error");

      if (error) {
        toast.error("Metaphor OS declined the connection.");
        nav("/app/integrations", { replace: true });
        return;
      }

      if (!code) {
        toast.error("No authorization code received from Metaphor OS.");
        nav("/app/integrations", { replace: true });
        return;
      }

      try {
        // ── Fix 1: Exchange the one-time auth code for a real Bearer access token ──
        const tokenRes = await fetch(`${METAPHOR_API}/oauth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: ATLAS_CLIENT_ID,
            redirect_uri: ATLAS_REDIRECT_URI,
            code,
          }).toString(),
        });

        if (!tokenRes.ok) {
          const detail = await tokenRes.text();
          throw new Error(`Token exchange failed: ${detail}`);
        }

        const { access_token } = await tokenRes.json();

        if (!access_token) {
          throw new Error("No access_token in Metaphor response.");
        }

        // Persist the real Bearer token to Supabase user_metadata
        await supabase.auth.updateUser({
          data: { metaphor_access_token: access_token }
        });

        // Save to Supabase so the Integrations UI shows it as connected
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          await supabase.from("integrations").upsert(
            {
              user_id: userData.user.id,
              provider: "metaphor",
              status: "active",
              external_account_label: "Metaphor OS (Local)",
              external_account_id: "local_system",
            },
            { onConflict: "user_id,provider" }
          );
        }

        toast.success("Metaphor OS connected! 🧠");
        nav("/app/integrations?connected=metaphor", { replace: true });
      } catch (err: any) {
        console.error("[MetaphorAuthCallback] token exchange error:", err);
        toast.error(err.message || "Failed to complete Metaphor connection.");
        nav("/app/integrations", { replace: true });
      }
    };

    run();
  }, [nav]);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground">
      <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mb-4" />
      <p className="text-sm font-medium text-muted">Connecting to Metaphor OS…</p>
    </div>
  );
}
