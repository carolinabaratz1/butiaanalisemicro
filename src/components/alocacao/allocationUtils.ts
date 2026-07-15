// Utilities for the Alocação module.

export const FUNDOS = [
  { key: "TOP_CP", label: "TOP CP", source: "BUTIÁ TOP MASTER FI RENDA FIXA CRÉDITO PRIVADO" },
  { key: "TOP_PREV", label: "TOP PREV", source: "BUTIA TOP PREV FIFE FIRF CP" },
  { key: "PLUS_CP_RF", label: "PLUS CP RF", source: "Butiá Plus Crédito Privado FI RF LP" },
  { key: "Debentures_INFRA_RF", label: "Debêntures Infra", source: "BUTIÁ DEBÊNTURES FI INFRA RENDA FIXA LP" },
] as const;

export type FundoKey = typeof FUNDOS[number]["key"];

export const ALERT_THRESHOLD = 0.8; // 80% of consumption

// Tipos que somam em "Crédito Privado"
export const CREDITO_PRIVADO_TIPOS = new Set<string>([
  "Crédito Corporativo",
  "Crédito Financeiro",
  "FIDC Cota Sênior",
  "FIDC Mezanino",
  "FIDC NP",
]);

// Cotas de Fundos CP -> classificadas como FIDC pela tabela fidc_classes (por ISIN).
export type FidcClasse = "Sênior" | "Mezanino" | "NP";
export function fidcTipoFromClasse(c: FidcClasse | null | undefined): string {
  if (c === "Mezanino") return "FIDC Mezanino";
  if (c === "NP") return "FIDC NP";
  if (c === "Sênior") return "FIDC Cota Sênior";
  // Sem classificação: tratamos como Cotas de Fundos CP (não entra em Crédito Privado).
  return "Cotas de Fundos CP";
}

// Tesouro Nacional - identificação por nome (case-insensitive). CNPJ pode variar.
const TESOURO_REGEX = /tesouro\s*nacional/i;
export function isTesouroNacional(nome?: string | null): boolean {
  if (!nome) return false;
  return TESOURO_REGEX.test(nome);
}

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

// DAP / Futuro -> excluídos do PL e de toda agregação
export function isExcludedFromPL(product: string, productClass: string): boolean {
  const p = (product || "").toLowerCase();
  const c = (productClass || "").toLowerCase();
  if (p.includes("dap") || c.includes("dap")) return true;
  if (p.includes("futur") || c.includes("futur")) return true;
  return false;
}

export function isTermo(product: string, productClass: string): boolean {
  const p = (product || "").toLowerCase();
  const c = (productClass || "").toLowerCase();
  return p.includes("termo") || c.includes("termo");
}

// ── Emissor sintético por tipo de produto ──
// Alguns produtos não têm emissor real na carteira, mas devem ser
// tratados de forma padronizada em toda a aplicação (Posições, Exposição,
// Alocação). Retorna null quando o produto é comum (segue o fluxo normal).
export const B3_CNPJ = "09.346.601/0001-25";
export const TESOURO_CNPJ = "00.394.460/0001-41";

export interface SyntheticIssuer {
  cnpj: string;
  nome: string;
  grupoEconomico: string;
  setor: string;
  rating: string; // rótulo a exibir (pode ser "Soberano" ou a rating real)
  ratingBucket: "AAA"; // bucket usado para limites/worstRating
  isSoberano: boolean;
  isTermo: boolean;
}

function isOvernightProduct(product: string, productClass: string): boolean {
  const p = (product || "").toLowerCase();
  const c = (productClass || "").toLowerCase();
  return p.includes("overnight") || c.includes("overnight") ||
    p.includes("compromiss") || c.includes("compromiss");
}

function isLftProduct(product: string, productClass: string): boolean {
  const p = (product || "").toLowerCase();
  const c = (productClass || "").toLowerCase();
  return p.includes("lft") || c === "lft";
}

export function synthesizeIssuerFromProduct(
  product: string | null | undefined,
  productClass: string | null | undefined,
): SyntheticIssuer | null {
  const prod = product ?? "";
  const cls = productClass ?? "";
  if (isTermo(prod, cls)) {
    return {
      cnpj: B3_CNPJ,
      nome: "B3",
      grupoEconomico: "TERMO",
      setor: "Financeiro",
      rating: "AAA",
      ratingBucket: "AAA",
      isSoberano: false,
      isTermo: true,
    };
  }
  if (isOvernightProduct(prod, cls) || isLftProduct(prod, cls)) {
    return {
      cnpj: TESOURO_CNPJ,
      nome: "TESOURO NACIONAL",
      grupoEconomico: "CAIXA",
      setor: "Título Público",
      rating: "Soberano",
      ratingBucket: "AAA",
      isSoberano: true,
      isTermo: false,
    };
  }
  return null;
}

// Map product / product_class to a tipo_ativo recognised by allocation_limits.
export function tipoAtivoFromProduct(product: string, productClass: string): string {
  const p = (product || "").toLowerCase();
  const c = (productClass || "").toLowerCase();
  if (!p && !c) return "Outros";

  if (p.includes("fidc")) {
    if (p.includes("sub") || p.includes("mz") || p.includes("mezan") || p.includes("jr")) return "FIDC Mezanino";
    if (p.includes("np")) return "FIDC NP";
    return "FIDC Cota Sênior";
  }
  if (p.includes("debenture")) return "Crédito Corporativo";
  if (p.includes("nota promissoria") || p.includes("nota promissória") || p === "np") return "Crédito Corporativo";
  if (p.includes("cdb") || p.includes("letra financeira") || p.includes("lf ") || p.includes(" lf") || p.includes("lci") || p.includes("lca")) return "Crédito Financeiro";
  if (p.includes("funds")) return "Cotas de Fundos CP";
  if (p.includes("termo")) return "Termo ≤ 60 dias";
  if (p.includes("overnight") || p.includes("compromiss")) return "Compromissadas (Overnight)";
  if (p.includes("lft") || p.includes("ntn") || p.includes("ltn")) {
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

// Tenta inferir indexador a partir da descrição do produto (CDB, LF, etc.) quando não há sub_indexador.
export function indexadorFromProductFallback(product: string): string | null {
  const p = (product || "").toUpperCase();
  if (!p) return null;
  // ordem importa
  if (/IPCA\s*\+/.test(p)) return "IPCA";
  if (/%\s*(DO\s+)?(CDI|DI)\b/.test(p) || /\bCDI\s*PCT\b/.test(p)) return "%CDI";
  if (/(CDI|DI)\s*\+/.test(p)) return "CDI+";
  if (/%\s*SELIC\b/.test(p) || /\bSELIC\s*PCT\b/.test(p)) return "%Selic";
  if (/\bSELIC\b/.test(p)) return "%Selic";
  if (/\bPR[ÉE]\b/.test(p) || /PRE-?FIXAD/.test(p)) return "Pré";
  return null;
}

// Indexador final aplicando regras de produto antes do sub_indexador.
export function resolveIndexador(product: string, productClass: string, sub: string | null | undefined): string {
  const p = (product || "").toLowerCase();
  // Termo -> Pré
  if (p.includes("termo")) return "Pré";
  // LFT / Overnight / Compromissadas -> %Selic
  if (p.includes("lft") || p.includes("overnight") || p.includes("compromiss")) return "%Selic";
  // FIDC -> CDI+
  if (p.includes("fidc")) return "CDI+";
  // Tem sub_indexador (caso típico de debêntures e ativos cadastrados)
  if (sub) return indexadorFromSub(sub);
  // Fallback parsing da descrição (CDB, LF, LCI, LCA)
  const fb = indexadorFromProductFallback(product);
  if (fb) return fb;
  return "Outros";
}

// Bucket rating string (e.g. 'AAA(bra)', 'brAA+', 'A-') to one of:
// AAA, AA, A, BBB, <BBB, Sem Rating
export function ratingBucket(rating: string | null | undefined): string {
  if (!rating) return "Sem Rating";
  if (/soberano/i.test(rating)) return "AAA"; // Tesouro/Overnight/LFT → tratado como AAA
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
