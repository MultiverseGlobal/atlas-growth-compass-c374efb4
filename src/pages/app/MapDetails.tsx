import { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Trail } from "@/components/atlas/Trail";
import {
  getGitHubToken,
  fetchUserRepos,
  fetchRepoCommitStats,
  buildDiagnosticFlags,
  runGitHubRulesFallback,
  type GitHubRepo,
  type GitHubStats,
} from "@/lib/github";
import { ArrowLeft, Github, Plug, Trash, Globe } from "lucide-react";
import { toast } from "sonner";

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
};

export default function MapDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [map, setMap] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);

  // GitHub state
  const [gitHubToken, setGitHubToken] = useState<string | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [gitStats, setGitStats] = useState<GitHubStats | null>(null);

  // Waypoints
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);

  // Manual notes
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

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
        .select("payload")
        .eq("map_id", id)
        .eq("title", "__manual_note")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (signalData?.payload && typeof signalData.payload === "object" && "note" in (signalData.payload as object)) {
        setNote((signalData.payload as { note: string }).note ?? "");
      }

      // Load saved waypoints
      const { data: wpData } = await supabase
        .from("waypoints")
        .select("id, kind, title, confidence")
        .eq("map_id", id)
        .order("position", { ascending: true });

      if (wpData && wpData.length > 0) {
        setWaypoints(wpData as Waypoint[]);
      } else {
        setWaypoints([
          { kind: "goal", title: mapData.goal_statement, confidence: "starter" },
          { kind: "constraint", title: "Connect a source to generate a constraint.", confidence: "starter" },
          { kind: "evidence", title: "No signals yet.", confidence: "starter" },
          { kind: "move", title: "Link GitHub or add a manual note below.", confidence: "starter" },
        ]);
      }
    } catch (err: any) {
      toast.error(err.message ?? "Failed to load map");
    } finally {
      setLoading(false);
    }
  };

  const checkGitHub = async () => {
    const token = await getGitHubToken();
    setGitHubToken(token);
    if (token) {
      try {
        const r = await fetchUserRepos(token);
        setRepos(r);
      } catch { setGitHubToken(null); }
    }
  };

  // ─── Sync + Diagnose ──────────────────────────────────────────────────────

  const fullSync = async (repo: string, mapGoal: string, manualNote: string) => {
    if (!user || !id) return;
    try {
      setSyncing(true);

      let stats: GitHubStats | null = null;
      let flags: ReturnType<typeof buildDiagnosticFlags> = [];

      if (gitHubToken && repo) {
        const [owner, repoName] = repo.split("/");
        stats = await fetchRepoCommitStats(gitHubToken, owner, repoName);
        setGitStats(stats);
        flags = buildDiagnosticFlags(stats);
      }

      // Try LLM layer first
      let result: { waypoints: Waypoint[] };
      try {
        setDiagnosing(true);
        const { data: fnData, error: fnError } = await supabase.functions.invoke("diagnose-map", {
          body: {
            goal_statement: mapGoal,
            flags,
            manual_notes: manualNote || undefined,
          },
        });
        if (fnError) throw fnError;

        const llm = fnData as { constraint: string; evidence: string; move: string; confidence: string };
        const conf = (["emerging", "building", "established"].includes(llm.confidence)
          ? llm.confidence : "emerging") as "emerging" | "established";

        result = {
          waypoints: [
            { kind: "goal", title: mapGoal, confidence: "established" },
            { kind: "constraint", title: llm.constraint, confidence: conf },
            { kind: "evidence", title: llm.evidence, confidence: conf },
            { kind: "move", title: llm.move, confidence: "established" },
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
          confidence: w.confidence === "building" ? "emerging" : w.confidence,
          position: idx,
        }))
      );

      // Update map confidence
      const constraintWp = result.waypoints.find(w => w.kind === "constraint");
      const newConf = constraintWp?.confidence === "established" ? "established" : "emerging";
      await supabase.from("maps").update({ confidence: newConf }).eq("id", id);
      setMap(prev => prev ? { ...prev, confidence: newConf } : null);

    } catch (err: any) {
      toast.error(err.message ?? "Sync failed");
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

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">Loading map…</div>;
  if (!map) return null;

  const isBusy = syncing || diagnosing;

  return (
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
        <Trail
          waypoints={waypoints}
          onFeedback={handleFeedback}
        />
      </div>

      {/* Manual Notes */}
      <div className="mt-12 rounded-[16px] border border-border bg-card p-6">
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
          className="mt-4 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={saveNote} disabled={savingNote || !note.trim()}>
            {savingNote ? "Saving…" : "Save and re-diagnose"}
          </Button>
        </div>
      </div>

      {/* GitHub Connector */}
      <div className="mt-6 rounded-[16px] border border-border bg-card p-6">
        <div className="text-xs font-mono uppercase tracking-widest text-primary">GitHub source</div>

        {!gitHubToken ? (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground mb-3">Connect GitHub to pull commit signals into this map.</p>
            <Link to="/app/integrations">
              <Button variant="outline" className="h-10">
                <Plug className="mr-2 h-4 w-4" /> Connect GitHub
              </Button>
            </Link>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <select
              value={selectedRepo}
              onChange={e => handleLinkRepo(e.target.value)}
              disabled={isBusy}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Select a repository —</option>
              {repos.map(r => <option key={r.id} value={r.full_name}>{r.full_name}</option>)}
            </select>
            {selectedRepo && (
              <Button variant="outline" size="sm"
                onClick={() => map && fullSync(selectedRepo, map.goal_statement, note)}
                disabled={isBusy}>
                {isBusy ? "Syncing…" : "Force sync"}
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
  );
}
