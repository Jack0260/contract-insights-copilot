export type Contract = {
  id: string;
  name: string;
  client: string;
  vendor: string;
  value: number;
  termMonths: number;
  effective: string;
  paymentDays: number;
  sla: number;
  penaltyPct: number;
  autoRenew: boolean;
  law: string;
  region: "US" | "EU" | "APAC";
  tier: "Enterprise" | "Growth" | "Standard";
  obligations: string[];
  risk: number;
  confidence: number;
  createdAt: string;
};

export type Pipeline = { id: string; name: string; source: string; schedule: string; transform: string; enabled: boolean };
export type Kpi = { key: string; label: string; target: number; unit: string };
export type Tenant = {
  tenantId: string;
  contractId: string;
  slug: string;
  region: string;
  isolation: string;
  retentionDays: number;
  pipelines: Pipeline[];
  kpis: Kpi[];
};

export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function num(str: string | undefined, fallback: number) {
  if (!str) return fallback;
  const n = parseFloat(str.replace(/,/g, ""));
  return isNaN(n) ? fallback : n;
}

export function parseContract(text: string, name: string): Contract {
  const t = text.replace(/\s+/g, " ");
  const parties = t.match(/between\s+([A-Z][\w&.,' -]+?)\s*\(.*?\)?\s*and\s+([A-Z][\w&.,' -]+?)(?:\s*\(|,|\.)/i);
  const client = parties?.[2]?.trim() || t.match(/client[:\s]+([A-Z][\w&. -]+)/i)?.[1]?.trim() || "Unknown Client";
  const vendor = parties?.[1]?.trim() || "Provider";
  const valueM = t.match(/\$\s?([\d,]+(?:\.\d+)?)\s*(million|m|k)?/i);
  let value = num(valueM?.[1], 120000);
  if (valueM?.[2]) value *= /m/i.test(valueM[2]) ? 1_000_000 : 1000;
  const termM = t.match(/(\d+)\s*\(?\w*\)?\s*(months?|years?)/i);
  const termMonths = termM ? num(termM[1], 12) * (/year/i.test(termM[2]) ? 12 : 1) : 12;
  const effective = t.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || t.match(/effective\s+(?:as of\s+)?([A-Z][a-z]+ \d{1,2},? \d{4})/i)?.[1] || "2026-01-01";
  const paymentDays = num(t.match(/net\s*-?\s*(\d+)/i)?.[1] || t.match(/within\s+(\d+)\s+days/i)?.[1], 30);
  const sla = num(t.match(/(\d{2}(?:\.\d+)?)\s*%\s*(?:uptime|availability)/i)?.[1] || t.match(/(?:uptime|availability)[^.]*?(\d{2}(?:\.\d+)?)\s*%/i)?.[1], 99.5);
  const penaltyPct = num(t.match(/(?:credit|penalt\w*)[^.]*?(\d{1,2})\s*%/i)?.[1], 5);
  const autoRenew = /auto(?:matically)?[- ]?renew/i.test(t);
  const law = t.match(/laws? of (?:the )?(?:State of )?([A-Z][a-zA-Z ]+?)(?:\.|,)/)?.[1]?.trim() || "Delaware";
  const region: Contract["region"] = /GDPR|EU|Germany|France|Ireland|England/i.test(t) ? "EU" : /Singapore|Japan|Australia|APAC|India/i.test(t) ? "APAC" : "US";
  const obligations = (t.match(/[^.]*\bshall\b[^.]*\./gi) || []).slice(0, 6).map((s) => s.trim());
  const tier: Contract["tier"] = value >= 1_000_000 ? "Enterprise" : value >= 250_000 ? "Growth" : "Standard";
  let risk = 20;
  if (sla >= 99.9) risk += 20;
  if (penaltyPct >= 10) risk += 20;
  if (paymentDays >= 60) risk += 15;
  if (!autoRenew) risk += 10;
  if (/unlimited liability|indemnif/i.test(t)) risk += 15;
  risk = Math.min(95, risk);
  const found = [parties, valueM, termM, sla, obligations.length].filter(Boolean).length;
  const id = "c_" + hash(name + text.length + client).toString(36);
  return {
    id, name, client, vendor, value, termMonths, effective, paymentDays, sla, penaltyPct, autoRenew, law, region, tier,
    obligations: obligations.length ? obligations : ["No explicit 'shall' obligations detected — manual review recommended."],
    risk, confidence: Math.min(98, 60 + found * 7 + (hash(text) % 5)), createdAt: new Date().toISOString(),
  };
}

export function generateTenant(c: Contract): Tenant {
  const slug = c.client.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "tenant";
  const tenantId = "tn_" + (hash(c.id) % 1e6).toString().padStart(6, "0");
  return {
    tenantId,
    contractId: c.id,
    slug,
    region: c.region === "EU" ? "eu-central-1" : c.region === "APAC" ? "ap-southeast-1" : "us-east-1",
    isolation: c.tier === "Enterprise" ? "dedicated-database" : c.tier === "Growth" ? "dedicated-schema" : "shared-row-level",
    retentionDays: c.region === "EU" ? 365 : 730,
    pipelines: [
      { id: "p1", name: "Invoice ingestion", source: "billing.invoices", schedule: c.tier === "Enterprise" ? "*/15 * * * *" : "0 * * * *", transform: `net_${c.paymentDays}_aging`, enabled: true },
      { id: "p2", name: "SLA telemetry", source: "observability.uptime", schedule: "*/5 * * * *", transform: `sla_threshold_${c.sla}`, enabled: true },
      { id: "p3", name: "Penalty accrual", source: "derived.sla_breaches", schedule: "0 0 * * *", transform: `credit_${c.penaltyPct}pct`, enabled: c.penaltyPct > 0 },
      { id: "p4", name: "Renewal watcher", source: "contracts.terms", schedule: "0 6 * * 1", transform: c.autoRenew ? "auto_renew_notice_60d" : "manual_renewal_alert_90d", enabled: true },
    ],
    kpis: [
      { key: "acv", label: "Annual contract value", target: Math.round((c.value / c.termMonths) * 12), unit: "$" },
      { key: "sla", label: "SLA compliance", target: c.sla, unit: "%" },
      { key: "dso", label: "Days sales outstanding", target: c.paymentDays, unit: "days" },
      { key: "credits", label: "Credit exposure", target: c.penaltyPct, unit: "%" },
    ],
  };
}

/** Deterministic monthly series for KPI visuals */
export function series(c: Contract, months: number) {
  const out = [];
  const monthly = c.value / c.termMonths;
  let seed = hash(c.id);
  const rnd = () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0) % 1000) / 1000;
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (let i = 0; i < months; i++) {
    out.push({
      month: names[(i + 10 - months + 24) % 12] ?? "",
      revenue: Math.round(monthly * (0.85 + rnd() * 0.3)),
      uptime: +(c.sla - 0.4 + rnd() * 0.8).toFixed(2),
    });
  }
  return out;
}
