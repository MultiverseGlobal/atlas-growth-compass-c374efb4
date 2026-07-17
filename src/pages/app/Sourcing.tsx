import { useState, useEffect } from "react";
import { 
  Target, Loader2, Plus, Search, Trash2, ExternalLink, 
  FileSpreadsheet, Link2, Check, X, Edit2, CheckSquare, 
  Square, RefreshCw, AlertCircle, HelpCircle, ArrowRight,
  LogOut, SlidersHorizontal, TrendingUp, Users, CheckCircle2,
  Database, Play, Info
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIntegrations } from "@/hooks/useIntegrations";
import { LogoMark } from "@/components/atlas/Logo";
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
  exported_to_notion: boolean;
  exported_to_airtable: boolean;
  notion_sync_status?: string | null;
  notion_page_id?: string | null;
  notion_sync_error?: string | null;
}

interface NotionDatabase {
  id: string;
  title: string;
  url: string;
}

export default function Sourcing() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

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

  // Integration Default Configs & Display States
  const [showIntegrationsConfig, setShowIntegrationsConfig] = useState(false);
  const [defaultNotionDb, setDefaultNotionDb] = useState(() => localStorage.getItem("atlas.sourcing.default_notion_db") || "");
  const [autoNotion, setAutoNotion] = useState(() => localStorage.getItem("atlas.sourcing.auto_notion") === "true");

  // Selection state for Bulk Actions
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  // Sourcing mode state
  const [sourcingMode, setSourcingMode] = useState<"url" | "text">("url");
  const [rawTextInput, setRawTextInput] = useState("");

  // Preview & Organize Staging Flow state
  const [previewLead, setPreviewLead] = useState<Partial<Lead> | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Notion integration hooks
  const { data: integrations = [], connectNotion } = useIntegrations();

  // Duplicate Conflict Modal State
  const [conflictLead, setConflictLead] = useState<Lead | null>(null);
  const [conflictDbId, setConflictDbId] = useState("");
  const [showConflictModal, setShowConflictModal] = useState(false);

  // Batch Sync Report State
  const [batchReport, setBatchReport] = useState<{
    total: number;
    success: number;
    failed: number;
    skipped: number;
    failures: { name: string; reason: string }[];
  } | null>(null);
  const [showBatchReportModal, setShowBatchReportModal] = useState(false);

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
    if (!loading) {
      if (!user) {
        navigate("/auth");
      } else if (user.email?.toLowerCase() === "multiverseglobals@gmail.com") {
        fetchLeads();
      }
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center grain">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground font-mono">Verifying credentials...</p>
        </div>
      </div>
    );
  }

  if (!user || user.email?.toLowerCase() !== "multiverseglobals@gmail.com") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 grain">
        <div className="max-w-md w-full rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-8 text-center shadow-lg">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-5 animate-bounce">
            <X className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground font-display">Access Denied</h2>
          <p className="mt-3 text-[14px] text-muted-foreground leading-relaxed">
            Atlas HQ is a restricted admin console. Only the account owner <strong>multiverseglobals@gmail.com</strong> is permitted to access this portal.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <Button onClick={() => navigate("/app")} className="w-full h-10 gap-1.5 font-medium">
              Back to Main App
            </Button>
            <Button variant="outline" onClick={() => signOut().then(() => navigate("/auth"))} className="w-full h-10 gap-1.5 font-medium">
              <LogOut className="h-4 w-4" /> Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Sourcing pipeline execution
  const handleSource = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isUrlMode = sourcingMode === "url";
    const input = isUrlMode ? urlInput.trim() : rawTextInput.trim();
    if (!input) return;

    let targetUrl = "";
    if (isUrlMode) {
      targetUrl = input;
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = "https://" + targetUrl;
      }
    }

    setSourcing(true);
    if (isUrlMode) {
      setUrlInput("");
    } else {
      setRawTextInput("");
    }
    
    // Simulate steps in UI for beautiful UX
    setSourcingStep(1); // Scrape/Input
    
    const stepInterval = setInterval(() => {
      setSourcingStep(prev => {
        if (prev < 3) return prev + 1;
        return prev;
      });
    }, 2800);

    try {
      const { data: parsedLead, error: invokeError } = await supabase.functions.invoke("sourcing-machine", {
        body: isUrlMode ? {
          action: "source",
          url: targetUrl
        } : {
          action: "source",
          raw_text: input
        }
      });

      if (invokeError) {
        throw new Error(invokeError.message ?? "Failed to source lead");
      }

      if (parsedLead && parsedLead.error) {
        throw new Error(parsedLead.error);
      }

      if (!parsedLead) {
        throw new Error("No data returned from sourcing service");
      }

      // Store in preview state instead of directly saving to DB
      setPreviewLead(parsedLead);
      setShowPreviewModal(true);
      toast.success(`Successfully parsed ${parsedLead.company_name || "lead"}! Please review before saving.`);
    } catch (err: any) {
      toast.error("Sourcing failed: " + err.message);
    } finally {
      clearInterval(stepInterval);
      setSourcing(false);
      setSourcingStep(0);
    }
  };

  // Fetch Notion Databases list
  const loadNotionDatabasesList = async (showToastError = true) => {
    try {
      const { data: body, error: invokeError } = await supabase.functions.invoke("sourcing-machine", {
        body: { action: "list-notion-databases" }
      });

      if (invokeError) throw new Error(invokeError.message ?? "Failed to fetch databases");

      setNotionDatabases(body?.databases || []);
      return body?.databases || [];
    } catch (err: any) {
      if (showToastError) {
        toast.error("Notion databases load error: " + err.message);
      }
      return [];
    }
  };

  // Perform actual Notion export
  const performExportToNotion = async (lead: Lead | Partial<Lead>, dbId: string) => {
    try {
      const { data: body, error: invokeError } = await supabase.functions.invoke("sourcing-machine", {
        body: {
          action: "export-notion",
          lead,
          database_id: dbId
        }
      });

      if (invokeError) throw new Error(invokeError.message ?? "Notion export failed");

      // If it has an ID (already saved in DB), mark as exported
      if (lead.id) {
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, exported_to_notion: true } : l));
        await supabase
          .from("leads")
          .update({ exported_to_notion: true })
          .eq("id", lead.id);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // Sync a single lead with step-by-step progress toasts and conflict handler
  const syncSingleLeadWithProgress = async (lead: Lead, behavior?: "update" | "duplicate" | "skip") => {
    const notionIntegration = integrations.find(i => i.provider === "notion" && i.status === "active");
    const dbId = notionIntegration?.settings?.notion_database_id;
    if (!dbId) {
      toast.error("No target Notion database configured. Please select a database in Integrations page first.");
      return;
    }

    const toastId = toast.loading("Preparing founder intelligence...", { duration: 0 });
    
    // Set status to syncing in local state
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, notion_sync_status: "syncing" } : l));

    try {
      toast.loading("Querying Notion database for duplicates...", { id: toastId });
      
      const payload: any = {
        action: "export-notion",
        lead: {
          id: lead.id,
          company_name: lead.company_name,
          founder_name: lead.founder_name,
          linkedin_url: lead.linkedin_url,
          twitter_url: lead.twitter_url,
          employee_count: lead.employee_count,
          is_b2b_saas: lead.is_b2b_saas,
          icp_score: lead.icp_score,
          notes: lead.notes,
          is_contacted: lead.is_contacted,
          reply_status: lead.reply_status,
          product_hunt_url: lead.product_hunt_url
        },
        database_id: dbId,
        duplicate_behavior: behavior || notionIntegration?.settings?.notion_duplicate_behavior,
        field_mappings: notionIntegration?.settings?.field_mappings
      };

      toast.loading("Publishing rich blocks layout to Notion page...", { id: toastId });
      
      const { data, error } = await supabase.functions.invoke("sourcing-machine", {
        body: payload
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.duplicate_detected) {
        toast.dismiss(toastId);
        // Reset local lead status to not_synced
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, notion_sync_status: "not_synced" } : l));
        
        // Open conflict choices dialog
        setConflictLead(lead);
        setConflictDbId(dbId);
        setShowConflictModal(true);
        return;
      }

      toast.loading("Updating intelligence logs...", { id: toastId });
      
      // Update local state to synced
      setLeads(prev => prev.map(l => l.id === lead.id ? { 
        ...l, 
        notion_sync_status: "synced",
        notion_page_id: data.page_id,
        notion_sync_error: null,
        exported_to_notion: true
      } : l));

      toast.success(`Successfully pushed ${lead.company_name} to Notion!`, { id: toastId });

    } catch (err: any) {
      setLeads(prev => prev.map(l => l.id === lead.id ? { 
        ...l, 
        notion_sync_status: "failed",
        notion_sync_error: err.message
      } : l));
      toast.error(`Notion push failed for ${lead.company_name}: ${err.message}`, { id: toastId });
    }
  };

  // Batch sync selected leads with progress reporting
  const handleBulkExportNotion = async () => {
    const notionIntegration = integrations.find(i => i.provider === "notion" && i.status === "active");
    const dbId = notionIntegration?.settings?.notion_database_id;
    if (!dbId) {
      toast.error("Notion database is not configured. Please connect Notion and select a database first.");
      return;
    }

    const selectedLeads = leads.filter(l => selectedLeadIds.includes(l.id));
    if (selectedLeads.length === 0) {
      toast.error("No leads selected.");
      return;
    }

    const toastId = toast.loading(`Initiating batch sync for ${selectedLeads.length} leads...`, { duration: 0 });

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const failures: { name: string; reason: string }[] = [];

    const defaultBehavior = notionIntegration?.settings?.notion_duplicate_behavior || "duplicate";

    for (let i = 0; i < selectedLeads.length; i++) {
      const lead = selectedLeads[i];
      toast.loading(`Uploading ${i + 1} of ${selectedLeads.length}: ${lead.company_name}...`, { id: toastId });

      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, notion_sync_status: "syncing" } : l));

      try {
        const { data, error } = await supabase.functions.invoke("sourcing-machine", {
          body: {
            action: "export-notion",
            lead: {
              id: lead.id,
              company_name: lead.company_name,
              founder_name: lead.founder_name,
              linkedin_url: lead.linkedin_url,
              twitter_url: lead.twitter_url,
              employee_count: lead.employee_count,
              is_b2b_saas: lead.is_b2b_saas,
              icp_score: lead.icp_score,
              notes: lead.notes,
              is_contacted: lead.is_contacted,
              reply_status: lead.reply_status,
              product_hunt_url: lead.product_hunt_url
            },
            database_id: dbId,
            duplicate_behavior: defaultBehavior,
            field_mappings: notionIntegration?.settings?.field_mappings
          }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        if (data?.skipped) {
          skippedCount++;
          setLeads(prev => prev.map(l => l.id === lead.id ? { 
            ...l, 
            notion_sync_status: "synced",
            notion_page_id: data.page_id,
            notion_sync_error: null
          } : l));
        } else {
          successCount++;
          setLeads(prev => prev.map(l => l.id === lead.id ? { 
            ...l, 
            notion_sync_status: "synced",
            notion_page_id: data.page_id,
            notion_sync_error: null,
            exported_to_notion: true
          } : l));
        }
      } catch (err: any) {
        failedCount++;
        failures.push({ name: lead.company_name, reason: err.message });
        setLeads(prev => prev.map(l => l.id === lead.id ? { 
          ...l, 
          notion_sync_status: "failed",
          notion_sync_error: err.message
        } : l));
      }
    }

    toast.dismiss(toastId);

    setBatchReport({
      total: selectedLeads.length,
      success: successCount,
      failed: failedCount,
      skipped: skippedCount,
      failures
    });
    setShowBatchReportModal(true);
    setSelectedLeadIds([]);
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

  // Save parsed/staged preview lead to Supabase & auto-push if configured
  const savePreviewLeadToPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewLead || !previewLead.company_name?.trim()) {
      toast.error("Company name is required");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");

      // Save to Supabase
      const { data, error } = await supabase
        .from("leads")
        .insert({
          user_id: user.id,
          company_name: previewLead.company_name.trim(),
          founder_name: previewLead.founder_name?.trim() || null,
          linkedin_url: previewLead.linkedin_url?.trim() || null,
          twitter_url: previewLead.twitter_url?.trim() || null,
          employee_count: previewLead.employee_count ?? null,
          is_b2b_saas: previewLead.is_b2b_saas ?? false,
          icp_score: previewLead.icp_score ?? null,
          product_hunt_url: previewLead.product_hunt_url?.trim() || null,
          notes: previewLead.notes?.trim() || null,
          exported_to_notion: false,
          exported_to_airtable: false
        })
        .select()
        .single();

      if (error) throw error;
      
      // Update local lists
      setLeads(prev => [data, ...prev]);
      setShowPreviewModal(false);
      setPreviewLead(null);
      toast.success(`Successfully saved ${data.company_name} to pipeline!`);

      // Trigger auto-push if configured
      if (autoNotion) {
        const notionDb = defaultNotionDb || (notionDatabases.length > 0 ? notionDatabases[0].id : null);
        if (notionDb) {
          toast.loading(`Auto-pushing ${data.company_name} to Notion...`);
          const res = await performExportToNotion(data, notionDb);
          toast.dismiss();
          if (res.success) {
            toast.success("Auto-pushed to Notion!");
          } else {
            toast.error("Notion auto-push failed: " + res.error);
          }
        }
      }

    } catch (err: any) {
      toast.error("Failed to save lead: " + err.message);
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
    
    if (notionDatabases.length === 0) {
      setNotionLoading(true);
      const dbs = await loadNotionDatabasesList(true);
      setNotionLoading(false);
      if (dbs.length > 0) {
        setSelectedNotionDb(defaultNotionDb || dbs[0].id);
      }
    } else {
      setSelectedNotionDb(defaultNotionDb || notionDatabases[0].id);
    }
  };

  // Export to Notion DB row
  const exportToNotion = async () => {
    if (!exportingLead || !selectedNotionDb) return;
    setNotionLoading(true);

    const res = await performExportToNotion(exportingLead, selectedNotionDb);
    setNotionLoading(false);

    if (res.success) {
      toast.success(`Successfully exported ${exportingLead.company_name} to Notion! 🚀`);
      setShowNotionModal(false);
      setExportingLead(null);
    } else {
      toast.error(`Notion export failed: ${res.error}`);
    }
  };




  const handleBulkDelete = async () => {
    const selectedCount = selectedLeadIds.length;
    if (!confirm(`Are you sure you want to delete ${selectedCount} leads?`)) return;

    toast.loading(`Deleting ${selectedCount} leads...`);
    try {
      const { error } = await supabase
        .from("leads")
        .delete()
        .in("id", selectedLeadIds);

      if (error) throw error;
      
      setLeads(prev => prev.filter(l => !selectedLeadIds.includes(l.id)));
      toast.dismiss();
      toast.success(`Successfully deleted ${selectedCount} leads.`);
      setSelectedLeadIds([]);
    } catch (err: any) {
      toast.dismiss();
      toast.error("Failed to delete leads: " + err.message);
    }
  };

  const handleBulkMarkContacted = async (contacted: boolean) => {
    toast.loading("Updating status...");
    try {
      const { error } = await supabase
        .from("leads")
        .update({ is_contacted: contacted })
        .in("id", selectedLeadIds);

      if (error) throw error;

      setLeads(prev => prev.map(l => selectedLeadIds.includes(l.id) ? { ...l, is_contacted: contacted } : l));
      toast.dismiss();
      toast.success(`Updated ${selectedLeadIds.length} leads.`);
      setSelectedLeadIds([]);
    } catch (err: any) {
      toast.dismiss();
      toast.error("Failed to update status: " + err.message);
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

  // Stats Calculations
  const statsTotal = leads.length;
  const statsIcpAvg = leads.length > 0
    ? Number((leads.reduce((sum, l) => sum + (l.icp_score || 0), 0) / leads.length).toFixed(1))
    : 0;
  const statsSaasCount = leads.filter(l => l.is_b2b_saas).length;
  const statsSaasRatio = leads.length > 0
    ? Math.round((statsSaasCount / leads.length) * 100)
    : 0;
  const statsContactedCount = leads.filter(l => l.is_contacted).length;
  const statsContactRate = leads.length > 0
    ? Math.round((statsContactedCount / leads.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col grain">
      {/* Premium Top Navigation Bar */}
      <header className="border-b border-border/60 bg-card/40 backdrop-blur-md sticky top-0 z-30 px-6 h-16 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <LogoMark size={24} />
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold text-lg text-foreground">Atlas HQ</span>
            <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              Admin Board
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-xs font-mono bg-emerald-500/5 text-emerald-500 border border-emerald-500/10 px-2.5 py-1 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Connected to Supabase
          </div>
          <div className="hidden sm:block text-xs text-muted-foreground border-l border-border/80 pl-4 h-5 flex items-center">
            {user?.email}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/app")}
            className="text-xs h-9 gap-1.5 font-medium border-border/80 hover:bg-muted"
          >
            Back to App
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut().then(() => navigate("/"))}
            className="text-xs h-9 text-muted-foreground hover:text-foreground hover:bg-destructive/10 hover:text-destructive transition-colors gap-1.5 font-medium"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="relative page-hero mx-auto max-w-6xl px-4 py-8 md:px-8">
          {/* ── Heading ── */}
          <div className="flex items-center gap-2 eyebrow text-primary">
            <Target className="h-3.5 w-3.5" /> Outreach Pipeline
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
            onClick={() => setShowIntegrationsConfig(prev => !prev)}
            className={`text-xs h-9 gap-1.5 font-medium ${showIntegrationsConfig ? "bg-primary/10 border-primary text-primary" : ""}`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Configure Destinations
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

      {/* ── Stats Dashboard ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        <div className="rounded-xl border border-border/50 bg-card/60 p-4 shadow-sm backdrop-blur-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-semibold tracking-tight font-display">{statsTotal}</div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">Total Leads</div>
          </div>
        </div>
        <div className="rounded-xl border border-border/50 bg-card/60 p-4 shadow-sm backdrop-blur-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500 shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-semibold tracking-tight font-display">{statsIcpAvg}/10</div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">Avg ICP Score</div>
          </div>
        </div>
        <div className="rounded-xl border border-border/50 bg-card/60 p-4 shadow-sm backdrop-blur-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-500 shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-semibold tracking-tight font-display">{statsSaasRatio}%</div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">B2B SaaS Ratio</div>
          </div>
        </div>
        <div className="rounded-xl border border-border/50 bg-card/60 p-4 shadow-sm backdrop-blur-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-semibold tracking-tight font-display">{statsContactRate}%</div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">Contact Rate</div>
          </div>
        </div>
      </div>

      {/* ── Collapsible Integrations Config ── */}
      {showIntegrationsConfig && (
        <div className="mt-6 rounded-lg border border-border/60 bg-card p-6 shadow-sm relative overflow-hidden transition-all duration-300">
          <div className="absolute right-4 top-4">
            <Button variant="ghost" size="sm" onClick={() => setShowIntegrationsConfig(false)} className="h-8 w-8 p-0 text-muted-foreground">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <h3 className="font-display font-semibold text-lg text-foreground flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" /> Destination Settings & Auto-Push Pipeline
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Configure your integrations defaults. Choose where target prospects are sent, choose which database to use, and toggle auto-push to automate your entire outreach workflow.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {/* Notion Destination Settings */}
            <div className="space-y-4 rounded-md border border-border/40 p-4 bg-muted/20">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                  Notion Integration
                  {integrations.some(i => i.provider === "notion" && i.status === "active") ? (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">✓ Connected</span>
                  ) : (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">Not connected</span>
                  )}
                </span>
                {integrations.some(i => i.provider === "notion" && i.status === "active") ? (
                  <Checkbox
                    id="auto-notion"
                    checked={autoNotion}
                    onCheckedChange={(checked) => {
                      setAutoNotion(!!checked);
                      localStorage.setItem("atlas.sourcing.auto_notion", String(!!checked));
                      toast.success(!!checked ? "Auto-Notion enabled" : "Auto-Notion disabled");
                    }}
                  />
                ) : (
                  <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1.5" onClick={connectNotion}>
                    <ExternalLink className="h-3 w-3" /> Connect Notion
                  </Button>
                )}
              </div>
              
              <div className="space-y-2">
                <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Default Target Database</label>
                <Select 
                  value={defaultNotionDb} 
                  onValueChange={(val) => {
                    setDefaultNotionDb(val);
                    localStorage.setItem("atlas.sourcing.default_notion_db", val);
                    toast.success("Default Notion Database set");
                  }}
                >
                  <SelectTrigger className="w-full h-9 bg-background text-xs">
                    <SelectValue placeholder={notionLoading ? "Loading databases..." : "Select Notion DB"} />
                  </SelectTrigger>
                  <SelectContent>
                    {notionDatabases.length === 0 ? (
                      <SelectItem value="none" disabled>No databases loaded</SelectItem>
                    ) : (
                      notionDatabases.map(db => (
                        <SelectItem key={db.id} value={db.id}>{db.title}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-2 mt-4 pt-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => loadNotionDatabasesList(false)}
                  className="text-[11px] h-7 font-medium text-primary hover:bg-primary/5 p-0"
                >
                  <RefreshCw className="h-3 w-3 mr-1 inline" /> Reload Databases
                </Button>
                <div className="text-[10px] text-muted-foreground text-right max-w-[180px]">
                  Turn on Notion auto-push to export newly analyzed leads.
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Sourcing Input Card ── */}
      <div className="mt-8 rounded-lg border border-border/60 bg-card p-6 shadow-sm">
        {/* Toggle Mode Switcher */}
        <div className="flex border-b border-border/40 pb-4 mb-4 gap-4">
          <button
            type="button"
            onClick={() => setSourcingMode("url")}
            className={`text-xs font-semibold pb-1 border-b-2 transition-all ${
              sourcingMode === "url" 
                ? "border-primary text-primary" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            🔗 URL Scanner
          </button>
          <button
            type="button"
            onClick={() => setSourcingMode("text")}
            className={`text-xs font-semibold pb-1 border-b-2 transition-all ${
              sourcingMode === "text" 
                ? "border-primary text-primary" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            📋 Raw Page Scraper (Paste Text)
          </button>
        </div>

        <form onSubmit={handleSource} className="flex flex-col gap-3.5 max-w-3xl">
          {sourcingMode === "url" ? (
            <div className="flex flex-col gap-2 w-full">
              <div className="flex gap-2.5 w-full">
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
                      Analyze URL
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground leading-normal flex items-start gap-1.5 mt-1 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-md">
                <Info className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  <strong>LinkedIn & X/Twitter Note:</strong> Direct URL scanning of social media profiles will fail and yield placeholder data due to strict anti-scraping paywalls. To source from LinkedIn or X, copy the page text and paste it into the <strong>Raw Page Scraper (Paste Text)</strong> tab above.
                </span>
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 w-full">
              <Textarea
                placeholder="Copy and paste the full page contents here (founder details, socials, SaaS status, and notes will be extracted and scored using Kimi AI)..."
                value={rawTextInput}
                onChange={(e) => setRawTextInput(e.target.value)}
                disabled={sourcing}
                className="min-h-[140px] bg-background text-sm resize-y"
              />
              <Button type="submit" size="lg" disabled={sourcing || !rawTextInput.trim()} className="h-11 px-5 gap-1.5 font-medium align-self-start self-start">
                {sourcing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing Content...
                  </>
                ) : (
                  <>
                    Analyze Paste
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          )}
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
                {sourcingMode === "url" ? "1. Crawling target URL & extracting page body..." : "1. Reading raw text input block..."}
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
                4. Formatting details for staging preview...
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

      {/* ── Bulk Actions Staging Banner ── */}
      {selectedLeadIds.length > 0 && (
        <div className="mt-6 p-3 px-4 rounded-lg border border-primary/35 bg-primary/5 flex items-center justify-between text-xs animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-2 text-foreground font-medium">
            <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground font-mono flex items-center justify-center font-bold text-[10px]">
              {selectedLeadIds.length}
            </span>
            selected prospects
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkExportNotion}
              className="h-8 text-[11px] gap-1 px-2.5 font-medium hover:bg-primary/5"
            >
              Export Notion
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkMarkContacted(true)}
              className="h-8 text-[11px] gap-1 px-2.5 font-medium hover:bg-primary/5"
            >
              Mark Contacted
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkMarkContacted(false)}
              className="h-8 text-[11px] gap-1 px-2.5 font-medium hover:bg-primary/5"
            >
              Mark Uncontacted
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBulkDelete}
              className="h-8 text-[11px] gap-1 px-2.5 font-medium hover:bg-destructive/10 text-destructive"
            >
              Delete Selected
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedLeadIds([])}
              className="h-8 text-[11px] px-2 text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

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
                <TableHead className="w-[40px] py-3 text-center">
                  <Checkbox 
                    checked={filteredLeads.length > 0 && selectedLeadIds.length === filteredLeads.length}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedLeadIds(filteredLeads.map(l => l.id));
                      } else {
                        setSelectedLeadIds([]);
                      }
                    }}
                  />
                </TableHead>
                <TableHead className="w-[180px] font-mono text-[10px] tracking-wider uppercase py-3">Company</TableHead>
                <TableHead className="w-[160px] font-mono text-[10px] tracking-wider uppercase py-3">Founder</TableHead>
                <TableHead className="w-[80px] text-center font-mono text-[10px] tracking-wider uppercase py-3">Socials</TableHead>
                <TableHead className="w-[90px] text-center font-mono text-[10px] tracking-wider uppercase py-3">ICP Score</TableHead>
                <TableHead className="w-[90px] text-center font-mono text-[10px] tracking-wider uppercase py-3">Contacted</TableHead>
                <TableHead className="w-[120px] font-mono text-[10px] tracking-wider uppercase py-3">Reply Status</TableHead>
                <TableHead className="w-[110px] font-mono text-[10px] tracking-wider uppercase py-3">Notion Sync</TableHead>
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
                    <TableCell className="align-middle text-center">
                      <Checkbox 
                        checked={selectedLeadIds.includes(lead.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedLeadIds(prev => [...prev, lead.id]);
                          } else {
                            setSelectedLeadIds(prev => prev.filter(id => id !== lead.id));
                          }
                        }}
                      />
                    </TableCell>
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

                    {/* Notion Sync Status */}
                    <TableCell className="align-middle">
                      <div className="flex items-center gap-1.5">
                        {lead.notion_sync_status === "synced" && (
                          <Badge variant="outline" className="border-emerald-500/25 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 font-medium text-[10px] px-1.5 py-0.5">
                            Synced
                          </Badge>
                        )}
                        {lead.notion_sync_status === "syncing" && (
                          <Badge variant="outline" className="border-primary/25 bg-primary/5 text-primary font-medium text-[10px] px-1.5 py-0.5 flex items-center gap-1">
                            <Loader2 className="h-2.5 w-2.5 animate-spin" /> Syncing
                          </Badge>
                        )}
                        {lead.notion_sync_status === "failed" && (
                          <div className="flex items-center gap-1" title={lead.notion_sync_error || "Sync failed"}>
                            <Badge variant="outline" className="border-destructive/25 bg-destructive/5 text-destructive font-medium text-[10px] px-1.5 py-0.5">
                              Failed
                            </Badge>
                            <button 
                              onClick={() => syncSingleLeadWithProgress(lead)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Retry Sync"
                            >
                              <RefreshCw className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        {(lead.notion_sync_status === "not_synced" || !lead.notion_sync_status) && (
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="border-border/60 bg-muted/20 text-muted-foreground font-medium text-[10px] px-1.5 py-0.5">
                              Unsynced
                            </Badge>
                            <button 
                              onClick={() => syncSingleLeadWithProgress(lead)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-primary"
                              title="Sync to Notion"
                            >
                              <Play className="h-3 w-3 fill-current" />
                            </button>
                          </div>
                        )}
                      </div>
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
                          onClick={() => syncSingleLeadWithProgress(lead)}
                          title="Export to Notion"
                        >
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
                            <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
                          </svg>
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
      {/* ── Dialog: Notion Duplicate Conflict ── */}
      <Dialog open={showConflictModal} onOpenChange={setShowConflictModal}>
        <DialogContent className="sm:max-w-[420px] bg-card border border-border/80">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-1.5 text-amber-600">
              <AlertCircle className="h-5 w-5 shrink-0" /> Duplicate Record Detected
            </DialogTitle>
            <DialogDescription>
              A page for <strong>{conflictLead?.company_name}</strong> already exists in your active Notion database. How would you like to handle this conflict?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 flex flex-col gap-3">
            <Button 
              variant="outline" 
              className="justify-start text-left h-auto py-3 px-4 border-border/50 hover:bg-primary/5 hover:border-primary/30"
              onClick={() => {
                if (conflictLead) {
                  syncSingleLeadWithProgress(conflictLead, "update");
                  setShowConflictModal(false);
                }
              }}
            >
              <div>
                <div className="font-semibold text-xs text-foreground">Update Existing Page</div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Overwrite parameters (LinkedIn, X, ICP score, strategy notes column) on the existing Notion page.</p>
              </div>
            </Button>

            <Button 
              variant="outline" 
              className="justify-start text-left h-auto py-3 px-4 border-border/50 hover:bg-primary/5 hover:border-primary/30"
              onClick={() => {
                if (conflictLead) {
                  syncSingleLeadWithProgress(conflictLead, "duplicate");
                  setShowConflictModal(false);
                }
              }}
            >
              <div>
                <div className="font-semibold text-xs text-foreground">Create Duplicate Page</div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Create a brand new page alongside the existing one.</p>
              </div>
            </Button>

            <Button 
              variant="outline" 
              className="justify-start text-left h-auto py-3 px-4 border-border/50 hover:bg-destructive/5 hover:border-destructive/20 hover:text-foreground"
              onClick={() => {
                if (conflictLead) {
                  syncSingleLeadWithProgress(conflictLead, "skip");
                  setShowConflictModal(false);
                }
              }}
            >
              <div>
                <div className="font-semibold text-xs text-foreground">Skip Sync</div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Do nothing. Mark the lead as synced locally without pushing updates to Notion.</p>
              </div>
            </Button>
          </div>

          <DialogFooter className="sm:justify-start border-t border-border/40 pt-3">
            <Button variant="ghost" size="sm" onClick={() => setShowConflictModal(false)} className="text-muted-foreground hover:text-foreground">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Notion Batch Sync Report ── */}
      <Dialog open={showBatchReportModal} onOpenChange={setShowBatchReportModal}>
        <DialogContent className="sm:max-w-[460px] bg-card border border-border/80">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-1.5">
              <Database className="h-5 w-5 text-primary" /> Batch Sync Report
            </DialogTitle>
            <DialogDescription>
              Synchronization report for the exported leads batch to Notion.
            </DialogDescription>
          </DialogHeader>

          {batchReport && (
            <div className="py-4 space-y-4">
              {/* Count Badges */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-center">
                  <div className="font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400">{batchReport.success}</div>
                  <div className="text-[9px] text-muted-foreground uppercase font-semibold mt-0.5">Success</div>
                </div>
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-center">
                  <div className="font-mono text-xl font-bold text-amber-600 dark:text-amber-400">{batchReport.skipped}</div>
                  <div className="text-[9px] text-muted-foreground uppercase font-semibold mt-0.5">Skipped</div>
                </div>
                <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-center">
                  <div className="font-mono text-xl font-bold text-destructive">{batchReport.failed}</div>
                  <div className="text-[9px] text-muted-foreground uppercase font-semibold mt-0.5">Failed</div>
                </div>
              </div>

              {/* Failures List */}
              {batchReport.failed > 0 && (
                <div className="space-y-2 border-t border-border/40 pt-3">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Failures & Reasons:</label>
                  <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1">
                    {batchReport.failures.map((f, i) => (
                      <div key={i} className="p-2.5 rounded border border-destructive/20 bg-destructive/5 text-[11px] font-sans">
                        <div className="font-semibold text-foreground">{f.name}</div>
                        <p className="text-muted-foreground mt-0.5 leading-normal">{f.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowBatchReportModal(false)} className="w-full sm:w-auto">
              Close Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* ── Dialog: Preview & Edit Sourced Lead ── */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="sm:max-w-[500px] bg-card border border-border/80">
          <form onSubmit={savePreviewLeadToPipeline}>
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" /> Review Extracted Lead
              </DialogTitle>
              <DialogDescription>
                Verify and refine details extracted by Atlas AI before saving them to your active outreach pipeline.
              </DialogDescription>
            </DialogHeader>
            {previewLead && (
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground" htmlFor="p-company">
                      Company Name *
                    </label>
                    <Input 
                      id="p-company" 
                      value={previewLead.company_name || ""} 
                      onChange={e => setPreviewLead(prev => ({ ...prev!, company_name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground" htmlFor="p-founder">
                      Founder Name
                    </label>
                    <Input 
                      id="p-founder" 
                      value={previewLead.founder_name || ""} 
                      onChange={e => setPreviewLead(prev => ({ ...prev!, founder_name: e.target.value }))}
                      placeholder="e.g. John Doe"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground" htmlFor="p-linkedin">
                      LinkedIn Profile URL
                    </label>
                    <Input 
                      id="p-linkedin" 
                      value={previewLead.linkedin_url || ""} 
                      onChange={e => setPreviewLead(prev => ({ ...prev!, linkedin_url: e.target.value }))}
                      placeholder="https://linkedin.com/in/..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground" htmlFor="p-twitter">
                      Twitter / X Handle
                    </label>
                    <Input 
                      id="p-twitter" 
                      value={previewLead.twitter_url || ""} 
                      onChange={e => setPreviewLead(prev => ({ ...prev!, twitter_url: e.target.value }))}
                      placeholder="@handle"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground" htmlFor="p-employees">
                      Employees
                    </label>
                    <Input 
                      id="p-employees" 
                      type="number"
                      value={previewLead.employee_count !== null ? String(previewLead.employee_count) : ""} 
                      onChange={e => setPreviewLead(prev => ({ ...prev!, employee_count: e.target.value === "" ? null : parseInt(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground" htmlFor="p-icp">
                      ICP Score (0-10)
                    </label>
                    <Input 
                      id="p-icp" 
                      type="number"
                      min="0"
                      max="10"
                      value={previewLead.icp_score !== null ? String(previewLead.icp_score) : ""} 
                      onChange={e => setPreviewLead(prev => ({ ...prev!, icp_score: e.target.value === "" ? null : parseInt(e.target.value) }))}
                    />
                  </div>
                  <div className="flex items-center justify-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <Checkbox 
                        checked={previewLead.is_b2b_saas || false} 
                        onCheckedChange={(checked) => setPreviewLead(prev => ({ ...prev!, is_b2b_saas: !!checked }))}
                      />
                      <span className="text-xs font-semibold text-muted-foreground">B2B SaaS</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground" htmlFor="p-url">
                    Source / Website URL
                  </label>
                  <Input 
                    id="p-url" 
                    value={previewLead.product_hunt_url || ""} 
                    onChange={e => setPreviewLead(prev => ({ ...prev!, product_hunt_url: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground" htmlFor="p-notes">
                    Strategy / Outreach Notes
                  </label>
                  <Textarea 
                    id="p-notes" 
                    value={previewLead.notes || ""} 
                    onChange={e => setPreviewLead(prev => ({ ...prev!, notes: e.target.value }))}
                    className="min-h-[100px]"
                  />
                </div>
                
                {/* Auto Push options */}
                <div className="border-t border-border/40 pt-3 mt-1 flex flex-col gap-2">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">Pipeline Integrations:</span>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <Checkbox 
                        checked={autoNotion} 
                        onCheckedChange={(checked) => {
                          setAutoNotion(!!checked);
                          localStorage.setItem("atlas.sourcing.auto_notion", String(!!checked));
                        }}
                      />
                      <span className="text-xs text-foreground">Auto-push to Notion</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setShowPreviewModal(false);
                setPreviewLead(null);
              }}>
                Cancel
              </Button>
              <Button type="submit">
                Save & Add to Pipeline
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
        </div>
      </main>
    </div>
  );
}
