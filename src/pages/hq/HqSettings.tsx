import { useState, useEffect } from "react";
import { 
  Database, RefreshCw, CheckCircle2, AlertTriangle, 
  Settings, Loader2, Link2, Info, Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIntegrations } from "@/hooks/useIntegrations";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NotionDatabase {
  id: string;
  title: string;
  url: string;
}

export default function HqSettings() {
  const { data: integrations = [], connectNotion, updateSettings, disconnect } = useIntegrations();
  const [notionDatabases, setNotionDatabases] = useState<NotionDatabase[]>([]);
  const [notionLoading, setNotionLoading] = useState(false);
  const [defaultNotionDb, setDefaultNotionDb] = useState(() => localStorage.getItem("atlas.sourcing.default_notion_db") || "");
  const [autoNotion, setAutoNotion] = useState(() => localStorage.getItem("atlas.sourcing.auto_notion") === "true");

  const notionIntegration = integrations.find(i => i.provider === "notion" && i.status === "active");

  const loadNotionDatabasesList = async (showToast = true) => {
    if (!notionIntegration) return;
    setNotionLoading(true);
    try {
      const { data: body, error: invokeError } = await supabase.functions.invoke("sourcing-machine", {
        body: { action: "list-notion-databases" }
      });

      if (invokeError) throw new Error(invokeError.message ?? "Failed to fetch databases");

      const dbs = body?.databases || [];
      setNotionDatabases(dbs);
      if (showToast) {
        toast.success(`Successfully loaded ${dbs.length} Notion databases.`);
      }
      return dbs;
    } catch (err: any) {
      console.error(err);
      if (showToast) {
        toast.error("Notion databases load error: " + err.message);
      }
      return [];
    } finally {
      setNotionLoading(false);
    }
  };

  useEffect(() => {
    if (notionIntegration) {
      const dbIdFromDb = notionIntegration.settings?.notion_database_id || "";
      if (dbIdFromDb && dbIdFromDb !== defaultNotionDb) {
        setDefaultNotionDb(dbIdFromDb);
      }
      
      if (notionDatabases.length === 0 && !notionLoading) {
        loadNotionDatabasesList(false);
      }
    }
  }, [notionIntegration]);

  const handleSelectDb = (val: string) => {
    setDefaultNotionDb(val);
    localStorage.setItem("atlas.sourcing.default_notion_db", val);
    
    // Save settings back to Supabase
    if (notionIntegration) {
      const db = notionDatabases.find(d => d.id === val);
      const dbTitle = db ? db.title : "Notion Database";
      updateSettings.mutate({
        integrationId: notionIntegration.id,
        settings: {
          ...notionIntegration.settings,
          notion_database_id: val,
          notion_database_name: dbTitle
        }
      });
      toast.success(`Active database set to: ${dbTitle}`);
    }
  };

  const handleToggleAutoNotion = (checked: boolean) => {
    setAutoNotion(checked);
    localStorage.setItem("atlas.sourcing.auto_notion", String(checked));
    
    if (notionIntegration) {
      updateSettings.mutate({
        integrationId: notionIntegration.id,
        settings: {
          ...notionIntegration.settings,
          auto_notion: checked
        }
      });
    }
    toast.success(checked ? "Auto-push to Notion enabled" : "Auto-push to Notion disabled");
  };

  return (
    <div className="p-6 md:p-8 space-y-8 bg-background min-h-screen text-foreground relative overflow-hidden">
      {/* Header */}
      <div className="border-b border-border/60 pb-5">
        <h1 className="text-3xl font-bold tracking-tight font-display">CRM Mappings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure your outbound Notion database pipelines and automation rules.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Connection Setup */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border/60 bg-card p-6 space-y-6 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center border border-border/60">
                <Database className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Notion CRM Database Connection</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Map lead items to your product pipeline or candidate database.</p>
              </div>
            </div>

            {notionIntegration ? (
              <div className="space-y-5">
                {/* Connected indicator */}
                <div className="flex items-center justify-between p-3.5 rounded-lg border border-emerald-500/10 bg-emerald-500/[0.02]">
                  <div className="flex items-center gap-2.5 text-sm">
                    <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
                    <div>
                      <span className="font-semibold block text-foreground">Notion Active Connection</span>
                      <span className="text-xs text-muted-foreground font-mono mt-0.5">{notionIntegration.external_account_label || "Workspace Connected"}</span>
                    </div>
                  </div>
                  <Button 
                    onClick={() => disconnect.mutate(notionIntegration.id)} 
                    variant="outline" 
                    className="h-8 text-xs border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-mono"
                  >
                    Disconnect
                  </Button>
                </div>

                {/* Configuration Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">Active Export Database</label>
                    <div className="flex gap-2">
                      <Select value={defaultNotionDb} onValueChange={handleSelectDb}>
                        <SelectTrigger className="bg-background text-xs h-9 flex-1 border-border/60">
                          <SelectValue placeholder={notionLoading ? "Loading..." : "Select database"} />
                        </SelectTrigger>
                        <SelectContent className="bg-popover text-popover-foreground border-border/60">
                          {notionDatabases.length === 0 ? (
                            <SelectItem value="none" disabled>No databases found</SelectItem>
                          ) : (
                            notionDatabases.map(db => (
                              <SelectItem key={db.id} value={db.id}>{db.title}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() => loadNotionDatabasesList(true)}
                        disabled={notionLoading}
                        variant="outline"
                        className="h-9 w-9 border-border/60 hover:bg-muted p-0 shrink-0"
                        title="Reload Databases"
                      >
                        <RefreshCw className={`h-4.5 w-4.5 text-muted-foreground ${notionLoading ? "animate-spin" : ""}`} />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-end pb-1.5">
                    <div className="flex items-center gap-2.5">
                      <Checkbox
                        id="auto-push"
                        checked={autoNotion}
                        onCheckedChange={(checked) => handleToggleAutoNotion(!!checked)}
                      />
                      <div>
                        <label htmlFor="auto-push" className="text-xs font-semibold text-foreground cursor-pointer block">Automate Notion Sync</label>
                        <span className="text-[10px] text-muted-foreground mt-0.5 block">Instantly push lead to CRM database after successful parse.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 border border-dashed border-border/60 rounded-lg bg-muted/20">
                <Database className="h-8 w-8 text-muted-foreground/60 mx-auto mb-3" />
                <h3 className="text-sm font-semibold">No Notion Workspace Connected</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Connect your Notion account using OAuth to export candidate lists and scrap profiles directly into your database.
                </p>
                <Button onClick={connectNotion} className="mt-4 h-9 bg-amber-500 text-black hover:bg-amber-600 font-semibold gap-1.5">
                  <Link2 className="h-4 w-4" /> Link Notion CRM
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Database property mapping guide */}
        <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4 shadow-lg h-fit">
          <h2 className="text-sm font-semibold tracking-tight font-mono uppercase text-muted-foreground flex items-center gap-1.5 pb-2 border-b border-border/60">
            <Info className="h-4 w-4 text-amber-500" /> Database Mappings Schema
          </h2>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Atlas HQ maps intelligence fields to target Notion databases automatically. To verify compatibility, ensure your database has columns named or matching the following:
          </p>

          <div className="space-y-3 font-mono text-[11px] pt-1">
            {[
              { field: "Company", type: "Title (Name)" },
              { field: "Founder", type: "Rich Text" },
              { field: "LinkedIn", type: "URL" },
              { field: "X", type: "URL / Rich Text" },
              { field: "ICP Score", type: "Number" },
              { field: "Notes", type: "Rich Text" },
            ].map((m, i) => (
              <div key={i} className="flex justify-between items-center py-1.5 border-b border-border/30">
                <span className="font-semibold text-foreground">{m.field}</span>
                <span className="text-muted-foreground">{m.type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
