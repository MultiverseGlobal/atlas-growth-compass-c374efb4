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
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "18vh" }}
      onClick={() => setOpen(false)}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 560, background: "var(--background, #0A0B0F)", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "0 24px 60px rgba(0,0,0,0.5)", overflow: "hidden" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <Command style={{ width: 14, height: 14, opacity: 0.4, flexShrink: 0 }} />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search commands…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "var(--foreground)", fontFamily: "inherit" }}
          />
          <kbd style={{ fontSize: 10, opacity: 0.4, fontFamily: "monospace" }}>ESC</kbd>
        </div>
        <div style={{ maxHeight: 360, overflowY: "auto", padding: "6px 0" }}>
          {filtered.length === 0 && (
            <p style={{ padding: "12px 16px", fontSize: 12, opacity: 0.4, margin: 0 }}>No results</p>
          )}
          {filtered.map(cmd => (
            <button
              key={cmd.id}
              onClick={() => { cmd.action(); setOpen(false); setQuery(""); }}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 16px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", transition: "background 100ms" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <div>
                <span style={{ fontSize: 13, color: "var(--foreground)", fontWeight: 500 }}>{cmd.label}</span>
                {cmd.description && <span style={{ fontSize: 11, opacity: 0.5, marginLeft: 8 }}>{cmd.description}</span>}
              </div>
              {cmd.shortcut && <kbd style={{ fontSize: 10, opacity: 0.4, fontFamily: "monospace" }}>{cmd.shortcut}</kbd>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 4-Step Daily Acquisition Workflow ──────────────────────────────────────────
const SEQUENTIAL_STEPS = [
  { step: "01", to: "/hq/flow",     label: "Today",    icon: Target,         desc: "Daily acquisition engine — run 20 prospects", badge: null },
  { step: "02", to: "/hq/recon",    label: "Scout",    icon: Search,         desc: "Research a company — AI pain signal extraction", badge: null },
  { step: "03", to: "/hq/outreach", label: "Outreach",  icon: MessageSquare,  desc: "Active sequences — Email, LinkedIn DM, Loom", badge: 3 },
  { step: "04", to: "/hq/pipeline", label: "Pipeline",  icon: BarChart2,      desc: "Deal Kanban — stage velocity and revenue", badge: 2 },
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
      <div className="min-h-screen bg-background flex items-center justify-center grain">
        <div className="flex flex-col items-center gap-2">
          <LogoMark size={32} className="animate-pulse text-primary" />
          <span className="text-xs text-muted-foreground font-mono mt-2 animate-pulse">Initializing Atlas Sovereign Command...</span>
        </div>
      </div>
    );
  }

  if (!loading && !user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col grain overflow-x-hidden">
      {/* ── Top Sovereign Process Header (No Sidebar) ────────────────────────── */}
      <header className="sticky top-0 z-40 w-full h-16 border-b border-border bg-background/85 backdrop-blur-xl px-4 md:px-8 flex items-center justify-between gap-4">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3 shrink-0">
          <NavLink to="/hq/flow" className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center text-primary group-hover:scale-105 transition-transform shadow-sm">
              <LogoMark size={20} className="text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs tracking-tight text-foreground group-hover:text-primary transition-colors">
                ATLAS
              </span>
              <span className="text-[9px] text-muted-foreground font-mono">
                Sovereign Strategist
              </span>
            </div>
          </NavLink>
        </div>

        {/* Center: The 4-Step Sequential Acquisition Stream */}
        <nav className="hidden lg:flex items-center gap-1 p-1 rounded-xl bg-surface-2 border border-border backdrop-blur-md shadow-inner">
          {SEQUENTIAL_STEPS.map((s, idx) => {
            const isActive = location.pathname.startsWith(s.to);
            return (
              <div key={s.to} className="flex items-center">
                {idx > 0 && (
                  <div className="mx-1 text-muted-foreground/30">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                )}
                <NavLink
                  to={s.to}
                  className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/80"
                  }`}
                  title={s.desc}
                >
                  <span className={`text-[10px] font-mono ${isActive ? "opacity-90 font-bold" : "opacity-50"}`}>
                    {s.step}
                  </span>
                  <s.icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{s.label}</span>
                  {s.badge != null && (
                    <span className="ml-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-primary/20 text-primary text-[9px] font-mono">
                      {s.badge}
                    </span>
                  )}
                </NavLink>
              </div>
            );
          })}
        </nav>

        {/* Right: The Vault & Tools */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* The Vault Button (Trigger) */}
          <button
            onClick={() => setVaultOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card/80 hover:bg-card border border-border/70 hover:border-primary/40 text-foreground text-xs font-semibold transition-all shadow-sm group"
            title="Open strategic maps, leads archive, integrations and settings (Cmd+K)"
          >
            <Database className="h-3.5 w-3.5 text-primary group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">The Vault</span>
            <kbd className="hidden md:inline-block text-[9px] font-mono px-1.5 py-0.2 bg-muted/60 border border-border rounded text-muted-foreground">
              ⌘K
            </kbd>
          </button>

          {/* Ask Atlas AI Assistant */}
          <button
            onClick={() => setChatOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/25 text-primary text-xs font-semibold transition-all shadow-sm"
          >
            <Zap className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ask Atlas</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={cycleTheme}
            className="h-8 w-8 rounded-lg bg-card/50 hover:bg-card border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>

          {/* Google-Style 9-Dot Ecosystem Waffle Switcher */}
          <EcosystemSwitcher />

          {/* User Profile */}
          <div className="flex items-center gap-2 pl-1 border-l border-border/50">
            <button
              onClick={() => navigate("/hq/settings")}
              className="h-7 w-7 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center text-primary hover:bg-primary/20 transition-all"
              title={user.user_metadata?.username || profile?.display_name || user.email || "Profile"}
            >
              <UserIcon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => signOut().then(() => navigate("/"))}
              className="text-muted-foreground hover:text-foreground p-1 transition-colors"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Sequential Step Tracker Strip (visible only on small screens) */}
      <div className="lg:hidden w-full overflow-x-auto border-b border-border/50 bg-[#0A0B0F] px-4 py-2 flex items-center gap-2">
        {SEQUENTIAL_STEPS.map((s) => {
          const isActive = location.pathname.startsWith(s.to);
          return (
            <NavLink
              key={s.to}
              to={s.to}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap ${
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground bg-muted/30"
              }`}
            >
              <span className="text-[9px] font-mono">{s.step}</span>
              <span>{s.label}</span>
            </NavLink>
          );
        })}
      </div>

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
              { id: "today",    label: "Daily OS",       description: "Run today\'s 20 prospects", accent: "#10b981", action: () => { window.location.hash = "/hq/flow"; } },
              { id: "pipeline", label: "Open Pipeline",  description: "Deal Kanban",              accent: "#10b981", action: () => { window.location.hash = "/hq/pipeline"; } },
              { id: "newlead",  label: "New Lead",       description: "Add to pipeline",          accent: "#10b981", shortcut: "⌘N", action: () => {} },
            ],
          },
        ]}
      />
    </div>
  );
}
