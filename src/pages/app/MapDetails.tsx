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
import { ArrowLeft, Github, Plug, Trash, Globe, RefreshCw, Maximize2, Minimize2, ZoomIn, ZoomOut, Sparkles, Compass } from "lucide-react";
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

  // Manual notes
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

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

      // Load latest manual note
      const { data: signalData } = await supabase
        .from("signals")
        .select("*")
        .eq("map_id", id)
        .eq("title", "__manual_note")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const sig = signalData as any;
      if (sig?.payload && typeof sig.payload === "object" && "note" in sig.payload) {
        setNote(sig.payload.note ?? "");
      }

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

  const checkGitHub = async () => {
    if (!user) return;
    try {
      // Check 1: integrations table row (written by AuthCallback / useIntegrations)
      const { data: intData } = await supabase
        .from("integrations")
        .select("status")
        .eq("user_id", user.id)
        .eq("provider", "github")
        .maybeSingle();

      // Check 2: live session identity (available immediately after OAuth)
      const hasGitHubIdentity = !!user.identities?.find(
        (i) => i.provider === "github"
      );

      const isConnected =
        hasGitHubIdentity || (!!intData && intData.status === "active");
      setHasGitHubIntegration(isConnected);

      // If GitHub identity exists but no DB row yet, create it now
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

      const token = await getGitHubToken();
      setGitHubToken(token);

      if (isConnected) {
        const { data, error } = await supabase.functions.invoke("sync-github", {
          body: { action: "list_repos", github_token: token || undefined },
        });
        if (!error && data?.repos) {
          setRepos(data.repos);
          setGitHubSessionExpired(false);
        } else {
          setGitHubSessionExpired(true);
        }
      } else {
        setGitHubSessionExpired(false);
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

  // ─── Manual Note ──────────────────────────────────────────────────────────

  const saveNote = async () => {
    if (!user || !id || !map) return;
    setSavingNote(true);
    try {
      await supabase.from("signals").insert({
        map_id: id,
        user_id: user.id,
        title: "__manual_note",
        score: 0,
        occurred_at: new Date().toISOString(),
        payload: { note: note.trim() },
      } as any);
      toast.success("Context saved");
      // Re-run diagnosis with updated note
      await fullSync(selectedRepo, map.goal_statement, note);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingNote(false);
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
                onClick={() => map && fullSync(selectedRepo, map.goal_statement, note)}
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

        {/* Manual Notes */}
        <div id="tour-context" className="mt-12 rounded-[16px] border border-border bg-card/75 p-6 bg-parchment-lines relative overflow-hidden">
          <div className="relative z-10">
            <div className="text-xs font-mono uppercase tracking-widest text-primary">Add context</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Notes are included in the diagnosis. The more specific, the better.
            </p>
            <textarea
              ref={noteRef}
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={4}
              placeholder="e.g. We paused GitHub commits this week to focus on outbound — this is intentional"
              className="mt-4 w-full resize-none rounded-md border border-input bg-background/90 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={saveNote} disabled={savingNote || !note.trim()}>
                {savingNote ? "Saving…" : "Save and re-diagnose"}
              </Button>
            </div>
          </div>
        </div>

        {/* GitHub Connector */}
        <div id="tour-github" className="mt-6 rounded-[16px] border border-border bg-card p-6">
          <div className="text-xs font-mono uppercase tracking-widest text-primary">GitHub source</div>

          {!hasGitHubIntegration ? (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-3">Connect GitHub to pull commit signals into this map.</p>
              <Link to="/app/integrations">
                <Button variant="outline" className="h-10">
                  <Plug className="mr-2 h-4 w-4" /> Connect GitHub
                </Button>
              </Link>
            </div>
          ) : gitHubSessionExpired ? (
            <div className="mt-4 border border-border/80 bg-card/50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-medium text-foreground">Connection Expired</div>
                <p className="text-xs text-muted-foreground">Your GitHub connection session has expired. Reconnect GitHub to link a repository.</p>
              </div>
              <Button variant="outline" size="sm" className="text-primary border-primary/30 hover:bg-primary/5 shrink-0" onClick={handleReconnectGitHub}>
                <Plug className="mr-1.5 h-3.5 w-3.5" /> Reconnect GitHub
              </Button>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Select
                value={selectedRepo}
                onValueChange={(val) => handleLinkRepo(val)}
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
              {selectedRepo && (
                <Button variant="outline" size="sm"
                  onClick={() => map && fullSync(selectedRepo, map.goal_statement, note)}
                  disabled={isBusy}
                  className="gap-1.5"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isBusy ? "sync-spring-spin" : ""}`} />
                  <span>{isBusy ? "Syncing…" : "Force sync"}</span>
                </Button>
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
              initialScale={1}
              minScale={0.5}
              maxScale={2.5}
              limitToBounds={false}
              centerOnInit={true}
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
                    contentClass="!w-full !h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
                  >
                    <div className="relative w-full max-w-5xl p-8 bg-card/75 backdrop-blur-md border border-border/80 rounded-2xl shadow-xl pointer-events-auto select-text mx-4 my-8">
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
