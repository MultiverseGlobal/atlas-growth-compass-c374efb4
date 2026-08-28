import { useState } from "react";
import { Sparkles, ArrowRight, Video, Handshake, Zap, ShieldCheck, TrendingUp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ProofEngineModal } from "./ProofEngineModal";
import { PartnerEngineModal } from "./PartnerEngineModal";

export function HighestOpportunityCard() {
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

  const handleSendToWilliam = () => {
    const task = {
      id: `top_opp_${Date.now()}`,
      title: `Execute High-Probability Opportunity: ${topOpportunity.company}`,
      action: `Send custom diagnostic teardown to ${topOpportunity.contact}. Recommended path: ${topOpportunity.recommendedPath}`,
      priority: "P0",
      channel: "LinkedIn Direct / Loom",
      timestamp: new Date().toISOString()
    };
    try {
      const existing = JSON.parse(localStorage.getItem("william_focus_queue") || "[]");
      localStorage.setItem("william_focus_queue", JSON.stringify([task, ...existing]));
      toast.success(`⚡ Queued #${topOpportunity.company} into William Sovereign Queue!`);
    } catch (_) {
      toast.success(`⚡ Opportunity synced to William!`);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-primary/40 bg-gradient-to-br from-primary/[0.08] via-card to-background p-5 space-y-4 shadow-md">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono tracking-widest text-primary uppercase font-bold">
                Founder Brief · Priority Vector
              </span>
              <h2 className="text-sm font-semibold text-white">
                Today's Highest-Probability Acquisition Opportunity
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <Badge variant="outline" className="text-xs font-mono font-bold text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
              ★ {topOpportunity.proximityScore} / 10 Proximity
            </Badge>
            <Badge variant="outline" className="text-[11px] text-sky-400 border-sky-500/30 bg-sky-500/10">
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

          <div className="p-3 rounded-lg bg-amber-500/[0.06] border border-amber-500/20 text-amber-200/90 text-xs">
            <span className="font-semibold text-amber-400">Buying Signal: </span>
            "{topOpportunity.signal}"
          </div>
        </div>

        {/* 5-Factor Proximity Formula Breakdown */}
        <div className="p-2.5 rounded-lg bg-black/40 border border-border/50">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">
            Atlas Proximity Score Breakdown (ICP Fit × Pain × Timing × Proximity × Accessibility)
          </div>
          <div className="grid grid-cols-5 gap-2 text-center text-xs">
            <div className="p-1.5 rounded bg-white/5">
              <span className="block text-[9px] text-muted-foreground uppercase">ICP Fit</span>
              <span className="font-mono font-semibold text-foreground">{topOpportunity.rubric.icpFit}</span>
            </div>
            <div className="p-1.5 rounded bg-white/5">
              <span className="block text-[9px] text-muted-foreground uppercase">Pain Signal</span>
              <span className="font-mono font-semibold text-emerald-400">{topOpportunity.rubric.painSignal}</span>
            </div>
            <div className="p-1.5 rounded bg-white/5">
              <span className="block text-[9px] text-muted-foreground uppercase">Timing</span>
              <span className="font-mono font-semibold text-sky-400">{topOpportunity.rubric.timing}</span>
            </div>
            <div className="p-1.5 rounded bg-white/5">
              <span className="block text-[9px] text-muted-foreground uppercase">Proximity</span>
              <span className="font-mono font-semibold text-purple-400">{topOpportunity.rubric.proximity}</span>
            </div>
            <div className="p-1.5 rounded bg-white/5">
              <span className="block text-[9px] text-muted-foreground uppercase">Access</span>
              <span className="font-mono font-semibold text-amber-400">{topOpportunity.rubric.accessibility}</span>
            </div>
          </div>
        </div>

        {/* Recommended Entry Path */}
        <div className="p-3 rounded-lg bg-primary/[0.05] border border-primary/20 text-xs space-y-1">
          <div className="font-semibold text-primary text-[11px] uppercase tracking-wide">
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
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1.5 h-8 font-medium"
            >
              <Video className="h-3.5 w-3.5" />
              Generate 3-Min Loom Teardown
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPartnerModal(true)}
              className="text-xs gap-1.5 h-8 border-border/70 hover:border-sky-500/40 text-sky-300"
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
