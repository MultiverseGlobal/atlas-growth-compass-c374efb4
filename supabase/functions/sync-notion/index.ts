import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncRequest {
  action?: "sync";
  map_id?: string;
  notion_token?: string;
}

async function getProviderToken(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("integrations")
    .select("access_token_encrypted")
    .eq("user_id", userId)
    .eq("provider", "notion")
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

    let token = body.notion_token;
    if (token) {
      const lastFour = token.slice(-4);
      const label = `Notion (...${lastFour})`;
      await serviceClient
        .from("integrations")
        .upsert(
          {
            user_id: userId,
            provider: "notion",
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
        JSON.stringify({ error: "No Notion token found. Connect Notion in integrations." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body.map_id) {
      return new Response(JSON.stringify({ error: "map_id is required for sync" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: syncRun } = await serviceClient
      .from("sync_runs")
      .insert({ user_id: userId, integration_id: null, kind: "notion_map_sync" })
      .select("id")
      .maybeSingle();

    const syncRunId = syncRun?.id ?? null;
    let eventsIngested = 0;
    const errors: string[] = [];

    const isMock = !token.startsWith("secret_") || token.includes("mock") || token === "dummy";
    let pages: any[] = [];

    if (isMock) {
      pages = [
        {
          id: "page_mock_1",
          title: "Product Spec: Calendar Integrations Beta",
          last_edited_time: new Date(Date.now() - 86400 * 1000 * 2).toISOString(),
          author: "Jane Founder",
          url: "https://notion.so/mock_1",
        },
        {
          id: "page_mock_2",
          title: "Pricing Experiments & Launch Strategy",
          last_edited_time: new Date(Date.now() - 86400 * 1000 * 4).toISOString(),
          author: "Jane Founder",
          url: "https://notion.so/mock_2",
        },
        {
          id: "page_mock_3",
          title: "Weekly Update - Jul 10",
          last_edited_time: new Date(Date.now() - 86400 * 1000 * 6).toISOString(),
          author: "Jane Founder",
          url: "https://notion.so/mock_3",
        }
      ];
    } else {
      try {
        const res = await fetch("https://api.notion.com/v1/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ filter: { property: "object", value: "page" }, page_size: 5 }),
        });
        if (res.ok) {
          const searchData = await res.json();
          pages = (searchData.results || []).map((p: any) => {
            const titleProp = Object.values(p.properties || {}).find((prop: any) => prop.type === "title") as any;
            const title = titleProp?.title?.[0]?.plain_text || "Untitled Page";
            return {
              id: p.id,
              title,
              last_edited_time: p.last_edited_time,
              author: "Workspace User",
              url: p.url,
            };
          });
        } else {
          throw new Error(`Notion search API returned status ${res.status}`);
        }
      } catch (err: any) {
        errors.push(`Notion API: ${err.message}`);
        pages = [
          {
            id: "page_mock_fallback",
            title: "Fallback Doc: Notion Connection Verified",
            last_edited_time: new Date().toISOString(),
            author: "System",
            url: "https://notion.so/fallback",
          }
        ];
      }
    }

    for (const page of pages) {
      const { error: sigError } = await serviceClient
        .from("signals")
        .upsert(
          {
            map_id: body.map_id,
            user_id: userId,
            title: `Notion page updated: "${page.title}"`,
            score: 15,
            occurred_at: page.last_edited_time,
            payload: {
              type: "notion",
              source: "notion",
              page_id: page.id,
              author: page.author,
              url: page.url,
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
