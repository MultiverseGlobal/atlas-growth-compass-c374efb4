import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Loader2, Plus, ExternalLink, Building2,
  Sparkles, Globe, Users, ChevronDown, CheckCircle, Zap, RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface DiscoveredLead {
  company: string;
  website: string;
  description: string;
  industry?: string;
  location?: string;
  team_size?: string;
  source: string;
  source_url?: string;
}

const SOURCES = [
  { id: "hn_jobs", label: "HN Who's Hiring", description: "Y Combinator Hacker News job posts", icon: "🔶" },
  { id: "yc_companies", label: "YC Directory", description: "Y Combinator funded companies", icon: "🚀" },
  { id: "starter_story", label: "Starter Story", description: "Indie founders with revenue", icon: "📖" },
  { id: "custom_url", label: "Custom URL", description: "Analyse any website or directory", icon: "🌐" },
];

const INDUSTRIES = ["Any", "Agency", "SaaS", "E-commerce", "Fintech", "Healthtech", "Marketing", "Real Estate", "Consulting"];

export default function HqDiscover() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [source, setSource] = useState("hn_jobs");
  const [industry, setIndustry] = useState("Any");
  const [customUrl, setCustomUrl] = useState("");
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<DiscoveredLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const handleDiscover = async () => {
    if (source === "custom_url" && !customUrl.trim()) {
      toast.error("Enter a URL to analyse");
      return;
    }
    setLoading(true);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("sourcing-machine", {
        body: {
          action: "discover-leads",
          source,
          industry: industry !== "Any" ? industry : undefined,
          keyword: keyword.trim() || undefined,
          custom_url: source === "custom_url" ? customUrl.trim() : undefined,
        },
      });

      if (error) throw new Error(error.message);
      const leads: DiscoveredLead[] = Array.isArray(data) ? data : (data?.leads ?? []);
      setResults(leads);
      if (leads.length === 0) toast.info("No matches found — try different filters");
    } catch (err: any) {
      toast.error("Discovery failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLead = async (lead: DiscoveredLead) => {
    if (!user) return;
    const key = lead.company + lead.website;
    setSaving((s) => ({ ...s, [key]: true }));
    try {
      // Check if already exists
      const { data: existing } = await supabase
        .from("pipeline_crm")
        .select("id")
        .eq("user_id", user.id)
        .ilike("company", lead.company)
        .maybeSingle();

      if (existing) {
        toast.info(`${lead.company} already in your leads`);
        setSaved((s) => new Set([...s, key]));
        return;
      }

      const { data: inserted, error } = await supabase.from("pipeline_crm").insert({
        user_id: user.id,
        company: lead.company,
        website: lead.website,
        notes: lead.description,
        source: lead.source,
        stage: "new",
        icp_score: 5,
        is_contacted: false,
      }).select("id").single();

      if (error) throw error;
      setSaved((s) => new Set([...s, key]));
      toast.success(`${lead.company} added — Lead Intelligence Engine running in background...`);

      // Fire auto-enrich pipeline asynchronously
      if (inserted?.id) {
        supabase.functions.invoke("sourcing-machine", {
          body: { action: "auto-enrich", lead_id: inserted.id, company: lead.company, website: lead.website },
        }).catch((e) => console.warn("Auto-enrich error:", e));
      }
    } catch (err: any) {
      toast.error("Failed to save: " + err.message);
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  };

  const handleSaveAll = async () => {
    const unsaved = results.filter((r) => !saved.has(r.company + r.website));
    for (const lead of unsaved) await handleSaveLead(lead);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold tracking-tight">Find Leads</h1>
            <p className="text-xs text-muted-foreground font-mono">Discover companies that match your ICP</p>
          </div>
          {results.length > 0 && (
            <Button onClick={handleSaveAll} size="sm" className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-3.5 w-3.5" /> Save all ({results.length - saved.size} left)
            </Button>
          )}
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Source selector */}
        <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Source</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SOURCES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSource(s.id)}
                className={`rounded-lg border p-3 text-left transition-all ${
                  source === s.id
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/60 bg-background hover:border-primary/30 hover:bg-muted/20"
                }`}
              >
                <div className="text-xl mb-1">{s.icon}</div>
                <div className="text-xs font-semibold">{s.label}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{s.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filters</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {source === "custom_url" ? (
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">URL to analyse</label>
                <Input
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://clutch.co/agencies/digital or any directory..."
                  className="h-9 text-sm border-border/60"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Industry</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full h-9 text-sm bg-background border border-border/60 rounded-lg px-3 focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground"
                >
                  {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Keyword (optional)</label>
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g. spreadsheets, onboarding, CRM..."
                className="h-9 text-sm border-border/60"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleDiscover}
                disabled={loading}
                className="h-9 w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {loading ? "Searching..." : "Find Companies"}
              </Button>
            </div>
          </div>
          {loading && (
            <p className="text-xs text-muted-foreground font-mono animate-pulse">
              Scanning {SOURCES.find((s2) => s2.id === source)?.label}...
            </p>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-mono">
                {results.length} companies found · {saved.size} saved
              </p>
              <Button variant="ghost" size="sm" onClick={handleDiscover} disabled={loading} className="h-7 text-xs gap-1">
                <RefreshCw className="h-3 w-3" /> Refresh
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {results.map((lead) => {
                const key = lead.company + lead.website;
                const isSaved = saved.has(key);
                const isSaving = saving[key];
                return (
                  <div
                    key={key}
                    className={`rounded-xl border bg-card p-4 space-y-3 transition-all ${isSaved ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/60 hover:border-primary/30"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <Building2 className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">{lead.company}</div>
                            {lead.website && (
                              <a href={lead.website} target="_blank" rel="noreferrer" className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                                {lead.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {lead.website && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/hq/leads?research=${encodeURIComponent(lead.website!)}`)}
                            className="h-7 text-[11px] text-muted-foreground hover:text-primary px-2"
                          >
                            Research
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => handleSaveLead(lead)}
                          disabled={isSaved || isSaving}
                          className={`h-7 text-[11px] px-3 gap-1 ${isSaved ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"}`}
                        >
                          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : isSaved ? <CheckCircle className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                          {isSaved ? "Saved" : "Add"}
                        </Button>
                      </div>
                    </div>

                    {lead.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{lead.description}</p>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                      {lead.industry && <span className="px-1.5 py-0.5 rounded bg-muted/30">{lead.industry}</span>}
                      {lead.team_size && <span className="flex items-center gap-1"><Users className="h-2.5 w-2.5" />{lead.team_size}</span>}
                      {lead.location && <span><Globe className="h-2.5 w-2.5 inline mr-1" />{lead.location}</span>}
                      <span className="ml-auto opacity-60">{lead.source}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && results.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/40 p-12 text-center space-y-3">
            <Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm font-medium text-muted-foreground">Choose a source and hit Find Companies</p>
            <p className="text-xs text-muted-foreground/60 max-w-xs mx-auto">
              Atlas will search the source and return companies that match your filters — ready to add to your lead database.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
