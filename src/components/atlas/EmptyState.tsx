import { cn } from "@/lib/utils";
import { LogoMark } from "./Logo";
import { Plus } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({ title, description, actionLabel, onAction, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-12 text-center h-full min-h-[400px]", className)}>
      <div className="mb-6 opacity-40 grayscale-[50%]">
        <LogoMark width={64} height={64} />
      </div>
      <h3 className="text-[var(--pds-text-primary)] font-display text-lg mb-2">{title}</h3>
      <p className="text-[var(--pds-text-muted)] text-sm max-w-md mb-8">{description}</p>
      
      {actionLabel && onAction && (
        <button onClick={onAction} className="pds-btn-primary max-w-[200px]">
          <Plus className="w-4 h-4 mr-1" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}
