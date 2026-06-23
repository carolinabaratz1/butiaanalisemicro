// Dados mock do FIDC Monitor enquanto as tabelas reais (fidcs, fidc_monthly_reports etc.)
// estão vazias. Estrutura preservada do projeto origem para que as telas portadas
// renderizem sem alterações. Trocar por queries Supabase quando houver dados.
import { DEFAULT_THRESHOLDS, evalStatus, worstStatus, type RiskStatus, type ThresholdRule } from "./metrics";

export type Portfolio = { id: string; name: string; description: string; nav: number; lastNavDate: string };
export type Fidc = {
  id: string; name: string; legalName: string; cnpj: string; administrator: string;
  manager: string; custodian: string; consultant: string; auditor: string;
  collectionAgent: string; mainOriginator: string; sector: string; strategy: string;
  fidcType: string; condominium: "Aberto" | "Fechado"; status: "Ativo" | "Inativo" | "Em revisão";
  startDate: string; rating: string; ratingAgency: string;
};
export type QuotaClass = {
  id: string; fidcId: string; isin: string; internalName: string; cvmName: string;
  className: string; series: string; type: "Sênior" | "Mezanino" | "Subordinada";
  seniority: number; benchmark: string; targetSpread: string; rating: string;
};
export type MonthlyReport = {
  fidcId: string; month: string; nav: number; quotaValue: number; creditRights: number;
  overdue: number; pdd: number; cash: number; repurchase: number; subordinated: number; investors: number;
};
export type Position = { portfolioId: string; fidcId: string; quotaClassId: string; isin: string; value: number };

export const PORTFOLIOS: Portfolio[] = [
  { id: "p1", name: "BUTIÁ TOP", description: "Multimercado crédito high yield", nav: 1_482_300_000, lastNavDate: "2025-06-13" },
  { id: "p2", name: "BUTIÁ TOP PREV", description: "Previdência crédito privado", nav: 892_540_000, lastNavDate: "2025-06-13" },
  { id: "p3", name: "BUTIÁ PLUS", description: "Crédito estruturado / FIDCs sênior", nav: 624_180_000, lastNavDate: "2025-06-13" },
];

const ADMINS = ["BRL Trust DTVM", "Singulare", "Oliveira Trust", "Vórtx DTVM", "Planner Trustee"];
const MANAGERS = ["Empírica Investimentos", "Solis Investimentos", "Captalys", "Multiplica Capital", "RB Capital", "Polo Capital", "Galapagos Capital"];
const CUSTODIANS = ["Itaú DTVM", "Bradesco S/A", "BTG Pactual", "Santander", "BRL Trust"];
const SECTORS = ["Multissetorial", "Crédito Consignado", "Cartão de Crédito", "Agronegócio", "Recebíveis Comerciais", "Veículos", "Imobiliário", "Pulverizado PJ"];

const FIDC_NAMES = [
  "Empírica Goal", "Solis Capital Giro", "Captalys Capital", "RB High Income", "Polo Multissetorial",
  "Galapagos Recebíveis", "Multiplica Agro", "Ourinvest Consignado", "Valor Capital", "Riza Performance",
  "Iridium Cartão", "Vert Pulverizado", "More Crédito", "Vinci Recebíveis", "Tarpon Originação",
  "JGP Crédito", "SPX Senior", "Kinea High Grade", "Vinland PME", "AZ Quest Sólido",
  "Tribeca Veículos", "Bocaina Imobiliário",
];

let cnpjSeed = 11000000;
const fakeCnpj = () => {
  cnpjSeed += 137;
  const s = String(cnpjSeed).padStart(8, "0");
  return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/0001-${String((cnpjSeed * 7) % 100).padStart(2, "0")}`;
};
const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];

export const FIDCS: Fidc[] = FIDC_NAMES.map((name, i) => ({
  id: `f${i + 1}`,
  name: `FIDC ${name}`,
  legalName: `Fundo de Investimento em Direitos Creditórios ${name}`,
  cnpj: fakeCnpj(),
  administrator: pick(ADMINS, i),
  manager: pick(MANAGERS, i + 1),
  custodian: pick(CUSTODIANS, i),
  consultant: i % 3 === 0 ? pick(MANAGERS, i) : "—",
  auditor: i % 2 === 0 ? "KPMG" : "PwC",
  collectionAgent: pick(["Mais Cobrança", "Recovery do Brasil", "Cobrança própria"], i),
  mainOriginator: `${pick(["Originadora", "Cedente", "Plataforma"], i)} ${name.split(" ")[0]}`,
  sector: pick(SECTORS, i),
  strategy: i % 2 === 0 ? "Pulverizado high yield" : "Concentrado high grade",
  fidcType: "FIDC NP",
  condominium: i % 4 === 0 ? "Aberto" : "Fechado",
  status: "Ativo",
  startDate: `${2018 + (i % 6)}-0${(i % 9) + 1}-15`,
  rating: pick(["AAA(bra)", "AA+(bra)", "AA(bra)", "AA-(bra)", "A+(bra)", "A(bra)", "A-(bra)", "BBB+(bra)"], i),
  ratingAgency: pick(["Fitch", "S&P", "Moody's", "Liberum"], i),
}));

export const QUOTA_CLASSES: QuotaClass[] = FIDCS.flatMap((f, i) => {
  const senior: QuotaClass = {
    id: `q${f.id}s`, fidcId: f.id,
    isin: `BRFID${f.id.toUpperCase()}CTF00${i % 10}`,
    internalName: `${f.name.replace("FIDC ", "")} - Sênior`,
    cvmName: `${f.name} - Cota Sênior Série Única`,
    className: "Sênior", series: "Única", type: "Sênior", seniority: 1,
    benchmark: i % 2 === 0 ? "CDI" : "IPCA",
    targetSpread: i % 2 === 0 ? "CDI + 3,5%" : "IPCA + 9%",
    rating: f.rating,
  };
  if (i % 3 === 0) {
    return [senior, {
      id: `q${f.id}m`, fidcId: f.id,
      isin: `BRFID${f.id.toUpperCase()}CTM00${i % 10}`,
      internalName: `${f.name.replace("FIDC ", "")} - Mezanino`,
      cvmName: `${f.name} - Cota Mezanino`,
      className: "Mezanino", series: "1ª", type: "Mezanino", seniority: 2,
      benchmark: "CDI", targetSpread: "CDI + 6%", rating: "A(bra)",
    }];
  }
  return [senior];
});

const MONTHS = (() => {
  const arr: string[] = [];
  const d = new Date(2025, 4, 1);
  for (let i = 11; i >= 0; i--) {
    const dd = new Date(d.getFullYear(), d.getMonth() - i, 1);
    arr.push(`${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}`);
  }
  return arr;
})();
export const REFERENCE_MONTHS = MONTHS;
export const LATEST_MONTH = MONTHS[MONTHS.length - 1];

const seedRand = (seed: number) => { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
const PROFILE = [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3];

export const MONTHLY_REPORTS: MonthlyReport[] = FIDCS.flatMap((f, i) => {
  const rnd = seedRand(i * 31 + 7);
  const profile = PROFILE[i];
  const baseNav = 80_000_000 + (i * 23_500_000);
  let quota = 1 + rnd() * 0.2;
  return MONTHS.map((m, mi) => {
    const navDrift = (rnd() - 0.5) * 0.03 + (profile === 3 ? -0.015 : profile === 2 ? -0.005 : 0.008);
    const nav = baseNav * (1 + navDrift * (mi + 1));
    quota *= 1 + (profile === 3 ? -0.002 + (rnd() - 0.7) * 0.005 : profile === 2 ? 0.002 + rnd() * 0.003 : 0.007 + rnd() * 0.004);
    const dc = nav * (0.78 + rnd() * 0.12);
    const overdueRate = profile === 3 ? 0.16 + rnd() * 0.06 : profile === 2 ? 0.09 + rnd() * 0.04 : 0.03 + rnd() * 0.04;
    const cashRate = profile === 3 ? 0.01 + rnd() * 0.015 : profile === 2 ? 0.03 + rnd() * 0.02 : 0.07 + rnd() * 0.05;
    const pddRate = profile === 3 ? 0.13 + rnd() * 0.04 : profile === 2 ? 0.07 + rnd() * 0.03 : 0.03 + rnd() * 0.025;
    const repRate = profile === 3 ? 0.075 + rnd() * 0.02 : profile === 2 ? 0.04 + rnd() * 0.015 : 0.015 + rnd() * 0.02;
    const subRate = profile === 3 ? 0.1 + rnd() * 0.03 : profile === 2 ? 0.15 + rnd() * 0.04 : 0.22 + rnd() * 0.07;
    return {
      fidcId: f.id, month: m, nav, quotaValue: quota, creditRights: dc,
      overdue: dc * overdueRate, pdd: dc * pddRate, cash: nav * cashRate,
      repurchase: dc * repRate, subordinated: nav * subRate,
      investors: 80 + Math.floor(rnd() * 800),
    };
  });
});

export const reportFor = (fidcId: string, month: string) =>
  MONTHLY_REPORTS.find((r) => r.fidcId === fidcId && r.month === month);
export const historyFor = (fidcId: string) =>
  MONTHLY_REPORTS.filter((r) => r.fidcId === fidcId).sort((a, b) => a.month.localeCompare(b.month));

export type FidcMetrics = {
  atraso_dc: number; caixa_pl: number; pdd_atrasos: number; pdd_dc: number;
  recompras_dc: number; subordinacao: number; var_pl: number | null; var_cota: number | null;
};

export const metricsFor = (fidcId: string, month: string): FidcMetrics | null => {
  const r = reportFor(fidcId, month);
  if (!r) return null;
  const idx = MONTHS.indexOf(month);
  const prev = idx > 0 ? reportFor(fidcId, MONTHS[idx - 1]) : null;
  return {
    atraso_dc: r.overdue / r.creditRights,
    caixa_pl: r.cash / r.nav,
    pdd_atrasos: r.pdd / r.overdue,
    pdd_dc: r.pdd / r.creditRights,
    recompras_dc: r.repurchase / r.creditRights,
    subordinacao: r.subordinated / r.nav,
    var_pl: prev ? r.nav / prev.nav - 1 : null,
    var_cota: prev ? r.quotaValue / prev.quotaValue - 1 : null,
  };
};

export const statusForFidc = (fidcId: string, month: string): RiskStatus => {
  const m = metricsFor(fidcId, month);
  if (!m) return "missing";
  const statuses = DEFAULT_THRESHOLDS.map((rule) =>
    evalStatus(rule, (m as never as Record<string, number>)[rule.metric]),
  );
  return worstStatus(statuses);
};

export const POSITIONS: Position[] = (() => {
  const out: Position[] = [];
  FIDCS.forEach((f, i) => {
    const senior = QUOTA_CLASSES.find((q) => q.fidcId === f.id && q.type === "Sênior")!;
    const inP1 = i % 2 === 0 || i % 5 === 0;
    const inP2 = i % 3 === 0 || i % 7 === 0;
    const inP3 = i % 2 === 1 || i % 4 === 0;
    const r = reportFor(f.id, LATEST_MONTH);
    const base = r ? r.nav * (0.02 + (i % 7) * 0.008) : 5_000_000;
    if (inP1) out.push({ portfolioId: "p1", fidcId: f.id, quotaClassId: senior.id, isin: senior.isin, value: base });
    if (inP2) out.push({ portfolioId: "p2", fidcId: f.id, quotaClassId: senior.id, isin: senior.isin, value: base * 0.55 });
    if (inP3) out.push({ portfolioId: "p3", fidcId: f.id, quotaClassId: senior.id, isin: senior.isin, value: base * 0.45 });
  });
  return out;
})();

export const positionsForPortfolio = (pid: string) => POSITIONS.filter((p) => p.portfolioId === pid);

export type Opinion = {
  id: string; fidcId: string; month: string;
  recommendation: "Manter" | "Acompanhar" | "Reduzir" | "Zerar";
  summary: string; reason: string; positives: string; attentions: string;
  risks: string; evolution: string; author: string; date: string;
};

const RECS = ["Manter", "Acompanhar", "Reduzir", "Zerar"] as const;
export const OPINIONS: Opinion[] = FIDCS.map((f, i) => {
  const profile = PROFILE[i];
  const rec = profile === 3 ? "Zerar" : profile === 2 ? "Reduzir" : profile === 1 ? "Acompanhar" : "Manter";
  return {
    id: `op${i}`, fidcId: f.id, month: LATEST_MONTH,
    recommendation: rec as (typeof RECS)[number],
    summary: `${f.name} mantém perfil ${profile === 0 ? "saudável" : profile === 1 ? "estável" : profile === 2 ? "deteriorado" : "crítico"} em ${LATEST_MONTH}. Liquidez ${profile < 2 ? "adequada" : "pressionada"} e PDD ${profile >= 2 ? "abaixo" : "compatível"} com o estoque de atrasos.`,
    reason: profile >= 2 ? "Aumento consistente de atrasos > 90d e queda de subordinação para abaixo da banda mínima do regulamento." : "Indicadores estáveis, dentro dos limites definidos pelo comitê de crédito.",
    positives: profile < 2 ? "Subordinação acima de 18%. Cobertura PDD/Atrasos > 0,8. Caixa/PL confortável." : "Equipe de cobrança reforçada nos últimos 60d; recompras dentro da política.",
    attentions: profile >= 1 ? "Concentração em poucos cedentes; necessidade de monitorar safras recentes." : "Monitorar evolução de cessões pulverizadas no próximo trimestre.",
    risks: "Risco de originação, risco operacional do custodiante e risco de crédito da carteira pulverizada.",
    evolution: profile >= 2 ? "Deterioração progressiva de PDD/DC e Atraso/DC nos últimos 4 meses." : "Estabilidade nos principais indicadores nos últimos 6 meses.",
    author: "Mesa de Crédito", date: "2025-06-15",
  };
});

export type AlertItem = {
  id: string; fidcId: string; portfolioId: string | null; month: string;
  metric: string; display: string; currentValue: number; threshold: number;
  severity: "warning" | "critical"; status: "new" | "in_analysis" | "resolved";
};

export const ALERTS: AlertItem[] = (() => {
  const out: AlertItem[] = []; let id = 1;
  FIDCS.forEach((f) => {
    const m = metricsFor(f.id, LATEST_MONTH); if (!m) return;
    DEFAULT_THRESHOLDS.forEach((rule) => {
      const value = (m as never as Record<string, number>)[rule.metric];
      const st = evalStatus(rule, value);
      if (st === "warning" || st === "critical") {
        out.push({
          id: `a${id++}`, fidcId: f.id,
          portfolioId: POSITIONS.find((p) => p.fidcId === f.id)?.portfolioId ?? null,
          month: LATEST_MONTH, metric: rule.metric, display: rule.display,
          currentValue: value, threshold: st === "critical" ? rule.critical : rule.warning,
          severity: st, status: "new",
        });
      }
    });
  });
  return out;
})();

export const fidcById = (id: string) => FIDCS.find((f) => f.id === id);
export const portfolioById = (id: string) => PORTFOLIOS.find((p) => p.id === id);
export const quotaClassesFor = (fidcId: string) => QUOTA_CLASSES.filter((q) => q.fidcId === fidcId);
export const opinionFor = (fidcId: string, month: string) =>
  OPINIONS.find((o) => o.fidcId === fidcId && o.month === month);
export const portfoliosForFidc = (fidcId: string) =>
  PORTFOLIOS.filter((p) => POSITIONS.some((x) => x.portfolioId === p.id && x.fidcId === fidcId));

const STATUS_POINTS: Record<RiskStatus, number> = { normal: 0, missing: 4, warning: 10, critical: 22 };
export const scoreForFidc = (fidcId: string, month: string): number => {
  const m = metricsFor(fidcId, month);
  if (!m) return 50;
  let pts = 0;
  DEFAULT_THRESHOLDS.forEach((rule) => {
    const v = (m as never as Record<string, number>)[rule.metric];
    pts += STATUS_POINTS[evalStatus(rule, v)];
  });
  return Math.min(100, Math.round(pts));
};
const bandForScore = (score: number): RiskStatus =>
  score >= 70 ? "critical" : score >= 40 ? "warning" : "normal";

export type WorstMetric = { rule: ThresholdRule; value: number; status: RiskStatus };
export const portfolioSummary = (pid: string) => {
  const portfolio = portfolioById(pid)!;
  const positions = positionsForPortfolio(pid);
  const exposure = positions.reduce((s, p) => s + p.value, 0);
  const fidcIds = [...new Set(positions.map((p) => p.fidcId))];
  const statuses = fidcIds.map((id) => statusForFidc(id, LATEST_MONTH));
  const weighted = fidcIds.reduce((acc, id) => {
    const expo = positions.filter((p) => p.fidcId === id).reduce((s, p) => s + p.value, 0);
    return acc + scoreForFidc(id, LATEST_MONTH) * expo;
  }, 0);
  const score = exposure ? Math.round(weighted / exposure) : 0;
  return {
    portfolio, exposure, pct: exposure / portfolio.nav,
    fidcCount: fidcIds.length,
    critical: statuses.filter((s) => s === "critical").length,
    warning: statuses.filter((s) => s === "warning").length,
    missing: statuses.filter((s) => s === "missing").length,
    worst: worstStatus(statuses),
    score, band: bandForScore(score),
  };
};
