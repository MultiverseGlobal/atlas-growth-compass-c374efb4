import { useState, useRef, useEffect } from "react";
import { 
  Shield, 
  ExternalLink, 
  Network, 
  Smartphone, 
  TrendingUp, 
  Sparkles, 
  Database,
  Sliders,
  CheckCircle2
} from "lucide-react";

export const ECOSYSTEM_APPS = [
  {
    id: "pseudonyms_id",
    name: "Pseudonyms ID",
    tagline: "Master Sovereign Account & Hub",
    url: "http://localhost:3005",
    accentColor: "#8b5cf6",
    status: "live",
    icon: Shield
  },
  {
    id: "atlas",
    name: "Atlas io",
    tagline: "Demand Generation & CRM",
    url: "http://localhost:5173",
    accentColor: "#10b981",
    status: "current",
    icon: TrendingUp
  },
  {
    id: "metaphor",
    name: "Metaphor OS",
    tagline: "Universal Context Engine",
    url: "http://localhost:3000",
    accentColor: "#8b5cf6",
    status: "live",
    icon: Network
  },
  {
    id: "clario",
    name: "Clario",
    tagline: "Creative Video Studio & Canvas",
    url: "http://localhost:49843",
    accentColor: "#ec4899",
    status: "live",
    icon: Sparkles
  },
  {
    id: "orion",
    name: "Orion",
    tagline: "Skia Fluid Mobile Companion",
    url: "exp://localhost:8081",
    accentColor: "#00f0ff",
    status: "building",
    icon: Smartphone
  }
];

export function EcosystemSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      {/* 9-Dot Google Waffle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-lg border transition-all cursor-pointer ${
          isOpen
            ? "bg-primary/20 border-primary text-primary shadow-sm"
            : "bg-card/50 hover:bg-card border-border/70 text-muted-foreground hover:text-foreground"
        }`}
        title="Pseudonyms Ecosystem Apps"
      >
        <div className="grid grid-cols-3 gap-1 w-3.5 h-3.5 place-items-center">
          <span className="w-1 h-1 rounded-full bg-current" />
          <span className="w-1 h-1 rounded-full bg-current" />
          <span className="w-1 h-1 rounded-full bg-current" />
          <span className="w-1 h-1 rounded-full bg-current" />
          <span className="w-1 h-1 rounded-full bg-current" />
          <span className="w-1 h-1 rounded-full bg-current" />
          <span className="w-1 h-1 rounded-full bg-current" />
          <span className="w-1 h-1 rounded-full bg-current" />
          <span className="w-1 h-1 rounded-full bg-current" />
        </div>
      </button>

      {/* Waffle Popover Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 rounded-2xl bg-card border border-border p-4 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                Pseudonyms Ecosystem
              </span>
            </div>
            <a
              href="http://localhost:3005"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-primary hover:underline font-mono flex items-center gap-1"
            >
              <span>Master ID</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {ECOSYSTEM_APPS.map((app) => {
              const Icon = app.icon;
              const isCurrent = app.status === "current";

              return (
                <a
                  key={app.id}
                  href={app.url}
                  target={isCurrent ? "_self" : "_blank"}
                  rel="noreferrer"
                  onClick={() => setIsOpen(false)}
                  className={`flex flex-col items-center text-center p-2.5 rounded-xl border transition-all group ${
                    isCurrent
                      ? "bg-primary/10 border-primary/40 shadow-sm"
                      : "hover:bg-muted/50 border-transparent hover:border-border"
                  }`}
                >
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-1.5 shadow-sm transition-transform group-hover:scale-105"
                    style={{
                      backgroundColor: `${app.accentColor}18`,
                      color: app.accentColor,
                      border: `1px solid ${app.accentColor}35`
                    }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-semibold text-foreground group-hover:text-primary leading-tight">
                    {app.name}
                  </span>
                  <span className="text-[9px] font-mono text-muted-foreground mt-0.5">
                    {isCurrent ? "Active" : app.status}
                  </span>
                </a>
              );
            })}
          </div>

          <div className="pt-2 border-t border-border text-center">
            <a
              href="http://localhost:3005/vault"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-mono text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 transition-colors"
            >
              <Database className="w-3.5 h-3.5 text-primary" />
              <span>Universal Shared Context Vault</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
