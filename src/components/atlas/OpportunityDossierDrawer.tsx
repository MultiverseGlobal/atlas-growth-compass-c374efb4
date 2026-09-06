import React, { useState, useEffect } from "react";
import { 
  X, ExternalLink, Copy, Check, Mail, Calendar, 
  DollarSign, CheckCircle2, ShieldCheck, AlertCircle, Send
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

  useEffect(() => {
    if (!opportunityId || !isOpen) return;

    let mounted = true;
    setLoading(true);

    async function loadData() {
      if (!opportunityId) return;
      try {
        let dossier = await getOpportunityDossier(opportunityId);
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
    toast.success("Outreach pitch copied to clipboard!");
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

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl bg-[var(--pds-surface-1)] border-l border-[var(--pds-border-mid)] shadow-2xl h-full flex flex-col overflow-hidden animate-in slide-in-from-right duration-300"
        style={{ color: "var(--pds-text-primary)" }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--pds-border-subtle)] flex items-center justify-between bg-[var(--pds-surface-2)]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-sm">
              {opportunity?.organization_name.substring(0, 2).toUpperCase() || "OP"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold tracking-tight text-[var(--pds-text-primary)]">
                  {opportunity?.organization_name || "Loading Opportunity..."}
                </h2>
                <a
                  href={`https://${opportunity?.primary_domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[var(--pds-text-muted)] hover:text-indigo-400 flex items-center gap-1 font-mono"
                >
                  {opportunity?.primary_domain}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-xs text-[var(--pds-text-secondary)]">
                {opportunity?.industry} · ~{opportunity?.employee_count_est} employees · {opportunity?.country}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold">
              Fit Score: {opportunity?.fit_score}/100
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--pds-text-muted)] hover:bg-[var(--pds-surface-3)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center p-8 text-sm text-[var(--pds-text-muted)] font-mono">
            Loading evidence dossier & contact provenance...
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[var(--pds-border-subtle)] overflow-hidden">
            {/* Left Column: Immutable Evidence Dossier */}
            <div className="flex flex-col h-full overflow-y-auto p-6 bg-[var(--pds-surface-1)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--pds-text-muted)]">
                  Immutable Evidence Trail
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Append-Only
                </span>
              </div>

              {/* Decision Maker Card */}
              {contact && (
                <div className="p-4 rounded-xl border border-[var(--pds-border-subtle)] bg-[var(--pds-surface-2)] mb-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-sm text-[var(--pds-text-primary)]">
                        {contact.full_name}
                      </div>
                      <div className="text-xs text-[var(--pds-text-secondary)]">
                        {contact.job_title}
                      </div>
                      <div className="text-xs font-mono text-indigo-400 mt-1">
                        {contact.email || "No email detected"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--pds-surface-3)] border border-[var(--pds-border-subtle)] text-[var(--pds-text-muted)]">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      {contact.verification_tier.replace(/_/g, " ")}
                    </div>
                  </div>
                  <div className="text-[10px] text-[var(--pds-text-muted)] mt-2 pt-2 border-t border-[var(--pds-border-subtle)]">
                    Source: <a href={contact.provenance_source} target="_blank" rel="noreferrer" className="underline hover:text-indigo-400">{contact.provenance_source}</a>
                  </div>
                </div>
              )}

              {/* Evidence Timeline */}
              <div className="space-y-4">
                {evidence.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3.5 rounded-xl border border-[var(--pds-border-subtle)] bg-[var(--pds-surface-2)]/60 text-xs"
                  >
                    <div className="flex items-center justify-between text-[10px] text-[var(--pds-text-muted)] mb-1.5 font-mono">
                      <span className="uppercase font-semibold text-indigo-300">
                        {ev.signal_type.replace(/_/g, " ")}
                      </span>
                      <span>Observed {new Date(ev.observed_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs italic text-[var(--pds-text-primary)] leading-relaxed mb-2">
                      "{ev.raw_snippet}"
                    </p>
                    <a
                      href={ev.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1 font-mono truncate"
                    >
                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      {ev.source_url}
                    </a>
                  </div>
                ))}
              </div>

              {/* Deal Outcome Trigger */}
              <div className="mt-8 pt-6 border-t border-[var(--pds-border-subtle)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--pds-text-muted)]">Commercial Status</span>
                  <button
                    onClick={() => setShowDealModal(true)}
                    className="text-xs font-mono px-3 py-1 rounded-lg bg-[var(--pds-surface-3)] hover:bg-[var(--pds-surface-4)] text-[var(--pds-text-primary)] border border-[var(--pds-border-mid)] transition-colors flex items-center gap-1.5"
                  >
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    Record Deal Outcome
                  </button>
                </div>
                {opportunity?.deal_value_usd && (
                  <div className="mt-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-mono flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Deal Won: ${opportunity.deal_value_usd.toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Outreach & Send Studio */}
            <div className="flex flex-col h-full overflow-y-auto p-6 bg-[var(--pds-surface-2)]/30">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--pds-text-muted)]">
                  Grounded Pitch Studio
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Manual Send Only
                </span>
              </div>

              {outreach?.status === "manually_sent" && (
                <div className="p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-mono flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="font-semibold">Sent manually on {new Date(outreach.sent_at!).toLocaleDateString()}</div>
                    <div className="text-[11px] text-emerald-300">
                      Next Follow-up: {opportunity?.next_action_due_at ? formatBusinessDate(new Date(opportunity.next_action_due_at)) : "+3 business days"}
                    </div>
                  </div>
                </div>
              )}

              {/* Subject Input */}
              <div className="mb-4">
                <label className="block text-xs font-mono text-[var(--pds-text-muted)] mb-1.5">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-1)] text-[var(--pds-text-primary)] focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Body Textarea */}
              <div className="flex-1 flex flex-col mb-6">
                <label className="block text-xs font-mono text-[var(--pds-text-muted)] mb-1.5">
                  Pitch Body (Grounded in Verified Evidence)
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  className="flex-1 w-full text-xs leading-relaxed px-3.5 py-3 rounded-xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-1)] text-[var(--pds-text-primary)] focus:outline-none focus:border-indigo-500 font-sans transition-colors resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-[var(--pds-border-subtle)] flex flex-wrap gap-2 justify-end">
                <button
                  onClick={handleCopy}
                  className="px-3.5 py-2 rounded-xl text-xs font-mono bg-[var(--pds-surface-2)] hover:bg-[var(--pds-surface-3)] border border-[var(--pds-border-mid)] text-[var(--pds-text-primary)] flex items-center gap-1.5 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy to Clipboard"}
                </button>

                {contact?.email && (
                  <a
                    href={`mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
                    className="px-3.5 py-2 rounded-xl text-xs font-mono bg-[var(--pds-surface-2)] hover:bg-[var(--pds-surface-3)] border border-[var(--pds-border-mid)] text-[var(--pds-text-primary)] flex items-center gap-1.5 transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5 text-indigo-400" />
                    Open Mail Client
                  </a>
                )}

                <button
                  onClick={handleConfirmSend}
                  disabled={sending || outreach?.status === "manually_sent"}
                  className="px-4 py-2 rounded-xl text-xs font-mono font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white flex items-center gap-1.5 transition-colors shadow-lg shadow-indigo-600/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  {outreach?.status === "manually_sent" ? "Sent Confirmed" : "Mark as Manually Sent"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Record Deal Outcome */}
        {showDealModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-md bg-[var(--pds-surface-1)] border border-[var(--pds-border-mid)] rounded-2xl p-6 shadow-2xl">
              <h3 className="text-base font-semibold text-[var(--pds-text-primary)] mb-2">
                Record Commercial Deal Outcome
              </h3>
              <p className="text-xs text-[var(--pds-text-muted)] mb-4">
                For {opportunity?.organization_name}. Records manual revenue confirmation for the proof goal.
              </p>

              <div className="mb-4">
                <label className="block text-xs font-mono text-[var(--pds-text-muted)] mb-1">
                  Contract Value ($ USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-[var(--pds-text-muted)] font-mono">$</span>
                  <input
                    type="number"
                    value={dealValue}
                    onChange={(e) => setDealValue(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 text-xs font-mono rounded-xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-2)] text-[var(--pds-text-primary)]"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-xs font-mono text-[var(--pds-text-muted)] mb-1">
                  Deal Notes / Scope
                </label>
                <textarea
                  value={dealNotes}
                  onChange={(e) => setDealNotes(e.target.value)}
                  placeholder="e.g. 3-month automation retainer covering onboarding and project reporting"
                  rows={3}
                  className="w-full p-3 text-xs rounded-xl border border-[var(--pds-border-mid)] bg-[var(--pds-surface-2)] text-[var(--pds-text-primary)] resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowDealModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-mono text-[var(--pds-text-muted)] hover:bg-[var(--pds-surface-2)]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRecordDeal("closed_lost")}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-mono bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30"
                >
                  Mark Lost
                </button>
                <button
                  onClick={() => handleRecordDeal("closed_won")}
                  className="px-4 py-1.5 rounded-xl text-xs font-mono font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
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
