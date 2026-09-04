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
      <div className="bg-[#0e1018] text-white border border-white/10 pds-glass-elevated">
        <CommandInput 
          placeholder="Type an action, prompt, or navigate..." 
          className="text-white placeholder:text-white/30"
        />
        <CommandList className="py-2 text-white/80">
          <CommandEmpty className="py-6 text-center text-xs text-white/40 font-mono">
            No matching commands found.
          </CommandEmpty>

          <CommandGroup heading="Starter Campaign Intents" className="text-white/40 font-mono text-[11px] uppercase">
            <CommandItem
              onSelect={() => runCommand(() => onSelectPrompt?.("Target high-growth AI startups for outbound client acquisition"))}
              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-white/10 rounded-lg text-sm text-white"
            >
              <Zap className="h-4 w-4 text-accent" />
              <span>Target high-growth AI startups for outbound acquisition</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => onSelectPrompt?.("Cold outreach to B2B design agency founders scaling past 10 employees"))}
              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-white/10 rounded-lg text-sm text-white"
            >
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <span>Cold outreach to B2B design agency founders</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => onSelectPrompt?.("Find B2B SaaS teams hiring engineers on Hacker News"))}
              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-white/10 rounded-lg text-sm text-white"
            >
              <Users className="h-4 w-4 text-sky-400" />
              <span>Find B2B SaaS teams hiring on Hacker News</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator className="bg-white/10 my-1" />

          <CommandGroup heading="Workspace Navigation" className="text-white/40 font-mono text-[11px] uppercase">
            <CommandItem
              onSelect={() => runCommand(() => navigate("/hq/engine"))}
              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-white/10 rounded-lg text-sm text-white"
            >
              <TrendingUp className="h-4 w-4 text-white/60" />
              <span>Revenue Engine Dashboard</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => onResetWorkspace?.())}
              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-white/10 rounded-lg text-sm text-rose-400"
            >
              <RotateCcw className="h-4 w-4 text-rose-400" />
              <span>Reset Current Workspace</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator className="bg-white/10 my-1" />

          <CommandGroup heading="Switch Pseudonyms Apps" className="text-white/40 font-mono text-[11px] uppercase">
            <CommandItem
              onSelect={() => runCommand(() => window.open("http://localhost:3000", "_blank"))}
              className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-white/10 rounded-lg text-sm text-white"
            >
              <div className="flex items-center gap-2.5">
                <Network className="h-4 w-4 text-[#8b5cf6]" />
                <span>Metaphor OS</span>
              </div>
              <ExternalLink className="h-3 w-3 text-white/40" />
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => window.open("http://localhost:49843", "_blank"))}
              className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-white/10 rounded-lg text-sm text-white"
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="h-4 w-4 text-[#ec4899]" />
                <span>Clario Video Studio</span>
              </div>
              <ExternalLink className="h-3 w-3 text-white/40" />
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => window.open("http://localhost:3005", "_blank"))}
              className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-white/10 rounded-lg text-sm text-white"
            >
              <div className="flex items-center gap-2.5">
                <Shield className="h-4 w-4 text-[#8b5cf6]" />
                <span>Pseudonyms Master ID</span>
              </div>
              <ExternalLink className="h-3 w-3 text-white/40" />
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </div>
    </CommandDialog>
  );
}
