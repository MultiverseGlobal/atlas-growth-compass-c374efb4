import React from "react";
import { Zap, ArrowUpRight, Activity, Clock, Target, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { StaggerGroup } from "@/components/atlas/StaggerGroup";
import { motion } from "framer-motion";

// Mock data for top 3 opportunities
const TOP_OPPORTUNITIES = [
  {
    id: "opp_1",
    company: "Acme Corp",
    role: "VP Engineering",
    score: 94,
    intent: "High intent: Actively researching enterprise architecture",
    time: "2h ago",
    status: "hot",
  },
  {
    id: "opp_2",
    company: "Stark Industries",
    role: "Director of Product",
    score: 88,
    intent: "Medium intent: Visited pricing page 3 times today",
    time: "5h ago",
    status: "warm",
  },
  {
    id: "opp_3",
    company: "Wayne Enterprises",
    role: "CTO",
    score: 82,
    intent: "New signal: Competitor contract expiring soon",
    time: "1d ago",
    status: "new",
  }
];

export default function DailyBriefing() {
  return (
    <div className="pt-[72px] px-8 pb-8 bg-background min-h-screen text-foreground relative overflow-y-auto">
      <div className="w-full max-w-4xl mx-auto space-y-8">
        
        {/* Header section */}
        <div className="border-b border-border/60 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 text-muted-foreground">
              <Activity className="w-4 h-4" />
              <span className="text-[10px] font-mono tracking-widest uppercase">Morning Intelligence Report</span>
            </div>
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
              Daily Briefing
            </h1>
            <p className="text-muted-foreground text-xs mt-2 font-mono uppercase tracking-wide">
              {new Date().toISOString().split('T')[0]} / Autonomous Sync Complete
            </p>
          </div>
          <Link 
            to="/hq/engine"
            className="flex items-center justify-center gap-2 h-10 px-4 bg-foreground text-background rounded-lg text-xs font-semibold hover:bg-foreground/90 transition-colors shadow-md"
          >
            Launch Engine <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Action Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest block mb-2">Signals Processing</span>
            <span className="text-3xl font-display font-light text-foreground block">24</span>
          </div>
          <div className="rounded-xl border border-border/60 bg-foreground/5 p-5 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-foreground" />
            <span className="text-[10px] font-mono uppercase text-foreground tracking-widest font-semibold block mb-2">Action Required</span>
            <span className="text-3xl font-display font-bold text-foreground block">03</span>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest block mb-2">System Health</span>
            <span className="text-3xl font-display font-light text-foreground block">92.4%</span>
          </div>
        </div>

        {/* Top Opportunities List - Dossier Style */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <h3 className="text-xs font-mono uppercase tracking-widest text-foreground font-semibold flex items-center gap-2">
              <Target className="w-4 h-4" /> Priority Targets (Top 3)
            </h3>
            <span className="text-[10px] font-mono uppercase text-muted-foreground">Ranked by Intent Score</span>
          </div>

          <StaggerGroup className="grid grid-cols-1 gap-4">
            {TOP_OPPORTUNITIES.map((opp, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={opp.id} 
                className="group rounded-xl border border-border/60 bg-card hover:border-foreground/30 transition-all p-0 flex flex-col md:flex-row w-full shadow-sm overflow-hidden"
              >
                {/* Rank & Score Block */}
                <div className="flex flex-row md:flex-col items-center justify-between md:justify-center p-4 md:w-28 border-b md:border-b-0 md:border-r border-border/40 bg-muted/20">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Rank 0{idx + 1}</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-display font-bold text-foreground">{opp.score}</span>
                  </div>
                </div>

                {/* Main Intel Block */}
                <div className="flex-1 p-5 flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1.5">
                      <h4 className="text-base font-bold text-foreground tracking-tight">{opp.company}</h4>
                      <span className="px-2 py-0.5 rounded border border-border/60 text-[9px] font-mono uppercase text-muted-foreground bg-background">
                        {opp.role}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground mt-2 border-l-2 border-foreground/30 pl-3 py-1 bg-muted/10 rounded-r-lg">
                      {opp.intent}
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-border/30 mt-1">
                    <div className="flex items-center gap-4 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {opp.time}</span>
                      <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {opp.status}</span>
                    </div>
                    
                    <Link 
                      to="/hq/engine"
                      className="text-[10px] font-semibold font-mono uppercase text-foreground hover:bg-foreground/5 px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 border border-border/60"
                    >
                      Engage <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </StaggerGroup>
        </div>

        <div className="pt-8 pb-4 text-center text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
          End of dossier. Press <kbd className="px-1.5 py-0.5 rounded border border-border/60 text-foreground bg-muted/50 mx-1">⌘K</kbd> to launch Command Palette.
        </div>
      </div>
    </div>
  );
}
