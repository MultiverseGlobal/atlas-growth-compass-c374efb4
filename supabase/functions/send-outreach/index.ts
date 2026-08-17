import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendRequest {
  lead_id?: string;
  to_email: string;
  to_name: string;
  company_name: string;
  subject: string;
  body: string;
  sender_name?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Verify user JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: SendRequest = await req.json();
    const { lead_id, to_email, to_name, company_name, subject, body: messageBody, sender_name = "Ben" } = body;

    if (!to_email || !subject || !messageBody) {
      return new Response(JSON.stringify({ error: "to_email, subject, and body are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format the email body as clean HTML
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111318; line-height: 1.7; font-size: 15px; max-width: 600px; margin: 0 auto; padding: 32px 24px; }
    p { margin: 0 0 16px; }
    .signature { margin-top: 32px; padding-top: 16px; border-top: 1px solid #EBEAE5; color: #6B7280; font-size: 13px; }
  </style>
</head>
<body>
  ${messageBody.split("\n\n").map((para: string) =>
    `<p>${para.replace(/\n/g, "<br>")}</p>`
  ).join("")}
  <div class="signature">
    <p><strong>${sender_name}</strong></p>
    <p>AI Operations · <a href="https://cal.com" style="color:#4E6CF2;">Book a call</a></p>
  </div>
</body>
</html>`;

    // ─── Send via Resend ─────────────────────────────────────────────────────
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${sender_name} <onboarding@resend.dev>`,
        to: [to_email],
        subject,
        html: htmlBody,
        text: messageBody,
        tags: [
          { name: "source", value: "atlas_outreach" },
          { name: "company", value: company_name.slice(0, 40) },
        ],
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend error:", resendData);
      return new Response(JSON.stringify({ error: resendData?.message ?? "Email delivery failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendId: string = resendData.id;
    const sentAt = new Date().toISOString();
    const followUpDue = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    // ─── Log to outreach_messages ────────────────────────────────────────────
    await supabase.from("outreach_messages").insert({
      user_id: user.id,
      lead_id: lead_id ?? null,
      type: "cold_email",
      subject,
      body: messageBody,
      to_email,
      to_name,
      company_name,
      status: "sent",
      resend_id: resendId,
      sent_at: sentAt,
      follow_up_due: followUpDue,
    });

    // ─── Mark lead as contacted in pipeline ─────────────────────────────────
    if (lead_id) {
      await supabase
        .from("kuro_pipeline_view")
        .update({
          is_contacted: true,
          stage: "contacted",
          updated_at: sentAt,
        })
        .eq("id", lead_id)
        .eq("user_id", user.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        resend_id: resendId,
        sent_at: sentAt,
        follow_up_due: followUpDue,
        message: `Email delivered to ${to_name} at ${company_name}`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("send-outreach error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
