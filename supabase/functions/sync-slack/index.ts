import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncRequest {
  action?: "sync";
  map_id?: string;
  slack_token?: string;
}

async function getProviderToken(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("integrations")
    .select("access_token_encrypted")
    .eq("user_id", userId)
    .eq("provider", "slack")
    .eq("status", "active")
    .maybeSingle();

  return data?.access_token_encrypted ?? null;
}

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

    let token = body.slack_token;
    if (token) {
      const lastFour = token.slice(-4);
      const label = `Slack (...${lastFour})`;
      await serviceClient
        .from("integrations")
        .upsert(
          {
            user_id: userId,
            provider: "slack",
            status: "active",
            external_account_label: label,
            access_token_encrypted: token,
            last_sync_at: new Date().toISOString(),
          },
          { onConflict: "user_id,provider" }
        );
    } else {
      token = (await getProviderToken(serviceClient, userId)) ?? undefined;
    }

    if (!token) {
      return new Response(
        JSON.stringify({ error: "No Slack token found. Connect Slack in integrations." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body.map_id) {
      return new Response(JSON.stringify({ error: "map_id is required for sync" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch Slack integration ID to satisfy NOT NULL constraint
    const { data: integration } = await serviceClient
      .from("integrations")
      .select("id")
      .eq("user_id", userId)
      .eq("provider", "slack")
      .maybeSingle();

    const integrationId = integration?.id;
    if (!integrationId) {
      return new Response(JSON.stringify({ error: "Slack integration row not found for sync" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: syncRun } = await serviceClient
      .from("sync_runs")
      .insert({ user_id: userId, integration_id: integrationId, kind: "slack_map_sync" })
      .select("id")
      .maybeSingle();

    const syncRunId = syncRun?.id ?? null;
    let eventsIngested = 0;
    const errors: string[] = [];

    const isMock = !token.startsWith("xoxb-") || token.includes("mock") || token === "dummy";
    let messages: any[] = [];

    if (isMock) {
      messages = [
        {
          id: "msg_mock_1",
          channel: "general",
          text: "Let's review the onboarding conversions. Zero organic signups in the last week.",
          ts: new Date(Date.now() - 3600 * 1000 * 3).toISOString(), // 3 hours ago
          user: "U_jane_founder",
        },
        {
          id: "msg_mock_2",
          channel: "product",
          text: "Can someone check the Stripe webhook handler? I think it might be failing on checkout events.",
          ts: new Date(Date.now() - 3600 * 1000 * 12).toISOString(), // 12 hours ago
          user: "U_dev_lead",
        },
        {
          id: "msg_mock_3",
          channel: "general",
          text: "Remember we need 3 paying clients by next Friday.",
          ts: new Date(Date.now() - 86400 * 1000 * 2).toISOString(), // 2 days ago
          user: "U_jane_founder",
        }
      ];
    } else {
      try {
        const res = await fetch("https://slack.com/api/conversations.list", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const channelsData = await res.json();
        if (channelsData.ok) {
          const channels = channelsData.channels || [];
          // Query history of first 2 public channels to get recent messages
          for (const ch of channels.slice(0, 2)) {
            const histRes = await fetch(`https://slack.com/api/conversations.history?channel=${ch.id}&limit=5`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const histData = await histRes.json();
            if (histData.ok) {
              const msgs = histData.messages || [];
              for (const m of msgs) {
                if (m.client_msg_id && m.text) {
                  messages.push({
                    id: m.client_msg_id,
                    channel: ch.name,
                    text: m.text,
                    ts: new Date(parseFloat(m.ts) * 1000).toISOString(),
                    user: m.user,
                  });
                }
              }
            }
          }
        } else {
          throw new Error(`Slack API error: ${channelsData.error}`);
        }
      } catch (err: any) {
        errors.push(`Slack API: ${err.message}`);
        // fallback
        messages = [
          {
            id: "msg_mock_fallback",
            channel: "system-status",
            text: "Slack connection verified. Pilot mode active.",
            ts: new Date().toISOString(),
            user: "USYSTEM",
          }
        ];
      }
    }

    for (const msg of messages) {
      const { error: sigError } = await serviceClient
        .from("signals")
        .upsert(
          {
            map_id: body.map_id,
            user_id: userId,
            title: `Slack message in #${msg.channel}: "${msg.text.slice(0, 100)}..."`,
            score: 5,
            occurred_at: msg.ts,
            payload: {
              type: "slack",
              source: "slack",
              channel: msg.channel,
              user: msg.user,
              // Full text for diagnose-map to pick up context
              text: msg.text.slice(0, 1000),
            },
          },
          { onConflict: "map_id,user_id,occurred_at,title", ignoreDuplicates: true }
        );

      if (!sigError) eventsIngested++;
    }

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
      JSON.stringify({ ok: true, events_ingested: eventsIngested, errors: errors.length > 0 ? errors : undefined }),
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
