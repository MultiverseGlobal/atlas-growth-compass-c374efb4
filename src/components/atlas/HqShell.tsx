import { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate, Navigate } from "react-router-dom";
import { 
  Crosshair, Radio, BarChart2, MessageSquare, 
  Database, Zap, User as UserIcon, LogOut, Moon, Sun,
  Activity, Play, Target, Network, Settings2
} from "lucide-react";
import { LogoMark } from "@/components/atlas/Logo";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/hooks/useTheme";
import { AtlasChat } from "@/components/atlas/ChatDrawer";

// ─── Sidebar Navigation Groups ─────────────────────────────
const NAV_GROUPS = [
  {
    label: "COMMAND",
    items: [
      { to: "/hq/overview", label: "Overview", icon: BarChart2 },
      { to: "/hq/acquire",  label: "Acquire",  icon: Play },
    ]
  },
  {
    label: "INTELLIGENCE",
    items: [
      { to: "/hq/icp",     label: "ICP",       icon: Target },
      { to: "/hq/sources", label: "Sources",   icon: Network },
      { to: "/hq/recon",   label: "Recon",     icon: Radio },
    ]
  },
  {
    label: "PIPELINE",
    items: [
      { to: "/hq/leads",    label: "Leads",    icon: Database },
      { to: "/hq/pipeline", label: "Pipeline", icon: Activity },
      { to: "/hq/outreach", label: "Outreach", icon: MessageSquare },
    ]
  },
  {
    label: "SYSTEM",
    items: [
      { to: "/hq/settings", label: "Integrations", icon: Zap }, // Note: we route both Integrations & Settings to settings for now if there isn't a dedicated integrations page.
      { to: "/hq/settings?tab=general", label: "Settings", icon: Settings2 },
    ]
  }
];

export default function HqShell() {
  const { user, loading, signOut } = useAuth();
  const { theme, cycleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<{ display_name: string | null; handle: string | null } | null>(null);
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
    <div className="min-h-screen bg-background text-foreground flex grain overflow-hidden">
      
      {/* ── Permanent Left Sidebar ────────────────────────────────────────────── */}
      <aside className="w-64 border-r border-border bg-surface-2/50 backdrop-blur-xl flex flex-col hidden md:flex shrink-0">
        
        {/* Brand Area */}
        <div className="h-16 flex items-center px-6 border-b border-border/50">
          <NavLink to="/hq/acquire" className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center text-primary group-hover:scale-105 transition-transform shadow-sm">
              <LogoMark size={20} className="text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs tracking-tight text-foreground group-hover:text-primary transition-colors">
                ATLAS
              </span>
              <span className="text-[9px] text-muted-foreground font-mono">
                Acquisition OS
              </span>
            </div>
          </NavLink>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <h3 className="text-[10px] font-mono text-muted-foreground font-semibold px-2 mb-3 tracking-wider">
                {group.label}
              </h3>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = location.pathname.startsWith(item.to.split('?')[0]);
                  return (
                    <NavLink
                      key={item.label}
                      to={item.to}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                        isActive
                          ? "bg-primary/10 text-primary border border-primary/20 shadow-sm"
                          : "text-muted-foreground hover:bg-surface-3/50 hover:text-foreground border border-transparent"
                      }`}
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground/70"}`} />
                      {item.label}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Utility Area */}
        <div className="p-4 border-t border-border/50 bg-surface-2/30 space-y-2">
          <button
            onClick={() => setChatOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/25 text-primary text-xs font-semibold transition-all shadow-sm"
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Ask Atlas</span>
          </button>
          
          <div className="flex items-center justify-between px-1 pt-2">
            <button
              onClick={cycleTheme}
              className="h-8 w-8 rounded-lg hover:bg-surface-3 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="flex items-center gap-2">
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
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Mobile Header (Visible on small screens only) ─────────────────────── */}
      <div className="md:hidden flex flex-col w-full h-full">
        <header className="h-14 border-b border-border bg-background/85 backdrop-blur-xl px-4 flex items-center justify-between z-40 shrink-0">
          <div className="flex items-center gap-2">
             <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center text-primary">
                <LogoMark size={20} className="text-primary" />
             </div>
             <span className="font-bold text-xs tracking-tight">ATLAS</span>
          </div>
          {/* A simple mobile nav drop down could go here, or we just rely on responsive redesign later. For now, keep it functional. */}
        </header>
        <main className="flex-1 min-w-0 w-full overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* ── Main Workspace (Desktop) ────────────────────────────────────────── */}
      <main className="hidden md:block flex-1 min-w-0 w-full h-screen overflow-y-auto">
        <Outlet />
      </main>

      {/* ── Atlas AI Chat Drawer ────────────────────────────────────────────── */}
      <AtlasChat open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
