import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get all github sources linked to maps
    const { data: sources, error: sourcesError } = await supabase
      .from("sources")
      .select("id, map_id, user_id, label, provider")
      .eq("provider", "github");

    if (sourcesError) throw sourcesError;

    const results = [];

    for (const source of sources ?? []) {
      const { map_id, user_id, label: repo } = source;
      try {
        // Step 1: Run sync-github edge function logic server-side
        const syncResponse = await fetch(`${supabaseUrl}/functions/v1/sync-github`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ map_id, repo_full_name: repo }),
        });
        
        if (!syncResponse.ok) {
          throw new Error(`Sync function failed: ${await syncResponse.text()}`);
        }

        // Step 2: Run diagnose-map edge function logic server-side
        const diagnoseResponse = await fetch(`${supabaseUrl}/functions/v1/diagnose-map`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ map_id }),
        });

        if (!diagnoseResponse.ok) {
          throw new Error(`Diagnose function failed: ${await diagnoseResponse.text()}`);
        }

        const llm = await diagnoseResponse.json();

        // Step 3: Fetch the map goal statement
        const { data: mapData } = await supabase
          .from("maps")
          .select("goal_statement")
          .eq("id", map_id)
          .maybeSingle();

        const mapGoal = mapData?.goal_statement || "My Goal";
        const conf = (["emerging", "building", "established"].includes(llm.confidence)
          ? llm.confidence
          : "emerging") as "emerging" | "established";

        const newWaypoints = [
          { kind: "goal", title: mapGoal, confidence: "established" },
          { kind: "constraint", title: llm.constraint, confidence: conf },
          { kind: "evidence", title: llm.evidence, confidence: conf },
          { kind: "move", title: llm.move, confidence: "established" },
        ];

        // Step 4: Persist waypoints in DB
        await supabase.from("waypoints").delete().eq("map_id", map_id);
        await supabase.from("waypoints").insert(
          newWaypoints.map((w, idx) => ({
            map_id,
            user_id,
            kind: w.kind,
            title: w.title,
            confidence: w.confidence === "building" ? "emerging" : w.confidence,
            position: idx,
          }))
        );

        // Step 5: Update map confidence
        const newConf = conf === "established" ? "established" : "emerging";
        await supabase.from("maps").update({ confidence: newConf }).eq("id", map_id);

        results.push({ map_id, ok: true });
      } catch (err: any) {
        console.error(`[daily-sync-cron] Error syncing map ${map_id}:`, err.message);
        results.push({ map_id, ok: false, error: err.message });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
