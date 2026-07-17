import { useState, useEffect } from "react";
import { 
  Github, 
  Plug, 
  CheckCircle2, 
  Loader2, 
  ExternalLink,
  Search,
  Database,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Activity,
  Settings,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useIntegrations } from "@/hooks/useIntegrations";
import { useMaps } from "@/hooks/useMaps";
import { supabase } from "@/integrations/supabase/client";

function getRecommendedSources(goalText: string): string[] {
  const t = (goalText || "").toLowerCase();
  const rec = new Set<string>();
  if (t.includes("customer") || t.includes("user") || t.includes("signup") || t.includes("growth")) rec.add("stripe");
  if (t.includes("ship") || t.includes("build") || t.includes("launch") || t.includes("feature")) rec.add("github");
  if (t.includes("churn") || t.includes("retention") || t.includes("keep")) rec.add("stripe");
  if (t.includes("revenue") || t.includes("mrr") || t.includes("pricing")) rec.add("stripe");
  if (t.includes("docs") || t.includes("wiki") || t.includes("notion") || t.includes("write")) rec.add("notion");
  if (t.includes("team") || t.includes("slack") || t.includes("chat") || t.includes("message")) rec.add("slack");
  if (t.includes("calendar") || t.includes("meeting") || t.includes("google") || t.includes("drive")) rec.add("google");
  return Array.from(rec);
}

type Connector = {
  id: string;
  name: string;
  tagline: string;
  authMethod: "oauth" | "token";
  icon: React.ReactNode;
};

const connectors: Connector[] = [
  {
    id: "github",
    name: "GitHub",
    tagline: "Pull requests, issues, and releases.",
    authMethod: "oauth",
    icon: <Github className="h-7 w-7" />,
  },
  {
    id: "notion",
    name: "Notion",
    tagline: "Docs, databases, and project context.",
    authMethod: "oauth",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current">
        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
      </svg>
    ),
  },
  {
    id: "slack",
    name: "Slack",
    tagline: "Team activity volume and conversation signals.",
    authMethod: "oauth",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
      </svg>
    ),
  },
  {
    id: "google",
    name: "Google Workspace",
    tagline: "Calendar load, Drive activity, and Docs signals.",
    authMethod: "oauth",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.83z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.2 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
      </svg>
    ),
  },
  {
    id: "stripe",
    name: "Stripe",
    tagline: "Revenue, customers, and churn signals.",
    authMethod: "token",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current">
        <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
      </svg>
    ),
  },
];

export default function Integrations() {
  const { data: integrations = [], isLoading, connectGitHub, connectNotion, connectSlack, connectGoogle, disconnect } = useIntegrations();
  const { data: maps = [] } = useMaps();

  const primaryGoal = maps[0]?.goal_statement ?? "";
  const recommended = getRecommendedSources(primaryGoal);

  const getIntegration = (id: string) =>
    integrations.find((i) => i.provider === id && i.status === "active");

  const connectHandlers: Record<string, (() => void) | undefined> = {
    github: connectGitHub,
    notion: connectNotion,
    slack: connectSlack,
    google: connectGoogle,
  };

  return (
    <div className="relative page-hero mx-auto max-w-3xl px-4 py-10 md:px-8">
      <div className="flex items-center gap-2 eyebrow text-primary">
        <Plug className="h-3.5 w-3.5" /> Data sources
      </div>
      <h1 className="mt-4 font-display text-4xl font-semibold leading-tight">
        Connect your sources.
      </h1>
      <p className="mt-2 text-[15px] text-muted-foreground max-w-xl">
        Atlas reads signals from these tools to diagnose your dominant constraint. Click <strong>Connect</strong> — no API keys needed, just your account.
      </p>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {connectors.map((connector) => {
          const connected = getIntegration(connector.id);
          return (
            <ConnectorCard
              key={connector.id}
              connector={connector}
              connected={!!connected}
              connectedLabel={connected?.external_account_label ?? undefined}
              loading={isLoading}
              isRecommended={recommended.includes(connector.id)}
              onConnect={connectHandlers[connector.id]}
              onDisconnect={
                connected
                  ? () => disconnect.mutate(connected.id)
                  : undefined
              }
            />
          );
        })}
      </div>

      {/* Stripe coming via OAuth soon banner */}
      <p className="mt-6 text-center text-xs text-muted-foreground/60">
        Stripe OAuth coming soon — all connections are secured via OAuth 2.0 and never expose your keys.
      </p>

      {/* ── Notion Integration Settings ── */}
      {getIntegration("notion") && (
        <NotionSettingsPanel 
          integration={getIntegration("notion")}
          onDisconnect={() => disconnect.mutate(getIntegration("notion")!.id)}
          onReconnect={connectNotion}
        />
      )}
    </div>
  );
}

// ── ConnectorCard ─────────────────────────────────────────────────────────────

function ConnectorCard({
  connector,
  connected,
  connectedLabel,
  loading,
  isRecommended,
  onConnect,
  onDisconnect,
}: {
  connector: Connector;
  connected: boolean;
  connectedLabel?: string;
  loading: boolean;
  isRecommended?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
}) {
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    if (!onConnect) return;
    setConnecting(true);
    try {
      await onConnect();
    } finally {
      // Note: for OAuth providers, page will redirect so this may not run
      setConnecting(false);
    }
  };

  return (
    <div className={`card-warm flex flex-col gap-4 p-5 transition-all ${
      connected ? "border-primary/30 bg-primary/5" : ""
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl shrink-0 ${
          connected ? "bg-primary/10 text-primary" : "bg-muted/80 text-foreground"
        }`}>
          {connector.icon}
        </div>
        <div className="flex items-center gap-1.5">
          {isRecommended && !connected && (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide text-amber-700 font-medium">
              Recommended
            </span>
          )}
          {connected ? (
            <span className="flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-xs font-mono text-emerald-700">
              <CheckCircle2 className="h-3 w-3" /> Connected
            </span>
          ) : connector.id === "stripe" ? (
            <span className="flex items-center gap-1 rounded-full border border-border bg-muted/80 px-2.5 py-1 text-xs font-mono text-muted-foreground">
              Coming soon
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex-1">
        <div className="font-semibold">{connector.name}</div>
        <div className="mt-0.5 text-sm text-muted-foreground">{connector.tagline}</div>
        {connectedLabel && (
          <div className="mt-1 font-mono text-xs text-muted-foreground">{connectedLabel}</div>
        )}
      </div>

      {connector.id !== "stripe" && (
        connected ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onDisconnect}
          >
            Disconnect
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full gap-2"
            onClick={handleConnect}
            disabled={loading || connecting || !onConnect}
          >
            {connecting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Redirecting…
              </>
            ) : (
              <>
                <ExternalLink className="h-3.5 w-3.5" />
                Connect with {connector.name.split(" ")[0]}
              </>
            )}
          </Button>
        )
      )}
    </div>
  );
}

function NotionSettingsPanel({
  integration,
  onDisconnect,
  onReconnect
}: {
  integration: any;
  onDisconnect: () => void;
  onReconnect: () => void;
}) {
  const { updateSettings } = useIntegrations();
  const [databases, setDatabases] = useState<any[]>([]);
  const [loadingDbs, setLoadingDbs] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  const [validationReport, setValidationReport] = useState<any>(null);
  const [validating, setValidating] = useState(false);

  const settings = integration.settings || {};
  const activeDbId = settings.notion_database_id || "";
  const duplicateBehavior = settings.notion_duplicate_behavior || "duplicate";
  const customMappings = settings.field_mappings || {};

  const fetchDatabases = async (showToast = false) => {
    setLoadingDbs(true);
    if (showToast) toast.loading("Fetching Notion databases...");
    try {
      const { data, error } = await supabase.functions.invoke("sourcing-machine", {
        body: { action: "list-notion-databases" }
      });
      if (error) throw error;
      setDatabases(data.databases || []);
      if (showToast) {
        toast.dismiss();
        toast.success(`Loaded ${data.databases?.length || 0} Notion databases.`);
      }
    } catch (err: any) {
      if (showToast) toast.dismiss();
      toast.error("Failed to load Notion databases: " + err.message);
    } finally {
      setLoadingDbs(false);
    }
  };

  const validateDatabase = async (dbId: string) => {
    if (!dbId) {
      setValidationReport(null);
      return;
    }
    setValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke("sourcing-machine", {
        body: { 
          action: "validate-notion-database",
          database_id: dbId,
          field_mappings: customMappings
        }
      });
      if (error) throw error;
      setValidationReport(data);
      
      // Auto-save auto-mappings if none are set yet
      if (Object.keys(customMappings).length === 0 && data.auto_mappings) {
        await updateSettings.mutateAsync({
          integrationId: integration.id,
          settings: {
            ...settings,
            field_mappings: data.auto_mappings
          }
        });
      }
    } catch (err: any) {
      toast.error("Schema validation failed: " + err.message);
      setValidationReport({ valid: false, errors: [err.message] });
    } finally {
      setValidationReport(null);
      setValidating(false);
    }
  };

  useEffect(() => {
    fetchDatabases();
  }, [integration.id]);

  useEffect(() => {
    if (activeDbId) {
      validateDatabase(activeDbId);
    } else {
      setValidationReport(null);
    }
  }, [activeDbId, integration.id]);

  const handleSelectDb = async (dbId: string) => {
    const db = databases.find(d => d.id === dbId);
    const dbTitle = db ? db.title : "Notion Database";
    
    await updateSettings.mutateAsync({
      integrationId: integration.id,
      settings: {
        ...settings,
        notion_database_id: dbId,
        notion_database_name: dbTitle
      }
    });
    toast.success(`Active export database set to: ${dbTitle}`);
  };

  const handleDuplicateBehavior = async (val: string) => {
    await updateSettings.mutateAsync({
      integrationId: integration.id,
      settings: {
        ...settings,
        notion_duplicate_behavior: val
      }
    });
    toast.success(`Duplicate strategy updated to: ${val}`);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    toast.loading("Testing Notion workspace authorization...");
    try {
      await fetchDatabases(false);
      if (activeDbId) {
        await validateDatabase(activeDbId);
      }
      toast.dismiss();
      toast.success("Notion connection test passed successfully! 🚀");
    } catch (err: any) {
      toast.dismiss();
      toast.error("Notion connection test failed: " + err.message);
    } finally {
      setTestingConnection(false);
    }
  };

  // Filter databases based on search query
  const filteredDbs = databases.filter(db => 
    db.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedDb = databases.find(d => d.id === activeDbId);

  return (
    <div className="mt-8 border-t border-border/60 pt-8 animate-in fade-in duration-300">
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-6">
        <Settings className="h-4 w-4 text-primary" /> Notion Integration Console
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Connection Status Card */}
        <div className="card-warm p-5 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-500" /> Connection Status
          </h3>
          <div className="text-xs text-muted-foreground space-y-2.5">
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">✓ Connected</span>
            </div>
            <div className="flex justify-between">
              <span>Workspace:</span>
              <span className="font-medium text-foreground truncate max-w-[150px]" title={integration.external_account_label}>
                {integration.external_account_label || "Workspace"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Last Sync Check:</span>
              <span className="font-medium text-foreground text-right">
                {integration.last_sync_at ? new Date(integration.last_sync_at).toLocaleString() : "Never synced"}
              </span>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full text-xs" 
              onClick={handleTestConnection}
              disabled={testingConnection}
            >
              {testingConnection ? "Testing..." : "Test Connection"}
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="flex-1 text-xs text-muted-foreground hover:text-foreground" onClick={onReconnect}>
                Reconnect
              </Button>
              <Button variant="ghost" size="sm" className="flex-1 text-xs text-destructive hover:bg-destructive/10" onClick={onDisconnect}>
                Disconnect
              </Button>
            </div>
          </div>
        </div>

        {/* Database Selection Card */}
        <div className="card-warm p-5 space-y-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" /> Active Export Target
            </h3>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-muted-foreground"
              onClick={() => fetchDatabases(true)}
              disabled={loadingDbs}
              title="Refresh database listing"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingDbs ? "animate-spin" : ""}`} />
            </Button>
          </div>

          <div className="space-y-4">
            {databases.length === 0 && !loadingDbs ? (
              <div className="p-4 rounded-md border border-amber-300/30 bg-amber-500/5 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" /> No Notion databases discovered
                </div>
                <p className="leading-relaxed text-muted-foreground">
                  Atlas HQ has not been granted access to any Notion databases. Open Notion, share your database with the Atlas HQ integration, or click **Reconnect** to re-authorize workspace permissions.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground">Select Target Notion Database</label>
                  {databases.length > 5 && (
                    <Input
                      placeholder="Search databases..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="h-7 text-[10px] w-[150px] bg-background border-border/50 py-0"
                    />
                  )}
                </div>
                <Select value={activeDbId} onValueChange={handleSelectDb}>
                  <SelectTrigger className="w-full bg-background border-border/50 h-9 text-xs">
                    <SelectValue placeholder="Choose Notion DB..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {filteredDbs.map(db => (
                      <SelectItem key={db.id} value={db.id} className="text-xs">
                        <span className="flex items-center gap-2">
                          <span>{db.icon && typeof db.icon === "string" ? db.icon : "📂"}</span>
                          <span>{db.title}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Duplicate Settings */}
            <div className="space-y-2.5 pt-2 border-t border-border/40">
              <label className="text-xs font-semibold text-muted-foreground">Default Duplicate Strategy</label>
              <Select value={duplicateBehavior} onValueChange={handleDuplicateBehavior}>
                <SelectTrigger className="w-full bg-background border-border/50 h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="duplicate" className="text-xs">Create Duplicate Page</SelectItem>
                  <SelectItem value="update" className="text-xs">Update Existing Page</SelectItem>
                  <SelectItem value="skip" className="text-xs">Skip Sync</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Database Schema Validation Report */}
      {activeDbId && (
        <div className="mt-6 card-warm p-5 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" /> Schema Alignment Verification
          </h3>
          
          {validating ? (
            <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" /> Validating Notion properties layout...
            </div>
          ) : validationReport ? (
            <div className="space-y-4 text-xs">
              {validationReport.valid ? (
                <div className="p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">Perfect Database Alignment</div>
                    <p className="mt-1 leading-relaxed text-muted-foreground">
                      All required columns (`Company`, `Founder`, `LinkedIn`, `X`, `ICP Score`, `Notes`) are mapped and match Notion's properties layout. Ready to sync leads!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-lg border border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-2.5 animate-in fade-in duration-200">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">Property Mismatch Detected</div>
                    <p className="mt-1 leading-relaxed text-muted-foreground/80">
                      Atlas HQ cannot write to the selected Notion database because of schema mismatches. Please align the properties in Notion or map similarly named columns:
                    </p>
                    <ul className="mt-3 space-y-1.5 font-mono text-[11px] list-disc list-inside">
                      {validationReport.errors.map((err: string, i: number) => (
                        <li key={i} className="text-destructive font-medium">{err}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Mappings Table */}
              <div className="rounded-md border border-border/40 overflow-hidden bg-background/50">
                <div className="grid grid-cols-3 bg-muted/40 p-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/40 font-semibold">
                  <div>Atlas Fields</div>
                  <div>Mapped Property</div>
                  <div className="text-right">Type</div>
                </div>
                <div className="divide-y divide-border/40 font-mono text-[11px]">
                  {[
                    { field: "company_name", label: "Company Name", default: "Company", type: "Title" },
                    { field: "founder_name", label: "Founder Name", default: "Founder", type: "Rich Text" },
                    { field: "linkedin_url", label: "LinkedIn URL", default: "LinkedIn", type: "URL" },
                    { field: "twitter_url", label: "Twitter handle / URL", default: "X", type: "URL / Rich Text" },
                    { field: "icp_score", label: "ICP Score", default: "ICP Score", type: "Number" },
                    { field: "notes", label: "Outreach notes", default: "Notes", type: "Rich Text" },
                  ].map((f, i) => {
                    const mappedName = customMappings[f.field] || validationReport.auto_mappings?.[f.field] || f.default;
                    const prop = validationReport.properties?.find((p: any) => p.name === mappedName);
                    return (
                      <div key={i} className="grid grid-cols-3 p-2.5 items-center">
                        <div className="font-sans font-medium text-foreground">{f.label}</div>
                        <div className="text-muted-foreground flex items-center gap-1">
                          <span>{mappedName}</span>
                          {!prop && <Badge variant="outline" className="text-[9px] text-destructive border-destructive/20 bg-destructive/5 font-sans px-1.5 py-0.5">Unmapped</Badge>}
                        </div>
                        <div className="text-right text-muted-foreground">{prop?.type?.toUpperCase() || f.type.toUpperCase()}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Verification check ready.</div>
          )}
        </div>
      )}
    </div>
  );
}