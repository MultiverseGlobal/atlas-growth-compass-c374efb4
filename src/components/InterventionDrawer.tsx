import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  AlertCircle, X, ChevronRight, Mail, MessageSquare, RefreshCw, 
  Send, Sparkles, Building2, User, Globe, Check, ArrowRight 
} from "lucide-react";
import type { DiscoveredLead, OutreachDraft } from "@/services/campaignEngine";
import { soundManager } from "@/lib/audioFeedback";

interface InterventionDrawerProps {
  isOpen: boolean;
  lead: DiscoveredLead | null;
  draft: OutreachDraft | null;
  onApprove: (draft: OutreachDraft, recipientEmail: string) => void;
  onRegenerate: () => void;
  onSkip: () => void;
  onClose: () => void;
  isDispatching?: boolean;
  isDark?: boolean;
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
  isDark = true,
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

  // Keyboard shortcut: Cmd/Ctrl + Enter to approve
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleApprove();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, subject, body, recipientEmail]);

  const handleChannelSwitch = (newChannel: "email" | "linkedin") => {
    soundManager.playClick();
    setChannel(newChannel);
    if (draft) {
      setBody(newChannel === "email" ? draft.body : (draft.linkedin_dm || draft.body));
    }
  };

  const handleCopy = () => {
    soundManager.playClick();
    navigator.clipboard.writeText(body);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleApprove = () => {
    soundManager.playSuccess();
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
            animate={{ opacity: 1, backdropFilter: "blur(20px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className={`fixed inset-0 z-40 ${isDark ? "bg-black/60" : "bg-neutral-900/30"}`}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sliding Liquid Glass Panel */}
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 28, mass: 1 }}
            className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl border-l backdrop-blur-2xl flex flex-col shadow-2xl ${
              isDark
                ? "bg-[#0c0e16]/95 border-white/10 text-white"
                : "bg-white/95 border-neutral-200 text-neutral-900"
            }`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between border-b px-6 py-4 ${
              isDark ? "border-white/10" : "border-neutral-200"
            }`}>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                  <AlertCircle className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-display text-base tracking-tight font-semibold flex items-center gap-2">
                    Human Review Required
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30">
                      Step 1 of 1
                    </span>
                  </h2>
                  <p className={`text-xs ${isDark ? "text-white/50" : "text-neutral-500"}`}>
                    Autonomous pipeline paused. Authorize outbound sequence.
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className={`rounded-full p-2 transition-colors cursor-pointer ${
                  isDark ? "text-white/40 hover:bg-white/5 hover:text-white" : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {/* Target Prospect Info Card */}
              {lead && (
                <div className={`rounded-2xl border p-4 space-y-3 ${
                  isDark ? "border-white/10 bg-white/[0.03]" : "border-neutral-200 bg-neutral-50"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Building2 className="h-4 w-4 text-emerald-500" />
                      <span className="font-display text-sm font-semibold tracking-tight">{lead.company}</span>
                      <a
                        href={lead.website}
                        target="_blank"
                        rel="noreferrer"
                        className={`text-xs flex items-center gap-1 font-mono transition-colors hover:underline ${
                          isDark ? "text-white/40 hover:text-white" : "text-neutral-500 hover:text-neutral-900"
                        }`}
                      >
                        <Globe className="h-3 w-3" />
                        {lead.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </a>
                    </div>
                    {lead.icp_score && (
                      <span className="font-mono text-xs text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md font-semibold">
                        {lead.icp_score}% FIT
                      </span>
                    )}
                  </div>

                  <div className={`flex items-center gap-2 text-xs border-t pt-2.5 ${
                    isDark ? "border-white/5 text-white/70" : "border-neutral-200 text-neutral-600"
                  }`}>
                    <User className="h-3.5 w-3.5 opacity-60" />
                    <span className="font-medium">{lead.founder?.name}</span>
                    <span className="opacity-40">•</span>
                    <span className="opacity-70">{lead.founder?.role}</span>
                  </div>

                  {lead.bottleneck && (
                    <div className={`text-[11px] rounded-lg p-2 font-mono ${
                      isDark ? "bg-black/30 text-white/70" : "bg-neutral-200/50 text-neutral-800"
                    }`}>
                      <span className="text-emerald-500 font-semibold uppercase">Bottleneck: </span>
                      {lead.bottleneck}
                    </div>
                  )}
                </div>
              )}

              {/* Channel Selector */}
              <div className="flex items-center justify-between">
                <span className={`text-xs font-mono uppercase tracking-wider font-semibold ${
                  isDark ? "text-white/40" : "text-neutral-400"
                }`}>
                  Outreach Medium
                </span>
                <div className={`flex items-center rounded-xl border p-1 ${
                  isDark ? "border-white/10 bg-black/40" : "border-neutral-200 bg-neutral-100"
                }`}>
                  <button
                    onClick={() => handleChannelSwitch("email")}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                      channel === "email"
                        ? isDark
                          ? "bg-white text-black font-semibold shadow-sm"
                          : "bg-white text-neutral-900 font-semibold shadow-sm"
                        : isDark
                        ? "text-white/60 hover:text-white"
                        : "text-neutral-600 hover:text-neutral-900"
                    }`}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Cold Email
                  </button>
                  <button
                    onClick={() => handleChannelSwitch("linkedin")}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                      channel === "linkedin"
                        ? isDark
                          ? "bg-white text-black font-semibold shadow-sm"
                          : "bg-white text-neutral-900 font-semibold shadow-sm"
                        : isDark
                        ? "text-white/60 hover:text-white"
                        : "text-neutral-600 hover:text-neutral-900"
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    LinkedIn DM
                  </button>
                </div>
              </div>

              {/* Recipient Address */}
              {channel === "email" && (
                <div className="space-y-1.5">
                  <label className={`text-xs font-mono uppercase tracking-wider font-medium ${
                    isDark ? "text-white/40" : "text-neutral-400"
                  }`}>
                    Recipient Address
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="prospect@company.com"
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm font-mono focus:outline-none transition-colors ${
                      isDark
                        ? "border-white/10 bg-white/[0.04] text-white focus:border-white/30"
                        : "border-neutral-200 bg-neutral-50 text-neutral-900 focus:border-neutral-400"
                    }`}
                  />
                </div>
              )}

              {/* Subject Line */}
              {channel === "email" && (
                <div className="space-y-1.5">
                  <label className={`text-xs font-mono uppercase tracking-wider font-medium ${
                    isDark ? "text-white/40" : "text-neutral-400"
                  }`}>
                    Email Subject
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm font-medium focus:outline-none transition-colors ${
                      isDark
                        ? "border-white/10 bg-white/[0.04] text-white focus:border-white/30"
                        : "border-neutral-200 bg-neutral-50 text-neutral-900 focus:border-neutral-400"
                    }`}
                  />
                </div>
              )}

              {/* Message Body */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className={`text-xs font-mono uppercase tracking-wider font-medium flex items-center gap-1.5 ${
                    isDark ? "text-white/40" : "text-neutral-400"
                  }`}>
                    <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                    Personalized Pitch Copy
                  </label>
                  <button
                    onClick={handleCopy}
                    className={`text-[11px] font-mono flex items-center gap-1 transition-colors cursor-pointer ${
                      isDark ? "text-white/50 hover:text-white" : "text-neutral-500 hover:text-neutral-900"
                    }`}
                  >
                    {isCopied ? <Check className="h-3 w-3 text-emerald-500" /> : null}
                    {isCopied ? "Copied" : "Copy text"}
                  </button>
                </div>
                <textarea
                  rows={8}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className={`w-full rounded-xl border p-4 text-sm leading-relaxed font-sans focus:outline-none transition-colors resize-none ${
                    isDark
                      ? "border-white/10 bg-white/[0.04] text-white/90 focus:border-white/30"
                      : "border-neutral-200 bg-neutral-50 text-neutral-900 focus:border-neutral-400"
                  }`}
                />
              </div>

              {/* Secondary Options */}
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => {
                    soundManager.playClick();
                    onRegenerate();
                  }}
                  className={`text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isDark ? "text-white/50 hover:text-emerald-400" : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate Angle
                </button>
                <button
                  onClick={() => {
                    soundManager.playClick();
                    onSkip();
                  }}
                  className={`text-xs font-mono transition-colors cursor-pointer ${
                    isDark ? "text-white/40 hover:text-white/70" : "text-neutral-400 hover:text-neutral-700"
                  }`}
                >
                  Skip this Target →
                </button>
              </div>
            </div>

            {/* Footer Actions */}
            <div className={`border-t p-6 space-y-2.5 ${
              isDark ? "border-white/10 bg-[#08090f]/80" : "border-neutral-200 bg-neutral-50/90"
            }`}>
              <button
                disabled={isDispatching || !body.trim()}
                onClick={handleApprove}
                className={`group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-5 py-3.5 text-sm font-semibold transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer shadow-md ${
                  isDark
                    ? "bg-white text-black hover:bg-white/90"
                    : "bg-neutral-900 text-white hover:bg-neutral-800"
                }`}
              >
                {isDispatching ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Dispatching Sequence...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Approve & Dispatch Outreach</span>
                    <span className={`text-[11px] font-mono ml-2 opacity-60`}>⌘↵</span>
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>

              <button
                onClick={onClose}
                className={`w-full rounded-xl border px-4 py-2.5 text-xs font-mono transition-colors cursor-pointer ${
                  isDark
                    ? "border-white/10 text-white/50 hover:bg-white/5 hover:text-white"
                    : "border-neutral-200 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
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
