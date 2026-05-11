// Utilities for the Alocação module.

export const FUNDOS = [
  { key: "TOP_CP", label: "TOP CP", source: "BUTIÁ TOP MASTER FI RENDA FIXA CRÉDITO PRIVADO" },
  { key: "TOP_PREV", label: "TOP PREV", source: "BUTIA TOP PREV FIFE FIRF CP" },
  { key: "PLUS_CP_RF", label: "PLUS CP RF", source: "Butiá Plus Crédito Privado FI RF LP" },
  { key: "Debentures_INFRA_RF", label: "Debêntures Infra", source: "BUTIÁ DEBÊNTURES FI INFRA RENDA FIXA LP" },
] as const;

export type FundoKey = typeof FUNDOS[number]["key"];

export const ALERT_THRESHOLD = 0.8; // 80% of consumption

export function fundoFromSource(source: string | null | undefined): FundoKey | null {
  if (!source) return null;
  const normalized = source.trim().toUpperCase();
  for (const f of FUNDOS) {
    if (f.source.toUpperCase() === normalized) return f.key;
  }
  return null;
}

export function sourceFromFundo(fundo: FundoKey): string {
  return FUNDOS.find(f => f.key === fundo)!.source;
}

// Map product / product_class to a tipo_ativo recognised by allocation_limits.
export function tipoAtivoFromProduct(product: string, productClass: string): string {
  const p = (product || "").toLowerCase();
  const c = (productClass || "").toLowerCase();
  if (!p && !c) return "Outros";

  // FIDC (none in db today, but reserved)
  if (p.includes("fidc")) {
    if (p.includes("sub") || p.includes("mz") || p.includes("jr")) return "FIDC Subordinado";
    if (p.includes("np")) return "FIDC NP";
    return "FIDC Cota Sênior";
  }
  if (p.includes("debenture")) return "Crédito Corporativo";
  if (p.includes("nota promissoria") || p.includes("nota promissória") || p === "np") return "Crédito Corporativo";
  if (p.includes("cdb") || p.includes("letra financeira") || p.includes("lf ") || p.includes(" lf")) return "Crédito Financeiro";
  if (p.includes("funds")) return "Cotas de Fundos CP";
  if (p.includes("termo")) return "Termo > 60 dias"; // we don't know prazo here; fallback
  if (p.includes("lft") || p.includes("overnight") || p.includes("compromiss") || p.includes("dap") || p.includes("ntn") || p.includes("ltn")) {
    return "Caixa Mínimo";
  }
  if (p.includes("equity") || p.includes("bdr")) return "Outros";
  return "Outros";
}

// Map sub_indexador (trade_ativos) into limit subcategoria.
export function indexadorFromSub(sub: string | null | undefined): string {
  if (!sub) return "Outros";
  const s = sub.toUpperCase();
  if (s === "DI_SPREAD") return "CDI+";
  if (s === "CDI_PCT") return "%CDI";
  if (s === "IPCA") return "IPCA";
  if (s === "PRE") return "Pré";
  if (s === "SELIC" || s === "SELIC_PCT") return "%Selic";
  if (s === "CAMBIAL" || s === "USD") return "Cambial";
  return "Outros";
}

// Bucket rating string (e.g. 'AAA(bra)', 'brAA+', 'A-') to one of:
// AAA, AA, A, BBB, <BBB, Sem Rating
export function ratingBucket(rating: string | null | undefined): string {
  if (!rating) return "Sem Rating";
  const r = rating.toUpperCase().replace(/\(.*?\)/g, "").replace(/^BR/, "").trim();
  if (!r) return "Sem Rating";
  if (r.startsWith("AAA")) return "AAA";
  if (r.startsWith("AA")) return "AA";
  if (r.startsWith("A")) return "A";
  if (r.startsWith("BBB")) return "BBB";
  if (/^(BB|B|CCC|CC|C|D)/.test(r)) return "<BBB";
  return "Sem Rating";
}

// Order of badness (worst first). We pick the worst of a group.
const RATING_ORDER = ["<BBB", "BBB", "Sem Rating", "A", "AA", "AAA"];
export function worstRating(buckets: string[]): string {
  for (const r of RATING_ORDER) {
    if (buckets.includes(r)) return r;
  }
  return "Sem Rating";
}

export type StatusKind = "EXCEDIDO" | "ALERTA" | "OK" | "SEM_LIMITE" | "AGUARDANDO";

export function computeStatus(posicaoPct: number, limitePct: number | null, hasData: boolean): StatusKind {
  if (limitePct == null) return "SEM_LIMITE";
  if (!hasData) return "AGUARDANDO";
  if (posicaoPct > limitePct) return "EXCEDIDO";
  if (posicaoPct > limitePct * ALERT_THRESHOLD) return "ALERTA";
  return "OK";
}

export const STATUS_LABEL: Record<StatusKind, string> = {
  EXCEDIDO: "Excedido",
  ALERTA: "Alerta",
  OK: "OK",
  SEM_LIMITE: "Sem limite",
  AGUARDANDO: "Aguardando dados",
};

export const STATUS_BADGE_CLASS: Record<StatusKind, string> = {
  EXCEDIDO: "bg-destructive text-destructive-foreground",
  ALERTA: "bg-amber-500 text-white",
  OK: "bg-emerald-600 text-white",
  SEM_LIMITE: "bg-muted text-muted-foreground",
  AGUARDANDO: "bg-muted text-muted-foreground",
};

export function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v == null || isNaN(v as any)) return "—";
  return `${Number(v).toFixed(digits)}%`;
}
