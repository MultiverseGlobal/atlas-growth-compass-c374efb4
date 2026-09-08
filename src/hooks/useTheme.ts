import { useEffect, useState } from "react";

export type Theme = "clean" | "paper" | "dark";
const STORAGE_KEY = "atlas.theme";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "clean";
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    // Only restore non-dark stored preferences; light ("clean") is the system default
    if (stored === "clean" || stored === "paper") return stored;
    return "clean";
  });

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        setTheme(e.newValue as Theme);
      }
    };
    const handleCustom = (e: CustomEvent) => {
      setTheme(e.detail);
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("theme-change", handleCustom as EventListener);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("theme-change", handleCustom as EventListener);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    // Clear existing theme classes
    root.classList.remove("dark", "theme-paper", "theme-clean");
    
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "paper") {
      root.classList.add("theme-paper");
    } else {
      root.classList.add("theme-clean");
    }
    
    localStorage.setItem(STORAGE_KEY, theme);
    window.dispatchEvent(new CustomEvent("theme-change", { detail: theme }));
  }, [theme]);

  const cycleTheme = () => {
    setTheme((prev) => {
      if (prev === "dark") return "clean";
      return "dark";
    });
  };

  return { theme, setTheme, cycleTheme };
}
