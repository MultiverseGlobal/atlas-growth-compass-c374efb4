import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, ArrowRight, Download, Lock, RefreshCw, GitCommit, Target, AlertTriangle, Lightbulb, Zap, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMaps } from "@/hooks/useMaps";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Waypoint = {
  id: string;
  kind: "goal" | "constraint" | "evidence" | "move";
  title: string;
  confidence: "starter" | "emerging" | "established";
  metadata?: any;
};

type ReportData = {
  map: { id: string; goal_statement: string; confidence: string; updated_at: string };
  waypoints: Waypoint[];
  source: string | null;
  signalCount: number;
  generatedAt: Date;
};

const CONFIDENCE_LABEL: Record<string, string> = {
  starter:     "Starter — early signals only",
  emerging:    "Emerging — pattern forming",
  established: "Established — high confidence",
};

const CONFIDENCE_COLOR: Record<string, string> = {
  starter:     "text-muted-foreground",
  emerging:    "text-amber-400",
  established: "text-green-400",
};

export default function Reports() {
  const { user } = useAuth();
  const { data: maps = [], isLoading: mapsLoading } = useMaps();

  const [selectedMapId, setSelectedMapId] = useState<string>("");
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeFormat, setActiveFormat] = useState<"constraint" | "progress" | "investor">("constraint");

  // Auto-select the most recently updated map
  useEffect(() => {
    if (maps.length > 0 && !selectedMapId) {
      setSelectedMapId(maps[0].id);
    }
  }, [maps]);

  // Generate report whenever selected map changes
  useEffect(() => {
    if (selectedMapId) generateReport(selectedMapId);
  }, [selectedMapId]);

  const generateReport = async (mapId: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const [
        { data: mapData },
        { data: waypointsData },
        { data: sourceData },
        { data: signalsData },
      ] = await Promise.all([
        supabase.from("maps").select("id, goal_statement, confidence, updated_at").eq("id", mapId).maybeSingle(),
        supabase.from("waypoints").select("id, kind, title, confidence, metadata").eq("map_id", mapId).order("position", { ascending: true }),
        supabase.from("sources").select("label").eq("map_id", mapId).eq("provider", "github").maybeSingle(),
        supabase.from("signals").select("id").eq("map_id", mapId),
      ]);

      if (!mapData) return;

      setReport({
        map: mapData as any,
        waypoints: (waypointsData ?? []) as Waypoint[],
        source: sourceData?.label ?? null,
        signalCount: signalsData?.length ?? 0,
        generatedAt: new Date(),
      });
    } finally {
      setLoading(false);
    }
  };

  const wp = (kind: Waypoint["kind"]) =>
    report?.waypoints.find((w) => w.kind === kind);

  const hasEstablishedConstraint =
    report?.waypoints.some((w) => w.kind === "constraint" && w.confidence !== "starter") ?? false;

  const printReport = () => window.print();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 md:px-8">
      {/* Header */}
      <div className="text-xs font-mono uppercase tracking-widest text-primary">Reports</div>
      <div className="mt-2 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold leading-tight md:text-5xl">
            Structured outputs
          </h1>
          <p className="mt-3 text-[15px] text-muted-foreground max-w-xl">
            Reports are generated from your maps — not filled in by you.
          </p>
        </div>

        {/* Map selector */}
        {maps.length > 0 && (
          <div className="shrink-0">
            <Select value={selectedMapId} onValueChange={setSelectedMapId} disabled={mapsLoading}>
              <SelectTrigger className="w-[260px] bg-background text-sm">
                <SelectValue placeholder="Select a map" />
              </SelectTrigger>
              <SelectContent>
                {maps.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="truncate max-w-[220px] block">{m.goal_statement}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Format tabs */}
      <div className="mt-8 flex gap-1 border-b border-border">
        {(["constraint", "progress", "investor"] as const).map((fmt) => (
          <button
            key={fmt}
            onClick={() => setActiveFormat(fmt)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeFormat === fmt
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {fmt === "constraint" ? "Constraint Summary" : fmt === "progress" ? "Progress Report" : "Investor Digest"}
          </button>
        ))}
      </div>

      {/* ── CONSTRAINT SUMMARY ── */}
      {activeFormat === "constraint" && (
        <div className="mt-6">
          {maps.length === 0 ? (
            <EmptyMaps />
          ) : !report && !loading ? (
            <div className="text-sm text-muted-foreground">Select a map above to generate a report.</div>
          ) : loading ? (
            <LoadingState />
          ) : !hasEstablishedConstraint ? (
            <div className="rounded-[14px] border border-border bg-card/60 px-5 py-5 flex items-start gap-3">
              <Lock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="space-y-1">
                <div className="text-sm font-medium">Not enough signal yet</div>
                <p className="text-sm text-muted-foreground">
                  This map's constraint is at{" "}
                  <span className="font-mono">{report?.map.confidence}</span> confidence.
                  Sync GitHub and add context notes to strengthen the signal — the report unlocks at emerging or established confidence.
                </p>
                <Link
                  to={`/app/map/${report?.map.id}`}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  Go to this map <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ) : report ? (
            <ConstraintSummary report={report} wp={wp} onRefresh={() => generateReport(selectedMapId)} onPrint={printReport} />
          ) : null}
        </div>
      )}

      {/* ── PROGRESS REPORT ── */}
      {activeFormat === "progress" && (
        <div className="mt-6">
          {report && report.signalCount > 0 ? (
            <ProgressReport report={report} />
          ) : (
            <ComingSoon
              label="Progress report"
              description="Week-over-week signal history. Shows how constraint confidence changed over time."
              unlockNote={report ? `${report.signalCount} signals collected so far — progress report available once your map has multiple diagnostic runs.` : undefined}
            />
          )}
        </div>
      )}

      {/* ── INVESTOR DIGEST ── */}
      {activeFormat === "investor" && (
        <div className="mt-6">
          <ComingSoon
            label="Investor digest"
            description="Formatted update for a pre-seed round: goal, traction signals, key constraint, ask."
            unlockNote="Requires Stripe integration for MRR data. Connect Stripe from the Integrations page first."
            ctaLabel="Connect Stripe"
            ctaHref="/app/integrations"
          />
        </div>
      )}
    </div>
  );
}

// ─── Constraint Summary Card ──────────────────────────────────────────────────

function ConstraintSummary({
  report,
  wp,
  onRefresh,
  onPrint,
}: {
  report: ReportData;
  wp: (kind: Waypoint["kind"]) => Waypoint | undefined;
  onRefresh: () => void;
  onPrint: () => void;
}) {
  const goal = wp("goal");
  const constraint = wp("constraint");
  const evidence = wp("evidence");
  const move = wp("move");
  const conf = report.map.confidence as string;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono ${CONFIDENCE_COLOR[conf] ?? "text-muted-foreground"}`}>
            {CONFIDENCE_LABEL[conf] ?? conf}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={onRefresh}>
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onPrint}>
            <Download className="h-3 w-3" /> Print / Save PDF
          </Button>
        </div>
      </div>

      {/* Report card */}
      <div className="rounded-[18px] border border-border bg-card overflow-hidden print:shadow-none">
        {/* Report header band */}
        <div className="bg-primary/5 border-b border-border px-6 py-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-primary mb-1.5">Constraint Summary</div>
            <p className="font-display text-xl font-semibold leading-snug max-w-lg">{report.map.goal_statement}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Generated</div>
            <div className="text-xs font-mono text-foreground mt-0.5">
              {report.generatedAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </div>
          </div>
        </div>

        <div className="divide-y divide-border">
          {/* Goal */}
          {goal && (
            <ReportSection
              icon={<Target className="h-4 w-4 text-primary" />}
              label="Goal"
              confidence={goal.confidence}
            >
              {goal.title}
            </ReportSection>
          )}

          {/* Constraint */}
          {constraint && (
            <ReportSection
              icon={<AlertTriangle className="h-4 w-4 text-amber-400" />}
              label="Active constraint"
              confidence={constraint.confidence}
            >
              {constraint.title}
            </ReportSection>
          )}

          {/* Evidence */}
          {evidence && (
            <ReportSection
              icon={<Lightbulb className="h-4 w-4 text-blue-400" />}
              label="Evidence"
              confidence={evidence.confidence}
            >
              {evidence.title}
            </ReportSection>
          )}

          {/* Next move */}
          {move && (
            <ReportSection
              icon={<Zap className="h-4 w-4 text-green-400" />}
              label="Recommended next move"
              confidence={move.confidence}
              highlight
            >
              {move.title}
            </ReportSection>
          )}
        </div>

        {/* Footer metadata */}
        <div className="px-6 py-4 bg-muted/30 border-t border-border flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-mono text-muted-foreground">
          {report.source && (
            <span className="flex items-center gap-1.5">
              <GitCommit className="h-3 w-3" /> {report.source}
            </span>
          )}
          <span>{report.signalCount} signals ingested</span>
          <span className={CONFIDENCE_COLOR[report.map.confidence]}>
            {CONFIDENCE_LABEL[report.map.confidence] ?? report.map.confidence}
          </span>
        </div>
      </div>
    </div>
  );
}

function ReportSection({
  icon,
  label,
  confidence,
  children,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  confidence: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`px-6 py-5 ${highlight ? "bg-primary/5" : ""}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className={`ml-auto text-[10px] font-mono ${CONFIDENCE_COLOR[confidence] ?? "text-muted-foreground"}`}>
          {confidence}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-foreground">{children}</p>
    </div>
  );
}

// ─── Progress Report ──────────────────────────────────────────────────────────

function ProgressReport({ report }: { report: ReportData }) {
  return (
    <div className="space-y-4">
      <div className="rounded-[14px] border border-border bg-card/60 px-5 py-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="text-xs font-mono uppercase tracking-widest text-primary">Signal Activity</span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatBlock label="Total signals" value={String(report.signalCount)} />
          <StatBlock label="Confidence" value={report.map.confidence} colored />
          <StatBlock label="Last updated" value={new Date(report.map.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Full week-over-week confidence history will appear here once your map has multiple diagnostic runs. Each sync creates a new data point.
        </p>
        <Link to={`/app/map/${report.map.id}`} className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          Run a sync now <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function StatBlock({ label, value, colored }: { label: string; value: string; colored?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <div className={`text-lg font-semibold ${colored ? (CONFIDENCE_COLOR[value] ?? "") : ""}`}>{value}</div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ComingSoon({
  label,
  description,
  unlockNote,
  ctaLabel,
  ctaHref,
}: {
  label: string;
  description: string;
  unlockNote?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="rounded-[14px] border border-border bg-card/60 px-6 py-6 space-y-3">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      {unlockNote && (
        <p className="text-xs text-muted-foreground/70 border-l-2 border-border pl-3">{unlockNote}</p>
      )}
      {ctaLabel && ctaHref && (
        <Link to={ctaHref} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-1">
          {ctaLabel} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function EmptyMaps() {
  return (
    <div className="rounded-[14px] border border-border bg-card/60 px-5 py-5">
      <p className="text-sm text-muted-foreground">
        No maps yet.{" "}
        <Link to="/app" className="text-primary hover:underline">Create your first map</Link>{" "}
        to generate reports.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground py-8">
      <RefreshCw className="h-4 w-4 animate-spin" />
      Generating report…
    </div>
  );
}
