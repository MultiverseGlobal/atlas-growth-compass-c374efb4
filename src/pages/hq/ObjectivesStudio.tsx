import { useState } from "react";
import { 
  Target, Zap, Lock, Compass, Globe, Sparkles, Building2, Briefcase, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { StaggerGroup } from "@/components/atlas/StaggerGroup";

export default function ObjectivesStudio() {
  const navigate = useNavigate();
  const [isLocking, setIsLocking] = useState(false);
  const [thesis, setThesis] = useState("B2B SaaS teams hiring engineers on Hacker News");
  const [targetQuota, setTargetQuota] = useState("150");
  
  const handleLockThesis = () => {
    setIsLocking(true);
    toast.info("Synthesizing parameters and locking search thesis...");
    setTimeout(() => {
      setIsLocking(false);
      toast.success("Thesis Locked. Autonomous agents ready for deployment.");
      navigate("/hq/engine");
    }, 2000);
  };

  return (
    <div className="p-6 pt-[120px] md:p-8 md:pt-[120px] space-y-8 bg-background min-h-screen text-foreground relative overflow-hidden flex flex-col items-center">
      <div className="w-full max-w-5xl space-y-8">
        {/* Header */}
        <div className="border-b border-border/60 pb-5">
        <h1 className="text-3xl font-bold tracking-tight font-display flex items-center gap-3">
          <Target className="h-8 w-8 text-foreground" />
          Objectives Studio
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Declare commercial intent, define target parameters, and lock your search thesis.
        </p>
      </div>

      <StaggerGroup className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Thesis Definition */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 space-y-6"
        >
          <div className="rounded-xl border border-border/60 bg-card p-6 shadow-lg space-y-5">
            <div className="flex items-center gap-3 pb-2 border-b border-border/30">
              <Sparkles className="h-5 w-5 text-foreground" />
              <h2 className="text-lg font-semibold tracking-tight">Search Thesis</h2>
            </div>
            
            <div className="space-y-3">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Natural Language Intent</label>
              <textarea
                value={thesis}
                onChange={(e) => setThesis(e.target.value)}
                placeholder="E.g., Series A B2B SaaS companies in New York hiring frontend engineers..."
                className="w-full h-32 p-4 bg-background border border-border/60 rounded-xl resize-none focus:outline-none focus:border-foreground/50 transition-colors text-sm font-sans"
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-foreground" />
                Atlas will automatically decompose this intent into precise search parameters.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-border/60 bg-card p-6 shadow-lg space-y-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-foreground" />
                <h3 className="font-semibold text-sm">Firmographics</h3>
              </div>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-[10px] uppercase font-mono text-muted-foreground block mb-1">Company Size</label>
                  <select className="w-full bg-background border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option>10 - 50 Employees</option>
                    <option>50 - 200 Employees</option>
                    <option>200+ Employees</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-mono text-muted-foreground block mb-1">Funding Stage</label>
                  <select className="w-full bg-background border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option>Seed / Early Stage</option>
                    <option>Series A - B</option>
                    <option>Growth / Series C+</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-6 shadow-lg space-y-4">
              <div className="flex items-center gap-3">
                <Briefcase className="h-5 w-5 text-foreground" />
                <h3 className="font-semibold text-sm">Target Personas</h3>
              </div>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-[10px] uppercase font-mono text-muted-foreground block mb-1">Seniority Level</label>
                  <select className="w-full bg-background border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option>C-Level / Founder</option>
                    <option>VP / Director</option>
                    <option>Manager</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-mono text-muted-foreground block mb-1">Department</label>
                  <select className="w-full bg-background border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option>Engineering & Tech</option>
                    <option>Sales & Marketing</option>
                    <option>Operations</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Execution Parameters & Lock */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          <div className="rounded-xl border border-border/60 bg-card p-6 shadow-lg space-y-5">
            <h3 className="font-semibold text-sm flex items-center gap-2 pb-2 border-b border-border/30">
              <Compass className="h-4 w-4 text-foreground" />
              Execution Parameters
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex justify-between">
                  <span>Target Quota</span>
                  <span className="text-foreground font-semibold">{targetQuota} Leads</span>
                </label>
                <input 
                  type="range" 
                  min="50" max="1000" step="50"
                  value={targetQuota}
                  onChange={(e) => setTargetQuota(e.target.value)}
                  className="w-full mt-3 accent-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2 block">
                  Primary Data Source
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="border border-foreground/50 bg-foreground/10 rounded-lg p-2 flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground">
                    <Globe className="h-3.5 w-3.5 text-foreground" /> Web/Social
                  </div>
                  <div className="border border-border/60 bg-background rounded-lg p-2 flex items-center gap-2 cursor-pointer text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
                    <Filter className="h-3.5 w-3.5" /> Proprietary
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-foreground/[0.02] p-6 shadow-lg space-y-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Lock className="h-24 w-24 text-foreground" />
            </div>
            
            <div>
              <h3 className="text-lg font-bold text-foreground">Lock Thesis</h3>
              <p className="text-xs text-muted-foreground mt-1 relative z-10">
                Deploy autonomous agents to begin decomposing intent and discovering targets.
              </p>
            </div>

            <Button 
              onClick={handleLockThesis}
              disabled={isLocking || !thesis.trim()}
              className="w-full bg-foreground hover:bg-foreground/90 text-background font-semibold h-12 text-sm relative z-10"
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
