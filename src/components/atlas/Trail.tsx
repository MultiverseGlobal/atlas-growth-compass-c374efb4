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
    metadata?: any;
  }>;
  /** Optional feedback handler — if provided, feedback buttons appear on constraint + move pins */
  onFeedback?: (waypointKind: string, action: string, waypointTitle: string) => void;
  interactive?: boolean;
  layout?: "vertical" | "horizontal";
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

export function Trail({ waypoints, onFeedback, interactive, layout = "vertical" }: TrailProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (layout === "horizontal") {
    return (
      <div className="relative w-full py-4 px-2">
        {/* Horizontal gold line */}
        <div className="absolute left-10 right-10 top-[26px] h-[2px] pointer-events-none overflow-hidden" aria-hidden="true">
          <svg className="w-full h-full" viewBox="0 0 100 2" preserveAspectRatio="none">
            <line
              x1="0"
              y1="1"
              x2="100"
              y2="1"
              stroke="hsl(var(--primary) / 0.55)"
              strokeWidth="2"
              className="flow-line"
            />
          </svg>
        </div>

        <ol className="relative z-10 flex flex-row justify-between items-start gap-6">
          {waypoints.map((w, i) => {
            const kind = (w.kind ?? w.type ?? "goal") as string;
            const label = w.label ?? KIND_LABELS[kind] ?? kind;
            const confidence = w.confidence as string | undefined;
            const isExpanded = !interactive || expandedIndex === i;
            const descriptionText = w.description || (interactive ? "Establish more integrations or context inputs to update and verify this waypoint status." : undefined);

            return (
              <li
                key={i}
                className={`flex-1 min-w-[160px] flex flex-col items-center text-center relative group ${interactive ? "cursor-pointer select-none" : ""}`}
                onClick={() => {
                  if (interactive) {
                    setExpandedIndex(isExpanded ? null : i);
                  }
                }}
              >
                {/* Pin with Sonar ring */}
                <div className="relative mb-4 flex justify-center items-center h-8">
                  {kind === "constraint" && (
                    <div className="absolute h-[26px] w-[26px] pointer-events-none rounded-full border border-destructive/60 sonar-ring" />
                  )}
                  {kind === "move" && (
                    <div className="absolute h-[26px] w-[26px] pointer-events-none rounded-full border border-primary/60 sonar-ring" />
                  )}
                  <Pin kind={kind} confidence={confidence} />
                </div>

                <div className="flex flex-col items-center w-full px-2">
                  <div className="eyebrow text-muted-foreground group-hover:text-primary transition-colors text-[10px]">{label}</div>
                  <h3 className="mt-2 font-display text-base leading-snug text-foreground group-hover:text-primary/95 transition-colors line-clamp-3">
                    {w.title}
                  </h3>
                  
                  {descriptionText && isExpanded && (
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground page-fade max-w-[180px]">
                      {descriptionText}
                    </p>
                  )}

                  {/* Move recommendations */}
                  {kind === "move" && (
                    <div className="mt-3 space-y-2 w-full">
                      {w.metadata?.evidence && Array.isArray(w.metadata.evidence) && w.metadata.evidence.length > 0 && (
                        <div className="text-left bg-muted/20 p-2.5 rounded-lg border border-border/40 max-w-[180px] mx-auto">
                          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/75 mb-1">Evidence</div>
                          <ul className="space-y-1">
                            {w.metadata.evidence.map((ev: any, idx: number) => (
                              <li key={idx} className="font-mono text-[10px] text-muted-foreground leading-snug truncate">
                                — <strong>{ev.source}:</strong> {ev.detail}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Feedback actions */}
                  {onFeedback && kind === "constraint" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onFeedback(kind, "constraint_wrong", w.title);
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-2.5 py-0.5 font-mono text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors"
                    >
                      This isn't right
                    </button>
                  )}
                  {onFeedback && kind === "move" && (
                    <div className="mt-3 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onFeedback(kind, "move_done", w.title);
                        }}
                        className="inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 font-mono text-[10px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        Done
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onFeedback(kind, "move_skipped", w.title);
                        }}
                        className="font-mono text-[10px] text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors"
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

  // ── Vertical layout (default) ────────────────────────────────────────────
  return (
    <div className="relative pl-8">
      {/* Animated trail line */}
      <svg className="absolute left-[9px] top-3 bottom-3 w-[4px] h-[calc(100%-24px)] pointer-events-none" aria-hidden="true">
        <line x1="2" y1="0" x2="2" y2="100%" stroke="hsl(var(--primary) / 0.55)" strokeWidth="2.5" className="flow-line" />
      </svg>

      <ol className="space-y-10">
        {waypoints.map((w, i) => {
          const kind = (w.kind ?? w.type ?? "goal") as string;
          const label = w.label ?? KIND_LABELS[kind] ?? kind;
          const confidence = w.confidence as string | undefined;
          const isExpanded = !interactive || expandedIndex === i;
          const descriptionText = w.description || (interactive ? "Establish more integrations or context inputs to update and verify this waypoint status." : undefined);

          // Color-coded label per kind
          const labelColor =
            kind === "goal" ? "text-primary" :
            kind === "constraint" ? "text-destructive" :
            kind === "evidence" ? "text-[hsl(var(--source))]" :
            "text-foreground";

          // Evidence source badges — pull from metadata if available
          const sourceBadges: string[] = kind === "evidence" && w.metadata?.sources
            ? (Array.isArray(w.metadata.sources) ? w.metadata.sources : [])
            : [];

          return (
            <li
              key={i}
              id={`tour-wp-${kind}`}
              className={`relative waypoint-rise ${interactive ? "cursor-pointer group select-none" : ""}`}
              style={{ animationDelay: `${0.5 + i * 0.4}s` }}
              onClick={() => { if (interactive) setExpandedIndex(isExpanded ? null : i); }}
            >
              {/* Pin */}
              <div className="absolute -left-8 top-1">
                {kind === "constraint" && (
                  <div className="absolute left-[-2px] top-[-2px] h-[26px] w-[26px] pointer-events-none rounded-full border border-destructive/60 sonar-ring" />
                )}
                {kind === "move" && (
                  <div className="absolute left-[-2px] top-[-2px] h-[26px] w-[26px] pointer-events-none rounded-full border border-primary/60 sonar-ring" />
                )}
                <Pin kind={kind} confidence={confidence} />
              </div>

              {/* ── Constraint alert card ── */}
              {kind === "constraint" ? (
                <div className="rounded-[14px] border border-destructive/25 bg-destructive/5 px-5 py-4 transition-colors hover:bg-destructive/8">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`eyebrow ${labelColor}`}>{label}</span>
                    <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-destructive font-semibold">
                      Blocking
                    </span>
                  </div>
                  <h3 className="font-display text-2xl md:text-[26px] leading-snug text-foreground">
                    {w.title}
                  </h3>
                  {descriptionText && isExpanded && (
                    <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground page-fade">{descriptionText}</p>
                  )}
                  {onFeedback && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onFeedback(kind, "constraint_wrong", w.title); }}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 font-mono text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors"
                    >
                      This isn't right
                    </button>
                  )}
                </div>

              ) : kind === "move" ? (
                /* ── Move CTA card ── */
                <div className="rounded-[14px] border border-primary/20 bg-primary/5 px-5 py-4">
                  <div className={`eyebrow ${labelColor} mb-2`}>{label}</div>
                  <h3 className="font-display text-2xl md:text-[26px] leading-snug text-foreground">
                    {w.title}
                  </h3>
                  {descriptionText && isExpanded && (
                    <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground page-fade">{descriptionText}</p>
                  )}
                  {/* Evidence used */}
                  {w.metadata?.evidence && Array.isArray(w.metadata.evidence) && w.metadata.evidence.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">Evidence used</div>
                      <ul className="space-y-0.5">
                        {w.metadata.evidence.map((ev: any, idx: number) => (
                          <li key={idx} className="font-mono text-xs text-muted-foreground flex items-start gap-1">
                            <span className="text-muted-foreground/50 select-none">—</span>
                            <span><strong className="text-foreground/80 font-semibold">{ev.source}:</strong> {ev.detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {onFeedback && (
                    <div className="mt-5 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onFeedback(kind, "move_done", w.title); }}
                        className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 font-mono text-[12px] font-semibold text-background hover:bg-foreground/85 transition-colors shadow-sm"
                      >
                        Mark done →
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onFeedback(kind, "move_skipped", w.title); }}
                        className="font-mono text-xs text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors"
                      >
                        Skip
                      </button>
                    </div>
                  )}
                </div>

              ) : (
                /* ── Goal / Evidence standard row ── */
                <div className="max-w-2xl group-hover:opacity-90 transition-opacity">
                  <div className="flex items-center gap-2">
                    <span className={`eyebrow ${labelColor}`}>{label}</span>
                    {sourceBadges.length > 0 && sourceBadges.map((src) => (
                      <span key={src} className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground uppercase tracking-wide">
                        {src}
                      </span>
                    ))}
                  </div>
                  <h3 className="mt-2 font-display text-2xl md:text-[26px] leading-snug text-foreground">
                    {w.title}
                  </h3>
                  {descriptionText && isExpanded && (
                    <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground page-fade">{descriptionText}</p>
                  )}
                  {typeof w.lastUpdatedDays === "number" && w.lastUpdatedDays >= 7 && (
                    <p className="mt-2.5 font-mono text-[10px] text-muted-foreground/50 tracking-tight">
                      Last updated {w.lastUpdatedDays} days ago
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

