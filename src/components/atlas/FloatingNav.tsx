import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import {
  Sun, Moon, Plus, Command,
  Radar, Crosshair, Gauge, SlidersHorizontal, Zap, User
} from "lucide-react";
import { AtlasIcon } from "@/components/atlas/EcosystemIcons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ── Route metadata ────────────────────────────────────────────────────────────
const ROUTES: Record<string, { label: string; icon: React.ElementType }> = {
  "/":            { label: "Command",         icon: Zap },
  "/briefing":    { label: "Briefing",        icon: Radar },
  "/objectives":  { label: "Hunt",            icon: Crosshair },
  "/hq/engine":   { label: "Engine",          icon: Gauge },
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

  const route = ROUTES[location.pathname];

  return (
    <>
      {/* ── Brand Mark — top left ───────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-5 left-5 z-50"
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-card/80 border border-border/50 shadow-sm backdrop-blur-md hover:bg-card transition-colors outline-none data-[state=open]:bg-card"
            >
              {/* Atlas Icon */}
              <AtlasIcon size={16} className="text-foreground" />
              <span className="text-[11px] font-semibold text-muted-foreground hidden sm:block">
                Atlas
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48 bg-card/95 backdrop-blur-xl border-border/50 shadow-xl rounded-xl p-1">
            <DropdownMenuItem onClick={onNewLead} className="gap-2 text-[12px] cursor-pointer focus:bg-foreground focus:text-background rounded-lg">
              <Plus className="w-3.5 h-3.5" />
              <span>New Lead</span>
              <span className="ml-auto text-[10px] font-mono opacity-60">⌘N</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              onClick={() => {
                const e = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
                document.dispatchEvent(e);
              }}
              className="gap-2 text-[12px] cursor-pointer focus:bg-foreground focus:text-background rounded-lg"
            >
              <Command className="w-3.5 h-3.5" />
              <span>Command Palette</span>
              <span className="ml-auto text-[10px] font-mono opacity-60">⌘K</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={cycleTheme} className="gap-2 text-[12px] cursor-pointer focus:bg-foreground focus:text-background rounded-lg">
              {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span>Toggle Theme</span>
            </DropdownMenuItem>
            
            {user && (
              <>
                <DropdownMenuSeparator className="bg-border/50 my-1" />
                <DropdownMenuItem 
                  onClick={() => signOut().then(() => navigate("/auth"))}
                  className="gap-2 text-[12px] focus:bg-foreground focus:text-background cursor-pointer rounded-lg"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.div>

      {/* ── Main Navigation Dock — top center ────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-5 right-5 z-50"
      >
        <div className="flex items-center p-1 rounded-2xl bg-card/80 border border-border/50 shadow-sm backdrop-blur-md">
          {Object.entries(ROUTES).map(([path, routeInfo]) => {
            const isActive = path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                title={routeInfo.label}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-300 ease-out ${
                  isActive 
                    ? "bg-foreground text-background shadow-sm" 
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                <routeInfo.icon className={`w-3.5 h-3.5 ${isActive ? "" : "opacity-70 group-hover:opacity-100 transition-opacity"}`} />
                <span className={`text-[11px] font-semibold font-mono tracking-wide whitespace-nowrap overflow-hidden transition-all duration-300 ease-out ${
                  isActive ? "max-w-24 opacity-100" : "max-w-0 opacity-0 group-hover:max-w-24 group-hover:opacity-100 group-hover:ml-2"
                }`}>
                  {routeInfo.label}
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>


    </>
  );
}
