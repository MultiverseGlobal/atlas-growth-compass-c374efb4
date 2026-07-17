import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Plus, Target, Sparkles, Compass, MessageSquare, Check, X, Calendar, ArrowUpRight, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMaps } from "@/hooks/useMaps";
import { useAuth } from "@/hooks/useAuth";
import { canCreateMap } from "@/lib/planGate";
import { UpgradeModal } from "@/components/atlas/UpgradeModal";
import { loadStarterMap, clearStarterMap } from "@/lib/starterMap";
import { NewMapModal } from "@/components/atlas/NewMapModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MapEvidenceDrawer } from "@/components/atlas/MapEvidenceDrawer";
import { ChatDrawer } from "@/components/atlas/ChatDrawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Helper to get formatted dates in local timezone
const getLocalDateString = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function Home() {
  const { user } = useAuth();
  const { data: maps = [], isLoading, claimStarterMap } = useMaps();
  const [showNewMapModal, setShowNewMapModal] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const navigate = useNavigate();

  const [activeMap, setActiveMap] = useState<any>(null);
  const [activeMove, setActiveMove] = useState<any>(null);
  const [commitment, setCommitment] = useState<any>(null);
  const [yesterdayCommitment, setYesterdayCommitment] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [diagnosing, setDiagnosing] = useState(false);
  const [submittingCheckin, setSubmittingCheckin] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // Evening check-in triggers at 6:00 PM (18:00) local time
  const [isEvening, setIsEvening] = useState(() => new Date().getHours() >= 18);
  const [checkinOutcome, setCheckinOutcome] = useState<"yes" | "no" | null>(null);
  const [obstacleNote, setObstacleNote] = useState("");

  const todayStr = getLocalDateString(0);
  const yesterdayStr = getLocalDateString(-1);

  // Monitor time changes to toggle evening mode
  useEffect(() => {
    const interval = setInterval(() => {
      setIsEvening(new Date().getHours() >= 18);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Update active map when list loads
  useEffect(() => {
    if (maps.length > 0 && !activeMap) {
      setActiveMap(maps[0]);
    }
  }, [maps, activeMap]);

  // Load details whenever active map changes
  useEffect(() => {
    if (activeMap?.id) {
      loadMapLoopDetails(activeMap.id);
    }
  }, [activeMap]);

  const loadMapLoopDetails = async (mapId: string) => {
    setLoadingDetails(true);
    try {
      // 1. Get active move (completed_at is null)
      const { data: wps, error: wpErr } = await supabase
        .from("waypoints")
        .select("*")
        .eq("map_id", mapId)
        .eq("kind", "move")
        .is("completed_at", null)
        .order("created_at", { ascending: false })
        .limit(1);

      if (wpErr) throw wpErr;
      const move = wps?.[0] || null;
      setActiveMove(move);

      // 2. Get today's commitment
      const { data: commitToday, error: commitErr } = await supabase
        .from("commitments")
        .select("*")
        .eq("map_id", mapId)
        .eq("date", todayStr)
        .maybeSingle();

      if (commitErr) throw commitErr;
      setCommitment(commitToday);

      // 3. Get yesterday's commitment
      const { data: commitYesterday, error: yestErr } = await supabase
        .from("commitments")
        .select("*")
        .eq("map_id", mapId)
        .eq("date", yesterdayStr)
        .maybeSingle();

      if (yestErr) throw yestErr;
      setYesterdayCommitment(commitYesterday);
    } catch (err: any) {
      console.error("[Home] Error loading details:", err.message);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCommit = async () => {
    if (!activeMap || !activeMove || !user) return;
    try {
      const { data, error } = await supabase
        .from("commitments")
        .insert({
          map_id: activeMap.id,
          waypoint_id: activeMove.id,
          user_id: user.id,
          date: todayStr,
          status: "committed",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
        .select()
        .single();

      if (error) throw error;
      setCommitment(data);
      toast.success("Committed to today's move");
    } catch (err: any) {
      toast.error("Failed to commit: " + err.message);
    }
  };

  const handleCheckin = async (status: "done" | "not_done") => {
    if (!commitment) return;
    setSubmittingCheckin(true);
    try {
      const updates: any = {
        status,
        note: status === "not_done" ? obstacleNote.trim() || null : null,
      };

      const { data, error } = await supabase
        .from("commitments")
        .update(updates)
        .eq("id", commitment.id)
        .select()
        .single();

      if (error) throw error;

      // If done, also mark the active move waypoint completed
      if (status === "done" && activeMove) {
        await supabase
          .from("waypoints")
          .update({ completed_at: new Date().toISOString() })
          .eq("id", activeMove.id);
      }

      setCommitment(data);
      toast.success(status === "done" ? "Nicely done!" : "Logged. Onward to tomorrow.");
      // Reload details to clear/update active move
      loadMapLoopDetails(activeMap.id);
    } catch (err: any) {
      toast.error("Failed to save check-in: " + err.message);
    } finally {
      setSubmittingCheckin(false);
      setCheckinOutcome(null);
      setObstacleNote("");
    }
  };

  const handleDiagnose = async () => {
    if (!activeMap) return;
    setDiagnosing(true);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("diagnose-map", {
        body: { map_id: activeMap.id },
      });

      if (fnError) throw fnError;
      const llm = fnData;
      const conf = (["emerging", "building", "established"].includes(llm.confidence)
        ? llm.confidence : "emerging") as "emerging" | "established";

      const newWaypoints = [
        { kind: "goal", title: activeMap.goal_statement, confidence: "established" },
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
        },
      ];

      // Update DB waypoints
      await supabase.from("waypoints").delete().eq("map_id", activeMap.id).is("completed_at", null);
      await supabase.from("waypoints").insert(
        newWaypoints.map((w, idx) => ({
          map_id: activeMap.id,
          user_id: user?.id,
          kind: w.kind,
          title: w.title,
          confidence: w.confidence,
          position: idx,
          metadata: w.metadata || null,
          predicted_signal: w.predicted_signal || null,
          predicted_direction: w.predicted_direction || null,
          predicted_baseline_value: w.predicted_baseline_value || null,
          check_back_date: w.check_back_date || null,
          result_status: w.result_status || "pending",
          result_summary: w.result_summary || null,
        }))
      );

      await supabase.from("maps").update({ confidence: conf }).eq("id", activeMap.id);

      toast.success("Diagnosis updated!");
      loadMapLoopDetails(activeMap.id);
    } catch (err: any) {
      toast.error("Diagnosis failed: " + (err.message || err));
    } finally {
      setDiagnosing(false);
    }
  };

  const starterMap = loadStarterMap();
  const hasClaimedStarter = maps.length > 0;

  useEffect(() => {
    if (hasClaimedStarter) clearStarterMap();
  }, [hasClaimedStarter]);

  const handleNewMap = async () => {
    if (!user) return;
    const allowed = await canCreateMap(user.id);
    if (!allowed) { setShowUpgrade(true); return; }
    setShowNewMapModal(true);
  };

  const handleClaim = async () => {
    if (!starterMap) return;
    setClaiming(true);
    await claimStarterMap.mutateAsync({
      name: starterMap.goalStatement.slice(0, 60),
      goalStatement: starterMap.goalStatement,
    });
    setClaiming(false);
  };

  return (
    <div className="relative page-hero mx-auto max-w-xl px-6 py-12 md:py-20 animate-fade-in">
      {/* Top Header / Map Selection */}
      <div className="flex items-center justify-between border-b border-border/40 pb-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Compass className="h-4 w-4 animate-spin-slow" />
          </div>
          {maps.length > 1 ? (
            <Select
              value={activeMap?.id}
              onValueChange={(val) => {
                const found = maps.find((m) => m.id === val);
                if (found) setActiveMap(found);
              }}
            >
              <SelectTrigger className="w-[180px] bg-transparent border-none text-sm font-semibold font-display shadow-none p-0 focus:ring-0">
                <SelectValue placeholder="Select map" />
              </SelectTrigger>
              <SelectContent>
                {maps.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.name || m.goal_statement.slice(0, 24)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="font-semibold text-sm font-display tracking-tight text-foreground">
              {activeMap?.name || "Atlas Execution"}
            </span>
          )}
        </div>
        
        <Button
          onClick={handleNewMap}
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground hover:text-foreground text-xs"
        >
          <Plus className="h-3.5 w-3.5" /> New Goal
        </Button>
      </div>

      {isLoading || loadingDetails ? (
        <div className="py-20">
          <CompassLoader />
        </div>
      ) : maps.length === 0 && !starterMap ? (
        <EmptyState onNew={handleNewMap} />
      ) : (
        <div className="space-y-10">
          {/* Main Execution Surfaces */}
          
          {/* Unclaimed starter map block */}
          {!hasClaimedStarter && starterMap && (
            <div className="flex items-center justify-between gap-4 rounded-[16px] border border-dashed border-primary/40 bg-primary/5 px-5 py-5">
              <div className="min-w-0 flex-1">
                <span className="eyebrow text-primary">Unsaved map</span>
                <p className="mt-1.5 font-medium leading-snug truncate">{starterMap.goalStatement}</p>
              </div>
              <Button size="sm" variant="outline" onClick={handleClaim} disabled={claiming} className="shrink-0">
                {claiming ? "Saving…" : "Save to account"}
              </Button>
            </div>
          )}

          {activeMap && (
            <div className="space-y-6">
              {/* Yesterday Status Banner (Exploratory / Continuative) */}
              {yesterdayCommitment && yesterdayCommitment.status === "not_done" && (
                <div className="text-xs text-muted-foreground/80 bg-muted/30 border border-border/30 rounded-lg p-3 font-sans leading-relaxed animate-slide-up">
                  Yesterday: not done {yesterdayCommitment.note ? `— "${yesterdayCommitment.note}"` : ""}
                </div>
              )}

              {/* State A: Commitment Flow (No commitment today yet) */}
              {!commitment && (
                <div className="space-y-6 animate-slide-up">
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" /> Morning Commitment
                    </span>
                    <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground leading-tight">
                      Today's move
                    </h2>
                  </div>

                  {activeMove ? (
                    <div className="card-warm px-6 py-6 border border-border/60 shadow-sm relative overflow-hidden">
                      <p className="font-sans text-base text-foreground leading-relaxed">
                        {activeMove.title}
                      </p>
                      
                      <div className="mt-6 flex items-center gap-4">
                        <Button
                          onClick={handleCommit}
                          className="bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold px-4 py-2 rounded-md shadow-sm"
                        >
                          I'm doing this
                        </Button>
                        <button
                          onClick={() => setShowEvidence(true)}
                          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors font-medium"
                        >
                          Why this?
                        </button>
                        <span className="text-border/60 text-xs">|</span>
                        <button
                          onClick={() => setShowChat(true)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
                        >
                          Discuss this
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="card-warm px-6 py-6 text-center border border-dashed border-border/80">
                      <p className="text-sm text-muted-foreground mb-4">
                        Atlas needs to diagnose your goals to identify today's move.
                      </p>
                      <Button
                        onClick={handleDiagnose}
                        disabled={diagnosing}
                        className="bg-primary text-primary-foreground text-xs"
                      >
                        {diagnosing ? "Diagnosing..." : "Diagnose now →"}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* State B: Committed & Before 6 PM (Committed Read-only State) */}
              {commitment && commitment.status === "committed" && !isEvening && (
                <div className="space-y-6 animate-slide-up">
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono tracking-widest text-primary uppercase flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-primary" /> Active Commitment
                    </span>
                    <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground leading-tight">
                      Committed
                    </h2>
                  </div>

                  <div className="card-warm px-6 py-6 border border-primary/20 bg-primary/[0.02] shadow-sm">
                    <p className="font-sans text-base text-foreground/90 leading-relaxed italic">
                      "{activeMove?.title || "Daily Move"}"
                    </p>
                    
                    <div className="mt-6 flex items-center gap-4 border-t border-border/40 pt-4">
                      <button
                        onClick={() => setShowEvidence(true)}
                        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 font-medium"
                      >
                        Why this?
                      </button>
                      <span className="text-border/60 text-xs">|</span>
                      <button
                        onClick={() => setShowChat(true)}
                        className="text-xs text-muted-foreground hover:text-foreground font-medium"
                      >
                        Discuss this
                      </button>
                      <span className="text-border/60 text-xs">|</span>
                      <button
                        onClick={() => {
                          setIsEvening(true);
                        }}
                        className="text-xs text-muted-foreground/60 hover:text-foreground"
                      >
                        Trigger Check-in (Mock)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* State C: Evening Check-in (Committed & 6 PM or Later) */}
              {commitment && commitment.status === "committed" && isEvening && (
                <div className="space-y-6 animate-slide-up">
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono tracking-widest text-warning uppercase flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" /> Evening Check-in
                    </span>
                    <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground leading-tight">
                      Did you do it?
                    </h2>
                    <p className="text-xs text-muted-foreground italic mt-1">
                      "{activeMove?.title || "Daily Move"}"
                    </p>
                  </div>

                  {checkinOutcome === null ? (
                    <div className="flex gap-4">
                      <Button
                        onClick={() => handleCheckin("done")}
                        disabled={submittingCheckin}
                        className="flex-1 bg-primary text-primary-foreground hover:bg-primary/95 py-6 font-semibold"
                      >
                        Yes
                      </Button>
                      <Button
                        onClick={() => setCheckinOutcome("no")}
                        disabled={submittingCheckin}
                        variant="outline"
                        className="flex-1 py-6 hover:bg-muted/40 font-semibold"
                      >
                        No
                      </Button>
                    </div>
                  ) : (
                    <div className="card-warm p-5 border border-border/60 space-y-4">
                      <label className="block text-xs font-medium text-muted-foreground">
                        What got in the way? (optional)
                      </label>
                      <textarea
                        value={obstacleNote}
                        onChange={(e) => setObstacleNote(e.target.value)}
                        placeholder="Distractions, technical locks, shift in priorities..."
                        className="w-full min-h-[80px] bg-background border border-border/60 rounded-md p-3 text-sm focus:outline-none focus:border-primary/50 font-sans"
                      />
                      <div className="flex justify-between items-center">
                        <Button
                          variant="ghost"
                          onClick={() => setCheckinOutcome(null)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Back
                        </Button>
                        <Button
                          onClick={() => handleCheckin("not_done")}
                          disabled={submittingCheckin}
                          className="bg-primary text-primary-foreground text-xs"
                        >
                          Submit check-in
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setShowEvidence(true)}
                      className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 font-medium"
                    >
                      Why this?
                    </button>
                    <span className="text-border/60 text-xs">|</span>
                    <button
                      onClick={() => setShowChat(true)}
                      className="text-xs text-muted-foreground hover:text-foreground font-medium"
                    >
                      Discuss this
                    </button>
                  </div>
                </div>
              )}

              {/* State D: Commitment Checked In (Done or Not Done) */}
              {commitment && (commitment.status === "done" || commitment.status === "not_done") && (
                <div className="space-y-6 animate-slide-up">
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-500" /> Day Concluded
                    </span>
                    <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground leading-tight">
                      Concluded
                    </h2>
                  </div>

                  <div className="card-warm px-6 py-6 border border-border/60 shadow-sm space-y-4">
                    <div className="space-y-1">
                      <div className="text-xs font-mono text-muted-foreground">Committed Move:</div>
                      <p className="text-sm font-medium text-foreground/80 line-through decoration-muted-foreground/30">
                        {activeMove?.title || "Daily Move"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <span>Outcome:</span>
                      {commitment.status === "done" ? (
                        <span className="text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          Done
                        </span>
                      ) : (
                        <span className="text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-full">
                          Not Done
                        </span>
                      )}
                    </div>

                    {commitment.note && (
                      <div className="text-xs italic text-muted-foreground bg-muted/20 border border-border/30 rounded p-3 font-sans leading-relaxed">
                        Obstacle: "{commitment.note}"
                      </div>
                    )}

                    <div className="flex items-center gap-4 border-t border-border/40 pt-4">
                      <button
                        onClick={() => setShowEvidence(true)}
                        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 font-medium"
                      >
                        Why this?
                      </button>
                      <span className="text-border/60 text-xs">|</span>
                      <button
                        onClick={() => setShowChat(true)}
                        className="text-xs text-muted-foreground hover:text-foreground font-medium"
                      >
                        Discuss this
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Persistent Action Panel Footer */}
          {activeMap && (
            <div className="flex items-center justify-between border-t border-border/40 pt-6 text-xs text-muted-foreground">
              <button
                onClick={() => setShowChat(true)}
                className="flex items-center gap-2 hover:text-foreground transition-colors font-semibold"
              >
                <MessageSquare className="h-4 w-4" /> Discuss this with Atlas
              </button>
              <Link
                to={`/app/map/${activeMap.id}`}
                className="flex items-center gap-1.5 hover:text-foreground transition-colors font-semibold"
              >
                Diagnostic Map <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Overlays / Modals */}
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
      <NewMapModal open={showNewMapModal} onClose={() => setShowNewMapModal(false)} />
      
      {activeMap && (
        <MapEvidenceDrawer
          open={showEvidence}
          onClose={() => setShowEvidence(false)}
          mapId={activeMap.id}
          goalStatement={activeMap.goal_statement}
          mapName={activeMap.name}
        />
      )}

      {activeMap && (
        <ChatDrawer
          open={showChat}
          onClose={() => setShowChat(false)}
          mapId={activeMap.id}
          mapName={activeMap.name}
          onActionExecuted={(actionType) => {
            loadMapLoopDetails(activeMap.id);
          }}
        />
      )}
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="rounded-[20px] border border-dashed border-border bg-card/40 px-8 py-16 text-center animate-slide-up">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-primary">
        <Sparkles className="h-6 w-6" />
      </div>
      <h3 className="font-display text-xl font-semibold text-foreground">No active goals yet</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto font-sans leading-relaxed">
        State a single goal. Atlas will map the constraints and provide a daily execution loop.
      </p>
      <Button onClick={onNew} className="mt-6 gap-2 bg-primary hover:bg-primary/95 font-semibold text-xs py-2.5 px-5">
        <Compass className="h-4 w-4" />
        Create your first goal
      </Button>
    </div>
  );
}

export function CompassLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-14 space-y-3.5">
      <div className="relative">
        <div className="absolute inset-0 rounded-full border border-primary/20 scale-125" />
        <svg className="h-10 w-10 text-primary compass-spin relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" fill="currentColor" fillOpacity="0.25" />
          <line x1="12" y1="2" x2="12" y2="4" strokeLinecap="round" />
          <line x1="12" y1="20" x2="12" y2="22" strokeLinecap="round" />
          <line x1="2" y1="12" x2="4" y2="12" strokeLinecap="round" />
          <line x1="20" y1="12" x2="22" y2="12" strokeLinecap="round" />
        </svg>
      </div>
      <div className="text-[10px] font-mono tracking-widest text-muted-foreground/80 uppercase animate-pulse">
        Orienting loop…
      </div>
    </div>
  );
}