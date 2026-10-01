import { Link } from "@tanstack/react-router";
import { FileText, LayoutDashboard, Monitor, Moon, Network, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "KPI Dashboard", icon: LayoutDashboard },
  { to: "/ingest", label: "Contract Ingest", icon: FileText },
  { to: "/tenants", label: "Tenant Configs", icon: Network },
] as const;

function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const opts: { v: ThemeMode; icon: typeof Sun; label: string }[] = [
    { v: "light", icon: Sun, label: "Light theme" },
    { v: "dark", icon: Moon, label: "Dark theme" },
    { v: "system", icon: Monitor, label: "System default theme" },
  ];
  return (
    <div role="radiogroup" aria-label="Color theme" className="inline-flex rounded-lg border bg-muted p-0.5">
      {opts.map(({ v, icon: Icon, label }) => (
        <button
          key={v}
          role="radio"
          aria-checked={mode === v}
          aria-label={label}
          title={label}
          onClick={() => setMode(v)}
          className={cn(
            "rounded-md p-1.5 text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            mode === v && "bg-card text-foreground shadow-sm",
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b bg-sidebar md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-2 p-4 md:block">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary font-mono text-sm font-bold text-primary-foreground">K</span>
            <span className="leading-tight">
              <span className="block text-sm font-bold">KPI Copilot</span>
              <span className="block text-[11px] text-muted-foreground">Client · Contract · KPI</span>
            </span>
          </Link>
          <div className="md:hidden"><ThemeToggle /></div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: true }}
              className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent !text-sidebar-foreground font-semibold" }}
            >
              <Icon className="h-4 w-4" /> {label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-4 left-4 hidden md:block"><ThemeToggle /></div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
