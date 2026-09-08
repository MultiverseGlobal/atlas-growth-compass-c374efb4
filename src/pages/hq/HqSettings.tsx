import { useState, useEffect } from "react";
import { 
  Settings, Key, Users, Building2, Save, Globe, Lock, Mail, AtSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function HqSettings() {
  const { user } = useAuth();
  const [openAiKey, setOpenAiKey] = useState("");
  const [apolloKey, setApolloKey] = useState("");
  const [workspaceName, setWorkspaceName] = useState("Multiverse Global");
  const [domain, setDomain] = useState("multiverse.global");
  const [loading, setLoading] = useState(true);
  // Outreach delivery settings
  const [resendKey, setResendKey] = useState("");
  const [senderName, setSenderName] = useState("Atlas");
  const [senderEmail, setSenderEmail] = useState("");
  // Proxy settings (BrightData)
  const [proxyUrl, setProxyUrl] = useState("");
  const [proxyAuth, setProxyAuth] = useState("");
  
  useEffect(() => {
    async function loadSettings() {
      if (!user) return;
      setLoading(true);
      const { data } = await supabase
        .from('atlas_user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (data) {
        setOpenAiKey(data.openai_api_key || "");
        setApolloKey(data.apollo_api_key || "");
        setResendKey(data.resend_api_key || "");
        setSenderName(data.sender_name || "Atlas");
        setSenderEmail(data.sender_email || "");
        setProxyUrl(data.proxy_url || "");
        setProxyAuth(data.proxy_auth || "");
      }
      setLoading(false);
    }
    loadSettings();
  }, [user]);

  const handleSave = async (section: string) => {
    if (!user) return;

    const base = {
      user_id: user.id,
      openai_api_key: openAiKey,
      apollo_api_key: apolloKey,
      resend_api_key: resendKey,
      sender_name: senderName,
      sender_email: senderEmail,
      proxy_url: proxyUrl || null,
      proxy_auth: proxyAuth || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('atlas_user_settings')
      .upsert(base);

    if (error) {
      toast.error(`Failed to save ${section} settings: ${error.message}`);
      return;
    }
    toast.success(`${section} settings saved.`);
  };

  return (
    <div className="pt-[72px] px-8 pb-8 bg-background grain min-h-screen text-foreground overflow-y-auto">
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
          <TabsList className="grid w-full grid-cols-4 max-w-[520px] mb-8 bg-card border border-border/40 h-10 p-1">
            <TabsTrigger value="workspace" className="text-xs font-semibold">Workspace</TabsTrigger>
            <TabsTrigger value="api-keys" className="text-xs font-semibold">API Keys</TabsTrigger>
            <TabsTrigger value="outreach" className="text-xs font-semibold">Outreach</TabsTrigger>
            <TabsTrigger value="team" className="text-xs font-semibold">Team Access</TabsTrigger>
          </TabsList>

          <TabsContent value="workspace" className="space-y-6">
            <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-xl p-6 shadow-sm space-y-6">
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
            <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-xl p-6 shadow-sm space-y-6">
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
                    <Button variant="outline" onClick={() => handleSave("Apollo")} className="h-10 px-4">Save</Button>
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
                    <Button variant="outline" onClick={() => handleSave("OpenAI")} className="h-10 px-4">Save</Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── Outreach & Proxy Tab ─────────────────────────────────────── */}
          <TabsContent value="outreach" className="space-y-6">
            {/* Resend / Sender */}
            <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-xl p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-border/40 pb-4">
                <div className="h-10 w-10 rounded-lg bg-foreground text-background flex items-center justify-center">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold tracking-tight">Outreach Delivery</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Resend API key and sender identity for automated email sends.</p>
                </div>
              </div>
              <div className="space-y-4 max-w-xl">
                <div className="space-y-2 p-4 border border-border/60 rounded-lg bg-background/50">
                  <div className="flex justify-between items-end mb-1">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-foreground">Resend API Key</Label>
                    <span className="text-[9px] uppercase font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">Email Delivery</span>
                  </div>
                  <Input
                    type="password"
                    value={resendKey}
                    onChange={(e) => setResendKey(e.target.value)}
                    placeholder="re_..."
                    className="font-mono text-xs bg-background border-border/60 h-10"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2 p-4 border border-border/60 rounded-lg bg-background/50">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <AtSign className="w-3 h-3" /> Sender Name
                    </Label>
                    <Input
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Atlas"
                      className="font-mono text-xs bg-background border-border/60 h-10"
                    />
                  </div>
                  <div className="space-y-2 p-4 border border-border/60 rounded-lg bg-background/50">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <Mail className="w-3 h-3" /> Sender Email
                    </Label>
                    <Input
                      type="email"
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      placeholder="you@yourdomain.com"
                      className="font-mono text-xs bg-background border-border/60 h-10"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* BrightData Proxy */}
            <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-xl p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-border/40 pb-4">
                <div className="h-10 w-10 rounded-lg bg-foreground text-background flex items-center justify-center">
                  <Globe className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold tracking-tight">BrightData Proxy</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Route sourcing requests through a residential proxy to bypass rate limits.</p>
                </div>
              </div>
              <div className="space-y-4 max-w-xl">
                <div className="space-y-2 p-4 border border-border/60 rounded-lg bg-background/50">
                  <div className="flex justify-between items-end mb-1">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <Globe className="w-3 h-3" /> Proxy Gateway URL
                    </Label>
                    <span className="text-[9px] uppercase font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">BrightData</span>
                  </div>
                  <Input
                    value={proxyUrl}
                    onChange={(e) => setProxyUrl(e.target.value)}
                    placeholder="http://zproxy.lum-superproxy.io:22225"
                    className="font-mono text-xs bg-background border-border/60 h-10"
                  />
                </div>
                <div className="space-y-2 p-4 border border-border/60 rounded-lg bg-background/50">
                  <div className="flex justify-between items-end mb-1">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <Lock className="w-3 h-3" /> Proxy Credentials
                    </Label>
                    <span className="text-[9px] uppercase font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">user:password</span>
                  </div>
                  <Input
                    type="password"
                    value={proxyAuth}
                    onChange={(e) => setProxyAuth(e.target.value)}
                    placeholder="brd-customer-xxx-zone-yyy:password"
                    className="font-mono text-xs bg-background border-border/60 h-10"
                  />
                  <p className="text-[10px] text-muted-foreground font-mono mt-1">Format: <span className="text-foreground/70">brd-customer-&#x3C;id&#x3E;-zone-&#x3C;zone&#x3E;:&#x3C;password&#x3E;</span></p>
                </div>
              </div>
              <div className="pt-2">
                <Button onClick={() => handleSave("Outreach & Proxy")} className="h-9 bg-foreground text-background gap-2 text-xs font-semibold px-6">
                  <Save className="w-3.5 h-3.5" /> Save Outreach & Proxy Settings
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="team" className="space-y-6">
            <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-xl p-6 shadow-sm">
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
