import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import {
  Sun, Moon, Plus, Command,
  LayoutDashboard, Target, Layers, Settings, Terminal
} from "lucide-react";
import { AtlasIcon } from "@/components/atlas/EcosystemIcons";

// ── Route metadata ────────────────────────────────────────────────────────────
const ROUTES: Record<string, { label: string; icon: React.ElementType }> = {
  "/":            { label: "Command",         icon: Terminal },
  "/briefing":    { label: "Daily Briefing",  icon: LayoutDashboard },
  "/objectives":  { label: "Define Hunt",     icon: Target },
  "/hq/engine":   { label: "Revenue Engine",  icon: Layers },
  "/hq/settings": { label: "Settings",        icon: Settings },
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
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-card/80 border border-border/50 shadow-sm backdrop-blur-md hover:bg-card transition-colors"
        >
          {/* Atlas Icon */}
          <AtlasIcon size={16} className="text-foreground" />
          <span className="text-[11px] font-semibold text-muted-foreground hidden sm:block">
            Atlas
          </span>
        </button>
      </motion.div>

      {/* ── Current route indicator — top center ────────────────────── */}
      {route && (
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-5 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card/80 border border-border/50 shadow-sm backdrop-blur-md">
            <route.icon className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-foreground font-mono tracking-wide">
              {route.label}
            </span>
          </div>
        </motion.div>
      )}

      {/* ── User actions — top right ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-5 right-5 z-50 flex items-center gap-2"
      >
        {/* New lead */}
        <button
          onClick={onNewLead}
          title="New Lead (⌘N)"
          className="h-8 w-8 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        {/* Command palette hint */}
        <button
          onClick={() => {
            const e = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
            document.dispatchEvent(e);
          }}
          title="Command Palette (⌘K)"
          className="h-8 px-2.5 rounded-xl bg-card/80 hover:bg-card border border-border/50 shadow-sm backdrop-blur-md flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Command className="w-3 h-3" />
          <span className="text-[10px] font-mono hidden sm:block">K</span>
        </button>

        {/* Theme toggle */}
        <button
          onClick={cycleTheme}
          title="Toggle theme"
          className="h-8 w-8 rounded-xl bg-card/80 hover:bg-card border border-border/50 shadow-sm backdrop-blur-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          {theme === "dark"
            ? <Sun className="w-3.5 h-3.5" />
            : <Moon className="w-3.5 h-3.5" />}
        </button>

        {/* User avatar / sign out */}
        {user && (
          <button
            onClick={() => signOut().then(() => navigate("/auth"))}
            title={user.email ?? "Sign out"}
            className="h-8 w-8 rounded-xl bg-card/80 hover:bg-card border border-border/50 shadow-sm backdrop-blur-md flex items-center justify-center font-semibold text-[11px] text-foreground transition-colors"
          >
            {(user.email?.[0] ?? "U").toUpperCase()}
          </button>
        )}
      </motion.div>
    </>
  );
}
