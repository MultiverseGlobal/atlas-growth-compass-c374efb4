import React, { useState, useEffect } from "react";
import { 
  Sparkles, ExternalLink, ArrowRight, ShieldCheck, 
  CheckCircle2, Building2, MapPin, Users, Calendar, 
  ChevronDown, ChevronUp, Clock, AlertCircle, Send, Check
} from "lucide-react";
import { getMorningFocus } from "@/lib/atlas/api";
import { AtlasOpportunity, AtlasEvidence, AtlasContact, AtlasOutreach } from "@/lib/atlas/types";
import { formatBusinessDate } from "@/lib/atlas/dateUtils";
import { OpportunityDossierDrawer } from "./OpportunityDossierDrawer";
import { Link } from "react-router-dom";

export function MorningFocus() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<
    Array<{
      opportunity: AtlasOpportunity;
      primaryEvidence: AtlasEvidence | null;
      decisionMaker: AtlasContact | null;
      outreach: AtlasOutreach | null;
    }>
  >([]);
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [expandedScoreId, setExpandedScoreId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getMorningFocus();
      setItems(data);
    } catch (err) {
      console.error("Failed to load morning focus", err);
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

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 animate-in fade-in duration-300">
      {/* ── Editorial Header ────────────────────────────────────────────── */}
      <div className="border-b border-[var(--pds-border-subtle)] pb-7 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.14em] text-[var(--pds-text-muted)]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Atlas Operating Surface</span>
            <span className="text-[var(--pds-border-strong)]">/</span>
            <span>{currentDate}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--pds-text-primary)] font-display">
            Morning Focus
          </h1>
          <p className="text-sm text-[var(--pds-text-secondary)] max-w-2xl">
            Which three opportunities deserve your attention today, and what should you do next?
          </p>
        </div>

        {/* Operating Rules Status Strip */}
        <div className="flex items-center gap-3">
          <Link
            to="/objectives"
            className="px-4 py-2 rounded-xl text-xs font-mono bg-[var(--pds-surface-1)] hover:bg-[var(--pds-surface-2)] text-[var(--pds-text-primary)] border border-[var(--pds-border-mid)] transition-all flex items-center gap-2 shadow-xs hover:border-[var(--pds-border-strong)]"
          >
            <span>Define New Hunt</span>
            <ArrowRight className="w-3.5 h-3.5 text-[var(--pds-text-muted)]" />
          </Link>
        </div>
      </div>

      {/* ── System Status Ticker ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-2.5 rounded-xl border border-[var(--pds-border-subtle)] bg-[var(--pds-surface-1)]/60 text-[11px] font-mono text-[var(--pds-text-muted)]">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[var(--pds-text-primary)] font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            {items.length} Primary Opportunities
          </span>
          <span className="hidden sm:inline text-[var(--pds-border-strong)]">|</span>
          <span className="hidden sm:inline">Controlled Target Feed Active</span>
          <span className="hidden sm:inline text-[var(--pds-border-strong)]">|</span>
          <span className="hidden sm:inline">100-Point Deterministic Scoring</span>
        </div>
        <div className="flex items-center gap-1.5 text-amber-400/90 font-mono text-[10px]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Manual Send Required (No Autonomous Mailers)</span>
        </div>
      </div>

      {/* ── Focus Queue ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-24 text-center space-y-3">
          <div className="w-6 h-6 border-2 border-[var(--pds-border-strong)] border-t-emerald-400 rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono text-[var(--pds-text-muted)] tracking-wider uppercase">
            Evaluating qualified evidence queue…
          </p>
        </div>
      ) : items.length === 0 ? (
        /* ── Deliberate Empty State (Prompt Section 22) ─────────────────── */
        <div className="p-12 sm:p-16 rounded-2xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-1)] text-center space-y-5 shadow-sm max-w-2xl mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-[var(--pds-surface-2)] border border-[var(--pds-border-mid)] text-[var(--pds-text-muted)] mx-auto flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-[var(--pds-text-primary)] font-display tracking-tight">
              No qualified opportunities are ready for review yet.
            </h3>
            <p className="text-xs text-[var(--pds-text-secondary)] leading-relaxed max-w-md mx-auto">
              Atlas operates only on verified search theses and observable facts. Declare your commercial intent in the Objectives studio, approve an ICP, and run acquisition.
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/objectives"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-mono font-semibold bg-[var(--pds-text-primary)] text-[var(--pds-accent-inv)] hover:opacity-90 transition-opacity shadow-md"
            >
              <span>Define Hunt in Objectives Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        /* ── Editorial Opportunity Cards (Prompt Section 11 & 12) ────────── */
        <div className="space-y-6">
          {items.map((item, index) => {
            const opp = item.opportunity;
            const score = opp.fit_score;
            const b = opp.score_breakdown;
            const ev = item.primaryEvidence;
            const contact = item.decisionMaker;
            const isContacted = opp.pipeline_stage === "contacted";
            const isWon = opp.pipeline_stage === "closed_won";
            const isExpanded = expandedScoreId === opp.id;

            return (
              <div
                key={opp.id}
                className="p-6 sm:p-7 rounded-2xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-1)] hover:border-[var(--pds-border-strong)] transition-all shadow-xs space-y-5"
              >
                {/* ── Row 1: Header (Rank, Organization, Fit Score) ────────── */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[var(--pds-border-subtle)] pb-5">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-[var(--pds-surface-3)] text-[var(--pds-text-muted)] font-bold">
                        #{String(index + 1).padStart(2, "0")}
                      </span>

                      <h2 className="text-xl font-bold text-[var(--pds-text-primary)] font-display tracking-tight">
                        {opp.organization_name}
                      </h2>

                      <a
                        href={`https://${opp.primary_domain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-mono text-[var(--pds-text-muted)] hover:text-[var(--pds-text-primary)] flex items-center gap-1 transition-colors"
                        title="Visit verified website"
                      >
                        <span>{opp.primary_domain}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>

                      {/* Stage Pill */}
                      {isWon ? (
                        <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Deal Won · ${opp.deal_value_usd?.toLocaleString() || "3,500"}
                        </span>
                      ) : isContacted ? (
                        <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Contacted · Follow-up Active
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[var(--pds-surface-3)] text-[var(--pds-text-secondary)] border border-[var(--pds-border-subtle)] font-semibold">
                          Qualified & Pending Outreach
                        </span>
                      )}
                    </div>

                    {/* Firmographic Signals */}
                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-[var(--pds-text-secondary)]">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[var(--pds-text-muted)]" />
                        <span>{opp.industry}</span>
                      </span>
                      <span className="text-[var(--pds-border-strong)]">·</span>
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[var(--pds-text-muted)]" />
                        <span>{opp.employee_count_est} Employees</span>
                      </span>
                      <span className="text-[var(--pds-border-strong)]">·</span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[var(--pds-text-muted)]" />
                        <span>{opp.country}</span>
                      </span>
                    </div>
                  </div>

                  {/* Right: Deterministic Fit Score Block */}
                  <div className="sm:text-right shrink-0">
                    <button
                      onClick={() => toggleScoreExpanded(opp.id)}
                      className="inline-flex flex-col sm:items-end group cursor-pointer"
                      title="Click to inspect deterministic score calculation"
                    >
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-black font-display tracking-tight text-[var(--pds-text-primary)] group-hover:text-emerald-400 transition-colors">
                          {score}
                        </span>
                        <span className="text-xs font-mono text-[var(--pds-text-muted)]">/ 100</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-mono text-[var(--pds-text-muted)] group-hover:text-[var(--pds-text-secondary)] transition-colors">
                        <span>Deterministic Fit</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </div>
                    </button>
                  </div>
                </div>

                {/* ── Expandable Deterministic Score Breakdown (Section 12) ── */}
                {isExpanded && (
                  <div className="p-4 rounded-xl bg-[var(--pds-surface-2)] border border-[var(--pds-border-subtle)] space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-[var(--pds-text-muted)] uppercase tracking-wider font-semibold">
                        Score Transparency Breakdown (Deterministic 100-Point Model)
                      </span>
                      <span className="text-[var(--pds-text-secondary)]">Total: {score}/100</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-mono">
                      <div className="p-2.5 rounded-lg bg-[var(--pds-surface-1)] border border-[var(--pds-border-subtle)]">
                        <div className="text-[10px] text-[var(--pds-text-muted)]">Employee Fit</div>
                        <div className="font-bold text-[var(--pds-text-primary)] mt-0.5">
                          +{b.employeeFit?.points || 0} / 25
                        </div>
                        <div className="text-[9px] text-[var(--pds-text-muted)] truncate">
                          {b.employeeFit?.observed || `${opp.employee_count_est} staff`}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[var(--pds-surface-1)] border border-[var(--pds-border-subtle)]">
                        <div className="text-[10px] text-[var(--pds-text-muted)]">Geography</div>
                        <div className="font-bold text-[var(--pds-text-primary)] mt-0.5">
                          +{b.geoFit?.points || 0} / 15
                        </div>
                        <div className="text-[9px] text-[var(--pds-text-muted)] truncate">
                          {b.geoFit?.observed || opp.country}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[var(--pds-surface-1)] border border-[var(--pds-border-subtle)]">
                        <div className="text-[10px] text-[var(--pds-text-muted)]">Industry</div>
                        <div className="font-bold text-[var(--pds-text-primary)] mt-0.5">
                          +{b.industryFit?.points || 0} / 15
                        </div>
                        <div className="text-[9px] text-[var(--pds-text-muted)] truncate">
                          {b.industryFit?.observed || opp.industry}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[var(--pds-surface-1)] border border-[var(--pds-border-subtle)]">
                        <div className="text-[10px] text-[var(--pds-text-muted)]">Pain Signal</div>
                        <div className="font-bold text-[var(--pds-text-primary)] mt-0.5">
                          +{b.painSignal?.points || 0} / 20
                        </div>
                        <div className="text-[9px] text-[var(--pds-text-muted)] truncate">
                          {b.painSignal?.points ? "Observed" : "None"}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[var(--pds-surface-1)] border border-[var(--pds-border-subtle)]">
                        <div className="text-[10px] text-[var(--pds-text-muted)]">Buying Signal</div>
                        <div className="font-bold text-[var(--pds-text-primary)] mt-0.5">
                          +{b.buyingSignal?.points || 0} / 15
                        </div>
                        <div className="text-[9px] text-[var(--pds-text-muted)] truncate">
                          {b.buyingSignal?.points ? "Observed" : "None"}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[var(--pds-surface-1)] border border-[var(--pds-border-subtle)]">
                        <div className="text-[10px] text-[var(--pds-text-muted)]">Decision Maker</div>
                        <div className="font-bold text-[var(--pds-text-primary)] mt-0.5">
                          +{b.decisionMaker?.points || 0} / 10
                        </div>
                        <div className="text-[9px] text-[var(--pds-text-muted)] truncate">
                          {contact ? "Verified" : "Missing"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Row 2: Observed Evidence Signal & Provenance ─────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Left 2 Cols: Observable Verbatim Signal */}
                  <div className="lg:col-span-2 p-4 rounded-xl bg-[var(--pds-surface-2)]/60 border border-[var(--pds-border-subtle)] space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-mono text-[var(--pds-text-muted)]">
                      <span className="uppercase font-semibold text-indigo-400">
                        Observed Qualification Signal
                      </span>
                      {ev && (
                        <a
                          href={ev.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-[var(--pds-text-primary)] flex items-center gap-1 transition-colors"
                        >
                          <span>Source Provenance</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>

                    {ev ? (
                      <p className="text-xs italic text-[var(--pds-text-primary)] leading-relaxed">
                        "{ev.raw_snippet}"
                      </p>
                    ) : (
                      <p className="text-xs text-[var(--pds-text-muted)]">
                        Firmographic qualification match verified against approved ICP criteria.
                      </p>
                    )}
                  </div>

                  {/* Right Col: Verified Contact Provenance */}
                  <div className="p-4 rounded-xl bg-[var(--pds-surface-2)]/60 border border-[var(--pds-border-subtle)] space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] font-mono uppercase text-[var(--pds-text-muted)] mb-1">
                        Decision Maker
                      </div>
                      {contact ? (
                        <div>
                          <div className="text-xs font-semibold text-[var(--pds-text-primary)]">
                            {contact.full_name}
                          </div>
                          <div className="text-[11px] text-[var(--pds-text-secondary)]">
                            {contact.job_title}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-[var(--pds-text-muted)]">
                          No verified contact discovered
                        </div>
                      )}
                    </div>

                    {contact && (
                      <div className="pt-2 border-t border-[var(--pds-border-subtle)] flex items-center justify-between">
                        <span className="text-[10px] font-mono text-[var(--pds-text-muted)] truncate max-w-[140px]">
                          {contact.email || "No email"}
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--pds-surface-3)] text-emerald-400 border border-emerald-500/20 flex items-center gap-1 font-semibold">
                          <ShieldCheck className="w-2.5 h-2.5" />
                          {contact.verification_tier.replace(/_/g, " ")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Row 3: Action Bar & Follow-up State ──────────────────── */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-[var(--pds-border-subtle)]">
                  <div className="text-xs font-mono text-[var(--pds-text-secondary)] flex items-center gap-2">
                    <span className="text-[var(--pds-text-muted)]">Next Action:</span>
                    {isWon ? (
                      <span className="text-emerald-400 font-semibold">Deal Won · Retention Active</span>
                    ) : isContacted ? (
                      <span className="text-indigo-400 font-semibold flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Follow-up scheduled {opp.next_action_due_at ? formatBusinessDate(new Date(opp.next_action_due_at)) : "in 3 business days"}
                      </span>
                    ) : (
                      <span className="text-[var(--pds-text-primary)] font-semibold">
                        Review evidence dossier & execute manual outreach
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenDossier(opp.id)}
                      className={`px-5 py-2.5 rounded-xl text-xs font-mono font-semibold transition-all flex items-center gap-2 cursor-pointer ${
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
                          <span>Review & Outreach</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
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
