/** A tiny static pin + dotted trail motif for empty states. */
export function EmptyTrail({ label = "Nothing here yet — draw your first map." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <svg width="26" height="70" viewBox="0 0 26 70" aria-hidden="true">
        <circle cx="13" cy="10" r="8" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="1.75" />
        <circle cx="13" cy="10" r="4.5" fill="hsl(var(--primary))" />
        <line
          x1="13" y1="20" x2="13" y2="66"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeDasharray="2 6"
          strokeLinecap="round"
        />
      </svg>
      <p className="mt-4 max-w-xs text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
