import { useState, useRef, useEffect, MouseEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, ArrowRight, Activity, Users, Send, RotateCcw, 
  CheckCircle2, ChevronRight, ExternalLink, ShieldCheck, 
  Radar, Cpu, Flame, Target, Compass, Terminal, Radio,
  Brain, PenTool, Zap, Globe, Layers, AlertCircle
} from "lucide-react";
import { 
  decomposeCampaignPrompt, 
  discoverCampaignLeads, 
  generateLeadOutreach, 
  type DiscoveredLead, 
  type OutreachDraft, 
  type CampaignState 
} from "@/services/campaignEngine";
import { soundManager } from "@/lib/audioFeedback";
import { toast } from "sonner";

interface CommandEngineProps {
  campaignState: CampaignState;
  onStateChange: (updater: (prev: CampaignState) => CampaignState) => void;
  onRequireIntervention: (lead: DiscoveredLead, draft: OutreachDraft) => void;
  isDark?: boolean;
  isAutoPilot?: boolean;
  onToggleAutoPilot?: () => void;
}

const PRESET_CAMPAIGNS = [
  { label: "Seed AI Startups (YC)", query: "Target YC seed AI startups scaling SDR pipeline" },
  { label: "B2B Design Agencies (Clutch)", query: "Cold outreach to creative design agency founders 10-50 headcount" },
  { label: "Engineering Teams (Hacker News)", query: "Find B2B SaaS teams hiring engineers on Hacker News" },
  { label: "Operational Bottlenecks", query: "Target founders with manual client onboarding friction" },
];

export function CommandEngine({
  campaignState,
  onStateChange,
  onRequireIntervention,
  isDark = true,
  isAutoPilot = false,
  onToggleAutoPilot,
}: CommandEngineProps) {
  const [inputPrompt, setInputPrompt] = useState("");
  const [selectedLeadModal, setSelectedLeadModal] = useState<DiscoveredLead | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isRunning = campaignState.status !== "idle" && campaignState.status !== "completed";

  useEffect(() => {
    if (campaignState.status === "idle" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [campaignState.status]);

  // ── Launch Campaign Workflow ───────────────────────────────────────────────
  const executePrompt = async (promptText: string) => {
    const prompt = promptText.trim();
    if (!prompt) return;

    soundManager.playClick();

    onStateChange((prev) => ({
      ...prev,
      prompt,
      status: "decomposing",
      leads: [],
      activeLeadIndex: 0,
      currentLead: null,
      currentDraft: null,
      contactedCount: 0,
      error: undefined,
    }));

    try {
      toast("Decomposing campaign strategy & targeting...", {
        icon: <Brain className="h-4 w-4 text-emerald-500" />,
      });
      const strategy = await decomposeCampaignPrompt(prompt);

      onStateChange((prev) => ({
        ...prev,
        status: "discovering",
        channel: strategy.channel,
        keyword: strategy.keyword,
        industry: strategy.industry,
        targetCount: strategy.targetCount,
      }));

      toast(`Scanning ${strategy.channel.toUpperCase()} & databases for ${strategy.keyword}...`, {
        icon: <Radar className="h-4 w-4 text-sky-500" />,
      });
      const foundLeads = await discoverCampaignLeads(strategy.channel, strategy.keyword, strategy.industry);

      if (foundLeads.length === 0) {
        throw new Error("No leads found for this query. Try a broader industry or keyword.");
      }

      onStateChange((prev) => ({
        ...prev,
        status: "drafting",
        leads: foundLeads,
        currentLead: foundLeads[0],
      }));

      toast(`Synthesizing tailored outreach for ${foundLeads[0].company}...`, {
        icon: <PenTool className="h-4 w-4 text-amber-500" />,
      });
      const draft = await generateLeadOutreach(foundLeads[0], strategy.hypothesis);

      onStateChange((prev) => ({
        ...prev,
        status: "awaiting_approval",
        currentDraft: draft,
      }));

      soundManager.playChime();
      onRequireIntervention(foundLeads[0], draft);
      toast("Outreach ready for review. System paused for authorization.", {
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
      });

    } catch (err: any) {
      toast.error(err.message || "Failed to run campaign.");
      onStateChange((prev) => ({
        ...prev,
        status: "idle",
        error: err.message,
      }));
    }
  };

  const handleLaunchCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    executePrompt(inputPrompt);
  };

  const handleReset = () => {
    soundManager.playClick();
    onStateChange((prev) => ({
      ...prev,
      status: "idle",
      leads: [],
      currentLead: null,
      currentDraft: null,
      error: undefined,
    }));
    setInputPrompt("");
    setSelectedLeadModal(null);
  };

  return (
    <div className="relative flex w-full max-w-5xl flex-col items-center justify-center z-10">
      {/* Master Prompt Input */}
      <motion.div
        layout
        initial={{ y: 0 }}
        animate={{
          y: isRunning ? -60 : 0,
          scale: isRunning ? 0.96 : 1,
        }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className="z-20 w-full"
      >
        <form onSubmit={handleLaunchCampaign} className="relative group w-full">
          {/* Specular Ambient Glare Ring */}
          <div
            className={`absolute -inset-[2px] rounded-3xl opacity-30 blur-lg transition-opacity duration-700 group-hover:opacity-80 group-focus-within:opacity-80 ${
              isDark
                ? "bg-gradient-to-r from-white/20 via-emerald-400/20 to-white/10"
                : "bg-gradient-to-r from-neutral-300/60 via-emerald-500/20 to-neutral-200/50"
            } ${!isRunning && inputPrompt.length === 0 ? "atlas-animate-breathe" : ""}`}
          />

          <div
            className={`relative flex w-full items-center overflow-hidden rounded-2xl border transition-all duration-500 backdrop-blur-2xl ${
              isDark
                ? "border-white/[0.12] bg-[#0b0d14]/90 text-white shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85)] focus-within:border-white/30 focus-within:shadow-[0_0_35px_rgba(255,255,255,0.12)]"
                : "border-black/[0.10] bg-white/85 text-neutral-900 shadow-[0_16px_45px_-8px_rgba(0,0,0,0.10)] focus-within:border-black/25 focus-within:shadow-[0_0_30px_rgba(0,0,0,0.08)]"
            }`}
          >
            <div className="pl-6 flex items-center gap-3">
              {/* Removed ChevronRight as requested */}
            </div>

            <input
              ref={inputRef}
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              disabled={isRunning}
              placeholder={
                isRunning
                  ? `Campaign: "${campaignState.prompt}"`
                  : "State your target intent (e.g. 'Target Series-A B2B SaaS founders for outbound pipeline')..."
              }
              className={`w-full bg-transparent px-5 py-5 font-sans font-normal text-base sm:text-xl focus:outline-none disabled:opacity-85 tracking-tight ${
                isDark ? "placeholder:text-white/35 text-white" : "placeholder:text-neutral-400 text-neutral-900"
              }`}
            />

            {/* Tactical Controls */}
            <div className="pr-4 flex items-center gap-2">
              <AnimatePresence>
                {!isRunning && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.85, x: 10 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.85, x: 10 }}
                    type="submit"
                    disabled={inputPrompt.trim().length === 0}
                    className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all shadow-md whitespace-nowrap flex-shrink-0 ${
                      inputPrompt.trim().length === 0
                        ? isDark ? "bg-white/10 text-white/40 cursor-not-allowed" : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                        : isDark
                        ? "bg-white text-black hover:bg-white/90 active:scale-95 shadow-[0_4px_16px_rgba(255,255,255,0.25)] cursor-pointer"
                        : "bg-neutral-900 text-white hover:bg-neutral-800 active:scale-95 shadow-[0_4px_16px_rgba(0,0,0,0.18)] cursor-pointer"
                    }`}
                  >
                    <span>Initiate Flow</span>
                    <ArrowRight className="h-4 w-4" />
                  </motion.button>
                )}
              </AnimatePresence>

              {isRunning && (
                <button
                  type="button"
                  onClick={handleReset}
                  className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-mono font-semibold transition-all cursor-pointer shadow-sm ${
                    isDark
                      ? "border-white/20 bg-white/[0.08] text-white hover:bg-white/15"
                      : "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50 shadow-md"
                  }`}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Stop & Go Back
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Preset Intent Tactical Dock (Only when Idle) */}
        {!isRunning && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-4 flex flex-wrap items-center justify-center gap-2"
          >
            {PRESET_CAMPAIGNS.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setInputPrompt(preset.query);
                  executePrompt(preset.query);
                }}
                className="px-3.5 py-1.5 rounded-full border text-xs font-mono font-medium tracking-tight transition-all cursor-pointer backdrop-blur-md border-neutral-300 bg-white text-neutral-900 hover:border-neutral-400 hover:bg-neutral-50 shadow-sm hover:shadow-md dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 dark:hover:border-white/40 dark:hover:text-white dark:hover:shadow-[0_0_15px_rgba(255,255,255,0.15)]"
              >
                <span>{preset.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </motion.div>

      {/* Strategic Waypoint Breadcrumb Track */}
      <AnimatePresence>
        {isRunning && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-2xl mx-auto flex items-center justify-between px-6 py-2 my-2 text-xs font-mono"
          >
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${campaignState.leads.length > 0 ? "bg-foreground" : "bg-foreground animate-ping"}`} />
              <span className={campaignState.leads.length > 0 ? "text-foreground font-semibold" : "text-muted-foreground"}>
                01 Reconnaissance
              </span>
            </div>
            <div className="h-px flex-1 mx-4 bg-border" />
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${campaignState.currentDraft ? "bg-foreground" : campaignState.status === "drafting" ? "bg-foreground opacity-50 animate-ping" : "bg-border"}`} />
              <span className={campaignState.currentDraft ? "text-foreground font-semibold" : "text-muted-foreground"}>
                02 Tactical Angle
              </span>
            </div>
            <div className="h-px flex-1 mx-4 bg-border" />
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${campaignState.contactedCount > 0 ? "bg-foreground" : "bg-border"}`} />
              <span className={campaignState.contactedCount > 0 ? "text-foreground font-semibold" : "text-muted-foreground"}>
                03 Dispatch
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spatial Running Nodes with 3D Mouse Parallax Tilt & Specular Glare */}
      <AnimatePresence>
        {isRunning && (
          <motion.div
            initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 30, filter: "blur(10px)" }}
            transition={{ delay: 0.1, type: "spring", stiffness: 140, damping: 20 }}
            className="w-full mt-2 grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {/* Node 01: Audience Reconnaissance */}
            <TiltCard
              icon={Radar}
              step="01"
              title="Audience Reconnaissance"
              isDark={isDark}
              stage={
                campaignState.status === "decomposing"
                  ? "Decomposing Intent..."
                  : campaignState.status === "discovering"
                  ? "Scanning Live Sources..."
                  : `${campaignState.leads.length} Targets Verified`
              }
              isActive={campaignState.status === "discovering"}
              isComplete={campaignState.leads.length > 0}
            >
              <div className="mt-4 space-y-3">
                {/* Visual Telemetry Badge */}
                <div
                  className="relative h-12 w-full rounded-xl flex items-center justify-between px-4 border bg-muted border-border"
                >
                  <div className="flex items-center gap-2.5 font-mono text-[11px] text-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-foreground animate-pulse" />
                    <span className="font-semibold uppercase tracking-wider">{campaignState.channel?.toUpperCase() || "YC / DIRECT"}</span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase truncate max-w-[140px]">
                    {campaignState.keyword || "Active Channel"}
                  </span>
                </div>

                {/* Discovered Leads List with Click-to-Inspect */}
                {campaignState.leads.length > 0 ? (
                  <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                    {campaignState.leads.slice(0, 4).map((lead, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedLeadModal(lead)}
                        className="w-full flex items-center justify-between text-xs rounded-lg border px-2.5 py-1.5 font-mono text-left transition-colors cursor-pointer bg-card border-border hover:bg-muted text-foreground shadow-sm"
                      >
                        <span className="truncate max-w-[150px] font-medium">{lead.company}</span>
                        <span className="text-[10px] text-foreground font-semibold">{lead.icp_score}% FIT</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-2 text-xs font-mono text-muted-foreground">
                    Decomposing query parameters...
                  </div>
                )}
              </div>
            </TiltCard>

            {/* Node 02: Tactical Synthesis (Intervention Spotlight) */}
            <TiltCard
              icon={Send}
              step="02"
              title="Tactical Synthesis"
              isDark={isDark}
              stage={
                campaignState.status === "drafting"
                  ? "Synthesizing Copy..."
                  : campaignState.status === "awaiting_approval"
                  ? "Human Decision Required"
                  : campaignState.status === "dispatching"
                  ? "Dispatching Envelope..."
                  : "Standby"
              }
              isActive={campaignState.status === "drafting" || campaignState.status === "dispatching"}
              highlight={campaignState.status === "awaiting_approval"}
              onClick={
                campaignState.status === "awaiting_approval" && campaignState.currentLead && campaignState.currentDraft
                  ? () => {
                      soundManager.playClick();
                      onRequireIntervention(campaignState.currentLead!, campaignState.currentDraft!);
                    }
                  : undefined
              }
            >
              <div className="mt-4 space-y-3">
                {campaignState.currentLead ? (
                  <div
                    className="rounded-xl border p-3 relative overflow-hidden bg-card border-border/50 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold truncate max-w-[160px] text-foreground">
                        {campaignState.currentLead.founder?.name}
                      </span>
                      <span className="text-[10px] font-mono uppercase text-muted-foreground">
                        {campaignState.currentLead.company}
                      </span>
                    </div>
                    {campaignState.currentDraft && (
                      <div
                        className="mt-2 text-[11px] font-sans italic line-clamp-2 p-2 rounded-lg border text-foreground bg-muted/50 border-border/50"
                      >
                        "{campaignState.currentDraft.subject}"
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs font-mono text-muted-foreground">
                    Awaiting target qualification...
                  </div>
                )}

                {/* Intervention Alert Prompt */}
                {campaignState.status === "awaiting_approval" && (
                  <div className="flex items-center justify-between text-xs text-foreground font-mono pt-1 p-2.5 rounded-lg bg-foreground/5 border border-foreground/20 cursor-pointer">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <span className="h-2 w-2 rounded-full bg-foreground animate-ping" />
                      Intervention Required
                    </span>
                    <span className="underline font-semibold flex items-center gap-0.5">
                      Review Draft <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                )}
              </div>
            </TiltCard>

            {/* Node 03: Autonomous Telemetry & Pipeline Value */}
            <TiltCard
              icon={Activity}
              step="03"
              title="Telemetry & Dispatch"
              isDark={isDark}
              stage={`${campaignState.contactedCount} Delivered`}
              isComplete={campaignState.contactedCount > 0}
            >
              <div className="mt-4 space-y-3 font-mono text-xs">
                <div
                  className="flex items-center justify-between p-2.5 rounded-xl border bg-muted text-foreground border-border"
                >
                  <span className="uppercase text-[10px] text-muted-foreground">
                    Pipeline Velocity
                  </span>
                  <span className="text-foreground font-bold text-sm">
                    £{(campaignState.contactedCount * 1250).toLocaleString()}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Target Quota</span>
                    <span className="font-semibold text-foreground">
                      {campaignState.contactedCount} / {campaignState.targetCount} Targets
                    </span>
                  </div>
                  <div
                    className="w-full rounded-full h-2 overflow-hidden border p-[1px] bg-muted border-border"
                  >
                    <div
                      className="bg-foreground h-full rounded-full transition-all duration-700 shadow-sm opacity-80"
                      style={{
                        width: `${Math.min(100, (campaignState.contactedCount / (campaignState.targetCount || 15)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] border-t pt-2 text-muted-foreground border-border">
                  <div className="flex items-center gap-1.5">
                    <span>Mode:</span>
                    <button
                      type="button"
                      onClick={onToggleAutoPilot}
                      className="font-semibold cursor-pointer underline hover:text-foreground transition-colors text-foreground"
                    >
                      {isAutoPilot ? "Auto-Pilot" : "Supervised"}
                    </button>
                  </div>
                  <span className="text-foreground flex items-center gap-1 font-semibold">
                    <span className="h-1.5 w-1.5 rounded-full bg-foreground animate-pulse" />
                    Active
                  </span>
                </div>
              </div>
            </TiltCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Lead Inspection Modal (Node 01 Detail) */}
      <AnimatePresence>
        {selectedLeadModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
            onClick={() => setSelectedLeadModal(null)}
          >
            <div
              className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl backdrop-blur-2xl ${
                isDark ? "bg-[#0f111a] border-white/10 text-white" : "bg-white border-neutral-200 text-neutral-900"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h3 className="font-display text-base font-bold">{selectedLeadModal.company}</h3>
                  <a
                    href={selectedLeadModal.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-emerald-500 flex items-center gap-1 font-mono hover:underline"
                  >
                    <Globe className="h-3 w-3" />
                    {selectedLeadModal.website}
                  </a>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  {selectedLeadModal.icp_score}% FIT
                </span>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div>
                  <span className={`block uppercase font-mono text-[10px] ${isDark ? "text-white/40" : "text-neutral-400"}`}>
                    Founder / Decision Maker
                  </span>
                  <p className="font-medium mt-0.5">{selectedLeadModal.founder?.name} ({selectedLeadModal.founder?.role})</p>
                  <p className={`font-mono mt-0.5 ${isDark ? "text-white/60" : "text-neutral-600"}`}>
                    {selectedLeadModal.founder?.email}
                  </p>
                </div>

                <div>
                  <span className={`block uppercase font-mono text-[10px] ${isDark ? "text-white/40" : "text-neutral-400"}`}>
                    Thesis & Identified Bottleneck
                  </span>
                  <p className="mt-0.5 leading-relaxed">{selectedLeadModal.bottleneck || selectedLeadModal.founder_thesis}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedLeadModal(null)}
                className={`mt-6 w-full py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                  isDark ? "bg-white text-black hover:bg-white/90" : "bg-neutral-900 text-white hover:bg-neutral-800"
                }`}
              >
                Close Inspection
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 3D Tilt Card with Dynamic Mouse Specular Glare ───────────────────────────
function TiltCard({
  icon: Icon,
  step,
  title,
  stage,
  children,
  isActive = false,
  isComplete = false,
  highlight = false,
  isDark = true,
  onClick,
}: {
  icon: any;
  step: string;
  title: string;
  stage: string;
  children?: React.ReactNode;
  isActive?: boolean;
  isComplete?: boolean;
  highlight?: boolean;
  isDark?: boolean;
  onClick?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setGlarePos({ x, y });
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      whileHover={onClick ? { scale: 1.025, y: -3 } : { y: -2 }}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border p-5 backdrop-blur-2xl transition-all duration-300 ${
        onClick ? "cursor-pointer" : ""
      } ${
        highlight
          ? "border-foreground/30 bg-foreground/5 shadow-[0_0_30px_rgba(255,255,255,0.05)] ring-1 ring-foreground/20 scale-[1.02] z-20"
          : "border-border/60 bg-card shadow-[0_16px_40px_rgba(0,0,0,0.4)] hover:border-border"
      }`}
    >
      {/* Dynamic Specular Glare following Mouse */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 hover:opacity-100"
        style={{
          background: `radial-gradient(circle 180px at ${glarePos.x}% ${glarePos.y}%, ${
            isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"
          }, transparent 80%)`,
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`rounded-xl p-2.5 border transition-colors ${
              highlight
                ? "bg-foreground/10 text-foreground border-foreground/20"
                : isComplete
                ? "bg-foreground/5 text-foreground border-foreground/10"
                : "bg-muted text-muted-foreground border-border/50"
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`font-mono text-[9px] uppercase tracking-wider font-bold ${
                highlight ? "text-foreground/80" : "text-muted-foreground"
              }`}>
                PHASE {step}
              </span>
            </div>
            <h3 className={`font-display text-sm font-semibold tracking-tight text-foreground`}>
              {title}
            </h3>
            <p className={`font-mono text-[10px] uppercase tracking-wider ${
              highlight ? "text-foreground/70" : "text-muted-foreground"
            }`}>
              {stage}
            </p>
          </div>
        </div>

        {/* State Ping Indicator */}
        <div>
          {highlight ? (
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground opacity-50" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-foreground shadow-[0_0_8px_rgba(255,255,255,0.3)]" />
            </span>
          ) : isActive ? (
            <Cpu className="h-4 w-4 animate-spin text-foreground" />
          ) : isComplete ? (
            <CheckCircle2 className="h-4 w-4 text-foreground" />
          ) : null}
        </div>
      </div>

      {children}
    </motion.div>
  );
}
