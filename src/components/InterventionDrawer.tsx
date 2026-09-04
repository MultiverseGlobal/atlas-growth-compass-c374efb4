import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, X, ChevronRight, Mail, MessageSquare, RefreshCw, Send, Sparkles, Building2, User, Globe, Check } from "lucide-react";
import type { DiscoveredLead, OutreachDraft } from "@/services/campaignEngine";

interface InterventionDrawerProps {
  isOpen: boolean;
  lead: DiscoveredLead | null;
  draft: OutreachDraft | null;
  onApprove: (draft: OutreachDraft, recipientEmail: string) => void;
  onRegenerate: () => void;
  onSkip: () => void;
  onClose: () => void;
  isDispatching?: boolean;
}

export function InterventionDrawer({
  isOpen,
  lead,
  draft,
  onApprove,
  onRegenerate,
  onSkip,
  onClose,
  isDispatching = false,
}: InterventionDrawerProps) {
  const [channel, setChannel] = useState<"email" | "linkedin">("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (draft) {
      setSubject(draft.subject || "");
      setBody(channel === "email" ? draft.body : (draft.linkedin_dm || draft.body));
    }
    if (lead?.founder?.email) {
      setRecipientEmail(lead.founder.email);
    }
  }, [draft, lead, channel]);

  const handleChannelSwitch = (newChannel: "email" | "linkedin") => {
    setChannel(newChannel);
    if (draft) {
      setBody(newChannel === "email" ? draft.body : (draft.linkedin_dm || draft.body));
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(body);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleApprove = () => {
    onApprove(
      {
        subject,
        body,
        linkedin_dm: draft?.linkedin_dm,
      },
      recipientEmail
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Spatial Backdrop Blur Overlay */}
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(24px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-40 bg-black/60"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sliding Liquid Glass Panel */}
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 28, mass: 1 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl border-l border-white/10 bg-[#0e1018]/95 pds-glass-elevated shadow-float flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
                  <AlertCircle className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <h2 className="font-display text-base tracking-tight text-white flex items-center gap-2">
                    Human Review Required
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30">
                      Step 1 of 1
                    </span>
                  </h2>
                  <p className="text-xs text-white/50">One-way street halted. Authorize outbound distribution.</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {/* Target Prospect Info Card */}
              {lead && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Building2 className="h-4 w-4 text-accent/80" />
                      <span className="font-display text-sm font-semibold text-white tracking-tight">{lead.company}</span>
                      <a
                        href={lead.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-white/40 hover:text-white flex items-center gap-1 font-mono transition-colors"
                      >
                        <Globe className="h-3 w-3" />
                        {lead.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </a>
                    </div>
                    {lead.icp_score && (
                      <span className="font-mono text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                        ICP {lead.icp_score}%
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-white/70 border-t border-white/5 pt-2.5">
                    <User className="h-3.5 w-3.5 text-white/40" />
                    <span className="font-medium text-white/90">{lead.founder?.name}</span>
                    <span className="text-white/40">•</span>
                    <span className="text-white/50">{lead.founder?.role}</span>
                  </div>

                  {lead.bottleneck && (
                    <div className="text-[11px] text-white/60 bg-black/30 rounded-lg p-2 font-mono">
                      <span className="text-accent/70 uppercase">Identified Bottleneck: </span>
                      {lead.bottleneck}
                    </div>
                  )}
                </div>
              )}

              {/* Channel Selector */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-white/40 font-semibold">
                  Outreach Medium
                </span>
                <div className="flex items-center rounded-xl border border-white/10 bg-black/40 p-1">
                  <button
                    onClick={() => handleChannelSwitch("email")}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg font-medium transition-all ${
                      channel === "email" ? "bg-white text-black font-semibold shadow-sm" : "text-white/60 hover:text-white"
                    }`}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Cold Email
                  </button>
                  <button
                    onClick={() => handleChannelSwitch("linkedin")}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg font-medium transition-all ${
                      channel === "linkedin" ? "bg-white text-black font-semibold shadow-sm" : "text-white/60 hover:text-white"
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    LinkedIn DM
                  </button>
                </div>
              </div>

              {/* Recipient Email / Destination */}
              {channel === "email" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-white/40 font-medium">
                    Recipient Address
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="prospect@company.com"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white font-mono focus:border-accent focus:outline-none transition-colors"
                  />
                </div>
              )}

              {/* Subject Line (if Email) */}
              {channel === "email" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-white/40 font-medium">
                    Email Subject
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white font-medium focus:border-accent focus:outline-none transition-colors"
                  />
                </div>
              )}

              {/* Generated Message Body (Editable) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono uppercase tracking-wider text-white/40 font-medium flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-accent" />
                    AI-Generated Personalized Message
                  </label>
                  <button
                    onClick={handleCopy}
                    className="text-[11px] font-mono text-white/50 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    {isCopied ? <Check className="h-3 w-3 text-emerald-400" /> : null}
                    {isCopied ? "Copied" : "Copy text"}
                  </button>
                </div>
                <textarea
                  rows={8}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/90 leading-relaxed font-sans focus:border-accent focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* Regenerate or Angle Tweak */}
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={onRegenerate}
                  className="text-xs text-white/50 hover:text-accent font-mono flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate Pitch Angle
                </button>
                <button
                  onClick={onSkip}
                  className="text-xs text-white/40 hover:text-white/70 font-mono transition-colors"
                >
                  Skip this Lead →
                </button>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="border-t border-white/10 p-6 bg-[#0a0c12]/80 space-y-2.5">
              <button
                disabled={isDispatching || !body.trim()}
                onClick={handleApprove}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-black transition-all hover:bg-white/90 active:scale-[0.99] disabled:opacity-50"
              >
                {isDispatching ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-black" />
                    <span>Dispatching Outreach...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Approve & Dispatch Outreach</span>
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-black/10 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
              </button>

              <button
                onClick={onClose}
                className="w-full rounded-xl border border-white/10 px-4 py-2.5 text-xs font-mono text-white/50 transition-colors hover:bg-white/5 hover:text-white"
              >
                Keep Paused in Workspace
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
