import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";
const Ctx = createContext<{ mode: ThemeMode; setMode: (m: ThemeMode) => void }>({ mode: "system", setMode: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("system");
  useEffect(() => {
    const saved = localStorage.getItem("kpi-theme") as ThemeMode | null;
    if (saved === "light" || saved === "dark" || saved === "system") setMode(saved);
  }, []);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = mode === "dark" || (mode === "system" && mq.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };
    apply();
    localStorage.setItem("kpi-theme", mode);
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [mode]);
  return <Ctx.Provider value={{ mode, setMode }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
