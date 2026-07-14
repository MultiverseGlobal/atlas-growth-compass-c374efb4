import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ── Helpers ──────────────────────────────────────────────────────────────────

function appUrl(): string {
  // Prefer an explicit SITE_URL secret; fall back to SUPABASE_URL origin for local dev
  return Deno.env.get("SITE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "http://localhost:3000";
}

function redirect(path: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: `${appUrl()}${path}` },
  });
}

// ── Token exchange helpers ────────────────────────────────────────────────────

async function exchangeNotionCode(code: string): Promise<{
  access_token: string;
  workspace_name: string;
  workspace_id: string;
  owner?: { user?: { name?: string } };
}> {
  const clientId = Deno.env.get("NOTION_CLIENT_ID")!;
  const clientSecret = Deno.env.get("NOTION_CLIENT_SECRET")!;
  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/oauth-callback`;

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Notion token exchange failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function exchangeSlackCode(code: string): Promise<{
  access_token: string;
  team: { name: string; id: string };
  authed_user?: { id?: string };
}> {
  const clientId = Deno.env.get("SLACK_CLIENT_ID")!;
  const clientSecret = Deno.env.get("SLACK_CLIENT_SECRET")!;
  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/oauth-callback`;

  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    throw new Error(`Slack token exchange failed (${res.status})`);
  }
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Slack OAuth error: ${data.error}`);
  }
  return data;
}

async function exchangeGoogleCode(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/oauth-callback`;

  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google token exchange failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function getGoogleUserInfo(accessToken: string): Promise<{ email: string; name: string }> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return { email: "Google Workspace", name: "Google Workspace" };
  return res.json();
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const provider = url.searchParams.get("provider");
  const code = url.searchParams.get("code");
  const stateToken = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  // User denied access
  if (errorParam) {
    return redirect(`/app/integrations?oauth_error=${encodeURIComponent(errorParam)}&provider=${provider ?? ""}`);
  }

  if (!provider || !code || !stateToken) {
    return redirect("/app/integrations?oauth_error=missing_params");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // ── 1. Verify CSRF state ──────────────────────────────────────────────────
    const { data: stateRow, error: stateErr } = await serviceClient
      .from("oauth_states")
      .select("user_id, provider, expires_at")
      .eq("state_token", stateToken)
      .maybeSingle();

    if (stateErr || !stateRow) {
      return redirect("/app/integrations?oauth_error=invalid_state");
    }

    if (new Date(stateRow.expires_at) < new Date()) {
      return redirect("/app/integrations?oauth_error=state_expired");
    }

    if (stateRow.provider !== provider) {
      return redirect("/app/integrations?oauth_error=provider_mismatch");
    }

    const userId = stateRow.user_id;

    // Clean up state token (one-time use)
    await serviceClient.from("oauth_states").delete().eq("state_token", stateToken);

    // ── 2. Exchange code for token ────────────────────────────────────────────
    let accessToken = "";
    let refreshToken: string | undefined;
    let label = "";
    let expiresAt: string | undefined;

    if (provider === "notion") {
      const data = await exchangeNotionCode(code);
      accessToken = data.access_token;
      const workspaceName = data.workspace_name ?? "Notion Workspace";
      const ownerName = data.owner?.user?.name;
      label = ownerName ? `${workspaceName} (${ownerName})` : workspaceName;
    } else if (provider === "slack") {
      const data = await exchangeSlackCode(code);
      accessToken = data.access_token;
      label = data.team?.name ?? "Slack Workspace";
    } else if (provider === "google") {
      const data = await exchangeGoogleCode(code);
      accessToken = data.access_token;
      refreshToken = data.refresh_token;
      const userInfo = await getGoogleUserInfo(accessToken);
      label = userInfo.email ?? "Google Workspace";
      if (data.expires_in) {
        expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
      }
    } else {
      return redirect("/app/integrations?oauth_error=unsupported_provider");
    }

    // ── 3. Store token in integrations table ──────────────────────────────────
    const { error: upsertError } = await serviceClient
      .from("integrations")
      .upsert(
        {
          user_id: userId,
          provider,
          status: "active",
          external_account_label: label,
          access_token_encrypted: accessToken,
          // Store refresh token in scopes column as JSON string for now
          // (a future migration can add a dedicated refresh_token column)
          scopes: refreshToken ? [`refresh:${refreshToken}`] : undefined,
          token_expires_at: expiresAt ?? null,
          last_sync_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" }
      );

    if (upsertError) {
      console.error("[oauth-callback] upsert failed:", upsertError.message);
      return redirect(`/app/integrations?oauth_error=store_failed`);
    }

    // ── 4. Success — redirect back to app ────────────────────────────────────
    return redirect(`/app/integrations?connected=${provider}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[oauth-callback] error:", message);
    return redirect(`/app/integrations?oauth_error=${encodeURIComponent(message)}`);
  }
});
