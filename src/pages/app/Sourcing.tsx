import { useState, useEffect } from "react";
import { 
  Target, Loader2, Plus, Search, Trash2, ExternalLink, 
  FileSpreadsheet, Link2, Check, X, Edit2, CheckSquare, 
  Square, RefreshCw, AlertCircle, HelpCircle, ArrowRight,
  LogOut, SlidersHorizontal, TrendingUp, Users, CheckCircle2,
  Database, Play, Info, Plug
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIntegrations } from "@/hooks/useIntegrations";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
const stripMarkdown = (text: string | null): string => {
  if (!text) return "";
  return text
    .replace(/^#+\s+/gm, "")      // remove markdown headings
    .replace(/^[-*+]\s+/gm, "")   // remove bullets
    .replace(/\*\*([^*]+)\*\*/g, "$1") // remove bold **
    .replace(/\*([^*]+)\*/g, "$1") // remove italics *
    .replace(/`([^`]+)`/g, "$1") // remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // remove links
    .replace(/\n+/g, " ")         // replace newlines with spaces
    .trim();
};

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
  const [urlsInput, setUrlsInput] = useState("");
  const [sourcing, setSourcing] = useState(false);
  const [sourcingStep, setSourcingStep] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [saasFilter, setSaasFilter] = useState("all"); // all, saas, non-saas

  // Bulk sourcing state
  const [bulkPreviewLeads, setBulkPreviewLeads] = useState<Partial<Lead>[]>([]);
  const [showBulkPreviewModal, setShowBulkPreviewModal] = useState(false);
  const [bulkSelectedIndices, setBulkSelectedIndices] = useState<number[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  
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
  const [activeNotesLead, setActiveNotesLead] = useState<Lead | null>(null);
  const [notesDraft, setNotesDraft] = useState("");

  // Layout preference & split pane selector state
  const [prospectsLayout, setProspectsLayout] = useState(() => localStorage.getItem("atlas.hq.prospects_layout") || "table");
  const [selectedSplitLeadId, setSelectedSplitLeadId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(() => localStorage.getItem("atlas.hq.prospects_sidebar") !== "false");

  const toggleSidebar = () => {
    setShowSidebar(prev => {
      const next = !prev;
      localStorage.setItem("atlas.hq.prospects_sidebar", String(next));
      return next;
    });
  };

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
  const { data: integrations = [], connectNotion, updateSettings } = useIntegrations();

  // Auto-fetch Notion databases and sync defaultNotionDb state on load/connection
  useEffect(() => {
    const notionIntegration = integrations.find(i => i.provider === "notion" && i.status === "active");
    if (notionIntegration) {
      const dbIdFromDb = notionIntegration.settings?.notion_database_id || "";
      
      // Self-healing: if the DB has no database selected, but local state/localStorage has one, update the DB
      if (!dbIdFromDb && defaultNotionDb && defaultNotionDb !== "none" && notionDatabases.length > 0) {
        const db = notionDatabases.find(d => d.id === defaultNotionDb);
        const dbTitle = db ? db.title : "Notion Database";
        updateSettings.mutate({
          integrationId: notionIntegration.id,
          settings: {
            ...notionIntegration.settings,
            notion_database_id: defaultNotionDb,
            notion_database_name: dbTitle
          }
        });
      } else if (dbIdFromDb && dbIdFromDb !== defaultNotionDb) {
        setDefaultNotionDb(dbIdFromDb);
      }
      
      // Auto-load databases if we haven't loaded them yet
      if (notionDatabases.length === 0 && !notionLoading) {
        setNotionLoading(true);
        loadNotionDatabasesList(false).finally(() => {
          setNotionLoading(false);
        });
      }
    }
  }, [integrations, notionDatabases, defaultNotionDb]);

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
      } else {
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

  if (!user) {
    return null;
  }

  // Sourcing pipeline execution
  const handleSource = async (e: React.FormEvent) => {
    e.preventDefault();

    const isUrlMode = sourcingMode === "url";
    const input = isUrlMode ? urlsInput.trim() : rawTextInput.trim();
    if (!input) return;

    // Parse URLs — split on newlines, filter empty
    const parsedUrls = isUrlMode
      ? input.split(/\n/).map(u => u.trim()).filter(Boolean)
      : [];

    const isMultiUrl = isUrlMode && parsedUrls.length > 1;
    const isSingleUrl = isUrlMode && parsedUrls.length === 1;

    // ── SINGLE URL → use existing single-preview flow ────────────────────────
    if (isSingleUrl) {
      let targetUrl = parsedUrls[0];
      if (!/^https?:\/\//i.test(targetUrl)) targetUrl = "https://" + targetUrl;

      setSourcing(true);
      setUrlsInput("");
      setSourcingStep(1);
      const stepInterval = setInterval(() => {
        setSourcingStep(prev => (prev < 3 ? prev + 1 : prev));
      }, 600);

      try {
        const { data: parsedLead, error: invokeError } = await supabase.functions.invoke("sourcing-machine", {
          body: { action: "source", url: targetUrl }
        });
        if (invokeError) throw new Error(invokeError.message ?? "Failed to source lead");
        if (parsedLead?.error) throw new Error(parsedLead.error);
        if (!parsedLead) throw new Error("No data returned from sourcing service");
        clearInterval(stepInterval);
        setSourcingStep(4);
        await new Promise(r => setTimeout(r, 200));
        setPreviewLead(parsedLead);
        setShowPreviewModal(true);
        toast.success(`Parsed ${parsedLead.company_name || "lead"} — review before saving.`);
      } catch (err: any) {
        toast.error("Sourcing failed: " + err.message);
      } finally {
        clearInterval(stepInterval);
        setSourcing(false);
        setSourcingStep(0);
      }
      return;
    }

    // ── MULTIPLE URLS → bulk-source with progress ─────────────────────────────
    if (isMultiUrl) {
      setSourcing(true);
      setUrlsInput("");
      setBulkProgress({ current: 0, total: parsedUrls.length });
      setSourcingStep(1);

      try {
        const { data, error: invokeError } = await supabase.functions.invoke("sourcing-machine", {
          body: { action: "bulk-source", urls: parsedUrls }
        });
        if (invokeError) throw new Error(invokeError.message ?? "Bulk sourcing failed");
        if (data?.error) throw new Error(data.error);
        const leads: Partial<Lead>[] = data?.leads || [];
        if (leads.length === 0) throw new Error("No leads extracted from URLs");
        setBulkPreviewLeads(leads);
        setBulkSelectedIndices(leads.map((_, i) => i));
        setShowBulkPreviewModal(true);
        toast.success(`Extracted ${leads.length} prospects — select which to save.`);
      } catch (err: any) {
        toast.error("Bulk sourcing failed: " + err.message);
      } finally {
        setSourcing(false);
        setSourcingStep(0);
        setBulkProgress(null);
      }
      return;
    }

    // ── TEXT MODE → always use bulk-source (AI returns array) ─────────────────
    if (!isUrlMode) {
      setSourcing(true);
      setRawTextInput("");
      setSourcingStep(1);
      const stepInterval = setInterval(() => {
        setSourcingStep(prev => (prev < 3 ? prev + 1 : prev));
      }, 600);

      try {
        const { data, error: invokeError } = await supabase.functions.invoke("sourcing-machine", {
          body: { action: "bulk-source", raw_text: input }
        });
        if (invokeError) throw new Error(invokeError.message ?? "Bulk text extraction failed");
        if (data?.error) throw new Error(data.error);
        const leads: Partial<Lead>[] = data?.leads || [];
        if (leads.length === 0) throw new Error("No leads found in pasted text");
        clearInterval(stepInterval);
        setSourcingStep(4);
        await new Promise(r => setTimeout(r, 200));
        setBulkPreviewLeads(leads);
        setBulkSelectedIndices(leads.map((_, i) => i));
        setShowBulkPreviewModal(true);
        toast.success(`Extracted ${leads.length} prospect${leads.length === 1 ? "" : "s"} — select which to save.`);
      } catch (err: any) {
        toast.error("Extraction failed: " + err.message);
      } finally {
        clearInterval(stepInterval);
        setSourcing(false);
        setSourcingStep(0);
      }
      return;
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
    const dbId = notionIntegration?.settings?.notion_database_id || defaultNotionDb;
    if (!dbId || dbId === "none") {
      toast.error("No target Notion database configured. Please select a database from the Notion CRM panel on the left.");
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
    const dbId = notionIntegration?.settings?.notion_database_id || defaultNotionDb;
    if (!dbId || dbId === "none") {
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

  // Save bulk-preview leads to Supabase
  const handleBulkSave = async () => {
    const toSave = bulkPreviewLeads.filter((_, i) => bulkSelectedIndices.includes(i));
    if (toSave.length === 0) return;

    setBulkSaving(true);
    const toastId = toast.loading(`Saving ${toSave.length} prospect${toSave.length === 1 ? "" : "s"}...`);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");

      const rows = toSave.map(l => ({
        user_id: user.id,
        company_name: (l.company_name || "Unknown").trim(),
        founder_name: l.founder_name?.trim() || null,
        linkedin_url: l.linkedin_url?.trim() || null,
        twitter_url: l.twitter_url?.trim() || null,
        employee_count: l.employee_count ?? null,
        is_b2b_saas: l.is_b2b_saas ?? false,
        icp_score: l.icp_score ?? null,
        product_hunt_url: l.product_hunt_url?.trim() || null,
        notes: l.notes?.trim() || null,
        exported_to_notion: false,
        exported_to_airtable: false
      }));

      const { data: saved, error } = await supabase
        .from("leads")
        .insert(rows)
        .select();

      if (error) throw error;

      setLeads(prev => [...(saved || []), ...prev]);
      setShowBulkPreviewModal(false);
      setBulkPreviewLeads([]);
      setBulkSelectedIndices([]);
      toast.dismiss(toastId);
      toast.success(`✓ Saved ${toSave.length} prospect${toSave.length === 1 ? "" : "s"} to pipeline!`);

      // Auto-push to Notion if enabled
      if (autoNotion && saved && saved.length > 0) {
        const notionDb = defaultNotionDb || (notionDatabases.length > 0 ? notionDatabases[0].id : null);
        if (notionDb) {
          toast.loading(`Auto-pushing ${saved.length} leads to Notion...`);
          const results = await Promise.allSettled(
            saved.map(lead => performExportToNotion(lead, notionDb))
          );
          const failed = results.filter(r => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success)).length;
          toast.dismiss();
          if (failed === 0) toast.success("All leads auto-pushed to Notion!");
          else toast.error(`${failed} Notion push(es) failed — check individually.`);
        }
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error("Failed to save leads: " + err.message);
    } finally {
      setBulkSaving(false);
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

  // Save lead notes from modal dialog
  const saveNotesDialog = async () => {
    if (!activeNotesLead) return;
    try {
      const { error } = await supabase
        .from("leads")
        .update({ notes: notesDraft.trim() || null })
        .eq("id", activeNotesLead.id);

      if (error) throw error;

      setLeads(prev => prev.map(l => l.id === activeNotesLead.id ? { ...l, notes: notesDraft.trim() || null } : l));
      toast.success("Strategic notes updated");
      setActiveNotesLead(null);
    } catch (err: any) {
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

  const renderKanbanColumn = (title: string, leadsList: Lead[], borderClass: string, badgeClass: string) => {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-4 space-y-4 shadow-sm flex flex-col max-h-[750px] min-w-[250px] overflow-hidden flex-1">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <span className="font-display font-bold text-sm text-foreground">{title}</span>
          <Badge className={`text-[10px] font-semibold px-2 py-0.5 border ${badgeClass}`}>{leadsList.length}</Badge>
        </div>
        <div className="space-y-3 overflow-y-auto flex-1 pr-1 pb-2">
          {leadsList.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground italic bg-muted/10 rounded-lg border border-dashed border-border/40">
              No leads in this stage
            </div>
          ) : (
            leadsList.map(lead => (
              <div key={lead.id} className={`p-4 rounded-xl border border-border/60 bg-card/60 hover:bg-card/90 transition-all shadow-sm relative ${borderClass} space-y-3`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <span className="font-semibold text-sm text-foreground block truncate">{lead.company_name}</span>
                    <span className="text-xs text-muted-foreground block truncate">{lead.founder_name || "Unknown founder"}</span>
                  </div>
                  <Badge variant="outline" className={`font-mono text-[10px] shrink-0 font-semibold px-1.5 py-0 border ${getIcpBadgeClass(lead.icp_score)}`}>
                    {lead.icp_score !== null && lead.icp_score !== undefined ? `${lead.icp_score}/10` : "TBD"}
                  </Badge>
                </div>

                <div className="flex justify-between items-center text-[11px] text-muted-foreground border-t border-border/30 pt-2.5">
                  <div className="flex items-center gap-1.5">
                    {lead.employee_count ? <span>{lead.employee_count} emp</span> : <span>Untracked size</span>}
                    {lead.is_b2b_saas && <Badge variant="outline" className="text-[9px] px-1 py-0 border-primary/20 text-primary bg-primary/5">SaaS</Badge>}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {lead.linkedin_url && (
                      <a href={lead.linkedin_url} target="_blank" rel="noreferrer" className="p-1 rounded bg-secondary hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground">
                        <Link2 className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {lead.twitter_url && (
                      <a href={lead.twitter_url.startsWith("http") ? lead.twitter_url : `https://x.com/${lead.twitter_url.replace("@", "")}`} target="_blank" rel="noreferrer" className="p-1 rounded bg-secondary hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground">
                        <span className="text-[9px] font-bold font-mono">X</span>
                      </a>
                    )}
                  </div>
                </div>

                {lead.notes && (
                  <div 
                    onClick={() => {
                      setActiveNotesLead(lead);
                      setNotesDraft(lead.notes || "");
                    }}
                    className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed bg-muted/20 hover:bg-muted/40 p-2 rounded cursor-pointer transition-colors border border-border/30"
                    title="Click to view full strategy"
                  >
                    {stripMarkdown(lead.notes)}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-border/30 pt-2.5 mt-1">
                  <div className="flex items-center gap-1">
                    {lead.notion_sync_status === "synced" ? (
                      <span className="text-[9px] font-mono text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">Synced</span>
                    ) : (
                      <button 
                        onClick={() => syncSingleLeadWithProgress(lead)} 
                        className="text-[9px] font-mono text-muted-foreground hover:text-primary bg-secondary/50 px-1.5 py-0.5 rounded border border-border/60 hover:bg-secondary transition-colors"
                      >
                        Push Notion
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => toggleContacted(lead.id, lead.is_contacted)}
                      className="p-1 rounded hover:bg-muted text-muted-foreground"
                      title={lead.is_contacted ? "Mark uncontacted" : "Mark contacted"}
                    >
                      <CheckSquare className={`h-3.5 w-3.5 ${lead.is_contacted ? "text-primary fill-primary/10" : "text-muted-foreground/45"}`} />
                    </button>
                    <button 
                      onClick={() => handleDeleteLead(lead.id, lead.company_name)}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      title="Delete lead"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderKanban = () => {
    return (
      <div className="flex flex-col lg:flex-row gap-4 items-start pb-4 overflow-x-auto w-full">
        {renderKanbanColumn(
          "New Leads", 
          filteredLeads.filter(l => !l.is_contacted), 
          "border-t-3 border-t-amber-500", 
          "bg-amber-500/10 text-amber-500 border-amber-500/20"
        )}
        {renderKanbanColumn(
          "Outreached", 
          filteredLeads.filter(l => l.is_contacted && (l.reply_status === "none" || l.reply_status === "pending")), 
          "border-t-3 border-t-primary", 
          "bg-primary/10 text-primary border-primary/20"
        )}
        {renderKanbanColumn(
          "Replied", 
          filteredLeads.filter(l => l.is_contacted && l.reply_status === "replied"), 
          "border-t-3 border-t-emerald-500", 
          "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
        )}
        {renderKanbanColumn(
          "No Reply", 
          filteredLeads.filter(l => l.is_contacted && l.reply_status === "ignored"), 
          "border-t-3 border-t-rose-500", 
          "bg-rose-500/10 text-rose-500 border-rose-500/20"
        )}
      </div>
    );
  };

  const renderSplitPane = () => {
    const activeSplitLead = filteredLeads.find(l => l.id === selectedSplitLeadId) || filteredLeads[0] || null;

    return (
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden flex flex-col md:flex-row h-[700px] shadow-sm animate-in fade-in duration-200 w-full">
        {/* Left pane: list */}
        <div className="w-full md:w-[280px] shrink-0 border-r border-border/50 flex flex-col bg-muted/10 h-full overflow-hidden">
          <div className="p-3 border-b border-border/45 bg-card font-mono text-[10px] tracking-wider uppercase text-muted-foreground">
            Pipeline Leads ({filteredLeads.length})
          </div>
          <div className="divide-y divide-border/30 overflow-y-auto flex-1">
            {filteredLeads.length === 0 ? (
              <div className="text-center py-10 text-xs text-muted-foreground italic">No prospects found</div>
            ) : (
              filteredLeads.map(lead => {
                const isSelected = activeSplitLead?.id === lead.id;
                return (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedSplitLeadId(lead.id)}
                    className={`p-3.5 cursor-pointer transition-all flex items-start justify-between gap-2 border-l-2 ${
                      isSelected 
                        ? "bg-card border-l-primary" 
                        : "hover:bg-card/40 border-l-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-foreground block truncate">{lead.company_name}</span>
                      <span className="text-[10px] text-muted-foreground block truncate">{lead.founder_name || "Unknown founder"}</span>
                    </div>
                    <Badge variant="outline" className={`font-mono text-[9px] shrink-0 font-semibold px-1 py-0 border ${getIcpBadgeClass(lead.icp_score)}`}>
                      {lead.icp_score !== null && lead.icp_score !== undefined ? `${lead.icp_score}/10` : "TBD"}
                    </Badge>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right pane: inspector */}
        <div className="flex-1 overflow-y-auto h-full p-6 bg-card flex flex-col justify-between">
          {activeSplitLead ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-border/40 pb-5">
                <div>
                  <h3 className="font-display font-bold text-2xl text-foreground leading-none">{activeSplitLead.company_name}</h3>
                  <div className="flex items-center gap-2 mt-2.5">
                    {activeSplitLead.product_hunt_url && (
                      <a href={activeSplitLead.product_hunt_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 font-mono">
                        {activeSplitLead.product_hunt_url.replace("https://", "").slice(0, 30)}...
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  {activeSplitLead.notion_sync_status === "synced" ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2.5 py-1.5 text-xs">
                      Synced to Notion
                    </Badge>
                  ) : (
                    <Button 
                      onClick={() => syncSingleLeadWithProgress(activeSplitLead)}
                      size="sm"
                      className="bg-primary text-primary-foreground text-xs font-semibold gap-1.5"
                    >
                      <Database className="h-3.5 w-3.5" /> Push to Notion
                    </Button>
                  )}
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDeleteLead(activeSplitLead.id, activeSplitLead.company_name)}
                    className="text-xs text-destructive hover:bg-destructive/10 border-border hover:border-destructive/20 gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-lg border border-border/50 p-3 bg-muted/10 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Founder Name</span>
                  <span className="text-xs font-semibold text-foreground block">{activeSplitLead.founder_name || "Unknown"}</span>
                </div>
                <div className="rounded-lg border border-border/50 p-3 bg-muted/10 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Employee Size</span>
                  <span className="text-xs font-semibold text-foreground block">{activeSplitLead.employee_count || "Size untracked"}</span>
                </div>
                <div className="rounded-lg border border-border/50 p-3 bg-muted/10 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">ICP SCORE</span>
                  <span className="text-xs font-semibold text-foreground block">{activeSplitLead.icp_score !== null ? `${activeSplitLead.icp_score}/10` : "TBD"}</span>
                </div>
                <div className="rounded-lg border border-border/50 p-3 bg-muted/10 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">B2B SaaS Model</span>
                  <span className="text-xs font-semibold text-foreground block">{activeSplitLead.is_b2b_saas ? "Yes" : "No"}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border/50 p-4 space-y-3 bg-card/60">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider block">Pipeline Contacts & Socials</span>
                  <div className="flex gap-2">
                    {activeSplitLead.linkedin_url ? (
                      <a href={activeSplitLead.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-secondary px-3 py-1.5 rounded border border-border/80 transition-colors">
                        <Link2 className="h-3.5 w-3.5 text-primary" /> LinkedIn Profile
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground/40 italic">No LinkedIn link</span>
                    )}

                    {activeSplitLead.twitter_url ? (
                      <a href={activeSplitLead.twitter_url.startsWith("http") ? activeSplitLead.twitter_url : `https://x.com/${activeSplitLead.twitter_url.replace("@", "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-secondary px-3 py-1.5 rounded border border-border/80 transition-colors">
                        <span className="text-xs font-bold font-mono text-primary">X</span> Twitter/X Profile
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground/40 italic">No Twitter link</span>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-border/50 p-4 space-y-3 bg-card/60">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider block">Outreach Status Configuration</span>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs">
                      <Checkbox 
                        checked={activeSplitLead.is_contacted} 
                        onCheckedChange={() => toggleContacted(activeSplitLead.id, activeSplitLead.is_contacted)} 
                      />
                      <span>Contacted</span>
                    </label>

                    <Select 
                      value={activeSplitLead.reply_status} 
                      onValueChange={(val) => handleUpdateReplyStatus(activeSplitLead.id, val)}
                    >
                      <SelectTrigger className="h-8 text-xs border-border/50 bg-card w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none"><span className="text-muted-foreground">- No status -</span></SelectItem>
                        <SelectItem value="pending">⏳ Pending</SelectItem>
                        <SelectItem value="replied">✅ Replied</SelectItem>
                        <SelectItem value="ignored">❌ No Reply</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Outreach & Strategy Notes (Editable)</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setActiveNotesLead(activeSplitLead);
                      setNotesDraft(activeSplitLead.notes || "");
                    }}
                    className="h-6 text-[10px] text-primary gap-1"
                  >
                    <Edit2 className="h-2.5 w-2.5" /> Open Full Editor
                  </Button>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/5 p-4 min-h-[160px] max-h-[220px] overflow-y-auto text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap font-sans border-dashed">
                  {activeSplitLead.notes || "No strategic outreach notes written yet. Click 'Open Full Editor' to generate details."}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-muted-foreground italic">
              Select a prospect to view full analytics.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCardGrid = () => {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-4 animate-in fade-in duration-200 w-full">
        {filteredLeads.map(lead => (
          <div key={lead.id} className="rounded-xl border border-border/60 bg-card p-5 space-y-4 shadow-sm flex flex-col justify-between hover:border-primary/40 transition-colors">
            <div className="space-y-3">
              <div className="flex justify-between items-start gap-2 border-b border-border/30 pb-3">
                <div className="min-w-0">
                  <span className="font-semibold text-sm text-foreground block truncate">{lead.company_name}</span>
                  <span className="text-xs text-muted-foreground block truncate">{lead.founder_name || "Unknown founder"}</span>
                </div>
                <Badge variant="outline" className={`font-mono text-xs shrink-0 font-semibold px-2 py-0.5 border ${getIcpBadgeClass(lead.icp_score)}`}>
                  {lead.icp_score !== null && lead.icp_score !== undefined ? `${lead.icp_score}/10` : "TBD"}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
                <div className="flex items-center gap-1.5">
                  {lead.employee_count ? <span>{lead.employee_count} emp</span> : <span>Untracked size</span>}
                  {lead.is_b2b_saas && <Badge variant="outline" className="text-[9px] px-1 py-0 border-primary/20 text-primary bg-primary/5">SaaS</Badge>}
                </div>
                <div className="flex items-center gap-1">
                  {lead.linkedin_url && (
                    <a href={lead.linkedin_url} target="_blank" rel="noreferrer" className="p-1 rounded bg-secondary hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground">
                      <Link2 className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {lead.twitter_url && (
                    <a href={lead.twitter_url.startsWith("http") ? lead.twitter_url : `https://x.com/${lead.twitter_url.replace("@", "")}`} target="_blank" rel="noreferrer" className="p-1 rounded bg-secondary hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground">
                      <span className="text-[10px] font-bold font-mono">X</span>
                    </a>
                  )}
                </div>
              </div>

              {lead.notes && (
                <div 
                  onClick={() => {
                    setActiveNotesLead(lead);
                    setNotesDraft(lead.notes || "");
                  }}
                  className="text-xs text-muted-foreground line-clamp-3 leading-relaxed bg-muted/20 hover:bg-muted/40 p-2.5 rounded cursor-pointer transition-colors border border-border/30"
                  title="Click to view full notes"
                >
                  {stripMarkdown(lead.notes)}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border/30 pt-3 mt-1 text-xs">
              <div className="flex items-center gap-2">
                {lead.notion_sync_status === "synced" ? (
                  <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Synced</span>
                ) : (
                  <button 
                    onClick={() => syncSingleLeadWithProgress(lead)} 
                    className="text-[10px] font-mono text-muted-foreground hover:text-primary bg-secondary/50 px-2 py-0.5 rounded border border-border/60 hover:bg-secondary transition-colors"
                  >
                    Push Notion
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => toggleContacted(lead.id, lead.is_contacted)}
                  className="p-1 rounded hover:bg-muted text-muted-foreground"
                  title={lead.is_contacted ? "Mark uncontacted" : "Mark contacted"}
                >
                  <CheckSquare className={`h-4 w-4 ${lead.is_contacted ? "text-primary fill-primary/10" : "text-muted-foreground/45"}`} />
                </button>
                <button 
                  onClick={() => handleDeleteLead(lead.id, lead.company_name)}
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  title="Delete prospect"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-background min-h-screen text-foreground relative overflow-hidden">
      <div className="w-full space-y-6">

          {/* ── Page Header ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-[11px] uppercase font-mono tracking-widest text-primary font-semibold">Atlas HQ</span>
              </div>
              <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">Founder Intelligence Pipeline</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Source, score, and push B2B SaaS founders to Notion — powered by Kimi AI & NVIDIA NIM.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadCSV}
                className="text-xs h-8 gap-1.5"
                disabled={leads.length === 0}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> Export CSV
              </Button>
              <Button
                onClick={() => setShowManualModal(true)}
                size="sm"
                className="text-xs h-8 gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Add Lead
              </Button>
            </div>
          </div>

          {/* ── Two-Column Layout ── */}
          <div className="flex flex-col xl:flex-row gap-6">

            {/* ─── LEFT: Sourcing Sidebar ─── */}
            <div className={`xl:w-80 shrink-0 space-y-4 transition-all duration-300 ${showSidebar ? "block" : "hidden"}`}>

              {/* Sourcing Input Card */}
              <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
                <div className="flex border-b border-border/40">
                  <button
                    type="button"
                    onClick={() => setSourcingMode("url")}
                    className={`flex-1 py-2.5 text-[11px] font-semibold transition-all ${
                      sourcingMode === "url"
                        ? "bg-primary/5 text-primary border-b-2 border-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    🔗 URL Scanner
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourcingMode("text")}
                    className={`flex-1 py-2.5 text-[11px] font-semibold transition-all ${
                      sourcingMode === "text"
                        ? "bg-primary/5 text-primary border-b-2 border-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    📋 Paste Text
                  </button>
                </div>

                <div className="p-4">
                  <form onSubmit={handleSource} className="flex flex-col gap-3">
                    {sourcingMode === "url" ? (
                      <div className="flex flex-col gap-2">
                        <Textarea
                          placeholder={`One URL per line:\nhttps://stripe.com\nhttps://linear.app`}
                          value={urlsInput}
                          onChange={(e) => setUrlsInput(e.target.value)}
                          className="min-h-[100px] text-xs bg-background font-sans resize-y"
                          required={sourcingMode === "url"}
                        />
                        {/* Batch mode indicator */}
                        {(() => {
                          const count = urlsInput.trim().split(/\n/).map(u => u.trim()).filter(Boolean).length;
                          return count > 1 ? (
                            <div className="rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5 flex items-center gap-1.5">
                              <Play className="h-3 w-3 text-primary shrink-0" />
                              <span className="text-[10px] text-primary font-semibold font-mono">{count} URLs detected — batch mode</span>
                            </div>
                          ) : null;
                        })()}
                        <div className="rounded-md border border-amber-500/10 bg-amber-500/[0.02] p-2 flex gap-1.5 items-start">
                          <Info className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-[10px] text-muted-foreground leading-normal">
                            LinkedIn &amp; X/Twitter block crawlers — use Paste Text instead. Max 20 URLs per batch.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <Textarea
                          placeholder="Paste raw startup information, product descriptions, or founder profiles — multiple companies OK..."
                          value={rawTextInput}
                          onChange={(e) => setRawTextInput(e.target.value)}
                          className="min-h-[140px] text-xs bg-background font-sans resize-y"
                          required={sourcingMode === "text"}
                        />
                        <div className="rounded-md border border-primary/10 bg-primary/[0.02] p-2 flex gap-1.5 items-start">
                          <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                          <p className="text-[10px] text-muted-foreground leading-normal">
                            Paste text about multiple founders — AI will extract all profiles at once.
                          </p>
                        </div>
                      </div>
                    )}

                    <Button 
                      type="submit"
                      disabled={sourcing || (sourcingMode === "url" ? !urlsInput.trim() : !rawTextInput.trim())}
                      className="h-9 gap-1.5 font-medium w-full"
                    >
                      {sourcing ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {bulkProgress ? `Processing ${bulkProgress.current}/${bulkProgress.total}...` : "Analyzing..."}</>
                      ) : (() => {
                        const urlCount = sourcingMode === "url" ? urlsInput.trim().split(/\n/).filter(Boolean).length : 0;
                        if (urlCount > 1) return <><Play className="h-3.5 w-3.5" /> Batch Analyze {urlCount} URLs</>;
                        return <><ArrowRight className="h-3.5 w-3.5" /> {sourcingMode === "url" ? "Analyze URL" : "Extract All Profiles"}</>;
                      })()}
                    </Button>
                  </form>

                  {/* AI Pipeline Steps */}
                  {sourcing && (
                    <div className="mt-4 pt-4 border-t border-border/40 space-y-2.5">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Pipeline Status</p>
                      {[
                        sourcingMode === "url" ? "Crawling target URL..." : "Reading raw text block...",
                        "Sourcing founder identities via AI...",
                        "Scoring ICP index...",
                        "Staging preview data...",
                      ].map((step, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          {sourcingStep > i + 1 ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          ) : sourcingStep === i + 1 ? (
                            <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />
                          ) : (
                            <div className="h-3.5 w-3.5 rounded-full border border-muted shrink-0" />
                          )}
                          <span className={sourcingStep === i + 1 ? "text-foreground font-medium" : "text-muted-foreground"}>{i + 1}. {step}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ─── RIGHT: Pipeline Table ─── */}
            <div className="flex-1 min-w-0">

              {/* ── Filters and Controls Bar ── */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2">
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
                    <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs bg-card">
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Models</SelectItem>
                      <SelectItem value="saas">B2B SaaS</SelectItem>
                      <SelectItem value="non-saas">Consumer/Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={prospectsLayout} onValueChange={(val) => {
                    setProspectsLayout(val);
                    localStorage.setItem("atlas.hq.prospects_layout", val);
                  }}>
                    <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs bg-card">
                      <SelectValue placeholder="Layout" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="table">Table List</SelectItem>
                      <SelectItem value="kanban">Kanban Board</SelectItem>
                      <SelectItem value="split">Split Pane</SelectItem>
                      <SelectItem value="grid">Card Grid</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={toggleSidebar} 
                    className="w-full sm:w-auto h-9 text-xs gap-1.5 border-border/60 bg-card font-medium"
                    title={showSidebar ? "Hide sourcing inputs panel" : "Show sourcing inputs panel"}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>{showSidebar ? "Hide Scanner" : "Show Scanner"}</span>
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0">
                  <span><strong>{filteredLeads.length}</strong> of <strong>{leads.length}</strong> leads</span>
                  <button onClick={fetchLeads} className="p-1 text-muted-foreground/60 hover:text-foreground transition-colors" title="Refresh">
                    <RefreshCw className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* ── Bulk Actions Banner ── */}
              {selectedLeadIds.length > 0 && (
                <div className="mb-3 p-3 px-4 rounded-lg border border-primary/35 bg-primary/5 flex items-center justify-between text-xs animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-2 text-foreground font-medium">
                    <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground font-mono flex items-center justify-center font-bold text-[10px]">{selectedLeadIds.length}</span>
                    selected prospects
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleBulkExportNotion} className="h-8 text-[11px] gap-1 px-2.5 font-medium hover:bg-primary/5">Export Notion</Button>
                    <Button variant="outline" size="sm" onClick={() => handleBulkMarkContacted(true)} className="h-8 text-[11px] gap-1 px-2.5 font-medium hover:bg-primary/5">Mark Contacted</Button>
                    <Button variant="outline" size="sm" onClick={() => handleBulkMarkContacted(false)} className="h-8 text-[11px] gap-1 px-2.5 font-medium hover:bg-primary/5">Uncontacted</Button>
                    <Button variant="ghost" size="sm" onClick={handleBulkDelete} className="h-8 text-[11px] gap-1 px-2.5 font-medium hover:bg-destructive/10 text-destructive">Delete</Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedLeadIds([])} className="h-8 text-[11px] px-2 text-muted-foreground hover:text-foreground">Clear</Button>
                  </div>
                </div>
              )}

              {/* ── Sourced Leads Explorer Content ── */}
              {loadingLeads ? (
                <div className="overflow-hidden rounded-lg border border-border/50 bg-card shadow-sm flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="mt-3 text-sm">Synchronizing pipeline CRM...</p>
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="overflow-hidden rounded-lg border border-border/50 bg-card shadow-sm flex flex-col items-center justify-center py-20 text-center px-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Target className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">No prospects sourced</h3>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                    Analyze startup landing pages, or add manual items to seed your outreach pipeline.
                  </p>
                </div>
              ) : prospectsLayout === "kanban" ? (
                renderKanban()
              ) : prospectsLayout === "split" ? (
                renderSplitPane()
              ) : prospectsLayout === "grid" ? (
                renderCardGrid()
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border/50 bg-card shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="w-[40px] py-3 text-center min-w-[40px]">
                          <Checkbox
                            checked={filteredLeads.length > 0 && selectedLeadIds.length === filteredLeads.length}
                            onCheckedChange={(checked) => {
                              if (checked) { setSelectedLeadIds(filteredLeads.map(l => l.id)); }
                              else { setSelectedLeadIds([]); }
                            }}
                          />
                        </TableHead>

                        <TableHead className="w-[200px] min-w-[180px] font-mono text-[10px] tracking-wider uppercase py-3">Company</TableHead>
                        <TableHead className="w-[180px] min-w-[160px] font-mono text-[10px] tracking-wider uppercase py-3">Founder</TableHead>
                        <TableHead className="w-[90px] min-w-[90px] text-center font-mono text-[10px] tracking-wider uppercase py-3">Socials</TableHead>
                        <TableHead className="w-[100px] min-w-[100px] text-center font-mono text-[10px] tracking-wider uppercase py-3">ICP Score</TableHead>
                        <TableHead className="w-[90px] min-w-[90px] text-center font-mono text-[10px] tracking-wider uppercase py-3">Contacted</TableHead>
                        <TableHead className="w-[140px] min-w-[140px] font-mono text-[10px] tracking-wider uppercase py-3">Reply Status</TableHead>
                        <TableHead className="w-[120px] min-w-[120px] font-mono text-[10px] tracking-wider uppercase py-3">Notion Sync</TableHead>
                        <TableHead className="min-w-[300px] font-mono text-[10px] tracking-wider uppercase py-3">Outreach Notes / Strategy</TableHead>
                        <TableHead className="w-[120px] min-w-[100px] text-right font-mono text-[10px] tracking-wider uppercase py-3">Actions</TableHead>
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
                            <TableCell className="align-middle text-center min-w-[40px]">
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
                            <TableCell className="font-medium align-middle min-w-[180px] max-w-[220px]">
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
                            <TableCell className="align-middle min-w-[160px]">
                              <div className="flex flex-col">
                                <span className="text-sm text-foreground">{lead.founder_name || "Unknown"}</span>
                                <span className="text-[11px] text-muted-foreground mt-0.5">
                                  {lead.employee_count ? `${lead.employee_count} employees` : "Size untracked"}
                                  {lead.is_b2b_saas && <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 border-primary/20 text-primary bg-primary/5">SaaS</Badge>}
                                </span>
                              </div>
                            </TableCell>

                            {/* Socials links */}
                            <TableCell className="align-middle text-center min-w-[90px]">
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
                                    href={lead.twitter_url.startsWith("http") ? lead.twitter_url : `https://x.com/${lead.twitter_url.replace("@", "")}`} 
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
                            <TableCell className="align-middle text-center min-w-[100px]">
                              <Badge variant="outline" className={`font-mono text-xs font-semibold px-2 py-0.5 border ${getIcpBadgeClass(lead.icp_score)}`}>
                                {lead.icp_score !== null && lead.icp_score !== undefined ? `${lead.icp_score}/10` : "TBD"}
                              </Badge>
                            </TableCell>

                            {/* Contacted checkbox */}
                            <TableCell className="align-middle text-center min-w-[90px]">
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
                            <TableCell className="align-middle min-w-[140px]">
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
                            <TableCell className="align-middle min-w-[120px]">
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

                            {/* Notes (Clean display, click to open full dialog editor) */}
                            <TableCell className="align-middle text-xs min-w-[300px]">
                              <div 
                                onClick={() => {
                                  setActiveNotesLead(lead);
                                  setNotesDraft(lead.notes || "");
                                }}
                                className="cursor-pointer group flex items-start justify-between gap-1 hover:bg-muted/30 p-1.5 rounded transition-colors min-h-[24px]"
                                title="Click to view/edit outreach notes"
                              >
                                <span className="text-muted-foreground line-clamp-2 leading-tight">
                                  {lead.notes ? (
                                    stripMarkdown(lead.notes)
                                  ) : (
                                    <span className="text-muted-foreground/30 italic font-sans">Add strategic notes...</span>
                                  )}
                                </span>
                                <Edit2 className="h-2.5 w-2.5 text-muted-foreground/0 group-hover:text-muted-foreground/60 shrink-0 mt-0.5 transition-opacity" />
                              </div>
                            </TableCell>

                            {/* Integrations & Delete actions */}
                            <TableCell className="align-middle text-right min-w-[100px]">
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
                </div>
              )}
      </div> {/* end right column */}
      </div> {/* end two-column layout */}
      </div> {/* end page content */}

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


      {/* ── Dialog: Bulk Preview & Save ── */}
      <Dialog open={showBulkPreviewModal} onOpenChange={(open) => {
        if (!open && !bulkSaving) {
          setShowBulkPreviewModal(false);
          setBulkPreviewLeads([]);
          setBulkSelectedIndices([]);
        }
      }}>
        <DialogContent className="sm:max-w-[820px] bg-card border border-border/80 max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" />
              Bulk Extract Preview
              <span className="text-sm font-normal text-muted-foreground ml-1">
                — {bulkPreviewLeads.length} prospect{bulkPreviewLeads.length === 1 ? "" : "s"} extracted
              </span>
            </DialogTitle>
            <DialogDescription>
              Select which prospects to add to your pipeline. You can edit names inline before saving.
            </DialogDescription>
          </DialogHeader>

          {/* Select-All Controls */}
          <div className="flex items-center gap-3 px-1 shrink-0">
            <button
              type="button"
              onClick={() => setBulkSelectedIndices(bulkPreviewLeads.map((_, i) => i))}
              className="text-[11px] font-mono text-primary hover:underline"
            >
              Select All
            </button>
            <span className="text-muted-foreground text-xs">·</span>
            <button
              type="button"
              onClick={() => setBulkSelectedIndices([])}
              className="text-[11px] font-mono text-muted-foreground hover:text-foreground hover:underline"
            >
              Deselect All
            </button>
            <span className="ml-auto text-[11px] font-mono text-muted-foreground">
              {bulkSelectedIndices.length} of {bulkPreviewLeads.length} selected
            </span>
          </div>

          {/* Leads Table */}
          <div className="flex-1 overflow-y-auto rounded-lg border border-border/50 min-h-0">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm border-b border-border/50 z-10">
                <tr>
                  <th className="w-8 py-2.5 px-3"></th>
                  <th className="py-2.5 px-3 text-left font-semibold text-muted-foreground font-mono uppercase tracking-wider text-[10px]">Company</th>
                  <th className="py-2.5 px-3 text-left font-semibold text-muted-foreground font-mono uppercase tracking-wider text-[10px]">Founder</th>
                  <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground font-mono uppercase tracking-wider text-[10px]">ICP</th>
                  <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground font-mono uppercase tracking-wider text-[10px]">SaaS</th>
                  <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground font-mono uppercase tracking-wider text-[10px]">Emp.</th>
                  <th className="py-2.5 px-3 text-left font-semibold text-muted-foreground font-mono uppercase tracking-wider text-[10px]">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {bulkPreviewLeads.map((lead, i) => {
                  const isSelected = bulkSelectedIndices.includes(i);
                  const hasError = !!(lead as any)._error;
                  return (
                    <tr
                      key={i}
                      onClick={() => setBulkSelectedIndices(prev =>
                        prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
                      )}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-primary/5 hover:bg-primary/8"
                          : "bg-transparent hover:bg-muted/30 opacity-50"
                      } ${hasError ? "bg-rose-500/5" : ""}`}
                    >
                      <td className="py-2.5 px-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            setBulkSelectedIndices(prev =>
                              checked ? [...prev, i] : prev.filter(x => x !== i)
                            );
                          }}
                          onClick={e => e.stopPropagation()}
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          className="w-full bg-transparent text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-1 -mx-1"
                          value={lead.company_name || ""}
                          onClick={e => e.stopPropagation()}
                          onChange={e => setBulkPreviewLeads(prev => {
                            const next = [...prev];
                            next[i] = { ...next[i], company_name: e.target.value };
                            return next;
                          })}
                        />
                        {hasError && (
                          <span className="text-[9px] text-rose-500 font-mono block mt-0.5">extraction failed</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          className="w-full bg-transparent text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-1 -mx-1"
                          value={lead.founder_name || ""}
                          placeholder="Unknown"
                          onClick={e => e.stopPropagation()}
                          onChange={e => setBulkPreviewLeads(prev => {
                            const next = [...prev];
                            next[i] = { ...next[i], founder_name: e.target.value };
                            return next;
                          })}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded border ${getIcpBadgeClass(lead.icp_score ?? null)}`}>
                          {lead.icp_score ?? "—"}/10
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {lead.is_b2b_saas
                          ? <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">Yes</span>
                          : <span className="text-[10px] text-muted-foreground">No</span>
                        }
                      </td>
                      <td className="py-2.5 px-3 text-center text-muted-foreground">
                        {lead.employee_count ?? "—"}
                      </td>
                      <td className="py-2.5 px-3 max-w-[150px]">
                        {lead.product_hunt_url ? (
                          <a
                            href={lead.product_hunt_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-primary hover:underline truncate block text-[10px] font-mono"
                            title={lead.product_hunt_url}
                          >
                            {lead.product_hunt_url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 28)}…
                          </a>
                        ) : (
                          <span className="text-muted-foreground/40 italic">Text paste</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <DialogFooter className="shrink-0 flex-row gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={bulkSaving}
              onClick={() => {
                setShowBulkPreviewModal(false);
                setBulkPreviewLeads([]);
                setBulkSelectedIndices([]);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={bulkSelectedIndices.length === 0 || bulkSaving}
              onClick={handleBulkSave}
              className="gap-1.5"
            >
              {bulkSaving ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</>
              ) : (
                <><CheckCircle2 className="h-3.5 w-3.5" /> Save {bulkSelectedIndices.length} of {bulkPreviewLeads.length} to Pipeline</>
              )}
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

      {/* ── Dialog: View & Edit Notes ── */}
      <Dialog open={activeNotesLead !== null} onOpenChange={(open) => { if (!open) setActiveNotesLead(null); }}>
        <DialogContent className="sm:max-w-[550px] bg-card border border-border/80">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" /> Outreach Notes & Strategy
            </DialogTitle>
            <DialogDescription>
              Analyze and edit strategic notes and outreach recommendations for <strong className="text-foreground">{activeNotesLead?.company_name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="dialog-notes">
                Notes & Strategy (Markdown supported)
              </label>
              <Textarea 
                id="dialog-notes" 
                value={notesDraft} 
                onChange={e => setNotesDraft(e.target.value)}
                className="min-h-[250px] font-sans text-xs bg-background resize-y"
                placeholder="No strategic notes generated yet. Type strategic outreach points here..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setActiveNotesLead(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveNotesDialog}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
