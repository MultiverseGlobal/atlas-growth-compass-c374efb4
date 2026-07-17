import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Activity, Compass, FileText, Plug, Settings, User as UserIcon, LogOut, Globe, PanelLeftClose, PanelLeftOpen, Bell, Moon, Sun, Palette, Menu, X, Target } from "lucide-react";
import { Logo, LogoMark } from "@/components/atlas/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CompassLoader } from "@/pages/app/Home";
import { useTheme } from "@/hooks/useTheme";

const nav = [
  { to: "/app", end: true, icon: Compass, label: "Today" },
  { to: "/hq", icon: Target, label: "Atlas HQ" },
  { to: "/app/timeline", icon: Activity, label: "Timeline" },
  { to: "/app/notifications", icon: Bell, label: "Notifications" },
  { to: "/app/reports", icon: FileText, label: "Reports" },
  { to: "/app/integrations", icon: Plug, label: "Data sources" },
  { to: "/app/page", icon: Globe, label: "Public page" },
  { to: "/app/settings", icon: Settings, label: "Settings" },
];

const STORAGE_KEY = "atlas.sidebar.collapsed";

export default function AppShell() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, cycleTheme } = useTheme();
  const [profile, setProfile] = useState<{ handle: string | null; display_name: string | null; created_at?: string } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
    return true; // default to collapsed for standard users
  });

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(STORAGE_KEY, String(next));
      window.dispatchEvent(new Event("sidebar-toggle"));
      return next;
    });
  };

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("handle, display_name, onboarded_at, created_at").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data && !data.onboarded_at) navigate("/onboarding");
      setProfile(data);

      // Expand sidebar on the first day of usage, default to collapsed otherwise
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === null && data) {
        const signupDate = new Date(data.created_at || Date.now());
        const oneDayInMs = 24 * 60 * 60 * 1000;
        const isFirstDay = (Date.now() - signupDate.getTime()) < oneDayInMs;
        setCollapsed(!isFirstDay);
      }
    });
  }, [user, navigate]);

  // Real-time unread notifications subscription
  useEffect(() => {
    if (!user) return;

    const fetchCount = () => {
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null)
        .then(({ count }) => {
          setUnreadCount(count ?? 0);
        });
    };

    fetchCount();

    const channel = supabase
      .channel("unread-notifications-appshell")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const [isFocusMode, setIsFocusMode] = useState(false);

  useEffect(() => {
    const handleFocusChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setIsFocusMode(!!customEvent.detail?.active);
    };
    window.addEventListener("focus-mode-change", handleFocusChange);
    
    // Check initial state in case the DOM already contains the class on mount
    setIsFocusMode(document.documentElement.classList.contains("focus-mode-active"));

    return () => {
      window.removeEventListener("focus-mode-change", handleFocusChange);
    };
  }, []);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center grain">
        <CompassLoader />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background grain md:flex${isFocusMode ? " focus-mode-active" : ""}`}>
      {!isFocusMode && (
        <>
          {/* Mobile backdrop */}
          {mobileOpen && (
            <div
              className="sidebar-backdrop"
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
          )}
          <aside
            className={`sidebar-panel shrink-0 border-r border-border/60 bg-sidebar flex flex-col transition-[width] duration-200 ease-out ${
              collapsed ? "md:w-16" : "lg:w-56 md:w-60"
            } ${mobileOpen ? "sidebar-open" : ""}`}
          >
          <div className={`h-16 flex items-center border-b border-border/60 ${collapsed ? "justify-center px-2" : "px-5"}`}>
            {collapsed ? <LogoMark size={22} /> : <Logo />}
          </div>
          <SidebarNav collapsed={collapsed} unreadCount={unreadCount} email={user?.email} />
          <div className="p-3 border-t border-border/60 space-y-1">
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

            {/* Theme cycling toggle */}
            <button
              onClick={cycleTheme}
              aria-label="Cycle theme"
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground transition-colors ${
                collapsed ? "justify-center" : ""
              }`}
            >
              {theme === "dark" ? (
                <Moon className="h-4 w-4 text-amber-400" />
              ) : theme === "paper" ? (
                <Palette className="h-4 w-4 text-amber-500" />
              ) : (
                <Sun className="h-4 w-4 text-primary" />
              )}
              {!collapsed && <span>Theme: {theme === "clean" ? "Clean" : theme === "paper" ? "Paper" : "Dark"}</span>}
            </button>

            <div className={`flex items-center gap-3 px-3 py-2 ${collapsed ? "justify-center" : ""}`}>
              <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <UserIcon className="h-3.5 w-3.5 text-primary" />
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{profile?.display_name ?? user.email}</div>
                    {profile?.handle && <div className="text-xs text-muted-foreground truncate font-mono">@{profile.handle}</div>}
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
        </>
      )}

      {!isFocusMode && (
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border/60 bg-background/95 px-4 backdrop-blur md:hidden safe-x">
          <button
            onClick={() => setMobileOpen(true)}
            className="touch-target text-muted-foreground hover:text-foreground"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Logo />
          <button onClick={() => signOut().then(() => navigate("/"))} className="touch-target text-muted-foreground hover:text-foreground" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </header>
      )}

      <main key={location.pathname} className={`min-w-0 flex-1 page-fade transition-all duration-300 relative overflow-hidden ${isFocusMode ? "flex items-center justify-center" : "pb-20 md:pb-0"}`}>
        {/* Subtle interior ambient glow */}
        {!isFocusMode && (
          <div aria-hidden className="pointer-events-none absolute inset-0 z-0 select-none" style={{ background: "radial-gradient(ellipse 55% 45% at 50% 10%, hsla(37,72%,62%,0.07) 0%, transparent 60%)" }} />
        )}
        <div className="relative z-10 w-full h-full">
          <Outlet />
        </div>
      </main>

      {!isFocusMode && (
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border/70 bg-sidebar/95 px-2 py-2 backdrop-blur md:hidden">
          {nav.filter(n => n.to !== "/hq" || user?.email?.toLowerCase() === "multiverseglobals@gmail.com").slice(0, 5).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 rounded-md px-1 py-1.5 text-[10px] transition-colors ${
                  isActive ? "bg-sidebar-accent text-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                }`
              }
            >
              <div className="relative">
                <n.icon className="h-4 w-4" />
                {n.to === "/app/notifications" && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-destructive" />
                )}
              </div>
              <span className="max-w-full truncate">{n.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}

const ADMIN_EMAIL = "multiverseglobals@gmail.com";

function SidebarNav({ collapsed, unreadCount, email }: { collapsed: boolean; unreadCount: number; email?: string }) {
  const location = useLocation();
  const listRef = useRef<HTMLDivElement | null>(null);
  const [indicator, setIndicator] = useState<{ top: number; height: number; visible: boolean }>({
    top: 0, height: 0, visible: false,
  });

  const visibleNav = nav.filter(n =>
    n.to !== "/hq" || (email?.toLowerCase() === ADMIN_EMAIL)
  );

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const path = location.pathname;
    const match = [...visibleNav]
      .filter((n) => (n.end ? path === n.to : path.startsWith(n.to)))
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
    <nav ref={listRef} className="relative flex-1 p-3 space-y-0.5">
      <div
        aria-hidden
        className="nav-indicator pointer-events-none absolute left-2 right-2 top-0 rounded-md bg-sidebar-accent"
        style={{
          transform: `translateY(${indicator.top}px)`,
          height: indicator.height,
          opacity: indicator.visible ? 1 : 0,
        }}
      />
      {visibleNav.map((n) => {
        const link = (
          <NavLink
            to={n.to}
            end={n.end}
            data-to={n.to}
            className={({ isActive }) =>
              `relative z-[1] flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-150 ${
                collapsed ? "justify-center" : ""
              } ${
                isActive
                  ? "text-foreground font-medium bg-sidebar-accent/50 before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r-full before:bg-amber-500"
                  : "text-sidebar-foreground hover:text-foreground"
              }`
            }
          >
            <div className="relative">
              <n.icon className="h-4 w-4 shrink-0" />
              {n.to === "/app/notifications" && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-destructive animate-pulse" />
              )}
            </div>
            {!collapsed && (
              <span className="flex-1 flex items-center justify-between">
                <span>{n.label}</span>
                {n.to === "/app/notifications" && unreadCount > 0 && (
                  <span className="ml-2 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                    {unreadCount}
                  </span>
                )}
              </span>
            )}
          </NavLink>
        );

        if (!collapsed) return <div key={n.to}>{link}</div>;
        return (
          <Tooltip key={n.to} delayDuration={120}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>{n.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

