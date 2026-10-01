import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { AlertTriangle, DollarSign, Gauge, Network, Plus } from "lucide-react";
import { fmtMoney, useStore } from "@/lib/store";
import { series, type Contract } from "@/lib/parser";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KPI Dashboard — Contract KPI Copilot" },
      { name: "description", content: "Executive KPI dashboard generated from parsed client contracts." },
      { property: "og:title", content: "KPI Dashboard — Contract KPI Copilot" },
      { property: "og:description", content: "Executive KPI dashboard generated from parsed client contracts." },
    ],
  }),
  component: Dashboard,
});

const tip = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontSize: 12 } };
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function riskTone(r: number) {
  return r >= 70 ? "text-destructive" : r >= 45 ? "text-warning" : "text-success";
}

function Dashboard() {
  const { state } = useStore();
  const [tenant, setTenant] = useState("all");
  const [months, setMonths] = useState(12);
  const [selected, setSelected] = useState<Contract | null>(null);

  const contracts = tenant === "all" ? state.contracts : state.contracts.filter((c) => c.id === tenant);

  const trend = useMemo(() => {
    const rows: { month: string; revenue: number; uptime: number }[] = [];
    contracts.forEach((c) =>
      series(c, months).forEach((p, i) => {
        const row = (rows[i] ??= { month: p.month, revenue: 0, uptime: 0 });
        row.revenue += p.revenue;
        row.uptime += p.uptime / contracts.length;
      }),
    );
    return rows.map((r) => ({ ...r, uptime: +r.uptime.toFixed(2) }));
  }, [contracts, months]);

  const acv = contracts.reduce((s, c) => s + (c.value / c.termMonths) * 12, 0);
  const avgSla = contracts.length ? contracts.reduce((s, c) => s + c.sla, 0) / contracts.length : 0;
  const atRisk = contracts.filter((c) => c.risk >= 60).length;
  const tiers = ["Enterprise", "Growth", "Standard"].map((t) => ({ name: t, value: contracts.filter((c) => c.tier === t).length })).filter((t) => t.value);

  if (!state.contracts.length)
    return (
      <div className="surface mx-auto mt-20 max-w-md p-8 text-center">
        <h1 className="text-xl font-bold">No contracts yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ingest a contract to generate tenants and KPIs.</p>
        <Button asChild className="mt-4"><Link to="/ingest"><Plus className="h-4 w-4" /> Ingest contract</Link></Button>
      </div>
    );

  return (
    <div className="space-y-6">
      <header className="surface hero-glow flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-primary">Portfolio overview</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight md:text-3xl">Dynamic Client-Contract KPI Copilot</h1>
          <p className="mt-1 text-sm text-muted-foreground">{state.contracts.length} contracts · {state.tenants.length} provisioned tenants</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={tenant} onValueChange={setTenant}>
            <SelectTrigger className="w-52 bg-card" aria-label="Filter by client"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {state.contracts.map((c) => <SelectItem key={c.id} value={c.id}>{c.client}</SelectItem>)}
            </SelectContent>
          </Select>
          <div role="radiogroup" aria-label="Time range" className="inline-flex rounded-md border bg-card p-0.5">
            {[6, 12].map((m) => (
              <button key={m} role="radio" aria-checked={months === m} onClick={() => setMonths(m)}
                className={cn("rounded px-3 py-1.5 text-sm text-muted-foreground", months === m && "bg-primary text-primary-foreground")}>
                {m}M
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={DollarSign} label="Annualized value" value={fmtMoney(acv)} sub={`${contracts.length} contracts`} />
        <Stat icon={Gauge} label="Avg SLA target" value={`${avgSla.toFixed(2)}%`} sub="Committed uptime" />
        <Stat icon={AlertTriangle} label="At-risk contracts" value={String(atRisk)} sub="Risk score ≥ 60" tone={atRisk ? "text-destructive" : undefined} />
        <Stat icon={Network} label="Active pipelines" value={String(state.tenants.filter((t) => tenant === "all" || t.contractId === tenant).flatMap((t) => t.pipelines).filter((p) => p.enabled).length)} sub="Across tenants" />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Widget title="Recognized revenue" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={fmtMoney} width={56} />
              <Tooltip {...tip} formatter={(v: number) => fmtMoney(v)} />
              <Area type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </Widget>
        <Widget title="Tier mix">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={tiers} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                {tiers.map((_, i) => <Cell key={i} fill={COLORS[i]} stroke="var(--card)" />)}
              </Pie>
              <Tooltip {...tip} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-3 text-xs">
            {tiers.map((t, i) => <span key={t.name} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[i] }} />{t.name} ({t.value})</span>)}
          </div>
        </Widget>
        <Widget title="Measured uptime vs. SLA" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis domain={[98.5, 100]} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={44} />
              <Tooltip {...tip} formatter={(v: number) => `${v}%`} />
              <ReferenceLine y={+avgSla.toFixed(2)} stroke="var(--chart-4)" strokeDasharray="4 4" />
              <Bar dataKey="uptime" radius={[4, 4, 0, 0]}>
                {trend.map((r, i) => <Cell key={i} fill={r.uptime >= avgSla ? "var(--chart-1)" : "var(--chart-4)"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Widget>
        <Widget title="Risk radar">
          <ul className="space-y-3">
            {[...contracts].sort((a, b) => b.risk - a.risk).map((c) => (
              <li key={c.id}>
                <button onClick={() => setSelected(c)} className="w-full text-left">
                  <div className="flex justify-between text-sm"><span className="truncate font-medium">{c.client}</span><span className={cn("font-mono", riskTone(c.risk))}>{c.risk}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${c.risk}%` }} /></div>
                </button>
              </li>
            ))}
          </ul>
        </Widget>
      </section>

      <Widget title="Contract ledger">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>{["Client", "Tier", "Value", "Term", "SLA", "Payment", "Risk"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id} tabIndex={0} onClick={() => setSelected(c)} onKeyDown={(e) => e.key === "Enter" && setSelected(c)}
                  className="cursor-pointer border-t transition-colors hover:bg-muted focus:bg-muted focus:outline-none">
                  <td className="px-3 py-2.5 font-medium">{c.client}</td>
                  <td className="px-3"><Badge variant="secondary">{c.tier}</Badge></td>
                  <td className="px-3 font-mono">{fmtMoney(c.value)}</td>
                  <td className="px-3">{c.termMonths} mo</td>
                  <td className="px-3 font-mono">{c.sla}%</td>
                  <td className="px-3">Net {c.paymentDays}</td>
                  <td className={cn("px-3 font-mono font-semibold", riskTone(c.risk))}>{c.risk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Widget>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.client}</SheetTitle>
                <SheetDescription>{selected.name}</SheetDescription>
              </SheetHeader>
              <dl className="mt-4 grid grid-cols-2 gap-3 px-4 text-sm">
                {[["Vendor", selected.vendor], ["Effective", selected.effective], ["Region", selected.region], ["Governing law", selected.law], ["Auto-renew", selected.autoRenew ? "Yes" : "No"], ["Penalty", `${selected.penaltyPct}%`], ["Confidence", `${selected.confidence}%`], ["Risk", String(selected.risk)]].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-muted p-2"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
                ))}
              </dl>
              <h3 className="mt-6 px-4 text-sm font-semibold">Extracted obligations</h3>
              <ul className="mt-2 space-y-2 px-4 pb-6 text-sm text-muted-foreground">
                {selected.obligations.map((o, i) => <li key={i} className="border-l-2 border-primary pl-3">{o}</li>)}
              </ul>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, tone }: { icon: typeof Gauge; label: string; value: string; sub: string; tone?: string | undefined }) {
  return (
    <div className="surface p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">{label}<Icon className="h-4 w-4 text-primary" /></div>
      <div className={cn("mt-2 font-mono text-2xl font-semibold", tone)}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function Widget({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("surface p-5", className)}>
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}
