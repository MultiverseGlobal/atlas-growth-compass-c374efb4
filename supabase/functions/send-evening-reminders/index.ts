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

    const todayStr = new Date().toISOString().split("T")[0];

    // 1. Fetch commitments for today that haven't checked-in yet, and where no reminder has been sent
    const { data: commitments, error: commitError } = await supabase
      .from("commitments")
      .select("id, map_id, waypoint_id, user_id, timezone, status, reminder_sent, date")
      .eq("date", todayStr)
      .eq("status", "committed")
      .eq("reminder_sent", false);

    if (commitError) throw commitError;

    const results = [];

    for (const commitment of commitments || []) {
      try {
        // Calculate the local hour for the user's timezone using Intl
        const options = {
          timeZone: commitment.timezone || "UTC",
          hour: "numeric" as const,
          hour12: false,
        };
        const formatter = new Intl.DateTimeFormat("en-US", options);
        const localHour = parseInt(formatter.format(new Date()), 10);

        // Send check-in reminder if local time is 6 PM (18:00) or later
        if (localHour >= 18) {
          // A. Fetch move waypoint details
          const { data: waypoint } = await supabase
            .from("waypoints")
            .select("title")
            .eq("id", commitment.waypoint_id)
            .maybeSingle();

          const moveTitle = waypoint?.title || "today's move";

          // B. Get user email
          const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(commitment.user_id);
          if (userErr || !userData?.user) {
            console.warn(`[evening-reminders] Could not load user details for user ${commitment.user_id}:`, userErr);
            continue;
          }
          const userEmail = userData.user.email;

          if (userEmail) {
            const emailBody = `Hi,\n\nDid you complete today's move: "${moveTitle}"?\n\nOpen Atlas to log your check-in: https://atlas-scale.vercel.app/app\n\n- Atlas`;
            
            console.log(`[evening-reminders] Sending email reminder to ${userEmail} (Timezone: ${commitment.timezone}, Local Hour: ${localHour}).`);

            const resendApiKey = Deno.env.get("RESEND_API_KEY");
            if (resendApiKey) {
              const emailRes = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${resendApiKey}`,
                },
                body: JSON.stringify({
                  from: "Atlas Loop <onboarding@resend.dev>",
                  to: userEmail,
                  subject: "Did you do it?",
                  text: emailBody,
                }),
              });

              if (!emailRes.ok) {
                console.error(`[evening-reminders] Resend error: ${await emailRes.text()}`);
              }
            } else {
              console.log(`[evening-reminders] Mock email reminder sent (no RESEND_API_KEY configured):\n${emailBody}`);
            }
          }

          // C. Create in-app notification
          await supabase
            .from("notifications")
            .insert({
              user_id: commitment.user_id,
              kind: "evening_checkin",
              title: "Did you do it?",
              body: `Did you complete today's move: "${moveTitle}"?`,
              link_url: "/app",
            });

          // D. Mark reminder as sent
          await supabase
            .from("commitments")
            .update({ reminder_sent: true })
            .eq("id", commitment.id);

          results.push({ commitment_id: commitment.id, status: "sent" });
        } else {
          results.push({ commitment_id: commitment.id, status: "skipped_too_early", hour: localHour });
        }
      } catch (err: any) {
        console.error(`[evening-reminders] Error processing commitment ${commitment.id}:`, err.message);
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
