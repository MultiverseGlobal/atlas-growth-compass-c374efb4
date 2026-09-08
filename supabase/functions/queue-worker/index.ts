import { createClient } from "jsr:@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This function is designed to be called by pg_cron every minute.
// It picks up one pending background job and processes it.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // ── 1. Claim a pending job (atomic update to avoid double-processing) ────
    const { data: jobs, error: claimError } = await adminClient
      .from("atlas_background_jobs")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1);

    if (claimError) throw claimError;
    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ message: "No pending jobs." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const job = jobs[0];

    // Mark as processing
    await adminClient
      .from("atlas_background_jobs")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", job.id);

    // ── 2. Dispatch based on job type ────────────────────────────────────────
    let result: any = null;
    let jobError: string | null = null;

    if (job.type === "sourcing_run") {
      const payload = job.payload as {
        query: string;
        industry?: string;
        limit?: number;
        run_id?: string;
      };

      // Invoke sourcing-machine with background=true so it doesn't time out the client
      const response = await fetch(`${supabaseUrl}/functions/v1/sourcing-machine`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "discover-leads",
          user_id: job.user_id,
          query: payload.query,
          industry: payload.industry,
          limit: payload.limit ?? 50,
          run_id: payload.run_id,
          background: true,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`sourcing-machine failed: ${errText}`);
      }

      result = await response.json();
    } else if (job.type === "send_ready_outreach") {
      // Find all outreach that has a clario_video_url but hasn't been sent yet
      const { data: readyDrafts } = await adminClient
        .from("atlas_outreach")
        .select("*")
        .eq("user_id", job.user_id)
        .eq("status", "waiting_for_clario")
        .not("clario_video_url", "is", null)
        .eq("auto_send_enabled", true);

      const sent: string[] = [];
      for (const draft of readyDrafts ?? []) {
        // Get user settings for sender info
        const { data: settings } = await adminClient
          .from("atlas_user_settings")
          .select("resend_api_key, sender_name, sender_email")
          .eq("user_id", job.user_id)
          .single();

        const resendKey = settings?.resend_api_key ?? Deno.env.get("RESEND_API_KEY");
        if (!resendKey || !draft.to_email) continue;

        // Inject Clario video URL into the draft body
        const body = draft.draft_body.replace(
          "{{CLARIO_VIDEO_URL}}",
          draft.clario_video_url
        );

        const senderName = settings?.sender_name ?? "Atlas";
        const senderEmail = settings?.sender_email ?? "onboarding@resend.dev";

        const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111318;line-height:1.7;font-size:15px;max-width:600px;margin:0 auto;padding:32px 24px}p{margin:0 0 16px}.cta{display:inline-block;background:#111318;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:8px 0}.signature{margin-top:32px;padding-top:16px;border-top:1px solid #EBEAE5;color:#6B7280;font-size:13px}</style>
</head><body>
${body.split("\n\n").map((p: string) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("")}
${draft.clario_video_url ? `<p><a class="cta" href="${draft.clario_video_url}">▶ Watch the demo we built for you</a></p>` : ""}
<div class="signature"><p><strong>${senderName}</strong></p><p>Sent via Atlas Growth Engine</p></div>
</body></html>`;

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${senderName} <${senderEmail}>`,
            to: [draft.to_email],
            subject: draft.draft_subject,
            html: htmlBody,
            text: body,
            tags: [{ name: "source", value: "atlas_outreach" }],
          }),
        });

        if (resendRes.ok) {
          const resendData = await resendRes.json();
          await adminClient
            .from("atlas_outreach")
            .update({
              status: "auto_sent",
              sent_at: new Date().toISOString(),
              resend_id: resendData.id,
            })
            .eq("id", draft.id);
          sent.push(draft.id);
        }
      }

      result = { sent_count: sent.length, sent_ids: sent };
    } else {
      throw new Error(`Unknown job type: ${job.type}`);
    }

    // ── 3. Mark complete ─────────────────────────────────────────────────────
    await adminClient
      .from("atlas_background_jobs")
      .update({
        status: "completed",
        result,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    return new Response(JSON.stringify({ ok: true, job_id: job.id, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("queue-worker error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
