import { useState, useRef, useEffect } from "react";
import { ExternalLink, Database } from "lucide-react";
import {
  PseudonymsSovereignMark,
  PseudonymsIDIcon,
  AtlasIcon,
  MetaphorIcon,
  ClarioIcon,
  OrionIcon,
  WeaveIcon,
} from "./EcosystemIcons";

export const ECOSYSTEM_APPS = [
  {
    id: "pseudonyms_id",
    name: "Pseudonyms ID",
    tagline: "Master Sovereign Account & Hub",
    url: "http://localhost:3005",
    status: "live",
    Icon: PseudonymsIDIcon,
  },
  {
    id: "atlas",
    name: "Atlas io",
    tagline: "Demand Generation & CRM",
    url: "http://localhost:5173",
    status: "current",
    Icon: AtlasIcon,
  },
  {
    id: "metaphor",
    name: "Metaphor OS",
    tagline: "Universal Context Engine",
    url: "http://localhost:3000",
    status: "live",
    Icon: MetaphorIcon,
  },
  {
    id: "clario",
    name: "Clario",
    tagline: "Creative Video Studio & Canvas",
    url: "http://localhost:49843",
    status: "live",
    Icon: ClarioIcon,
  },
  {
    id: "orion",
    name: "Orion",
    tagline: "Skia Fluid Mobile Companion",
    url: "exp://localhost:8081",
    status: "building",
    Icon: OrionIcon,
  },
  {
    id: "weave",
    name: "Weave",
    tagline: "Context Graph & Knowledge Weave",
    url: "http://localhost:3000/weave",
    status: "live",
    Icon: WeaveIcon,
  },
];

interface EcosystemSwitcherProps {
  align?: "left" | "right";
  isDark?: boolean;
}

export function EcosystemSwitcher({ align = "right", isDark = true }: EcosystemSwitcherProps) {
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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      {/* Dimmed backdrop to prevent background elements from bleeding through */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div className="relative" ref={menuRef}>
        {/* Sovereign Pseudonyms Trigger (Replaces generic 9-dot Google waffle) */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Switch Sovereign App (Cmd+.)"
          aria-expanded={isOpen}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all cursor-pointer relative z-40 ${
            isOpen
              ? isDark
                ? "bg-white/15 border-white/30 text-white shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                : "bg-neutral-900 text-white border-neutral-900 shadow-md"
              : isDark
              ? "bg-white/[0.04] hover:bg-white/10 border-white/10 text-white/80 hover:text-white"
              : "bg-white hover:bg-neutral-100 border-neutral-200 text-neutral-700 hover:text-neutral-900 shadow-sm"
          }`}
          title="Pseudonyms Sovereign Network (Cmd+.)"
        >
          <PseudonymsSovereignMark
            size={16}
            color={isOpen ? (isDark ? "#ffffff" : "#ffffff") : (isDark ? "#e2e8f0" : "#0f172a")}
          />
          <span className="text-xs font-mono uppercase tracking-wider font-semibold hidden md:inline-block">
            Hub
          </span>
          <kbd
            className={`hidden lg:inline-block rounded px-1.5 py-0.2 text-[9px] font-mono border ${
              isDark ? "border-white/10 bg-white/5 text-white/40" : "border-neutral-200 bg-neutral-100 text-neutral-400"
            }`}
          >
            ⌘.
          </kbd>
        </button>

        {/* Sovereign Popover Panel */}
        {isOpen && (
          <div
            className={`absolute ${align === "right" ? "right-0" : "left-0"} mt-3 w-88 rounded-2xl border p-4 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 space-y-3.5 ${
              isDark
                ? "bg-[#090b10] border-white/15 shadow-[0_25px_65px_rgba(0,0,0,0.92)] text-white"
                : "bg-white border-neutral-200 shadow-2xl text-neutral-900"
            }`}
          >
            {/* Header */}
            <div
              className={`flex items-center justify-between pb-2.5 border-b ${
                isDark ? "border-white/10" : "border-neutral-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <PseudonymsSovereignMark size={14} color={isDark ? "#ffffff" : "#111318"} />
                <span
                  className={`text-[11px] font-mono uppercase tracking-widest font-semibold ${
                    isDark ? "text-white/70" : "text-neutral-600"
                  }`}
                >
                  Sovereign Network
                </span>
              </div>
              <a
                href="http://localhost:3005"
                target="_blank"
                rel="noreferrer"
                className={`text-[11px] font-mono flex items-center gap-1 transition-colors ${
                  isDark ? "text-white/70 hover:text-white hover:underline" : "text-neutral-700 hover:text-black hover:underline"
                }`}
              >
                <span>Master ID</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* 6 Sovereign App Cards with REAL Authentic Vector Marks */}
            <div className="grid grid-cols-3 gap-2">
              {ECOSYSTEM_APPS.map((app) => {
                const { Icon } = app;
                const isCurrent = app.status === "current";

                return (
                  <a
                    key={app.id}
                    href={app.url}
                    target={isCurrent ? "_self" : "_blank"}
                    rel="noreferrer"
                    onClick={() => setIsOpen(false)}
                    className={`flex flex-col items-center text-center p-3 rounded-xl border transition-all group ${
                      isCurrent
                        ? isDark
                          ? "bg-white/10 border-white/30 shadow-sm"
                          : "bg-neutral-900 text-white border-neutral-900 shadow-sm"
                        : isDark
                        ? "bg-white/[0.02] hover:bg-white/[0.07] border-transparent hover:border-white/15"
                        : "bg-neutral-50 hover:bg-neutral-100 border-transparent hover:border-neutral-200"
                    }`}
                  >
                    {/* Real Authentic App Logo Mark */}
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center mb-2 transition-transform group-hover:scale-105 border ${
                        isCurrent
                          ? isDark
                            ? "bg-white/15 border-white/30 text-white shadow-inner"
                            : "bg-white text-black border-white"
                          : isDark
                          ? "bg-white/[0.04] border-white/10 text-white/80 group-hover:text-white group-hover:border-white/25"
                          : "bg-white border-neutral-200 text-neutral-800 group-hover:text-black group-hover:border-neutral-300 shadow-xs"
                      }`}
                    >
                      <Icon
                        size={20}
                        color={
                          isCurrent
                            ? isDark
                              ? "#ffffff"
                              : "#000000"
                            : isDark
                            ? "#e2e8f0"
                            : "#1e293b"
                        }
                      />
                    </div>
                    <span
                      className={`text-[11px] font-semibold leading-tight tracking-tight ${
                        isCurrent
                          ? "text-white font-bold"
                          : isDark
                          ? "text-white/85 group-hover:text-white"
                          : "text-neutral-800 group-hover:text-black"
                      }`}
                    >
                      {app.name}
                    </span>
                    <span
                      className={`text-[9px] font-mono mt-1 uppercase tracking-wider ${
                        isCurrent
                          ? isDark
                            ? "text-emerald-400 font-bold"
                            : "text-emerald-300 font-bold"
                          : isDark
                          ? "text-white/40"
                          : "text-neutral-400"
                      }`}
                    >
                      {isCurrent ? "Active" : app.status}
                    </span>
                  </a>
                );
              })}
            </div>

            {/* Context Vault Anchor */}
            <div
              className={`pt-2.5 border-t text-center ${
                isDark ? "border-white/10" : "border-neutral-200"
              }`}
            >
              <a
                href="http://localhost:3005/vault"
                target="_blank"
                rel="noreferrer"
                className={`text-[11px] font-mono inline-flex items-center gap-1.5 transition-colors ${
                  isDark ? "text-white/50 hover:text-white" : "text-neutral-500 hover:text-black"
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Universal Shared Context Vault</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
