import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { CheckCircle2, FileUp, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { parseContract, generateTenant, type Contract } from "@/lib/parser";
import { SAMPLES } from "@/lib/samples";
import { fmtMoney, useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ingest")({
  head: () => ({
    meta: [
      { title: "Contract Ingest — Contract KPI Copilot" },
      { name: "description", content: "Upload or paste contracts to extract terms, SLAs and obligations." },
      { property: "og:title", content: "Contract Ingest — Contract KPI Copilot" },
      { property: "og:description", content: "Upload or paste contracts to extract terms, SLAs and obligations." },
    ],
  }),
  component: Ingest,
});

const STAGES = ["Tokenizing document", "Detecting clauses", "Extracting entities & terms", "Scoring risk", "Synthesizing KPIs"];

function Ingest() {
  const { dispatch } = useStore();
  const nav = useNavigate();
  const [text, setText] = useState("");
  const [name, setName] = useState("Pasted_contract.txt");
  const [drag, setDrag] = useState(false);
  const [stage, setStage] = useState(-1);
  const [result, setResult] = useState<Contract | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const readFile = (f: File) => {
    if (f.size > 2_000_000) { toast.error("File too large (max 2 MB)"); return; }
    setResult(null);
    setName(f.name);
    if (/\.(txt|md|csv|json|html?)$/i.test(f.name) || f.type.startsWith("text/")) {
      const r = new FileReader();
      r.onload = () => { setText(String(r.result)); toast.success(`Loaded ${f.name}`); };
      r.onerror = () => toast.error("Could not read file");
      r.readAsText(f);
    } else {
      const s = SAMPLES[f.size % SAMPLES.length] ?? SAMPLES[0]!;
      setText(`[Simulated OCR of ${f.name}]\n\n${s.text}`);
      toast.info("Binary document detected — simulated OCR text extracted");
    }
  };

  const run = async () => {
    if (text.trim().length < 40) { toast.error("Please provide at least 40 characters of contract text"); return; }
    setResult(null);
    for (let i = 0; i < STAGES.length; i++) {
      setStage(i);
      await new Promise((r) => setTimeout(r, 380));
    }
    setStage(STAGES.length);
    setResult(parseContract(text, name));
  };

  const provision = () => {
    if (!result) return;
    dispatch({ type: "add", contract: result });
    toast.success(`Tenant ${generateTenant(result).tenantId} provisioned for ${result.client}`);
    nav({ to: "/tenants" });
  };

  const running = stage >= 0 && stage < STAGES.length;

  return (
    <div className="space-y-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-widest text-primary">Step 1 · Parse</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Contract ingest</h1>
        <p className="text-sm text-muted-foreground">Drop a contract, paste text, or load a sample. The parser extracts terms and proposes a tenant config.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface space-y-4 p-5">
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload contract file"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) readFile(f); }}
            className={cn("grid cursor-pointer place-items-center rounded-xl border-2 border-dashed p-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", drag ? "border-primary bg-accent" : "hover:bg-muted")}
          >
            <FileUp className="h-8 w-8 text-primary" />
            <p className="mt-2 text-sm font-medium">Drop file or click to browse</p>
            <p className="text-xs text-muted-foreground">.txt, .md read directly · PDF/DOCX via simulated OCR</p>
            <input ref={inputRef} type="file" className="hidden" accept=".txt,.md,.pdf,.docx,.doc,.html,.json" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ""; }} />
          </div>
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((s) => (
              <Button key={s.name} size="sm" variant="outline" onClick={() => { setText(s.text); setName(s.name); setResult(null); setStage(-1); }}>{s.name.split("_")[0]} sample</Button>
            ))}
          </div>
          <div>
            <label htmlFor="ctext" className="text-xs font-medium text-muted-foreground">Contract text · <span className="font-mono">{name}</span></label>
            <Textarea id="ctext" value={text} onChange={(e) => { setText(e.target.value); setResult(null); }} rows={12} className="mt-1 font-mono text-xs" placeholder="This Agreement is made between ... and ..." />
          </div>
          <Button onClick={run} disabled={running} className="w-full">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Parse contract
          </Button>
        </section>

        <section className="surface p-5">
          <h2 className="text-sm font-semibold">Parser pipeline</h2>
          <Progress value={stage < 0 ? 0 : Math.min(100, ((stage + (running ? 0.5 : 0)) / STAGES.length) * 100)} className="mt-3" />
          <ol className="mt-4 space-y-2 text-sm">
            {STAGES.map((s, i) => (
              <li key={s} className={cn("flex items-center gap-2", i > stage && "text-muted-foreground")}>
                {i < stage ? <CheckCircle2 className="h-4 w-4 text-success" /> : i === stage ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <span className="h-4 w-4 rounded-full border" />}
                {s}
              </li>
            ))}
          </ol>

          {result && (
            <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">{result.client}</h3>
                <span className="font-mono text-xs text-muted-foreground">confidence {result.confidence}%</span>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                {[["Value", fmtMoney(result.value)], ["Term", `${result.termMonths} mo`], ["SLA", `${result.sla}%`], ["Payment", `Net ${result.paymentDays}`], ["Penalty", `${result.penaltyPct}%`], ["Region", result.region], ["Tier", result.tier], ["Law", result.law], ["Risk", String(result.risk)]].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-muted p-2"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="truncate font-medium">{v}</dd></div>
                ))}
              </dl>
              <Button onClick={provision} className="w-full">Provision tenant & KPIs</Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
