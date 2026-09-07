import { useState } from "react";
import { 
  Settings, Key, Users, Building2, Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

export default function HqSettings() {
  const [openAiKey, setOpenAiKey] = useState("");
  const [apolloKey, setApolloKey] = useState("");
  const [workspaceName, setWorkspaceName] = useState("Multiverse Global");
  const [domain, setDomain] = useState("multiverse.global");
  
  const handleSave = (section: string) => {
    toast.success(`${section} settings saved.`);
  };

  return (
    <div className="p-8 bg-background min-h-screen text-foreground overflow-y-auto">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="border-b border-border/60 pb-5">
          <h1 className="text-3xl font-display font-bold tracking-tight flex items-center gap-3">
            <Settings className="h-7 w-7 text-foreground" />
            Workspace Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-2 font-mono uppercase tracking-wide">
            Configure your B2B growth engine parameters
          </p>
        </div>

        <Tabs defaultValue="workspace" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-[400px] mb-8 bg-card border border-border/40 h-10 p-1">
            <TabsTrigger value="workspace" className="text-xs font-semibold">Workspace</TabsTrigger>
            <TabsTrigger value="api-keys" className="text-xs font-semibold">API Keys</TabsTrigger>
            <TabsTrigger value="team" className="text-xs font-semibold">Team Access</TabsTrigger>
          </TabsList>

          <TabsContent value="workspace" className="space-y-6">
            <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-border/40 pb-4">
                <div className="h-10 w-10 rounded-lg bg-foreground text-background flex items-center justify-center">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold tracking-tight">General Details</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Primary information for your organization.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company Name</Label>
                  <Input 
                    value={workspaceName} 
                    onChange={(e) => setWorkspaceName(e.target.value)} 
                    className="h-10 bg-background border-border/60 font-semibold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Primary Domain</Label>
                  <Input 
                    value={domain} 
                    onChange={(e) => setDomain(e.target.value)} 
                    className="h-10 bg-background border-border/60 font-mono text-sm"
                  />
                </div>
              </div>
              
              <div className="pt-2">
                <Button onClick={() => handleSave("Workspace")} className="h-9 bg-foreground text-background gap-2 text-xs font-semibold px-6">
                  <Save className="w-3.5 h-3.5" /> Save Changes
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="api-keys" className="space-y-6">
            <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-border/40 pb-4">
                <div className="h-10 w-10 rounded-lg bg-foreground text-background flex items-center justify-center">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold tracking-tight">Service Integrations</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Connect external providers for enrichment and AI generation.</p>
                </div>
              </div>

              <div className="space-y-4 max-w-xl">
                <div className="space-y-2 p-4 border border-border/60 rounded-lg bg-background/50">
                  <div className="flex justify-between items-end mb-1">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-foreground">Apollo.io API</Label>
                    <span className="text-[9px] uppercase font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">Lead Enrichment</span>
                  </div>
                  <div className="flex gap-2">
                    <Input 
                      type="password" 
                      value={apolloKey} 
                      onChange={(e) => setApolloKey(e.target.value)} 
                      placeholder="sk-api-..."
                      className="font-mono text-xs bg-background border-border/60 h-10"
                    />
                    <Button variant="outline" onClick={() => handleSave("Apollo")} className="h-10 px-4">Verify</Button>
                  </div>
                </div>

                <div className="space-y-2 p-4 border border-border/60 rounded-lg bg-background/50">
                  <div className="flex justify-between items-end mb-1">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-foreground">OpenAI API</Label>
                    <span className="text-[9px] uppercase font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">Outreach Synthesis</span>
                  </div>
                  <div className="flex gap-2">
                    <Input 
                      type="password" 
                      value={openAiKey} 
                      onChange={(e) => setOpenAiKey(e.target.value)} 
                      placeholder="sk-proj-..."
                      className="font-mono text-xs bg-background border-border/60 h-10"
                    />
                    <Button variant="outline" onClick={() => handleSave("OpenAI")} className="h-10 px-4">Verify</Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="team" className="space-y-6">
            <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
              <div className="flex items-center gap-3 border-b border-border/40 pb-4 mb-6">
                <div className="h-10 w-10 rounded-lg bg-foreground text-background flex items-center justify-center">
                  <Users className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-semibold tracking-tight">Team Access</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Manage operator permissions.</p>
                </div>
                <Button size="sm" className="h-9 bg-foreground text-background px-4 text-xs font-semibold">
                  Invite User
                </Button>
              </div>

              <div className="border border-border/60 rounded-lg overflow-hidden bg-background">
                <div className="grid grid-cols-[1fr_100px_100px] gap-4 p-3 bg-muted/20 border-b border-border/60 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <div>Operator</div>
                  <div>Clearance</div>
                  <div className="text-right">Status</div>
                </div>
                <div className="grid grid-cols-[1fr_100px_100px] gap-4 p-4 items-center text-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded bg-foreground text-background flex items-center justify-center font-bold font-display text-sm">
                      A
                    </div>
                    <div>
                      <div className="font-semibold text-sm">Alex Founder</div>
                      <div className="text-[11px] font-mono text-muted-foreground mt-0.5">alex@multiverse.global</div>
                    </div>
                  </div>
                  <div className="text-xs font-semibold">Admin</div>
                  <div className="text-right">
                    <span className="text-[9px] uppercase font-mono tracking-wider font-bold bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded border border-emerald-500/20">Active</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
