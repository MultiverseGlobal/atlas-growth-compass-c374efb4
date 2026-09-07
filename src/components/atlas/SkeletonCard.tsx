import { cn } from "@/lib/utils";

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "atlas-glass-card rounded-2xl p-6 h-64 flex flex-col justify-between overflow-hidden relative",
        className
      )}
    >
      <div className="absolute inset-0 skeleton-shimmer opacity-50" />
      <div className="relative z-10 w-1/3 h-5 rounded-md bg-[var(--pds-surface-3)] border border-[var(--pds-border-subtle)]" />
      <div className="relative z-10 space-y-3">
        <div className="w-full h-4 rounded-md bg-[var(--pds-surface-3)] border border-[var(--pds-border-subtle)]" />
        <div className="w-4/5 h-4 rounded-md bg-[var(--pds-surface-3)] border border-[var(--pds-border-subtle)]" />
        <div className="w-2/3 h-4 rounded-md bg-[var(--pds-surface-3)] border border-[var(--pds-border-subtle)]" />
      </div>
    </div>
  );
}
