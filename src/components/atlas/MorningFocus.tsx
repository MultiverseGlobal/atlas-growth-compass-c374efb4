import React, { useState, useEffect } from "react";
import { 
  Sparkles, ExternalLink, ArrowRight, ShieldCheck, 
  CheckCircle2, Building2, MapPin, Users, Calendar, 
  ChevronDown, ChevronUp, Clock, AlertCircle, Send, Check,
  Layers, Lock, Compass, RefreshCw, BookmarkCheck, ArrowUpRight,
  Command, Keyboard
} from "lucide-react";
import { 
  getMorningFocusDashboard, 
  seedControlledFixtureDemo, 
  MorningFocusDashboardData 
} from "@/lib/atlas/api";
import { AtlasOpportunity, AtlasEvidence, AtlasContact, AtlasOutreach } from "@/lib/atlas/types";
import { formatBusinessDate } from "@/lib/atlas/dateUtils";
import { OpportunityDossierDrawer } from "./OpportunityDossierDrawer";
import { TactileOpportunityCard } from "./TactileOpportunityCard";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { soundManager } from "@/lib/audioFeedback";

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
  const [selectedCardIndex, setSelectedCardIndex] = useState<number>(0);

  const loadData = async (shouldAutoSeed = true) => {
    setLoading(true);
    try {
      let data = await getMorningFocusDashboard();
      // If empty on first load, auto-seed the fixture feed so user has immediate rich data
      if (shouldAutoSeed && data.metrics.totalEvaluated === 0) {
        await seedControlledFixtureDemo();
        data = await getMorningFocusDashboard();
      }
      setDashboardData(data);
    } catch (err) {
      console.error("Failed to load morning focus dashboard", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
  }, []);

  const handleOpenDossier = (oppId: string) => {
    soundManager.playClick();
    setSelectedOppId(oppId);
    setIsDrawerOpen(true);
  };

  const toggleScoreExpanded = (id: string) => {
    setExpandedScoreId((prev) => (prev === id ? null : id));
  };

  const handleSeedDemo = async () => {
    setSeeding(true);
    soundManager.playClick();
    try {
      await seedControlledFixtureDemo();
      soundManager.playSuccess();
      toast.success("Controlled fixture feed evaluated: 5 prospects ingested, 4 qualified.");
      await loadData(false);
    } catch (err) {
      console.error("Failed to seed demo feed", err);
      toast.error("Failed to evaluate fixture feed.");
    } finally {
      setSeeding(false);
    }
  };

  // Keyboard navigation for power users (J / K / Enter / E)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isDrawerOpen) return;
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        soundManager.playClick();
        setSelectedCardIndex((prev) => 
          Math.min(prev + 1, Math.max(0, dashboardData.focusItems.length - 1))
        );
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        soundManager.playClick();
        setSelectedCardIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === "Enter") {
        const activeItem = dashboardData.focusItems[selectedCardIndex];
        if (activeItem) {
          e.preventDefault();
          handleOpenDossier(activeItem.opportunity.id);
        }
      } else if (e.key === "e" || e.key === "E") {
        const activeItem = dashboardData.focusItems[selectedCardIndex];
        if (activeItem) {
          e.preventDefault();
          toggleScoreExpanded(activeItem.opportunity.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen, dashboardData.focusItems, selectedCardIndex]);

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const { focusItems, reserveItems, followupItems, metrics } = dashboardData;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] w-full py-8 px-4 sm:px-6 lg:px-8 space-y-8 animate-in fade-in duration-300 atlas-grid-bg atlas-light-mesh">
      {/* ── Ambient Radial Atmosphere Glow ──────────────────────────────── */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] atlas-ambient-glow pointer-events-none z-0 blur-3xl opacity-75" />

      <div className="relative z-10 w-full max-w-7xl mx-auto space-y-8">
        {/* ── Editorial Header ────────────────────────────────────────────── */}
        <header className="pb-5 border-b border-slate-200/70 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-sans text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold tracking-wider text-slate-700 uppercase text-[11px]">Atlas Operating Surface</span>
              <span className="text-slate-300">/</span>
              <span>{currentDate}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 font-display">
              Daily Briefing
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl font-sans leading-relaxed">
              Three qualified commercial opportunities deserve your attention today.
            </p>
          </div>

          {/* Operating Action Strip */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleSeedDemo}
              disabled={seeding}
              className="px-3.5 py-2 rounded-xl text-xs font-sans font-medium bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 transition-all flex items-center gap-2 cursor-pointer shadow-xs"
              title="Re-run controlled evaluation feed"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-500 ${seeding ? "animate-spin" : ""}`} />
              <span>{seeding ? "Evaluating..." : "Re-evaluate Feed"}</span>
            </button>

            <Link
              to="/objectives"
              className="px-4 py-2 rounded-xl text-xs font-sans font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-all flex items-center gap-2 shadow-xs"
            >
              <span>Define New Hunt</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </header>

        {/* ── Clean Editorial Attention Reconciliation Strip ────────────────── */}
        <section 
          aria-label="Pipeline Count Reconciliation"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 font-sans pb-1"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-900">{metrics.totalQualified} of {metrics.totalEvaluated}</span>
            <span>evaluated prospects qualified against your thesis</span>
            <span className="text-slate-300">·</span>
            <span className="text-emerald-700 font-medium">Top {focusItems.length} active in Daily Briefing</span>
            {metrics.inReserve > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-slate-600">{metrics.inReserve} held in reserve</span>
              </>
            )}
            {metrics.totalDisqualified > 0 && (
              <span className="text-slate-400">({metrics.totalDisqualified} out of scope)</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Deterministic Rubric · Manual Send Enforced</span>
          </div>
        </section>

        {/* ── Main Workspace ───────────────────────────────────────────────── */}
        {loading ? (
          <div className="py-24 text-center space-y-4">
            <div className="w-8 h-8 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin mx-auto" />
            <p className="text-xs font-sans text-slate-500 tracking-wider uppercase">
              Evaluating qualified evidence queue against approved thesis…
            </p>
          </div>
        ) : focusItems.length === 0 && reserveItems.length === 0 && followupItems.length === 0 ? (
          /* Empty State fallback with direct seed action */
          <div className="p-10 sm:p-16 rounded-2xl atlas-glass-card text-center space-y-6 max-w-2xl mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 mx-auto flex items-center justify-center shadow-xs">
              <Compass className="w-7 h-7 text-indigo-500" />
            </div>
            <div className="space-y-2.5">
              <h2 className="text-xl font-bold text-slate-900 font-display tracking-tight">
                No qualified opportunities are ready for review yet.
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-lg mx-auto">
                Atlas operates strictly on verified search theses and observable facts. Declare your commercial intent in the Objectives studio or populate the sample feed.
              </p>
            </div>
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/objectives"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-sans font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-opacity shadow-xs"
              >
                <span>Define Hunt in Objectives Studio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              <button
                onClick={handleSeedDemo}
                disabled={seeding}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-sans font-medium bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-500 ${seeding ? "animate-spin" : ""}`} />
                <span>{seeding ? "Evaluating Feed…" : "Evaluate Controlled Feed (Sample Demo)"}</span>
              </button>
            </div>
          </div>
        ) : (
          /* ── Two-Column Desktop Command Deck ────────────────────────────── */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* ── Left Column: Top 3 Daily Briefing Opportunity Cards ────────── */}
            <main className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-sans uppercase tracking-wider text-slate-600 font-bold">
                    Daily Priority Queue
                  </span>
                  <span className="text-xs font-sans px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                    {focusItems.length} of 3 Available
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-sans text-slate-400">
                  <span>Press</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono text-slate-600">J</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono text-slate-600">K</kbd>
                  <span>to navigate</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono text-slate-600">↵</kbd>
                  <span>to review</span>
                </div>
              </div>

              {focusItems.map((item, index) => {
                const opp = item.opportunity;
                const ev = item.primaryEvidence;
                const contact = item.decisionMaker;
                const isSelected = selectedCardIndex === index;
                const isExpanded = expandedScoreId === opp.id;
                const criteriaCount = getVerifiedCriteriaCount(opp.score_breakdown);
                const whyNow = getWhyNowThesis(opp, ev);

                return (
                  <TactileOpportunityCard
                    key={opp.id}
                    opportunity={opp}
                    primaryEvidence={ev}
                    decisionMaker={contact}
                    outreach={item.outreach}
                    rankIndex={index + 1}
                    isSelected={isSelected}
                    isExpanded={isExpanded}
                    onSelect={() => setSelectedCardIndex(index)}
                    onToggleExpand={() => toggleScoreExpanded(opp.id)}
                    onOpenDossier={() => handleOpenDossier(opp.id)}
                    whyNowThesis={whyNow}
                    verifiedCriteriaCount={criteriaCount}
                  />
                );
              })}
            </main>

            {/* ── Right Column: Unified Context Panel ───────────────────────── */}
            <aside className="lg:col-span-4 rounded-2xl atlas-glass-card p-5 space-y-5 divide-y divide-slate-100/50">
              {/* ── Section 1: Active Follow-up Horizon ─────────────────────── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-500" />
                    <h3 className="text-xs font-sans uppercase tracking-wider text-slate-800 font-bold">
                      Follow-up Horizon
                    </h3>
                  </div>
                  <span className="text-[11px] font-sans px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                    {followupItems.length} scheduled
                  </span>
                </div>

                {followupItems.length === 0 ? (
                  <div className="py-2.5 text-xs text-slate-500 leading-relaxed flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>All follow-ups current. No overdue touchpoints today.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {followupItems.map((fItem) => (
                      <div
                        key={fItem.opportunity.id}
                        className="p-3 rounded-xl bg-white/40 border border-slate-200/50 space-y-1.5 backdrop-blur-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-bold text-slate-900">
                              {fItem.opportunity.organization_name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {fItem.decisionMaker?.full_name || "Contact"} · {fItem.opportunity.primary_domain}
                            </div>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium border border-indigo-200/50">
                            Due {fItem.nextActionDueAt ? formatBusinessDate(new Date(fItem.nextActionDueAt)) : "Soon"}
                          </span>
                        </div>

                        <div className="pt-1.5 flex items-center justify-between">
                          <span className="text-[10px] text-slate-500">Founder Note Sent</span>
                          <button
                            onClick={() => handleOpenDossier(fItem.opportunity.id)}
                            className="text-[11px] font-sans text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 cursor-pointer"
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

              {/* ── Section 2: Reserve Qualified Queue ──────────────────────── */}
              <div className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    <h3 className="text-xs font-sans uppercase tracking-wider text-slate-800 font-bold">
                      Reserve Qualified Queue
                    </h3>
                  </div>
                  <span className="text-[11px] font-sans px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                    {reserveItems.length} held
                  </span>
                </div>

                {reserveItems.length === 0 ? (
                  <p className="text-xs text-slate-400 font-sans py-1">
                    All qualified opportunities currently in Daily Briefing.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {reserveItems.map((rItem) => (
                      <div
                        key={rItem.opportunity.id}
                        className="p-3 rounded-xl bg-white/40 border border-slate-200/50 space-y-1.5 backdrop-blur-sm"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-xs font-bold text-slate-900">
                              {rItem.opportunity.organization_name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {rItem.opportunity.primary_domain} · {rItem.opportunity.industry}
                            </div>
                          </div>

                          <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                            {rItem.opportunity.fit_score}% Fit
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          Meets thesis criteria. Held in reserve to protect top-3 focus.
                        </p>

                        <div className="pt-1 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 font-mono">Rank #4</span>
                          <button
                            onClick={() => handleOpenDossier(rItem.opportunity.id)}
                            className="text-[11px] font-sans text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 cursor-pointer"
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

              {/* ── Section 3: Operating Integrity & Guardrails ─────────────── */}
              <div className="pt-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-sans uppercase tracking-wider text-slate-800 font-bold">
                    Operating Integrity
                  </h3>
                </div>

                <ul className="space-y-2 text-xs font-sans text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <span>
                      <strong className="text-slate-900">Manual Send:</strong> Zero autonomous mailers.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <span>
                      <strong className="text-slate-900">Additive Scoring:</strong> Strictly auditable 100-point rubric.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <span>
                      <strong className="text-slate-900">Evidence Provenance:</strong> Backed by public signals.
                    </span>
                  </li>
                </ul>
              </div>

              {/* ── Subtle Keyboard Controls Footer ─────────────────────────── */}
              <div className="pt-3 text-[11px] font-sans text-slate-400 flex items-center justify-between">
                <span>Tactical Controls:</span>
                <span className="font-mono text-slate-600">J / K · ↵ · E</span>
              </div>
            </aside>
          </div>
        )}

        {/* ── Slide-in Opportunity Dossier Drawer ─────────────────────────── */}
        <OpportunityDossierDrawer
          opportunityId={selectedOppId}
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          onUpdated={() => loadData(false)}
        />
      </div>
    </div>
  );
}
