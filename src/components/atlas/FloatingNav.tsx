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
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 h-screen w-[72px] bg-card/50 backdrop-blur-md border-r border-border/60 z-50 flex flex-col items-center py-6 gap-8"
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center justify-center w-10 h-10 rounded-xl bg-foreground text-background shadow-md hover:scale-105 transition-transform outline-none">
            <AtlasIcon size={20} className="text-background" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" alignOffset={-10} sideOffset={14} className="w-56 bg-card/95 backdrop-blur-xl border-border/50 shadow-xl rounded-xl p-1">
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

      <div className="flex flex-col items-center gap-2 w-full mt-4">
        {Object.entries(ROUTES).map(([path, routeInfo]) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              title={routeInfo.label}
              className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 ease-out ${
                isActive 
                  ? "bg-foreground text-background shadow-md" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <routeInfo.icon className={`w-5 h-5 ${isActive ? "" : "opacity-80 group-hover:opacity-100 transition-opacity"}`} />
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
