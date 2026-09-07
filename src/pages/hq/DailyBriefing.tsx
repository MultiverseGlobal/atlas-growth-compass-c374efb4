import React from "react";
import { Zap, ArrowUpRight, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Link } from "react-router-dom";

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
    <div className="w-full min-h-screen bg-background flex flex-col items-center">
      <div className="w-full max-w-5xl px-6 py-24 relative z-10 space-y-12">
        
        {/* Header section */}
        <div className="flex flex-col gap-4 border-b border-border/60 pb-8">
          <div className="flex items-center gap-3">
            <span className="flex h-2 w-2 bg-foreground" />
            <span className="text-xs font-mono tracking-widest text-foreground uppercase">Morning Intelligence Report</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-foreground">
            Daily Briefing
          </h1>
          <p className="text-muted-foreground text-sm max-w-2xl font-mono uppercase tracking-wide">
            Algorithmically curated top targets / {new Date().toISOString().split('T')[0]}
          </p>
        </div>

        {/* Action Metrics - Ultra Minimal */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-y border-border/60 divide-y md:divide-y-0 md:divide-x divide-border/60">
          <div className="p-6 flex flex-col gap-2">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">Active Signals Processing</span>
            <span className="text-4xl font-display font-light text-foreground">24</span>
          </div>
          <div className="p-6 flex flex-col gap-2 bg-foreground/5">
            <span className="text-[10px] font-mono uppercase text-foreground tracking-widest font-semibold">Immediate Action Required</span>
            <span className="text-4xl font-display font-light text-foreground">03</span>
          </div>
          <div className="p-6 flex flex-col gap-2">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">System Health / Parsing</span>
            <span className="text-4xl font-display font-light text-foreground">92.4%</span>
          </div>
        </div>

        {/* Top Opportunities List - Dossier Style */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <h3 className="text-xs font-mono uppercase tracking-widest text-foreground font-semibold">
              Priority Targets (Top 3)
            </h3>
            <span className="text-[10px] font-mono uppercase text-muted-foreground">Ranked by Intent Score</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {TOP_OPPORTUNITIES.map((opp, idx) => (
              <div key={opp.id} className="group border border-border/60 bg-card hover:bg-foreground/5 transition-colors p-0 flex flex-col md:flex-row w-full">
                
                {/* Rank & Score Block */}
                <div className="flex flex-row md:flex-col items-center justify-between md:justify-center p-4 md:w-24 border-b md:border-b-0 md:border-r border-border/60 bg-muted/30">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">Rank 0{idx + 1}</span>
                  <span className="text-2xl font-display font-semibold text-foreground">{opp.score}</span>
                </div>

                {/* Main Intel Block */}
                <div className="flex-1 p-6 flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="text-lg font-semibold text-foreground tracking-tight">{opp.company}</h4>
                      <span className="px-2 py-0.5 border border-border/60 text-[10px] font-mono uppercase text-muted-foreground bg-background">
                        {opp.role}
                      </span>
                    </div>
                    <p className="text-sm font-mono text-muted-foreground mt-2 border-l-2 border-foreground/20 pl-3 py-0.5">
                      {opp.intent}
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-border/30 mt-2">
                    <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground uppercase">
                      <span>Detected: {opp.time}</span>
                      <span>Status: {opp.status}</span>
                    </div>
                    
                    <Link 
                      to="/hq/engine"
                      className="text-xs font-semibold font-mono uppercase text-foreground hover:underline flex items-center gap-1"
                    >
                      Engage Target <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

              </div>
            ))}
          </div>
        </div>

        {/* Empty state padder to keep UI balanced */}
        <div className="pt-12 text-center text-[10px] text-muted-foreground font-mono uppercase tracking-widest border-t border-border/30">
          End of dossier. Press <kbd className="px-1.5 py-0.5 border border-border/60 text-foreground bg-muted/50 mx-1">⌘K</kbd> to launch Revenue Engine.
        </div>

      </div>
    </div>
  );
}
