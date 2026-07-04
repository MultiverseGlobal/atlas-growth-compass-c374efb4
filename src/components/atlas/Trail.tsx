import type { Waypoint } from "@/lib/starterMap";

interface TrailProps {
  waypoints: Array<{
    id?: string;
    kind?: string;
    type?: string;
    title: string;
    confidence?: string;
    description?: string;
    label?: string;
    lastUpdatedDays?: number;
  }>;
  /** Optional feedback handler — if provided, feedback buttons appear on constraint + move pins */
  onFeedback?: (waypointKind: string, action: string, waypointTitle: string) => void;
}

const KIND_LABELS: Record<string, string> = {
  goal: "Goal",
  constraint: "Constraint",
  evidence: "Evidence",
  move: "Next move",
};

// Pin visual varies by waypoint type + confidence tier.
// goal = gold filled; constraint = brick outline; evidence = sage outline; move = ink filled.
function Pin({ kind, confidence }: { kind: string; confidence?: string }) {
  const stroke =
    kind === "goal"
      ? "hsl(var(--primary))"
      : kind === "constraint"
      ? "hsl(var(--destructive))"
      : kind === "evidence"
      ? "hsl(var(--source))"
      : "hsl(var(--foreground))";

  // Confidence → fill amount for the inner disc.
  // emerging / starter = hollow; building = half-filled; established = solid.
  const innerFill =
    confidence === "established"
      ? stroke
      : confidence === "building"
      ? `url(#half-${kind})`
      : "transparent";

  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id={`half-${kind}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="50%" stopColor={stroke} />
          <stop offset="50%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <circle cx="11" cy="11" r="8" fill="hsl(var(--background))" stroke={stroke} strokeWidth="1.75" />
      <circle cx="11" cy="11" r="4.5" fill={innerFill} />
    </svg>
  );
}

export function Trail({ waypoints, onFeedback }: TrailProps) {
  return (
    <div className="relative pl-8">
      {/* Dotted vertical line */}
      <div
        aria-hidden
        className="trail-line trail-draw absolute left-[10px] top-2 bottom-2"
      />

      <ol className="space-y-10">
        {waypoints.map((w, i) => {
          // Support both `kind` (DB) and `type` (legacy starterMap) field names
          const kind = (w.kind ?? w.type ?? "goal") as string;
          const label = w.label ?? KIND_LABELS[kind] ?? kind;
          const confidence = w.confidence as string | undefined;

          return (
            <li
              key={i}
              className="relative waypoint-rise"
              style={{ animationDelay: `${0.5 + i * 0.4}s` }}
            >
              {/* Pin */}
              <div className="absolute -left-8 top-0.5">
                <Pin kind={kind} confidence={confidence} />
              </div>

              <div className="max-w-2xl">
                <div className="eyebrow text-muted-foreground">{label}</div>
                <h3 className="mt-2 font-display text-2xl md:text-[26px] leading-snug text-foreground">
                  {w.title}
                </h3>
                {w.description && (
                  <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                    {w.description}
                  </p>
                )}
                {typeof w.lastUpdatedDays === "number" && w.lastUpdatedDays >= 7 && (
                  <p className="mt-3 font-mono text-xs text-muted-foreground">
                    Last updated {w.lastUpdatedDays} days ago
                  </p>
                )}

                {/* Feedback actions — only rendered when onFeedback is provided */}
                {onFeedback && kind === "constraint" && (
                  <button
                    type="button"
                    onClick={() => onFeedback(kind, "constraint_wrong", w.title)}
                    className="mt-3 font-mono text-xs text-muted-foreground/60 underline underline-offset-2 hover:text-muted-foreground transition-colors"
                  >
                    This isn't right
                  </button>
                )}
                {onFeedback && kind === "move" && (
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onFeedback(kind, "move_done", w.title)}
                      className="font-mono text-xs text-muted-foreground/60 underline underline-offset-2 hover:text-muted-foreground transition-colors"
                    >
                      Done
                    </button>
                    <span className="text-border">·</span>
                    <button
                      type="button"
                      onClick={() => onFeedback(kind, "move_skipped", w.title)}
                      className="font-mono text-xs text-muted-foreground/60 underline underline-offset-2 hover:text-muted-foreground transition-colors"
                    >
                      Skip
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
