import React, { useState, useEffect } from "react";
import { 
  Sparkles, ExternalLink, ArrowRight, ShieldCheck, 
  CheckCircle, Building2, MapPin, Users, Calendar, AlertCircle
} from "lucide-react";
import { getMorningFocus } from "@/lib/atlas/api";
import { AtlasOpportunity, AtlasEvidence, AtlasContact, AtlasOutreach } from "@/lib/atlas/types";
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

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--pds-border-subtle)] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-indigo-400 font-semibold uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            Atlas Operating Surface · {currentDate}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--pds-text-primary)]">
            Morning Focus
          </h1>
          <p className="text-sm text-[var(--pds-text-muted)] mt-1">
            Which three opportunities deserve your attention today, and what should you do next?
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/objectives"
            className="px-4 py-2 rounded-xl text-xs font-mono bg-[var(--pds-surface-2)] hover:bg-[var(--pds-surface-3)] text-[var(--pds-text-primary)] border border-[var(--pds-border-mid)] transition-colors flex items-center gap-1.5"
          >
            <span>Define New Hunt</span>
            <ArrowRight className="w-3.5 h-3.5 text-[var(--pds-text-muted)]" />
          </Link>
        </div>
      </div>

      {/* Main Focus List */}
      {loading ? (
        <div className="p-12 text-center text-sm font-mono text-[var(--pds-text-muted)]">
          Scanning qualified pipeline for daily focus...
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 rounded-2xl border border-dashed border-[var(--pds-border-mid)] bg-[var(--pds-surface-1)] text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mx-auto flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--pds-text-primary)]">
              No qualified opportunities waiting today
            </h3>
            <p className="text-xs text-[var(--pds-text-muted)] max-w-md mx-auto mt-1">
              Start by defining your commercial intent and approving an ICP search thesis in the Objectives studio.
            </p>
          </div>
          <Link
            to="/objectives"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-mono font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-lg shadow-indigo-600/20"
          >
            <span>Launch Acquisition in Objectives Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item, index) => {
            const opp = item.opportunity;
            const score = opp.fit_score;
            const b = opp.score_breakdown;
            const ev = item.primaryEvidence;
            const contact = item.decisionMaker;
            const sent = item.outreach?.status === "manually_sent";

            return (
              <div
                key={opp.id}
                className="p-6 rounded-2xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-1)] hover:border-indigo-500/40 transition-all shadow-sm group"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  {/* Left Column: Entity & Breakdown */}
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--pds-surface-3)] text-[var(--pds-text-muted)] font-semibold">
                        #{index + 1}
                      </span>
                      <h2 className="text-lg font-bold text-[var(--pds-text-primary)] tracking-tight">
                        {opp.organization_name}
                      </h2>
                      <a
                        href={`https://${opp.primary_domain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[var(--pds-text-muted)] hover:text-indigo-400 flex items-center gap-1 font-mono"
                      >
                        {opp.primary_domain}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    {/* Metadata line */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--pds-text-secondary)] font-mono">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-[var(--pds-text-muted)]" />
                        {opp.industry}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-[var(--pds-text-muted)]" />
                        ~{opp.employee_count_est} people
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[var(--pds-text-muted)]" />
                        {opp.country}
                      </span>
                    </div>

                    {/* Transparent Score Breakdown Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {b.employeeFit?.points > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          +25 emp range
                        </span>
                      )}
                      {b.geoFit?.points > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          +15 {b.geoFit.observed}
                        </span>
                      )}
                      {b.industryFit?.points > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          +15 {b.industryFit.observed}
                        </span>
                      )}
                      {b.painSignal?.points > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          +20 pain signal
                        </span>
                      )}
                      {b.buyingSignal?.points > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          +15 buying signal
                        </span>
                      )}
                      {b.decisionMaker?.points > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          +10 decision maker
                        </span>
                      )}
                    </div>

                    {/* Verbatim Pain Snippet */}
                    {ev && (
                      <div className="p-3 rounded-xl bg-[var(--pds-surface-2)] border border-[var(--pds-border-subtle)] text-xs">
                        <div className="text-[10px] font-mono uppercase text-indigo-400 mb-1 flex items-center justify-between">
                          <span>Observed Operational Friction</span>
                          <a
                            href={ev.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline flex items-center gap-1 text-[var(--pds-text-muted)] hover:text-indigo-400"
                          >
                            Source Link <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                        <p className="text-xs italic text-[var(--pds-text-primary)]">
                          "{ev.raw_snippet}"
                        </p>
                      </div>
                    )}

                    {/* Decision Maker */}
                    {contact && (
                      <div className="flex items-center gap-3 text-xs text-[var(--pds-text-muted)]">
                        <span>Decision Maker:</span>
                        <span className="font-medium text-[var(--pds-text-primary)]">
                          {contact.full_name} ({contact.job_title})
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--pds-surface-3)] text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          {contact.verification_tier.replace(/_/g, " ")}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Score Badge & Actions */}
                  <div className="flex md:flex-col items-end justify-between md:justify-start gap-4 shrink-0">
                    <div className="text-right">
                      <div className="text-2xl font-black font-mono tracking-tight text-emerald-400">
                        {score}
                        <span className="text-xs font-normal text-[var(--pds-text-muted)]">/100</span>
                      </div>
                      <div className="text-[10px] font-mono text-[var(--pds-text-muted)]">
                        Fit Confidence
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenDossier(opp.id)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-mono font-semibold transition-all flex items-center gap-2 ${
                        sent
                          ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                      }`}
                    >
                      {sent ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Sent (View Dossier)</span>
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

      {/* Drawer */}
      <OpportunityDossierDrawer
        opportunityId={selectedOppId}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onUpdated={loadData}
      />
    </div>
  );
}
