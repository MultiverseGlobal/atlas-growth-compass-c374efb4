import { useState } from "react";
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
  interactive?: boolean;
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

export function Trail({ waypoints, onFeedback, interactive }: TrailProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <div className="relative pl-8">
      {/* Flowing SVGs for the cartographic pathway */}
      <svg className="absolute left-[9px] top-3 bottom-3 w-[4px] h-[calc(100%-24px)] pointer-events-none" aria-hidden="true">
        <line
          x1="2"
          y1="0"
          x2="2"
          y2="100%"
          stroke="hsl(var(--primary) / 0.55)"
          strokeWidth="2.5"
          className="flow-line"
        />
      </svg>

      <ol className="space-y-10">
        {waypoints.map((w, i) => {
          // Support both `kind` (DB) and `type` (legacy starterMap) field names
          const kind = (w.kind ?? w.type ?? "goal") as string;
          const label = w.label ?? KIND_LABELS[kind] ?? kind;
          const confidence = w.confidence as string | undefined;
          const isExpanded = !interactive || expandedIndex === i;
          const descriptionText = w.description || (interactive ? "Establish more integrations or context inputs to update and verify this waypoint status." : undefined);

          return (
            <li
              key={i}
              className={`relative waypoint-rise ${interactive ? "cursor-pointer group select-none" : ""}`}
              style={{ animationDelay: `${0.5 + i * 0.4}s` }}
              onClick={() => {
                if (interactive) {
                  setExpandedIndex(isExpanded ? null : i);
                }
              }}
            >
              {/* Pin with Sonar ring for Active/Constraint blocking factors */}
              <div className="absolute -left-8 top-0.5">
                {kind === "constraint" && (
                  <div className="absolute left-[-2px] top-[-2px] h-[26px] w-[26px] pointer-events-none rounded-full border border-destructive/60 sonar-ring" />
                )}
                <Pin kind={kind} confidence={confidence} />
              </div>

              <div className="max-w-2xl">
                <div className="eyebrow text-muted-foreground group-hover:text-primary transition-colors">{label}</div>
                <h3 className="mt-2 font-display text-2xl md:text-[26px] leading-snug text-foreground group-hover:text-primary/95 transition-colors">
                  {w.title}
                </h3>
                {descriptionText && isExpanded && (
                  <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground page-fade">
                    {descriptionText}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      onFeedback(kind, "constraint_wrong", w.title);
                    }}
                    className="mt-3 font-mono text-xs text-muted-foreground/60 underline underline-offset-2 hover:text-muted-foreground transition-colors"
                  >
                    This isn't right
                  </button>
                )}
                {onFeedback && kind === "move" && (
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onFeedback(kind, "move_done", w.title);
                      }}
                      className="font-mono text-xs text-muted-foreground/60 underline underline-offset-2 hover:text-muted-foreground transition-colors"
                    >
                      Done
                    </button>
                    <span className="text-border">·</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onFeedback(kind, "move_skipped", w.title);
                      }}
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
