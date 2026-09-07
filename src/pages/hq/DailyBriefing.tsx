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
    <div className="w-full min-h-screen bg-background">
      {/* Top ambient glow */}
      <div className="absolute top-0 left-0 right-0 h-[30vh] bg-emerald-500/5 blur-[120px] pointer-events-none" />
      
      <div className="container max-w-5xl mx-auto px-6 py-24 relative z-10">
        
        {/* Header section */}
        <div className="flex flex-col gap-3 mb-12">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-xs font-mono tracking-widest text-emerald-600 dark:text-emerald-400 uppercase">Systems Nominal</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-semibold tracking-tight text-foreground">
            Daily Briefing
          </h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-2xl">
            Review your top 3 qualified opportunities for today based on commercial intent and system signals.
          </p>
        </div>

        {/* Action Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <div className="bg-card border border-border/60 rounded-xl p-5 shadow-sm flex flex-col gap-2 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Zap className="w-16 h-16" />
            </div>
            <span className="text-xs font-mono uppercase text-muted-foreground tracking-widest">Active Signals</span>
            <span className="text-3xl font-display font-semibold text-foreground">24</span>
          </div>
          <div className="bg-card border border-border/60 rounded-xl p-5 shadow-sm flex flex-col gap-2 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <AlertCircle className="w-16 h-16" />
            </div>
            <span className="text-xs font-mono uppercase text-muted-foreground tracking-widest">Urgent Actions</span>
            <span className="text-3xl font-display font-semibold text-amber-500">3</span>
          </div>
          <div className="bg-card border border-border/60 rounded-xl p-5 shadow-sm flex flex-col gap-2 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <CheckCircle2 className="w-16 h-16" />
            </div>
            <span className="text-xs font-mono uppercase text-muted-foreground tracking-widest">Pipeline Health</span>
            <span className="text-3xl font-display font-semibold text-emerald-500">92%</span>
          </div>
        </div>

        {/* Top Opportunities List */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            Priority Targets
            <span className="px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-[10px] font-mono">Top 3</span>
          </h3>

          {TOP_OPPORTUNITIES.map((opp, idx) => (
            <div key={opp.id} className="group bg-card border border-border/60 hover:border-emerald-500/30 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-md cursor-pointer">
              
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center font-mono text-xs font-bold text-accent-foreground shrink-0 border border-border/50">
                  {idx + 1}
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{opp.company}</span>
                    <span className="text-muted-foreground text-xs">•</span>
                    <span className="text-muted-foreground text-xs">{opp.role}</span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">{opp.intent}</p>
                </div>
              </div>

              <div className="flex items-center gap-6 pl-14 md:pl-0">
                <div className="flex flex-col md:items-end gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{opp.score} Score</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {opp.time}
                  </div>
                </div>

                <Link 
                  to={`/hq/leads/${opp.id}`}
                  className="h-9 px-4 rounded-lg bg-background hover:bg-accent border border-border/60 text-xs font-semibold text-foreground flex items-center gap-1.5 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  Engage <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>

            </div>
          ))}
        </div>

        {/* Empty state padder to keep UI balanced */}
        <div className="mt-12 text-center text-xs text-muted-foreground font-mono">
          End of briefing. Press <kbd className="px-1.5 py-0.5 rounded border border-border/60 bg-muted">⌘K</kbd> to launch Revenue Engine.
        </div>

      </div>
    </div>
  );
}
