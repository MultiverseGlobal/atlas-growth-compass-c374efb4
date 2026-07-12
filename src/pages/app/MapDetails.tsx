import { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
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
import { ArrowLeft, Github, Plug, Trash, Globe, RefreshCw, Maximize2, Minimize2, ZoomIn, ZoomOut, Sparkles, Compass, Paperclip, FileText, X, Plus } from "lucide-react";
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
};

const TOUR_STEPS = [
  {
    title: "1. The Goal",
    description: "This is your active goal. Everything on this map serves to align your focus toward achieving this statement.",
    target: "#tour-wp-goal",
  },
  {
    title: "2. The Constraint",
    description: "This is the core bottleneck slowing you down. Atlas analyzes your tools to identify what is actually blocking your progress.",
    target: "#tour-wp-constraint",
  },
  {
    title: "3. The Evidence",
    description: "Why is this the constraint? Atlas lists the evidence gathered from your connected development channels here.",
    target: "#tour-wp-evidence",
  },
  {
    title: "4. The Next Move",
    description: "Your single immediate priority. Ignore the noise and focus entirely on executing this move next.",
    target: "#tour-wp-move",
  },
  {
    title: "5. Add Context",
    description: "Connected tools don't know everything. Add manual context notes about your plans or blockers, and Atlas will re-diagnose your map.",
    target: "#tour-context",
  },
  {
    title: "6. Connect GitHub",
    description: "Link a GitHub repository to feed active development velocity and commit signals directly into Atlas's constraint engine.",
    target: "#tour-github",
  },
  {
    title: "7. Immersive Focus",
    description: "Click 'Focus Mode' for a distraction-free, cartographic canvas. Perfect for zooming, panning, and reviewing your strategy.",
    target: "#tour-focus",
  }
];

export default function MapDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

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

  // Focus Mode states
  const [focusMode, setFocusMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [expandedWaypoint, setExpandedWaypoint] = useState<number | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  // Tour state
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [spotlightRect, setSpotlightRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [vpSize, setVpSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  // Track viewport size for accurate SVG mask dimensions
  useEffect(() => {
    const handleResize = () => setVpSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Start tour automatically on first visit
  useEffect(() => {
    if (loading || !map) return;
    const hasSeenTour = localStorage.getItem("atlas.tour.seen");
    if (!hasSeenTour) {
      const timer = setTimeout(() => {
        setTourStep(0);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [loading, map]);

  // Apply tour highlights and scroll to active elements after layout completes
  useEffect(() => {
    if (loading || tourStep === null) {
      setSpotlightRect(null);
      return;
    }
    const step = TOUR_STEPS[tourStep];
    const el = document.querySelector(step.target);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });

      const updateRect = () => {
        const r = el.getBoundingClientRect();
        setVpSize({ w: window.innerWidth, h: window.innerHeight });
        setSpotlightRect({
          x: r.left,
          y: r.top,
          width: r.width,
          height: r.height,
        });
      };

      // Delay to let smooth scrolling settle
      const timer = setTimeout(updateRect, 400);
      window.addEventListener("resize", updateRect);
      window.addEventListener("scroll", updateRect, true);

      return () => {
        clearTimeout(timer);
        window.removeEventListener("resize", updateRect);
        window.removeEventListener("scroll", updateRect, true);
      };
    }
  }, [loading, tourStep]);

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
    } else {
      document.documentElement.classList.remove("focus-mode-active");
    }
    return () => {
      document.documentElement.classList.remove("focus-mode-active");
    };
  }, [focusMode]);

  // Escape key handler to exit focus mode
  useEffect(() => {
    if (!focusMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFocusMode(false);
        setExpandedWaypoint(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusMode]);

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

  // Center focus mode view on mount, window resize, or sidebar toggle.
  // Use rAF-in-rAF + 350ms delay so we fire after the entrance animation
  // completes and after TransformComponent has finished layout — not before.
  useEffect(() => {
    const handleSidebar = () => {
      // Delay slightly for sidebar CSS width transition to settle
      setTimeout(() => {
        if (transformRef.current) {
          transformRef.current.centerView(1, 0);
        }
      }, 300);
    };

    window.addEventListener("sidebar-toggle", handleSidebar);
    window.addEventListener("resize", handleSidebar);

    if (focusMode) {
      // Double rAF ensures at least two paint frames have occurred before we
      // measure, then the 350ms timeout waits for the CSS enter animation.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (transformRef.current) {
              transformRef.current.centerView(1, 0);
            }
          }, 350);
        });
      });
    }

    return () => {
      window.removeEventListener("sidebar-toggle", handleSidebar);
      window.removeEventListener("resize", handleSidebar);
    };
  }, [focusMode]);

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
        .select("id, kind, title, confidence, metadata")
        .eq("map_id", id)
        .order("position", { ascending: true });

      if (wpData && wpData.length > 0) {
        setWaypoints(wpData as Waypoint[]);
      } else {
        setWaypoints([
          { kind: "goal", title: mapData.goal_statement, confidence: "starter" },
          { kind: "constraint", title: "No diagnostic signals have been received yet.", confidence: "starter" },
          { kind: "evidence", title: "Establish data sources or provide manual context notes to identify constraints.", confidence: "starter" },
          { kind: "move", title: "Link a GitHub repository or submit a manual context note below.", confidence: "starter" },
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

      if (repo) {
        // Step 1: call sync-github edge function to ingest real signals
        try {
          const { data: syncData, error: syncError } = await supabase.functions.invoke("sync-github", {
            body: { map_id: id, repo_full_name: repo, github_token: gitHubToken || undefined },
          });
          if (!syncError && syncData) {
            const sd = syncData as {
              stats?: GitHubStats;
            };
            if (sd.stats) {
              stats = sd.stats;
              setGitStats(stats);
            }
          } else if (syncError) {
            // Fallback to client-side fetch if edge function fails
            if (gitHubToken) {
              const [owner, repoName] = repo.split("/");
              stats = await fetchRepoCommitStats(gitHubToken, owner, repoName);
              setGitStats(stats);
            }
          }
        } catch {
          // Client-side fallback
          if (gitHubToken) {
            try {
              const [owner, repoName] = repo.split("/");
              stats = await fetchRepoCommitStats(gitHubToken, owner, repoName);
              setGitStats(stats);
            } catch { /* no stats */ }
          }
        }
      }

      // Step 2: LLM diagnosis
      let result: { waypoints: Waypoint[] };
      try {
        setDiagnosing(true);
        const { data: fnData, error: fnError } = await supabase.functions.invoke("diagnose-map", {
          body: {
            map_id: id,
            manual_notes: manualNote || undefined,
          },
        });
        if (fnError) throw fnError;

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
      } catch {
        // Fallback to deterministic if LLM unavailable
        if (stats) {
          result = runGitHubRulesFallback(stats, mapGoal);
        } else {
          result = {
            waypoints: [
              { kind: "goal", title: mapGoal, confidence: "starter" },
              { kind: "constraint", title: "No data sources connected yet.", confidence: "starter" },
              { kind: "evidence", title: "Add a manual note below or connect GitHub to generate signals.", confidence: "starter" },
              { kind: "move", title: "Connect a source or add context to get a diagnosis.", confidence: "starter" },
            ],
          };
        }
      } finally {
        setDiagnosing(false);
      }

      setWaypoints(result.waypoints);

      // Persist waypoints
      await supabase.from("waypoints").delete().eq("map_id", id);
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

      // Update map confidence
      const constraintWp = result.waypoints.find(w => w.kind === "constraint");
      const newConf = constraintWp?.confidence === "established" ? "established" : "emerging";
      await supabase.from("maps").update({ confidence: newConf }).eq("id", id);
      setMap(prev => prev ? { ...prev, confidence: newConf } : null);

      setLastSyncedAt(new Date());
      setSyncFailed(false);

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

  const handleDeleteNote = async (signalId: string, fileUrl?: string) => {
    if (!window.confirm("Are you sure you want to remove this context entry?")) return;
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
    if (action === "constraint_wrong") toast.success("Noted — this helps Atlas improve.");
    if (action === "move_done") toast.success("Marked done.");
    if (action === "move_skipped") toast.success("Skipped.");
  };

  // ─── Delete ───────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!window.confirm("Delete this map?")) return;
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

  return (
    <>
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
              onClick={() => setTourStep(0)}
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
          <h1 className="mt-3 font-display text-3xl font-semibold leading-tight md:text-4xl">
            {map.goal_statement}
          </h1>
        </div>

        {/* Trail */}
        <div className="mt-14">
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
          <Trail
            waypoints={waypoints}
            onFeedback={handleFeedback}
          />
        </div>

        {/* Attachment Log */}
        <div id="tour-context" className="mt-12 rounded-[16px] border border-border bg-card/75 p-6 bg-parchment-lines relative overflow-hidden">
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
                  
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      id="attachment-file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setSelectedFile(file);
                      }}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("attachment-file")?.click()}
                      className="gap-1.5 h-9 text-xs font-mono"
                      disabled={savingNote}
                    >
                      <Plus className="h-3.5 w-3.5" /> Choose Image
                    </Button>
                    
                    {selectedFile ? (
                      <div className="flex items-center gap-2 text-xs text-foreground bg-muted/65 border border-border px-3 py-1.5 rounded-md max-w-xs truncate">
                        <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="truncate">{selectedFile.name}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedFile(null)}
                          className="text-muted-foreground hover:text-destructive shrink-0 ml-1"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground font-mono">No screenshot selected</span>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    onClick={handleAddAttachment}
                    disabled={savingNote || (!note.trim() && !selectedFile)}
                    className="gap-1.5"
                  >
                    {savingNote ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>{uploadingFile ? "Uploading..." : "Saving..."}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Save to Log & Re-diagnose</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Log Feed */}
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
                            <a
                              href={payload.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block relative rounded-lg border border-border overflow-hidden hover:border-primary/40 group max-w-xs transition-colors"
                            >
                              <img
                                src={payload.file_url}
                                alt={payload.file_name || "Attachment"}
                                className="max-h-[160px] object-cover rounded-lg group-hover:scale-[1.02] transition-transform duration-200"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                                <span className="text-[10px] font-mono bg-background/90 text-foreground px-2 py-1 rounded border border-border">
                                  View Image
                                </span>
                              </div>
                            </a>
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

      {focusMode && (
        <div className="fixed inset-0 z-50 bg-background grain select-none overflow-hidden">
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
                        waypoints={waypoints}
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

      {tourStep !== null && (
        <div className="fixed top-6 right-6 left-6 md:left-auto md:w-96 z-50 bg-card border-2 border-primary rounded-xl shadow-2xl p-5 page-fade select-none">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-primary font-bold">
              <Compass className="h-4 w-4 animate-spin" style={{ animationDuration: '6s' }} /> Map Guide ({tourStep + 1}/{TOUR_STEPS.length})
            </div>
            <button 
              onClick={() => {
                setTourStep(null);
                localStorage.setItem("atlas.tour.seen", "true");
              }} 
              className="text-xs text-muted-foreground hover:text-foreground underline font-mono"
            >
              Skip tour
            </button>
          </div>
          <h4 className="font-display text-lg font-semibold text-foreground mb-1">
            {TOUR_STEPS[tourStep].title}
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {TOUR_STEPS[tourStep].description}
          </p>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-1">
              {TOUR_STEPS.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`h-1.5 w-1.5 rounded-full transition-all duration-200 ${idx === tourStep ? "bg-primary w-3" : "bg-muted-foreground/30"}`} 
                />
              ))}
            </div>
            <div className="flex gap-2">
              {tourStep > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setTourStep(prev => prev! - 1)}
                  className="h-8 text-xs font-mono"
                >
                  Back
                </Button>
              )}
              <Button 
                size="sm" 
                onClick={() => {
                  if (tourStep < TOUR_STEPS.length - 1) {
                    setTourStep(prev => prev! + 1);
                  } else {
                    setTourStep(null);
                    localStorage.setItem("atlas.tour.seen", "true");
                    toast.success("Tour completed! You are ready to navigate your maps.");
                  }
                }}
                className="h-8 text-xs font-mono"
              >
                {tourStep === TOUR_STEPS.length - 1 ? "Got it" : "Next"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Spotlight Tour Mask Overlay — uses exact pixel dimensions for accurate masking */}
      {spotlightRect && (
        <svg
          className="fixed inset-0 pointer-events-none z-45 transition-all duration-300"
          style={{ left: 0, top: 0 }}
          width={vpSize.w}
          height={vpSize.h}
        >
          <defs>
            <mask id="tour-spotlight-mask">
              <rect x="0" y="0" width={vpSize.w} height={vpSize.h} fill="white" />
              <rect
                x={spotlightRect.x - 10}
                y={spotlightRect.y - 10}
                width={spotlightRect.width + 20}
                height={spotlightRect.height + 20}
                rx={10}
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width={vpSize.w}
            height={vpSize.h}
            fill="rgba(0, 0, 0, 0.5)"
            mask="url(#tour-spotlight-mask)"
          />
        </svg>
      )}

      {/* Spotlight Glowing Border */}
      {spotlightRect && (
        <div
          className="fixed pointer-events-none z-46 rounded-[10px] transition-all duration-300"
          style={{
            left: spotlightRect.x - 10,
            top: spotlightRect.y - 10,
            width: spotlightRect.width + 20,
            height: spotlightRect.height + 20,
            border: "2px solid hsl(var(--primary))",
            boxShadow: "0 0 0 2px hsl(var(--primary) / 0.2), 0 0 30px 8px hsl(var(--primary) / 0.3)",
          }}
        />
      )}
    </>
  );
}
