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
          {
            kind: "move",
            title: llm.move,
            confidence: "established",
            metadata: {
              evidence: llm.evidence_sources || null,
              predicted_signal_type: llm.predicted_signal_type || "unclear"
            },
            predicted_signal: llm.predicted_signal || null,
            predicted_direction: llm.predicted_direction || null,
            predicted_baseline_value: llm.predicted_baseline_value || null,
            check_back_date: llm.check_back_date || null,
            result_status: llm.result_status || "pending",
            result_summary: llm.result_summary || null,
          },
        ];

        // Step 4: Persist waypoints in DB - keep completed history, delete active ones only
        await supabase.from("waypoints").delete().eq("map_id", map_id).is("completed_at", null);
        await supabase.from("waypoints").insert(
          newWaypoints.map((w, idx) => {
            const wpObj: any = {
              map_id,
              user_id,
              kind: w.kind,
              title: w.title,
              confidence: w.confidence === "building" ? "emerging" : w.confidence,
              position: idx,
              metadata: (w as any).metadata || null,
            };
            if (w.kind === "move") {
              wpObj.predicted_signal = (w as any).predicted_signal;
              wpObj.predicted_direction = (w as any).predicted_direction;
              wpObj.predicted_baseline_value = (w as any).predicted_baseline_value;
              wpObj.check_back_date = (w as any).check_back_date;
              wpObj.result_status = (w as any).result_status;
              wpObj.result_summary = (w as any).result_summary;
            }
            return wpObj;
          })
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

    // Step 6: Prediction Check-back phase
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const { data: pendingWaypoints } = await supabase
        .from("waypoints")
        .select("id, map_id, user_id, metadata, predicted_signal, predicted_direction, predicted_baseline_value, check_back_date")
        .eq("kind", "move")
        .eq("result_status", "pending")
        .lte("check_back_date", todayStr);

      for (const wp of pendingWaypoints ?? []) {
        const { data: signals } = await supabase
          .from("signals")
          .select("title, occurred_at, payload")
          .eq("map_id", wp.map_id)
          .order("occurred_at", { ascending: false });

        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        // Calculate counts
        const commitsThisWeek = signals?.filter(s => new Date(s.occurred_at) >= oneWeekAgo && (s.payload?.type === "commit" || s.title.startsWith("Commit:"))).length || 0;
        const updatesThisWeek = signals?.filter(s => new Date(s.occurred_at) >= oneWeekAgo && s.payload?.type === "notion").length || 0;
        const chargesThisWeek = signals?.filter(s => new Date(s.occurred_at) >= oneWeekAgo && s.payload?.type === "stripe").length || 0;
        const slackThisWeek = signals?.filter(s => new Date(s.occurred_at) >= oneWeekAgo && s.payload?.type === "slack").length || 0;
        const meetingMinutesThisWeek = signals?.filter(s => new Date(s.occurred_at) >= oneWeekAgo && s.payload?.type === "google").reduce((acc, s) => acc + (s.payload?.duration_minutes || 0), 0) || 0;
        const meetingHours = Math.round(meetingMinutesThisWeek / 60);

        const baseline = parseFloat(wp.predicted_baseline_value || "");
        let status: "held" | "missed" | "unclear" = "unclear";
        let summary = "";

        const signalType = wp.metadata?.predicted_signal_type || "unclear";
        if (signalType === "unclear" || isNaN(baseline)) {
          status = "unclear";
          summary = `Predicted: ${wp.predicted_signal || "signal"}. Status is unclear because it cannot be measured programmatically.`;
        } else {
          let freshValue = 0;
          let unit = "units";
          if (signalType === "github_commits") {
            freshValue = commitsThisWeek;
            unit = "commits";
          } else if (signalType === "notion_updates") {
            freshValue = updatesThisWeek;
            unit = "updates";
          } else if (signalType === "stripe_charges") {
            freshValue = chargesThisWeek;
            unit = "charges";
          } else if (signalType === "slack_messages") {
            freshValue = slackThisWeek;
            unit = "messages";
          } else if (signalType === "meeting_hours") {
            freshValue = meetingHours;
            unit = "hours";
          }

          const dir = wp.predicted_direction;
          const arrow = dir === "up" ? "↑" : dir === "down" ? "↓" : "→";

          if (dir === "up") {
            status = freshValue > baseline ? "held" : "missed";
          } else if (dir === "down") {
            status = freshValue < baseline ? "held" : "missed";
          } else if (dir === "flat") {
            status = freshValue === baseline ? "held" : "missed";
          }

          summary = `Predicted: ${wp.predicted_signal} ${arrow}. Then: ${baseline} → ${freshValue} ${unit} this week.`;
        }

        // Update the waypoint prediction result
        await supabase
          .from("waypoints")
          .update({
            result_status: status,
            result_summary: summary,
          })
          .eq("id", wp.id);
      }
    } catch (err: any) {
      console.error("[daily-sync-cron] Error in prediction check-back phase:", err.message);
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
