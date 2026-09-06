import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { MorningFocus } from "@/components/atlas/MorningFocus";
import { EcosystemSwitcher } from "@/components/atlas/EcosystemSwitcher";
import { LogoMark } from "@/components/atlas/Logo";
import { Sun, Moon, Volume2, VolumeX, Sparkles, Target, Database } from "lucide-react";
import { soundManager } from "@/lib/audioFeedback";

export default function Index() {
  const navigate = useNavigate();

  // Theme state: dark or light
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("atlas.theme");
    return stored ? stored === "dark" : true;
  });

  // Sound state
  const [isMuted, setIsMuted] = useState<boolean>(soundManager.isMuted);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      root.classList.remove("light");
      localStorage.setItem("atlas.theme", "dark");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
      localStorage.setItem("atlas.theme", "light");
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);
  const toggleSound = () => {
    const nextState = !isMuted;
    setIsMuted(nextState);
    soundManager.setMuted(nextState);
  };

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-500 ${
        isDark ? "bg-[#07080C] text-neutral-100" : "bg-[#F9F9FB] text-neutral-900"
      }`}
    >
      {/* ── Top Sovereign Process Header ──────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-30 flex w-full items-center justify-between px-6 py-3.5 backdrop-blur-2xl transition-colors duration-500 border-b ${
          isDark
            ? "bg-[#07080c]/80 border-white/[0.08] shadow-sm"
            : "bg-white/80 border-neutral-200 shadow-sm"
        }`}
      >
        {/* Left: Brand Identity & Unified Navigation */}
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div
              className={`h-8 w-8 rounded-xl border flex items-center justify-center transition-colors ${
                isDark
                  ? "bg-white/[0.04] border-white/10 text-white"
                  : "bg-white border-neutral-200 text-neutral-900 shadow-sm"
              }`}
            >
              <LogoMark size={16} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs tracking-wider uppercase font-display">
                ATLAS
              </span>
              <span className="text-[9px] text-[var(--pds-text-muted)] font-mono">
                Economic Engine
              </span>
            </div>
          </Link>

          {/* Central Workspace Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 p-1 rounded-xl border bg-[var(--pds-surface-1)] border-[var(--pds-border-subtle)]">
            <Link
              to="/"
              className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                isDark
                  ? "bg-white/10 text-white"
                  : "bg-neutral-200 text-neutral-900"
              }`}
            >
              Morning Focus
            </Link>
            <Link
              to="/objectives"
              className={`px-3 py-1 rounded-lg text-xs font-mono transition-all hover:text-[var(--pds-text-primary)] ${
                isDark
                  ? "text-white/60 hover:text-white"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              Define Hunt
            </Link>
          </nav>
        </div>

        {/* Right: Controls & Ecosystem Switcher */}
        <div className="flex items-center gap-2.5">
          {/* Audio Feedback Switch */}
          <button
            onClick={toggleSound}
            title={isMuted ? "Unmute acoustic feedback" : "Mute acoustic feedback"}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isDark
                ? "border-white/10 bg-white/[0.03] text-white/50 hover:text-white"
                : "border-neutral-200 bg-white text-neutral-500 hover:text-neutral-900 shadow-sm"
            }`}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4 text-emerald-500" />
            )}
          </button>

          {/* Light / Dark Mode Switch */}
          <button
            onClick={toggleTheme}
            title="Toggle color theme"
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isDark
                ? "border-white/10 bg-white/[0.03] text-white/50 hover:text-white"
                : "border-neutral-200 bg-white text-neutral-500 hover:text-neutral-900 shadow-sm"
            }`}
          >
            {isDark ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-neutral-600" />
            )}
          </button>

          {/* Ecosystem Waffle Switcher */}
          <EcosystemSwitcher currentApp="atlas" isDark={isDark} />
        </div>
      </header>

      {/* ── Main Operating Surface: Morning Focus ─────────────────────────────── */}
      <main className="flex-1 pb-16">
        <MorningFocus />
      </main>
    </div>
  );
}
