import { useState, useEffect, useCallback } from "react";
import { NavLink, Outlet, useLocation, useNavigate, Navigate } from "react-router-dom";
import { 
  Target, Search, MessageSquare, BarChart2,
  Database, Zap, User as UserIcon, LogOut, Moon, Sun, ChevronRight, Command
} from "lucide-react";
import { LogoMark } from "@/components/atlas/Logo";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/hooks/useTheme";
import { AtlasChat } from "@/components/atlas/ChatDrawer";
import { TheVaultDrawer } from "@/components/atlas/TheVaultDrawer";
import { EcosystemSwitcher } from "@/components/atlas/EcosystemSwitcher";
import { toast } from "sonner";

// ── Inlined: useCrossAppBus ───────────────────────────────────────────────────
// Lightweight Supabase Realtime cross-app event bus (replaces @pseudonyms/ui dep)
function useCrossAppBus(_client: typeof supabase, _userId: string | null) {
  const handlers = new Map<string, ((payload: any) => void)[]>();

  const useEvent = (eventType: string, handler: (payload: any) => void) => {
    useEffect(() => {
      if (!_userId) return;
      const channel = _client
        .channel(`cross-app-bus:${_userId}`)
        .on(
          "broadcast" as any,
          { event: eventType },
          ({ payload }: { payload: any }) => handler(payload)
        )
        .subscribe();
      return () => { _client.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [_userId, eventType]);
  };

  return { useEvent };
}

// ── Inlined: CommandPalette ───────────────────────────────────────────────────
type CmdAction = { id: string; label: string; description?: string; accent?: string; shortcut?: string; action: () => void; };
type CmdGroup = { id: string; label: string; accent?: string; commands: CmdAction[]; };

function CommandPalette({ currentApp: _, extraCommands = [] }: { currentApp?: string; extraCommands?: CmdGroup[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const NAV_CMDS: CmdAction[] = [
    { id: "go-flow",     label: "Daily OS",      description: "Run today's 20 prospects",  action: () => navigate("/hq/flow") },
    { id: "go-recon",   label: "Scout",          description: "Company research",           action: () => navigate("/hq/recon") },
    { id: "go-leads",   label: "Leads",          description: "Full pipeline view",         action: () => navigate("/hq/leads") },
    { id: "go-pipeline",label: "Pipeline",       description: "Deal Kanban",               action: () => navigate("/hq/pipeline") },
    { id: "go-settings",label: "Settings",       description: "Account & integrations",    action: () => navigate("/hq/settings") },
  ];

  const allCmds: CmdAction[] = [
    ...NAV_CMDS,
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[18vh]"
      style={{ background: "rgba(7,8,12,0.55)", backdropFilter: "blur(12px)" }}
      onClick={() => setOpen(false)}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="pds-animate-enter w-full max-w-[560px] pds-card overflow-hidden"
      >
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--pds-border-subtle)]">
          <Command className="w-3.5 h-3.5 text-[var(--pds-text-muted)] shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search commands…"
            className="flex-1 bg-transparent border-none outline-none text-[13px] text-[var(--pds-text-primary)] font-sans placeholder:text-[var(--pds-text-muted)]"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-[var(--pds-surface-2)] border border-[var(--pds-border-subtle)] rounded text-[var(--pds-text-muted)]">ESC</kbd>
        </div>
        <div className="max-h-[360px] overflow-y-auto p-1.5">
          {filtered.length === 0 && (
            <p className="px-4 py-8 text-[12px] text-center text-[var(--pds-text-muted)]">No results</p>
          )}
          {filtered.map(cmd => (
            <button
              key={cmd.id}
              onClick={() => { cmd.action(); setOpen(false); setQuery(""); }}
              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg text-left cursor-pointer transition-colors hover:bg-[var(--pds-surface-2)]"
            >
              <div>
                <span className="block text-[13px] font-medium text-[var(--pds-text-primary)]">{cmd.label}</span>
                {cmd.description && <span className="text-[11px] text-[var(--pds-text-muted)]">{cmd.description}</span>}
              </div>
              {cmd.shortcut && <kbd className="text-[10px] font-mono text-[var(--pds-text-muted)]">{cmd.shortcut}</kbd>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Single Pane Pipeline ──────────────────────────────────────────
const SEQUENTIAL_STEPS = [
  { step: "01", to: "/hq/engine", label: "Revenue Engine", icon: Target, desc: "Execute SOP" },
];

export default function HqShell() {
  const { user, loading, signOut } = useAuth();
  const { theme, cycleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<{ display_name: string | null; handle: string | null } | null>(null);

  const [vaultOpen, setVaultOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles")
      .select("display_name, handle")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProfile(data);
      });
  }, [user]);

  // ── Cross-App Event Bus (Phase 6) ──────────────────────────────────────────
  const { useEvent } = useCrossAppBus(supabase, user?.id || null);

  useEvent("clario:job_complete", (payload: any) => {
    toast.success(`Video analysis complete in Clario!`, {
      description: `Project ID: ${payload.projectId}`,
      icon: <Target className="w-4 h-4 text-[#ec4899]" />,
    });
  });

  useEvent("orion:voice_captured", (payload: any) => {
    toast(`Orion just added a new lead from your voice note.`, {
      description: "Pipeline updated.",
      icon: <Zap className="w-4 h-4 text-primary" />,
    });
  });

  // ⌘K now handled by <CommandPalette /> mounted in JSX — removes duplicate handler


  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="pds-animate-enter flex flex-col items-center gap-3">
          <LogoMark size={28} className="text-[var(--pds-text-muted)]" />
          <span className="text-[11px] text-[var(--pds-text-muted)] font-mono tracking-widest uppercase">Initializing…</span>
        </div>
      </div>
    );
  }

  if (!loading && !user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-x-hidden">
      {/* ── Top Sovereign Process Header ──────────────────────────────────────── */}
      <header className="nav-glass sticky top-0 z-40 w-full h-14 px-4 md:px-6 flex items-center justify-between gap-4">

        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3 shrink-0">
          <NavLink to="/hq/flow" className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-[var(--pds-surface-2)] border border-[var(--pds-border-mid)] flex items-center justify-center">
              <LogoMark size={16} className="text-[var(--pds-text-primary)]" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-[11px] tracking-[0.12em] uppercase text-[var(--pds-text-primary)] font-display">
                ATLAS
              </span>
              <span className="text-[9px] text-[var(--pds-text-muted)] font-mono">
                Sovereign Strategist
              </span>
            </div>
          </NavLink>
        </div>

        {/* Center: The Revenue Engine Label */}
        <nav className="hidden lg:flex items-center gap-0.5">
          <div className="flex items-center">
            <div className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors bg-[var(--pds-accent-dim)] text-[var(--pds-text-primary)] border border-[var(--pds-border-mid)]">
              <Target className="h-3 w-3 shrink-0" />
              <span>Revenue Engine</span>
            </div>
          </div>
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* The Vault Button */}
          <button
            onClick={() => setVaultOpen(true)}
            className="pds-btn-ghost"
            title="Open strategic maps, leads archive, integrations and settings (Cmd+K)"
          >
            <Database className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">The Vault</span>
            <kbd className="hidden md:inline text-[9px] font-mono px-1 py-0.5 bg-[var(--pds-surface-3)] border border-[var(--pds-border-subtle)] rounded text-[var(--pds-text-muted)]">⌘K</kbd>
          </button>

          {/* Ask Atlas AI */}
          <button
            onClick={() => setChatOpen(true)}
            className="pds-btn-ghost"
          >
            <Zap className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ask Atlas</span>
          </button>

          {/* Theme Toggle (Default to Light Mode) */}
          <button
            onClick={() => cycleTheme()}
            className="h-8 w-8 rounded-lg bg-[var(--pds-surface-2)] hover:bg-[var(--pds-surface-3)] border border-[var(--pds-border-subtle)] flex items-center justify-center text-[var(--pds-text-muted)] hover:text-[var(--pds-text-primary)] transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>

          {/* Ecosystem Switcher */}
          <EcosystemSwitcher />

          {/* User / Sign-out */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-[var(--pds-border-subtle)]">
            <button
              onClick={() => navigate("/hq/settings")}
              className="h-7 w-7 rounded-full bg-[var(--pds-surface-2)] border border-[var(--pds-border-mid)] flex items-center justify-center text-[var(--pds-text-secondary)] hover:text-[var(--pds-text-primary)] hover:bg-[var(--pds-surface-3)] transition-colors"
              title={user.user_metadata?.username || profile?.display_name || user.email || "Profile"}
            >
              <UserIcon className="h-3 w-3" />
            </button>
            <button
              onClick={() => signOut().then(() => navigate("/"))}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-[var(--pds-text-muted)] hover:text-[var(--pds-text-primary)] transition-colors"
              title="Sign out"
            >
              <LogOut className="h-3 w-3" />
            </button>
          </div>
        </div>
      </header>

      {/* Removed Mobile Nav */}

      {/* ── Main Full-Width Process Workspace ───────────────────────────────── */}
      <main className="flex-1 min-w-0 w-full">
        <Outlet />
      </main>

      {/* ── The Vault Modal / Drawer ────────────────────────────────────────── */}
      <TheVaultDrawer
        open={vaultOpen}
        onClose={() => setVaultOpen(false)}
        onOpenChat={() => setChatOpen(true)}
      />

      {/* ── Atlas AI Chat Drawer ────────────────────────────────────────────── */}
      <AtlasChat open={chatOpen} onClose={() => setChatOpen(false)} />

      {/* ── Command Palette (⌘K) — shared from @pseudonyms/ui ──────────────── */}
      <CommandPalette
        currentApp="atlas"
        extraCommands={[
          {
            id: "atlas-actions",
            label: "Atlas",
            accent: "#10b981",
            commands: [
              { id: "today",    label: "Revenue Engine", description: "Run today\'s prospects", accent: "#10b981", action: () => { window.location.hash = "/hq/engine"; } },
              { id: "newlead",  label: "New Lead",       description: "Add to pipeline",          accent: "#10b981", shortcut: "⌘N", action: () => {} },
            ],
          },
        ]}
      />
    </div>
  );
}
