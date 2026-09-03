import { useState } from "react";
import { Sparkles, ArrowRight, Video, Handshake, Zap, ShieldCheck, TrendingUp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ProofEngineModal } from "./ProofEngineModal";
import { PartnerEngineModal } from "./PartnerEngineModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function HighestOpportunityCard() {
  const { user } = useAuth();
  const [showProofModal, setShowProofModal] = useState(false);
  const [showPartnerModal, setShowPartnerModal] = useState(false);

  const topOpportunity = {
    company: "Apex Creative Collective",
    contact: "Julian Mercer",
    role: "Founder & CEO (22 headcount)",
    opportunityType: "Direct Client · High Operational Bottleneck",
    proximityScore: 9.4,
    rubric: {
      icpFit: "9.5/10",
      painSignal: "9.8/10",
      timing: "9.0/10",
      proximity: "8.5/10",
      accessibility: "9.2/10"
    },
    signal: 'Publicly hiring 2 operations coordinators to "clean up manual client onboarding spreadsheets and Slack setup chaos".',
    diagnosis: "Onboarding turnaround currently takes 4+ business days due to multi-tool handoffs. An automated 1-click provisioning webhook eliminates 80% of this drag immediately.",
    recommendedPath: "Send 3-minute asynchronous Loom teardown showing the exact intake-to-workspace webhook blueprint."
  };

  const handleSendToWilliam = async () => {
    if (!user) {
      toast.error("You must be logged in to queue tasks.");
      return;
    }
    const task = {
      title: `Execute High-Probability Opportunity: ${topOpportunity.company}`,
      action: `Send custom diagnostic teardown to ${topOpportunity.contact}. Recommended path: ${topOpportunity.recommendedPath}`,
      priority: "P0",
      channel: "LinkedIn Direct / Loom"
    };
    try {
      const { error } = await supabase.from('task_handoffs').insert({
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        project_id: user.id,
        payload: JSON.stringify(task),
        source_ai: 'atlas',
        target_ai: 'william',
        status: 'pending',
        instructions: task.action,
      });
      if (error) throw error;
      toast.success(`⚡ Queued #${topOpportunity.company} into William Sovereign Queue!`);
    } catch (err: any) {
      toast.error(`⚡ Failed to sync to William: ${err.message}`);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-accent/40 bg-gradient-to-br from-accent/[0.08] via-card to-background p-5 space-y-4 shadow-md">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center text-accent">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-mono tracking-widest text-accent uppercase font-bold">
                Founder Brief · Priority Vector
              </span>
              <h2 className="text-sm font-semibold text-white">
                Today's Highest-Probability Acquisition Opportunity
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <Badge variant="outline" className="text-xs font-mono font-bold text-status-success border-status-success/30 bg-status-success/10">
              ★ {topOpportunity.proximityScore} / 10 Proximity
            </Badge>
            <Badge variant="outline" className="text-xs text-status-info border-status-info/30 bg-status-info/10">
              {topOpportunity.opportunityType}
            </Badge>
          </div>
        </div>

        {/* Prospect & Signal */}
        <div className="space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-semibold text-sm text-foreground">{topOpportunity.company}</span>
              <span className="text-muted-foreground ml-2">({topOpportunity.contact} · {topOpportunity.role})</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-status-warning/10 border border-status-warning/20 text-status-warning text-xs">
            <span className="font-semibold">Buying Signal: </span>
            "{topOpportunity.signal}"
          </div>
        </div>

        {/* 5-Factor Proximity Formula Breakdown */}
        <div className="p-2.5 rounded-lg bg-surface-2/40 border border-border-subtle">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">
            Atlas Proximity Score Breakdown (ICP Fit × Pain × Timing × Proximity × Accessibility)
          </div>
          <div className="grid grid-cols-5 gap-2 text-center text-xs">
            <div className="p-1.5 rounded bg-surface-1">
              <span className="block text-[10px] text-muted-foreground uppercase">ICP Fit</span>
              <span className="font-mono font-semibold text-foreground">{topOpportunity.rubric.icpFit}</span>
            </div>
            <div className="p-1.5 rounded bg-surface-1">
              <span className="block text-[10px] text-muted-foreground uppercase">Pain Signal</span>
              <span className="font-mono font-semibold text-status-success">{topOpportunity.rubric.painSignal}</span>
            </div>
            <div className="p-1.5 rounded bg-surface-1">
              <span className="block text-[10px] text-muted-foreground uppercase">Timing</span>
              <span className="font-mono font-semibold text-status-info">{topOpportunity.rubric.timing}</span>
            </div>
            <div className="p-1.5 rounded bg-surface-1">
              <span className="block text-[10px] text-muted-foreground uppercase">Proximity</span>
              <span className="font-mono font-semibold text-accent">{topOpportunity.rubric.proximity}</span>
            </div>
            <div className="p-1.5 rounded bg-surface-1">
              <span className="block text-[10px] text-muted-foreground uppercase">Access</span>
              <span className="font-mono font-semibold text-status-warning">{topOpportunity.rubric.accessibility}</span>
            </div>
          </div>
        </div>

        {/* Recommended Entry Path */}
        <div className="p-3 rounded-lg bg-primary/[0.05] border border-primary/20 text-xs space-y-1">
          <div className="font-semibold text-primary text-xs uppercase tracking-wide">
            Recommended Entry Move
          </div>
          <p className="text-foreground/90 leading-relaxed">
            {topOpportunity.recommendedPath}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/30">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setShowProofModal(true)}
              className="bg-status-success hover:bg-status-success/90 text-white text-xs gap-1.5 h-8 font-medium"
            >
              <Video className="h-3.5 w-3.5" />
              Generate 3-Min Loom Teardown
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPartnerModal(true)}
              className="text-xs gap-1.5 h-8 border-border-subtle hover:border-status-info/40 text-status-info"
            >
              <Handshake className="h-3.5 w-3.5" />
              Partner Discovery
            </Button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleSendToWilliam}
            className="text-xs gap-1.5 h-8 border-primary/30 text-primary hover:bg-primary/10 font-medium"
          >
            <Zap className="h-3.5 w-3.5" />
            Queue in William
          </Button>
        </div>
      </div>

      <ProofEngineModal
        isOpen={showProofModal}
        onClose={() => setShowProofModal(false)}
        companyName={topOpportunity.company}
        painSignal={topOpportunity.signal}
        contactName={topOpportunity.contact}
      />

      <PartnerEngineModal
        isOpen={showPartnerModal}
        onClose={() => setShowPartnerModal(false)}
      />
    </>
  );
}
