import { useState, useEffect } from "react";
import { 
  Shield, CheckCircle2, XCircle, AlertTriangle, 
  Users, Mail, Server, HelpCircle, Key, RefreshCw
} from "lucide-react";
import { ALLOWED_TEAM_EMAILS } from "@/lib/adminConfig";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function HqTeam() {
  const [testingFunction, setTestingFunction] = useState(false);
  const [systemCheck, setSystemCheck] = useState<{
    functionOk: boolean;
    aiKeyOk: boolean;
    errorMsg: string | null;
  } | null>(null);

  const performSystemCheck = async () => {
    setTestingFunction(true);
    try {
      const { data, error } = await supabase.functions.invoke("sourcing-machine", {
        body: { action: "list-notion-databases" }
      });

      if (error) {
        throw new Error(error.message || "Failed to trigger Edge Function");
      }

      const keysMissing = data && data.error === "No AI API key configured. Please set MOONSHOT_API_KEY or NVIDIA_NIM_API_KEY in Supabase secrets.";
      
      setSystemCheck({
        functionOk: true,
        aiKeyOk: !keysMissing,
        errorMsg: keysMissing ? "MOONSHOT_API_KEY and NVIDIA_NIM_API_KEY are missing in Supabase Edge Secrets" : null
      });
    } catch (err: any) {
      console.error(err);
      setSystemCheck({
        functionOk: false,
        aiKeyOk: false,
        errorMsg: err.message || "Edge Function connectivity failure"
      });
    } finally {
      setTestingFunction(false);
    }
  };

  useEffect(() => {
    performSystemCheck();
  }, []);

  return (
    <div className="p-6 md:p-8 space-y-8 bg-background min-h-screen text-foreground relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Team & Health</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage team access controls and audit backend Edge function integrations.</p>
        </div>
        <Button onClick={performSystemCheck} variant="outline" className="h-9 gap-1.5 border-border hover:bg-muted font-mono text-xs" disabled={testingFunction}>
          <RefreshCw className={`h-3.5 w-3.5 ${testingFunction ? "animate-spin" : ""}`} /> Run System Diagnosis
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team Members List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border/60 bg-card p-6 space-y-4 shadow-lg">
            <div className="flex items-center gap-3 pb-3 border-b border-border/60">
              <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center border border-border/60">
                <Users className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Authorized Team Directory</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Logged-in users matching these emails are granted administrative portal access.</p>
              </div>
            </div>

            <div className="divide-y divide-border/40 max-h-[350px] overflow-y-auto">
              {ALLOWED_TEAM_EMAILS.map((email, idx) => (
                <div key={idx} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center border border-border/30">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-medium">{email}</span>
                  </div>
                  <span className="text-[10px] font-mono uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded">Owner / Admin</span>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border/40 bg-muted/20 p-4 flex gap-3.5 items-start mt-4">
              <HelpCircle className="h-5 w-5 text-muted-foreground/60 shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground leading-relaxed">
                To expand team access, append allowed email addresses to the `ALLOWED_TEAM_EMAILS` array inside [adminConfig.ts](file:///c:/Users/SUDO/Documents/Atlas%20io/src/lib/adminConfig.ts).
              </div>
            </div>
          </div>
        </div>

        {/* Backend diagnostics status */}
        <div className="rounded-xl border border-border/60 bg-card p-5 space-y-5 shadow-lg h-fit">
          <h2 className="text-sm font-semibold tracking-tight font-mono uppercase text-muted-foreground flex items-center gap-1.5 pb-2 border-b border-border/60">
            <Server className="h-4 w-4 text-amber-500" /> Deployment Diagnostics
          </h2>

          <div className="space-y-4 text-xs">
            {/* Edge Function Status */}
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <span className="font-semibold block text-foreground">Sourcing Machine</span>
                <span className="text-[10px] text-muted-foreground">Supabase Edge Function endpoint</span>
              </div>
              {systemCheck === null ? (
                <span className="text-[10px] text-muted-foreground font-mono">Running...</span>
              ) : systemCheck.functionOk ? (
                <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5" /> Operational</span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-mono text-red-500"><XCircle className="h-3.5 w-3.5" /> Offline</span>
              )}
            </div>

            {/* AI Core status */}
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <span className="font-semibold block text-foreground">AI Provider Key Configuration</span>
                <span className="text-[10px] text-muted-foreground">Kimi (Moonshot) or Nvidia NIM API credentials</span>
              </div>
              {systemCheck === null ? (
                <span className="text-[10px] text-muted-foreground font-mono">Running...</span>
              ) : systemCheck.aiKeyOk ? (
                <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5" /> Configured</span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-mono text-amber-500"><AlertTriangle className="h-3.5 w-3.5" /> Missing Keys</span>
              )}
            </div>
          </div>

          {/* Key guide if missing */}
          {systemCheck && !systemCheck.aiKeyOk && (
            <div className="border border-border/60 rounded-lg bg-muted/20 p-3.5 space-y-2">
              <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-amber-500" /> API Secret Key Setup
              </span>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Configure your Supabase Edge secrets using the command line:
              </p>
              <pre className="p-2 bg-black/80 rounded text-[9px] font-mono border border-border/40 text-muted-foreground overflow-x-auto">
                supabase secrets set NVIDIA_NIM_API_KEY=sk_...
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
