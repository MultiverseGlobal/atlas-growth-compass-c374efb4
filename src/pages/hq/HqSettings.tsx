import { useState } from "react";
import { 
  Settings, Key, Mail, MessageSquare, Users, CreditCard, 
  CheckCircle2, Plus, ArrowUpRight, Cpu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useTheme } from "@/hooks/useTheme";
import { Label } from "@/components/ui/label";

export default function HqSettings() {
  const { theme } = useTheme();
  
  // Mock state for forms
  const [openAiKey, setOpenAiKey] = useState("sk-proj-***********************************");
  const [anthropicKey, setAnthropicKey] = useState("");
  
  const handleSave = (section: string) => {
    toast.success(`${section} settings saved successfully.`);
  };

  return (
    <div className="p-6 pt-[120px] md:p-8 md:pt-[120px] bg-background min-h-screen text-foreground overflow-hidden flex flex-col items-center">
      <div className="w-full max-w-5xl space-y-8">
        <div className="border-b border-border/60 pb-5 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display flex items-center gap-3">
              <Settings className="h-8 w-8 text-foreground" />
              Settings
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure integrations, channels, team, and billing for your outreach platform.
            </p>
          </div>
        </div>

        <Tabs defaultValue="integrations" className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-[600px] mb-8 bg-card border border-border/40 h-11 p-1">
            <TabsTrigger value="integrations" className="text-xs font-semibold data-[state=active]:bg-foreground data-[state=active]:text-background transition-all">Integrations</TabsTrigger>
            <TabsTrigger value="channels" className="text-xs font-semibold data-[state=active]:bg-foreground data-[state=active]:text-background transition-all">Channels</TabsTrigger>
            <TabsTrigger value="team" className="text-xs font-semibold data-[state=active]:bg-foreground data-[state=active]:text-background transition-all">Team</TabsTrigger>
            <TabsTrigger value="billing" className="text-xs font-semibold data-[state=active]:bg-foreground data-[state=active]:text-background transition-all">Billing</TabsTrigger>
          </TabsList>

          {/* INTEGRATIONS TAB */}
          <TabsContent value="integrations" className="space-y-6">
            <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-lg bg-foreground text-background flex items-center justify-center shadow-md">
                  <Cpu className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">AI Models & Enrichment</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Connect external APIs to power the Atlas autonomous pipeline.</p>
                </div>
              </div>

              <div className="space-y-5 max-w-xl">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">OpenAI API Key</Label>
                  <div className="flex gap-3">
                    <Input 
                      type="password" 
                      value={openAiKey} 
                      onChange={(e) => setOpenAiKey(e.target.value)} 
                      className="font-mono text-xs bg-background/50 border-border"
                    />
                    <Button variant="outline" size="sm" onClick={() => handleSave("OpenAI")}>Verify</Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Active. Using gpt-4o for primary reasoning.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <Label className="text-xs font-semibold">Anthropic API Key (Optional)</Label>
                  <div className="flex gap-3">
                    <Input 
                      type="password" 
                      value={anthropicKey} 
                      onChange={(e) => setAnthropicKey(e.target.value)} 
                      placeholder="sk-ant-..."
                      className="font-mono text-xs bg-background/50 border-border"
                    />
                    <Button variant="outline" size="sm" onClick={() => handleSave("Anthropic")}>Connect</Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Used for fallback reasoning and specific copywriting tasks.</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* CHANNELS TAB */}
          <TabsContent value="channels" className="space-y-6">
            <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-lg bg-foreground text-background flex items-center justify-center shadow-md">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">Outbound Channels</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Manage sending accounts for automated outreach.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-border rounded-lg p-4 flex flex-col gap-4 relative overflow-hidden group hover:border-foreground/30 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 opacity-70" />
                      <span className="font-semibold text-sm">Cold Email</span>
                    </div>
                    <span className="text-[9px] uppercase tracking-wider font-bold bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded border border-emerald-500/20">Connected</span>
                  </div>
                  <div>
                    <div className="text-xs font-mono">alex@multiverse.global</div>
                    <div className="text-[10px] text-muted-foreground mt-1">SMTP/IMAP via Google Workspace</div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full text-xs h-8">Manage Account</Button>
                </div>

                <div className="border border-border border-dashed rounded-lg p-4 flex flex-col justify-center items-center text-center gap-3 hover:bg-card/80 transition-colors cursor-pointer bg-background/30">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Plus className="h-5 w-5 opacity-50" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Add LinkedIn Account</div>
                    <div className="text-[10px] text-muted-foreground mt-1 max-w-[200px]">Connect via session cookie for automated DMs and connection requests.</div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TEAM TAB */}
          <TabsContent value="team" className="space-y-6">
            <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-foreground text-background flex items-center justify-center shadow-md">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">Team Management</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Manage access and roles for your workspace.</p>
                  </div>
                </div>
                <Button size="sm" className="h-9 gap-2">
                  <Plus className="h-4 w-4" />
                  Invite Member
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_100px_100px] gap-4 p-3 bg-muted/50 border-b text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <div>User</div>
                  <div>Role</div>
                  <div className="text-right">Action</div>
                </div>
                <div className="grid grid-cols-[1fr_100px_100px] gap-4 p-4 items-center text-sm border-b last:border-0 bg-background/50">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-foreground text-background flex items-center justify-center font-semibold text-xs">
                      A
                    </div>
                    <div>
                      <div className="font-semibold">Alex Founder</div>
                      <div className="text-xs text-muted-foreground">alex@multiverse.global</div>
                    </div>
                  </div>
                  <div className="text-xs">Owner</div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-mono text-muted-foreground">Current</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* BILLING TAB */}
          <TabsContent value="billing" className="space-y-6">
            <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-foreground text-background flex items-center justify-center shadow-md">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">Billing & Usage</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Monitor your plan and outreach limits.</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="h-9 gap-2">
                  Manage in Stripe <ArrowUpRight className="h-3 w-3" />
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg bg-background/50">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Current Plan</div>
                  <div className="text-xl font-bold font-display">Scale Tier</div>
                  <div className="text-xs text-muted-foreground mt-1">$299 / month</div>
                </div>
                <div className="p-4 border rounded-lg bg-background/50">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Emails Sent</div>
                  <div className="text-xl font-bold font-display">4,281 <span className="text-xs text-muted-foreground font-normal">/ 10,000</span></div>
                  <div className="w-full bg-muted h-1 mt-3 rounded-full overflow-hidden">
                    <div className="bg-foreground h-full" style={{ width: '42%' }} />
                  </div>
                </div>
                <div className="p-4 border rounded-lg bg-background/50">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Next Invoice</div>
                  <div className="text-xl font-bold font-display">Oct 1, 2026</div>
                  <div className="text-xs text-muted-foreground mt-1">Visa ending in 4242</div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
