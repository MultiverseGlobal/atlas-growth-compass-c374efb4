import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function useAcquisitionSimulator() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      try {
        // 1. Find queued runs
        const { data: runs, error } = await supabase
          .from("atlas_acquisition_runs")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "queued")
          .limit(1);

        if (error || !runs || runs.length === 0) return;

        const run = runs[0];

        // 2. Mark as running
        await supabase
          .from("atlas_acquisition_runs")
          .update({ status: "running", started_at: new Date().toISOString() })
          .eq("id", run.id);

        toast.info("Autonomous Agent started a new acquisition run...", { id: `run-${run.id}` });

        // Simulate some time passing
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const icp = run.icp_snapshot as any;
        const department = icp?.buyer_persona?.role || "Engineering";
        
        // Mock data based on the ICP
        const mockOpportunities = [
          { name: `Nexus ${department}`, domain: `nexus-${department.toLowerCase().replace(/[^a-z0-9]/g, '')}.io`, person: "Alex Sterling" },
          { name: `Vanguard Tech`, domain: "vanguardtech.dev", person: "Jordan Lee" },
          { name: `Apex Solutions`, domain: "apex-solutions.co", person: "Casey Smith" }
        ];

        for (const mock of mockOpportunities) {
          // Insert opportunity
          const { data: opp, error: oppError } = await supabase
            .from("atlas_opportunities")
            .insert({
              run_id: run.id,
              user_id: user.id,
              organization_name: mock.name,
              primary_domain: mock.domain,
              pipeline_stage: "discovered",
              fit_score: Math.floor(Math.random() * 20) + 80, // 80-99
            })
            .select()
            .single();

          if (!oppError && opp) {
            // Insert contact
            await supabase
              .from("atlas_contacts")
              .insert({
                opportunity_id: opp.id,
                user_id: user.id,
                full_name: mock.person,
                job_title: icp?.buyer_persona?.seniority || "Director",
                email: `${mock.person.split(" ")[0].toLowerCase()}@${mock.domain}`
              });
          }
        }

        // 3. Mark as completed
        await supabase
          .from("atlas_acquisition_runs")
          .update({ 
            status: "completed", 
            completed_at: new Date().toISOString(),
            items_discovered: mockOpportunities.length,
            items_qualified: mockOpportunities.length
          })
          .eq("id", run.id);

        toast.success(`Acquisition run complete. Found ${mockOpportunities.length} high-fit leads.`, { id: `run-${run.id}` });

      } catch (err) {
        console.error("Acquisition simulator error:", err);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [user]);
}
