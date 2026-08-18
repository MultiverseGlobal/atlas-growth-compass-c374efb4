import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Use service role to bypass RLS for orchestration
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { run_id } = body;

    if (!run_id) {
      throw new Error("Missing run_id");
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
      const { data: draftData, error: draftError } = await supabase.functions.invoke("sourcing-machine", {
        body: {
          action: "generate-outreach",
          prospectName: lead.founder_name || lead.company_name,
          company: lead.company_name,
          research: lead.research_data,
          offer: "Automated Workflow Optimization", // Default fallback
        }
      });
      
      if (!draftError && draftData) {
        const draftContent = typeof draftData === 'string' ? draftData : draftData.outreach || JSON.stringify(draftData);
        await supabase
          .from("kuro_pipeline_view")
          .update({ outreach_draft: draftContent })
          .eq("id", lead.id);
          
        return new Response(JSON.stringify({ message: "Drafted outreach", lead_id: lead.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        console.error("Draft generation failed", draftError);
      }
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
      const { data: painData, error: painError } = await supabase.functions.invoke("sourcing-machine", {
        body: {
          action: "analyze-pain",
          company: lead.company_name,
          website: lead.website,
        }
      });
      
      if (!painError && painData) {
        await supabase
          .from("kuro_pipeline_view")
          .update({ research_data: painData })
          .eq("id", lead.id);
          
        await supabase
          .from("acquisition_runs")
          .update({ researched_count: run.researched_count + 1 })
          .eq("id", run_id);
          
        return new Response(JSON.stringify({ message: "Researched lead", lead_id: lead.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Stage 4: Sourcing & Qualification
    // If we have no qualified leads to process, we need to discover more.
    await supabase
      .from("acquisition_runs")
      .update({ current_stage: "sourcing", current_lead_id: null })
      .eq("id", run_id);
      
    const { data: discoverData, error: discoverError } = await supabase.functions.invoke("sourcing-machine", {
      body: {
        action: "discover-leads",
        source: "clutch",
        industry: "Any",
        keyword: "digital agency"
      }
    });

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

    return new Response(JSON.stringify({ message: "No action taken. Pipeline might be stalled." }), {
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
