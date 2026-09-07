import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate, Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Command } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { NewLeadModal } from "@/components/atlas/NewLeadModal";
import { FloatingNav } from "@/components/atlas/FloatingNav";



// ── Inlined: CommandPalette ───────────────────────────────────────────────────
type CmdAction = { id: string; label: string; description?: string; accent?: string; shortcut?: string; action: () => void; };
type CmdGroup = { id: string; label: string; accent?: string; commands: CmdAction[]; };

function CommandPalette({ currentApp: _, extraCommands = [] }: { currentApp?: string; extraCommands?: CmdGroup[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const allCmds: CmdAction[] = [
    ...extraCommands.flatMap(g => g.commands),
  ];

  const filtered = query
    ? allCmds.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        (c.description || "").toLowerCase().includes(query.toLowerCase())
      )
    : allCmds;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen(o => !o); }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
        setOpen(false);
        setQuery("");
      }
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[18vh] bg-foreground/20 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="pds-animate-enter w-full max-w-[560px] bg-background border border-border/60 shadow-xl rounded-xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/60">
          <Command className="w-3.5 h-3.5 text-[var(--pds-text-muted)] shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands…"
            className="flex-1 bg-transparent border-none outline-none text-[13px] text-[var(--pds-text-primary)] font-sans placeholder:text-[var(--pds-text-muted)]"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-[var(--pds-surface-2)] border border-[var(--pds-border-subtle)] rounded text-[var(--pds-text-muted)]">ESC</kbd>
        </div>
        <div className="max-h-[360px] overflow-y-auto p-1.5">
          {filtered.length === 0 && (
            <p className="px-4 py-8 text-[12px] text-center text-[var(--pds-text-muted)]">No results</p>
          )}
          {filtered.map((cmd, idx) => (
            <button
              key={cmd.id}
              onClick={() => { cmd.action(); setOpen(false); setQuery(""); }}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg text-left cursor-pointer transition-colors ${
                selectedIndex === idx ? "bg-[var(--pds-surface-2)] text-[var(--pds-text-primary)]" : "hover:bg-[var(--pds-surface-2)]/50 text-[var(--pds-text-primary)]"
              }`}
            >
              <div>
                <span className="block text-[13px] font-medium text-[var(--pds-text-primary)]">{cmd.label}</span>
                {cmd.description && <span className="text-[11px] text-[var(--pds-text-muted)]">{cmd.description}</span>}
              </div>
              {cmd.shortcut && <kbd className="text-[10px] font-mono text-[var(--pds-text-muted)]">{cmd.shortcut.replace('O', 'O')}</kbd>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}



export default function HqShell() {
  const { user, loading, signOut } = useAuth();
  const { theme, cycleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [newLeadOpen, setNewLeadOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user && location.pathname.startsWith("/hq")) navigate("/auth");
  }, [user, loading, navigate, location.pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "n" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setNewLeadOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ⌘K handled by <CommandPalette /> mounted in JSX

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="pds-animate-enter flex flex-col items-center gap-3">
          <span className="text-[11px] text-muted-foreground font-mono tracking-widest uppercase">Initializing…</span>
        </div>
      </div>
    );
  }

  if (!loading && !user && location.pathname.startsWith("/hq")) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen atlas-grid-bg text-foreground flex flex-col overflow-x-hidden relative">
      {/* ── Fixed Ambient Radiant Light Mesh ── */}
      <div className="fixed inset-0 atlas-light-mesh pointer-events-none z-0" />

      {/* ── Floating Navigation (separate elements, not a header) ─── */}
      <FloatingNav onNewLead={() => setNewLeadOpen(true)} />

      {/* ── Main Full-Width Process Workspace ───────────────────────────────── */}
      <main className="flex-1 min-w-0 w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="w-full h-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Command Palette (⌘K) — shared from @pseudonyms/ui ──────────────── */}
      <CommandPalette
        currentApp="atlas"
        extraCommands={[
          {
            id: "atlas-actions",
            label: "Atlas",
            accent: "currentColor",
            commands: [
              { id: "newlead",  label: "New Lead",       description: "Add to pipeline",       accent: "currentColor", shortcut: "⌘N", action: () => setNewLeadOpen(true) },
              { id: "engine",   label: "Revenue Engine", description: "Run today's prospects", accent: "currentColor", action: () => navigate("/hq/engine") },
              { id: "briefing", label: "Daily Briefing", description: "Review today's top 3 qualified opportunities", shortcut: "G B", action: () => navigate("/briefing") },
              { id: "objectives",label: "Define Hunt",   description: "Declare commercial intent & lock search thesis", shortcut: "G O", action: () => navigate("/objectives") },
              { id: "settings", label: "Settings & Keys",description: "Account, database, and system status", action: () => navigate("/hq/settings") },
              { id: "theme",    label: "Toggle Theme",   description: "Switch light / dark mode",                  action: () => cycleTheme() },
              { id: "signout",  label: "Sign Out",       description: "End session and lock workspace",            action: () => signOut().then(() => navigate("/auth")) },
            ],
          },
        ]}
      />

      {/* ── New Lead Modal ──────────────────────────────────────────────────── */}
      <NewLeadModal open={newLeadOpen} onClose={() => setNewLeadOpen(false)} />
    </div>
  );
}
