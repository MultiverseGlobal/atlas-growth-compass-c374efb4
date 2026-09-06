import React, { useState, useEffect } from "react";
import { 
  Target, Sparkles, Check, ArrowRight, Play, 
  ShieldCheck, Sun, Moon, Volume2, VolumeX, Building2 
} from "lucide-react";
import { proposeIcp, approveIcp } from "@/lib/atlas/api";
import { executeAcquisitionRun, RunProgress } from "@/lib/atlas/worker";
import { AtlasIcpProfile } from "@/lib/atlas/types";
import { Link, useNavigate } from "react-router-dom";
import { EcosystemSwitcher } from "@/components/atlas/EcosystemSwitcher";
import { LogoMark } from "@/components/atlas/Logo";
import { soundManager } from "@/lib/audioFeedback";
import { toast } from "sonner";

export default function ObjectivesPage() {
  const navigate = useNavigate();

  // Theme state
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("atlas.theme");
    return stored ? stored === "dark" : true;
  });

  const [isMuted, setIsMuted] = useState<boolean>(soundManager.isMuted);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      root.classList.remove("light");
      localStorage.setItem("atlas.theme", "dark");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
      localStorage.setItem("atlas.theme", "light");
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);
  const toggleSound = () => {
    const nextState = !isMuted;
    setIsMuted(nextState);
    soundManager.setMuted(nextState);
  };

  // Intent Inputs
  const [offerSummary, setOfferSummary] = useState(
    "AI operations automation to eliminate client delivery friction and manual weekly reporting"
  );
  const [targetHypothesis, setTargetHypothesis] = useState(
    "5–30 person digital, web, and marketing agencies in the US and UK"
  );

  // Workflow states
  const [isProposing, setIsProposing] = useState(false);
  const [proposedIcp, setProposedIcp] = useState<AtlasIcpProfile | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Run states
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState<RunProgress | null>(null);

  // 1. Propose Search Thesis
  const handlePropose = async () => {
    if (!offerSummary || !targetHypothesis) {
      toast.error("Please provide both offer summary and target hypothesis.");
      return;
    }

    setIsProposing(true);
    try {
      const res = await proposeIcp({ offerSummary, targetHypothesis });
      setProposedIcp(res.icpDraft);
      setIsApproved(false);
      toast.success("AI Search Thesis synthesized. Review and approve below.");
    } catch (err) {
      toast.error("Failed to propose search thesis");
    } finally {
      setIsProposing(false);
    }
  };

  // 2. Approve & Lock Version
  const handleApprove = async () => {
    if (!proposedIcp) return;
    setIsApproving(true);
    try {
      const res = await approveIcp({ icpId: proposedIcp.id });
      setProposedIcp((prev) =>
        prev
          ? {
              ...prev,
              version: res.version,
              status: "approved",
            }
          : null
      );
      setIsApproved(true);
      toast.success(`Search Thesis locked as Version ${res.version}!`);
    } catch (err) {
      toast.error("Failed to approve thesis");
    } finally {
      setIsApproving(false);
    }
  };

  // 3. Dispatch Acquisition Run
  const handleRun = async () => {
    if (!proposedIcp) return;
    setIsRunning(true);
    setRunProgress(null);
    try {
      const run = await executeAcquisitionRun(proposedIcp.id, (progress) => {
        setRunProgress({ ...progress });
      });
      toast.success(
        `Acquisition run completed! Discovered ${run.items_discovered}, Qualified ${run.items_qualified}.`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to execute acquisition run");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-500 ${
        isDark ? "bg-[#07080C] text-neutral-100" : "bg-[#F9F9FB] text-neutral-900"
      }`}
    >
      {/* ── Top Sovereign Process Header ──────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-30 flex w-full items-center justify-between px-6 py-3.5 backdrop-blur-2xl transition-colors duration-500 border-b ${
          isDark
            ? "bg-[#07080c]/80 border-white/[0.08] shadow-sm"
            : "bg-white/80 border-neutral-200 shadow-sm"
        }`}
      >
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div
              className={`h-8 w-8 rounded-xl border flex items-center justify-center transition-colors ${
                isDark
                  ? "bg-white/[0.04] border-white/10 text-white"
                  : "bg-white border-neutral-200 text-neutral-900 shadow-sm"
              }`}
            >
              <LogoMark size={16} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs tracking-wider uppercase font-display">
                ATLAS
              </span>
              <span className="text-[9px] text-[var(--pds-text-muted)] font-mono">
                Economic Engine
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 p-1 rounded-xl border bg-[var(--pds-surface-1)] border-[var(--pds-border-subtle)]">
            <Link
              to="/"
              className={`px-3 py-1 rounded-lg text-xs font-mono transition-all hover:text-[var(--pds-text-primary)] ${
                isDark
                  ? "text-white/60 hover:text-white"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              Morning Focus
            </Link>
            <Link
              to="/objectives"
              className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                isDark
                  ? "bg-white/10 text-white"
                  : "bg-neutral-200 text-neutral-900"
              }`}
            >
              Define Hunt
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={toggleSound}
            title={isMuted ? "Unmute acoustic feedback" : "Mute acoustic feedback"}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isDark
                ? "border-white/10 bg-white/[0.03] text-white/50 hover:text-white"
                : "border-neutral-200 bg-white text-neutral-500 hover:text-neutral-900 shadow-sm"
            }`}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4 text-emerald-500" />
            )}
          </button>

          <button
            onClick={toggleTheme}
            title="Toggle color theme"
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isDark
                ? "border-white/10 bg-white/[0.03] text-white/50 hover:text-white"
                : "border-neutral-200 bg-white text-neutral-500 hover:text-neutral-900 shadow-sm"
            }`}
          >
            {isDark ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-neutral-600" />
            )}
          </button>

          <EcosystemSwitcher currentApp="atlas" isDark={isDark} />
        </div>
      </header>

      {/* ── Main Surface Content ────────────────────────────────────────────── */}
      <main className="flex-1 pb-16">
        <div className="w-full max-w-4xl mx-auto py-10 px-4 sm:px-6 space-y-8">
          {/* Header */}
          <div className="border-b border-[var(--pds-border-subtle)] pb-6 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-indigo-400 font-semibold uppercase tracking-wider mb-1">
                <Target className="w-3.5 h-3.5" />
                Surface 1 · Define the Hunt
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--pds-text-primary)]">
                Objective & Search Thesis Studio
              </h1>
              <p className="text-sm text-[var(--pds-text-muted)] mt-1">
                Transform your commercial intent into an immutable, approved search thesis.
              </p>
            </div>

            <Link
              to="/"
              className="text-xs font-mono text-[var(--pds-text-muted)] hover:text-indigo-400 flex items-center gap-1.5"
            >
              <span>Back to Morning Focus</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Step 1: Founder Commercial Intent Inputs */}
          <div className="p-6 rounded-2xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-1)] space-y-4 shadow-sm">
            <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-[var(--pds-text-muted)]">
              1. Your Commercial Intent
            </h2>

            <div>
              <label className="block text-xs font-mono text-[var(--pds-text-muted)] mb-1.5">
                Commercial Offer / Value Proposition
              </label>
              <textarea
                value={offerSummary}
                onChange={(e) => setOfferSummary(e.target.value)}
                rows={2}
                className="w-full p-3 text-xs rounded-xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-2)] text-[var(--pds-text-primary)] focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                placeholder="e.g. AI operations automation eliminating delivery bottlenecks for digital agencies"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-[var(--pds-text-muted)] mb-1.5">
                Target Market Hypothesis
              </label>
              <input
                type="text"
                value={targetHypothesis}
                onChange={(e) => setTargetHypothesis(e.target.value)}
                className="w-full p-3 text-xs rounded-xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-2)] text-[var(--pds-text-primary)] focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="e.g. 5–30 person digital/web agencies in the US and UK"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handlePropose}
                disabled={isProposing}
                className="px-5 py-2.5 rounded-xl text-xs font-mono font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isProposing ? "Synthesizing Thesis..." : "Propose Search Thesis"}
              </button>
            </div>
          </div>

          {/* Step 2: Proposed Search Thesis & Founder Approval */}
          {proposedIcp && (
            <div className="p-6 rounded-2xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-1)] space-y-6 shadow-sm animate-in fade-in duration-300">
              <div className="flex items-center justify-between border-b border-[var(--pds-border-subtle)] pb-4">
                <div>
                  <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-[var(--pds-text-muted)]">
                    2. AI Search Thesis Proposal
                  </h2>
                  <p className="text-xs text-[var(--pds-text-muted)] mt-0.5">
                    AI proposes a search thesis. Founder defines and approves the market.
                  </p>
                </div>

                {isApproved ? (
                  <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Version {proposedIcp.version} (Approved & Locked)
                  </span>
                ) : (
                  <span className="text-xs font-mono px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                    Draft (Pending Approval)
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-[var(--pds-surface-2)] border border-[var(--pds-border-subtle)] space-y-2">
                  <span className="text-[10px] font-mono uppercase text-[var(--pds-text-muted)]">
                    Buyer Persona
                  </span>
                  <div className="font-semibold text-sm text-[var(--pds-text-primary)]">
                    {proposedIcp.buyer_persona.role}
                  </div>
                  <div className="text-[11px] text-[var(--pds-text-muted)]">
                    Seniority: {proposedIcp.buyer_persona.seniority}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[var(--pds-surface-2)] border border-[var(--pds-border-subtle)] space-y-2">
                  <span className="text-[10px] font-mono uppercase text-[var(--pds-text-muted)]">
                    Target Constraints
                  </span>
                  <div className="font-semibold text-sm text-[var(--pds-text-primary)]">
                    {proposedIcp.employee_range_min}–{proposedIcp.employee_range_max} Employees
                  </div>
                  <div className="text-[11px] text-[var(--pds-text-muted)]">
                    Geography: {proposedIcp.target_geography.join(", ")}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[var(--pds-surface-2)] border border-[var(--pds-border-subtle)] space-y-2 md:col-span-2">
                  <span className="text-[10px] font-mono uppercase text-[var(--pds-text-muted)]">
                    Observable Pain Signals
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {proposedIcp.pain_signals.map((p, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[11px] font-mono"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[var(--pds-surface-2)] border border-[var(--pds-border-subtle)] space-y-2 md:col-span-2">
                  <span className="text-[10px] font-mono uppercase text-[var(--pds-text-muted)]">
                    Target Industry Keywords
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {proposedIcp.industry_keywords.map((kw, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-[var(--pds-surface-3)] text-[var(--pds-text-primary)] border border-[var(--pds-border-mid)] text-[11px] font-mono"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Row */}
              <div className="pt-4 border-t border-[var(--pds-border-subtle)] flex flex-wrap items-center justify-between gap-4">
                <span className="text-xs text-[var(--pds-text-muted)] font-mono">
                  {isApproved
                    ? "Search thesis locked. Ready for acquisition run."
                    : "Verify criteria above before freezing Version 1."}
                </span>

                <div className="flex items-center gap-3">
                  {!isApproved && (
                    <button
                      onClick={handleApprove}
                      disabled={isApproving}
                      className="px-5 py-2.5 rounded-xl text-xs font-mono font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-600/20"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {isApproving ? "Locking..." : "Approve & Lock Search Thesis"}
                    </button>
                  )}

                  {isApproved && (
                    <button
                      onClick={handleRun}
                      disabled={isRunning}
                      className="px-5 py-2.5 rounded-xl text-xs font-mono font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      {isRunning ? "Running Ingestion..." : "Run Acquisition Against Agency Feed"}
                    </button>
                  )}
                </div>
              </div>

              {/* Real-time Ingestion Progress */}
              {runProgress && (
                <div className="p-4 rounded-xl bg-[var(--pds-surface-2)] border border-indigo-500/30 text-xs font-mono space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-indigo-400 font-semibold">
                    <span>Controlled Feed Acquisition Run Status: {runProgress.status.toUpperCase()}</span>
                    <span>
                      Discovered: {runProgress.itemsDiscovered} | Qualified: {runProgress.itemsQualified}
                    </span>
                  </div>
                  <div className="space-y-1 text-[11px] text-[var(--pds-text-secondary)] max-h-36 overflow-y-auto">
                    {runProgress.logs.map((log, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-indigo-400">›</span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>

                  {runProgress.status === "completed" && (
                    <div className="pt-3 border-t border-[var(--pds-border-subtle)] flex items-center justify-between">
                      <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                        <Check className="w-4 h-4" /> Run finished successfully.
                      </span>
                      <button
                        onClick={() => navigate("/")}
                        className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-semibold flex items-center gap-1.5"
                      >
                        <span>View in Morning Focus</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
