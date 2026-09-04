import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, ArrowRight, Activity, Users, Send, Pause, Play, 
  RotateCcw, CheckCircle2, ChevronRight, ExternalLink, ShieldCheck, 
  Radar, Cpu, Flame 
} from "lucide-react";
import { 
  decomposeCampaignPrompt, 
  discoverCampaignLeads, 
  generateLeadOutreach, 
  type DiscoveredLead, 
  type OutreachDraft, 
  type CampaignState 
} from "@/services/campaignEngine";
import { toast } from "sonner";

interface CommandEngineProps {
  campaignState: CampaignState;
  onStateChange: (updater: (prev: CampaignState) => CampaignState) => void;
  onRequireIntervention: (lead: DiscoveredLead, draft: OutreachDraft) => void;
}

export function CommandEngine({
  campaignState,
  onStateChange,
  onRequireIntervention,
}: CommandEngineProps) {
  const [inputPrompt, setInputPrompt] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isRunning = campaignState.status !== "idle" && campaignState.status !== "completed";

  useEffect(() => {
    if (campaignState.status === "idle" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [campaignState.status]);

  // ── Launch Campaign Workflow ───────────────────────────────────────────────
  const handleLaunchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = inputPrompt.trim();
    if (!prompt) return;

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
      // 1. Decompose prompt into actionable parameters
      toast.info("Decomposing campaign strategy & targeting...", { icon: "🧠" });
      const strategy = await decomposeCampaignPrompt(prompt);

      onStateChange((prev) => ({
        ...prev,
        status: "discovering",
        channel: strategy.channel,
        keyword: strategy.keyword,
        industry: strategy.industry,
        targetCount: strategy.targetCount,
      }));

      // 2. Discover Leads
      toast.info(`Scanning ${strategy.channel.toUpperCase()} & databases for ${strategy.keyword}...`, { icon: "📡" });
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

      // 3. Generate Personalized Outreach for first lead
      toast.info(`Synthesizing tailored outreach for ${foundLeads[0].company}...`, { icon: "✍️" });
      const draft = await generateLeadOutreach(foundLeads[0], strategy.hypothesis);

      onStateChange((prev) => ({
        ...prev,
        status: "awaiting_approval",
        currentDraft: draft,
      }));

      // 4. Trigger Intervention Drawer (One-Way Street halt)
      onRequireIntervention(foundLeads[0], draft);
      toast.success("Outreach ready for review! Click to inspect.", { icon: "🎯" });

    } catch (err: any) {
      toast.error(err.message || "Failed to run campaign.");
      onStateChange((prev) => ({
        ...prev,
        status: "idle",
        error: err.message,
      }));
    }
  };

  const handleReset = () => {
    onStateChange((prev) => ({
      ...prev,
      status: "idle",
      leads: [],
      currentLead: null,
      currentDraft: null,
      error: undefined,
    }));
    setInputPrompt("");
  };

  return (
    <div className="relative flex w-full max-w-5xl flex-col items-center justify-center">
      {/* Dynamic Master Prompt Input Bar */}
      <motion.div
        layout
        initial={{ y: 0 }}
        animate={{
          y: isRunning ? -160 : 0,
          scale: isRunning ? 0.95 : 1,
        }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
        className="z-20 w-full"
      >
        <form onSubmit={handleLaunchCampaign} className="relative group w-full">
          {/* Spatial Ambient Glow */}
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-accent/25 via-emerald-500/15 to-transparent opacity-0 blur-xl transition-opacity duration-700 group-hover:opacity-100" />

          <div className="relative flex w-full items-center overflow-hidden rounded-2xl border border-white/10 bg-[#0e1018]/90 pds-glass-elevated shadow-card transition-all duration-300 focus-within:border-white/25 focus-within:shadow-glow">
            <div className="pl-6 flex items-center gap-2">
              <Sparkles
                className={`h-6 w-6 transition-all duration-500 ${
                  isRunning
                    ? "text-accent animate-pulse"
                    : "text-white/40 group-focus-within:text-white/90"
                }`}
              />
            </div>

            <input
              ref={inputRef}
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              disabled={isRunning}
              placeholder={
                isRunning
                  ? `Campaign Active: "${campaignState.prompt}"`
                  : "Type campaign intent: e.g. 'Target YC AI founders scaling outreach'..."
              }
              className="w-full bg-transparent px-5 py-6 font-display text-xl sm:text-2xl text-white placeholder:text-white/20 focus:outline-none disabled:opacity-80"
              style={{ letterSpacing: "-0.02em" }}
            />

            {/* Action Buttons */}
            <div className="pr-4 flex items-center gap-2">
              <AnimatePresence>
                {inputPrompt.length > 0 && !isRunning && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.85, x: 10 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.85, x: 10 }}
                    type="submit"
                    className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition-all hover:bg-white/90 active:scale-95 shadow-md"
                  >
                    <span>Deploy</span>
                    <ArrowRight className="h-4 w-4" />
                  </motion.button>
                )}
              </AnimatePresence>

              {isRunning && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-mono text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </button>
              )}
            </div>
          </div>
        </form>
      </motion.div>

      {/* Spatial Running Nodes (Real Data Flow) */}
      <AnimatePresence>
        {isRunning && (
          <motion.div
            initial={{ opacity: 0, y: 40, filter: "blur(12px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 40, filter: "blur(12px)" }}
            transition={{ delay: 0.15, type: "spring", stiffness: 120, damping: 20 }}
            className="w-full mt-4 grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {/* Node 1: Audience Discovery */}
            <NodeCard
              icon={Users}
              title="Audience Discovery"
              stage={
                campaignState.status === "decomposing"
                  ? "Decomposing Intent..."
                  : campaignState.status === "discovering"
                  ? "Scraping & Scoring..."
                  : `${campaignState.leads.length} Leads Identified`
              }
              isActive={campaignState.status === "discovering"}
              isComplete={campaignState.leads.length > 0}
            >
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-white/60 font-mono">
                  <span>Channel: {campaignState.channel?.toUpperCase()}</span>
                  <span>Target: {campaignState.targetCount}</span>
                </div>
                {campaignState.leads.length > 0 && (
                  <div className="space-y-1.5 border-t border-white/5 pt-2 max-h-24 overflow-y-auto">
                    {campaignState.leads.slice(0, 3).map((lead, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs rounded-lg bg-black/20 px-2 py-1 text-white/80"
                      >
                        <span className="truncate max-w-[140px] font-medium">{lead.company}</span>
                        <span className="font-mono text-[10px] text-emerald-400">{lead.icp_score}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </NodeCard>

            {/* Node 2: Outreach Engine (Intervention Pulse) */}
            <NodeCard
              icon={Send}
              title="Outreach Synthesis"
              stage={
                campaignState.status === "drafting"
                  ? "Synthesizing Copy..."
                  : campaignState.status === "awaiting_approval"
                  ? "Awaiting Human Review"
                  : campaignState.status === "dispatching"
                  ? "Dispatching Email..."
                  : "Ready"
              }
              isActive={campaignState.status === "drafting" || campaignState.status === "dispatching"}
              highlight={campaignState.status === "awaiting_approval"}
              onClick={
                campaignState.status === "awaiting_approval" && campaignState.currentLead && campaignState.currentDraft
                  ? () => onRequireIntervention(campaignState.currentLead!, campaignState.currentDraft!)
                  : undefined
              }
            >
              <div className="mt-3 space-y-2">
                {campaignState.currentLead ? (
                  <div className="rounded-xl border border-white/10 bg-black/30 p-2.5">
                    <div className="text-xs font-semibold text-white truncate">
                      To: {campaignState.currentLead.founder?.name} ({campaignState.currentLead.company})
                    </div>
                    {campaignState.currentDraft && (
                      <div className="mt-1 text-[11px] text-white/60 line-clamp-2 font-mono">
                        "{campaignState.currentDraft.subject}"
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-white/40 font-mono py-2">
                    Waiting for qualified target...
                  </div>
                )}

                {campaignState.status === "awaiting_approval" && (
                  <div className="flex items-center justify-between text-[11px] text-accent font-mono pt-1">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-accent animate-ping" />
                      Intervention Required
                    </span>
                    <span className="underline cursor-pointer">Open Drawer →</span>
                  </div>
                )}
              </div>
            </NodeCard>

            {/* Node 3: Data Telemetry & Revenue Impact */}
            <NodeCard
              icon={Activity}
              title="Telemetry & Dispatch"
              stage={`${campaignState.contactedCount} Dispatched`}
              isComplete={campaignState.contactedCount > 0}
            >
              <div className="mt-3 space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between text-white/60">
                  <span>Contacted Velocity</span>
                  <span className="text-white font-semibold">{campaignState.contactedCount} / {campaignState.targetCount}</span>
                </div>
                <div className="flex items-center justify-between text-white/60">
                  <span>Est. Pipeline Value</span>
                  <span className="text-emerald-400 font-semibold">
                    £{campaignState.contactedCount * 1200}
                  </span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden mt-1">
                  <div
                    className="bg-accent h-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (campaignState.contactedCount / (campaignState.targetCount || 10)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </NodeCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NodeCard({
  icon: Icon,
  title,
  stage,
  children,
  isActive = false,
  isComplete = false,
  highlight = false,
  onClick,
}: {
  icon: any;
  title: string;
  stage: string;
  children?: React.ReactNode;
  isActive?: boolean;
  isComplete?: boolean;
  highlight?: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.div
      whileHover={onClick ? { scale: 1.02 } : undefined}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border bg-[#121520]/90 p-5 pds-glass transition-all duration-300 ${
        onClick ? "cursor-pointer" : ""
      } ${
        highlight
          ? "border-accent ring-2 ring-accent/30 shadow-glow z-10 scale-[1.03]"
          : "border-white/10 shadow-card hover:border-white/20"
      }`}
    >
      {/* Specular Hairline Highlight */}
      <div
        className="absolute inset-0 rounded-2xl border border-white/10 pointer-events-none"
        style={{ mixBlendMode: "overlay" }}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`rounded-xl p-2.5 ${
              highlight
                ? "bg-accent/20 text-accent border border-accent/30"
                : isComplete
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-white/5 text-white/60"
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold text-white tracking-tight">{title}</h3>
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/50">{stage}</p>
          </div>
        </div>

        {/* Status Indicator */}
        <div>
          {highlight ? (
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
            </span>
          ) : isActive ? (
            <Cpu className="h-4 w-4 animate-spin text-white/40" />
          ) : isComplete ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : null}
        </div>
      </div>

      {children}
    </motion.div>
  );
}
