import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncRequest {
  action?: "sync";
  map_id?: string;
  stripe_token?: string; // Optional token from client to save on the fly
}

async function fetchStripe(endpoint: string, apiKey: string) {
  const res = await fetch(`https://api.stripe.com${endpoint}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe API error (${res.status}): ${text}`);
  }
  return res.json();
}

async function getProviderToken(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("integrations")
    .select("access_token_encrypted")
    .eq("user_id", userId)
    .eq("provider", "stripe")
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

    let stripeToken = body.stripe_token;
    if (stripeToken) {
      // Save Stripe key to integrations
      const lastFour = stripeToken.slice(-4);
      const isTest = stripeToken.startsWith("sk_test_");
      const label = isTest ? `Stripe Test (...${lastFour})` : `Stripe Live (...${lastFour})`;

      const { error: upsertError } = await serviceClient
        .from("integrations")
        .upsert(
          {
            user_id: userId,
            provider: "stripe",
            status: "active",
            external_account_label: label,
            access_token_encrypted: stripeToken,
            last_sync_at: new Date().toISOString(),
          },
          { onConflict: "user_id,provider" }
        );
      if (upsertError) {
        console.warn("[sync-stripe] Failed to persist token:", upsertError.message);
      }
    } else {
      stripeToken = (await getProviderToken(serviceClient, userId)) ?? undefined;
    }

    if (!stripeToken) {
      return new Response(
        JSON.stringify({ error: "No Stripe token found. Connect Stripe in integrations." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body.map_id) {
      return new Response(JSON.stringify({ error: "map_id is required for sync" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify map ownership
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

    const { data: syncRun } = await serviceClient
      .from("sync_runs")
      .insert({ user_id: userId, integration_id: null, kind: "stripe_map_sync" })
      .select("id")
      .maybeSingle();

    const syncRunId = syncRun?.id ?? null;
    let eventsIngested = 0;
    const errors: string[] = [];

    // Stripe sync data
    let fetchedCharges: any[] = [];
    let isMock = stripeToken.includes("mock") || stripeToken === "dummy";

    if (!isMock) {
      try {
        const data = await fetchStripe("/v1/charges?limit=10", stripeToken);
        fetchedCharges = data.data || [];
      } catch (err: any) {
        console.warn("[sync-stripe] Stripe API fetch failed, falling back to mock:", err.message);
        errors.push(`Stripe API: ${err.message}`);
        isMock = true;
      }
    }

    // Generate Stripe signals
    if (isMock) {
      // Mock stripe charges
      fetchedCharges = [
        {
          id: "ch_mock_1",
          amount: 9900,
          currency: "usd",
          created: Math.floor(Date.now() / 1000) - 86400 * 2,
          customer: "cus_mock_bob",
          billing_details: { name: "Bob Miller" },
        },
        {
          id: "ch_mock_2",
          amount: 14900,
          currency: "usd",
          created: Math.floor(Date.now() / 1000) - 86400 * 5,
          customer: "cus_mock_alice",
          billing_details: { name: "Alice Smith" },
        },
        {
          id: "ch_mock_3",
          amount: 4900,
          currency: "usd",
          created: Math.floor(Date.now() / 1000) - 86400 * 9,
          customer: "cus_mock_charlie",
          billing_details: { name: "Charlie Davis" },
        }
      ];
    }

    for (const charge of fetchedCharges) {
      const amountFormatted = (charge.amount / 100).toFixed(2);
      const currencyUpper = charge.currency.toUpperCase();
      const customerName = charge.billing_details?.name || "Customer";
      const occurredAt = new Date(charge.created * 1000).toISOString();

      const { error: sigError } = await serviceClient
        .from("signals")
        .upsert(
          {
            map_id: body.map_id,
            user_id: userId,
            title: `Stripe charge: ${customerName} paid $${amountFormatted} ${currencyUpper}`,
            score: 30,
            occurred_at: occurredAt,
            payload: {
              type: "stripe",
              source: "stripe",
              charge_id: charge.id,
              amount: charge.amount,
              currency: charge.currency,
              customer: charge.customer,
              customer_name: customerName,
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
      JSON.stringify({
        ok: true,
        events_ingested: eventsIngested,
        is_mock: isMock,
        charges_count: fetchedCharges.length,
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
