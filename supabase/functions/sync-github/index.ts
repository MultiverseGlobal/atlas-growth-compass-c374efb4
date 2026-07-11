import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface SyncRequest {
  action?: "list_repos" | "sync";
  map_id?: string;
  repo_full_name?: string; // e.g. "owner/repo"
  github_token?: string;  // optional token from client session (persisted if provided)
}

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    committer: { date: string; name: string };
    author: { date: string; name: string };
  };
  html_url: string;
}

interface GitHubPR {
  number: number;
  title: string;
  state: string;
  merged_at: string | null;
  html_url: string;
  created_at: string;
}

// ─── GitHub API helpers ───────────────────────────────────────────────────────

async function fetchGitHub(path: string, token: string) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error (${res.status}): ${text}`);
  }
  return res.json();
}

async function getProviderToken(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string | null> {
  // Primary: read the persisted token from integrations (written by upsert_github_token RPC)
  const { data } = await supabase
    .from("integrations")
    .select("access_token_encrypted")
    .eq("user_id", userId)
    .eq("provider", "github")
    .eq("status", "active")
    .maybeSingle();

  if (data?.access_token_encrypted) return data.access_token_encrypted;

  // Fallback: read from Supabase auth admin (service_role only)
  const { data: userData } = await supabase.auth.admin.getUserById(userId);
  const identities = (userData?.user as any)?.identities ?? [];
  const ghIdentity = identities.find((id: any) => id.provider === "github");
  return ghIdentity?.identity_data?.provider_token ?? null;
}

// ─── Sync Logic ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const isServiceCall = authHeader === `Bearer ${supabaseServiceKey}`;
    const userClient = isServiceCall
      ? createClient(supabaseUrl, supabaseServiceKey)
      : createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
        });
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const body: SyncRequest = await req.json();

    let userId: string;
    let user: any = null;
    let resolvedMapData: any = null;

    if (isServiceCall) {
      if (!body.map_id) {
        return new Response(JSON.stringify({ error: "map_id is required for service-role sync" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error: mapError } = await serviceClient
        .from("maps")
        .select("id, user_id, goal_statement")
        .eq("id", body.map_id)
        .maybeSingle();
      if (mapError || !data) {
        return new Response(JSON.stringify({ error: "Map not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = data.user_id;
      resolvedMapData = data;
    } else {
      const { data: { user: authUser }, error: userError } = await userClient.auth.getUser();
      if (userError || !authUser) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      user = authUser;
      userId = user.id;
    }

    // Resolve GitHub token — if the client passed one, persist it and use it;
    // otherwise read from the integrations table.
    let ghToken = body.github_token;
    if (ghToken) {
      // Persist the freshly-obtained session token so future server-only runs have it.
      const label =
        user?.user_metadata?.user_name ||
        user?.user_metadata?.full_name ||
        "Connected GitHub";
      const { error: upsertError } = await serviceClient
        .from("integrations")
        .upsert(
          {
            user_id: userId,
            provider: "github",
            status: "active",
            external_account_label: label,
            access_token_encrypted: ghToken,
            scopes: ["read:user", "repo"],
            last_sync_at: new Date().toISOString(),
          },
          { onConflict: "user_id,provider" }
        );
      if (upsertError) {
        console.warn("[sync-github] Failed to persist token:", upsertError.message);
      }
    } else {
      ghToken = (await getProviderToken(serviceClient, userId)) ?? undefined;
    }

    if (!ghToken) {
      return new Response(
        JSON.stringify({ error: "No GitHub token found. Connect GitHub in integrations." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Branch to list repos if requested or if repo_full_name is missing
    if (body.action === "list_repos" || !body.repo_full_name) {
      try {
        const repos = await fetchGitHub("/user/repos?sort=updated&per_page=50", ghToken);
        return new Response(
          JSON.stringify({ ok: true, repos }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e: any) {
        return new Response(
          JSON.stringify({ error: `Failed to fetch GitHub repos: ${e.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!body.map_id) {
      return new Response(JSON.stringify({ error: "map_id is required for sync" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the map belongs to this user if not already resolved
    let mapData = resolvedMapData;
    if (!mapData) {
      const { data, error: mapError } = await userClient
        .from("maps")
        .select("id, goal_statement")
        .eq("id", body.map_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (mapError || !data) {
        return new Response(JSON.stringify({ error: "Map not found or unauthorized" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      mapData = data;
    }

    const [owner, repo] = body.repo_full_name.split("/");

    // Record sync start
    const { data: syncRun } = await serviceClient
      .from("sync_runs")
      .insert({ user_id: userId, integration_id: null, kind: "github_map_sync" })
      .select("id")
      .maybeSingle();

    const syncRunId = syncRun?.id ?? null;
    let eventsIngested = 0;
    const errors: string[] = [];

    // ── Fetch commits (last 14 days) ──────────────────────────────────────────
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const sinceISO = twoWeeksAgo.toISOString();

    let commits: GitHubCommit[] = [];
    try {
      commits = await fetchGitHub(
        `/repos/${owner}/${repo}/commits?since=${sinceISO}&per_page=50`,
        ghToken
      );
    } catch (e: any) {
      errors.push(`Commits: ${e.message}`);
    }

    // ── Fetch recently merged PRs ─────────────────────────────────────────────
    let pullRequests: GitHubPR[] = [];
    try {
      const allPRs: GitHubPR[] = await fetchGitHub(
        `/repos/${owner}/${repo}/pulls?state=closed&per_page=20&sort=updated&direction=desc`,
        ghToken
      );
      pullRequests = allPRs.filter(
        (pr) => pr.merged_at && new Date(pr.merged_at) > twoWeeksAgo
      );
    } catch (e: any) {
      errors.push(`PRs: ${e.message}`);
    }

    // ── Upsert signals — each row carries a full payload ─────────────────────

    for (const commit of commits) {
      const firstLine = commit.commit.message.split("\n")[0].slice(0, 200);
      const occurredAt = commit.commit.committer.date || commit.commit.author.date;

      const { error: sigError } = await serviceClient
        .from("signals")
        .upsert(
          {
            map_id: body.map_id,
            user_id: userId,
            title: `Commit: ${firstLine}`,
            score: 10,
            occurred_at: occurredAt,
            payload: {
              type: "commit",
              sha: commit.sha,
              url: commit.html_url,
              author: commit.commit.author.name || commit.commit.committer.name,
              // Full message stored for LLM context in diagnose-map
              message: commit.commit.message.slice(0, 1000),
            },
          },
          { onConflict: "map_id,user_id,occurred_at,title", ignoreDuplicates: true }
        );

      if (!sigError) eventsIngested++;
    }

    for (const pr of pullRequests) {
      const { error: sigError } = await serviceClient
        .from("signals")
        .upsert(
          {
            map_id: body.map_id,
            user_id: userId,
            title: `PR merged: ${pr.title}`,
            score: 25,
            occurred_at: pr.merged_at ?? pr.created_at,
            payload: {
              type: "pr",
              number: pr.number,
              url: pr.html_url,
              state: pr.state,
              merged_at: pr.merged_at,
            },
          },
          { onConflict: "map_id,user_id,occurred_at,title", ignoreDuplicates: true }
        );

      if (!sigError) eventsIngested++;
    }

    // ── Compute stats for the client UI (commits this/last week, etc.) ────────
    const now = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const commitsThisWeek = commits.filter(
      (c) => new Date(c.commit.committer.date) >= oneWeekAgo
    ).length;
    const commitsLastWeek = commits.length - commitsThisWeek;

    const latestCommit = commits[0] ?? null;
    const latestCommitDate = latestCommit
      ? new Date(latestCommit.commit.committer.date)
      : null;
    const daysSinceLastCommit = latestCommitDate
      ? Math.floor((now.getTime() - latestCommitDate.getTime()) / (1000 * 60 * 60 * 24))
      : 14;
    const lastCommitMessage = latestCommit?.commit.message.split("\n")[0] ?? "";

    // Update sync run record
    if (syncRunId) {
      await serviceClient
        .from("sync_runs")
        .update({
          finished_at: new Date().toISOString(),
          events_ingested: eventsIngested,
          error: errors.length > 0 ? errors.join("; ") : null,
        })
        .eq("id", syncRunId);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        events_ingested: eventsIngested,
        // stats returned for the MapDetails UI stat display only —
        // diagnose-map now reads signals directly from the DB.
        stats: { commitsThisWeek, commitsLastWeek, daysSinceLastCommit, lastCommitMessage },
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
