import { useState } from "react";
import { Sparkles, Video, Handshake, Zap } from "lucide-react";
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
      <div className="pds-data-card p-5 space-y-4 pds-animate-enter">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--pds-border-subtle)] pb-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-[var(--pds-surface-2)] border border-[var(--pds-border-subtle)] flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-[var(--pds-text-muted)]" />
            </div>
            <div>
              <span className="pds-label mb-0.5">Priority Vector</span>
              <h2 className="text-[13px] font-semibold text-[var(--pds-text-primary)] font-display">
                Today's Highest-Probability Opportunity
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="text-[11px] font-mono font-bold text-[var(--pds-success)]">
              ★ {topOpportunity.proximityScore} / 10
            </span>
            <span className="text-[10px] font-mono text-[var(--pds-text-muted)]">{topOpportunity.opportunityType}</span>
          </div>
        </div>

        {/* Prospect & Signal */}
        <div className="space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-semibold text-[13px] text-[var(--pds-text-primary)]">{topOpportunity.company}</span>
              <span className="text-[var(--pds-text-muted)] ml-2 text-[11px]">
                ({topOpportunity.contact} · {topOpportunity.role})
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[var(--pds-surface-2)] border border-[var(--pds-border-subtle)] text-[12px] text-[var(--pds-text-secondary)]">
            <span className="font-semibold text-[var(--pds-warning)]">Buying Signal: </span>
            &ldquo;{topOpportunity.signal}&rdquo;
          </div>
        </div>

        {/* 5-Factor Score Breakdown */}
        <div className="p-2.5 rounded-lg bg-[var(--pds-surface-2)] border border-[var(--pds-border-subtle)]">
          <span className="pds-label">Atlas Proximity Score — ICP × Pain × Timing × Proximity × Accessibility</span>
          <div className="grid grid-cols-5 gap-2 text-center">
            <div className="pds-score-chip">
              <span className="pds-label mb-0">ICP</span>
              <span className="font-mono font-semibold text-[12px] text-[var(--pds-text-primary)]">{topOpportunity.rubric.icpFit}</span>
            </div>
            <div className="pds-score-chip">
              <span className="pds-label mb-0">Pain</span>
              <span className="font-mono font-semibold text-[12px] text-[var(--pds-success)]">{topOpportunity.rubric.painSignal}</span>
            </div>
            <div className="pds-score-chip">
              <span className="pds-label mb-0">Timing</span>
              <span className="font-mono font-semibold text-[12px] text-[var(--pds-info)]">{topOpportunity.rubric.timing}</span>
            </div>
            <div className="pds-score-chip">
              <span className="pds-label mb-0">Prox.</span>
              <span className="font-mono font-semibold text-[12px] text-[var(--pds-text-primary)]">{topOpportunity.rubric.proximity}</span>
            </div>
            <div className="pds-score-chip">
              <span className="pds-label mb-0">Access</span>
              <span className="font-mono font-semibold text-[12px] text-[var(--pds-warning)]">{topOpportunity.rubric.accessibility}</span>
            </div>
          </div>
        </div>

        {/* Recommended Entry Path */}
        <div className="p-3 rounded-lg bg-[var(--pds-surface-2)] border border-[var(--pds-border-subtle)] text-[12px] space-y-1">
          <span className="pds-label">Recommended Entry Move</span>
          <p className="text-[var(--pds-text-secondary)] leading-relaxed">
            {topOpportunity.recommendedPath}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--pds-border-subtle)]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowProofModal(true)}
              className="pds-btn-ghost"
            >
              <Video className="h-3.5 w-3.5" />
              Generate Loom Teardown
            </button>
            <button
              onClick={() => setShowPartnerModal(true)}
              className="pds-btn-ghost"
            >
              <Handshake className="h-3.5 w-3.5" />
              Partner Discovery
            </button>
          </div>

          <button
            onClick={handleSendToWilliam}
            className="pds-btn-ghost"
          >
            <Zap className="h-3.5 w-3.5" />
            Queue in William
          </button>
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
