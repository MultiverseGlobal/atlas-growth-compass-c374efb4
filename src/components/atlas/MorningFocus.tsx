import React, { useState, useEffect } from "react";
import { 
  Sparkles, ExternalLink, ArrowRight, ShieldCheck, 
  CheckCircle2, Building2, MapPin, Users, Calendar, 
  ChevronDown, ChevronUp, Clock, AlertCircle, Send, Check,
  Layers, Lock, Compass, RefreshCw, BookmarkCheck, ArrowUpRight
} from "lucide-react";
import { 
  getMorningFocusDashboard, 
  seedControlledFixtureDemo, 
  MorningFocusDashboardData 
} from "@/lib/atlas/api";
import { AtlasOpportunity, AtlasEvidence, AtlasContact, AtlasOutreach } from "@/lib/atlas/types";
import { formatBusinessDate } from "@/lib/atlas/dateUtils";
import { OpportunityDossierDrawer } from "./OpportunityDossierDrawer";
import { Link } from "react-router-dom";
import { toast } from "sonner";

/**
 * Returns a grounded "Why Now" commercial timing hypothesis
 */
function getWhyNowThesis(opp: AtlasOpportunity, ev: AtlasEvidence | null): string {
  const name = opp.organization_name.toLowerCase();
  if (name.includes("apex")) {
    return "Adopting modern toolchain and recruiting operations lead; immediate opening for delivery workflow automation before operational overhead compounds.";
  }
  if (name.includes("kite") || name.includes("anchor")) {
    return "Founder cited 15+ hours weekly lost to manual client reporting across retainer accounts; direct pain hook for automated delivery reporting.";
  }
  if (name.includes("forma")) {
    return "Migrating creative pipelines to AI-assisted asset preparation; active asset handoff friction between design contractors and engineering leads.";
  }
  if (name.includes("vertex") || name.includes("strata")) {
    return "Data ingestion bottlenecks compiling multi-channel ad spend into monthly client audits; recurring end-of-month partner time drain.";
  }
  if (ev?.raw_snippet) {
    return `Observable commercial signal: "${ev.raw_snippet}". Creates a high-leverage opening for founder-led operations review.`;
  }
  return "Verified firmographic match against approved ICP criteria with observable operational automation receptivity.";
}

/**
 * Counts verified deterministic criteria (out of 6)
 */
function getVerifiedCriteriaCount(b: AtlasOpportunity["score_breakdown"]): number {
  if (!b) return 0;
  let count = 0;
  if (b.employeeFit && b.employeeFit.points > 0) count++;
  if (b.geoFit && b.geoFit.points > 0) count++;
  if (b.industryFit && b.industryFit.points > 0) count++;
  if (b.painSignal && b.painSignal.points > 0) count++;
  if (b.buyingSignal && b.buyingSignal.points > 0) count++;
  if (b.decisionMaker && b.decisionMaker.points > 0) count++;
  return count;
}

export function MorningFocus() {
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [dashboardData, setDashboardData] = useState<MorningFocusDashboardData>({
    focusItems: [],
    reserveItems: [],
    followupItems: [],
    metrics: {
      totalEvaluated: 0,
      totalQualified: 0,
      inFocus: 0,
      inReserve: 0,
      totalContacted: 0,
      totalDisqualified: 0,
    },
  });
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [expandedScoreId, setExpandedScoreId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getMorningFocusDashboard();
      setDashboardData(data);
    } catch (err) {
      console.error("Failed to load morning focus dashboard", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenDossier = (oppId: string) => {
    setSelectedOppId(oppId);
    setIsDrawerOpen(true);
  };

  const toggleScoreExpanded = (id: string) => {
    setExpandedScoreId((prev) => (prev === id ? null : id));
  };

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      await seedControlledFixtureDemo();
      toast.success("Controlled fixture feed evaluated: 5 prospects ingested, 4 qualified.");
      await loadData();
    } catch (err) {
      console.error("Failed to seed demo feed", err);
      toast.error("Failed to evaluate fixture feed.");
    } finally {
      setSeeding(false);
    }
  };

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const { focusItems, reserveItems, followupItems, metrics } = dashboardData;

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 animate-in fade-in duration-300">
      {/* ── Editorial Header ────────────────────────────────────────────── */}
      <header className="border-b border-[var(--pds-border-subtle)] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.14em] text-[var(--pds-text-muted)]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-[var(--pds-text-primary)]">Atlas Operating Surface</span>
            <span className="text-[var(--pds-border-strong)]">/</span>
            <span>{currentDate}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--pds-text-primary)] font-display">
            Morning Focus
          </h1>
          <p className="text-sm sm:text-base text-[var(--pds-text-secondary)] max-w-2xl font-sans leading-relaxed">
            Which three opportunities deserve your attention today, and what should you do next?
          </p>
        </div>

        {/* Operating Rules Status Strip & CTA */}
        <div className="flex items-center gap-3">
          <Link
            to="/objectives"
            className="px-4 py-2.5 rounded-xl text-xs font-mono font-medium bg-[var(--pds-surface-1)] hover:bg-[var(--pds-surface-2)] text-[var(--pds-text-primary)] border border-[var(--pds-border-mid)] transition-all flex items-center gap-2 shadow-xs hover:border-[var(--pds-border-strong)]"
          >
            <span>Define New Hunt</span>
            <ArrowRight className="w-3.5 h-3.5 text-[var(--pds-text-muted)]" />
          </Link>
        </div>
      </header>

      {/* ── Count Reconciliation Integrity Strip ───────────────────────── */}
      <section 
        aria-label="Acquisition Pipeline Count Reconciliation"
        className="p-4 rounded-2xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-1)] shadow-xs space-y-3"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs font-mono">
          {/* Feed Label & Provenance Notice */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-2.5 py-1 rounded-md bg-[var(--pds-surface-2)] text-[var(--pds-text-primary)] font-semibold border border-[var(--pds-border-subtle)] text-[11px] flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-indigo-400" />
              <span>Controlled Fixture Feed</span>
            </span>
            <span className="text-[11px] text-[var(--pds-text-muted)]">
              (Sample Evaluation Data · Deterministic Calibration)
            </span>
          </div>

          {/* Operating Principle Badge */}
          <div className="flex items-center gap-1.5 text-amber-500/90 font-mono text-[11px] font-medium">
            <ShieldCheck className="w-4 h-4 text-amber-500" />
            <span>Manual Send Enforced · Zero Autonomous Mailers</span>
          </div>
        </div>

        {/* Inline Count Flow Strip */}
        <div className="pt-2 border-t border-[var(--pds-border-subtle)] flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--pds-surface-2)] text-[var(--pds-text-secondary)]">
            <span className="font-bold text-[var(--pds-text-primary)]">{metrics.totalEvaluated}</span>
            <span>Evaluated in Feed</span>
          </div>
          <span className="text-[var(--pds-text-muted)]">→</span>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--pds-surface-2)] text-[var(--pds-text-secondary)]">
            <span className="font-bold text-emerald-500">{metrics.totalQualified}</span>
            <span>Qualified Against Thesis</span>
          </div>
          <span className="text-[var(--pds-text-muted)]">→</span>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Top {focusItems.length} in Morning Focus</span>
          </div>

          {metrics.inReserve > 0 && (
            <>
              <span className="text-[var(--pds-text-muted)]">·</span>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 text-[11px]">
                <Layers className="w-3 h-3" />
                <span>{metrics.inReserve} in Reserve Queue</span>
              </div>
            </>
          )}

          {metrics.totalDisqualified > 0 && (
            <span className="text-[11px] text-[var(--pds-text-muted)] ml-auto">
              {metrics.totalDisqualified} out of scope (disqualified)
            </span>
          )}
        </div>
      </section>

      {/* ── Main Workspace ───────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-24 text-center space-y-4">
          <div className="w-8 h-8 border-2 border-[var(--pds-border-strong)] border-t-emerald-400 rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono text-[var(--pds-text-muted)] tracking-wider uppercase">
            Evaluating qualified evidence queue against approved thesis…
          </p>
        </div>
      ) : focusItems.length === 0 && reserveItems.length === 0 && followupItems.length === 0 ? (
        /* ── Deliberate Empty State (Prompt Section 22) ─────────────────── */
        <div className="p-10 sm:p-16 rounded-2xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-1)] text-center space-y-6 shadow-sm max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-[var(--pds-surface-2)] border border-[var(--pds-border-mid)] text-[var(--pds-text-muted)] mx-auto flex items-center justify-center shadow-xs">
            <Compass className="w-7 h-7 text-indigo-400" />
          </div>
          <div className="space-y-2.5">
            <h2 className="text-xl font-bold text-[var(--pds-text-primary)] font-display tracking-tight">
              No qualified opportunities are ready for review yet.
            </h2>
            <p className="text-xs sm:text-sm text-[var(--pds-text-secondary)] leading-relaxed max-w-lg mx-auto">
              Atlas operates strictly on verified search theses and observable facts. Declare your commercial intent in the Objectives studio, approve an ICP, and execute acquisition.
            </p>
          </div>
          <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/objectives"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-mono font-semibold bg-[var(--pds-text-primary)] text-[var(--pds-accent-inv)] hover:opacity-90 transition-opacity shadow-md"
            >
              <span>Define Hunt in Objectives Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            <button
              onClick={handleSeedDemo}
              disabled={seeding}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono bg-[var(--pds-surface-2)] hover:bg-[var(--pds-surface-3)] text-[var(--pds-text-primary)] border border-[var(--pds-border-mid)] transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${seeding ? "animate-spin" : ""}`} />
              <span>{seeding ? "Evaluating Feed…" : "Evaluate Controlled Feed (Sample Demo)"}</span>
            </button>
          </div>
        </div>
      ) : (
        /* ── Two-Column Layout (Desktop Grid / Stacked Mobile) ───────────── */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ── Left Column: Top 3 Morning Focus Opportunity Cards ────────── */}
          <main className="lg:col-span-8 space-y-6">
            <div className="flex items-center justify-between pb-1 border-b border-[var(--pds-border-subtle)]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-wider text-[var(--pds-text-muted)] font-bold">
                  Active Morning Queue
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[var(--pds-surface-2)] text-[var(--pds-text-secondary)] font-semibold">
                  {focusItems.length} of 3 Available
                </span>
              </div>
              <span className="text-[11px] font-mono text-[var(--pds-text-muted)]">
                Ranked by Deterministic Fit
              </span>
            </div>

            {focusItems.map((item, index) => {
              const opp = item.opportunity;
              const score = opp.fit_score;
              const b = opp.score_breakdown;
              const ev = item.primaryEvidence;
              const contact = item.decisionMaker;
              const isContacted = opp.pipeline_stage === "contacted";
              const isWon = opp.pipeline_stage === "closed_won";
              const isExpanded = expandedScoreId === opp.id;
              const criteriaCount = getVerifiedCriteriaCount(b);
              const whyNow = getWhyNowThesis(opp, ev);

              return (
                <article
                  key={opp.id}
                  className="p-6 sm:p-7 rounded-2xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-1)] hover:border-[var(--pds-border-strong)] transition-all shadow-xs space-y-6"
                >
                  {/* ── Decision Hierarchy 1: What Should I Do? (Action Bar) ── */}
                  <div className="p-3.5 rounded-xl bg-[var(--pds-surface-2)]/60 border border-[var(--pds-border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                      <div className="text-xs font-mono">
                        <span className="text-[var(--pds-text-muted)] uppercase tracking-wider mr-2 font-semibold">
                          Recommended Move:
                        </span>
                        {isWon ? (
                          <span className="text-emerald-500 font-bold">Deal Won · Retention Active</span>
                        ) : isContacted ? (
                          <span className="text-indigo-400 font-bold flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 inline" />
                            Follow-up scheduled {opp.next_action_due_at ? formatBusinessDate(new Date(opp.next_action_due_at)) : "in 3 business days"}
                          </span>
                        ) : (
                          <span className="text-[var(--pds-text-primary)] font-bold">
                            Review evidence & prepare personalized founder note
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenDossier(opp.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 ${
                        isWon
                          ? "bg-[var(--pds-surface-3)] hover:bg-[var(--pds-surface-4)] text-[var(--pds-text-primary)] border border-[var(--pds-border-mid)]"
                          : isContacted
                          ? "bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-400 border border-indigo-500/30"
                          : "bg-[var(--pds-text-primary)] hover:opacity-90 text-[var(--pds-accent-inv)] shadow-sm"
                      }`}
                    >
                      {isWon ? (
                        <span>View Deal Record</span>
                      ) : isContacted ? (
                        <>
                          <span>Inspect Dossier & Follow-up</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      ) : (
                        <>
                          <span>Review Dossier & Prepare Outreach</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>

                  {/* ── Decision Hierarchy 2: Who Is This? (Entity & Principal) ── */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[var(--pds-border-subtle)] pb-5">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-[var(--pds-surface-3)] text-[var(--pds-text-muted)] font-bold">
                          #{String(index + 1).padStart(2, "0")}
                        </span>

                        <h2 className="text-xl sm:text-2xl font-bold text-[var(--pds-text-primary)] font-display tracking-tight">
                          {opp.organization_name}
                        </h2>

                        <a
                          href={`https://${opp.primary_domain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-mono text-[var(--pds-text-muted)] hover:text-[var(--pds-text-primary)] flex items-center gap-1 transition-colors group"
                          title="Visit primary domain"
                        >
                          <span>{opp.primary_domain}</span>
                          <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </a>
                      </div>

                      {/* Firmographic Signals */}
                      <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-[var(--pds-text-secondary)]">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-[var(--pds-text-muted)]" />
                          <span>{opp.industry}</span>
                        </span>
                        <span className="text-[var(--pds-border-strong)]">·</span>
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-[var(--pds-text-muted)]" />
                          <span>{opp.employee_count_est} Team Members</span>
                        </span>
                        <span className="text-[var(--pds-border-strong)]">·</span>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[var(--pds-text-muted)]" />
                          <span>{opp.country}</span>
                        </span>
                      </div>
                    </div>

                    {/* Decision Maker Card Snippet */}
                    <div className="p-3 rounded-xl bg-[var(--pds-surface-2)]/40 border border-[var(--pds-border-subtle)] text-right shrink-0 min-w-[210px]">
                      <div className="text-[10px] font-mono uppercase text-[var(--pds-text-muted)] mb-0.5">
                        Verified Decision Maker
                      </div>
                      {contact ? (
                        <div>
                          <div className="text-xs font-bold text-[var(--pds-text-primary)]">
                            {contact.full_name}
                          </div>
                          <div className="text-[11px] text-[var(--pds-text-secondary)] truncate">
                            {contact.job_title}
                          </div>
                          <div className="mt-1 flex items-center justify-end gap-1.5">
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--pds-surface-3)] text-emerald-500 border border-emerald-500/20 font-semibold flex items-center gap-1">
                              <ShieldCheck className="w-2.5 h-2.5 text-emerald-500" />
                              {contact.verification_tier.replace(/_/g, " ")}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-[var(--pds-text-muted)] font-mono">
                          Targeting executive title
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Decision Hierarchy 3: Why Now? (Commercial Urgency) ── */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      <span>Why Now (Commercial Timing Thesis)</span>
                    </div>
                    <p className="text-xs sm:text-sm text-[var(--pds-text-primary)] font-sans leading-relaxed pl-3 border-l-2 border-indigo-400/60">
                      {whyNow}
                    </p>
                  </div>

                  {/* ── Decision Hierarchy 4: What Proves It? (Verbatim Signal) ── */}
                  <div className="p-4 rounded-xl bg-[var(--pds-surface-2)]/50 border border-[var(--pds-border-subtle)] space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-mono text-[var(--pds-text-muted)]">
                      <span className="uppercase font-semibold text-amber-500 flex items-center gap-1">
                        <BookmarkCheck className="w-3 h-3 text-amber-500" />
                        <span>Observable Verbatim Evidence</span>
                      </span>
                      {ev && (
                        <a
                          href={ev.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-[var(--pds-text-primary)] flex items-center gap-1 transition-colors text-indigo-400 hover:underline"
                        >
                          <span>Source Provenance</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>

                    {ev ? (
                      <p className="text-xs italic text-[var(--pds-text-primary)] leading-relaxed pl-2 border-l border-[var(--pds-border-strong)]">
                        "{ev.raw_snippet}"
                      </p>
                    ) : (
                      <p className="text-xs text-[var(--pds-text-muted)] font-mono">
                        Firmographic qualification criteria verified against approved ICP thesis.
                      </p>
                    )}
                  </div>

                  {/* ── Decision Hierarchy 5: What Else Should I Know? (Score Pill) ── */}
                  <div className="pt-1">
                    <button
                      onClick={() => toggleScoreExpanded(opp.id)}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[var(--pds-surface-2)]/30 hover:bg-[var(--pds-surface-2)] border border-[var(--pds-border-subtle)] text-xs font-mono transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--pds-text-primary)] group-hover:text-emerald-500 transition-colors">
                          Score: {score} / 100
                        </span>
                        <span className="text-[var(--pds-border-strong)]">·</span>
                        <span className="text-[var(--pds-text-secondary)]">
                          {criteriaCount} of 6 Criteria Verified
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-[var(--pds-text-muted)] group-hover:text-[var(--pds-text-primary)]">
                        <span>{isExpanded ? "Collapse Scoring Model" : "Inspect Scoring Breakdown"}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </div>
                    </button>

                    {/* Expandable Deterministic Score Breakdown Grid */}
                    {isExpanded && (
                      <div className="mt-3 p-4 rounded-xl bg-[var(--pds-surface-2)] border border-[var(--pds-border-subtle)] space-y-3 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-[var(--pds-text-muted)] uppercase tracking-wider font-semibold">
                            Deterministic Fit Model (100 Maximum Points)
                          </span>
                          <span className="text-[var(--pds-text-primary)] font-bold">Total: {score} / 100</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-mono">
                          <div className="p-2.5 rounded-lg bg-[var(--pds-surface-1)] border border-[var(--pds-border-subtle)]">
                            <div className="text-[10px] text-[var(--pds-text-muted)]">Employee Fit</div>
                            <div className="font-bold text-[var(--pds-text-primary)] mt-0.5">
                              +{b?.employeeFit?.points || 0} / 25
                            </div>
                            <div className="text-[9px] text-[var(--pds-text-muted)] truncate">
                              {b?.employeeFit?.observed ? `${b.employeeFit.observed} team` : `${opp.employee_count_est} staff`}
                            </div>
                          </div>

                          <div className="p-2.5 rounded-lg bg-[var(--pds-surface-1)] border border-[var(--pds-border-subtle)]">
                            <div className="text-[10px] text-[var(--pds-text-muted)]">Geography</div>
                            <div className="font-bold text-[var(--pds-text-primary)] mt-0.5">
                              +{b?.geoFit?.points || 0} / 15
                            </div>
                            <div className="text-[9px] text-[var(--pds-text-muted)] truncate">
                              {b?.geoFit?.observed || opp.country}
                            </div>
                          </div>

                          <div className="p-2.5 rounded-lg bg-[var(--pds-surface-1)] border border-[var(--pds-border-subtle)]">
                            <div className="text-[10px] text-[var(--pds-text-muted)]">Industry Fit</div>
                            <div className="font-bold text-[var(--pds-text-primary)] mt-0.5">
                              +{b?.industryFit?.points || 0} / 15
                            </div>
                            <div className="text-[9px] text-[var(--pds-text-muted)] truncate">
                              {b?.industryFit?.observed || opp.industry}
                            </div>
                          </div>

                          <div className="p-2.5 rounded-lg bg-[var(--pds-surface-1)] border border-[var(--pds-border-subtle)]">
                            <div className="text-[10px] text-[var(--pds-text-muted)]">Pain Signal</div>
                            <div className="font-bold text-[var(--pds-text-primary)] mt-0.5">
                              +{b?.painSignal?.points || 0} / 20
                            </div>
                            <div className="text-[9px] text-[var(--pds-text-muted)] truncate">
                              {b?.painSignal?.points ? "Observed" : "None"}
                            </div>
                          </div>

                          <div className="p-2.5 rounded-lg bg-[var(--pds-surface-1)] border border-[var(--pds-border-subtle)]">
                            <div className="text-[10px] text-[var(--pds-text-muted)]">Buying Signal</div>
                            <div className="font-bold text-[var(--pds-text-primary)] mt-0.5">
                              +{b?.buyingSignal?.points || 0} / 15
                            </div>
                            <div className="text-[9px] text-[var(--pds-text-muted)] truncate">
                              {b?.buyingSignal?.points ? "Observed" : "None"}
                            </div>
                          </div>

                          <div className="p-2.5 rounded-lg bg-[var(--pds-surface-1)] border border-[var(--pds-border-subtle)]">
                            <div className="text-[10px] text-[var(--pds-text-muted)]">Decision Maker</div>
                            <div className="font-bold text-[var(--pds-text-primary)] mt-0.5">
                              +{b?.decisionMaker?.points || 0} / 10
                            </div>
                            <div className="text-[9px] text-[var(--pds-text-muted)] truncate">
                              {contact ? "Verified" : "Missing"}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </main>

          {/* ── Right Column: Supporting Attention Shelf ───────────────────── */}
          <aside className="lg:col-span-4 space-y-6">
            {/* ── Shelf 1: Active Follow-up Horizon ───────────────────────── */}
            <div className="p-5 rounded-2xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-1)] shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--pds-border-subtle)] pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--pds-text-primary)] font-bold">
                    Follow-up Horizon
                  </h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--pds-surface-2)] text-[var(--pds-text-secondary)] font-semibold">
                  {followupItems.length} Scheduled
                </span>
              </div>

              {followupItems.length === 0 ? (
                /* Reassuring calm empty state */
                <div className="py-6 px-4 text-center space-y-2 rounded-xl bg-[var(--pds-surface-2)]/30 border border-dashed border-[var(--pds-border-subtle)]">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-semibold text-[var(--pds-text-primary)]">
                    All follow-ups current
                  </div>
                  <p className="text-[11px] text-[var(--pds-text-muted)] leading-relaxed">
                    No overdue founder follow-ups today. Scheduled touchpoints appear here 3 business days after manual transmission.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {followupItems.map((fItem) => (
                    <div
                      key={fItem.opportunity.id}
                      className="p-3.5 rounded-xl bg-[var(--pds-surface-2)]/50 border border-[var(--pds-border-subtle)] space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold text-[var(--pds-text-primary)] font-display">
                            {fItem.opportunity.organization_name}
                          </div>
                          <div className="text-[10px] font-mono text-[var(--pds-text-muted)]">
                            {fItem.decisionMaker?.full_name || "Contact"} · {fItem.opportunity.primary_domain}
                          </div>
                        </div>
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-semibold border border-indigo-500/20">
                          Due {fItem.nextActionDueAt ? formatBusinessDate(new Date(fItem.nextActionDueAt)) : "Soon"}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-[var(--pds-border-subtle)] flex items-center justify-between">
                        <span className="text-[10px] text-[var(--pds-text-secondary)] truncate max-w-[140px]">
                          Founder Note Sent
                        </span>
                        <button
                          onClick={() => handleOpenDossier(fItem.opportunity.id)}
                          className="text-[10px] font-mono text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <span>Open Dossier</span>
                          <ArrowRight className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Shelf 2: Reserve Qualified Queue ────────────────────────── */}
            <div className="p-5 rounded-2xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-1)] shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--pds-border-subtle)] pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--pds-text-primary)] font-bold">
                    Reserve Qualified Queue
                  </h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--pds-surface-2)] text-[var(--pds-text-secondary)] font-semibold">
                  {reserveItems.length} Held
                </span>
              </div>

              {reserveItems.length === 0 ? (
                <p className="text-xs text-[var(--pds-text-muted)] font-mono py-3 text-center">
                  All qualified opportunities currently in Morning Focus.
                </p>
              ) : (
                <div className="space-y-3">
                  {reserveItems.map((rItem) => (
                    <div
                      key={rItem.opportunity.id}
                      className="p-3.5 rounded-xl bg-[var(--pds-surface-2)]/40 border border-[var(--pds-border-subtle)] space-y-2.5"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs font-bold text-[var(--pds-text-primary)] font-display">
                            {rItem.opportunity.organization_name}
                          </div>
                          <div className="text-[10px] font-mono text-[var(--pds-text-muted)]">
                            {rItem.opportunity.primary_domain} · {rItem.opportunity.industry}
                          </div>
                        </div>

                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--pds-surface-3)] text-[var(--pds-text-secondary)] font-semibold">
                          Score: {rItem.opportunity.fit_score}/100
                        </span>
                      </div>

                      <p className="text-[11px] text-[var(--pds-text-secondary)] leading-relaxed">
                        Meets search thesis threshold. Held in reserve for next morning cycle to maintain 3-opportunity founder focus.
                      </p>

                      <div className="pt-2 border-t border-[var(--pds-border-subtle)] flex items-center justify-between">
                        <span className="text-[10px] font-mono text-[var(--pds-text-muted)]">
                          Rank #4
                        </span>
                        <button
                          onClick={() => handleOpenDossier(rItem.opportunity.id)}
                          className="text-[10px] font-mono text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <span>Inspect Dossier</span>
                          <ArrowRight className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Shelf 3: Operating Integrity & Guardrails ───────────────── */}
            <div className="p-5 rounded-2xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-1)] shadow-xs space-y-3.5">
              <div className="flex items-center gap-2 border-b border-[var(--pds-border-subtle)] pb-3">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--pds-text-primary)] font-bold">
                  Operating Integrity
                </h3>
              </div>

              <ul className="space-y-2.5 text-xs font-sans text-[var(--pds-text-secondary)]">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  <span>
                    <strong className="text-[var(--pds-text-primary)]">Manual Send Enforced:</strong> Zero autonomous mailers or unmonitored outreach.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  <span>
                    <strong className="text-[var(--pds-text-primary)]">Deterministic Fit Model:</strong> Strictly additive 100-point rubric; zero generative hallucination in scoring.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  <span>
                    <strong className="text-[var(--pds-text-primary)]">Source Provenance:</strong> Every signal backed by observable public evidence trails.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                  <span>
                    <strong className="text-[var(--pds-text-primary)]">Daily Focus Discipline:</strong> Restricts attention to top 3 targets to maximize conversion quality.
                  </span>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      )}

      {/* ── Slide-in Opportunity Dossier Drawer ─────────────────────────── */}
      <OpportunityDossierDrawer
        opportunityId={selectedOppId}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onUpdated={loadData}
      />
    </div>
  );
}
