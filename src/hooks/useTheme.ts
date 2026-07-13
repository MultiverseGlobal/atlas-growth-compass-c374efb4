import { useEffect, useState } from "react";

export type Theme = "clean" | "paper" | "dark";
const STORAGE_KEY = "atlas.theme";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "clean";
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "clean" || stored === "paper" || stored === "dark") return stored;
    return "clean"; // default theme is the clean landing page style
  });

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
  }, [theme]);

  const cycleTheme = () => {
    setTheme((prev) => {
      if (prev === "clean") return "paper";
      if (prev === "paper") return "dark";
      return "clean";
    });
  };

  return { theme, setTheme, cycleTheme };
}
