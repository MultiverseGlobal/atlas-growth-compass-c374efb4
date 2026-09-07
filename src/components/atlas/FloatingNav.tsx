import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import {
  Sun, Moon, Plus, Command, ExternalLink,
  Radar, Crosshair, Cpu, SlidersHorizontal, User,
  Globe
} from "lucide-react";
import { AtlasIcon } from "@/components/atlas/EcosystemIcons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROUTES: Record<string, { label: string; icon: React.ElementType }> = {
  "/":            { label: "Command",         icon: Command },
  "/briefing":    { label: "Daily Briefing",  icon: Radar },
  "/objectives":  { label: "Define Hunt",     icon: Crosshair },
  "/hq/engine":   { label: "Revenue Engine",  icon: Cpu },
  "/hq/settings": { label: "Settings",        icon: SlidersHorizontal },
};

interface FloatingNavProps {
  onNewLead: () => void;
}

export function FloatingNav({ onNewLead }: FloatingNavProps) {
  const { user, signOut } = useAuth();
  const { theme, cycleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 w-full h-16 bg-card/60 backdrop-blur-xl border-b border-border/60 flex items-center justify-between px-4 md:px-8">
      
      {/* ── Left: Brand & Dropdown ── */}
      <div className="flex items-center gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2.5 outline-none group">
            <div className="h-8 w-8 rounded-lg bg-foreground text-background flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
              <AtlasIcon size={18} className="text-background" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-bold text-xs tracking-tight text-foreground group-hover:text-primary transition-colors">
                ATLAS
              </span>
              <span className="text-[9px] text-muted-foreground font-mono">
                Sovereign Strategist
              </span>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom" alignOffset={-10} sideOffset={14} className="w-56 bg-card/95 backdrop-blur-xl border-border/50 shadow-xl rounded-xl p-1">
          <DropdownMenuItem onClick={onNewLead} className="gap-2 text-[12px] cursor-pointer focus:bg-foreground focus:text-background rounded-lg">
            <Plus className="w-4 h-4" />
            <span className="font-medium">New Lead</span>
            <span className="ml-auto text-[10px] font-mono opacity-60">⌘N</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={() => {
              const e = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
              document.dispatchEvent(e);
            }}
            className="gap-2 text-[12px] cursor-pointer focus:bg-foreground focus:text-background rounded-lg"
          >
            <Command className="w-4 h-4" />
            <span className="font-medium">Command Palette</span>
            <span className="ml-auto text-[10px] font-mono opacity-60">⌘K</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={cycleTheme} className="gap-2 text-[12px] cursor-pointer focus:bg-foreground focus:text-background rounded-lg">
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span className="font-medium">Toggle Theme</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator className="bg-border/50 my-1" />
          <div className="px-3 py-1.5 text-[10px] font-mono text-muted-foreground uppercase tracking-widest font-bold">Ecosystem</div>
          <DropdownMenuItem asChild>
            <a href="https://pseudonyms.vercel.app" target="_blank" rel="noreferrer" className="gap-2 text-[12px] cursor-pointer hover:bg-muted/80 rounded-lg">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <span className="font-medium">Pseudonyms ID</span>
              <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-50" />
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="https://orion-intel.vercel.app" target="_blank" rel="noreferrer" className="gap-2 text-[12px] cursor-pointer hover:bg-muted/80 rounded-lg">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="font-medium">Orion</span>
              <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-50" />
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="https://clario-docs.vercel.app" target="_blank" rel="noreferrer" className="gap-2 text-[12px] cursor-pointer hover:bg-muted/80 rounded-lg">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              <span className="font-medium">Clario</span>
              <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-50" />
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="https://metaphor-ai.vercel.app" target="_blank" rel="noreferrer" className="gap-2 text-[12px] cursor-pointer hover:bg-muted/80 rounded-lg">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
              <span className="font-medium">Metaphor</span>
              <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-50" />
            </a>
          </DropdownMenuItem>
          
          {user && (
            <>
              <DropdownMenuSeparator className="bg-border/50 my-1" />
              <DropdownMenuItem 
                onClick={() => signOut().then(() => navigate("/auth"))}
                className="gap-2 text-[12px] focus:bg-foreground focus:text-background cursor-pointer rounded-lg"
              >
                <User className="w-4 h-4" />
                <span className="font-medium">Sign out</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      </div>

      {/* ── Center: Navigation ── */}
      <nav className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-1 p-1 rounded-xl bg-surface-2 border border-border backdrop-blur-md shadow-inner">
        {Object.entries(ROUTES).map(([path, routeInfo]) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              title={routeInfo.label}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                isActive
                  ? "bg-foreground text-background shadow-md shadow-primary/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/80"
              }`}
            >
              <routeInfo.icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "" : "opacity-50"}`} />
              <span className="hidden lg:inline">{routeInfo.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Right: User Actions ── */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          onClick={cycleTheme}
          className="h-8 w-8 rounded-lg bg-card/50 hover:bg-card border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>
        {user && (
          <button
            onClick={() => signOut().then(() => navigate("/auth"))}
            className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center text-primary hover:bg-primary/20 transition-all"
            title="Sign out"
          >
            <User className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

    </header>
  );
}
