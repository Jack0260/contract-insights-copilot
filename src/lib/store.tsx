import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode } from "react";
import { generateTenant, parseContract, type Contract, type Tenant } from "./parser";
import { SAMPLES } from "./samples";

type State = { contracts: Contract[]; tenants: Tenant[] };
type Action =
  | { type: "add"; contract: Contract }
  | { type: "remove"; id: string }
  | { type: "togglePipeline"; tenantId: string; pipelineId: string }
  | { type: "reset" }
  | { type: "hydrate"; state: State };

const KEY = "kpi-copilot-db-v1";

function seed(): State {
  const contracts = SAMPLES.map((s, i) => ({ ...parseContract(s.text, s.name), createdAt: `2026-0${i + 7}-1${i}T09:00:00.000Z` }));
  return { contracts, tenants: contracts.map(generateTenant) };
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "add": {
      const contracts = [a.contract, ...s.contracts.filter((c) => c.id !== a.contract.id)];
      const tenants = [generateTenant(a.contract), ...s.tenants.filter((t) => t.contractId !== a.contract.id)];
      return { contracts, tenants };
    }
    case "remove":
      return { contracts: s.contracts.filter((c) => c.id !== a.id), tenants: s.tenants.filter((t) => t.contractId !== a.id) };
    case "togglePipeline":
      return {
        ...s,
        tenants: s.tenants.map((t) =>
          t.tenantId !== a.tenantId ? t : { ...t, pipelines: t.pipelines.map((p) => (p.id === a.pipelineId ? { ...p, enabled: !p.enabled } : p)) },
        ),
      };
    case "reset":
      return seed();
    case "hydrate":
      return a.state;
  }
}

const Ctx = createContext<{ state: State; dispatch: React.Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, seed);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as State;
        if (Array.isArray(parsed.contracts) && Array.isArray(parsed.tenants)) dispatch({ type: "hydrate", state: parsed });
      }
    } catch {
      /* corrupted storage: keep seed */
    }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (loaded.current) localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore outside provider");
  return v;
}

export const fmtMoney = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`;
