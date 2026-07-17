import { useState, useEffect } from "react";
import { 
  Target, Loader2, Plus, Search, Trash2, ExternalLink, 
  FileSpreadsheet, Link2, Check, X, Edit2, CheckSquare, 
  Square, RefreshCw, AlertCircle, HelpCircle, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Dialog, DialogContent, DialogDescription, 
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Lead {
  id: string;
  company_name: string;
  founder_name: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  employee_count: number | null;
  is_b2b_saas: boolean;
  icp_score: number | null;
  is_contacted: boolean;
  reply_status: string;
  product_hunt_url: string | null;
  notes: string | null;
  created_at: string;
}

interface NotionDatabase {
  id: string;
  title: string;
  url: string;
}

export default function Sourcing() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [urlInput, setUrlInput] = useState("");
  const [sourcing, setSourcing] = useState(false);
  const [sourcingStep, setSourcingStep] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [saasFilter, setSaasFilter] = useState("all"); // all, saas, non-saas
  
  // Manual add form state
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualCompany, setManualCompany] = useState("");
  const [manualFounder, setManualFounder] = useState("");
  const [manualLinkedin, setManualLinkedin] = useState("");
  const [manualTwitter, setManualTwitter] = useState("");
  const [manualEmployees, setManualEmployees] = useState("5");
  const [manualB2b, setManualB2b] = useState(true);
  const [manualIcp, setManualIcp] = useState("8");
  const [manualNotes, setManualNotes] = useState("");
  const [manualUrl, setManualUrl] = useState("");

  // Edit notes state
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [editingNotesText, setEditingNotesText] = useState("");

  // Export Notion Modal State
  const [showNotionModal, setShowNotionModal] = useState(false);
  const [notionLoading, setNotionLoading] = useState(false);
  const [notionDatabases, setNotionDatabases] = useState<NotionDatabase[]>([]);
  const [selectedNotionDb, setSelectedNotionDb] = useState("");
  const [exportingLead, setExportingLead] = useState<Lead | null>(null);

  // Export Airtable Modal State
  const [showAirtableModal, setShowAirtableModal] = useState(false);
  const [airtableLoading, setAirtableLoading] = useState(false);
  const [airtablePat, setAirtablePat] = useState(() => localStorage.getItem("atlas.airtable.pat") || "");
  const [airtableBaseId, setAirtableBaseId] = useState(() => localStorage.getItem("atlas.airtable.base_id") || "");
  const [airtableTableName, setAirtableTableName] = useState(() => localStorage.getItem("atlas.airtable.table_name") || "");

  // Load leads from database
  const fetchLeads = async () => {
    setLoadingLeads(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (err: any) {
      toast.error("Failed to load prospects: " + err.message);
    } finally {
      setLoadingLeads(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  // Sourcing pipeline execution
  const handleSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    let targetUrl = urlInput.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = "https://" + targetUrl;
    }

    setSourcing(true);
    setUrlInput("");
    
    // Simulate steps in UI for beautiful UX
    setSourcingStep(1); // Scrape URL
    
    const stepInterval = setInterval(() => {
      setSourcingStep(prev => {
        if (prev < 3) return prev + 1;
        return prev;
      });
    }, 2800);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error("Session expired. Please log in again.");
      }

      const supabaseUrl = (supabase as any).supabaseUrl as string;
      const response = await fetch(`${supabaseUrl}/functions/v1/sourcing-machine`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "source",
          url: targetUrl
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "Sourcing failed" }));
        throw new Error(body.error ?? "Failed to source lead");
      }

      const newLead = await response.json();
      setLeads(prev => [newLead, ...prev]);
      toast.success(`Successfully sourced ${newLead.company_name}!`);
    } catch (err: any) {
      toast.error("Sourcing failed: " + err.message);
    } finally {
      clearInterval(stepInterval);
      setSourcing(false);
      setSourcingStep(0);
    }
  };

  // Add lead manually
  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCompany.trim()) {
      toast.error("Company name is required");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");

      const { data, error } = await supabase
        .from("leads")
        .insert({
          user_id: user.id,
          company_name: manualCompany.trim(),
          founder_name: manualFounder.trim() || null,
          linkedin_url: manualLinkedin.trim() || null,
          twitter_url: manualTwitter.trim() || null,
          employee_count: parseInt(manualEmployees) || null,
          is_b2b_saas: manualB2b,
          icp_score: parseInt(manualIcp) || null,
          product_hunt_url: manualUrl.trim() || null,
          notes: manualNotes.trim() || null
        })
        .select()
        .single();

      if (error) throw error;
      setLeads(prev => [data, ...prev]);
      toast.success(`Manually added ${data.company_name}`);
      setShowManualModal(false);
      
      // Clear form
      setManualCompany("");
      setManualFounder("");
      setManualLinkedin("");
      setManualTwitter("");
      setManualEmployees("5");
      setManualB2b(true);
      setManualIcp("8");
      setManualNotes("");
      setManualUrl("");
    } catch (err: any) {
      toast.error("Failed to add lead: " + err.message);
    }
  };

  // Toggle Contacted
  const toggleContacted = async (leadId: string, currentVal: boolean) => {
    const nextVal = !currentVal;
    
    // Optimistic UI update
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, is_contacted: nextVal } : l));
    
    try {
      const { error } = await supabase
        .from("leads")
        .update({ is_contacted: nextVal })
        .eq("id", leadId);

      if (error) throw error;
      toast.success(nextVal ? "Marked as contacted" : "Marked as uncontacted");
    } catch (err: any) {
      // Revert UI on error
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, is_contacted: currentVal } : l));
      toast.error("Failed to update status: " + err.message);
    }
  };

  // Update Reply Status
  const handleUpdateReplyStatus = async (leadId: string, nextStatus: string) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, reply_status: nextStatus } : l));
    try {
      const { error } = await supabase
        .from("leads")
        .update({ reply_status: nextStatus })
        .eq("id", leadId);

      if (error) throw error;
      toast.success("Reply status updated");
    } catch (err: any) {
      fetchLeads(); // Reset list on error
      toast.error("Failed to update reply: " + err.message);
    }
  };

  // Inline Note Save
  const saveInlineNotes = async (leadId: string) => {
    setEditingNotesId(null);
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, notes: editingNotesText.trim() || null } : l));
    
    try {
      const { error } = await supabase
        .from("leads")
        .update({ notes: editingNotesText.trim() || null })
        .eq("id", leadId);

      if (error) throw error;
      toast.success("Notes updated");
    } catch (err: any) {
      fetchLeads();
      toast.error("Failed to update notes: " + err.message);
    }
  };

  // Delete lead
  const handleDeleteLead = async (leadId: string, companyName: string) => {
    if (!confirm(`Are you sure you want to delete ${companyName}?`)) return;

    // Optimistic UI update
    setLeads(prev => prev.filter(l => l.id !== leadId));

    try {
      const { error } = await supabase
        .from("leads")
        .delete()
        .eq("id", leadId);

      if (error) throw error;
      toast.success("Prospect removed from pipeline");
    } catch (err: any) {
      fetchLeads();
      toast.error("Failed to delete lead: " + err.message);
    }
  };

  // Export Notion DB List
  const fetchNotionDatabases = async (lead: Lead) => {
    setExportingLead(lead);
    setShowNotionModal(true);
    setNotionLoading(true);
    setNotionDatabases([]);
    setSelectedNotionDb("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Unauthorized");

      const supabaseUrl = (supabase as any).supabaseUrl as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/sourcing-machine`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "list-notion-databases" })
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to fetch databases");

      setNotionDatabases(body.databases || []);
      if (body.databases?.length > 0) {
        setSelectedNotionDb(body.databases[0].id);
      }
    } catch (err: any) {
      toast.error("Notion databases load error: " + err.message);
      setShowNotionModal(false);
    } finally {
      setNotionLoading(false);
    }
  };

  // Export to Notion DB row
  const exportToNotion = async () => {
    if (!exportingLead || !selectedNotionDb) return;
    setNotionLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Unauthorized");

      const supabaseUrl = (supabase as any).supabaseUrl as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/sourcing-machine`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "export-notion",
          lead: exportingLead,
          database_id: selectedNotionDb
        })
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Export failed");

      toast.success("Successfully exported to Notion! 🚀");
      setShowNotionModal(false);
    } catch (err: any) {
      toast.error("Notion export failed: " + err.message);
    } finally {
      setNotionLoading(false);
    }
  };

  // Export Airtable trigger
  const exportToAirtable = async (lead: Lead) => {
    if (!airtablePat || !airtableBaseId || !airtableTableName) {
      setExportingLead(lead);
      setShowAirtableModal(true);
      return;
    }

    toast.loading("Exporting to Airtable...");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Unauthorized");

      const supabaseUrl = (supabase as any).supabaseUrl as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/sourcing-machine`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "export-airtable",
          lead,
          airtable_pat: airtablePat,
          base_id: airtableBaseId,
          table_name: airtableTableName
        })
      });

      const body = await res.json();
      toast.dismiss();

      if (!res.ok) throw new Error(body.error ?? "Airtable export failed");
      toast.success("Successfully exported to Airtable! 📊");
    } catch (err: any) {
      toast.dismiss();
      toast.error("Airtable export failed: " + err.message);
    }
  };

  // Save Airtable Credentials and run export
  const saveAirtableAndExport = async () => {
    if (!airtablePat || !airtableBaseId || !airtableTableName) {
      toast.error("Please fill in all Airtable credentials");
      return;
    }

    localStorage.setItem("atlas.airtable.pat", airtablePat);
    localStorage.setItem("atlas.airtable.base_id", airtableBaseId);
    localStorage.setItem("atlas.airtable.table_name", airtableTableName);
    
    setShowAirtableModal(false);
    
    if (exportingLead) {
      await exportToAirtable(exportingLead);
      setExportingLead(null);
    } else {
      toast.success("Airtable configurations saved!");
    }
  };

  // Download all leads as CSV
  const downloadCSV = () => {
    if (leads.length === 0) {
      toast.error("No leads to download");
      return;
    }

    const headers = [
      "Company Name", "Founder Name", "LinkedIn URL", "Twitter Handle", 
      "Employee Count", "B2B SaaS", "ICP Score", "Contacted", "Reply Status", "Source URL", "Notes", "Created At"
    ];

    const rows = leads.map(l => [
      l.company_name,
      l.founder_name || "",
      l.linkedin_url || "",
      l.twitter_url || "",
      l.employee_count ?? "",
      l.is_b2b_saas ? "TRUE" : "FALSE",
      l.icp_score ?? "",
      l.is_contacted ? "TRUE" : "FALSE",
      l.reply_status,
      l.product_hunt_url || "",
      l.notes || "",
      new Date(l.created_at).toLocaleDateString()
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `atlas_hq_leads_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV Sourced leads downloaded");
  };

  // Get ICP badge color classes
  const getIcpBadgeClass = (score: number | null) => {
    if (score === null) return "bg-muted text-muted-foreground border-transparent";
    if (score >= 9) return "bg-emerald-500/10 text-emerald-600 border-emerald-500/25";
    if (score >= 7) return "bg-amber-500/10 text-amber-600 border-amber-500/25";
    return "bg-rose-500/10 text-rose-600 border-rose-500/25";
  };

  // Filters logic
  const filteredLeads = leads.filter(l => {
    const searchLower = searchQuery.toLowerCase();
    const matchSearch = 
      l.company_name.toLowerCase().includes(searchLower) ||
      (l.founder_name || "").toLowerCase().includes(searchLower) ||
      (l.notes || "").toLowerCase().includes(searchLower);
      
    const matchSaas = 
      saasFilter === "all" ? true :
      saasFilter === "saas" ? l.is_b2b_saas : !l.is_b2b_saas;

    return matchSearch && matchSaas;
  });

  return (
    <div className="relative page-hero mx-auto max-w-6xl px-4 py-8 md:px-8">
      {/* ── Heading ── */}
      <div className="flex items-center gap-2 eyebrow text-primary">
        <Target className="h-3.5 w-3.5" /> Atlas HQ
      </div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-3">
        <div>
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-foreground">
            Outreach Pipeline
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground max-w-xl">
            Automate founder acquisition. Paste any URL to find LinkedIn profiles, check B2B SaaS status, evaluate team size, and score leads using Kimi AI.
          </p>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              setExportingLead(null);
              setShowAirtableModal(true);
            }}
            className="text-xs h-9"
          >
            Airtable Settings
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={downloadCSV}
            className="text-xs h-9 gap-1.5"
            disabled={leads.length === 0}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button 
            onClick={() => setShowManualModal(true)}
            size="sm" 
            className="text-xs h-9 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Add Lead
          </Button>
        </div>
      </div>

      {/* ── Sourcing URL Input Card ── */}
      <div className="mt-8 rounded-lg border border-border/60 bg-card p-6 shadow-sm">
        <form onSubmit={handleSource} className="flex gap-2.5 max-w-3xl">
          <div className="relative flex-1">
            <Input
              type="text"
              placeholder="Paste launch URL or landing page (e.g. producthunt.com/posts/... or example.com)"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              disabled={sourcing}
              className="pr-10 h-11 bg-background text-sm"
            />
          </div>
          <Button type="submit" size="lg" disabled={sourcing || !urlInput.trim()} className="h-11 px-5 gap-1.5 font-medium shrink-0">
            {sourcing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sourcing...
              </>
            ) : (
              <>
                Analyze Lead
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        {/* ── Progressive Loading UX ── */}
        {sourcing && (
          <div className="mt-6 border-t border-border/40 pt-5 space-y-3.5 max-w-xl">
            <div className="text-xs text-muted-foreground/80 font-mono tracking-wider uppercase mb-1">
              Active Pipeline Status:
            </div>
            <div className="flex items-center gap-3 text-sm">
              {sourcingStep >= 1 ? (
                sourcingStep > 1 ? <Check className="h-4 w-4 text-emerald-500 shrink-0" /> : <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
              ) : <div className="h-4 w-4 rounded-full border border-muted shrink-0" />}
              <span className={sourcingStep === 1 ? "font-medium text-foreground" : "text-muted-foreground"}>
                1. Crawling target URL & extracting page body...
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              {sourcingStep >= 2 ? (
                sourcingStep > 2 ? <Check className="h-4 w-4 text-emerald-500 shrink-0" /> : <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
              ) : <div className="h-4 w-4 rounded-full border border-muted shrink-0" />}
              <span className={sourcingStep === 2 ? "font-medium text-foreground" : "text-muted-foreground"}>
                2. Sourcing founder identities via Kimi AI...
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              {sourcingStep >= 3 ? (
                sourcingStep > 3 ? <Check className="h-4 w-4 text-emerald-500 shrink-0" /> : <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
              ) : <div className="h-4 w-4 rounded-full border border-muted shrink-0" />}
              <span className={sourcingStep === 3 ? "font-medium text-foreground" : "text-muted-foreground"}>
                3. Inspecting B2B SaaS credentials & scoring ICP index...
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              {sourcingStep >= 4 ? (
                <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
              ) : <div className="h-4 w-4 rounded-full border border-muted shrink-0" />}
              <span className={sourcingStep === 4 ? "font-medium text-foreground" : "text-muted-foreground"}>
                4. Appending records to public.leads table...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Filters and Controls Bar ── */}
      <div className="mt-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
            <Input
              placeholder="Search leads by company, founder, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs bg-card"
            />
          </div>
          <Select value={saasFilter} onValueChange={setSaasFilter}>
            <SelectTrigger className="w-full sm:w-[150px] h-9 text-xs bg-card">
              <SelectValue placeholder="B2B SaaS" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Models</SelectItem>
              <SelectItem value="saas">B2B SaaS</SelectItem>
              <SelectItem value="non-saas">Consumer/Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0 self-end md:self-center">
          <span>Showing <strong>{filteredLeads.length}</strong> of <strong>{leads.length}</strong> sourced accounts</span>
          <button onClick={fetchLeads} className="p-1 text-muted-foreground/60 hover:text-foreground transition-colors" title="Refresh leads list">
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* ── Sourced Leads Table ── */}
      <div className="mt-4 overflow-hidden rounded-lg border border-border/50 bg-card shadow-sm">
        {loadingLeads ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 text-sm">Synchronizing pipeline CRM...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Target className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold">No prospects sourced</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
              Analyze startup landing pages above, or add manual items to seed your outreach schedule.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[180px] font-mono text-[10px] tracking-wider uppercase py-3">Company</TableHead>
                <TableHead className="w-[160px] font-mono text-[10px] tracking-wider uppercase py-3">Founder</TableHead>
                <TableHead className="w-[80px] text-center font-mono text-[10px] tracking-wider uppercase py-3">Socials</TableHead>
                <TableHead className="w-[90px] text-center font-mono text-[10px] tracking-wider uppercase py-3">ICP Score</TableHead>
                <TableHead className="w-[90px] text-center font-mono text-[10px] tracking-wider uppercase py-3">Contacted</TableHead>
                <TableHead className="w-[120px] font-mono text-[10px] tracking-wider uppercase py-3">Reply Status</TableHead>
                <TableHead className="font-mono text-[10px] tracking-wider uppercase py-3">Outreach Notes / Strategy</TableHead>
                <TableHead className="w-[120px] text-right font-mono text-[10px] tracking-wider uppercase py-3">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => {
                const parsedDomain = lead.product_hunt_url ? 
                  (() => {
                    try {
                      return new URL(lead.product_hunt_url).hostname.replace("www.", "");
                    } catch (_) { return ""; }
                  })() : "";

                return (
                  <TableRow key={lead.id} className="hover:bg-muted/10 transition-colors">
                    {/* Company */}
                    <TableCell className="font-medium align-middle">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-foreground leading-normal">{lead.company_name}</span>
                        {parsedDomain && (
                          <a 
                            href={lead.product_hunt_url!} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-[11px] font-mono text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5"
                          >
                            {parsedDomain}
                            <ExternalLink className="h-2.5 w-2.5 inline" />
                          </a>
                        )}
                      </div>
                    </TableCell>

                    {/* Founder & Team size */}
                    <TableCell className="align-middle">
                      <div className="flex flex-col">
                        <span className="text-sm text-foreground">{lead.founder_name || "Unknown"}</span>
                        <span className="text-[11px] text-muted-foreground mt-0.5">
                          {lead.employee_count ? `${lead.employee_count} employees` : "Size untracked"}
                          {lead.is_b2b_saas && <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 border-primary/20 text-primary bg-primary/5">SaaS</Badge>}
                        </span>
                      </div>
                    </TableCell>

                    {/* Socials links */}
                    <TableCell className="align-middle text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {lead.linkedin_url ? (
                          <a 
                            href={lead.linkedin_url} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="p-1 rounded bg-secondary hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground"
                            title="LinkedIn profile"
                          >
                            <Link2 className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/40 font-mono" title="No LinkedIn URL found">-</span>
                        )}
                        {lead.twitter_url ? (
                          <a 
                            href={`https://x.com/${lead.twitter_url.replace("@", "")}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="p-1 rounded bg-secondary hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground"
                            title={`Twitter/X profile: ${lead.twitter_url}`}
                          >
                            <span className="text-[10px] font-bold font-mono">X</span>
                          </a>
                        ) : null}
                      </div>
                    </TableCell>

                    {/* ICP Score */}
                    <TableCell className="align-middle text-center">
                      <Badge variant="outline" className={`font-mono text-xs font-semibold px-2 py-0.5 border ${getIcpBadgeClass(lead.icp_score)}`}>
                        {lead.icp_score ? `${lead.icp_score}/10` : "TBD"}
                      </Badge>
                    </TableCell>

                    {/* Contacted checkbox */}
                    <TableCell className="align-middle text-center">
                      <div className="flex items-center justify-center">
                        <button 
                          onClick={() => toggleContacted(lead.id, lead.is_contacted)}
                          className={`rounded border p-1 transition-all ${
                            lead.is_contacted 
                              ? "bg-primary border-primary text-primary-foreground" 
                              : "border-border/60 hover:border-primary/60 text-transparent"
                          }`}
                          aria-label="Toggle outreach contacted"
                        >
                          <Check className="h-3 w-3 stroke-[3]" />
                        </button>
                      </div>
                    </TableCell>

                    {/* Reply dropdown */}
                    <TableCell className="align-middle">
                      <Select 
                        value={lead.reply_status} 
                        onValueChange={(val) => handleUpdateReplyStatus(lead.id, val)}
                      >
                        <SelectTrigger className="h-8 text-xs border-border/50 bg-card">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none"><span className="text-muted-foreground">- No status -</span></SelectItem>
                          <SelectItem value="pending">⏳ Pending</SelectItem>
                          <SelectItem value="replied">✅ Replied</SelectItem>
                          <SelectItem value="ignored">❌ No Reply</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Notes (Inline editable on click) */}
                    <TableCell className="align-middle text-xs">
                      {editingNotesId === lead.id ? (
                        <div className="flex items-center gap-1.5 w-full">
                          <Input
                            value={editingNotesText}
                            onChange={(e) => setEditingNotesText(e.target.value)}
                            onBlur={() => saveInlineNotes(lead.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveInlineNotes(lead.id);
                              if (e.key === "Escape") setEditingNotesId(null);
                            }}
                            autoFocus
                            className="h-7 text-xs py-0 px-2"
                          />
                        </div>
                      ) : (
                        <div 
                          onClick={() => {
                            setEditingNotesId(lead.id);
                            setEditingNotesText(lead.notes || "");
                          }}
                          className="cursor-pointer group flex items-start justify-between gap-1 hover:bg-muted/30 p-1 rounded transition-colors min-h-[24px]"
                          title="Click to edit notes"
                        >
                          <span className="text-muted-foreground line-clamp-2 leading-tight">
                            {lead.notes || <span className="text-muted-foreground/30 italic font-sans">Add strategic notes...</span>}
                          </span>
                          <Edit2 className="h-2.5 w-2.5 text-muted-foreground/0 group-hover:text-muted-foreground/60 shrink-0 mt-0.5 transition-opacity" />
                        </div>
                      )}
                    </TableCell>

                    {/* Integrations & Delete actions */}
                    <TableCell className="align-middle text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary"
                          onClick={() => fetchNotionDatabases(lead)}
                          title="Export to Notion"
                        >
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
                            <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
                          </svg>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary"
                          onClick={() => exportToAirtable(lead)}
                          title="Export to Airtable"
                        >
                          <span className="text-[10px] font-bold font-mono">A</span>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteLead(lead.id, lead.company_name)}
                          title="Delete prospect"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* ── Dialog: Add Lead Manually ── */}
      <Dialog open={showManualModal} onOpenChange={setShowManualModal}>
        <DialogContent className="sm:max-w-[480px] bg-card border border-border/80">
          <form onSubmit={handleAddManual}>
            <DialogHeader>
              <DialogTitle className="text-xl">Add Sourced Lead</DialogTitle>
              <DialogDescription>
                Manually record a startup lead to seed your CRM.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground" htmlFor="m-company">
                    Company Name *
                  </label>
                  <Input 
                    id="m-company" 
                    value={manualCompany} 
                    onChange={e => setManualCompany(e.target.value)} 
                    placeholder="e.g. River"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground" htmlFor="m-founder">
                    Founder Name
                  </label>
                  <Input 
                    id="m-founder" 
                    value={manualFounder} 
                    onChange={e => setManualFounder(e.target.value)} 
                    placeholder="e.g. Jane Doe"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground" htmlFor="m-linkedin">
                    LinkedIn Profile URL
                  </label>
                  <Input 
                    id="m-linkedin" 
                    value={manualLinkedin} 
                    onChange={e => setManualLinkedin(e.target.value)} 
                    placeholder="e.g. https://linkedin.com/in/..."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground" htmlFor="m-twitter">
                    Twitter / X Handle
                  </label>
                  <Input 
                    id="m-twitter" 
                    value={manualTwitter} 
                    onChange={e => setManualTwitter(e.target.value)} 
                    placeholder="e.g. @janedoe"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground" htmlFor="m-employees">
                    Employees
                  </label>
                  <Input 
                    id="m-employees" 
                    type="number"
                    value={manualEmployees} 
                    onChange={e => setManualEmployees(e.target.value)} 
                    placeholder="e.g. 5"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground" htmlFor="m-icp">
                    ICP Score (0-10)
                  </label>
                  <Input 
                    id="m-icp" 
                    type="number"
                    min="0"
                    max="10"
                    value={manualIcp} 
                    onChange={e => setManualIcp(e.target.value)} 
                    placeholder="e.g. 8"
                  />
                </div>
                <div className="flex items-center justify-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox 
                      checked={manualB2b} 
                      onCheckedChange={(checked) => setManualB2b(!!checked)}
                    />
                    <span className="text-xs font-semibold text-muted-foreground">B2B SaaS</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="m-url">
                  Source / Website URL
                </label>
                <Input 
                  id="m-url" 
                  value={manualUrl} 
                  onChange={e => setManualUrl(e.target.value)} 
                  placeholder="e.g. producthunt.com/posts/river"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="m-notes">
                  Strategy / Outreach Notes
                </label>
                <Textarea 
                  id="m-notes" 
                  value={manualNotes} 
                  onChange={e => setManualNotes(e.target.value)} 
                  placeholder="Summarize product positioning and primary strategic hooks..."
                  className="min-h-[80px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowManualModal(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Add Sourced Lead
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Export to Notion ── */}
      <Dialog open={showNotionModal} onOpenChange={setShowNotionModal}>
        <DialogContent className="sm:max-w-[420px] bg-card border border-border/80">
          <DialogHeader>
            <DialogTitle>Export Lead to Notion</DialogTitle>
            <DialogDescription>
              Select which Notion database to push <strong>{exportingLead?.company_name}</strong> to.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {notionLoading && notionDatabases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="mt-2 text-xs text-muted-foreground">Listing shared Notion databases...</span>
              </div>
            ) : notionDatabases.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
                <h4 className="text-sm font-semibold">No Notion databases shared</h4>
                <p className="text-xs text-muted-foreground max-w-[280px] mx-auto">
                  Ensure you share databases with your Notion integration before attempting export.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Select Notion Database
                </label>
                <Select value={selectedNotionDb} onValueChange={setSelectedNotionDb}>
                  <SelectTrigger className="w-full bg-background border-border/50">
                    <SelectValue placeholder="Choose Notion DB" />
                  </SelectTrigger>
                  <SelectContent>
                    {notionDatabases.map(db => (
                      <SelectItem key={db.id} value={db.id}>
                        {db.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotionModal(false)} disabled={notionLoading}>
              Cancel
            </Button>
            <Button 
              onClick={exportToNotion} 
              disabled={notionLoading || !selectedNotionDb}
              className="gap-1.5"
            >
              {notionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Export to Notion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Airtable Credentials Settings ── */}
      <Dialog open={showAirtableModal} onOpenChange={setShowAirtableModal}>
        <DialogContent className="sm:max-w-[440px] bg-card border border-border/80">
          <DialogHeader>
            <DialogTitle>Airtable Connection Settings</DialogTitle>
            <DialogDescription>
              Provide your personal API keys to export records to Airtable. Credentials are saved locally in your browser.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="at-pat">
                Personal Access Token (PAT)
              </label>
              <Input
                id="at-pat"
                type="password"
                placeholder="pat..."
                value={airtablePat}
                onChange={e => setAirtablePat(e.target.value)}
                className="bg-background border-border/50"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="at-base">
                  Base ID
                </label>
                <Input
                  id="at-base"
                  placeholder="app..."
                  value={airtableBaseId}
                  onChange={e => setAirtableBaseId(e.target.value)}
                  className="bg-background border-border/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="at-table">
                  Table Name
                </label>
                <Input
                  id="at-table"
                  placeholder="Leads"
                  value={airtableTableName}
                  onChange={e => setAirtableTableName(e.target.value)}
                  className="bg-background border-border/50"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAirtableModal(false);
                setExportingLead(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={saveAirtableAndExport}>
              Save Credentials {exportingLead ? "& Export" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
