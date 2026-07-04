import type { Waypoint } from "@/lib/starterMap";

interface TrailProps {
  waypoints: Waypoint[];
}

// Pin visual varies by waypoint type + confidence tier.
// goal = gold filled ; constraint = brick outline ; evidence = sage outline ; move = ink filled.
function Pin({ w }: { w: Waypoint }) {
  const stroke =
    w.type === "goal"
      ? "hsl(var(--primary))"
      : w.type === "constraint"
      ? "hsl(var(--destructive))"
      : w.type === "evidence"
      ? "hsl(var(--source))"
      : "hsl(var(--foreground))";

  // Confidence -> fill amount for the inner disc.
  // emerging = hollow outline only, building = half-filled, established = solid.
  const innerFill =
    w.confidence === "established"
      ? stroke
      : w.confidence === "building"
      ? `url(#half-${w.type})`
      : "transparent";

  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id={`half-${w.type}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="50%" stopColor={stroke} />
          <stop offset="50%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <circle cx="11" cy="11" r="8" fill="hsl(var(--background))" stroke={stroke} strokeWidth="1.75" />
      <circle cx="11" cy="11" r="4.5" fill={innerFill} />
    </svg>
  );
}

export function Trail({ waypoints }: TrailProps) {
  return (
    <div className="relative pl-8">
      {/* The route — dotted gold vertical line down the left */}
      <div
        aria-hidden
        className="trail-line trail-draw absolute left-[10px] top-2 bottom-2"
      />

      <ol className="space-y-10">
        {waypoints.map((w, i) => (
          <li
            key={i}
            className="relative waypoint-rise"
            style={{ animationDelay: `${0.5 + i * 0.4}s` }}
          >
            {/* Pin sits on top of the route */}
            <div className="absolute -left-8 top-0.5">
              <Pin w={w} />
            </div>

            <div className="max-w-2xl">
              <div className="eyebrow text-muted-foreground">{w.label}</div>
              <h3 className="mt-2 font-display text-2xl md:text-[26px] leading-snug text-foreground">
                {w.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                {w.description}
              </p>
              {typeof w.lastUpdatedDays === "number" && w.lastUpdatedDays >= 7 && (
                <p className="mt-3 font-mono text-xs text-muted-foreground">
                  Last updated {w.lastUpdatedDays} days ago
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
