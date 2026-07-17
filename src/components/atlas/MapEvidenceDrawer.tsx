import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Trail } from "@/components/atlas/Trail";
import { supabase } from "@/integrations/supabase/client";
import { CompassLoader } from "@/pages/app/Home";
import { Compass } from "lucide-react";

interface Waypoint {
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
}

interface MapEvidenceDrawerProps {
  open: boolean;
  onClose: () => void;
  mapId: string;
  goalStatement: string;
  mapName?: string;
}

export function MapEvidenceDrawer({ open, onClose, mapId, goalStatement, mapName }: MapEvidenceDrawerProps) {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !mapId) return;

    const fetchWaypoints = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("waypoints")
          .select("id, kind, title, confidence, metadata, completed_at, predicted_signal, predicted_direction, predicted_baseline_value, check_back_date, result_status, result_summary, milestone_id")
          .eq("map_id", mapId)
          .is("completed_at", null) // Display active diagnostic loop trail
          .order("position", { ascending: true });

        if (error) throw error;
        if (data) {
          setWaypoints(data as Waypoint[]);
        }
      } catch (err) {
        console.error("[MapEvidenceDrawer] Error fetching waypoints:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchWaypoints();
  }, [open, mapId]);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg border-l border-border/60 bg-background p-6 overflow-y-auto">
        <SheetHeader className="pb-6 border-b border-border/40">
          <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-primary uppercase mb-1">
            <Compass className="h-3.5 w-3.5" /> Evidence Trail
          </div>
          <SheetTitle className="font-display text-2xl font-semibold leading-tight text-foreground">
            {mapName || "Stated Goal"}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground mt-1.5 italic font-sans">
            "{goalStatement}"
          </SheetDescription>
        </SheetHeader>

        <div className="mt-8">
          {loading ? (
            <div className="py-20 flex justify-center">
              <CompassLoader />
            </div>
          ) : waypoints.length === 0 ? (
            <div className="py-20 text-center text-sm text-muted-foreground">
              No active diagnostic trail found. Make sure this map has been diagnosed.
            </div>
          ) : (
            <div className="pl-1 animate-slide-up">
              <Trail waypoints={waypoints} interactive={true} layout="vertical" />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
