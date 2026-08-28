import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { company, prospect, email, website, bottleneck } = await req.json();

    if (!company || !email) {
      throw new Error("Company and email are required");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the primary user (the owner of this Atlas instance)
    const { data: users } = await supabaseAdmin.from("profiles").select("id").limit(1);
    if (!users || users.length === 0) {
      throw new Error("No owner found in profiles");
    }
    const userId = users[0].id;

    // Create the pipeline view / lead
    const { data, error } = await supabaseAdmin.from("pipeline_crm").insert({
      user_id: userId,
      company: company,
      prospect: prospect,
      email: email,
      website: website,
      acquisition_channel: "Inbound",
      stage: "new",
      notes: `Submitted via Inbound Landing Page.\n\nStated Bottleneck: ${bottleneck}`,
      icp_score: 50, // default
    }).select().single();

    if (error) {
      throw error;
    }

    // Also record the research context if we have a bottleneck
    if (bottleneck) {
      await supabaseAdmin.from("atlas_events").insert({
        user_id: userId,
        company_id: data.company_id,
        event_type: "inbound_submission",
        source: "system",
        metadata: { bottleneck },
      });
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
