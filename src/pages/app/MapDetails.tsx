import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
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
import { ArrowLeft, ArrowRight, Github, Plug, Trash, Globe, RefreshCw, Maximize2, Minimize2, ZoomIn, ZoomOut, Sparkles, Compass, Paperclip, FileText, X, Plus, CheckCircle2 } from "lucide-react";
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
  goal_statement: string;
  confidence: "starter" | "emerging" | "established";
  is_published: boolean;
};

type Waypoint = {
  id?: string;
  kind: "goal" | "constraint" | "evidence" | "move";
  title: string;
  confidence: "starter" | "emerging" | "established";
  metadata?: any;
  completed_at?: string | null;
};

export default function MapDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shouldAutoFocus = searchParams.get("focus") === "1";
  const shouldAutoTour = searchParams.get("tour") === "1";

  const [map, setMap] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
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
            side: "over" as const,
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
  const { data: liveIntegrations = [] } = useIntegrations();
  const liveGitHubConnected = liveIntegrations.some(i => i.provider === "github" && i.status === "active");

  useEffect(() => {
    if (liveGitHubConnected && !hasGitHubIntegration) {
      // A new connection was just established — refresh github data
      setHasGitHubIntegration(true);
      checkGitHub();
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

  // ─── Data Loading ─────────────────────────────────────────────────────────

  const loadMap = async () => {
    try {
      setLoading(true);

      const { data: mapData, error: mapError } = await supabase
        .from("maps")
        .select("id, goal_statement, confidence, is_published")
        .eq("id", id)
        .maybeSingle();

      if (mapError) throw mapError;
      if (!mapData) { toast.error("Map not found"); navigate("/app"); return; }
      setMap(mapData as MapData);

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
        .select("id, kind, title, confidence, metadata, completed_at")
        .eq("map_id", id)
        .order("position", { ascending: true });

      if (wpData && wpData.length > 0) {
        setWaypoints(wpData as Waypoint[]);
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
      const { data, error } = await supabase.functions.invoke("sync-github", {
        body: { action: "list_repos", github_token: token || undefined },
      });
      if (!error && data?.repos) {
        setRepos(data.repos);
        setGitHubSessionExpired(false);
      } else {
        setGitHubSessionExpired(true);
      }
    } catch {
      setGitHubSessionExpired(true);
    }
  };

  // ─── Sync + Diagnose ──────────────────────────────────────────────────────

  const fullSync = async (repo: string, mapGoal: string, manualNote: string) => {
    if (!user || !id) return;
    try {
      setSyncing(true);

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
        if (fnError || (fnData && fnData.error === "no_llm_key")) {
          throw new Error(fnData?.message || "AI key missing");
        }

        const llm = fnData as { constraint: string; evidence: string; move: string; confidence: string; evidence_sources?: Array<{ source: string; detail: string }> };
        const conf = (["emerging", "building", "established"].includes(llm.confidence)
          ? llm.confidence : "emerging") as "emerging" | "established";

        result = {
          waypoints: [
            { kind: "goal", title: mapGoal, confidence: "established" },
            { kind: "constraint", title: llm.constraint, confidence: conf },
            { kind: "evidence", title: llm.evidence, confidence: conf },
            { kind: "move", title: llm.move, confidence: "established", metadata: llm.evidence_sources ? { evidence: llm.evidence_sources } : undefined },
          ],
        };
        source = flags.length > 0 ? "llm" : "context-only";
      } catch (err: any) {
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

      // Persist waypoints: only delete active ones (keep completed history)
      await supabase.from("waypoints").delete().eq("map_id", id).is("completed_at", null);
      await supabase.from("waypoints").insert(
        result.waypoints.map((w, idx) => ({
          map_id: id,
          user_id: user.id,
          kind: w.kind,
          title: w.title,
          confidence: w.confidence,
          position: idx,
          metadata: w.metadata || null,
        }))
      );

      // Re-fetch all waypoints from database (both new active and past completed)
      const { data: refreshedWps } = await supabase
        .from("waypoints")
        .select("id, kind, title, confidence, metadata, completed_at")
        .eq("map_id", id)
        .order("position", { ascending: true });
      
      if (refreshedWps) {
        setWaypoints(refreshedWps as Waypoint[]);
      } else {
        setWaypoints(result.waypoints);
      }

      // Update map confidence
      const constraintWp = result.waypoints.find(w => w.kind === "constraint");
      const newConf = constraintWp?.confidence === "established" ? "established" : "emerging";
      await supabase.from("maps").update({ confidence: newConf }).eq("id", id);
      setMap(prev => prev ? { ...prev, confidence: newConf } : null);

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
    if (!repo || !user || !map) return;
    setSelectedRepo(repo);
    await supabase.from("sources").delete().eq("map_id", id);
    await supabase.from("sources").insert({ map_id: id, user_id: user.id, provider: "github", label: repo });
    await fullSync(repo, map.goal_statement, note);
    toast.success("Repository linked");
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
    supabase.auth.linkIdentity({
      provider: "github",
      options: {
        scopes: "read:user repo",
        redirectTo: window.location.href,
        queryParams: { prompt: "consent" },
      },
    });
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
        <div className="mt-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-border bg-card px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
              {map.confidence}
            </span>
            {selectedRepo && (
              <span className="flex items-center gap-1 rounded-md border border-border/60 bg-card px-2.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                <Github className="h-3 w-3" /> {selectedRepo}
              </span>
            )}
            {isBusy && (
              <span className="font-mono text-[10px] text-muted-foreground animate-pulse">
                {diagnosing ? "Atlas is reading your signals…" : "Syncing…"}
              </span>
            )}
          </div>
          <h1 className="mt-3 font-display text-2xl font-semibold leading-tight md:text-3xl lg:text-[34px] tracking-tight">
            {map.goal_statement}
          </h1>
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

          {isUndiagnosed ? (
            <UndiagnosedState
              goalStatement={map.goal_statement}
              integrations={liveIntegrations}
              hasGitHub={hasGitHubIntegration}
              hasRepo={!!selectedRepo}
              isBusy={isBusy}
              diagnosing={diagnosing}
              syncing={syncing}
              onDiagnose={() => fullSync(selectedRepo, map.goal_statement, manualNotesList[0]?.payload?.note || "")}
              onAddContext={() => setIsAttachmentLogOpen(true)}
              onConnectSource={() => {}}
            />
          ) : (
            <>
              <Trail
                waypoints={waypoints.filter(w => !w.completed_at)}
                onFeedback={handleFeedback}
              />
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

        {/* Attachment Log */}
        {!isAttachmentLogOpen ? (
          <div id="tour-context" className="mt-12">
            <button
              onClick={() => setIsAttachmentLogOpen(true)}
              className="w-full flex items-center justify-between rounded-xl border border-border bg-card/50 hover:bg-card/85 px-5 py-4 transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <Paperclip className="h-4 w-4 text-primary shrink-0" />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Attachment Log</span>
                  <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded-full">
                    {manualNotesList.length} item{manualNotesList.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <span className="text-xs text-muted-foreground font-mono hover:text-foreground transition-colors flex items-center gap-1">
                Open log <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </button>
          </div>
        ) : (
          <div id="tour-context" className="mt-12 rounded-[16px] border border-border bg-card/75 p-6 bg-parchment-lines relative overflow-hidden animate-in fade-in duration-200">
            {/* Ambient background decoration */}
            <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-primary/2 blur-[80px] pointer-events-none" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono uppercase tracking-widest text-primary flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" /> Attachment Log
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Provide qualitative context or screenshots to refine the strategy diagnosis.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAttachForm(!showAttachForm)}
                    className="gap-1.5 font-mono text-xs border-primary/20 hover:bg-primary/5 text-primary"
                  >
                    {showAttachForm ? (
                      <>
                        <X className="h-3.5 w-3.5" /> Cancel
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" /> Attach Context
                      </>
                    )}
                  </Button>
                  <button
                    onClick={() => setIsAttachmentLogOpen(false)}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 font-mono ml-2.5"
                  >
                    Collapse
                  </button>
                </div>
              </div>

              {/* Note & Upload Form */}
              {showAttachForm && (
                <div className="mt-5 border border-border/80 bg-background/60 rounded-xl p-5 space-y-4 animate-in fade-in slide-in-from-top-3 duration-200">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider">
                      Context Note
                    </label>
                    <textarea
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      rows={3}
                      placeholder="e.g., We paused GitHub commits this week to focus on outbound marketing."
                      className="w-full resize-none rounded-lg border border-border bg-background/80 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider">
                      Image / Screenshot
                    </label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                        className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 text-muted-foreground cursor-pointer"
                      />
                      {selectedFile && (
                        <span className="text-xs text-muted-foreground font-mono truncate max-w-xs">
                          {selectedFile.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={handleAddAttachment}
                      disabled={savingNote || (!note.trim() && !selectedFile)}
                      className="gap-1 text-xs"
                    >
                      {savingNote ? "Saving..." : "Submit Context"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Timeline feed of notes */}
              <div className="mt-6 space-y-3">
                {manualNotesList.length > 0 ? (
                  manualNotesList.map((item) => {
                    const payload = item.payload || {};
                    const dateStr = item.created_at
                      ? new Date(item.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "";
                    const timeStr = item.created_at
                      ? new Date(item.created_at).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "";

                    const isImage = payload.file_type?.startsWith("image/") || payload.file_url;

                    return (
                      <div
                        key={item.id}
                        className="border border-border/60 bg-card/40 rounded-xl p-4 flex flex-col md:flex-row md:items-start justify-between gap-4 transition-all hover:border-border/80 bg-parchment-lines"
                      >
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                            <span className="text-primary font-medium">{dateStr}</span>
                            <span>•</span>
                            <span>{timeStr}</span>
                          </div>
                          {payload.note && (
                            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                              {payload.note}
                            </p>
                          )}
                          
                          {payload.file_url && isImage && (
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={() => setLightboxUrl(payload.file_url)}
                                className="inline-block relative rounded-lg border border-border overflow-hidden hover:border-primary/40 group max-w-xs transition-colors text-left"
                              >
                                <img
                                  src={payload.file_url}
                                  alt={payload.file_name || "Attachment"}
                                  className="max-h-[160px] object-cover rounded-lg group-hover:scale-[1.02] transition-transform duration-200"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                                  <span className="text-[10px] font-mono bg-background/90 text-foreground px-2 py-1 rounded border border-border">
                                    Expand
                                  </span>
                                </div>
                              </button>
                            </div>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteNote(item.id, payload.file_url)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 self-end md:self-start"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })
              ) : (
                <div className="text-center py-8 border border-dashed border-border rounded-xl">
                  <FileText className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground font-mono">
                    No manual context entries in log. Click "Attach Context" to add.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

        {/* GitHub Connector */}
        <div id="tour-github" className="mt-6 rounded-[16px] border border-border bg-card p-6">
          <div className="text-xs font-mono uppercase tracking-widest text-primary">GitHub source</div>

          {/* State 1: No GitHub integration connected at all */}
          {!hasGitHubIntegration ? (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-3">Connect GitHub to pull commit signals into this map.</p>
              <Link to="/app/integrations">
                <Button variant="outline" className="h-10">
                  <Plug className="mr-2 h-4 w-4" /> Connect GitHub
                </Button>
              </Link>
            </div>

          ) : selectedRepo && !changingRepo ? (
            /* State 2: Repo already linked — calm display, no live token check */
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Github className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <div className="text-sm font-medium text-foreground">{selectedRepo}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Linked repository · syncing via server token</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => map && fullSync(selectedRepo, map.goal_statement, manualNotesList[0]?.payload?.note || "")}
                  disabled={isBusy}
                  className="gap-1.5"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isBusy ? "sync-spring-spin" : ""}`} />
                  <span>{isBusy ? "Syncing…" : "Force sync"}</span>
                </Button>
                <button
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                  onClick={() => {
                    setChangingRepo(true);
                    setGitHubSessionExpired(false);
                    loadRepoList();
                  }}
                >
                  Change repository
                </button>
              </div>
            </div>

          ) : changingRepo && gitHubSessionExpired ? (
            /* State 3: User clicked "Change repository" but session token is stale */
            <div className="mt-4 border border-border/80 bg-card/50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-medium text-foreground">Session Expired</div>
                <p className="text-xs text-muted-foreground">Re-authenticate with GitHub to fetch your repository list.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                  onClick={() => setChangingRepo(false)}
                >
                  Cancel
                </button>
                <Button variant="outline" size="sm" className="text-primary border-primary/30 hover:bg-primary/5" onClick={handleReconnectGitHub}>
                  <Plug className="mr-1.5 h-3.5 w-3.5" /> Reconnect GitHub
                </Button>
              </div>
            </div>

          ) : (
            /* State 4: Picker — no repo linked yet, or user is actively changing */
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Select
                value={selectedRepo || "_empty"}
                onValueChange={(val) => { handleLinkRepo(val); setChangingRepo(false); }}
                disabled={isBusy}
              >
                <SelectTrigger className="w-[280px] bg-background">
                  <SelectValue placeholder="Select a repository" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_empty" disabled>— Select a repository —</SelectItem>
                  {repos.map((r) => (
                    <SelectItem key={r.id} value={r.full_name}>
                      {r.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {changingRepo && (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                  onClick={() => setChangingRepo(false)}
                >
                  Cancel
                </button>
              )}
            </div>
          )}

          {gitStats && (
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-4 font-mono text-[11px] text-muted-foreground">
              <div>This week: <span className="text-foreground">{gitStats.commitsThisWeek} commits</span></div>
              <div>Last week: <span className="text-foreground">{gitStats.commitsLastWeek} commits</span></div>
              <div>Days since activity: <span className="text-foreground">{gitStats.daysSinceLastCommit}</span></div>
              <div className="col-span-2 truncate">Last: <span className="text-foreground">"{gitStats.lastCommitMessage}"</span></div>
            </div>
          )}
        </div>
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
                      <Trail
                        waypoints={waypoints.filter(w => !w.completed_at)}
                        onFeedback={handleFeedback}
                        interactive={true}
                        layout="horizontal"
                      />
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
  );
}

// ── UndiagnosedState ────────────────────────────────────────────────────────

function UndiagnosedState({
  goalStatement,
  integrations,
  hasGitHub,
  hasRepo,
  isBusy,
  diagnosing,
  syncing,
  onDiagnose,
  onAddContext,
}: {
  goalStatement: string;
  integrations: Array<{ provider: string; status: string }>;
  hasGitHub: boolean;
  hasRepo: boolean;
  isBusy: boolean;
  diagnosing: boolean;
  syncing: boolean;
  onDiagnose: () => void;
  onAddContext: () => void;
  onConnectSource: () => void;
}) {
  const connected = [
    { id: "github", label: "GitHub", icon: "GH", active: hasGitHub },
    { id: "stripe", label: "Stripe", icon: "$", active: integrations.some(i => i.provider === "stripe" && i.status === "active") },
    { id: "notion", label: "Notion", icon: "N", active: integrations.some(i => i.provider === "notion" && i.status === "active") },
    { id: "slack", label: "Slack", icon: "#", active: integrations.some(i => i.provider === "slack" && i.status === "active") },
  ];

  const anyConnected = hasGitHub || hasRepo || connected.some(c => c.active);

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
          {/* Animated compass waiting state */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-full border border-primary/15 scale-[1.5] animate-ping" />
              <div className="h-12 w-12 rounded-full bg-primary/8 border border-primary/20 flex items-center justify-center">
                {isBusy ? (
                  <RefreshCw className="h-5 w-5 text-primary animate-spin" />
                ) : (
                  <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" fill="currentColor" fillOpacity="0.3" />
                  </svg>
                )}
              </div>
            </div>
            <div>
              <div className="eyebrow text-muted-foreground/70 mb-1">Constraint</div>
              <p className="font-display text-xl font-medium text-muted-foreground">
                {isBusy
                  ? diagnosing ? "Reading your signals…" : "Syncing data sources…"
                  : "Awaiting first diagnosis"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground/70">
                {anyConnected
                  ? "You have sources connected. Run a diagnosis to map your constraint."
                  : "Connect a data source or add context manually to get started."}
              </p>
            </div>
          </div>

          {/* Integration status row */}
          <div className="flex flex-wrap gap-2">
            {connected.map(c => (
              <span
                key={c.id}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
                  c.active
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-700 dark:text-emerald-400"
                    : "border-border bg-muted/50 text-muted-foreground"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${
                  c.active ? "bg-emerald-500" : "bg-muted-foreground/30"
                }`} />
                {c.label}
              </span>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onDiagnose}
              disabled={isBusy}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 font-mono text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isBusy ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> {diagnosing ? "Diagnosing…" : "Syncing…"}</>
              ) : (
                <><Compass className="h-4 w-4" /> Diagnose now →</>
              )}
            </button>
            <button
              onClick={onAddContext}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card/60 px-6 py-2.5 font-mono text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
            >
              <PaperclipIcon className="h-4 w-4" /> Add context manually
            </button>
          </div>

          {/* Hint */}
          {!anyConnected && (
            <p className="text-xs text-muted-foreground/60 leading-relaxed border-t border-border/40 pt-4">
              Tip: Connect GitHub from the{" "}
              <Link to="/app/integrations" className="underline underline-offset-2 text-primary hover:no-underline">Data Sources</Link>{" "}
              tab, or add a manual note below describing your current situation.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PaperclipIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>;
}

