import { useState, useEffect } from "react";
import { CommandEngine } from "../components/CommandEngine";
import { InterventionDrawer } from "../components/InterventionDrawer";
import { AtlasCommandPalette } from "../components/AtlasCommandPalette";
import { SpatialCanvas } from "../components/SpatialCanvas";
import { EcosystemSwitcher } from "../components/atlas/EcosystemSwitcher";
import { 
  Search, Sparkles, Zap, Shield, ArrowUpRight, Radio, Compass, 
  Sun, Moon, Volume2, VolumeX, CheckCircle2 
} from "lucide-react";
import { 
  type CampaignState, 
  type DiscoveredLead, 
  type OutreachDraft, 
  dispatchOutreach, 
  generateLeadOutreach 
} from "@/services/campaignEngine";
import { soundManager } from "@/lib/audioFeedback";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function Index() {
  const navigate = useNavigate();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isInterventionOpen, setIsInterventionOpen] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  
  // Theme state: dark (default) or light
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("atlas.theme");
    return stored ? stored === "dark" : true;
  });

  // Sound state
  const [isMuted, setIsMuted] = useState<boolean>(soundManager.isMuted);

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

  const isProcessing = campaignState.status !== "idle" && campaignState.status !== "completed";
  const requiresIntervention = campaignState.status === "awaiting_approval";

  // Sync theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      root.classList.remove("theme-clean");
      localStorage.setItem("atlas.theme", "dark");
    } else {
      root.classList.remove("dark");
      root.classList.add("theme-clean");
      localStorage.setItem("atlas.theme", "clean");
    }
  }, [isDark]);

  const toggleTheme = () => {
    soundManager.playClick();
    setIsDark((prev) => !prev);
  };

  const toggleSound = () => {
    const newMuted = soundManager.toggleMute();
    setIsMuted(newMuted);
    toast(newMuted ? "Acoustic feedback muted" : "Acoustic feedback enabled", {
      icon: newMuted ? <VolumeX className="h-4 w-4 text-neutral-400" /> : <Volume2 className="h-4 w-4 text-emerald-500" />,
    });
  };

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

      toast(result.message, {
        icon: <Zap className="h-4 w-4 text-emerald-500" />,
      });
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
        toast("Campaign reached daily threshold. All outreach queued.", {
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
        });
      }

    } catch (err: any) {
      toast.error("Failed to dispatch: " + err.message);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleRegenerate = async () => {
    if (!campaignState.currentLead) return;
    toast("Regenerating pitch with alternate value angle...", {
      icon: <Sparkles className="h-4 w-4 text-amber-500" />,
    });
    try {
      const freshDraft = await generateLeadOutreach(
        campaignState.currentLead,
        "Focus on automated lead qualification and reducing customer acquisition cost."
      );
      setCampaignState((prev) => ({ ...prev, currentDraft: freshDraft }));
      toast("Updated outreach copy ready for review.", {
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
      });
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
      toast("All discovered targets processed.", {
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
      });
      setCampaignState((prev) => ({ ...prev, status: "completed" }));
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col relative overflow-hidden font-sans transition-colors duration-500 ${
        isDark ? "bg-[#07080c] text-white" : "bg-[#F8F7F4] text-neutral-900"
      }`}
    >
      {/* 3D Spatial Parallax & Volumetric Lighting Canvas */}
      <SpatialCanvas
        isProcessing={isProcessing}
        requiresIntervention={requiresIntervention}
        isDark={isDark}
      />

      {/* Floating Glass Header */}
      <header
        className={`fixed top-0 z-30 flex w-full items-center justify-between px-6 py-4 backdrop-blur-2xl transition-colors duration-500 ${
          isDark
            ? "bg-[#07080c]/60 border-b border-white/[0.06] shadow-[0_4px_30px_rgba(0,0,0,0.5)]"
            : "bg-[#F8F7F4]/80 border-b border-black/[0.06] shadow-sm"
        }`}
      >
        <div className="flex items-center gap-4">
          <EcosystemSwitcher />
          <div className={`h-4 w-px ${isDark ? "bg-white/10" : "bg-neutral-300"}`} />
          <div className="flex items-center gap-2.5">
            <span className="font-display text-sm tracking-widest uppercase font-bold">
              Atlas
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-mono text-[10px] uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span>Spatial Engine</span>
            </div>
          </div>
        </div>

        {/* Ambient AI Command Bar & Hardware Toggles */}
        <div className="flex items-center gap-2.5">
          {/* Audio Acoustic Feedback Switch */}
          <button
            onClick={toggleSound}
            title={isMuted ? "Unmute acoustic feedback" : "Mute acoustic feedback"}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isDark
                ? "border-white/10 bg-white/[0.03] text-white/50 hover:text-white hover:bg-white/[0.08]"
                : "border-neutral-200 bg-white text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 shadow-sm"
            }`}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-emerald-500" />}
          </button>

          {/* Light / Dark Mode Switch */}
          <button
            onClick={toggleTheme}
            title={isDark ? "Switch to Light Canvas" : "Switch to Dark Obsidian"}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isDark
                ? "border-white/10 bg-white/[0.03] text-white/50 hover:text-white hover:bg-white/[0.08]"
                : "border-neutral-200 bg-white text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 shadow-sm"
            }`}
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-600" />}
          </button>

          {/* ⌘K Command Palette Button */}
          <button
            onClick={() => {
              soundManager.playClick();
              setCommandPaletteOpen(true);
            }}
            className={`group flex items-center gap-3 rounded-full border px-4 py-2 transition-all active:scale-[0.98] cursor-pointer ${
              isDark
                ? "border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/20"
                : "border-neutral-200 bg-white hover:bg-neutral-50 hover:border-neutral-300 shadow-sm"
            }`}
          >
            <Search className={`h-4 w-4 transition-colors ${isDark ? "text-white/40 group-hover:text-white/80" : "text-neutral-400 group-hover:text-neutral-800"}`} />
            <span className={`text-xs font-medium transition-colors ${isDark ? "text-white/50 group-hover:text-white/80" : "text-neutral-500 group-hover:text-neutral-800"}`}>
              Search actions or prompts...
            </span>
            <kbd className={`ml-2 rounded border px-1.5 py-0.5 font-mono text-[10px] ${
              isDark ? "border-white/10 bg-black/40 text-white/40" : "border-neutral-200 bg-neutral-100 text-neutral-500"
            }`}>
              ⌘K
            </kbd>
          </button>

          <button
            onClick={() => navigate("/hq/engine")}
            className={`hidden sm:flex items-center gap-1.5 text-xs font-mono px-3.5 py-2 rounded-xl border transition-all cursor-pointer ${
              isDark
                ? "border-white/[0.08] bg-white/[0.02] text-white/60 hover:text-white hover:bg-white/[0.06]"
                : "border-neutral-200 bg-white text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 shadow-sm"
            }`}
          >
            <span>Revenue OS</span>
            <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
      </header>

      {/* Main Spatial Stage */}
      <main className="relative flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pt-24 pb-16 z-10">
        <div className="grain absolute inset-0 pointer-events-none opacity-25 mix-blend-overlay" />

        <CommandEngine
          campaignState={campaignState}
          onStateChange={setCampaignState}
          onRequireIntervention={handleRequireIntervention}
          isDark={isDark}
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
        isDark={isDark}
      />

      {/* Real ⌘K Command Palette */}
      <AtlasCommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onSelectPrompt={(prompt) => {
          const inputEl = document.querySelector("input[placeholder*='target intent']") as HTMLInputElement;
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
          toast("Workspace reset to clean state.", {
            icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
          });
        }}
      />
    </div>
  );
}
