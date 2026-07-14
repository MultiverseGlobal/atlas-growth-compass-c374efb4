import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const REDIRECT_BASE = Deno.env.get("SUPABASE_URL")!;
// Single clean callback URL — no query params, so Notion (and other providers)
// that strip query strings from redirect_uri don't break the flow.
// Provider identity is encoded in the state token instead.
const CALLBACK_URL = `${REDIRECT_BASE}/functions/v1/oauth-callback`;

const PROVIDER_CONFIGS: Record<string, {
  authUrl: string;
  clientIdEnv: string;
  scopes: string;
  extraParams?: Record<string, string>;
}> = {
  notion: {
    authUrl: "https://api.notion.com/v1/oauth/authorize",
    clientIdEnv: "NOTION_CLIENT_ID",
    scopes: "",
    extraParams: { owner: "user", response_type: "code" },
  },
  slack: {
    authUrl: "https://slack.com/oauth/v2/authorize",
    clientIdEnv: "SLACK_CLIENT_ID",
    scopes: "channels:read,channels:history,users:read",
    extraParams: {},
  },
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    scopes: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/drive.metadata.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ].join(" "),
    extraParams: {
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
    },
  },
};

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get("provider");

    if (!provider || !PROVIDER_CONFIGS[provider]) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing provider. Use: notion | slack | google" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Authenticate the user
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401, headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json" },
      });
    }

    // Generate a CSRF state token that encodes the provider.
    // Format: "<provider>:<uuid>" — this survives the OAuth round-trip unchanged
    // even when providers (e.g. Notion) strip query params from redirect_uri.
    const stateToken = `${provider}:${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const { error: stateError } = await serviceClient
      .from("oauth_states")
      .insert({
        user_id: user.id,
        state_token: stateToken,
        provider,
        expires_at: expiresAt.toISOString(),
      });

    if (stateError) {
      console.error("[oauth-initiate] Failed to store state:", stateError.message);
      return new Response(JSON.stringify({ error: "Failed to initiate OAuth flow" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    const config = PROVIDER_CONFIGS[provider];
    const clientId = Deno.env.get(config.clientIdEnv);
    if (!clientId) {
      return new Response(
        JSON.stringify({ error: `${provider} client ID not configured. Add ${config.clientIdEnv} to Edge Function secrets.` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build the OAuth authorization URL.
    // Use a clean redirect_uri (no query params) so providers like Notion
    // that don't support query params in redirect_uri work correctly.
    // The provider is recovered from the state token on callback.
    const authParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: CALLBACK_URL,
      state: stateToken,
      ...(config.scopes ? { scope: config.scopes } : {}),
      ...config.extraParams,
    });

    const authorizationUrl = `${config.authUrl}?${authParams.toString()}`;

    // Return the URL for the frontend to redirect to
    return new Response(JSON.stringify({ url: authorizationUrl }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
