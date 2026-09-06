import React, { useState, useEffect } from "react";
import { 
  X, ExternalLink, Copy, Check, Mail, Calendar, 
  DollarSign, CheckCircle2, ShieldCheck, AlertCircle, 
  Send, Clock, Sparkles, User, FileText, Lock
} from "lucide-react";
import { 
  AtlasOpportunity, 
  AtlasEvidence, 
  AtlasContact, 
  AtlasOutreach, 
  AtlasFollowup 
} from "@/lib/atlas/types";
import { 
  getOpportunityDossier, 
  generateOutreachDraft, 
  confirmManualSend, 
  recordDealOutcome 
} from "@/lib/atlas/api";
import { formatBusinessDate } from "@/lib/atlas/dateUtils";
import { toast } from "sonner";

interface OpportunityDossierDrawerProps {
  opportunityId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export function OpportunityDossierDrawer({
  opportunityId,
  isOpen,
  onClose,
  onUpdated,
}: OpportunityDossierDrawerProps) {
  const [loading, setLoading] = useState(true);
  const [opportunity, setOpportunity] = useState<AtlasOpportunity | null>(null);
  const [evidence, setEvidence] = useState<AtlasEvidence[]>([]);
  const [contacts, setContacts] = useState<AtlasContact[]>([]);
  const [outreach, setOutreach] = useState<AtlasOutreach | null>(null);
  const [followups, setFollowups] = useState<AtlasFollowup[]>([]);

  // Draft copy state
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  // Deal outcome modal state
  const [showDealModal, setShowDealModal] = useState(false);
  const [dealValue, setDealValue] = useState("3500");
  const [dealNotes, setDealNotes] = useState("");

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !showDealModal) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, showDealModal, onClose]);

  useEffect(() => {
    if (!opportunityId || !isOpen) return;

    let mounted = true;
    setLoading(true);

    async function loadData() {
      if (!opportunityId) return;
      try {
        const dossier = await getOpportunityDossier(opportunityId);
        if (!dossier) return;

        // If no outreach draft exists yet, synthesize grounded draft
        let currentOutreach = dossier.outreach;
        if (!currentOutreach) {
          currentOutreach = await generateOutreachDraft({
            opportunityId,
            contactId: dossier.contacts[0]?.id,
          });
        }

        if (mounted) {
          setOpportunity(dossier.opportunity);
          setEvidence(dossier.evidence);
          setContacts(dossier.contacts);
          setOutreach(currentOutreach);
          setFollowups(dossier.followups);
          setSubject(currentOutreach.draft_subject);
          setBody(currentOutreach.draft_body);
        }
      } catch (err) {
        console.error("Failed to load dossier", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [opportunityId, isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    const fullText = `Subject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    toast.success("Grounded pitch copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmSend = async () => {
    if (!opportunityId || !outreach) return;
    setSending(true);
    try {
      const res = await confirmManualSend(outreach.id, opportunityId);
      setOutreach(res.outreach);
      setOpportunity((prev) =>
        prev
          ? {
              ...prev,
              pipeline_stage: "contacted",
              next_action_due_at: res.nextActionDueAt,
            }
          : null
      );
      toast.success(
        `Manual send logged. Follow-up scheduled for ${formatBusinessDate(
          new Date(res.nextActionDueAt)
        )}.`
      );
      onUpdated();
    } catch (err) {
      toast.error("Failed to confirm send");
    } finally {
      setSending(false);
    }
  };

  const handleRecordDeal = async (stage: "closed_won" | "closed_lost") => {
    if (!opportunityId) return;
    try {
      const val = parseFloat(dealValue) || 0;
      await recordDealOutcome(opportunityId, {
        stage,
        dealValueUsd: stage === "closed_won" ? val : undefined,
        dealNotes,
      });
      setShowDealModal(false);
      toast.success(
        stage === "closed_won"
          ? `Deal won recorded ($${val.toLocaleString()})!`
          : "Opportunity marked as closed lost."
      );
      onUpdated();
      onClose();
    } catch (err) {
      toast.error("Failed to update deal");
    }
  };

  const contact = contacts[0] || null;
  const isContacted = opportunity?.pipeline_stage === "contacted" || outreach?.status === "manually_sent";
  const isWon = opportunity?.pipeline_stage === "closed_won";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-5xl bg-[var(--pds-canvas)] border-l border-[var(--pds-border-mid)] shadow-2xl h-full flex flex-col overflow-hidden animate-in slide-in-from-right duration-300"
        style={{ color: "var(--pds-text-primary)" }}
      >
        {/* ── Dossier Header (Surface 03) ──────────────────────────────── */}
        <div className="px-6 sm:px-8 py-5 border-b border-[var(--pds-border-subtle)] flex items-center justify-between bg-[var(--pds-surface-1)]">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-[var(--pds-surface-2)] border border-[var(--pds-border-mid)] flex items-center justify-center text-[var(--pds-text-primary)] font-bold text-sm font-mono shadow-xs">
              {opportunity?.organization_name.substring(0, 2).toUpperCase() || "OP"}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold tracking-tight text-[var(--pds-text-primary)] font-display">
                  {opportunity?.organization_name || "Loading Opportunity..."}
                </h2>
                <a
                  href={`https://${opportunity?.primary_domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-mono text-[var(--pds-text-muted)] hover:text-[var(--pds-text-primary)] flex items-center gap-1 transition-colors"
                >
                  <span>{opportunity?.primary_domain}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-xs text-[var(--pds-text-secondary)] font-mono mt-0.5">
                {opportunity?.industry} · ~{opportunity?.employee_count_est} employees · {opportunity?.country}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">
              Fit Score: {opportunity?.fit_score}/100
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--pds-text-muted)] hover:text-[var(--pds-text-primary)] hover:bg-[var(--pds-surface-2)] transition-colors cursor-pointer"
              title="Close dossier (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Two-Column Workspace ─────────────────────────────────────── */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-3">
            <div className="w-6 h-6 border-2 border-[var(--pds-border-strong)] border-t-emerald-400 rounded-full animate-spin" />
            <span className="text-xs font-mono text-[var(--pds-text-muted)] uppercase tracking-wider">
              Compressing evidence dossier & contact provenance…
            </span>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[var(--pds-border-subtle)] overflow-hidden">
            {/* ── Left Column: Evidence & Provenance (Prompt Section 14 & 15) ── */}
            <div className="flex flex-col h-full overflow-y-auto p-6 sm:p-7 space-y-6 bg-[var(--pds-surface-1)]">
              {/* Provenance Header */}
              <div className="flex items-center justify-between border-b border-[var(--pds-border-subtle)] pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--pds-text-muted)] font-bold">
                    Immutable Evidence Trail
                  </h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  Append-Only
                </span>
              </div>

              {/* Verified Decision Maker Card (Prompt Section 15) */}
              {contact ? (
                <div className="p-4 rounded-xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-2)]/60 space-y-3 shadow-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[9px] font-mono uppercase text-[var(--pds-text-muted)] tracking-wider">
                        Verified Contact Provenance
                      </span>
                      <div className="font-bold text-sm text-[var(--pds-text-primary)] font-display mt-0.5">
                        {contact.full_name}
                      </div>
                      <div className="text-xs text-[var(--pds-text-secondary)] font-mono">
                        {contact.job_title}
                      </div>
                      <div className="text-xs font-mono text-indigo-400 mt-1 select-all">
                        {contact.email || "No direct email"}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-mono px-2 py-1 rounded bg-[var(--pds-surface-3)] border border-emerald-500/25 text-emerald-400 font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        {contact.verification_tier.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>

                  <div className="text-[10px] text-[var(--pds-text-muted)] font-mono pt-2 border-t border-[var(--pds-border-subtle)] flex items-center justify-between">
                    <span>Source: Verified Target Feed</span>
                    <a
                      href={contact.provenance_source}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:underline flex items-center gap-1 truncate max-w-[200px]"
                    >
                      <span>Public Source URL</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-[var(--pds-border-subtle)] text-xs text-[var(--pds-text-muted)] font-mono">
                  No verified contact discovered for this target yet.
                </div>
              )}

              {/* Observed Facts vs Atlas Interpretation (Prompt Section 14) */}
              <div className="space-y-4">
                <div className="text-[11px] font-mono text-[var(--pds-text-muted)] uppercase tracking-wider font-semibold">
                  Observed Facts vs. Strategic Inference
                </div>

                {evidence.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-4 rounded-xl border border-[var(--pds-border-subtle)] bg-[var(--pds-surface-2)]/40 space-y-3 text-xs"
                  >
                    {/* Observed Fact Block */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-[var(--pds-text-muted)]">
                        <span className="uppercase font-bold text-amber-400">
                          OBSERVED FACT ({ev.signal_type.replace(/_/g, " ")})
                        </span>
                        <span>{new Date(ev.observed_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs italic text-[var(--pds-text-primary)] leading-relaxed bg-[var(--pds-surface-1)] p-3 rounded-lg border border-[var(--pds-border-subtle)]">
                        "{ev.raw_snippet}"
                      </p>
                      <div className="text-[10px] font-mono text-[var(--pds-text-muted)] flex items-center justify-between pt-1">
                        <span>Source: {new URL(ev.source_url).hostname}</span>
                        <a
                          href={ev.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-400 hover:underline flex items-center gap-1"
                        >
                          <span>Inspect Original Context</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </div>

                    {/* Atlas Interpretation Block */}
                    <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 font-sans space-y-0.5">
                      <div className="text-[9px] font-mono uppercase text-indigo-400 font-bold">
                        ATLAS INTERPRETATION
                      </div>
                      <p className="leading-relaxed">
                        Signals direct delivery friction and active hiring to relieve client onboarding bottlenecks. Target qualifies with high operational automation receptivity.
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Commercial Deal Recording (Prompt Section 19) */}
              <div className="pt-5 border-t border-[var(--pds-border-subtle)] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono text-[var(--pds-text-muted)] uppercase">Commercial Status</span>
                    <div className="text-sm font-bold text-[var(--pds-text-primary)]">
                      {isWon ? `Closed Won ($${opportunity?.deal_value_usd?.toLocaleString() || "3,500"})` : "Pipeline Active"}
                    </div>
                  </div>

                  <button
                    onClick={() => setShowDealModal(true)}
                    className="text-xs font-mono px-3.5 py-2 rounded-xl bg-[var(--pds-surface-2)] hover:bg-[var(--pds-surface-3)] text-[var(--pds-text-primary)] border border-[var(--pds-border-mid)] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Record Deal Outcome</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ── Right Column: Outreach & Send Studio (Prompt Section 16 & 17) ── */}
            <div className="flex flex-col h-full overflow-y-auto p-6 sm:p-7 space-y-5 bg-[var(--pds-surface-2)]/30">
              <div className="flex items-center justify-between border-b border-[var(--pds-border-subtle)] pb-3">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--pds-text-muted)] font-bold flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Outreach Preparation Studio</span>
                  </h3>
                  <p className="text-[11px] text-[var(--pds-text-secondary)]">
                    Grounded in observed evidence. Founder sends manually.
                  </p>
                </div>

                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                  Manual Send Boundary
                </span>
              </div>

              {/* 4-Step Manual Send Sequence Guide */}
              <div className="grid grid-cols-4 gap-1 p-2 rounded-xl bg-[var(--pds-surface-1)] border border-[var(--pds-border-subtle)] text-[10px] font-mono text-center">
                <div className="p-1 rounded bg-[var(--pds-surface-3)] text-[var(--pds-text-primary)] font-bold">1. Review</div>
                <div className="p-1 rounded text-[var(--pds-text-muted)]">2. Edit</div>
                <div className="p-1 rounded text-[var(--pds-text-muted)]">3. Copy/Mail</div>
                <div className="p-1 rounded text-[var(--pds-text-muted)]">4. Confirm</div>
              </div>

              {/* Follow-up Status Strip (Prompt Section 18) */}
              {isContacted && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs font-mono space-y-1">
                  <div className="flex items-center justify-between font-bold text-emerald-400">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Manual Send Confirmed
                    </span>
                    <span>Status: Pending Reply</span>
                  </div>
                  <div className="text-[11px] text-emerald-300">
                    Follow-up due: {opportunity?.next_action_due_at ? formatBusinessDate(new Date(opportunity.next_action_due_at)) : "in 3 business days"}
                  </div>
                  <div className="text-[10px] text-[var(--pds-text-muted)]">
                    Reason: No response to initial outreach (+3 business day rule)
                  </div>
                </div>
              )}

              {/* Subject Line Editor */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono text-[var(--pds-text-muted)] font-semibold">
                  <span>Subject Line</span>
                  <span className="text-[10px] text-[var(--pds-text-secondary)]">{subject.length} chars</span>
                </div>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-1)] text-[var(--pds-text-primary)] focus:outline-none focus:border-indigo-500 transition-colors font-sans"
                />
              </div>

              {/* Pitch Body Editor */}
              <div className="flex-1 flex flex-col space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono text-[var(--pds-text-muted)] font-semibold">
                  <span>Pitch Body (Grounded in Verified Evidence)</span>
                  <span className="text-[10px] text-[var(--pds-text-secondary)]">{body.split(/\s+/).filter(Boolean).length} words</span>
                </div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={11}
                  className="flex-1 w-full text-xs leading-relaxed px-4 py-3 rounded-xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-1)] text-[var(--pds-text-primary)] focus:outline-none focus:border-indigo-500 font-sans transition-colors resize-none shadow-inner"
                />
              </div>

              {/* Action Buttons (Prompt Section 16 & 17) */}
              <div className="pt-3 border-t border-[var(--pds-border-subtle)] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="px-4 py-2 rounded-xl text-xs font-mono bg-[var(--pds-surface-1)] hover:bg-[var(--pds-surface-3)] border border-[var(--pds-border-mid)] text-[var(--pds-text-primary)] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied to Clipboard!" : "Copy Subject & Body"}</span>
                  </button>

                  {contact?.email && (
                    <a
                      href={`mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
                      className="px-4 py-2 rounded-xl text-xs font-mono bg-[var(--pds-surface-1)] hover:bg-[var(--pds-surface-3)] border border-[var(--pds-border-mid)] text-[var(--pds-text-primary)] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Mail className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Open Mail Client</span>
                    </a>
                  )}
                </div>

                <button
                  onClick={handleConfirmSend}
                  disabled={sending || isContacted}
                  className="px-5 py-2 rounded-xl text-xs font-mono font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white flex items-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isContacted ? "Sent Logged (+3d Scheduled)" : "Confirm I Sent This Message"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Deal Outcome Modal (Prompt Section 19) ──────────────────── */}
        {showDealModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-[var(--pds-surface-1)] border border-[var(--pds-border-mid)] rounded-2xl p-6 shadow-2xl space-y-5">
              <div>
                <h3 className="text-base font-bold text-[var(--pds-text-primary)] font-display">
                  Record Commercial Deal Outcome
                </h3>
                <p className="text-xs text-[var(--pds-text-secondary)] mt-1">
                  For {opportunity?.organization_name}. Records manual revenue confirmation for the proof goal.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-[var(--pds-text-muted)] mb-1 font-semibold">
                    Contract Value ($ USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-[var(--pds-text-muted)] font-mono">$</span>
                    <input
                      type="number"
                      value={dealValue}
                      onChange={(e) => setDealValue(e.target.value)}
                      className="w-full pl-7 pr-3.5 py-2.5 text-xs font-mono rounded-xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-2)] text-[var(--pds-text-primary)] focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-[var(--pds-text-muted)] mb-1 font-semibold">
                    Scope Notes
                  </label>
                  <textarea
                    value={dealNotes}
                    onChange={(e) => setDealNotes(e.target.value)}
                    placeholder="e.g. 3-month automation retainer covering onboarding and weekly reporting"
                    rows={3}
                    className="w-full p-3 text-xs rounded-xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-2)] text-[var(--pds-text-primary)] focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => setShowDealModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-mono text-[var(--pds-text-muted)] hover:bg-[var(--pds-surface-2)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRecordDeal("closed_lost")}
                  className="px-3.5 py-2 rounded-xl text-xs font-mono bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 cursor-pointer"
                >
                  Mark Lost
                </button>
                <button
                  onClick={() => handleRecordDeal("closed_won")}
                  className="px-4 py-2 rounded-xl text-xs font-mono font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md cursor-pointer"
                >
                  Confirm Deal Won
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
