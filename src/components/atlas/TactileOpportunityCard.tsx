import React from "react";
import { 
  Building2, MapPin, Users, ExternalLink, ArrowRight, 
  ShieldCheck, CheckCircle2, ChevronDown, ChevronUp, Sparkles, 
  Linkedin, Mail, Clock, Check
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AtlasOpportunity, AtlasEvidence, AtlasContact, AtlasOutreach } from "@/lib/atlas/types";
import { soundManager } from "@/lib/audioFeedback";

interface TactileOpportunityCardProps {
  opportunity: AtlasOpportunity;
  primaryEvidence: AtlasEvidence | null;
  decisionMaker: AtlasContact | null;
  outreach?: AtlasOutreach | null;
  rankIndex: number;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  onOpenDossier: () => void;
  whyNowThesis: string;
  verifiedCriteriaCount: number;
}

export function TactileOpportunityCard({
  opportunity: opp,
  primaryEvidence: ev,
  decisionMaker: contact,
  outreach,
  rankIndex,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
  onOpenDossier,
  whyNowThesis,
  verifiedCriteriaCount,
}: TactileOpportunityCardProps) {
  const score = opp.fit_score;
  const b = opp.score_breakdown;
  const isWon = opp.pipeline_stage === "closed_won";
  const isContacted = opp.pipeline_stage === "contacted";

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundManager.playClick();
    onOpenDossier();
  };

  const handleExpandToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundManager.playClick();
    onToggleExpand();
  };

  return (
    <article
      onClick={() => {
        soundManager.playClick();
        onSelect();
      }}
      className={`group relative rounded-2xl p-6 transition-all duration-300 select-none cursor-pointer ${
        isSelected 
          ? "atlas-glass-card ring-1 ring-emerald-500/30 shadow-[0_0_20px_-2px_rgba(16,185,129,0.15)]" 
          : "atlas-glass-card opacity-95 hover:opacity-100"
      }`}
    >
      {/* Top Specular Rim */}
      <div className="absolute inset-x-5 top-0 h-[1px] bg-gradient-to-r from-transparent via-slate-200 to-transparent pointer-events-none" />

      <div className="space-y-4">
        {/* ── Hierarchy Step 1: RANK / STATUS / FIT SCORE ── */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            {/* Rank index */}
            <span className="font-mono text-xs font-semibold text-slate-400 group-hover:text-slate-700 transition-colors">
              0{rankIndex}
            </span>

            <span className="text-slate-200">/</span>

            {/* Subtle editorial status */}
            <div className="flex items-center gap-1.5 text-xs font-medium">
              {isWon ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-emerald-700">Closed won</span>
                </>
              ) : isContacted ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span className="text-indigo-700">Follow-up queued</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-amber-800 font-semibold">Ready for review</span>
                </>
              )}
            </div>

            <span className="text-slate-200">·</span>

            {/* Quiet source context */}
            <span className="text-[11px] text-slate-400 font-sans">
              {opp.source_connector || "Target Feed"}
            </span>
          </div>

          {/* Quiet inline fit indicator */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono font-bold text-emerald-700 bg-emerald-50/80 px-2.5 py-0.5 rounded-md border border-emerald-200/60">
              {score}/100
            </span>
            <span className="text-[11px] text-slate-400 font-sans hidden sm:inline">
              ({verifiedCriteriaCount}/6 criteria verified)
            </span>
          </div>
        </div>

        {/* ── Hierarchy Step 2: WHO IS THIS? (Company & Key Principal Unified) ── */}
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-display tracking-tight text-slate-900 group-hover:text-slate-950 transition-colors">
                {opp.organization_name}
              </h2>
              {opp.primary_domain && (
                <a
                  href={`https://${opp.primary_domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-slate-400 hover:text-slate-700 transition-colors p-0.5"
                  title={`Visit ${opp.primary_domain}`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-sans">
              {opp.industry && <span>{opp.industry}</span>}
              {opp.country && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>{opp.country}</span>
                </>
              )}
              {opp.employee_count_est && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>{opp.employee_count_est} team</span>
                </>
              )}
            </div>
          </div>

          {/* Integrated Target Principal */}
          {contact && (
            <div className="flex items-center gap-2 sm:text-right shrink-0 pt-1 sm:pt-0">
              <div className="text-xs">
                <span className="font-semibold text-slate-800">{contact.full_name}</span>
                <span className="text-slate-400 font-normal"> · {contact.job_title}</span>
              </div>
              {contact.linkedin_url && (
                <a
                  href={contact.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-indigo-500 hover:text-indigo-700"
                  title="View LinkedIn profile"
                >
                  <Linkedin className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* ── Hierarchy Step 3: WHY THIS MATTERS NOW (Commercial Timing) ── */}
        <div className="pt-1 text-[13px] font-sans leading-relaxed text-slate-700">
          <span className="font-semibold text-slate-900">Why now: </span>
          <span>{whyNowThesis}</span>
        </div>

        {/* ── Hierarchy Step 4: WHAT PROVES IT? (Observable Signal Snippet) ── */}
        {ev && (
          <div className="pt-2.5 pb-0.5 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-t border-slate-100 text-xs">
            <div className="flex items-baseline gap-1.5 flex-1 min-w-0">
              <span className="text-indigo-400 font-serif text-sm leading-none shrink-0">“</span>
              <span className="italic text-slate-600 font-sans leading-relaxed truncate-3-lines">
                {ev.raw_snippet}
              </span>
              <span className="text-indigo-400 font-serif text-sm leading-none shrink-0">”</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400 shrink-0 self-end sm:self-auto">
              Source: {ev.source_url ? new URL(ev.source_url).hostname : "public web"}
            </span>
          </div>
        )}

        {/* ── Hierarchy Step 5: ACTION BAR ── */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
          <button
            type="button"
            onClick={handleExpandToggle}
            className="text-xs font-sans font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <span>{isExpanded ? "Hide 6-point breakdown" : "Inspect deterministic rubric"}</span>
            <kbd className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-white border border-slate-200 text-slate-400">
              E
            </kbd>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
          </button>

          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
            <span className="hidden md:inline text-[11px] text-slate-400 font-sans">
              Founder review required
            </span>

            <button
              type="button"
              onClick={handleActionClick}
              className="px-4 py-2 rounded-xl text-xs font-sans font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-xs bg-slate-900 hover:bg-slate-800 text-white shrink-0"
            >
              <span>Review Dossier & Note</span>
              <kbd className="px-1 py-0.2 rounded text-[10px] font-mono bg-white/20 text-white">
                ↵
              </kbd>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* ── Expandable Deterministic Scoring Model ── */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="overflow-hidden pt-1 space-y-2.5"
            >
              <div className="p-3.5 rounded-xl bg-white/40 backdrop-blur-md border border-slate-200/50 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-sans">
                  <span className="font-semibold text-slate-800">
                    Auditable 100-Point Deterministic Model
                  </span>
                  <span className="text-emerald-700 text-[11px] font-medium">
                    Zero generative hallucination
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-sans">
                  <CriteriaBadge label="Employee Fit" points={b?.employeeFit?.points ?? 0} max={15} observed={b?.employeeFit?.observed ? `${b.employeeFit.observed} team` : undefined} />
                  <CriteriaBadge label="Geography" points={b?.geoFit?.points ?? 0} max={15} observed={b?.geoFit?.observed || opp.country || undefined} />
                  <CriteriaBadge label="Industry Fit" points={b?.industryFit?.points ?? 0} max={20} observed={b?.industryFit?.observed || opp.industry} />
                  <CriteriaBadge label="Operational Pain" points={b?.painSignal?.points ?? 0} max={25} observed={b?.painSignal?.points ? "Observed" : undefined} />
                  <CriteriaBadge label="Commercial Buying" points={b?.buyingSignal?.points ?? 0} max={15} observed={b?.buyingSignal?.points ? "Observed" : undefined} />
                  <CriteriaBadge label="Decision Maker" points={b?.decisionMaker?.points ?? 0} max={10} observed={contact ? "Verified" : undefined} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </article>
  );
}

function CriteriaBadge({
  label,
  points,
  max,
  observed,
}: {
  label: string;
  points: number;
  max: number;
  observed?: string;
}) {
  const isPassing = points > 0;
  return (
    <div
      className={`p-2.5 rounded-lg border transition-all backdrop-blur-sm ${
        isPassing
          ? "bg-emerald-50/40 border-emerald-200/50 text-[var(--pds-text-primary)]"
          : "bg-white/40 border-slate-200/50 text-[var(--pds-text-muted)]"
      }`}
    >
      <div className="flex items-center justify-between text-[10px] text-[var(--pds-text-muted)] mb-1">
        <span>{label}</span>
        <span className={isPassing ? "text-emerald-700 font-bold" : ""}>
          {points}/{max}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold">
        {isPassing ? (
          <>
            <Check className="w-3 h-3 text-emerald-600 shrink-0" />
            <span className="text-emerald-700 truncate">{observed || "Verified"}</span>
          </>
        ) : (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--pds-text-muted)] shrink-0" />
            <span>Unmatched</span>
          </>
        )}
      </div>
    </div>
  );
}
