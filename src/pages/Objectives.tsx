import React, { useState } from "react";
import { 
  Target, Sparkles, Check, ArrowRight, Play, 
  ShieldCheck, Building2, Users, MapPin, AlertCircle, 
  Lock, RefreshCw, Layers, CheckCircle2 
} from "lucide-react";
import { proposeIcp, approveIcp } from "@/lib/atlas/api";
import { executeAcquisitionRun, RunProgress } from "@/lib/atlas/worker";
import { AtlasIcpProfile } from "@/lib/atlas/types";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function ObjectivesPage() {
  const navigate = useNavigate();

  // Commercial Intent Inputs
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

  // Acquisition Run states
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState<RunProgress | null>(null);
  const [runComplete, setRunComplete] = useState(false);

  // 1. Propose Search Thesis
  const handlePropose = async () => {
    if (!offerSummary.trim() || !targetHypothesis.trim()) {
      toast.error("Please provide both offer summary and target hypothesis.");
      return;
    }

    setIsProposing(true);
    try {
      const res = await proposeIcp({ offerSummary, targetHypothesis });
      setProposedIcp(res.icpDraft);
      setIsApproved(false);
      setRunComplete(false);
      toast.success("Strategic search thesis synthesized. Review and approve below.");
    } catch (err) {
      toast.error("Failed to propose search thesis");
    } finally {
      setIsProposing(false);
    }
  };

  // 2. Approve & Lock Version (Frozen Artifact)
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

  // 3. Dispatch Controlled Acquisition Run
  const handleRun = async () => {
    if (!proposedIcp) return;
    setIsRunning(true);
    setRunProgress(null);
    setRunComplete(false);
    try {
      const run = await executeAcquisitionRun(proposedIcp.id, (progress) => {
        setRunProgress({ ...progress });
      });
      setRunComplete(true);
      toast.success(
        `Acquisition completed! Discovered ${run.items_discovered}, Qualified ${run.items_qualified}.`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to execute acquisition run");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 animate-in fade-in duration-300">
      {/* ── Studio Header ────────────────────────────────────────────── */}
      <div className="border-b border-[var(--pds-border-subtle)] pb-7 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.14em] text-[var(--pds-text-muted)]">
            <Target className="w-3.5 h-3.5 text-indigo-400" />
            <span>Atlas Operating Surface 01</span>
            <span className="text-[var(--pds-border-strong)]">/</span>
            <span>Define the Hunt</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--pds-text-primary)] font-display">
            Objective & Search Thesis
          </h1>
          <p className="text-sm text-[var(--pds-text-secondary)] max-w-2xl">
            Declare your commercial intent. Atlas translates it into a deterministic search thesis that you inspect, adjust, and lock.
          </p>
        </div>

        <Link
          to="/"
          className="text-xs font-mono text-[var(--pds-text-muted)] hover:text-[var(--pds-text-primary)] flex items-center gap-1.5 transition-colors"
        >
          <span>Return to Morning Focus</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* ── Step 1: Founder Commercial Intent ─────────────────────────── */}
      <div className="p-6 sm:p-7 rounded-2xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-1)] space-y-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-[var(--pds-border-subtle)] pb-4">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold">
              STAGE 01
            </span>
            <h2 className="text-base font-bold text-[var(--pds-text-primary)] font-display">
              Commercial Intent & Offer
            </h2>
          </div>
          <span className="text-[11px] font-mono text-[var(--pds-text-muted)]">
            Natural language input
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-[var(--pds-text-muted)] mb-1.5 font-semibold">
              Commercial Offer / Value Proposition
            </label>
            <textarea
              value={offerSummary}
              onChange={(e) => setOfferSummary(e.target.value)}
              rows={2}
              className="w-full p-3.5 text-xs font-sans rounded-xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-2)] text-[var(--pds-text-primary)] focus:outline-none focus:border-indigo-500 transition-colors resize-none leading-relaxed"
              placeholder="e.g. AI operations automation eliminating delivery bottlenecks for digital agencies"
            />
            <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] font-mono text-[var(--pds-text-muted)]">
              <span>Quick Presets:</span>
              <button
                type="button"
                onClick={() => setOfferSummary("AI operations automation to eliminate client delivery friction and manual weekly reporting")}
                className="px-2 py-0.5 rounded bg-[var(--pds-surface-3)] hover:text-[var(--pds-text-primary)] cursor-pointer transition-colors"
              >
                Operations Automation
              </button>
              <button
                type="button"
                onClick={() => setOfferSummary("Autonomous content pipeline & compliance review for regulated fintech & healthcare agencies")}
                className="px-2 py-0.5 rounded bg-[var(--pds-surface-3)] hover:text-[var(--pds-text-primary)] cursor-pointer transition-colors"
              >
                Regulated Content Workflow
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-[var(--pds-text-muted)] mb-1.5 font-semibold">
              Target Market Hypothesis
            </label>
            <input
              type="text"
              value={targetHypothesis}
              onChange={(e) => setTargetHypothesis(e.target.value)}
              className="w-full p-3.5 text-xs font-sans rounded-xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-2)] text-[var(--pds-text-primary)] focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="e.g. 5–30 person digital/web agencies in the US and UK"
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={handlePropose}
            disabled={isProposing}
            className="px-5 py-2.5 rounded-xl text-xs font-mono font-semibold bg-[var(--pds-text-primary)] text-[var(--pds-accent-inv)] hover:opacity-90 disabled:opacity-50 flex items-center gap-2 transition-all shadow-sm cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isProposing ? "Interpreting Objective & Synthesizing Thesis..." : "Propose Search Thesis"}</span>
          </button>
        </div>
      </div>

      {/* ── Step 2: AI Search Thesis Proposal & Founder Review (Prompt Section 9) ── */}
      {proposedIcp && (
        <div className="p-6 sm:p-7 rounded-2xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-1)] space-y-6 shadow-xs animate-in slide-up-fade duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--pds-border-subtle)] pb-4">
            <div className="space-y-0.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold">
                STAGE 02
              </span>
              <h2 className="text-base font-bold text-[var(--pds-text-primary)] font-display">
                Search Thesis & Market Definition
              </h2>
              <p className="text-xs text-[var(--pds-text-secondary)]">
                AI proposes the strategic hypothesis. Founder reviews, edits, and locks the specification.
              </p>
            </div>

            {/* Frozen Artifact Badge */}
            {isApproved ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-mono font-semibold">
                <Lock className="w-3.5 h-3.5" />
                <span>VERSION {proposedIcp.version} · APPROVED & LOCKED</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-mono font-semibold">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>DRAFT · AWAITING FOUNDER APPROVAL</span>
              </div>
            )}
          </div>

          {/* Constraint Snapshot Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            {/* Buyer Persona */}
            <div className="p-4 rounded-xl bg-[var(--pds-surface-2)]/60 border border-[var(--pds-border-subtle)] space-y-1.5">
              <span className="text-[10px] uppercase text-[var(--pds-text-muted)] font-semibold">
                Target Buyer Persona
              </span>
              <div className="font-bold text-sm text-[var(--pds-text-primary)] font-sans">
                {proposedIcp.buyer_persona.role}
              </div>
              <div className="text-[11px] text-[var(--pds-text-secondary)]">
                Seniority Level: {proposedIcp.buyer_persona.seniority}
              </div>
            </div>

            {/* Scale & Geography */}
            <div className="p-4 rounded-xl bg-[var(--pds-surface-2)]/60 border border-[var(--pds-border-subtle)] space-y-1.5">
              <span className="text-[10px] uppercase text-[var(--pds-text-muted)] font-semibold">
                Target Constraints
              </span>
              <div className="font-bold text-sm text-[var(--pds-text-primary)] font-sans">
                {proposedIcp.employee_range_min}–{proposedIcp.employee_range_max} Employees
              </div>
              <div className="text-[11px] text-[var(--pds-text-secondary)]">
                Geographies: {(proposedIcp.target_geography || []).join(", ")}
              </div>
            </div>

            {/* Observable Pain Signals */}
            <div className="p-4 rounded-xl bg-[var(--pds-surface-2)]/60 border border-[var(--pds-border-subtle)] space-y-2 md:col-span-2">
              <span className="text-[10px] uppercase text-[var(--pds-text-muted)] font-semibold">
                Observable Pain Signals (Evidence Criteria)
              </span>
              <div className="flex flex-wrap gap-2">
                {(proposedIcp.pain_signals || []).map((p, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg bg-[var(--pds-surface-1)] border border-[var(--pds-border-subtle)] text-[var(--pds-text-primary)] text-xs font-mono font-medium"
                  >
                    • {p}
                  </span>
                ))}
              </div>
            </div>

            {/* Disqualification Criteria */}
            <div className="p-4 rounded-xl bg-[var(--pds-surface-2)]/60 border border-[var(--pds-border-subtle)] space-y-2 md:col-span-2">
              <span className="text-[10px] uppercase text-[var(--pds-text-muted)] font-semibold">
                Disqualification Filters (Hard Exclusions)
              </span>
              <div className="flex flex-wrap gap-2">
                {(proposedIcp.disqualification_criteria || []).map((d, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono font-medium"
                  >
                    ✕ {d}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Action: Approve & Lock */}
          {!isApproved && (
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-[var(--pds-border-subtle)]">
              <p className="text-xs text-[var(--pds-text-muted)] font-mono">
                Locking this thesis freezes it as an authoritative specification for the acquisition worker.
              </p>

              <button
                onClick={handleApprove}
                disabled={isApproving}
                className="px-5 py-2.5 rounded-xl text-xs font-mono font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white flex items-center gap-2 transition-all shadow-md cursor-pointer shrink-0"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isApproving ? "Locking Thesis..." : "Approve & Lock Search Thesis (Version 1)"}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Dispatch Controlled Acquisition Run ──────────────── */}
      {isApproved && proposedIcp && (
        <div className="p-6 sm:p-7 rounded-2xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-1)] space-y-6 shadow-xs animate-in slide-up-fade duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--pds-border-subtle)] pb-4">
            <div className="space-y-0.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold">
                STAGE 03
              </span>
              <h2 className="text-base font-bold text-[var(--pds-text-primary)] font-display">
                Execute Controlled Acquisition Run
              </h2>
              <p className="text-xs text-[var(--pds-text-secondary)]">
                Acquisition runs strictly over verified target feeds. No uncurated scrapers or fake profiles.
              </p>
            </div>

            <button
              onClick={handleRun}
              disabled={isRunning}
              className="px-5 py-2.5 rounded-xl text-xs font-mono font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white flex items-center gap-2 transition-all shadow-md cursor-pointer shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isRunning ? "Running Acquisition..." : "Run Acquisition Feed"}</span>
            </button>
          </div>

          {/* Operational Progress Stream (Prompt Section 21) */}
          {isRunning && runProgress && (
            <div className="p-4 rounded-xl bg-[var(--pds-surface-2)] border border-[var(--pds-border-subtle)] space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--pds-text-primary)] font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  {runProgress.message || "Processing feed..."}
                </span>
                <span className="text-[var(--pds-text-muted)]">
                  {runProgress.current || 0} / {runProgress.total || 1} Targets Evaluated
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 rounded-full bg-[var(--pds-surface-3)] overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.round(((runProgress.current || 0) / (runProgress.total || 1)) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Run Completion Banner */}
          {runComplete && (
            <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Controlled Acquisition Complete</span>
                </div>
                <p className="text-xs text-[var(--pds-text-secondary)] font-mono">
                  All 5 agency targets processed. 4 qualified opportunities evaluated with 100-point deterministic scores.
                </p>
              </div>

              <button
                onClick={() => navigate("/")}
                className="px-5 py-2.5 rounded-xl text-xs font-mono font-semibold bg-[var(--pds-text-primary)] text-[var(--pds-accent-inv)] hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm cursor-pointer shrink-0"
              >
                <span>View Morning Focus</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
