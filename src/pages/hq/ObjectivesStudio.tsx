import { useState } from "react";
import { 
  Target, Zap, Lock, Compass, Globe, Sparkles, Building2, Briefcase, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { StaggerGroup } from "@/components/atlas/StaggerGroup";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function ObjectivesStudio() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [isLocking, setIsLocking] = useState(false);
  const [thesis, setThesis] = useState("B2B SaaS teams hiring engineers on Hacker News");
  const [targetQuota, setTargetQuota] = useState("150");
  const [companySize, setCompanySize] = useState("10 - 50 Employees");
  const [fundingStage, setFundingStage] = useState("Seed / Early Stage");
  const [seniorityLevel, setSeniorityLevel] = useState("C-Level / Founder");
  const [department, setDepartment] = useState("Engineering & Tech");
  const [dataSource, setDataSource] = useState("web");
  
  const handleLockThesis = async () => {
    if (!user) {
      toast.error("You must be signed in to lock a thesis.");
      return;
    }
    
    setIsLocking(true);
    toast.info("Synthesizing parameters and locking search thesis...");
    
    try {
      // 1. Insert Objective
      const { data: objective, error: objError } = await supabase
        .from("atlas_objectives")
        .insert({
          user_id: user.id,
          offer_summary: thesis,
          target_hypothesis: `Targeting ${department} professionals at ${companySize} companies with ${fundingStage} funding.`,
          status: 'active'
        })
        .select()
        .single();
        
      if (objError) throw objError;

      // 2. Insert ICP Profile
      const { data: icp, error: icpError } = await supabase
        .from("atlas_icp_profiles")
        .insert({
          user_id: user.id,
          objective_id: objective.id,
          version: 1,
          title: `Initial Hypothesis: ${department}`,
          buyer_persona: { role: department, seniority: seniorityLevel },
          target_geography: ['US', 'UK', 'CA'],
          status: 'approved',
          approved_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (icpError) throw icpError;

      // 3. Insert Acquisition Run
      const { error: runError } = await supabase
        .from("atlas_acquisition_runs")
        .insert({
          user_id: user.id,
          icp_profile_id: icp.id,
          icp_version_snapshot: 1,
          icp_snapshot: icp,
          source_connector: dataSource === 'web' ? 'controlled_agency_feed' : 'metaphor_internal',
          status: 'queued'
        });
        
      if (runError) throw runError;

      toast.success("Thesis Locked. Autonomous agents ready for deployment.");
      navigate("/");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to lock thesis: " + err.message);
    } finally {
      setIsLocking(false);
    }
  };

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen text-foreground relative overflow-y-auto">
      <div className="w-full max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-border/60 pb-5 text-center flex flex-col items-center">
          <div className="h-12 w-12 rounded-2xl bg-foreground text-background flex items-center justify-center mb-4 shadow-md">
            <Target className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-display">
            Objectives Studio
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg">
            Declare commercial intent, define target parameters, and lock your search thesis.
          </p>
        </div>

        <StaggerGroup className="space-y-6">
          {/* Main Intent Block */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border/60 bg-card p-6 shadow-sm space-y-5"
          >
            <div className="flex items-center gap-3 pb-3 border-b border-border/30">
              <Sparkles className="h-5 w-5 text-foreground" />
              <h2 className="text-base font-semibold tracking-tight">Search Thesis</h2>
            </div>
            
            <div className="space-y-3">
              <label className="text-[10px] font-bold font-mono uppercase tracking-wider text-muted-foreground">Natural Language Intent</label>
              <textarea
                value={thesis}
                onChange={(e) => setThesis(e.target.value)}
                placeholder="E.g., Series A B2B SaaS companies in New York hiring frontend engineers..."
                className="w-full h-28 p-4 bg-background border border-border/60 rounded-xl resize-none focus:outline-none focus:border-foreground/50 transition-colors text-sm font-sans shadow-inner"
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-foreground" />
                Atlas will automatically decompose this intent into precise search parameters.
              </p>
            </div>
          </motion.div>

          {/* Parameters Grid */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3 pb-2 border-b border-border/30">
                <Building2 className="h-4 w-4 text-foreground" />
                <h3 className="font-semibold text-sm">Firmographics</h3>
              </div>
              <div className="space-y-4 pt-1">
                <div>
                  <label className="text-[10px] uppercase font-mono font-bold text-muted-foreground block mb-2">Company Size</label>
                  <select 
                    value={companySize}
                    onChange={(e) => setCompanySize(e.target.value)}
                    className="w-full bg-background border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none shadow-sm"
                  >
                    <option>10 - 50 Employees</option>
                    <option>50 - 200 Employees</option>
                    <option>200+ Employees</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-mono font-bold text-muted-foreground block mb-2">Funding Stage</label>
                  <select 
                    value={fundingStage}
                    onChange={(e) => setFundingStage(e.target.value)}
                    className="w-full bg-background border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none shadow-sm"
                  >
                    <option>Seed / Early Stage</option>
                    <option>Series A - B</option>
                    <option>Growth / Series C+</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3 pb-2 border-b border-border/30">
                <Briefcase className="h-4 w-4 text-foreground" />
                <h3 className="font-semibold text-sm">Target Personas</h3>
              </div>
              <div className="space-y-4 pt-1">
                <div>
                  <label className="text-[10px] uppercase font-mono font-bold text-muted-foreground block mb-2">Seniority Level</label>
                  <select 
                    value={seniorityLevel}
                    onChange={(e) => setSeniorityLevel(e.target.value)}
                    className="w-full bg-background border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none shadow-sm"
                  >
                    <option>C-Level / Founder</option>
                    <option>VP / Director</option>
                    <option>Manager</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-mono font-bold text-muted-foreground block mb-2">Department</label>
                  <select 
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full bg-background border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none shadow-sm"
                  >
                    <option>Engineering & Tech</option>
                    <option>Sales & Marketing</option>
                    <option>Operations</option>
                  </select>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Execution & Lock Grid */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm space-y-5">
              <h3 className="font-semibold text-sm flex items-center gap-2 pb-2 border-b border-border/30">
                <Compass className="h-4 w-4 text-foreground" />
                Execution Parameters
              </h3>
              
              <div className="space-y-5">
                <div>
                  <label className="text-[10px] font-bold font-mono uppercase tracking-wider text-muted-foreground flex justify-between mb-2">
                    <span>Target Quota</span>
                    <span className="text-foreground">{targetQuota} Leads</span>
                  </label>
                  <input 
                    type="range" 
                    min="50" max="1000" step="50"
                    value={targetQuota}
                    onChange={(e) => setTargetQuota(e.target.value)}
                    className="w-full accent-foreground"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold font-mono uppercase tracking-wider text-muted-foreground mb-2 block">
                    Primary Data Source
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div 
                      onClick={() => setDataSource('web')}
                      className={`rounded-lg p-2 flex items-center justify-center gap-2 cursor-pointer text-xs font-medium transition-colors ${dataSource === 'web' ? 'border border-foreground/50 bg-foreground/10 text-foreground' : 'border border-border/60 bg-background text-muted-foreground hover:bg-muted shadow-sm'}`}
                    >
                      <Globe className="h-3.5 w-3.5" /> Web/Social
                    </div>
                    <div 
                      onClick={() => setDataSource('proprietary')}
                      className={`rounded-lg p-2 flex items-center justify-center gap-2 cursor-pointer text-xs font-medium transition-colors ${dataSource === 'proprietary' ? 'border border-foreground/50 bg-foreground/10 text-foreground' : 'border border-border/60 bg-background text-muted-foreground hover:bg-muted shadow-sm'}`}
                    >
                      <Filter className="h-3.5 w-3.5" /> Proprietary
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-foreground/30 transition-colors">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Lock className="h-24 w-24 text-foreground" />
              </div>
              
              <div className="pb-4">
                <h3 className="text-lg font-bold text-foreground">Lock Thesis</h3>
                <p className="text-xs text-muted-foreground mt-1 relative z-10 max-w-[200px]">
                  Deploy autonomous agents to begin decomposing intent and discovering targets.
                </p>
              </div>

              <Button 
                onClick={handleLockThesis}
                disabled={isLocking || !thesis.trim()}
                className="w-full bg-foreground hover:bg-foreground/90 text-background font-semibold h-12 text-sm relative z-10 shadow-md transition-transform active:scale-[0.98]"
              >
                {isLocking ? (
                  <>
                    <Zap className="h-4 w-4 mr-2 animate-pulse" />
                    Synthesizing Parameters...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Lock & Deploy
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </StaggerGroup>
      </div>
    </div>
  );
}
