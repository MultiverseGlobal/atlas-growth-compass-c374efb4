import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, Users, Shield, Compass, 
  LogOut, PanelLeftClose, PanelLeftOpen, User as UserIcon, Lock,
  Settings as SettingsIcon
} from "lucide-react";
import { LogoMark } from "@/components/atlas/Logo";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { isUserAdmin } from "@/lib/adminConfig";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";

const hqNav = [
  { to: "/hq/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/hq/prospects", icon: Users, label: "Prospects" },
  { to: "/hq/settings", icon: SettingsIcon, label: "Settings" },
  { to: "/hq/team", icon: Shield, label: "Team & Health" },
];

const STORAGE_KEY = "atlas.hq.sidebar.collapsed";

export default function HqShell() {
  const { user, loading, signOut } = useAuth();
  const { theme, cycleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<{ display_name: string | null; handle: string | null } | null>(null);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "true";
  });

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

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
          <span className="text-xs text-muted-foreground font-mono mt-2 animate-pulse">Connecting to Atlas HQ...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Authorization Check
  if (!isUserAdmin(user.email)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 grain">
        <div className="max-w-md w-full rounded-2xl border border-border/60 bg-card p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-6 border border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.1)]">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground font-display">Restricted Administration</h2>
          <p className="mt-3 text-[13px] text-muted-foreground leading-relaxed">
            Atlas HQ is an internal administration portal. The email address <strong className="text-foreground">{user.email}</strong> is not authorized to access this environment.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <Button onClick={() => navigate("/app")} className="w-full h-10 gap-1.5 font-medium bg-primary text-primary-foreground hover:opacity-90">
              <Compass className="h-4 w-4" /> Return to Workspace
            </Button>
            <Button variant="outline" onClick={() => signOut().then(() => navigate("/auth"))} className="w-full h-10 gap-1.5 font-medium border-border/80 hover:bg-muted">
              <LogOut className="h-4 w-4" /> Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground grain md:flex">
      {/* Sidebar Panel */}
      <aside
        className={`shrink-0 border-r border-border/60 bg-sidebar flex flex-col transition-[width] duration-200 ease-out ${
          collapsed ? "md:w-16" : "lg:w-56 md:w-60"
        }`}
      >
        <div className={`h-16 flex items-center border-b border-border/60 ${collapsed ? "justify-center px-2" : "px-5"}`}>
          <div className="flex items-center gap-2.5">
            <LogoMark size={24} className="text-primary" />
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-xs tracking-tight font-display">ATLAS HQ</span>
                <span className="text-[9px] text-primary/80 font-semibold uppercase tracking-wider">Admin Console</span>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Navigation */}
        <SidebarNav collapsed={collapsed} />

        {/* Sidebar Footer Operations */}
        <div className="p-3 border-t border-border/60 space-y-1">

          {/* Toggle sidebar state */}
          <button
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground transition-colors ${
              collapsed ? "justify-center" : ""
            }`}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && <span>Collapse</span>}
          </button>

          {/* Profile box */}
          <div className={`flex items-center gap-3 px-3 py-2 border-t border-border/40 mt-2 pt-2 ${collapsed ? "justify-center" : ""}`}>
            <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <UserIcon className="h-3.5 w-3.5 text-primary" />
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium truncate text-foreground">{profile?.display_name ?? user.email}</div>
                  <div className="text-[10px] text-muted-foreground truncate font-mono">Admin Session</div>
                </div>
                <button
                  onClick={() => signOut().then(() => navigate("/"))}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main Panel Content Area */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="relative z-10 w-full h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function SidebarNav({ collapsed }: { collapsed: boolean }) {
  const location = useLocation();
  const listRef = useRef<HTMLDivElement | null>(null);
  const [indicator, setIndicator] = useState<{ top: number; height: number; visible: boolean }>({
    top: 0, height: 0, visible: false,
  });

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const path = location.pathname;
    
    // Find active match
    const match = [...hqNav]
      .filter((n) => path.startsWith(n.to))
      .sort((a, b) => b.to.length - a.to.length)[0];
      
    if (!match) { setIndicator((s) => ({ ...s, visible: false })); return; }
    const activeEl = list.querySelector<HTMLElement>(`[data-to="${match.to}"]`);
    if (!activeEl) { setIndicator((s) => ({ ...s, visible: false })); return; }
    const listRect = list.getBoundingClientRect();
    const rect = activeEl.getBoundingClientRect();
    setIndicator({
      top: rect.top - listRect.top,
      height: rect.height,
      visible: true,
    });
  }, [location.pathname, collapsed]);

  return (
    <div ref={listRef} className="relative flex-1 py-4 overflow-y-auto px-3">
      {/* Sliding active indicator block */}
      {indicator.visible && (
        <div
          className="absolute left-3 right-3 rounded-md bg-sidebar-accent/60 border border-sidebar-border/30 transition-all duration-200 ease-out pointer-events-none"
          style={{ top: indicator.top, height: indicator.height }}
        />
      )}

      <div className="space-y-1 relative z-10">
        {hqNav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            data-to={n.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-150 ${
                isActive 
                  ? "text-primary font-medium" 
                  : "text-sidebar-foreground hover:text-foreground"
              } ${collapsed ? "justify-center" : ""}`
            }
          >
            <n.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{n.label}</span>}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
