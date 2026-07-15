import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trail } from "@/components/atlas/Trail";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import {
  getGitHubToken,
  fetchUserRepos,
  fetchRepoCommitStats,
  buildDiagnosticFlags,
  runGitHubRulesFallback,
  type GitHubRepo,
  type GitHubStats,
} from "@/lib/github";
import { ArrowLeft, ArrowRight, Github, Plug, Trash, Globe, RefreshCw, Maximize2, Minimize2, ZoomIn, ZoomOut, Sparkles, Compass, Paperclip, FileText, X, Plus, CheckCircle2, AlertCircle, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import { CompassLoader } from "./Home";
import { useIntegrations } from "@/hooks/useIntegrations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

type MapData = {
  id: string;
  name: string;
  goal_statement: string;
  confidence: "starter" | "emerging" | "established";
  is_published: boolean;
  metadata?: any;
};

interface Milestone {
  id: string;
  map_id: string;
  title: string;
  description: string | null;
  sequence: number;
  status: 'pending' | 'active' | 'complete' | 'skipped';
  estimated_start: string | null;
  estimated_complete: string | null;
  actual_complete_at: string | null;
  is_reforecast: boolean;
  metadata?: {
    estimate_range?: string;
    min_weeks?: number;
    max_weeks?: number;
    original_duration_days?: number;
    campaign_index?: number;
  };
  created_at: string;
}

type Waypoint = {
  id?: string;
  kind: "goal" | "constraint" | "evidence" | "move";
  title: string;
  confidence: "starter" | "emerging" | "established";
  metadata?: any;
  completed_at?: string | null;
  predicted_signal?: string | null;
  predicted_direction?: string | null;
  predicted_baseline_value?: string | null;
  check_back_date?: string | null;
  result_status?: string | null;
  result_summary?: string | null;
  milestone_id?: string | null;
};

import { useQueryClient } from "@tanstack/react-query";

export default function MapDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const shouldAutoFocus = searchParams.get("focus") === "1";
  const shouldAutoTour = searchParams.get("tour") === "1";

  const [map, setMap] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncFailed, setSyncFailed] = useState(false);

  // GitHub state
  const [gitHubToken, setGitHubToken] = useState<string | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [gitStats, setGitStats] = useState<GitHubStats | null>(null);
  const [hasGitHubIntegration, setHasGitHubIntegration] = useState(false);
  const [gitHubSessionExpired, setGitHubSessionExpired] = useState(false);
  // When true, the user has explicitly clicked "Change repository" and we
  // show the picker (triggering the live token check at that point only).
  const [changingRepo, setChangingRepo] = useState(false);

  // Waypoints
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);

  // Milestones & Zoom
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [zoomedMilestoneId, setZoomedMilestoneId] = useState<string | null>(null);
  const [generatingRoadmap, setGeneratingRoadmap] = useState(false);
  const [expandedMilestoneHistoryId, setExpandedMilestoneHistoryId] = useState<string | null>(null);
  const [newGoalText, setNewGoalText] = useState("");
  const [startingNewCampaign, setStartingNewCampaign] = useState(false);

  // Focus Mode states — auto-launch if ?focus=1
  const [focusMode, setFocusMode] = useState(shouldAutoFocus);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [expandedWaypoint, setExpandedWaypoint] = useState<number | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showDeleteMapDialog, setShowDeleteMapDialog] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<{ id: string; fileUrl?: string } | null>(null);

  // Inline goal editing
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);
  const goalInputRef = useRef<HTMLTextAreaElement>(null);

  // First-move highlight state
  const [firstMoveHighlighted, setFirstMoveHighlighted] = useState(false);
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);

  // Track viewport size (still needed for focus mode parallax)
  const [vpSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  const startTour = () => {
    const driverInstance = driver({
      showProgress: true,
      animate: true,
      overlayColor: "rgba(0,0,0,0.55)",
      smoothScroll: true,
      allowClose: true,
      onDestroyStarted: () => {
        localStorage.setItem("atlas.tour.seen", "1");
        driverInstance.destroy();
        // After tour — auto-diagnose if not yet done
        const moveWp = document.getElementById("tour-wp-move");
        if (moveWp) setFirstMoveHighlighted(true);
      },
      steps: [
        {
          popover: {
            title: "Your Atlas map is ready",
            description: "Let's walk through it in 60 seconds so you know exactly what you're looking at.",
            side: "over" as any,
            align: "center" as const,
          },
        },
        {
          element: "#tour-wp-goal",
          popover: {
            title: "Your Goal",
            description: "This is what you're working toward. Everything on this map exists to get you here.",
            side: "right" as const,
          },
        },
        {
          element: "#tour-wp-constraint",
          popover: {
            title: "The Constraint",
            description: "This is the biggest thing blocking your goal right now. Atlas identifies this from your connected tools.",
            side: "right" as const,
          },
        },
        {
          element: "#tour-wp-evidence",
          popover: {
            title: "The Evidence",
            description: "Why is this the constraint? These are the signals Atlas pulled from your tools to prove it.",
            side: "right" as const,
          },
        },
        {
          element: "#tour-wp-move",
          popover: {
            title: "Your Next Move ★",
            description: "This is your single, immediate, executable step. Ignore everything else — just do this.",
            side: "right" as const,
          },
        },
        {
          element: "#tour-sync",
          popover: {
            title: "Keep it fresh",
            description: "Re-diagnose any time to update your map with the latest signals from your tools.",
            side: "left" as const,
          },
        },
      ],
    });
    driverRef.current = driverInstance;
    driverInstance.drive();
  };

  // Launch driver.js tour after map + waypoints are ready
  useEffect(() => {
    if (loading || !map || !shouldAutoTour) return;
    const hasSeenTour = localStorage.getItem("atlas.tour.seen");
    if (hasSeenTour) return;

    // Give the DOM a moment to settle after waypoints render
    const timer = setTimeout(() => {
      startTour();
    }, 1200);

    return () => clearTimeout(timer);
  }, [loading, map, shouldAutoTour]);

  useEffect(() => {
    if (focusMode) {
      setShowInstructions(true);
      const timer = setTimeout(() => {
        setShowInstructions(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [focusMode]);

  // Detect prefers-reduced-motion
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Add/remove global transition class on documentElement for sidebar/header/nav fades
  useEffect(() => {
    if (focusMode) {
      document.documentElement.classList.add("focus-mode-active");
      window.dispatchEvent(new CustomEvent("focus-mode-change", { detail: { active: true } }));
    } else {
      document.documentElement.classList.remove("focus-mode-active");
      window.dispatchEvent(new CustomEvent("focus-mode-change", { detail: { active: false } }));
    }
    return () => {
      document.documentElement.classList.remove("focus-mode-active");
      window.dispatchEvent(new CustomEvent("focus-mode-change", { detail: { active: false } }));
    };
  }, [focusMode]);

  // Escape key handler to exit focus mode
  useEffect(() => {
    if (!focusMode && !lightboxUrl) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (lightboxUrl) { setLightboxUrl(null); return; }
        setFocusMode(false);
        setExpandedWaypoint(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusMode, lightboxUrl]);

  // Cursor Parallax Listener for focus mode background
  useEffect(() => {
    if (!focusMode || reducedMotion) {
      setMousePos({ x: 0, y: 0 });
      return;
    }
    const handleMouseMoveGlobal = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX - window.innerWidth / 2) / 40,
        y: (e.clientY - window.innerHeight / 2) / 40,
      });
    };
    window.addEventListener("mousemove", handleMouseMoveGlobal);
    return () => window.removeEventListener("mousemove", handleMouseMoveGlobal);
  }, [focusMode, reducedMotion]);



  const KIND_LABELS: Record<string, string> = {
    goal: "Goal",
    constraint: "Constraint",
    evidence: "Evidence",
    move: "Next move",
  };

  // Manual notes & Attachment Log
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [manualNotesList, setManualNotesList] = useState<any[]>([]);
  const [showAttachForm, setShowAttachForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  // Attachment Log collapsed state: false means collapsed tab, true means fully open card
  const [isAttachmentLogOpen, setIsAttachmentLogOpen] = useState(false);

  // Reactively sync GitHub integration status from global integrations query
  const { data: liveIntegrations = [], connectNotion, connectSlack, connectGitHub } = useIntegrations();
  const liveGitHubConnected = liveIntegrations.some(i => i.provider === "github" && i.status === "active");

  useEffect(() => {
    if (liveGitHubConnected) {
      if (!hasGitHubIntegration) {
        setHasGitHubIntegration(true);
        loadRepoList();
      }
    } else {
      if (hasGitHubIntegration) {
        setHasGitHubIntegration(false);
        setRepos([]);
        setSelectedRepo("");
      }
    }
  }, [liveGitHubConnected]);

  const transformRef = useRef<any>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  // ResizeObserver callback ref attached to the focus container.
  // Triggers centering whenever the measured container size changes or settles.
  const focusContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (node) {
      const observer = new ResizeObserver(() => {
        if (transformRef.current) {
          transformRef.current.centerView(1, 0);
        }
      });
      observer.observe(node);
      observerRef.current = observer;

      // Trigger centering immediately and shortly after layout paints
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (transformRef.current) {
            transformRef.current.centerView(1, 0);
          }
        });
      });
    }
  }, []);

  useEffect(() => {
    if (!id || !user) return;
    loadMap();
    checkGitHub();
  }, [id, user]);

  useEffect(() => {
    if (hasGitHubIntegration && user) {
      loadRepoList();
    }
  }, [hasGitHubIntegration, user]);

  // ─── Inline goal editing ──────────────────────────────────────────────────

  const startEditingGoal = () => {
    if (!map) return;
    setGoalDraft(map.name || map.goal_statement);
    setEditingGoal(true);
    setTimeout(() => goalInputRef.current?.focus(), 50);
  };

  const cancelEditingGoal = () => {
    setEditingGoal(false);
    setGoalDraft("");
  };

  const saveMapName = async () => {
    if (!map || !goalDraft.trim() || goalDraft.trim() === map.name) {
      cancelEditingGoal();
      return;
    }
    setSavingGoal(true);
    try {
      const trimmed = goalDraft.trim();
      const { error } = await supabase
        .from("maps")
        .update({ name: trimmed })
        .eq("id", map.id);
      if (error) throw error;

      setMap({ ...map, name: trimmed });
      toast.success("Map name updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSavingGoal(false);
      setEditingGoal(false);
    }
  };

  // ─── Data Loading ─────────────────────────────────────────────────────────

  const loadMap = async () => {
    try {
      setLoading(true);

      const { data: mapData, error: mapError } = await supabase
        .from("maps")
        .select("id, name, goal_statement, confidence, is_published, metadata")
        .eq("id", id)
        .maybeSingle();

      if (mapError) throw mapError;
      if (!mapData) { toast.error("Map not found"); navigate("/app"); return; }
      setMap(mapData as MapData);

      // Load milestones
      const { data: milestonesData } = await supabase
        .from("milestones")
        .select("*")
        .eq("map_id", id)
        .order("sequence", { ascending: true });
      setMilestones((milestonesData as Milestone[]) || []);

      // Load linked repo
      const { data: sourceData } = await supabase
        .from("sources")
        .select("label")
        .eq("map_id", id)
        .eq("provider", "github")
        .maybeSingle();
      if (sourceData?.label) setSelectedRepo(sourceData.label);

      // Load all manual notes / attachments
      const { data: signalsList } = await supabase
        .from("signals")
        .select("*")
        .eq("map_id", id)
        .eq("title", "__manual_note")
        .order("created_at", { ascending: false });
      
      setManualNotesList(signalsList || []);

      // Load saved waypoints
      const { data: wpData } = await supabase
        .from("waypoints")
        .select("id, kind, title, confidence, metadata, completed_at, predicted_signal, predicted_direction, predicted_baseline_value, check_back_date, result_status, result_summary, milestone_id")
        .eq("map_id", id)
        .order("position", { ascending: true });

      if (wpData && wpData.length > 0) {
        setWaypoints((wpData as any) as Waypoint[]);
      } else {
        // No saved waypoints — show just the goal. The undiagnosed state UI handles the rest.
        setWaypoints([
          { kind: "goal", title: mapData.goal_statement, confidence: "starter" },
        ]);
      }
    } catch (err: any) {
      toast.error(err.message ?? "Failed to load map");
    } finally {
      setLoading(false);
    }
  };

  // checkGitHub: only checks whether the GitHub integration exists in the DB.
  // Does NOT call list_repos — that is deferred to loadRepoList(), which is
  // only triggered when the user explicitly clicks "Change repository".
  const checkGitHub = async () => {
    if (!user) return;
    try {
      const { data: intData } = await supabase
        .from("integrations")
        .select("status")
        .eq("user_id", user.id)
        .eq("provider", "github")
        .maybeSingle();

      const hasGitHubIdentity = !!user.identities?.find(
        (i) => i.provider === "github"
      );

      const isConnected =
        hasGitHubIdentity || (!!intData && intData.status === "active");
      setHasGitHubIntegration(isConnected);

      // If GitHub identity exists but no DB row yet, backfill it now
      if (hasGitHubIdentity && !intData) {
        const ghIdentity = user.identities!.find((i) => i.provider === "github")!;
        const label =
          user.user_metadata?.user_name ||
          user.user_metadata?.full_name ||
          "Connected GitHub";
        await supabase.from("integrations").upsert(
          {
            user_id: user.id,
            provider: "github",
            status: "active",
            external_account_label: label,
            external_account_id: ghIdentity.id,
          },
          { onConflict: "user_id,provider", ignoreDuplicates: true }
        );
      }
    } catch {
      // Silent — integration check failing should not surface UI errors
    }
  };

  // loadRepoList: fetches the live repo list from the Edge Function using the
  // server-stored token. Called only when the user explicitly clicks
  // "Change repository". If the token is stale, sets gitHubSessionExpired.
  const loadRepoList = async () => {
    try {
      const token = await getGitHubToken();
      setGitHubToken(token);

      if (token) {
        const { error: rpcErr } = await supabase.rpc("upsert_github_token" as any, {
          p_token: token,
          p_scopes: "read:user repo",
          p_expires_at: null,
        });
        if (rpcErr) {
          console.warn("[loadRepoList] upsert_github_token RPC failed:", rpcErr.message);
        }
      }

      const { data, error } = await supabase.functions.invoke("sync-github", {
        body: { action: "list_repos", github_token: token || undefined },
      });
      
      if (error) {
        console.error("[loadRepoList] Edge Function invoke error:", error);
        toast.error("Failed to fetch repositories: " + (error.message || "Network error"));
        setGitHubSessionExpired(true);
        return;
      }

      if (data?.error) {
        console.error("[loadRepoList] Edge Function returned error:", data.error);
        toast.error("GitHub integration error: " + data.error);
        setGitHubSessionExpired(true);
        return;
      }

      if (data?.repos) {
        setRepos(data.repos);
        setGitHubSessionExpired(false);
      } else {
        setGitHubSessionExpired(true);
      }
    } catch (e: any) {
      console.error("[loadRepoList] catch error:", e);
      toast.error("Error loading repositories: " + (e.message || "Unknown error"));
      setGitHubSessionExpired(true);
    }
  };

  // ─── Sync + Diagnose ──────────────────────────────────────────────────────

  const fullSync = async (repo: string, mapGoal: string, manualNote: string) => {
    if (!user || !id) return;
    try {
      setSyncing(true);
      setDiagnosisError(null);

      let stats: GitHubStats | null = null;
      const syncPromises: Promise<any>[] = [];

      if (repo) {
        syncPromises.push(
          supabase.functions.invoke("sync-github", {
            body: { map_id: id, repo_full_name: repo, github_token: gitHubToken || undefined },
          }).then(({ data, error }) => {
            if (!error && data) {
              const sd = data as { stats?: GitHubStats };
              if (sd.stats) {
                stats = sd.stats;
                setGitStats(stats);
              }
            } else if (error && gitHubToken) {
              // Fallback to client-side fetch if edge function fails
              const [owner, repoName] = repo.split("/");
              return fetchRepoCommitStats(gitHubToken, owner, repoName).then((s) => {
                stats = s;
                setGitStats(stats);
              }).catch(() => {});
            }
          }).catch(() => {
            // Client-side fallback on error
            if (gitHubToken) {
              const [owner, repoName] = repo.split("/");
              return fetchRepoCommitStats(gitHubToken, owner, repoName).then((s) => {
                stats = s;
                setGitStats(stats);
              }).catch(() => {});
            }
          })
        );
      }

      const hasStripe = liveIntegrations.some(i => i.provider === "stripe" && i.status === "active");
      if (hasStripe) {
        syncPromises.push(
          supabase.functions.invoke("sync-stripe", { body: { map_id: id } })
            .catch((err) => console.warn("[fullSync] sync-stripe failed:", err))
        );
      }

      const hasNotion = liveIntegrations.some(i => i.provider === "notion" && i.status === "active");
      if (hasNotion) {
        syncPromises.push(
          supabase.functions.invoke("sync-notion", { body: { map_id: id } })
            .catch((err) => console.warn("[fullSync] sync-notion failed:", err))
        );
      }

      const hasSlack = liveIntegrations.some(i => i.provider === "slack" && i.status === "active");
      if (hasSlack) {
        syncPromises.push(
          supabase.functions.invoke("sync-slack", { body: { map_id: id } })
            .catch((err) => console.warn("[fullSync] sync-slack failed:", err))
        );
      }

      const hasGoogle = liveIntegrations.some(i => i.provider === "google" && i.status === "active");
      if (hasGoogle) {
        syncPromises.push(
          supabase.functions.invoke("sync-google", { body: { map_id: id } })
            .catch((err) => console.warn("[fullSync] sync-google failed:", err))
        );
      }

      if (syncPromises.length > 0) {
        await Promise.allSettled(syncPromises);
      }

      // Step 2: LLM diagnosis
      let result: { waypoints: Waypoint[] };
      let source: "llm" | "context-only" | "fallback" = "llm";
      try {
        setDiagnosing(true);
        const { data: fnData, error: fnError } = await supabase.functions.invoke("diagnose-map", {
          body: {
            map_id: id,
            manual_notes: manualNote || undefined,
          },
        });
        
        // Handle structured error from edge function (no AI key)
        if (fnData?.error === "no_llm_key") {
          throw Object.assign(new Error(fnData.message || "No AI provider key configured."), { code: "no_llm_key" });
        }
        if (fnError) {
          throw new Error(fnError.message || "Diagnosis failed");
        }

        const llm = fnData as {
          constraint: string;
          evidence: string;
          move: string;
          confidence: string;
          evidence_sources?: Array<{ source: string; detail: string; url?: string | null }>;
          trajectory_summary?: string;
          metrics?: Array<{ metric: string; current: string; target: string; gap_analysis: string }>;
          alternative_paths?: Array<{ name: string; description: string; workload: string }>;
          predicted_signal?: string | null;
          predicted_direction?: string | null;
          predicted_baseline_value?: string | null;
          check_back_date?: string | null;
          result_status?: string | null;
          result_summary?: string | null;
          predicted_signal_type?: string | null;
        };
        const conf = (["emerging", "building", "established"].includes(llm.confidence)
          ? llm.confidence : "emerging") as "emerging" | "established";

        result = {
          waypoints: [
            { kind: "goal", title: mapGoal, confidence: conf },
            {
              kind: "constraint",
              title: llm.constraint,
              confidence: conf,
              metadata: {
                trajectory_summary: llm.trajectory_summary || null,
                metrics: llm.metrics || [],
                alternative_paths: llm.alternative_paths || [],
              }
            },
            { kind: "evidence", title: llm.evidence, confidence: conf },
            {
              kind: "move",
              title: llm.move,
              confidence: "established",
              metadata: {
                evidence: llm.evidence_sources || [],
                predicted_signal_type: llm.predicted_signal_type || "unclear"
              },
              predicted_signal: llm.predicted_signal || null,
              predicted_direction: llm.predicted_direction || null,
              predicted_baseline_value: llm.predicted_baseline_value || null,
              check_back_date: llm.check_back_date || null,
              result_status: llm.result_status || "pending",
              result_summary: llm.result_summary || null,
            } as any,
          ],
        };
        source = (llm.evidence_sources && llm.evidence_sources.length > 0) ? "llm" : "context-only";
      } catch (err: any) {
        // Save the error so we can display a detailed message to the user
        const errorMsg = err.code === "no_llm_key"
          ? "No AI key configured. Add OPENAI_API_KEY or ANTHROPIC_API_KEY to your Supabase Edge Function secrets."
          : (err.message || "An unexpected error occurred during diagnosis. Check your network or keys.");
        setDiagnosisError(errorMsg);

        // Show the user why diagnosis failed instead of silently reverting
        if (err.code === "no_llm_key") {
          toast.error("No AI key configured. Add OPENAI_API_KEY or ANTHROPIC_API_KEY to your Supabase Edge Function secrets.");
        } else {
          toast.error("Diagnosis failed — " + (err.message || "unexpected error. Try again."));
        }
        // Fallback to deterministic if LLM unavailable or AI key missing
        source = "fallback";
        if (stats) {
          result = runGitHubRulesFallback(stats, mapGoal);
        } else {
          result = {
            waypoints: [
              { kind: "goal", title: mapGoal, confidence: "starter" },
              { kind: "constraint", title: "No data sources connected yet.", confidence: "starter" },
              { kind: "evidence", title: "Add a manual note below or connect GitHub/Stripe to generate signals.", confidence: "starter" },
              { kind: "move", title: "Connect a source or add context to get a diagnosis.", confidence: "starter" },
            ],
          };
        }
      } finally {
        setDiagnosing(false);
      }

      setWaypoints(result.waypoints);

      const activeMilestone = milestones.find(m => m.status === "active");

      // Persist waypoints: only delete active ones (keep completed history)
      await supabase.from("waypoints").delete().eq("map_id", id).is("completed_at", null);
      await supabase.from("waypoints").insert(
        result.waypoints.map((w, idx) => {
          const wpObj: any = {
            map_id: id,
            user_id: user.id,
            kind: w.kind,
            title: w.title,
            confidence: w.confidence,
            position: idx,
            metadata: w.metadata || null,
            milestone_id: activeMilestone?.id || null,
          };
          if (w.kind === "move") {
            wpObj.predicted_signal = (w as any).predicted_signal || null;
            wpObj.predicted_direction = (w as any).predicted_direction || null;
            wpObj.predicted_baseline_value = (w as any).predicted_baseline_value || null;
            wpObj.check_back_date = (w as any).check_back_date || null;
            wpObj.result_status = (w as any).result_status || "pending";
            wpObj.result_summary = (w as any).result_summary || null;
          }
          return wpObj;
        })
      );

      // Re-fetch all waypoints from database (both new active and past completed)
      const { data: refreshedWps } = await supabase
        .from("waypoints")
        .select("id, kind, title, confidence, metadata, completed_at, predicted_signal, predicted_direction, predicted_baseline_value, check_back_date, result_status, result_summary, milestone_id")
        .eq("map_id", id)
        .order("position", { ascending: true });
      
      if (refreshedWps) {
        setWaypoints((refreshedWps as any) as Waypoint[]);
      } else {
        setWaypoints(result.waypoints);
      }

      // Update map confidence
      const constraintWp = result.waypoints.find(w => w.kind === "constraint");
      const newConf = constraintWp?.confidence === "established" ? "established" : "emerging";
      await supabase.from("maps").update({ confidence: newConf }).eq("id", id);
      setMap(prev => prev ? { ...prev, confidence: newConf } : null);

      // Auto-trigger roadmap if map just moved past starter confidence
      if (map && map.confidence === "starter" && newConf !== "starter" && milestones.length === 0) {
        toast.info("Goal confidence established. Drafting roadmap campaign...");
        try {
          await supabase.functions.invoke("generate-roadmap", { body: { map_id: id } });
          const { data: msData } = await supabase
            .from("milestones")
            .select("*")
            .eq("map_id", id)
            .order("sequence", { ascending: true });
          if (msData && msData.length > 0) {
            setMilestones(msData as Milestone[]);
            // Re-run sync to get the first active milestone's waypoints
            setTimeout(() => {
              fullSync(repo, mapGoal, manualNote);
            }, 100);
          }
        } catch (roadmapErr) {
          console.error("Auto roadmap generation failed:", roadmapErr);
        }
      }

      setLastSyncedAt(new Date());
      setSyncFailed(false);
      
      // Update custom source tracking state
      (window as any)._lastDiagnosisSource = source;

    } catch (err: any) {
      toast.error(err.message ?? "Sync failed");
      setSyncFailed(true);
      setLastSyncedAt(new Date());
    } finally {
      setSyncing(false);
    }
  };

  const handleLinkRepo = async (repo: string) => {
    if (!user || !map) return;
    setSelectedRepo(repo);
    await supabase.from("sources").delete().eq("map_id", id).eq("provider", "github");
    
    if (repo) {
      await supabase.from("sources").insert({ map_id: id, user_id: user.id, provider: "github", label: repo });
      await fullSync(repo, map.goal_statement, manualNotesList[0]?.payload?.note || "");
      toast.success("Repository linked");
    } else {
      await supabase.from("waypoints").delete().eq("map_id", id).is("completed_at", null);
      setWaypoints([
        { kind: "goal", title: map.goal_statement, confidence: "starter" },
      ]);
      toast.success("Repository disconnected");
    }
  };

  // ─── Manual Note & Attachments Log ─────────────────────────────────────────

  const handleAddAttachment = async () => {
    if (!user || !id || !map) return;
    if (!note.trim() && !selectedFile) {
      toast.error("Please provide a note or select a file.");
      return;
    }

    setSavingNote(true);
    let fileUrl = null;
    let fileName = null;
    let fileType = null;

    try {
      if (selectedFile) {
        setUploadingFile(true);
        const fileExt = selectedFile.name.split(".").pop();
        const cleanName = selectedFile.name.replace(/[^a-zA-Z0-9]/g, "_");
        const filePath = `${user.id}/${Date.now()}_${cleanName}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("attachments")
          .upload(filePath, selectedFile, {
            cacheControl: "3600",
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("attachments")
          .getPublicUrl(filePath);

        fileUrl = publicUrl;
        fileName = selectedFile.name;
        fileType = selectedFile.type;
      }

      const noteText = note.trim();
      
      const payload: any = { note: noteText };
      if (fileUrl) {
        payload.file_url = fileUrl;
        payload.file_name = fileName;
        payload.file_type = fileType;
      }

      const { data: signalData, error: insertError } = await supabase
        .from("signals")
        .insert({
          map_id: id,
          user_id: user.id,
          title: "__manual_note",
          score: 0,
          occurred_at: new Date().toISOString(),
          payload,
        } as any)
        .select()
        .single();

      if (insertError) throw insertError;

      toast.success("Attachment logged");
      
      setManualNotesList(prev => [signalData, ...prev]);
      setNote("");
      setSelectedFile(null);
      setShowAttachForm(false);

      await fullSync(selectedRepo, map.goal_statement, noteText);
    } catch (err: any) {
      toast.error("Failed to save context: " + err.message);
    } finally {
      setUploadingFile(false);
      setSavingNote(false);
    }
  };

  const handleDeleteNote = (signalId: string, fileUrl?: string) => {
    setNoteToDelete({ id: signalId, fileUrl });
  };

  const handleDeleteNoteConfirm = async (signalId: string, fileUrl?: string) => {
    try {
      const { error: dbError } = await supabase
        .from("signals")
        .delete()
        .eq("id", signalId);

      if (dbError) throw dbError;

      if (fileUrl) {
        try {
          const match = fileUrl.match(/\/public\/attachments\/(.+)$/);
          if (match && match[1]) {
            const filePath = decodeURIComponent(match[1]);
            await supabase.storage.from("attachments").remove([filePath]);
          }
        } catch (storageErr) {
          console.warn("Could not delete associated file from storage:", storageErr);
        }
      }

      toast.success("Entry removed");
      
      const updatedList = manualNotesList.filter(n => n.id !== signalId);
      setManualNotesList(updatedList);

      const nextLatest = updatedList[0]?.payload?.note || "";
      if (map) {
        await fullSync(selectedRepo, map.goal_statement, nextLatest);
      }
    } catch (err: any) {
      toast.error("Delete failed: " + err.message);
    }
  };

  const handleReconnectGitHub = () => {
    connectGitHub(window.location.pathname);
  };

  // ─── Feedback ─────────────────────────────────────────────────────────────

  const handleFeedback = async (waypointKind: string, action: string, waypointTitle: string) => {
    if (!user || !id) return;
    await supabase.from("activity_logs").insert({
      user_id: user.id,
      action: `feedback_${action}`,
      target_type: "map",
      target_id: id,
      meta: { waypoint_kind: waypointKind, waypoint_text: waypointTitle },
    } as any);
    if (action === "constraint_wrong") {
      toast.success("Noted — this helps Atlas improve.");
    }
    if (action === "move_done") {
      const activeMove = waypoints.find(w => w.kind === "move" && !w.completed_at);
      if (activeMove && activeMove.id) {
        const { error } = await supabase
          .from("waypoints")
          .update({ completed_at: new Date().toISOString() })
          .eq("id", activeMove.id);
        if (error) {
          toast.error("Failed to mark move as done: " + error.message);
          return;
        }
      }
      toast.success("Next move completed! Re-diagnosing...");
      setFirstMoveHighlighted(false);
      fullSync(selectedRepo, map?.goal_statement || "", manualNotesList[0]?.payload?.note || "");
    }
    if (action === "move_skipped") {
      toast.success("Skipped.");
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────────────

  const handleDelete = () => {
    setShowDeleteMapDialog(true);
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    const { error } = await supabase.from("maps").delete().eq("id", id);
    if (error) { toast.error(error.message); setDeleting(false); return; }
    toast.success("Map deleted");
    navigate("/app");
  };

  const togglePublish = async () => {
    if (!map) return;
    const nextPublished = !map.is_published;
    const { error } = await supabase
      .from("maps")
      .update({ is_published: nextPublished })
      .eq("id", map.id);

    if (error) {
      toast.error(error.message);
    } else {
      setMap(prev => prev ? { ...prev, is_published: nextPublished } : null);
      toast.success(nextPublished ? "Map published to public page" : "Map made private");
    }
  };

  // ─── Roadmap & Campaign Handlers ──────────────────────────────────────────

  const handleGenerateRoadmap = async () => {
    if (!id || !map) return;
    setGeneratingRoadmap(true);
    try {
      const { error } = await supabase.functions.invoke("generate-roadmap", {
        body: { map_id: id },
      });
      if (error) throw error;
      
      toast.success("Roadmap generated!");
      await loadMap();
      // Run first sync scoped to the newly generated active milestone
      await fullSync(selectedRepo, map.goal_statement, manualNotesList[0]?.payload?.note || "");
    } catch (err: any) {
      toast.error("Failed to generate roadmap: " + err.message);
    } finally {
      setGeneratingRoadmap(false);
    }
  };

  const handleCompleteMilestone = async (milestoneId: string) => {
    if (!map) return;
    try {
      // 1. Mark current milestone complete
      const { error: err1 } = await supabase
        .from("milestones")
        .update({
          status: "complete",
          actual_complete_at: new Date().toISOString(),
        })
        .eq("id", milestoneId);
      if (err1) throw err1;

      // 2. Activate next milestone
      const currentMilestone = milestones.find(m => m.id === milestoneId);
      if (!currentMilestone) return;

      const nextMilestone = milestones.find(
        m => m.sequence === currentMilestone.sequence + 1 &&
             (m.metadata?.campaign_index || 1) === (currentMilestone.metadata?.campaign_index || 1)
      );

      if (nextMilestone) {
        // Activate next
        const { error: err2 } = await supabase
          .from("milestones")
          .update({
            status: "active",
            estimated_start: new Date().toISOString().split("T")[0],
          })
          .eq("id", nextMilestone.id);
        if (err2) throw err2;

        toast.success(`Milestone completed. "${nextMilestone.title}" is now active!`);
        setZoomedMilestoneId(nextMilestone.id);
        // Refresh map data and run sync
        await loadMap();
        await fullSync(selectedRepo, map.goal_statement, manualNotesList[0]?.payload?.note || "");
      } else {
        toast.success(`Milestone completed. Campaign completed!`);
        setZoomedMilestoneId(null);
        await loadMap();
      }
    } catch (err: any) {
      toast.error("Failed to complete milestone: " + err.message);
    }
  };

  const handleStartNewCampaign = async (newGoal: string) => {
    if (!id || !map) return;
    try {
      const nextCampaignIndex = (map.metadata?.current_campaign_index || 1) + 1;
      
      // Update map goal and campaign index
      const { error: mapErr } = await supabase
        .from("maps")
        .update({
          goal_statement: newGoal,
          name: newGoal,
          metadata: {
            ...map.metadata,
            current_campaign_index: nextCampaignIndex,
          }
        } as any)
        .eq("id", id);
      if (mapErr) throw mapErr;

      // Clear any active waypoints (completed ones remain in history)
      await supabase.from("waypoints").delete().eq("map_id", id).is("completed_at", null);

      toast.success("New campaign started! Generating roadmap...");
      
      // We invoke generate-roadmap edge function
      const { error: genErr } = await supabase.functions.invoke("generate-roadmap", {
        body: { map_id: id },
      });
      if (genErr) throw genErr;

      // Reload map details
      await loadMap();
      setZoomedMilestoneId(null);
      // Run sync to populate first waypoint trail
      await fullSync(selectedRepo, newGoal, "");
    } catch (err: any) {
      toast.error("Failed to start new campaign: " + err.message);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <CompassLoader />
      </div>
    );
  }
  if (!map) return null;

  const isBusy = syncing || diagnosing;
  // "Not yet diagnosed" = only has the goal waypoint, OR has default starter text constraints
  const isUndiagnosed = (waypoints.length <= 1 || 
    waypoints.some(w => w.kind === "constraint" && 
      (w.title.includes("No data sources connected yet.") || 
       w.title.includes("Connect a source to generate a constraint.") ||
       w.title.includes("Connect a source to get a diagnosis.")
      )
    )
  ) && !syncing && !diagnosing;

  return (
    <div className="w-full">
      <div className="mx-auto max-w-2xl px-4 py-10 md:px-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link to="/app" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={startTour}
              className="text-muted-foreground hover:bg-muted/10 gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              <span>Tour</span>
            </Button>
            <Button
              id="tour-focus"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (focusMode) {
                  setFocusMode(false);
                  setExpandedWaypoint(null);
                } else {
                  setFocusMode(true);
                }
              }}
              className={`gap-1.5 ${focusMode ? "text-primary bg-primary/10" : "text-primary hover:bg-primary/10"}`}
            >
              {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              <span>{focusMode ? "Exit Focus" : "Focus Mode"}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={togglePublish}
              className={`gap-1.5 ${map.is_published ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-muted/10"}`}
            >
              <Globe className="h-4.5 w-4.5" />
              <span>{map.is_published ? "Published" : "Private"}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleting}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive">
              <Trash className="h-4 w-4 mr-1" /> Delete
            </Button>
          </div>
        </div>

        {/* Goal */}
        <div className="mt-8 relative pl-8 ml-[9px] border-l-[2.5px] border-primary/25 pb-4">
          <div className="absolute -left-[10.5px] top-1.5">
            <svg width="18" height="18" viewBox="0 0 22 22" aria-hidden="true" className="shrink-0">
              <circle cx="11" cy="11" r="8" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="2.5" />
              <circle cx="11" cy="11" r="4.5" fill="hsl(var(--primary))" />
            </svg>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedRepo && (
              <div className="flex items-center gap-1.5 animate-in fade-in duration-200">
                <span className="flex items-center gap-1 rounded-md border border-border/60 bg-card px-2.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  <Github className="h-3 w-3" /> {selectedRepo}
                </span>
                <button
                  type="button"
                  onClick={() => handleLinkRepo("")}
                  className="font-mono text-[10px] text-muted-foreground hover:text-foreground underline select-none"
                  title="Disconnect repository"
                >
                  change
                </button>
              </div>
            )}
            {liveIntegrations.map((integration) => {
              if (integration.status !== "active") return null;
              if (integration.provider === "github") return null;
              
              const providerLabels: Record<string, string> = {
                notion: "Notion",
                stripe: "Stripe",
                slack: "Slack",
                google: "Google Workspace",
              };
              
              return (
                <span key={integration.id} className="flex items-center gap-1 rounded-md border border-border/60 bg-card px-2.5 py-0.5 font-mono text-[10px] text-muted-foreground animate-in fade-in duration-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {providerLabels[integration.provider] || integration.provider}
                </span>
              );
            })}

            {!isUndiagnosed && !isBusy && (
              <button
                type="button"
                onClick={() => map && fullSync(selectedRepo, map.goal_statement, manualNotesList[0]?.payload?.note || "")}
                className="flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-0.5 font-mono text-[10px] text-primary hover:bg-primary/10 transition-colors"
                title="Sync integrations and re-run diagnosis"
              >
                <RefreshCw className="h-2.5 w-2.5 animate-hover-spin" />
                <span>Sync & Diagnose</span>
              </button>
            )}

            {isBusy && (
              <span className="font-mono text-[10px] text-muted-foreground animate-pulse">
                {diagnosing ? "Atlas is reading your signals…" : "Syncing…"}
              </span>
            )}
          </div>
          {editingGoal ? (
            <div className="mt-3 flex items-start gap-2">
              <textarea
                ref={goalInputRef}
                value={goalDraft}
                onChange={e => setGoalDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveMapName(); }
                  if (e.key === "Escape") cancelEditingGoal();
                }}
                rows={2}
                className="flex-1 resize-none rounded-xl border border-primary/40 bg-background/60 px-4 py-2 font-display text-2xl font-semibold leading-tight md:text-3xl lg:text-[34px] tracking-tight text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
              <div className="flex flex-col gap-1.5 pt-1">
                <button
                  onClick={saveMapName}
                  disabled={savingGoal}
                  className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  title="Save (Enter)"
                >
                  {savingGoal ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={cancelEditingGoal}
                  className="flex items-center justify-center h-8 w-8 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                  title="Cancel (Esc)"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 group flex items-start gap-2">
              <h1 className="font-display text-2xl font-semibold leading-tight md:text-3xl lg:text-[34px] tracking-tight text-foreground">
                {map.name || map.goal_statement}
              </h1>
              <button
                onClick={startEditingGoal}
                className="mt-1 shrink-0 opacity-0 group-hover:opacity-100 flex items-center justify-center h-7 w-7 rounded-lg border border-border/50 bg-background/60 text-muted-foreground hover:text-foreground hover:border-border transition-all duration-150"
                title="Rename map"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}
          {/* Goal statement sub-field */}
          <div className="mt-2 flex items-start gap-1.5">
            <span className="mt-0.5 shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">Goal</span>
            <p className="text-sm text-muted-foreground leading-relaxed">{map.goal_statement}</p>
          </div>
        </div>

        {/* Trail OR Undiagnosed State */}
        <div className="mt-14" id="tour-trail">
          {syncFailed && lastSyncedAt && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
              <RefreshCw className="h-3.5 w-3.5 shrink-0" />
              <span>
                Last updated {lastSyncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — refresh failed, showing cached diagnosis.
              </span>
              <button
                onClick={() => map && fullSync(selectedRepo, map.goal_statement, manualNotesList[0]?.payload?.note || "")}
                disabled={isBusy}
                className="ml-auto shrink-0 font-medium underline hover:no-underline disabled:opacity-50"
              >
                Retry
              </button>
            </div>
          )}

          {/* Fallback estimation warning (e.g. no AI key set in Supabase) */}
          {!isUndiagnosed && (window as any)._lastDiagnosisSource === "fallback" && (
            <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2.5 animate-in fade-in duration-200">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/10 font-bold font-mono">!</span>
              <div>
                <p className="font-semibold">AI key not configured</p>
                <p className="mt-0.5 text-muted-foreground leading-relaxed">Atlas is currently estimating constraints using built-in deterministic rules. Configure an AI API key in your Supabase project secrets to activate full signal analysis.</p>
              </div>
            </div>
          )}

          {diagnosing ? (
            <DiagnoseLoader goalStatement={map.goal_statement} integrations={liveIntegrations} />
          ) : isUndiagnosed ? (
            <UndiagnosedState
              goalStatement={map.goal_statement}
              integrations={liveIntegrations}
              hasGitHub={hasGitHubIntegration}
              hasRepo={!!selectedRepo}
              isBusy={isBusy}
              diagnosing={diagnosing}
              syncing={syncing}
              hasNotes={manualNotesList.length > 0}
              diagnosisError={diagnosisError}
              repos={repos}
              selectedRepo={selectedRepo}
              onLinkRepo={handleLinkRepo}
              onDiagnose={() => fullSync(selectedRepo, map.goal_statement, manualNotesList[0]?.payload?.note || "")}
              onConnectSource={handleReconnectGitHub}
              onConnectNotion={connectNotion}
              onConnectSlack={connectSlack}
              onConnectToken={async (provider, token) => {
                const rpcMap: Record<string, string> = {
                  stripe: "upsert_stripe_token",
                  github: "upsert_github_token",
                };
                const rpc = rpcMap[provider];
                if (!rpc) return;
                const { error } = await supabase.rpc(rpc as any, { p_token: token });
                if (error) throw error;
                qc.invalidateQueries({ queryKey: ["integrations", user?.id] });
              }}
              onSaveNote={async (text, file) => {
                if (!user || !id) return;
                
                let fileUrl = null;
                let fileName = null;
                let fileType = null;
                
                if (file) {
                  const fileExt = file.name.split(".").pop();
                  const cleanName = file.name.replace(/[^a-zA-Z0-9]/g, "_");
                  const filePath = `${user.id}/${Date.now()}_${cleanName}.${fileExt}`;
                  const { error: uploadErr } = await supabase.storage
                    .from("attachments")
                    .upload(filePath, file);
                  if (uploadErr) throw uploadErr;
                  const { data: { publicUrl } } = supabase.storage
                    .from("attachments")
                    .getPublicUrl(filePath);
                  fileUrl = publicUrl;
                  fileName = file.name;
                  fileType = file.type;
                }
                
                const payload: any = { note: text };
                if (fileUrl) {
                  payload.file_url = fileUrl;
                  payload.file_name = fileName;
                  payload.file_type = fileType;
                }
                
                const { data: signalData, error: insertError } = await supabase
                  .from("signals")
                  .insert({
                    map_id: id,
                    user_id: user.id,
                    title: "__manual_note",
                    score: 0,
                    occurred_at: new Date().toISOString(),
                    payload,
                  } as any)
                  .select()
                  .single();
                  
                if (insertError) throw insertError;
                
                setManualNotesList(prev => [signalData, ...prev]);
                await fullSync(selectedRepo, map.goal_statement, text);
              }}
            />
          ) : (
            <>
              {(() => {
                const isCampaignComplete = milestones.length > 0 && milestones.every(m => m.status === "complete");
                if (isCampaignComplete) {
                  const heldCount = waypoints.filter(w => w.kind === "move" && w.result_status === "held").length;
                  const missedCount = waypoints.filter(w => w.kind === "move" && w.result_status === "missed").length;
                  const totalCompleted = milestones.length;
                  
                  let estimatedWeeks = 0;
                  milestones.forEach(m => {
                    estimatedWeeks += m.metadata?.max_weeks || 2;
                  });

                  let actualWeeks = 1;
                  if (milestones.length > 0) {
                    const start = new Date(milestones[0].created_at).getTime();
                    const end = new Date(milestones[milestones.length - 1].actual_complete_at || new Date().toISOString()).getTime();
                    actualWeeks = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24 * 7)));
                  }

                  return (
                    <div className="rounded-[16px] border border-emerald-500/20 bg-emerald-500/5 p-6 animate-in fade-in duration-300">
                      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-4 font-bold">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        Campaign Completed
                      </div>
                      <h3 className="font-display font-semibold text-lg text-foreground">
                        Goal Achieved: {map.goal_statement}
                      </h3>
                      
                      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-b border-border/40 py-4 font-mono text-xs text-muted-foreground">
                        <div>
                          <span className="text-[10px] text-muted-foreground/60 block uppercase">Milestones</span>
                          <strong className="text-foreground text-sm">{totalCompleted} completed</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground/60 block uppercase">Timeline</span>
                          <strong className="text-foreground text-sm">Est. {estimatedWeeks}w vs Act. {actualWeeks}w</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground/60 block uppercase">Moves Held</span>
                          <strong className="text-[hsl(var(--source))] text-sm">{heldCount} verified</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground/60 block uppercase">Moves Missed</span>
                          <strong className="text-foreground text-sm">{missedCount} missed</strong>
                        </div>
                      </div>

                      <div className="mt-6">
                        <label className="block text-xs font-mono uppercase text-muted-foreground mb-2">What is your next campaign goal?</label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="e.g. Expand to first 50 customers"
                            value={newGoalText}
                            onChange={(e) => setNewGoalText(e.target.value)}
                            className="bg-background/60"
                          />
                          <Button
                            onClick={async () => {
                              if (!newGoalText.trim()) return;
                              setStartingNewCampaign(true);
                              await handleStartNewCampaign(newGoalText.trim());
                              setNewGoalText("");
                              setStartingNewCampaign(false);
                            }}
                            disabled={startingNewCampaign || !newGoalText.trim()}
                            className="bg-primary text-primary-foreground shrink-0 rounded-lg"
                          >
                            {startingNewCampaign ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Launch Campaign"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                }

                // If milestones exist but campaign is not yet complete
                if (milestones.length > 0) {
                  const activeMilestone = milestones.find(m => m.status === "active");
                  return (
                    <div className="space-y-8 animate-in fade-in duration-300">
                      {/* Vertical Roadmap Timeline */}
                      <div className="rounded-[16px] border border-border bg-card/30 p-5">
                        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-primary mb-4 font-bold">
                          <Compass className="h-3.5 w-3.5" />
                          Campaign Roadmap
                        </div>
                        <ol className="relative pl-4 border-l border-primary/20 space-y-5">
                          {milestones.map((m, idx) => {
                            const isActive = m.status === "active";
                            const isComplete = m.status === "complete";
                            
                            return (
                              <li key={m.id} className="relative">
                                {/* Indicator circle */}
                                <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border border-primary bg-background ${isComplete ? "bg-primary" : ""} ${isActive ? "ring-4 ring-primary/15 bg-primary" : ""}`} />
                                
                                <div className="flex justify-between items-start gap-4">
                                  <div className="flex-1 cursor-pointer" onClick={() => isComplete && setExpandedMilestoneHistoryId(expandedMilestoneHistoryId === m.id ? null : m.id)}>
                                    <h5 className={`font-display text-sm font-semibold leading-tight flex items-center gap-1.5 ${isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground transition-colors"}`}>
                                      Milestone {idx + 1}: {m.title}
                                      {isComplete && (
                                        <span className="text-[9px] font-normal text-muted-foreground/60 select-none">
                                          ({expandedMilestoneHistoryId === m.id ? "click to collapse" : "click to view proof"})
                                        </span>
                                      )}
                                    </h5>
                                    <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                                  </div>
                                  <div className="flex flex-col items-end shrink-0">
                                    <span className="font-mono text-[9px] text-muted-foreground/80">
                                      Est. {m.metadata?.estimate_range || "2–3 weeks"}
                                    </span>
                                    {m.is_reforecast && (
                                      <span className="text-[7px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-semibold mt-1">
                                        updated
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Read-Only Proof layer for completed milestones */}
                                {isComplete && expandedMilestoneHistoryId === m.id && (
                                  <div className="mt-4 p-4 rounded-xl border border-border bg-muted/15 max-w-xl animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/75 mb-3 font-semibold">Resolved Trail Record (Read-Only)</div>
                                    <Trail
                                      waypoints={waypoints.filter(w => w.milestone_id === m.id)}
                                      interactive={false}
                                    />
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ol>
                      </div>

                      {/* Active Milestone Trail */}
                      {activeMilestone && (
                        <div className="space-y-4">
                          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between">
                            <div>
                              <span className="font-mono text-[9px] uppercase tracking-widest text-primary font-bold">Active Milestone</span>
                              <h4 className="font-display font-semibold text-base text-foreground mt-0.5">{activeMilestone.title}</h4>
                            </div>
                            <span className="font-mono text-xs text-muted-foreground shrink-0 bg-background/60 border border-border/40 px-2.5 py-1 rounded">
                              Est. {activeMilestone.metadata?.estimate_range || "2–3 weeks"}
                            </span>
                          </div>
                          
                          <Trail
                            waypoints={waypoints.filter(w => w.milestone_id === activeMilestone.id && w.kind !== "goal" && !w.completed_at)}
                            onFeedback={handleFeedback}
                          />

                          <div className="flex justify-end pt-2">
                            <Button
                              onClick={() => handleCompleteMilestone(activeMilestone.id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full gap-1.5 text-xs shadow-sm"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Mark milestone complete</span>
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                // If milestones have not been generated (Starter Map phase)
                return (
                  <div className="space-y-8 animate-in fade-in duration-300">
                    <Trail
                      waypoints={waypoints.filter(w => w.kind !== "goal" && !w.completed_at)}
                      onFeedback={handleFeedback}
                    />

                    {map.confidence !== "starter" && (
                      <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-5 text-center">
                        <h4 className="font-display font-semibold text-foreground text-sm">Generate Strategic Roadmap</h4>
                        <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">Atlas will analyze your goal and signals to draft a sequence of range-estimated milestones.</p>
                        <Button
                          onClick={handleGenerateRoadmap}
                          disabled={generatingRoadmap}
                          size="sm"
                          className="mt-4 gap-1.5 bg-primary text-primary-foreground"
                        >
                          {generatingRoadmap ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Compass className="h-3.5 w-3.5" />}
                          <span>Generate Roadmap</span>
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Achievement History */}
              {(() => {
                const completedMoves = waypoints.filter(w => w.kind === "move" && w.completed_at);
                if (completedMoves.length === 0) return null;
                return (
                  <div className="mt-12 rounded-[16px] border border-border/50 bg-card/45 p-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-primary mb-4">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      Achievement History ({completedMoves.length})
                    </div>
                    <ul className="space-y-3">
                      {completedMoves.map((wp, idx) => (
                        <li key={wp.id || idx} className="flex items-start gap-2.5 text-sm text-foreground/80 font-display">
                          <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[10px]">
                            ✓
                          </span>
                          <span>{wp.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
            </>
          )}
        </div>

      {/* ── Attachment Lightbox Overlay ── */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <div
            className="relative max-w-[92vw] max-h-[90vh] overflow-auto rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxUrl}
              alt="Attachment"
              className="rounded-xl object-contain max-w-[92vw] max-h-[88vh]"
            />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
              aria-label="Close image"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {focusMode && (
        <div ref={focusContainerRef} className="fixed inset-0 z-50 bg-background grain select-none overflow-hidden">
          {/* Immersive Background: Grid Dots with Parallax */}
          <div
            className="absolute inset-0 bg-grid-dots transition-transform duration-200 pointer-events-none"
            style={{
              transform: reducedMotion
                ? undefined
                : `translate3d(${-mousePos.x + (panOffset.x * 0.04)}px, ${-mousePos.y + (panOffset.y * 0.04)}px, 0)`,
              opacity: 0.8,
            }}
          />

          {/* Topographic Contour Rings with slow drift and parallax */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none transition-transform duration-300 opacity-[0.08] overflow-hidden"
            style={{
              transform: reducedMotion
                ? "scale(1.05)"
                : `translate3d(${-mousePos.x * 1.5 + (panOffset.x * 0.08)}px, ${-mousePos.y * 1.5 + (panOffset.y * 0.08)}px, 0) scale(${1.05 + (zoom - 1) * 0.2})`,
            }}
          >
            {/* Concentric Group 1 (Top Left area) */}
            <g className="animate-contour-drift-slow text-primary/45" style={{ transformOrigin: "35% 35%" }}>
              <path d="M 250 300 C 300 320, 330 290, 350 230 C 370 170, 320 140, 250 160 C 180 180, 150 220, 170 270 C 190 320, 210 290, 250 300 Z" fill="none" stroke="currentColor" strokeWidth="1.25" />
              <path d="M 250 300 C 320 350, 370 310, 400 230 C 430 150, 360 100, 250 120 C 140 140, 100 200, 130 290 C 160 380, 180 300, 250 300 Z" fill="none" stroke="currentColor" strokeWidth="1" />
              <path d="M 250 300 C 350 380, 420 340, 450 230 C 480 120, 390 70, 250 90 C 110 110, 60 180, 90 310 C 120 440, 150 320, 250 300 Z" fill="none" stroke="currentColor" strokeWidth="0.75" />
            </g>

            {/* Concentric Group 2 (Bottom Right area) */}
            <g className="animate-contour-drift-medium text-primary/35" style={{ transformOrigin: "70% 65%" }}>
              <path d="M 750 450 C 800 470, 840 430, 860 360 C 880 290, 820 250, 750 270 C 680 290, 640 340, 660 400 C 680 460, 700 430, 750 450 Z" fill="none" stroke="currentColor" strokeWidth="1.25" />
              <path d="M 750 450 C 830 500, 890 460, 920 360 C 950 260, 870 200, 750 220 C 630 240, 570 310, 610 430 C 650 550, 670 420, 750 450 Z" fill="none" stroke="currentColor" strokeWidth="1" />
            </g>
          </svg>

          {/* Interactive Drag/Pan Canvas using react-zoom-pan-pinch */}
          <div className="absolute inset-0 w-full h-full overflow-hidden">
            <TransformWrapper
              ref={transformRef}
              initialScale={1}
              minScale={0.5}
              maxScale={2.5}
              limitToBounds={false}
              centerOnInit={false}
              onTransform={(ref) => {
                setZoom(ref.state.scale);
                setPanOffset({ x: ref.state.positionX, y: ref.state.positionY });
              }}
            >
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  {/* Floating Zoom Controls & Exit */}
                  <div className="absolute top-6 left-6 right-6 z-20 flex items-center justify-between pointer-events-none">
                    <div className="pointer-events-auto flex items-center gap-3 bg-card/90 backdrop-blur-md px-4 py-2 rounded-full border border-border shadow-sm">
                      <span className="font-mono text-xs text-primary uppercase font-bold tracking-wider">Immersive View</span>
                      <span className="text-border">|</span>
                      <span className="text-xs text-muted-foreground max-w-sm truncate font-medium">{map.goal_statement}</span>
                    </div>
                    <div className="pointer-events-auto flex items-center gap-2">
                      <div className="flex items-center bg-card/90 backdrop-blur-md rounded-full border border-border p-1 shadow-sm">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => zoomOut()}>
                          <ZoomOut className="h-4 w-4" />
                        </Button>
                        <span className="font-mono text-[10px] px-2 text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => zoomIn()}>
                          <ZoomIn className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-[10px] font-mono px-2" onClick={() => resetTransform()}>
                          Reset
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => { setFocusMode(false); setExpandedWaypoint(null); }}
                        className="bg-card/90 backdrop-blur-md shadow-sm gap-1.5 rounded-full"
                      >
                        <Minimize2 className="h-4.5 w-4.5" />
                        <span>Close Focus</span>
                      </Button>
                    </div>
                  </div>

                  <TransformComponent
                    wrapperClass="!w-full !h-full"
                    contentClass="cursor-grab active:cursor-grabbing flex items-center justify-center"
                  >
                    <div className="relative w-[90vw] max-w-5xl p-8 bg-card/75 backdrop-blur-md border border-border/80 rounded-2xl shadow-xl pointer-events-auto select-text mx-4 my-8">
                      {milestones.length > 0 && zoomedMilestoneId === null ? (
                        /* ── Zoomed-out Roadmap view ── */
                        <div className="flex flex-col items-center w-full">
                          <div className="mb-6 text-center">
                            <h2 className="text-xs font-mono uppercase tracking-widest text-primary mb-1">Roadmap</h2>
                            <p className="text-[11px] text-muted-foreground">Select a milestone pin below to view its strategic detail</p>
                          </div>
                          <div className="relative w-full py-10 px-8">
                            {/* Dotted path line connecting milestone pins */}
                            <div className="absolute left-16 right-16 top-[54px] h-[2px] pointer-events-none" aria-hidden="true">
                              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
                                <line
                                  x1="0"
                                  y1="1"
                                  x2="100%"
                                  y2="1"
                                  stroke="hsl(var(--primary) / 0.4)"
                                  strokeWidth="2.5"
                                  strokeDasharray="6 4"
                                  className="flow-line"
                                />
                              </svg>
                            </div>
                            
                            <ol className="relative z-10 flex flex-row justify-between items-center w-full gap-4">
                              {milestones.map((m, idx) => {
                                const isActive = m.status === "active";
                                const isComplete = m.status === "complete";
                                const pinStroke = "hsl(var(--primary))";
                                const pinFill = isComplete ? pinStroke : "hsl(var(--background))";
                                
                                return (
                                  <li
                                    key={m.id}
                                    onClick={() => setZoomedMilestoneId(m.id)}
                                    className="group flex flex-col items-center cursor-pointer text-center flex-1 max-w-[180px]"
                                  >
                                    <div className="relative mb-4 flex justify-center items-center h-10 w-10 rounded-full hover:scale-105 transition-transform duration-200">
                                      {isActive && (
                                        <div className="absolute h-[34px] w-[34px] pointer-events-none rounded-full border border-primary/60 sonar-ring" />
                                      )}
                                      <svg width="26" height="26" viewBox="0 0 22 22" aria-hidden="true" className="shrink-0">
                                        <circle cx="11" cy="11" r="8" fill={pinFill} stroke={pinStroke} strokeWidth="2" />
                                        {isActive && <circle cx="11" cy="11" r="4" fill={pinStroke} />}
                                      </svg>
                                      {isActive && (
                                        <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-emerald-500 rounded-full border-2 border-background animate-pulse" />
                                      )}
                                    </div>
                                    <div className="flex flex-col items-center">
                                      <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground/60 mb-0.5">
                                        Milestone {idx + 1}
                                      </span>
                                      <h3 className="font-display text-xs font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 px-1">
                                        {m.title}
                                      </h3>
                                      <span className="mt-1.5 inline-flex items-center gap-1 font-mono text-[8px] text-muted-foreground/80">
                                        Est. {m.metadata?.estimate_range || "2–3 weeks"}
                                        {m.is_reforecast && (
                                          <span className="text-[7px] bg-muted/65 px-1 py-0.25 rounded text-muted-foreground font-semibold">
                                            updated
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  </li>
                                );
                              })}
                            </ol>
                          </div>
                        </div>
                      ) : (
                        /* ── Zoomed-in Milestone or Starter Map view ── */
                        <div className="flex flex-col w-full">
                          {zoomedMilestoneId && (
                            <div className="flex justify-between items-center mb-6 pb-4 border-b border-border/40">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setZoomedMilestoneId(null)}
                                className="gap-1.5 rounded-full hover:bg-muted/10 text-muted-foreground hover:text-foreground text-xs"
                              >
                                <ArrowLeft className="h-3.5 w-3.5" />
                                <span>Back to Roadmap</span>
                              </Button>
                              
                              {(() => {
                                const zm = milestones.find(m => m.id === zoomedMilestoneId);
                                if (!zm) return null;
                                return (
                                  <div className="text-right">
                                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                                      Milestone {zm.sequence + 1} ({zm.status})
                                    </div>
                                    <div className="text-sm font-semibold font-display text-foreground">{zm.title}</div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                          
                          <Trail
                            waypoints={
                              zoomedMilestoneId
                                ? waypoints.filter(w => w.milestone_id === zoomedMilestoneId && (zoomedMilestoneId === milestones.find(m => m.status === 'active')?.id ? !w.completed_at : true))
                                : waypoints.filter(w => !w.completed_at)
                            }
                            onFeedback={handleFeedback}
                            interactive={
                              zoomedMilestoneId
                                ? milestones.find(m => m.id === zoomedMilestoneId)?.status === "active"
                                : true
                            }
                            layout="horizontal"
                          />
                          
                          {/* Mark complete option in focus mode zoomed-in detail */}
                          {zoomedMilestoneId && milestones.find(m => m.id === zoomedMilestoneId)?.status === "active" && (
                            <div className="mt-6 pt-4 border-t border-border/40 flex justify-end">
                              <Button
                                onClick={() => handleCompleteMilestone(zoomedMilestoneId)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full gap-1.5 text-xs shadow-sm"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Mark milestone complete</span>
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          </div>
          {/* Bottom instruction bar */}
          <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 bg-card/90 backdrop-blur-md border border-border px-5 py-2 rounded-full text-xs text-muted-foreground font-mono shadow-sm pointer-events-none select-none z-20 transition-all duration-700 ${showInstructions ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
            Drag to Pan · Scroll or Pinch to Zoom · Click Waypoint to Expand Details · Press Esc to Exit
          </div>
        </div>
      )}


      {/* Confirmation Dialog for Map Deletion */}
      <AlertDialog open={showDeleteMapDialog} onOpenChange={setShowDeleteMapDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this map?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this map and remove all of its associated signals and waypoints. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog for Context Entry Deletion */}
      <AlertDialog open={!!noteToDelete} onOpenChange={(open) => !open && setNoteToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove context entry?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this context entry? This will re-diagnose your map signals without this context.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (noteToDelete) {
                  handleDeleteNoteConfirm(noteToDelete.id, noteToDelete.fileUrl);
                  setNoteToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}

// ── UndiagnosedState ────────────────────────────────────────────────────────

// ── UndiagnosedState ────────────────────────────────────────────────────────

function UndiagnosedState({
  goalStatement,
  integrations,
  hasGitHub,
  hasRepo,
  isBusy,
  diagnosing,
  syncing,
  hasNotes,
  diagnosisError,
  repos,
  selectedRepo,
  onLinkRepo,
  onDiagnose,
  onConnectSource,
  onConnectNotion,
  onConnectSlack,
  onConnectToken,
  onSaveNote,
}: {
  goalStatement: string;
  integrations: Array<{ provider: string; status: string }>;
  hasGitHub: boolean;
  hasRepo: boolean;
  isBusy: boolean;
  diagnosing: boolean;
  syncing: boolean;
  hasNotes?: boolean;
  diagnosisError?: string | null;
  repos: GitHubRepo[];
  selectedRepo: string;
  onLinkRepo: (repo: string) => void;
  onDiagnose: () => void;
  onConnectSource: () => void;
  onConnectNotion?: () => void;
  onConnectSlack?: () => void;
  onConnectToken?: (provider: string, token: string) => Promise<void>;
  onSaveNote?: (text: string, file: File | null) => Promise<void>;
}) {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [hoveredSource, setHoveredSource] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [repoSelect, setRepoSelect] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const sources = [
    {
      id: "github",
      name: "GitHub",
      active: hasGitHub,
      icon: <Github className="h-5 w-5 shrink-0" />,
      tagline: "Sync pull requests, commit rates, and issue signals.",
      type: "oauth"
    },
    {
      id: "stripe",
      name: "Stripe",
      active: integrations.some(i => i.provider === "stripe" && i.status === "active"),
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current shrink-0">
          <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
        </svg>
      ),
      tagline: "Import MRR growth metrics and customer count signals.",
      type: "token",
      placeholder: "sk_live_...",
      rpc: "upsert_stripe_token"
    },
    {
      id: "notion",
      name: "Notion",
      active: integrations.some(i => i.provider === "notion" && i.status === "active"),
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current shrink-0">
          <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
        </svg>
      ),
      tagline: "Sync internal workspace updates, wiki pages, and tasks.",
      type: "oauth"
    },
    {
      id: "slack",
      name: "Slack",
      active: integrations.some(i => i.provider === "slack" && i.status === "active"),
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current shrink-0">
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
        </svg>
      ),
      tagline: "Sync communication velocity and channel activity.",
      type: "oauth"
    }
  ];

  const visibleSources = sources.filter(s => !s.active);
  const anyConnected = hasGitHub || hasRepo || integrations.some(i => i.status === "active");
  const isReadyToDiagnose = anyConnected || hasNotes;

  const handleConnectToken = async (provider: string) => {
    if (!tokenInput.trim() || !onConnectToken) return;
    setSubmitting(true);
    try {
      await onConnectToken(provider, tokenInput.trim());
      toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} connected!`);
      setActiveDropdown(null);
      setTokenInput("");
    } catch (err: any) {
      toast.error(err.message || `Failed to connect ${provider}.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveNote = async () => {
    if (!noteInput.trim() && !selectedFile) return;
    if (!onSaveNote) return;
    setSubmitting(true);
    try {
      await onSaveNote(noteInput.trim(), selectedFile);
      toast.success("Context note saved!");
      setActiveDropdown(null);
      setNoteInput("");
      setSelectedFile(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to save note.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSource = sources.find(s => s.id === activeDropdown);

  return (
    <div className="relative space-y-4">
      {/* Goal waypoint — real data */}
      <div className="relative pl-8">
        <svg className="absolute left-[9px] top-3 h-[60px] w-[4px] pointer-events-none" aria-hidden="true">
          <line x1="2" y1="0" x2="2" y2="60" stroke="hsl(var(--primary) / 0.4)" strokeWidth="2.5" strokeDasharray="4 4" />
        </svg>
        <div className="absolute -left-[0.5px] top-1">
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" className="shrink-0">
            <circle cx="11" cy="11" r="8" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="1.75" />
            <circle cx="11" cy="11" r="4.5" fill="hsl(var(--primary))" />
          </svg>
        </div>
        <div className="eyebrow text-primary mb-2">Goal</div>
        <h3 className="font-display text-2xl md:text-[26px] leading-snug text-foreground">
          {goalStatement}
        </h3>
      </div>

      {/* Not yet diagnosed card */}
      <div className="relative pl-8">
        <div className="absolute -left-[0.5px] top-5">
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" className="shrink-0 opacity-30">
            <circle cx="11" cy="11" r="8" fill="hsl(var(--background))" stroke="hsl(var(--muted-foreground))" strokeWidth="1.75" strokeDasharray="3 3" />
          </svg>
        </div>

        <div className="rounded-[18px] border border-dashed border-border bg-card/50 px-6 py-8 space-y-6">
          {/* Title */}
          <div>
            <div className="eyebrow text-muted-foreground/70 mb-1">Constraint</div>
            <p className="font-display text-xl font-medium text-muted-foreground">
              Awaiting first diagnosis
            </p>
            <p className="mt-1 text-sm text-muted-foreground/70 leading-relaxed">
              Connect a recommended data source or add a context note to map your dominant constraint.
            </p>
          </div>

          {/* Diagnosis Failure Warning */}
          {diagnosisError && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3.5 text-xs text-destructive flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Diagnosis Failed</p>
                <p className="mt-0.5 text-muted-foreground/80 leading-relaxed">{diagnosisError}</p>
              </div>
            </div>
          )}

          {/* Recommended integrations row */}
          {visibleSources.length > 0 || !hasNotes ? (
            <div className="space-y-3">
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/80 font-semibold block">
                Connect Recommended Signals
              </label>
              
              <div className="flex flex-wrap items-center gap-3">
                {/* Integration logos */}
                {visibleSources.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setActiveDropdown(activeDropdown === s.id ? null : s.id);
                      setTokenInput("");
                    }}
                    onMouseEnter={() => setHoveredSource(s.id)}
                    onMouseLeave={() => setHoveredSource(null)}
                    className={`h-11 w-11 flex items-center justify-center rounded-xl border transition-all ${
                      activeDropdown === s.id
                        ? "border-primary bg-primary/10 text-primary shadow-sm shadow-primary/5 ring-1 ring-primary"
                        : "border-border bg-background/60 hover:bg-background hover:border-primary/45 text-foreground/70 hover:text-foreground"
                    }`}
                    title={`Connect ${s.name}`}
                  >
                    {s.icon}
                  </button>
                ))}

                {/* Attachment paperclip always at the end */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveDropdown(activeDropdown === "note" ? null : "note");
                    setNoteInput("");
                    setSelectedFile(null);
                  }}
                  onMouseEnter={() => setHoveredSource("note")}
                  onMouseLeave={() => setHoveredSource(null)}
                  className={`h-11 w-11 flex items-center justify-center rounded-xl border transition-all ${
                    activeDropdown === "note"
                      ? "border-primary bg-primary/10 text-primary shadow-sm shadow-primary/5 ring-1 ring-primary"
                      : "border-border bg-background/60 hover:bg-background hover:border-primary/45 text-foreground/70 hover:text-foreground"
                  }`}
                  title="Add qualitative note context"
                >
                  <Paperclip className="h-5 w-5" />
                </button>
              </div>

              {/* Dynamic hover hint detail box */}
              <div className="rounded-xl bg-muted/20 border border-border/40 px-3.5 py-2.5 min-h-[50px] flex items-center transition-all duration-200">
                <p className="text-[11px] font-mono text-muted-foreground leading-normal">
                  {hoveredSource === "github" && "GitHub: Syncs PRs, commit rates, and issue volumes. Recommended for shipping velocity!"}
                  {hoveredSource === "stripe" && "Stripe: Syncs billing events, subscription MRR, and churn rates. Recommended for revenue goals!"}
                  {hoveredSource === "notion" && "Notion: Syncs wiki pages, database lists, and workspace notes. Recommended for qualitative context!"}
                  {hoveredSource === "slack" && "Slack: Syncs message volume and team channel velocity. Recommended for communication signals!"}
                  {hoveredSource === "note" && "Manual Note: Add qualitative logs, files, or image uploads directly to refine diagnosis."}
                  {!hoveredSource && (
                    activeDropdown === "github" ? "GitHub: Syncs PRs, commit rates, and issue volumes. Recommended for shipping velocity!" :
                    activeDropdown === "stripe" ? "Stripe: Syncs billing events, subscription MRR, and churn rates. Recommended for revenue goals!" :
                    activeDropdown === "notion" ? "Notion: Syncs wiki pages, database lists, and workspace notes. Recommended for qualitative context!" :
                    activeDropdown === "slack" ? "Slack: Syncs message volume and team channel velocity. Recommended for communication signals!" :
                    activeDropdown === "note" ? "Manual Note: Add qualitative logs, files, or image uploads directly to refine diagnosis." :
                    "Hover over an icon to see what signals it imports."
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5 animate-pulse">
              <CheckCircle2 className="h-4 w-4" /> All recommended tools connected. Ready to run diagnosis!
            </div>
          )}

          {/* Inline Connection Panel / Dropdown */}
          {activeDropdown && (
            <div className="border border-border bg-background/50 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Note attachment form */}
              {activeDropdown === "note" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Add Qualitative Context</span>
                    <button onClick={() => setActiveDropdown(null)} className="text-[10px] text-muted-foreground hover:text-foreground font-mono">Cancel</button>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Provide manual notes or attach images to help Atlas diagnose constraints when integrations aren't active.
                  </p>
                  <textarea
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    rows={3}
                    placeholder="e.g., We paused GitHub commits this week to focus on outbound sales."
                    className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary font-sans"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        id="note-file-upload"
                        accept="image/*"
                        onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      <label
                        htmlFor="note-file-upload"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-background text-[10px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted/30 cursor-pointer"
                      >
                        <Paperclip className="h-3 w-3" /> {selectedFile ? "Change file" : "Upload image"}
                      </label>
                      {selectedFile && (
                        <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">
                          {selectedFile.name}
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={handleSaveNote}
                      disabled={submitting || (!noteInput.trim() && !selectedFile)}
                      className="h-8 text-xs px-4"
                    >
                      {submitting ? "Saving..." : "Submit Context"}
                    </Button>
                  </div>
                </div>
              ) : selectedSource ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Connect {selectedSource.name}</span>
                    <button onClick={() => setActiveDropdown(null)} className="text-[10px] text-muted-foreground hover:text-foreground font-mono">Cancel</button>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {selectedSource.tagline}
                  </p>
                  
                  {selectedSource.id === "github" ? (
                    <div className="space-y-3">
                      <Button
                        size="sm"
                        className="w-full h-9 text-xs font-mono gap-1.5"
                        onClick={() => {
                          onConnectSource();
                          setActiveDropdown(null);
                        }}
                      >
                        <Plug className="h-3.5 w-3.5" /> Connect via GitHub OAuth
                      </Button>
                      
                      <div className="relative flex py-1 items-center">
                        <div className="flex-grow border-t border-border/40"></div>
                        <span className="flex-shrink mx-2 text-[9px] font-mono text-muted-foreground/60 uppercase">or use token</span>
                        <div className="flex-grow border-t border-border/40"></div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                          Personal Access Token
                        </label>
                        <Input
                          type="password"
                          placeholder="Paste a ghp_... token"
                          value={tokenInput}
                          onChange={e => setTokenInput(e.target.value)}
                          className="h-9 text-xs bg-background font-mono"
                          onKeyDown={e => e.key === "Enter" && handleConnectToken("github")}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-9 text-xs font-mono"
                          disabled={submitting || !tokenInput.trim()}
                          onClick={() => handleConnectToken("github")}
                        >
                          {submitting ? "Saving..." : "Save GitHub Token"}
                        </Button>
                        <p className="text-[9px] text-muted-foreground/50 leading-relaxed font-sans mt-1">
                          Create a token at github.com/settings/tokens with <strong>repo</strong> &amp; <strong>read:user</strong> scopes.
                        </p>
                      </div>
                    </div>
                  ) : selectedSource.type === "oauth" ? (
                    <Button
                      size="sm"
                      className="w-full h-9 text-xs font-mono gap-1.5"
                      onClick={() => {
                        if (selectedSource.id === "notion") onConnectNotion?.();
                        else if (selectedSource.id === "slack") onConnectSlack?.();
                        else onConnectSource();
                        setActiveDropdown(null);
                      }}
                    >
                      <Plug className="h-3.5 w-3.5" /> Connect with {selectedSource.name}
                    </Button>
                  ) : (
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        {selectedSource.id === "stripe" ? "Stripe API Key" : selectedSource.id === "slack" ? "Bot User Token" : "Integration Token"}
                      </label>
                      <Input
                        type="password"
                        placeholder={selectedSource.placeholder}
                        value={tokenInput}
                        onChange={e => setTokenInput(e.target.value)}
                        className="h-9 text-xs bg-background font-mono"
                        onKeyDown={e => e.key === "Enter" && handleConnectToken(selectedSource.id)}
                      />
                      <Button
                        size="sm"
                        className="w-full h-9 text-xs"
                        disabled={submitting || !tokenInput.trim()}
                        onClick={() => handleConnectToken(selectedSource.id)}
                      >
                        {submitting ? "Connecting..." : "Save & Connect"}
                      </Button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* GitHub Repository Selector (if GitHub connected) */}
          {hasGitHub && (
            <div className="space-y-3 pt-3 border-t border-border/40 animate-in fade-in duration-200">
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/80 font-semibold block">
                Active GitHub Repository
              </label>
              {hasRepo ? (
                <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Github className="h-4 w-4 text-foreground/80" />
                    <span className="font-mono text-xs font-medium text-foreground">{selectedRepo}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onLinkRepo("")}
                    className="text-[10px] font-mono text-muted-foreground hover:text-foreground underline select-none"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Select a repository to monitor commit velocity and issue signals.
                  </p>
                  <div className="flex gap-2">
                    <select
                      value={repoSelect}
                      onChange={(e) => setRepoSelect(e.target.value)}
                      className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-mono text-foreground"
                    >
                      <option value="">-- Select Repository --</option>
                      {repos.map((r) => (
                        <option key={r.id} value={r.full_name}>
                          {r.full_name}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      onClick={() => onLinkRepo(repoSelect)}
                      disabled={!repoSelect || submitting}
                      className="h-9 px-4 text-[11px] font-mono"
                    >
                      Link
                    </Button>
                  </div>
                  {repos.length === 0 && (
                    <div className="space-y-2 pt-1 animate-in fade-in duration-200">
                      <p className="text-[10px] text-muted-foreground/60 italic leading-normal">
                        No repositories found. Your connection might be expired or missing API access.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={onConnectSource}
                        className="h-8 px-3 text-[10px] font-mono gap-1.5 hover:bg-muted/30"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Re-authenticate GitHub
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Diagnose Button / State */}
          <div className="pt-2">
            <button
              onClick={onDiagnose}
              disabled={isBusy || !isReadyToDiagnose}
              className={`w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-mono text-sm font-semibold transition-all shadow-sm ${
                isReadyToDiagnose
                  ? "bg-primary text-primary-foreground hover:bg-primary/95 hover:shadow-md cursor-pointer"
                  : "bg-muted text-muted-foreground cursor-not-allowed border border-border/80"
              }`}
            >
              {isBusy ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  {diagnosing ? "Diagnosing signals…" : "Syncing data sources…"}
                </>
              ) : (
                <>
                  <Compass className="h-4 w-4" />
                  Diagnose now →
                </>
              )}
            </button>
            {!isReadyToDiagnose && (
              <p className="text-[10px] text-center text-muted-foreground/60 mt-2 font-mono">
                Connect at least one signal or add a context note to activate diagnosis.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DiagnoseLoader({
  goalStatement,
  integrations
}: {
  goalStatement: string;
  integrations: Array<{ provider: string; status: string }>;
}) {
  const [stepIndex, setStepIndex] = useState(0);

  const hasGitHub = integrations.some(i => i.provider === "github" && i.status === "active");
  const hasStripe = integrations.some(i => i.provider === "stripe" && i.status === "active");
  const hasNotion = integrations.some(i => i.provider === "notion" && i.status === "active");

  const steps = [
    "Reading goal context...",
    ...(hasGitHub ? ["Retrieving GitHub pull requests and commit cadence...", "Calculating shipping velocity trends..."] : []),
    ...(hasStripe ? ["Fetching Stripe charges and customer subscriptions...", "Estimating revenue growth milestones..."] : []),
    ...(hasNotion ? ["Reading Notion specs and document updates...", "Parsing workspace documentation context..."] : []),
    "Resolving team communication signals...",
    "Synthesizing primary bottlenecks using AI...",
    "Drafting next move options...",
    "Drawing your updated map..."
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStepIndex((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 1500);
    return () => clearInterval(timer);
  }, [steps.length]);

  return (
    <div className="relative pl-8">
      {/* Dashed line to match map style */}
      <svg className="absolute left-[9px] top-3 h-[450px] w-[4px] pointer-events-none" aria-hidden="true">
        <line x1="2" y1="0" x2="2" y2="450" stroke="hsl(var(--primary) / 0.4)" strokeWidth="2.5" strokeDasharray="4 4" />
      </svg>
      <div className="absolute -left-[0.5px] top-1">
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" className="shrink-0">
          <circle cx="11" cy="11" r="8" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="1.75" />
          <circle cx="11" cy="11" r="4.5" fill="hsl(var(--primary))" />
        </svg>
      </div>

      <div className="eyebrow text-primary mb-2">Analyzing</div>
      
      <div className="rounded-[20px] border border-border bg-card/40 p-8 text-center space-y-6 relative overflow-hidden animate-slide-up">
        {/* Radar grid backdrop */}
        <div className="absolute inset-0 bg-grid-dots opacity-40 animate-pulse duration-1000 pointer-events-none" />

        {/* Floating, spinning/scanning compass rose */}
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-primary/20 bg-primary/5 relative">
          <div className="absolute inset-0 rounded-full border border-dashed border-primary/30 animate-[spin_10s_linear_infinite]" />
          <div className="absolute inset-2 rounded-full border border-primary/10 animate-ping duration-[3s]" />
          
          <svg className="h-10 w-10 text-primary animate-[spin_4s_ease-in-out_infinite]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" fill="currentColor" fillOpacity="0.2" />
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
          </svg>
        </div>

        <div className="space-y-2 relative z-10 max-w-sm mx-auto">
          <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
            Atlas is orienting your map
          </h3>
          <p className="text-xs text-muted-foreground/80 min-h-[36px] flex items-center justify-center italic">
            "{steps[stepIndex]}"
          </p>
        </div>

        {/* Small step indicators */}
        <div className="flex justify-center items-center gap-1.5 pt-2">
          {steps.map((_, idx) => (
            <span 
              key={idx} 
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === stepIndex 
                  ? "w-4 bg-primary" 
                  : idx < stepIndex 
                    ? "w-1.5 bg-primary/40" 
                    : "w-1.5 bg-border"
              }`} 
            />
          ))}
        </div>
      </div>
    </div>
  );
}

