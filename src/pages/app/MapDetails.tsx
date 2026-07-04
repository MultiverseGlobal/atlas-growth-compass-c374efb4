import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Trail } from "@/components/atlas/Trail";
import { getGitHubToken, fetchUserRepos, fetchRepoCommitStats, runGitHubRules, type GitHubRepo, type GitHubStats } from "@/lib/github";
import { ArrowLeft, Github, Plug, Plus, Sparkles, Trash } from "lucide-react";
import { toast } from "sonner";

type MapData = {
  id: string;
  goal_statement: string;
  confidence: "starter" | "emerging" | "established";
  is_published: boolean;
};

export default function MapDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [map, setMap] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // GitHub State
  const [gitHubToken, setGitHubToken] = useState<string | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [syncing, setSyncing] = useState(false);
  const [gitStats, setGitStats] = useState<GitHubStats | null>(null);

  // Waypoints State
  const [waypoints, setWaypoints] = useState<any[]>([]);

  useEffect(() => {
    if (!id || !user) return;
    loadMapAndWaypoints();
    checkGitHubConnection();
  }, [id, user]);

  const loadMapAndWaypoints = async () => {
    try {
      setLoading(true);
      // Fetch map
      const { data: mapData, error: mapError } = await supabase
        .from("maps")
        .select("id, goal_statement, confidence, is_published")
        .eq("id", id)
        .maybeSingle();

      if (mapError) throw mapError;
      if (!mapData) {
        toast.error("Map not found");
        navigate("/app");
        return;
      }
      setMap(mapData as MapData);

      // Fetch linked source
      const { data: sourceData } = await supabase
        .from("sources")
        .select("label")
        .eq("map_id", id)
        .eq("provider", "github")
        .maybeSingle();

      let currentRepo = "";
      if (sourceData) {
        currentRepo = sourceData.label;
        setSelectedRepo(currentRepo);
      }

      // Fetch waypoints
      const { data: waypointData } = await supabase
        .from("waypoints")
        .select("kind, title, confidence")
        .eq("map_id", id)
        .order("position", { ascending: true });

      if (waypointData && waypointData.length > 0) {
        setWaypoints(waypointData);
      } else {
        // Default starter waypoints if none exist
        setWaypoints([
          { kind: "goal", title: mapData.goal_statement, confidence: "starter" },
          { kind: "constraint", title: "Emerging strategy constraints", confidence: "starter" },
          { kind: "evidence", title: "No sources connected yet.", confidence: "starter" },
          { kind: "move", title: "Connect GitHub to evaluate velocity.", confidence: "starter" },
        ]);
      }

      // If we have a repo linked, fetch current stats and evaluate rules
      if (currentRepo) {
        const token = await getGitHubToken();
        if (token) {
          await syncGitHubStats(token, currentRepo, mapData.goal_statement);
        }
      }
    } catch (err: any) {
      toast.error(err.message ?? "Failed to load map");
    } finally {
      setLoading(false);
    }
  };

  const checkGitHubConnection = async () => {
    const token = await getGitHubToken();
    setGitHubToken(token);
    if (token) {
      try {
        const reposData = await fetchUserRepos(token);
        setRepos(reposData);
      } catch (err) {
        // Token might have expired or been revoked
        setGitHubToken(null);
      }
    }
  };

  const syncGitHubStats = async (token: string, repoFullName: string, goal: string) => {
    try {
      setSyncing(true);
      const [owner, repoName] = repoFullName.split("/");
      const stats = await fetchRepoCommitStats(token, owner, repoName);
      setGitStats(stats);

      const ruleResults = runGitHubRules(stats, goal);
      setWaypoints(ruleResults.waypoints);

      // Save waypoints to DB
      await supabase.from("waypoints").delete().eq("map_id", id);
      await supabase.from("waypoints").insert(
        ruleResults.waypoints.map((w, idx) => ({
          map_id: id,
          user_id: user!.id,
          kind: w.kind,
          title: w.title,
          confidence: w.confidence,
          position: idx,
        }))
      );

      // Update map confidence
      const newConfidence = stats.daysSinceLastCommit > 7 ? "emerging" : "established";
      await supabase
        .from("maps")
        .update({ confidence: newConfidence })
        .eq("id", id);

      if (map) {
        setMap((prev) => prev ? { ...prev, confidence: newConfidence } : null);
      }
    } catch (err: any) {
      toast.error("Failed to sync GitHub activity");
    } finally {
      setSyncing(false);
    }
  };

  const handleLinkRepo = async (repoName: string) => {
    if (!repoName || !user || !map) return;
    try {
      setSelectedRepo(repoName);
      setSyncing(true);

      // Delete existing sources for this map
      await supabase.from("sources").delete().eq("map_id", id);

      // Insert new source
      await supabase.from("sources").insert({
        map_id: id,
        user_id: user.id,
        provider: "github",
        label: repoName,
      });

      if (gitHubToken) {
        await syncGitHubStats(gitHubToken, repoName, map.goal_statement);
        toast.success("Repository linked successfully");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteMap = async () => {
    if (!window.confirm("Are you sure you want to delete this map?")) return;
    try {
      setDeleting(true);
      const { error } = await supabase.from("maps").delete().eq("id", id);
      if (error) throw error;
      toast.success("Map deleted");
      navigate("/app");
    } catch (err: any) {
      toast.error(err.message);
      setDeleting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">Loading Map…</div>;
  if (!map) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">
      {/* Header Navigation */}
      <div className="flex items-center justify-between">
        <Link to="/app" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <Button variant="ghost" size="sm" onClick={handleDeleteMap} disabled={deleting} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
          <Trash className="h-4 w-4 mr-1" /> Delete
        </Button>
      </div>

      {/* Goal Title */}
      <div className="mt-8">
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-border bg-card px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
            {map.confidence}
          </span>
          {selectedRepo && (
            <span className="flex items-center gap-1 rounded-md border border-source/30 bg-source/5 px-2.5 py-0.5 font-mono text-[10px] text-source">
              <Github className="h-3 w-3" /> {selectedRepo}
            </span>
          )}
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold leading-tight md:text-4xl">
          {map.goal_statement}
        </h1>
      </div>

      {/* Waypoint Trail */}
      <div className="mt-14">
        <Trail waypoints={waypoints} />
      </div>

      {/* Integrations Connector Block */}
      <div className="mt-16 rounded-[16px] border border-border bg-card p-6 md:p-8">
        <div className="eyebrow text-primary">Connect source</div>
        <h2 className="mt-2 font-display text-xl font-medium leading-snug">
          Integrate a repository to calculate velocity and constraint signals.
        </h2>

        {!gitHubToken ? (
          <div className="mt-6">
            <Link to="/app/integrations">
              <Button className="h-11 px-5">
                <Plug className="mr-2 h-4 w-4" /> Connect GitHub Account
              </Button>
            </Link>
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <select
              value={selectedRepo}
              onChange={(e) => handleLinkRepo(e.target.value)}
              disabled={syncing}
              className="h-11 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">-- Select a repository to link --</option>
              {repos.map((r) => (
                <option key={r.id} value={r.full_name}>
                  {r.full_name}
                </option>
              ))}
            </select>

            {selectedRepo && (
              <Button
                variant="outline"
                onClick={() => syncGitHubStats(gitHubToken, selectedRepo, map.goal_statement)}
                disabled={syncing}
                className="h-11 px-5"
              >
                {syncing ? "Syncing…" : "Force Sync"}
              </Button>
            )}
          </div>
        )}

        {gitStats && (
          <div className="mt-6 border-t border-border pt-4 grid grid-cols-2 gap-4 text-xs font-mono text-muted-foreground">
            <div>Commits this week: <span className="text-foreground">{gitStats.commitsThisWeek}</span></div>
            <div>Commits last week: <span className="text-foreground">{gitStats.commitsLastWeek}</span></div>
            <div>Days since activity: <span className="text-foreground">{gitStats.daysSinceLastCommit}</span></div>
            <div className="col-span-2 truncate">Last commit: <span className="text-foreground">"{gitStats.lastCommitMessage}"</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
