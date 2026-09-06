import { useEffect } from "react";
import { 
  CommandDialog, 
  CommandInput, 
  CommandList, 
  CommandEmpty, 
  CommandGroup, 
  CommandItem, 
  CommandSeparator 
} from "@/components/ui/command";
import { 
  TrendingUp, 
  Sparkles, 
  Send, 
  Users, 
  ExternalLink, 
  RotateCcw, 
  Network, 
  Shield, 
  Smartphone, 
  Zap 
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AtlasCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPrompt?: (prompt: string) => void;
  onResetWorkspace?: () => void;
}

export function AtlasCommandPalette({
  open,
  onOpenChange,
  onSelectPrompt,
  onResetWorkspace,
}: AtlasCommandPaletteProps) {
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const runCommand = (action: () => void) => {
    action();
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="bg-[var(--pds-surface-1)] text-[var(--pds-text-primary)] border border-[var(--pds-border-mid)] shadow-2xl rounded-2xl overflow-hidden backdrop-blur-2xl">
        <CommandInput 
          placeholder="Type an action, prompt, or navigate..." 
          className="text-[var(--pds-text-primary)] placeholder:text-[var(--pds-text-muted)] border-b border-[var(--pds-border-subtle)]"
        />
        <CommandList className="py-2 text-[var(--pds-text-secondary)] max-h-[380px]">
          <CommandEmpty className="py-8 text-center text-xs text-[var(--pds-text-muted)] font-mono">
            No matching commands found.
          </CommandEmpty>

          <CommandGroup heading="Starter Campaign Intents" className="text-[var(--pds-text-muted)] font-mono text-[10px] uppercase tracking-wider px-2">
            <CommandItem
              onSelect={() => runCommand(() => onSelectPrompt?.("Target high-growth AI startups for outbound client acquisition"))}
              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[var(--pds-surface-2)] rounded-xl text-xs text-[var(--pds-text-primary)] transition-colors"
            >
              <Zap className="h-3.5 w-3.5 text-emerald-500" />
              <span>Target high-growth AI startups for outbound acquisition</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => onSelectPrompt?.("Cold outreach to B2B design agency founders scaling past 10 employees"))}
              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[var(--pds-surface-2)] rounded-xl text-xs text-[var(--pds-text-primary)] transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Cold outreach to B2B design agency founders</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => onSelectPrompt?.("Find B2B SaaS teams hiring engineers on Hacker News"))}
              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[var(--pds-surface-2)] rounded-xl text-xs text-[var(--pds-text-primary)] transition-colors"
            >
              <Users className="h-3.5 w-3.5 text-sky-500" />
              <span>Find B2B SaaS teams hiring on Hacker News</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator className="bg-[var(--pds-border-subtle)] my-1" />

          <CommandGroup heading="Workspace Navigation" className="text-[var(--pds-text-muted)] font-mono text-[10px] uppercase tracking-wider px-2">
            <CommandItem
              onSelect={() => runCommand(() => navigate("/hq/engine"))}
              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[var(--pds-surface-2)] rounded-xl text-xs text-[var(--pds-text-primary)] transition-colors"
            >
              <TrendingUp className="h-3.5 w-3.5 text-[var(--pds-text-secondary)]" />
              <span>Revenue Engine Dashboard</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => onResetWorkspace?.())}
              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-rose-500/10 rounded-xl text-xs text-rose-500 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5 text-rose-500" />
              <span>Reset Current Workspace</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator className="bg-[var(--pds-border-subtle)] my-1" />

          <CommandGroup heading="Switch Pseudonyms Apps" className="text-[var(--pds-text-muted)] font-mono text-[10px] uppercase tracking-wider px-2">
            <CommandItem
              onSelect={() => runCommand(() => window.open("http://localhost:3000", "_blank"))}
              className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[var(--pds-surface-2)] rounded-xl text-xs text-[var(--pds-text-primary)] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Network className="h-3.5 w-3.5 text-[var(--pds-text-secondary)]" />
                <span>Metaphor OS</span>
              </div>
              <ExternalLink className="h-3 w-3 text-[var(--pds-text-muted)]" />
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => window.open("http://localhost:49843", "_blank"))}
              className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[var(--pds-surface-2)] rounded-xl text-xs text-[var(--pds-text-primary)] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="h-3.5 w-3.5 text-[var(--pds-text-secondary)]" />
                <span>Clario Video Studio</span>
              </div>
              <ExternalLink className="h-3 w-3 text-[var(--pds-text-muted)]" />
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => window.open("http://localhost:3005", "_blank"))}
              className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[var(--pds-surface-2)] rounded-xl text-xs text-[var(--pds-text-primary)] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Shield className="h-3.5 w-3.5 text-[var(--pds-text-secondary)]" />
                <span>Pseudonyms Master ID</span>
              </div>
              <ExternalLink className="h-3 w-3 text-[var(--pds-text-muted)]" />
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </div>
    </CommandDialog>
  );
}
