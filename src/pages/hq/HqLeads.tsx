import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus, Search, X, ExternalLink, Loader2, Brain,
  Building2, Globe, ChevronRight, Filter, RefreshCw, FileUp
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Lead {
  id: string;
  company: string;
  website: string | null;
  stage: string;
  icp_score: number;
  is_contacted: boolean;
  source: string | null;
  notes: string | null;
  created_at: string;
  research_data?: any;
  has_research?: boolean;
}

const STAGES = ["all", "new", "researched", "contacted", "interested", "proposal_sent", "won", "lost"];

function stageBadge(stage: string) {
  const map: Record<string, string> = {
    new: "bg-muted/60 text-muted-foreground border-border/40",
    researched: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    contacted: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    interested: "bg-primary/10 text-primary border-primary/20",
    proposal_sent: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    won: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    lost: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return map[stage] ?? "bg-muted/60 text-muted-foreground border-border/40";
}

function stageLabel(s: string) {
  const map: Record<string, string> = {
    new: "New",
    researched: "Researched",
    contacted: "Contacted",
    interested: "Interested",
    proposal_sent: "Proposal",
    won: "Won ✓",
    lost: "Lost",
  };
  return map[s] ?? s;
}

function IcpDot({ score }: { score: number }) {
  const color = score >= 8 ? "bg-emerald-400" : score >= 6 ? "bg-amber-400" : "bg-muted-foreground/50";
  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-2 w-2 rounded-full ${color}`} />
      <span className="text-xs font-mono text-muted-foreground">{score}/10</span>
    </div>
  );
}

export default function HqLeads() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [filtered, setFiltered] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [researchingId, setResearchingId] = useState<string | null>(null);

  // New lead form
  const [showAdd, setShowAdd] = useState(searchParams.get("new") === "1");
  const [newName, setNewName] = useState("");
  const [newWebsite, setNewWebsite] = useState("");
  const [addingLead, setAddingLead] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showAdd) setTimeout(() => nameInputRef.current?.focus(), 100);
  }, [showAdd]);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    let leadsList: any[] = [];

    if (user) {
      try {
        const { data, error } = await supabase
          .from("kuro_pipeline_view" as any)
          .select("id, company, website, stage, icp_score, is_contacted, source, notes, created_at, research_data")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (!error && data) leadsList = data;
      } catch {}
    }

    if (leadsList.length === 0) {
      try {
        const savedLeads = JSON.parse(localStorage.getItem("atlas_autonomous_leads") || "[]");
        const savedDeals = JSON.parse(localStorage.getItem("atlas_deals") || "[]");
        const dealsMap: Record<string, any> = {};
        savedDeals.forEach((d: any) => { dealsMap[d.company_id] = d; });

        leadsList = savedLeads.map((l: any) => ({
          id: l.id,
          company: l.company,
          website: l.website,
          stage: l.status === 'approved' ? 'contacted' : 'new',
          icp_score: l.icp_score || 90,
          is_contacted: l.status === 'approved',
          source: 'autonomous_sourcing',
          notes: l.bottleneck?.observation || '',
          created_at: new Date().toISOString(),
          research_data: l,
        }));
      } catch {}
    }

    const mapped = leadsList.map((l: any) => ({
      ...l,
      has_research: !!l.research_data && Object.keys(l.research_data ?? {}).length > 0,
    }));
    setLeads(mapped);
    setFiltered(mapped);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  useEffect(() => {
    if (showAdd) {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [showAdd]);

  // Filter on query or stage change
  useEffect(() => {
    let result = leads;
    if (stageFilter !== "all") result = result.filter((l) => l.stage === stageFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (l) =>
          l.company.toLowerCase().includes(q) ||
          (l.website ?? "").toLowerCase().includes(q) ||
          (l.notes ?? "").toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [query, stageFilter, leads]);

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !user) return;
    setAddingLead(true);
    try {
      const { data, error } = await supabase.from("kuro_pipeline_view").insert({
        user_id: user.id,
        prospect: newName.trim(),
        company: newName.trim(),
        website: newWebsite.trim() || "https://unknown.com",
        founder_thesis: "Dream 100 ICP #1 Marketing Agency",
        stage: "new",
        icp_score: 5,
        is_contacted: false,
        source: "manual",
      }).select().single();
      if (error) throw error;
      toast.success(`${newName} added — Lead Intelligence Engine running...`);
      setNewName("");
      setNewWebsite("");
      setShowAdd(false);
      setSearchParams({});
      await loadLeads();

      // Fire auto-enrich in background
      if (data?.id) {
        supabase.functions.invoke("sourcing-machine", {
          body: { action: "auto-enrich", lead_id: data.id, company: data.company, website: data.website },
        }).catch((e) => console.warn("Auto-enrich error:", e));

        // Auto-push to Notion if configured
        const autoNotion = localStorage.getItem("atlas.sourcing.auto_notion") === "true";
        const defaultDbId = localStorage.getItem("atlas.sourcing.default_notion_db");
        if (autoNotion && defaultDbId) {
          supabase.functions.invoke("sourcing-machine", {
            body: {
              action: "export-notion",
              database_id: defaultDbId,
              lead: {
                id: data.id,
                prospect: data.company,
                company: data.company,
                website: data.website || "https://unknown.com",
                source: "manual",
                stage: "new",
                icp_score: 5,
                founder_thesis: "Dream 100 ICP #1 Marketing Agency",
              }
            }
          }).then(() => toast.success(`Pushed ${data.company} to Notion!`))
            .catch((e) => console.warn("Notion auto-export error:", e));
        }

        navigate(`/hq/leads/${data.id}`);
      }
    } catch (err: any) {
      toast.error("Failed to add lead: " + err.message);
    } finally {
      setAddingLead(false);
    }
  };

  const handleResearch = async (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lead.website) {
      toast.error("Add a website URL first to research this company");
      return;
    }
    setResearchingId(lead.id);
    try {
      const { data, error } = await supabase.functions.invoke("sourcing-machine", {
        body: { action: "source", url: lead.website },
      });
      if (error) throw new Error(error.message);
      if (!data) throw new Error("No data returned");

      // Save research data back
      await supabase.from("kuro_pipeline_view").update({
        research_data: data,
        stage: lead.stage === "new" ? "researched" : lead.stage,
      }).eq("id", lead.id);

      toast.success(`Research complete for ${lead.company}`);
      await loadLeads();
    } catch (err: any) {
      toast.error("Research failed: " + err.message);
    } finally {
      setResearchingId(null);
    }
  };

  const counts = leads.reduce((acc, l) => {
    acc[l.stage] = (acc[l.stage] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-sm px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-sm font-semibold">Lead Database</h1>
            <p className="text-xs text-muted-foreground font-mono">{leads.length} companies tracked</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadLeads()}
              className="h-8 w-8 p-0 border-border/60"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              onClick={() => { setShowAdd(true); setSearchParams({ new: "1" }); }}
              className="h-8 bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Add Lead
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5 max-w-7xl mx-auto">
        {/* Quick-add form */}
        {showAdd && (
          <form
            onSubmit={handleAddLead}
            className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Add New Lead</h2>
              <button type="button" onClick={() => { setShowAdd(false); setSearchParams({}); }}>
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Company Name *</label>
                <Input
                  ref={nameInputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. BrightHire Agency"
                  className="h-9 text-sm bg-background border-border/60"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Website (for research)</label>
                <Input
                  value={newWebsite}
                  onChange={(e) => setNewWebsite(e.target.value)}
                  placeholder="https://..."
                  type="url"
                  className="h-9 text-sm bg-background border-border/60"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={addingLead || !newName.trim()} className="h-8 bg-primary text-primary-foreground">
                {addingLead ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add Lead
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8 border-border/60" onClick={() => { setShowAdd(false); setSearchParams({}); }}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search companies, notes..."
              className="pl-9 h-9 text-sm bg-background border-border/60"
            />
            {query && (
              <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setQuery("")}>
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {STAGES.map((s) => (
              <button
                key={s}
                onClick={() => setStageFilter(s)}
                className={`shrink-0 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  stageFilter === s
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border/70"
                }`}
              >
                {s === "all" ? `All (${leads.length})` : `${stageLabel(s)} ${counts[s] ? `(${counts[s]})` : ""}`}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground flex flex-col items-center">
            <Building2 className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">{query || stageFilter !== "all" ? "No leads match your filter" : "No leads yet"}</p>
            <p className="text-xs mt-1 opacity-70 mb-4">
              {leads.length === 0 ? "Add your first company to get started" : "Try adjusting your search or filter"}
            </p>
            {leads.length === 0 && (
              <Button size="sm" onClick={() => navigate('/hq/discover')} className="h-8 gap-2">
                <Search className="h-3.5 w-3.5" />
                Discover Leads
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-2.5 bg-muted/20 border-b border-border/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <span>Company</span>
              <span className="hidden sm:block">Stage</span>
              <span className="hidden md:block">ICP Score</span>
              <span className="hidden lg:block">Added</span>
              <span>Actions</span>
            </div>
            {/* Rows */}
            <div className="divide-y divide-border/30">
              {filtered.map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => navigate(`/hq/leads/${lead.id}`)}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-3 hover:bg-muted/20 cursor-pointer transition-colors group items-center"
                >
                  {/* Company */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-muted/40 border border-border/40 flex items-center justify-center shrink-0">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{lead.company}</div>
                      {lead.website && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Globe className="h-2.5 w-2.5" />
                          <span className="truncate">{lead.website.replace(/^https?:\/\//, "")}</span>
                        </div>
                      )}
                    </div>
                    {lead.has_research && (
                      <div className="shrink-0 h-5 w-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center" title="Research available">
                        <Brain className="h-2.5 w-2.5 text-primary" />
                      </div>
                    )}
                  </div>
                  {/* Stage */}
                  <div className="hidden sm:flex">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${stageBadge(lead.stage)}`}>
                      {stageLabel(lead.stage)}
                    </span>
                  </div>
                  {/* ICP Score */}
                  <div className="hidden md:flex">
                    <IcpDot score={lead.icp_score ?? 5} />
                  </div>
                  {/* Added */}
                  <div className="hidden lg:block text-xs text-muted-foreground font-mono">
                    {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleResearch(lead, e)}
                      disabled={researchingId === lead.id}
                      className="h-7 px-2 border-border/50 hover:border-primary/50 hover:text-primary text-xs gap-1"
                      title={lead.website ? "Research this company" : "Add website to research"}
                    >
                      {researchingId === lead.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Brain className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/hq/leads/${lead.id}`)}
                      className="h-7 w-7 p-0"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
