import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { CommandEngine } from "@/components/CommandEngine";
import { InterventionDrawer } from "@/components/InterventionDrawer";
import { SpatialCanvas } from "@/components/SpatialCanvas";
import {
  type CampaignState,
  type DiscoveredLead,
  type OutreachDraft,
  dispatchOutreach,
  generateLeadOutreach,
} from "@/services/campaignEngine";
import { useTheme } from "@/hooks/useTheme";
import { soundManager } from "@/lib/audioFeedback";
import { toast } from "sonner";
import { Send, CheckCircle2, SkipForward, RefreshCw } from "lucide-react";

// ── Initial campaign state ──────────────────────────────────────────────────
const INITIAL_STATE: CampaignState = {
  prompt: "",
  status: "idle",
  channel: "yc",
  keyword: "",
  industry: "",
  targetCount: 15,
  leads: [],
  activeLeadIndex: 0,
  currentLead: null,
  currentDraft: null,
  contactedCount: 0,
};

export default function CommandFeed() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // ── Campaign state ──────────────────────────────────────────────────────
  const [campaignState, setCampaignState] = useState<CampaignState>(INITIAL_STATE);
  const [isAutoPilot, setIsAutoPilot] = useState(false);

  // ── Intervention drawer state ───────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [interventionLead, setInterventionLead] = useState<DiscoveredLead | null>(null);
  const [interventionDraft, setInterventionDraft] = useState<OutreachDraft | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);

  // ── Intervention handler: CommandEngine calls this when it needs human review
  const handleRequireIntervention = useCallback(
    (lead: DiscoveredLead, draft: OutreachDraft) => {
      setInterventionLead(lead);
      setInterventionDraft(draft);
      setDrawerOpen(true);
    },
    []
  );

  // ── Approve & dispatch outreach ─────────────────────────────────────────
  const handleApprove = useCallback(
    async (draft: OutreachDraft, recipientEmail: string) => {
      // Use currentLead if interventionLead is not set (during auto-pilot)
      const leadToProcess = interventionLead || campaignState.currentLead;
      if (!leadToProcess) return;
      
      setIsDispatching(true);

      try {
        const result = await dispatchOutreach(leadToProcess, draft, recipientEmail);

        if (result.success) {
          soundManager.playSuccess();
          toast.success(result.message, {
            icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
          });

          const nextIndex = campaignState.activeLeadIndex + 1;
          const nextLead = campaignState.leads[nextIndex] || null;

          setCampaignState((prev) => ({
            ...prev,
            contactedCount: prev.contactedCount + 1,
            activeLeadIndex: nextIndex,
            currentLead: nextLead,
            currentDraft: null,
            status: nextLead ? "drafting" : "completed",
          }));

          setDrawerOpen(false);

          // Auto-advance to next lead if available
          if (nextLead) {
            toast("Synthesizing next target outreach...", {
              icon: <Send className="h-4 w-4 text-emerald-500" />,
            });

            try {
              const nextDraft = await generateLeadOutreach(
                nextLead,
                `Campaign: ${campaignState.prompt}`
              );
              setCampaignState((prev) => ({
                ...prev,
                status: "awaiting_approval",
                currentDraft: nextDraft,
              }));

              if (!isAutoPilot) {
                soundManager.playChime();
                handleRequireIntervention(nextLead, nextDraft);
              }
            } catch (err: any) {
              toast.error(`Draft generation failed: ${err.message}`);
              setCampaignState((prev) => ({
                ...prev,
                status: "idle",
                error: err.message,
              }));
            }
          } else {
            toast.success(
              `Campaign complete: ${campaignState.contactedCount + 1} targets dispatched.`,
              { icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" /> }
            );
          }
        } else {
          toast.error(result.message);
        }
      } catch (err: any) {
        toast.error(`Dispatch failed: ${err.message}`);
      } finally {
        setIsDispatching(false);
      }
    },
    [interventionLead, campaignState, handleRequireIntervention]
  );

  // ── Auto-Pilot Loop Effect ────────────────────────────────────────────────
  useEffect(() => {
    if (isAutoPilot && campaignState.status === "awaiting_approval" && campaignState.currentDraft && campaignState.currentLead && !isDispatching) {
      toast.info(`Auto-Pilot: Sending to ${campaignState.currentLead.company}...`);
      const timer = setTimeout(() => {
        handleApprove(campaignState.currentDraft!, campaignState.currentLead!.founder?.email || "delivered@resend.dev");
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isAutoPilot, campaignState.status, campaignState.currentDraft, campaignState.currentLead, isDispatching, handleApprove]);

  // ── Regenerate draft for current lead ───────────────────────────────────
  const handleRegenerate = useCallback(async () => {
    if (!campaignState.currentLead) return;
    soundManager.playClick();

    toast("Regenerating outreach angle...", {
      icon: <RefreshCw className="h-4 w-4 text-emerald-500 animate-spin" />,
    });

    try {
      const newDraft = await generateLeadOutreach(
        campaignState.currentLead,
        `Alternative angle for: ${campaignState.prompt}`
      );

      setCampaignState((prev) => ({
        ...prev,
        currentDraft: newDraft,
      }));
      setInterventionDraft(newDraft);
      soundManager.playChime();
    } catch (err: any) {
      toast.error(`Regeneration failed: ${err.message}`);
    }
  }, [campaignState.currentLead, campaignState.prompt]);

  // ── Skip current lead, advance to next ──────────────────────────────────
  const handleSkip = useCallback(async () => {
    soundManager.playClick();
    const nextIndex = campaignState.activeLeadIndex + 1;
    const nextLead = campaignState.leads[nextIndex] || null;

    toast("Target skipped. Advancing pipeline...", {
      icon: <SkipForward className="h-4 w-4 text-amber-500" />,
    });

    if (nextLead) {
      setCampaignState((prev) => ({
        ...prev,
        activeLeadIndex: nextIndex,
        currentLead: nextLead,
        currentDraft: null,
        status: "drafting",
      }));

      setDrawerOpen(false);

      try {
        const nextDraft = await generateLeadOutreach(
          nextLead,
          `Campaign: ${campaignState.prompt}`
        );
        setCampaignState((prev) => ({
          ...prev,
          status: "awaiting_approval",
          currentDraft: nextDraft,
        }));
        soundManager.playChime();
        handleRequireIntervention(nextLead, nextDraft);
      } catch (err: any) {
        toast.error(`Draft generation failed: ${err.message}`);
        setCampaignState((prev) => ({
          ...prev,
          status: "idle",
          error: err.message,
        }));
      }
    } else {
      setCampaignState((prev) => ({
        ...prev,
        status: "completed",
        currentLead: null,
        currentDraft: null,
      }));
      setDrawerOpen(false);
      toast.success(`Campaign complete: ${campaignState.contactedCount} targets dispatched.`);
    }
  }, [campaignState, handleRequireIntervention]);

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const handleToggleAutoPilot = useCallback(() => {
    setIsAutoPilot((prev) => {
      const next = !prev;
      soundManager.playClick();
      toast(next ? "Auto-Pilot enabled. Minimal intervention mode." : "Supervised mode active. Manual approval required.", {
        icon: next
          ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          : <CheckCircle2 className="h-4 w-4 text-amber-500" />,
      });
      return next;
    });
  }, []);

  // ── Derive canvas state from campaign status ────────────────────────────
  const isProcessing =
    campaignState.status === "decomposing" ||
    campaignState.status === "discovering" ||
    campaignState.status === "drafting" ||
    campaignState.status === "dispatching";
  const requiresIntervention = campaignState.status === "awaiting_approval";

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* ── Atmospheric Background Canvas ──────────────────────────────── */}
      <SpatialCanvas
        isProcessing={isProcessing}
        requiresIntervention={requiresIntervention}
        isDark={isDark}
      />

      {/* ── Campaign Workspace ─────────────────────────────────────────── */}
      <motion.div 
        animate={{
          scale: drawerOpen ? 0.98 : 1,
          opacity: drawerOpen ? 0.6 : 1,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center px-4 py-16 sm:px-6 lg:px-8"
      >
        <CommandEngine
          campaignState={campaignState}
          onStateChange={setCampaignState}
          onRequireIntervention={handleRequireIntervention}
          isDark={isDark}
          isAutoPilot={isAutoPilot}
          onToggleAutoPilot={handleToggleAutoPilot}
        />
      </motion.div>

      {/* ── Intervention Drawer (slides in from right) ─────────────────── */}
      <InterventionDrawer
        isOpen={drawerOpen}
        lead={interventionLead}
        draft={interventionDraft}
        onApprove={handleApprove}
        onRegenerate={handleRegenerate}
        onSkip={handleSkip}
        onClose={handleCloseDrawer}
        isDispatching={isDispatching}
        isDark={isDark}
      />
    </div>
  );
}
