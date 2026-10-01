import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useStore, fmtMoney } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tenants")({
  head: () => ({
    meta: [
      { title: "Tenant Configs — Contract KPI Copilot" },
      { name: "description", content: "Auto-generated multi-tenant pipeline configurations per client contract." },
      { property: "og:title", content: "Tenant Configs — Contract KPI Copilot" },
      { property: "og:description", content: "Auto-generated multi-tenant pipeline configurations per client contract." },
    ],
  }),
  component: Tenants,
});

function Tenants() {
  const { state, dispatch } = useStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = state.tenants.find((t) => t.tenantId === activeId) ?? state.tenants[0];
  const contract = active && state.contracts.find((c) => c.id === active.contractId);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-primary">Step 2 · Provision</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Multi-tenant configs</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => { dispatch({ type: "reset" }); setActiveId(null); toast.success("Mock database reset to seed data"); }}>
          <RotateCcw className="h-4 w-4" /> Reset database
        </Button>
      </header>

      {!active || !contract ? (
        <div className="surface p-8 text-center text-sm text-muted-foreground">No tenants. <Link to="/ingest" className="text-primary underline">Ingest a contract</Link>.</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <ul className="space-y-2">
            {state.tenants.map((t) => {
              const c = state.contracts.find((x) => x.id === t.contractId);
              return (
                <li key={t.tenantId}>
                  <button onClick={() => setActiveId(t.tenantId)} className={cn("surface w-full p-3 text-left transition-colors", t.tenantId === active.tenantId && "ring-2 ring-primary")}>
                    <div className="font-semibold">{c?.client}</div>
                    <div className="font-mono text-xs text-muted-foreground">{t.tenantId} · {t.region}</div>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="space-y-6">
            <section className="surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold">{contract.client}</h2>
                  <p className="font-mono text-xs text-muted-foreground">{active.slug}.copilot.app · {active.isolation} · retention {active.retentionDays}d</p>
                </div>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { dispatch({ type: "remove", id: contract.id }); setActiveId(null); toast("Tenant and contract removed"); }}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                {active.kpis.map((k) => (
                  <div key={k.key} className="rounded-lg bg-muted p-3">
                    <div className="text-xs text-muted-foreground">{k.label}</div>
                    <div className="font-mono text-lg font-semibold">{k.unit === "$" ? fmtMoney(k.target) : `${k.target}${k.unit === "%" ? "%" : " " + k.unit}`}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="surface p-5">
              <h3 className="mb-3 text-sm font-semibold">Data pipelines</h3>
              <ul className="divide-y">
                {active.pipelines.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-medium">{p.name}<Badge variant={p.enabled ? "default" : "secondary"}>{p.enabled ? "live" : "paused"}</Badge></div>
                      <div className="truncate font-mono text-xs text-muted-foreground">{p.source} → {p.transform} · {p.schedule}</div>
                    </div>
                    <Switch checked={p.enabled} aria-label={`Toggle ${p.name}`} onCheckedChange={() => dispatch({ type: "togglePipeline", tenantId: active.tenantId, pipelineId: p.id })} />
                  </li>
                ))}
              </ul>
            </section>

            <section className="surface p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Generated config (JSON)</h3>
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(JSON.stringify(active, null, 2)).then(() => toast.success("Copied"), () => toast.error("Clipboard unavailable"))}>
                  <Copy className="h-4 w-4" /> Copy
                </Button>
              </div>
              <pre className="max-h-80 overflow-auto rounded-lg bg-muted p-4 font-mono text-xs">{JSON.stringify(active, null, 2)}</pre>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
