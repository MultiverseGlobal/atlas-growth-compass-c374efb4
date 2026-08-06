import React from 'react';
import { useMetaphorPipeline } from '@/hooks/useMetaphorPipeline';
import { Target, Server, ShieldAlert } from 'lucide-react';

export function MetaphorBriefCard() {
  const { brief, loading } = useMetaphorPipeline();

  if (loading) return null; // Don't show anything while loading
  if (!brief) return null; // Not connected or no brief

  return (
    <div className="mb-8 border border-border-subtle rounded-xl bg-surface-1 p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
        <Server className="w-5 h-5 text-primary" />
        Live Metaphor Context
      </h2>
      <p className="text-xs text-muted mb-6">
        Atlas is operating with cognitive context from Metaphor OS. 
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
        <div>
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-500" /> Active Goals
          </h3>
          <ul className="space-y-2">
            {brief.active_goals.length > 0 ? brief.active_goals.map((g, i) => (
              <li key={i} className="text-sm text-muted bg-surface-2 px-3 py-2 rounded-md">{g}</li>
            )) : <li className="text-sm text-muted/50 italic">No active goals.</li>}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500" /> Key Constraints
          </h3>
          <ul className="space-y-2">
            {brief.active_constraints.length > 0 ? brief.active_constraints.map((c, i) => (
              <li key={i} className="text-sm text-muted bg-surface-2 px-3 py-2 rounded-md">{c}</li>
            )) : <li className="text-sm text-muted/50 italic">No active constraints.</li>}
          </ul>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-border-subtle relative z-10">
        <h3 className="text-sm font-medium text-foreground mb-2">Recommended Strategy Focus</h3>
        <div className="text-sm text-primary font-medium bg-primary/10 px-4 py-3 rounded-lg border border-primary/20">
          {brief.recommended_focus}
        </div>
      </div>
    </div>
  );
}
