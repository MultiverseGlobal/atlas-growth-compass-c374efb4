import { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { 
  Crosshair, Radio, BarChart2, MessageSquare, 
  Database, Zap, User as UserIcon, LogOut, Moon, Sun, ChevronRight, Sparkles
} from "lucide-react";
import { LogoMark } from "@/components/atlas/Logo";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/hooks/useTheme";
import { AtlasChat } from "@/components/atlas/ChatDrawer";
import { TheVaultDrawer } from "@/components/atlas/TheVaultDrawer";

// ─── The 4 Sequential Sovereign Acquisition Steps ─────────────────────────────
const SEQUENTIAL_STEPS = [
  { step: "01", to: "/hq/icp",      label: "ICP & Offer",      icon: Crosshair,     desc: "Define target thesis & pain engine" },
  { step: "02", to: "/hq/recon",    label: "Sourcing Machine", icon: Radio,         desc: "Live Jina AI & directory scraping" },
  { step: "03", to: "/hq/flow",     label: "Pipeline Flow",    icon: BarChart2,     desc: "Stage velocity & deal Kanban" },
  { step: "04", to: "/hq/outreach", label: "Outreach Studio",  icon: MessageSquare, desc: "Personalized founder copy & sync" },
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

  // Global shortcut (Cmd+K) to toggle The Vault
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setVaultOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col grain overflow-x-hidden">
      {/* ── Top Sovereign Process Header (No Sidebar) ────────────────────────── */}
      <header className="sticky top-0 z-40 w-full h-16 border-b border-border/70 bg-[#08090D]/90 backdrop-blur-xl px-4 md:px-8 flex items-center justify-between gap-4">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3 shrink-0">
          <NavLink to="/hq/icp" className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary group-hover:scale-105 transition-transform shadow-sm">
              <LogoMark size={20} className="text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs tracking-tight font-display text-foreground group-hover:text-primary transition-colors">
                ATLAS
              </span>
              <span className="text-[9px] text-muted-foreground font-mono">
                Sovereign Strategist
              </span>
            </div>
          </NavLink>
        </div>

        {/* Center: The 4-Step Sequential Acquisition Stream */}
        <nav className="hidden lg:flex items-center gap-1.5 p-1 rounded-xl bg-card/60 border border-border/60 backdrop-blur-md shadow-inner">
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
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                  title={s.desc}
                >
                  <span className={`text-[10px] font-mono ${isActive ? "opacity-90 font-bold" : "opacity-50"}`}>
                    {s.step}
                  </span>
                  <s.icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{s.label}</span>
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

          {/* User Profile */}
          <div className="flex items-center gap-2 pl-1 border-l border-border/50">
            <button
              onClick={() => navigate("/hq/settings")}
              className="h-7 w-7 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center text-primary hover:bg-primary/20 transition-all"
              title={profile?.display_name || user.email || "Profile"}
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
    </div>
  );
}
