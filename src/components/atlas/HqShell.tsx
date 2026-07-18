import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, Users, Database, Shield, Compass, 
  LogOut, PanelLeftClose, PanelLeftOpen, User as UserIcon, Lock, ArrowLeft
} from "lucide-react";
import { LogoMark } from "@/components/atlas/Logo";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { isUserAdmin } from "@/lib/adminConfig";
import { Button } from "@/components/ui/button";

const hqNav = [
  { to: "/hq/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/hq/prospects", icon: Users, label: "Prospects" },
  { to: "/hq/settings", icon: Database, label: "CRM Mappings" },
  { to: "/hq/team", icon: Shield, label: "Team & Health" },
];

const STORAGE_KEY = "atlas.hq.sidebar.collapsed";

export default function HqShell() {
  const { user, loading, signOut } = useAuth();
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
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center grain">
        <div className="flex flex-col items-center gap-2">
          <LogoMark size={32} className="animate-pulse text-amber-500" />
          <span className="text-xs text-muted-foreground font-mono mt-2">Connecting to Atlas HQ...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Authorization Check
  if (!isUserAdmin(user.email)) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4 grain">
        <div className="max-w-md w-full rounded-2xl border border-white/[0.06] bg-black/40 backdrop-blur-xl p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-amber-500/[0.02] to-transparent pointer-events-none" />
          <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mb-6 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
            <Lock className="h-6 w-6 text-amber-500" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground font-display">Restricted Administration</h2>
          <p className="mt-3 text-[13px] text-muted-foreground leading-relaxed">
            Atlas HQ is an internal administration portal. The email address <strong className="text-foreground">{user.email}</strong> is not authorized to access this environment.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <Button onClick={() => navigate("/app")} className="w-full h-10 gap-1.5 font-medium bg-amber-500 text-black hover:bg-amber-600">
              <Compass className="h-4 w-4" /> Return to Workspace
            </Button>
            <Button variant="outline" onClick={() => signOut().then(() => navigate("/auth"))} className="w-full h-10 gap-1.5 font-medium border-white/10 hover:bg-white/5">
              <LogOut className="h-4 w-4" /> Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-foreground grain md:flex">
      {/* Sidebar Panel */}
      <aside
        className={`shrink-0 border-r border-white/[0.06] bg-black/40 backdrop-blur-xl flex flex-col transition-[width] duration-200 ease-out ${
          collapsed ? "md:w-16" : "lg:w-56 md:w-60"
        }`}
      >
        <div className={`h-16 flex items-center border-b border-white/[0.06] ${collapsed ? "justify-center px-2" : "px-5"}`}>
          <div className="flex items-center gap-2.5">
            <LogoMark size={24} className="text-amber-500" />
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-xs tracking-tight font-display">ATLAS HQ</span>
                <span className="text-[9px] text-amber-500/80 font-semibold uppercase tracking-wider">Admin Console</span>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Navigation */}
        <SidebarNav collapsed={collapsed} />

        {/* Sidebar Footer Operations */}
        <div className="p-3 border-t border-white/[0.06] space-y-1">
          {/* Back to Client App */}
          <button
            onClick={() => navigate("/app")}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors ${
              collapsed ? "justify-center" : ""
            }`}
            title="Back to client workspace"
          >
            <Compass className="h-4 w-4 text-emerald-500" />
            {!collapsed && <span>Return to App</span>}
          </button>

          {/* Toggle sidebar state */}
          <button
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors ${
              collapsed ? "justify-center" : ""
            }`}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && <span>Collapse</span>}
          </button>

          {/* Profile box */}
          <div className={`flex items-center gap-3 px-3 py-2 border-t border-white/[0.03] mt-2 pt-2 ${collapsed ? "justify-center" : ""}`}>
            <div className="h-7 w-7 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <UserIcon className="h-3.5 w-3.5 text-amber-500" />
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
          className="absolute left-3 right-3 rounded-md bg-white/[0.04] border border-white/[0.02] transition-all duration-200 ease-out pointer-events-none"
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
                  ? "text-amber-500 font-medium" 
                  : "text-muted-foreground hover:text-foreground"
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
