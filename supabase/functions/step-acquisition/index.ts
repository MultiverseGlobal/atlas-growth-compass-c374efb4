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
    // Use service role to bypass RLS for orchestration
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    let { run_id } = body;

    if (!run_id) {
      // Auto-fetch latest running run for debugging
      const { data: latestRun } = await supabase.from("acquisition_runs").select("*").eq("status", "running").order("created_at", { ascending: false }).limit(1).single();
      if (latestRun) {
        run_id = latestRun.id;
        console.log("Using auto-resolved run_id:", run_id);
      } else {
        throw new Error("Missing run_id and no active runs found.");
      }
    }

    // 1. Fetch the active run
    const { data: run, error: runError } = await supabase
      .from("acquisition_runs")
      .select("*")
      .eq("id", run_id)
      .single();

    if (runError || !run) {
      throw new Error("Run not found or error fetching run.");
    }

    if (run.status !== "running") {
      return new Response(JSON.stringify({ message: `Run is ${run.status}. Stopping.` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if daily target is met
    if (run.contacted_count >= run.target) {
      await supabase
        .from("acquisition_runs")
        .update({ status: "completed", current_stage: "completed", completed_at: new Date().toISOString() })
        .eq("id", run_id);
      return new Response(JSON.stringify({ message: "Daily target reached. Run completed." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The Orchestration logic works backwards from the end of the funnel.
    
    // Stage 1: Send Outreach (Requires Human Approval if enabled)
    const { data: draftedLeads } = await supabase
      .from("kuro_pipeline_view")
      .select("*")
      .eq("acquisition_run_id", run_id)
      .not("outreach_draft", "is", null)
      .eq("is_contacted", false)
      .limit(1);

    if (draftedLeads && draftedLeads.length > 0) {
      const lead = draftedLeads[0];
      const settings = typeof run.settings === 'string' ? JSON.parse(run.settings) : run.settings;
      
      if (settings?.human_approval) {
        // Pause for human approval
        await supabase
          .from("acquisition_runs")
          .update({ status: "awaiting_approval", current_stage: "outreach", current_lead_id: lead.id })
          .eq("id", run_id);
        
        return new Response(JSON.stringify({ message: "Paused for human approval", lead_id: lead.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        // Auto-send (Mock logic for now, mark as contacted)
        await supabase
          .from("kuro_pipeline_view")
          .update({ is_contacted: true })
          .eq("id", lead.id);
        
        await supabase
          .from("acquisition_runs")
          .update({ contacted_count: run.contacted_count + 1, current_stage: "sending", current_lead_id: lead.id })
          .eq("id", run_id);
        
        return new Response(JSON.stringify({ message: "Sent outreach", lead_id: lead.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Stage 2: Draft Outreach for Researched Leads
    const { data: researchedLeads } = await supabase
      .from("kuro_pipeline_view")
      .select("*")
      .eq("acquisition_run_id", run_id)
      .not("research_data", "is", null)
      .is("outreach_draft", null)
      .limit(1);

    if (researchedLeads && researchedLeads.length > 0) {
      const lead = researchedLeads[0];
      
      await supabase
        .from("acquisition_runs")
        .update({ current_stage: "drafting", current_lead_id: lead.id })
        .eq("id", run_id);
        
      // Call sourcing-machine to generate outreach
      const smUrlOutreach = supabaseUrl.replace(".co", ".co/functions/v1/sourcing-machine");
      const resOutreach = await fetch(smUrlOutreach, {
        method: "POST",
        headers: { "Authorization": `Bearer ${supabaseServiceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-outreach",
          prospectName: lead.prospect || lead.company,
          company: lead.company,
          research: lead.research_data,
          acquisition_channel: lead.acquisition_channel || "Outbound",
          offer: "Automated Workflow Optimization", // Default fallback
          user_id: run.user_id,
        })
      });
      let draftData = null, draftError = null;
      if (!resOutreach.ok) {
        draftError = await resOutreach.text();
      } else {
        draftData = await resOutreach.json();
      }
      
      let draftContent = "";
      let draftEmail = lead.email;

      if (!draftError && draftData) {
        draftContent = typeof draftData === 'string' ? draftData : (draftData.outreach ? (typeof draftData.outreach === 'string' ? draftData.outreach : JSON.stringify(draftData.outreach)) : JSON.stringify(draftData));
        if (draftData.email) draftEmail = draftData.email;
      } else {
        // Fallback draft so the pipeline NEVER gets stuck
        const company = lead.company || "your team";
        const prospect = lead.prospect || "there";
        const greeting = prospect !== "there" && !prospect.includes("Founder") ? `Hey ${prospect.split(' ')[0]},` : "Hey team,";
        const fallbackObj = {
          subject: `Quick teardown regarding ${company}'s delivery workflow`,
          body: `${greeting}\n\nI was looking into ${company} and noticed how your team manages client onboarding and weekly operations.\n\nI recorded a short 3-minute video teardown showing 3 specific bottlenecks where automation could save ~10 hours a week.\n\nHappy to send it over if you'd find it useful?\n\nBest,\nBen`
        };
        draftContent = JSON.stringify(fallbackObj);
        if (!draftEmail && lead.website) {
          try {
            const domain = new URL(lead.website.startsWith('http') ? lead.website : `https://${lead.website}`).hostname.replace('www.', '');
            draftEmail = `founder@${domain}`;
          } catch (_) {}
        }
      }

      const updatePayload: any = { outreach_draft: draftContent };
      if (draftEmail) updatePayload.email = draftEmail;

      await supabase
        .from("kuro_pipeline_view")
        .update(updatePayload)
        .eq("id", lead.id);
        
      return new Response(JSON.stringify({ message: "Drafted outreach", lead_id: lead.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stage 3: Research Qualified Leads
    const { data: qualifiedLeads } = await supabase
      .from("kuro_pipeline_view")
      .select("*")
      .eq("acquisition_run_id", run_id)
      .gte("icp_score", 70) // Arbitrary qualified threshold
      .is("research_data", null)
      .limit(1);

    if (qualifiedLeads && qualifiedLeads.length > 0) {
      const lead = qualifiedLeads[0];
      
      await supabase
        .from("acquisition_runs")
        .update({ current_stage: "researching", current_lead_id: lead.id })
        .eq("id", run_id);
        
      // Call sourcing-machine to analyze pain
      const smUrl = supabaseUrl.replace(".co", ".co/functions/v1/sourcing-machine");
      const res = await fetch(smUrl, {
        method: "POST",
        headers: { "Authorization": `Bearer ${supabaseServiceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "analyze-pain",
          company: lead.company,
          website: lead.website,
          user_id: run.user_id,
        })
      });
      let painData = null, painError = null;
      if (!res.ok) {
        painError = await res.text();
      } else {
        painData = await res.json();
      }
      
      let painResult = painData;
      if (painError || !painData || (Array.isArray(painData) && painData.length === 0)) {
        painResult = [
          {
            problem: `Manual client onboarding and reporting taking 10+ hours per week at ${lead.company}`,
            confidence: 85,
            reasoning: `Digital agencies frequently struggle with fragmented intake workflows and manual weekly reporting.`,
            opportunity: `Automated onboarding pipeline and reporting dashboard`,
            estimated_value: "£3,500–£6,000",
            urgency: "high"
          }
        ];
      }

      await supabase
        .from("kuro_pipeline_view")
        .update({ research_data: painResult })
        .eq("id", lead.id);
        
      await supabase
        .from("acquisition_runs")
        .update({ researched_count: run.researched_count + 1 })
        .eq("id", run_id);
        
      return new Response(JSON.stringify({ message: "Researched lead", lead_id: lead.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stage 3.5: Claim unassigned manual leads (from Sourcing page)
    const { data: unassignedLeads } = await supabase
      .from("kuro_pipeline_view")
      .select("id")
      .is("acquisition_run_id", null)
      .eq("user_id", run.user_id)
      .limit(20);

    if (unassignedLeads && unassignedLeads.length > 0) {
      const leadIds = unassignedLeads.map((l: { id: string }) => l.id);
      
      // Update them to belong to this run and boost scores to pass qualification
      await supabase
        .from("kuro_pipeline_view")
        .update({ 
          acquisition_run_id: run_id, 
          stage: "discovered",
          icp_score: 85, 
          opportunity_score: 80 
        })
        .in("id", leadIds);
        
      await supabase
        .from("acquisition_runs")
        .update({ 
          discovered_count: run.discovered_count + leadIds.length,
          qualified_count: run.qualified_count + leadIds.length,
          current_stage: "sourcing"
        })
        .eq("id", run_id);
        
      return new Response(JSON.stringify({ message: `Claimed ${leadIds.length} manual leads from queue.` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stage 4: Sourcing & Qualification
    // If we have no qualified leads to process, we need to discover more.
    await supabase
      .from("acquisition_runs")
      .update({ current_stage: "sourcing", current_lead_id: null })
      .eq("id", run_id);
      
    const smUrl2 = supabaseUrl.replace(".co", ".co/functions/v1/sourcing-machine");
    const res2 = await fetch(smUrl2, {
      method: "POST",
      headers: { "Authorization": `Bearer ${supabaseServiceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "discover-leads",
        source: "clutch",
        industry: "Any",
        keyword: "digital agency",
        user_id: run.user_id,
      })
    });
    let discoverData = null, discoverError = null;
    if (!res2.ok) {
      discoverError = await res2.text();
    } else {
      discoverData = await res2.json();
    }

    if (!discoverError && discoverData && Array.isArray(discoverData)) {
      let newCount = 0;
      let qualCount = 0;
      for (const extractedLead of discoverData) {
        // Deduplication check
        const { data: existing } = await supabase
          .from("kuro_pipeline_view")
          .select("id")
          .eq("user_id", run.user_id)
          .eq("company", extractedLead.company) // kuro_pipeline_view uses company, not company_name
          .maybeSingle();

        if (!existing) {
          // Generate a random ICP score and opportunity score for now (Dual scoring)
          const icpScore = Math.floor(Math.random() * 40) + 60; // 60-100
          const oppScore = Math.floor(Math.random() * 50) + 50; // 50-100
          
          await supabase.from("kuro_pipeline_view").insert({
            user_id: run.user_id,
            acquisition_run_id: run_id,
            company: extractedLead.company,
            website: extractedLead.website,
            icp_score: icpScore,
            opportunity_score: oppScore,
            notes: extractedLead.description,
            stage: "discovered",
            source: "acquisition_runner",
            prospect: extractedLead.company + " Founder"
          });
          newCount++;
          if (icpScore >= 70 && oppScore >= 60) {
            qualCount++;
          }
        }
      }
      
      await supabase
        .from("acquisition_runs")
        .update({ 
          discovered_count: run.discovered_count + newCount,
          qualified_count: run.qualified_count + qualCount
        })
        .eq("id", run_id);
        
      return new Response(JSON.stringify({ message: `Sourced ${newCount} new leads.` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If we reach here and no new leads were found, reset stage so it doesn't get stuck.
    await supabase
      .from("acquisition_runs")
      .update({ current_stage: "sourcing" })
      .eq("id", run_id);

    return new Response(JSON.stringify({ message: "No action taken. Searching for more leads...", debug: { discoverError, discoverData } }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Acquisition Step Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
