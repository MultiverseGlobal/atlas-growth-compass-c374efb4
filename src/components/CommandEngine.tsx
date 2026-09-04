import { useState, useRef, useEffect, MouseEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, ArrowRight, Activity, Users, Send, RotateCcw, 
  CheckCircle2, ChevronRight, ExternalLink, ShieldCheck, 
  Radar, Cpu, Flame, Target, Compass, Terminal, Radio
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

      toast.info(`Synthesizing tailored outreach for ${foundLeads[0].company}...`, { icon: "✍️" });
      const draft = await generateLeadOutreach(foundLeads[0], strategy.hypothesis);

      onStateChange((prev) => ({
        ...prev,
        status: "awaiting_approval",
        currentDraft: draft,
      }));

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
    <div className="relative flex w-full max-w-5xl flex-col items-center justify-center z-10">
      {/* Master Prompt Input with Liquid Glass & Apple Hardware Feel */}
      <motion.div
        layout
        initial={{ y: 0 }}
        animate={{
          y: isRunning ? -140 : 0,
          scale: isRunning ? 0.96 : 1,
        }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className="z-20 w-full"
      >
        <form onSubmit={handleLaunchCampaign} className="relative group w-full">
          {/* Reactive Outer Specular Glow */}
          <div className="absolute -inset-[2px] rounded-3xl bg-gradient-to-r from-white/20 via-emerald-400/20 to-white/10 opacity-40 blur-lg transition-opacity duration-700 group-hover:opacity-100 group-focus-within:opacity-100" />

          <div className="relative flex w-full items-center overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0b0d14]/90 backdrop-blur-2xl shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85)] transition-all duration-500 focus-within:border-white/30 focus-within:shadow-[0_0_35px_rgba(255,255,255,0.15)]">
            <div className="pl-6 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center shadow-inner">
                <Sparkles
                  className={`h-5 w-5 transition-all duration-500 ${
                    isRunning
                      ? "text-accent animate-pulse"
                      : "text-white/60 group-focus-within:text-white"
                  }`}
                />
              </div>
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
              className="w-full bg-transparent px-5 py-6 font-display text-lg sm:text-2xl text-white placeholder:text-white/25 focus:outline-none disabled:opacity-85 tracking-tight"
            />

            {/* Tactical Controls */}
            <div className="pr-4 flex items-center gap-2">
              <AnimatePresence>
                {inputPrompt.length > 0 && !isRunning && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.85, x: 10 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.85, x: 10 }}
                    type="submit"
                    className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition-all hover:bg-white/90 active:scale-95 shadow-[0_4px_16px_rgba(255,255,255,0.3)] cursor-pointer"
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
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-xs font-mono text-white/60 hover:bg-white/10 hover:text-white transition-all cursor-pointer shadow-sm"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset Flow
                </button>
              )}
            </div>
          </div>
        </form>
      </motion.div>

      {/* 3D Animated Laser Data Beams connecting Prompt to Nodes */}
      <AnimatePresence>
        {isRunning && (
          <motion.div
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full flex justify-center -mt-2 -mb-2 pointer-events-none"
          >
            <div className="w-[85%] h-12 flex justify-between relative">
              <svg className="w-full h-full overflow-visible" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="beamGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgba(255, 255, 255, 0.7)" />
                    <stop offset="100%" stopColor="rgba(16, 185, 129, 0.4)" />
                  </linearGradient>
                </defs>
                {/* Center Drop to 3 Nodes */}
                <path
                  d="M 50% 0 L 50% 12 L 18% 28 L 18% 48 M 50% 12 L 50% 48 M 50% 12 L 82% 28 L 82% 48"
                  stroke="url(#beamGradient)"
                  strokeWidth="1.5"
                  fill="none"
                  strokeDasharray="4 4"
                  className="animate-pulse"
                />
              </svg>
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
            {/* Node 01: Audience Radar */}
            <TiltCard
              icon={Radar}
              step="01"
              title="Audience Radar"
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
                {/* Mini Radar Animation */}
                <div className="relative h-20 w-full rounded-xl bg-black/40 border border-white/5 overflow-hidden flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-12 h-12 rounded-full border border-emerald-500/20" />
                    <div className="w-24 h-24 rounded-full border border-emerald-500/10" />
                    <div className="w-36 h-36 rounded-full border border-emerald-500/5" />
                  </div>
                  {/* Sweeping Radar Line */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/15 to-transparent w-full animate-[spin_4s_linear_infinite]" />
                  
                  <div className="relative z-10 flex items-center gap-2 font-mono text-[11px] text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>Live Source: {campaignState.channel?.toUpperCase()}</span>
                  </div>
                </div>

                {/* Lead Items */}
                {campaignState.leads.length > 0 ? (
                  <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                    {campaignState.leads.slice(0, 3).map((lead, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs rounded-lg bg-white/[0.03] border border-white/5 px-2.5 py-1.5 text-white/90 font-mono"
                      >
                        <span className="truncate max-w-[150px] font-medium">{lead.company}</span>
                        <span className="text-[10px] text-emerald-400 font-semibold">{lead.icp_score}% FIT</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-2 text-xs font-mono text-white/30">
                    Decomposing query parameters...
                  </div>
                )}
              </div>
            </TiltCard>

            {/* Node 02: Outreach Synthesis (Intervention Spotlight) */}
            <TiltCard
              icon={Send}
              step="02"
              title="Outreach Synthesis"
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
                  ? () => onRequireIntervention(campaignState.currentLead!, campaignState.currentDraft!)
                  : undefined
              }
            >
              <div className="mt-4 space-y-3">
                {campaignState.currentLead ? (
                  <div className="rounded-xl border border-white/10 bg-black/40 p-3 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white truncate max-w-[160px]">
                        {campaignState.currentLead.founder?.name}
                      </span>
                      <span className="text-[10px] font-mono text-white/40 uppercase">
                        {campaignState.currentLead.company}
                      </span>
                    </div>
                    {campaignState.currentDraft && (
                      <div className="mt-2 text-[11px] text-white/70 font-sans italic line-clamp-2 bg-white/[0.02] p-2 rounded-lg border border-white/5">
                        "{campaignState.currentDraft.subject}"
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs font-mono text-white/30">
                    Awaiting target qualification...
                  </div>
                )}

                {/* Intervention Alert Prompt */}
                {campaignState.status === "awaiting_approval" && (
                  <div className="flex items-center justify-between text-xs text-amber-300 font-mono pt-1 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                      Intervention Required
                    </span>
                    <span className="underline font-semibold flex items-center gap-0.5">
                      Open <ChevronRight className="h-3 w-3" />
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
              stage={`${campaignState.contactedCount} Delivered`}
              isComplete={campaignState.contactedCount > 0}
            >
              <div className="mt-4 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-white/70 bg-black/30 p-2.5 rounded-xl border border-white/5">
                  <span className="text-white/40 uppercase text-[10px]">Pipeline Value</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    £{(campaignState.contactedCount * 1250).toLocaleString()}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-white/60">
                    <span>Contact Velocity</span>
                    <span className="text-white font-semibold">
                      {campaignState.contactedCount} / {campaignState.targetCount} Targets
                    </span>
                  </div>
                  <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden border border-white/5 p-[1px]">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-white h-full rounded-full transition-all duration-700 shadow-sm"
                      style={{
                        width: `${Math.min(100, (campaignState.contactedCount / (campaignState.targetCount || 15)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-white/40 border-t border-white/5 pt-2">
                  <span>Engine: Autonomous</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Online
                  </span>
                </div>
              </div>
            </TiltCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 3D Tilt Card with Dynamic Mouse Specular Highlight ───────────────────────
function TiltCard({
  icon: Icon,
  step,
  title,
  stage,
  children,
  isActive = false,
  isComplete = false,
  highlight = false,
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
      whileHover={onClick ? { scale: 1.03, y: -4 } : { y: -2 }}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border p-5 backdrop-blur-2xl transition-all duration-300 ${
        onClick ? "cursor-pointer" : ""
      } ${
        highlight
          ? "border-amber-400/80 bg-[#121018]/95 shadow-[0_0_35px_rgba(251,191,36,0.25)] ring-1 ring-amber-400/50 scale-[1.03] z-20"
          : "border-white/[0.08] bg-[#0c0e15]/80 shadow-[0_16px_40px_rgba(0,0,0,0.6)] hover:border-white/20"
      }`}
      style={{
        boxShadow: highlight
          ? "0 0 40px rgba(251, 191, 36, 0.25), inset 0 1px 1px 0 rgba(255, 255, 255, 0.2)"
          : "0 20px 45px rgba(0, 0, 0, 0.7), inset 0 1px 1px 0 rgba(255, 255, 255, 0.08)",
      }}
    >
      {/* Dynamic Specular Glare following Mouse */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 hover:opacity-100"
        style={{
          background: `radial-gradient(circle 180px at ${glarePos.x}% ${glarePos.y}%, rgba(255, 255, 255, 0.09), transparent 80%)`,
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`rounded-xl p-2.5 border transition-colors ${
              highlight
                ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                : isComplete
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                : "bg-white/[0.04] text-white/70 border-white/10"
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[9px] uppercase tracking-wider text-white/40 font-bold">
                PHASE {step}
              </span>
            </div>
            <h3 className="font-display text-sm font-semibold text-white tracking-tight">{title}</h3>
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/50">{stage}</p>
          </div>
        </div>

        {/* State Ping Indicator */}
        <div>
          {highlight ? (
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            </span>
          ) : isActive ? (
            <Cpu className="h-4 w-4 animate-spin text-emerald-400" />
          ) : isComplete ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : null}
        </div>
      </div>

      {children}
    </motion.div>
  );
}
