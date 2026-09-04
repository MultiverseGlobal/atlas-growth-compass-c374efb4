import { useState, useEffect } from "react";
import { CommandEngine } from "../components/CommandEngine";
import { InterventionDrawer } from "../components/InterventionDrawer";
import { AtlasCommandPalette } from "../components/AtlasCommandPalette";
import { EcosystemSwitcher } from "../components/atlas/EcosystemSwitcher";
import { Search, Sparkles, Zap, Shield, ArrowUpRight } from "lucide-react";
import { 
  type CampaignState, 
  type DiscoveredLead, 
  type OutreachDraft, 
  dispatchOutreach, 
  generateLeadOutreach 
} from "@/services/campaignEngine";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function Index() {
  const navigate = useNavigate();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isInterventionOpen, setIsInterventionOpen] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);

  // ── Central Campaign State ─────────────────────────────────────────────────
  const [campaignState, setCampaignState] = useState<CampaignState>({
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
  });

  // Force dark mode for the premium Apple-tier Atlas experience
  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => document.documentElement.classList.remove("dark");
  }, []);

  // ── Intervention Handlers ──────────────────────────────────────────────────
  const handleRequireIntervention = (lead: DiscoveredLead, draft: OutreachDraft) => {
    setCampaignState((prev) => ({
      ...prev,
      status: "awaiting_approval",
      currentLead: lead,
      currentDraft: draft,
    }));
    setIsInterventionOpen(true);
  };

  const handleApprove = async (approvedDraft: OutreachDraft, recipientEmail: string) => {
    if (!campaignState.currentLead) return;

    setIsDispatching(true);
    try {
      const result = await dispatchOutreach(
        campaignState.currentLead,
        approvedDraft,
        recipientEmail
      );

      toast.success(result.message, { icon: "🚀" });
      setIsInterventionOpen(false);

      // Advance to next lead or complete campaign
      const nextIndex = campaignState.activeLeadIndex + 1;
      const nextContacted = campaignState.contactedCount + 1;

      if (nextIndex < campaignState.leads.length && nextContacted < campaignState.targetCount) {
        const nextLead = campaignState.leads[nextIndex];
        setCampaignState((prev) => ({
          ...prev,
          status: "drafting",
          activeLeadIndex: nextIndex,
          currentLead: nextLead,
          contactedCount: nextContacted,
        }));

        // Synthesize next draft autonomously
        setTimeout(async () => {
          try {
            const nextDraft = await generateLeadOutreach(
              nextLead,
              `Scaling operational velocity for ${campaignState.keyword}`
            );
            handleRequireIntervention(nextLead, nextDraft);
          } catch {
            setCampaignState((prev) => ({ ...prev, status: "completed" }));
          }
        }, 1200);

      } else {
        setCampaignState((prev) => ({
          ...prev,
          status: "completed",
          contactedCount: nextContacted,
        }));
        toast.success("Campaign reached daily threshold! All outreach queued.", { icon: "🏆" });
      }

    } catch (err: any) {
      toast.error("Failed to dispatch: " + err.message);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleRegenerate = async () => {
    if (!campaignState.currentLead) return;
    toast.info("Regenerating pitch with alternate value angle...", { icon: "🔄" });
    try {
      const freshDraft = await generateLeadOutreach(
        campaignState.currentLead,
        "Focus on automated lead qualification and reducing customer acquisition cost."
      );
      setCampaignState((prev) => ({ ...prev, currentDraft: freshDraft }));
      toast.success("Updated outreach copy ready for review.");
    } catch (err: any) {
      toast.error("Regeneration failed: " + err.message);
    }
  };

  const handleSkip = () => {
    setIsInterventionOpen(false);
    const nextIndex = campaignState.activeLeadIndex + 1;

    if (nextIndex < campaignState.leads.length) {
      const nextLead = campaignState.leads[nextIndex];
      setCampaignState((prev) => ({
        ...prev,
        status: "drafting",
        activeLeadIndex: nextIndex,
        currentLead: nextLead,
      }));

      setTimeout(async () => {
        try {
          const nextDraft = await generateLeadOutreach(
            nextLead,
            `Scaling operational velocity for ${campaignState.keyword}`
          );
          handleRequireIntervention(nextLead, nextDraft);
        } catch {
          setCampaignState((prev) => ({ ...prev, status: "idle" }));
        }
      }, 1000);

    } else {
      toast.info("All discovered leads processed.");
      setCampaignState((prev) => ({ ...prev, status: "completed" }));
    }
  };

  return (
    <div className="min-h-screen bg-[#07080c] text-white selection:bg-accent/20 flex flex-col relative overflow-hidden font-sans">
      {/* Global Navigation Glass Bar */}
      <header className="fixed top-0 z-30 flex w-full items-center justify-between px-6 py-4 nav-glass border-b border-white/[0.08]">
        <div className="flex items-center gap-4">
          <EcosystemSwitcher />
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="font-display text-sm tracking-widest text-white/90 uppercase font-bold">
              Atlas
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent">
              Autonomous Command
            </span>
          </div>
        </div>

        {/* Ambient AI Command Bar (Click or ⌘K) */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="group flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 transition-all hover:bg-white/[0.08] hover:border-white/20 active:scale-[0.98]"
          >
            <Search className="h-4 w-4 text-white/40 group-hover:text-white/80 transition-colors" />
            <span className="text-xs text-white/50 group-hover:text-white/80 transition-colors font-medium">
              Search actions or prompts...
            </span>
            <kbd className="ml-2 rounded border border-white/10 bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-white/40">
              ⌘K
            </kbd>
          </button>

          <button
            onClick={() => navigate("/hq/engine")}
            className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-white/50 hover:text-white px-3 py-2 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
          >
            <span>Revenue Engine</span>
            <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
      </header>

      {/* Main Spatial Stage */}
      <main className="relative flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pt-28 pb-16">
        {/* Subtle Background Texture Overlay */}
        <div className="grain absolute inset-0 pointer-events-none opacity-40 mix-blend-overlay" />

        {/* Subtle Spatial Depth Radial Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-accent/5 blur-[120px] rounded-full pointer-events-none" />

        {/* The Master Prompt & Autonomous Nodes */}
        <CommandEngine
          campaignState={campaignState}
          onStateChange={setCampaignState}
          onRequireIntervention={handleRequireIntervention}
        />
      </main>

      {/* Interactive Liquid Glass Intervention Drawer */}
      <InterventionDrawer
        isOpen={isInterventionOpen}
        lead={campaignState.currentLead}
        draft={campaignState.currentDraft}
        onApprove={handleApprove}
        onRegenerate={handleRegenerate}
        onSkip={handleSkip}
        onClose={() => setIsInterventionOpen(false)}
        isDispatching={isDispatching}
      />

      {/* Real ⌘K Command Palette */}
      <AtlasCommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onSelectPrompt={(prompt) => {
          // Trigger prompt directly in engine
          const inputEl = document.querySelector("input[placeholder*='campaign intent']") as HTMLInputElement;
          if (inputEl) {
            inputEl.value = prompt;
            inputEl.dispatchEvent(new Event("input", { bubbles: true }));
            inputEl.form?.requestSubmit();
          }
        }}
        onResetWorkspace={() => {
          setCampaignState({
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
          });
          setIsInterventionOpen(false);
          toast.info("Workspace reset to clean state.");
        }}
      />
    </div>
  );
}
