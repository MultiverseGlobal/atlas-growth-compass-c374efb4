import { useState } from "react";
import { Loader2, Zap, Copy, Check, Video, FileText, ArrowRight, ShieldCheck, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export interface ProofAsset {
  title: string;
  assetType: "video_teardown" | "workflow_map" | "roi_delta";
  summary: string;
  currentBottlenecks: string[];
  streamlinedPipeline: string[];
  loomScript: {
    hook: string;
    diagnosis: string;
    proofDemo: string;
    callToAction: string;
  };
  timeToCreateMin: number;
  expectedConversionLift: string;
}

interface ProofEngineModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
  website?: string;
  painSignal?: string;
  contactName?: string;
}

export function ProofEngineModal({
  isOpen,
  onClose,
  companyName,
  website,
  painSignal,
  contactName = "Founder"
}: ProofEngineModalProps) {
  const [loading, setLoading] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [proof, setProof] = useState<ProofAsset | null>(null);

  if (!isOpen) return null;

  const handleGenerateProof = async () => {
    setLoading(true);
    // Simulate / AI-generate structured proof asset based on real pain signal
    setTimeout(() => {
      const generated: ProofAsset = {
        title: `Operational Bottleneck Teardown · ${companyName}`,
        assetType: "video_teardown",
        summary: `3-minute asynchronous diagnostic video dismantling the manual friction in ${companyName}'s current workflow.`,
        currentBottlenecks: [
          "Manual onboarding form data entry into CRM and spreadsheet tracker",
          "Ad-hoc Slack channel creation and asynchronous permission provisioning",
          "Duplicate task assignment across PM tools causing team onboarding lag",
          "Manual kickoff meeting scheduling and reminder pinging"
        ],
        streamlinedPipeline: [
          "Single intake webhook triggers instant client workspace provisioning",
          "Automated client portal setup with dynamic role-based access",
          "Real-time sync between CRM, Slack, and project management board in <10 seconds"
        ],
        loomScript: {
          hook: `Hey ${contactName}, noticed ${companyName} is expanding delivery. Ran a quick 3-minute teardown of where 6+ hours slip in client onboarding and project kickoff.`,
          diagnosis: `Right now, when a new client signs, your team is likely jumping across 4 separate systems (intake form → CRM → Slack setup → project boards). That adds 3–5 days of turnaround lag.`,
          proofDemo: `Here is the exact automated event-driven architecture that eliminates the manual copy-paste layer without changing the tools your team already uses.`,
          callToAction: `If you want the full blueprint or want us to build this out in a 3-day sprint, let me know. Happy to send over the complete workflow file.`
        },
        timeToCreateMin: 3,
        expectedConversionLift: "3.4x vs generic outbound"
      };
      setProof(generated);
      setLoading(false);
    }, 650);
  };

  const copyToClipboard = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-xl border border-border/60 bg-[#0F1117] p-6 shadow-2xl text-foreground max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Proof Engine · Diagnostic Teardown</h2>
            <p className="text-xs text-muted-foreground">
              Generate a 3-minute custom proof asset tailored to {companyName}'s exact operational friction.
            </p>
          </div>
        </div>

        {painSignal && (
          <div className="mb-5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
            <span className="font-medium">Detected Pain Signal:</span> "{painSignal}"
          </div>
        )}

        {!proof && !loading && (
          <div className="text-center py-8">
            <div className="max-w-md mx-auto mb-6 text-sm text-muted-foreground">
              Rather than sending a generic pitch, Atlas constructs a high-conversion diagnostic teardown demonstrating exactly how their operational bottleneck is solved.
            </div>
            <Button
              onClick={handleGenerateProof}
              className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 font-medium px-6"
            >
              <Zap className="h-4 w-4" />
              Generate Proof Asset & Loom Script
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
            Synthesizing operational diagnosis and custom Loom script for {companyName}…
          </div>
        )}

        {proof && (
          <div className="space-y-6 text-sm">
            {/* Header Badge */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2 text-emerald-400 font-medium">
                <Video className="h-4 w-4" />
                <span>{proof.title}</span>
              </div>
              <span className="text-xs text-emerald-300 font-semibold px-2 py-0.5 rounded bg-emerald-500/20">
                {proof.expectedConversionLift}
              </span>
            </div>

            {/* Current Friction vs Streamlined State */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-lg bg-red-500/5 border border-red-500/20">
                <div className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">
                  Identified Bottlenecks
                </div>
                <ul className="space-y-1.5 text-xs text-muted-foreground list-disc list-inside">
                  {proof.currentBottlenecks.map((b, i) => (
                    <li key={i} className="text-red-200/90">{b}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
                  Streamlined State (Solved)
                </div>
                <ul className="space-y-1.5 text-xs text-muted-foreground list-disc list-inside">
                  {proof.streamlinedPipeline.map((s, i) => (
                    <li key={i} className="text-emerald-200/90">{s}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Loom / Video Script */}
            <div className="rounded-lg border border-border/80 bg-black/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <FileText className="h-4 w-4 text-emerald-400" />
                  3-Minute Loom Recording Script
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 border-border/60"
                  onClick={() =>
                    copyToClipboard(
                      `[HOOK]\n${proof.loomScript.hook}\n\n[DIAGNOSIS]\n${proof.loomScript.diagnosis}\n\n[PROOF DEMO]\n${proof.loomScript.proofDemo}\n\n[CALL TO ACTION]\n${proof.loomScript.callToAction}`,
                      "full_script"
                    )
                  }
                >
                  {copiedSection === "full_script" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedSection === "full_script" ? "Copied" : "Copy Full Script"}
                </Button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-2.5 rounded bg-white/5 border border-white/10">
                  <span className="font-semibold text-emerald-400">0:00 - 0:30 (Hook): </span>
                  <span className="text-foreground/90">{proof.loomScript.hook}</span>
                </div>
                <div className="p-2.5 rounded bg-white/5 border border-white/10">
                  <span className="font-semibold text-amber-400">0:30 - 1:30 (Diagnosis): </span>
                  <span className="text-foreground/90">{proof.loomScript.diagnosis}</span>
                </div>
                <div className="p-2.5 rounded bg-white/5 border border-white/10">
                  <span className="font-semibold text-sky-400">1:30 - 2:30 (Proof Demo): </span>
                  <span className="text-foreground/90">{proof.loomScript.proofDemo}</span>
                </div>
                <div className="p-2.5 rounded bg-white/5 border border-white/10">
                  <span className="font-semibold text-purple-400">2:30 - 3:00 (Low-Friction CTA): </span>
                  <span className="text-foreground/90">{proof.loomScript.callToAction}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose} className="text-xs">
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
