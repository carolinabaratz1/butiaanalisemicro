// Hook que monta o Monitor de FIDCs a partir de dados reais:
// - posicoes (carteiras Butiá → exposição em FIDC via ISIN)
// - fidc_quota_classes (ISIN → cota/classe → FIDC)
// - fidcs (cadastro mestre)
// - fidc_monthly_reports (informe mensal — última versão por FIDC, e versão anterior para variações).
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveReport, classifyReportStatus, type ReportSourceStatus } from "@/lib/fidc/source-resolver";
import { evalMetric, computeAtrasoDc, computePddDc } from "@/lib/fidc/metrics";

// Os 3 fundos Butiá que investem em FIDCs.
// O `source` precisa bater EXATAMENTE com posicoes.trading_desk_share_source.
export const FIDC_PORTFOLIOS = [
  { id: "p1", name: "BUTIÁ TOP",      description: "Crédito privado",            source: "BUTIÁ TOP MASTER FI RENDA FIXA CRÉDITO PRIVADO" },
  { id: "p2", name: "BUTIÁ TOP PREV", description: "Previdência crédito privado", source: "BUTIA TOP PREV FIFE FIRF CP" },
  { id: "p3", name: "BUTIÁ PLUS",     description: "Crédito estruturado",         source: "Butiá Plus Crédito Privado FI RF LP" },
] as const;

export type PortfolioId = (typeof FIDC_PORTFOLIOS)[number]["id"];
export const portfolioById = (id: string) => FIDC_PORTFOLIOS.find((p) => p.id === id);

export type FidcRecord = {
  id: string; name: string; cnpj: string;
  administrator: string | null; manager: string | null; custodian: string | null;
  sector: string | null; strategy: string | null; fidc_type: string | null;
  status: string | null; start_date: string | null;
  main_originator: string | null; specialized_consultant: string | null;
  auditor: string | null; collection_agent: string | null; main_assignor: string | null;
  legal_name: string | null; condominium_type: string | null;
};

export type QuotaRecord = {
  id: string; fidc_id: string; isin: string;
  internal_quota_name: string | null; cvm_quota_name: string | null;
  class_name: string | null; series_name: string | null;
  quota_type: string | null; seniority_level: number | null;
  benchmark: string | null; target_spread: string | null;
  current_rating: string | null; current_rating_agency: string | null;
};

export type MonthlyReportRow = {
  id: string;
  fidc_id: string;
  reference_month: string;          // YYYY-MM-DD (primeiro dia do mês)
  nav_value: number | null;          // PL
  quota_value: number | null;        // Valor da cota (primária / principal)
  credit_rights_value: number | null;
  overdue_value: number | null;
  pdd_value: number | null;
  cash_value: number | null;
  repurchase_value: number | null;
  subordinated_value: number | null;
  quota_total_nav_value: number | null;
  quota_validation_difference_percentage: number | null;
  quota_validation_status: string | null;
  subordinated_calculation_status: string | null;
  investors_count: number | null;
  is_current_version: boolean;
  // Phase 5 — campos enriquecidos via Dados Abertos CVM
  main_segment: string | null;
  main_segment_pct: number | null;
  total_assets: number | null;
  total_liabilities: number | null;
  avg_nav_value: number | null;
  cash_strict_value: number | null;
  total_subscription_value: number | null;
  total_redemption_value: number | null;
  total_amortization_value: number | null;
  net_investor_flow_value: number | null;
  gross_investor_flow_value: number | null;
};

export type PosicaoRow = {
  id: string;
  trading_desk_share_source: string;
  val_date: string;
  product_class: string | null;
  product: string | null;
  amount: number;
  isin: string | null;
  financial_price: number | null;
};

// Helper: parse val_date "MM/DD/YYYY" or "YYYY-MM-DD" → Date
const parseValDate = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [mm, dd, yyyy] = s.split("/");
    return new Date(+yyyy, +mm - 1, +dd);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [yyyy, mm, dd] = s.split("-");
    return new Date(+yyyy, +mm - 1, +dd);
  }
  return null;
};

export type FidcPosition = {
  portfolioId: PortfolioId;
  portfolioName: string;
  portfolioSource: string;
  fidcId: string | null;     // null = ISIN não mapeado
  fidc: FidcRecord | null;
  quotaId: string | null;
  quota: QuotaRecord | null;
  isin: string;
  value: number;             // valor financeiro = amount × financial_price
  valDate: string;
};

export type PortfolioSummary = {
  portfolio: typeof FIDC_PORTFOLIOS[number];
  nav: number;               // PL = soma de TODAS as posições da carteira na data
  exposure: number;          // soma das posições em FIDC
  pct: number;
  fidcCount: number;
  positions: FidcPosition[];
  unmappedCount: number;     // ISINs sem cota cadastrada
  valDate: string | null;
};

const isFidcLikeRow = (p: { product_class: string | null; product: string | null }, isinIsFidc: boolean) => {
  if (isinIsFidc) return true;
  const pc = (p.product_class || "").toLowerCase();
  const pr = (p.product || "").toLowerCase();
  return pc.includes("fidc") || pr.includes("fidc");
};

const valueOf = (p: PosicaoRow): number => {
  // Posição financeira = amount × financial_price
  const amt = Number(p.amount) || 0;
  const fp = Number(p.financial_price) || 0;
  return amt * fp;
};

export function useFidcMonitorData() {
  // 1) Latest val_date PER PORTFOLIO (each Butiá fund may have a different last position date)
  const sources = FIDC_PORTFOLIOS.map((p) => p.source);

  const datesPerPortfolioQ = useQuery({
    queryKey: ["fidc-monitor-dates-per-portfolio", sources.join("|")],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const entries = await Promise.all(
        FIDC_PORTFOLIOS.map(async (p) => {
          const { data, error } = await supabase.rpc(
            "get_posicoes_val_dates_by_source" as any,
            { p_source: p.source },
          );
          if (error) throw error;
          const list = ((data as any[]) ?? [])
            .map((r) => r.val_date_text as string)
            .filter(Boolean);
          return [p.id, list[0] ?? null] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, string | null>;
    },
  });

  const latestPerPortfolio = datesPerPortfolioQ.data ?? {};
  // Global "latest" = max across portfolios (used as fallback display).
  const latestValDate = useMemo(() => {
    const ds = Object.values(latestPerPortfolio).filter(Boolean) as string[];
    if (!ds.length) return null;
    return ds
      .map((d) => ({ d, t: parseValDate(d)?.getTime() ?? 0 }))
      .sort((a, b) => b.t - a.t)[0].d;
  }, [latestPerPortfolio]);

  // 2) Cadastro mestre (FIDCs + cotas/ISINs)
  const fidcsQ = useQuery({
    queryKey: ["fidcs-all-monitor"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("fidcs").select("*");
      if (error) throw error;
      return (data ?? []) as FidcRecord[];
    },
  });

  const quotasQ = useQuery({
    queryKey: ["quotas-all-monitor"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("fidc_quota_classes").select("*");
      if (error) throw error;
      return (data ?? []) as QuotaRecord[];
    },
  });

  // 3) Posições de cada carteira na SUA data mais recente (H1: paralelizado entre carteiras —
  // antes era um for sequencial, uma carteira de cada vez).
  const posQ = useQuery({
    queryKey: ["fidc-monitor-positions-per-portfolio", latestPerPortfolio],
    enabled: Object.values(latestPerPortfolio).some(Boolean),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const perPortfolio = await Promise.all(
        FIDC_PORTFOLIOS.map(async (p) => {
          const dt = latestPerPortfolio[p.id];
          if (!dt) return [] as PosicaoRow[];
          const rows: PosicaoRow[] = [];
          let from = 0;
          const step = 1000;
          while (true) {
            const { data, error } = await supabase
              .from("posicoes")
              .select("id, trading_desk_share_source, val_date, product_class, product, amount, isin, financial_price")
              .eq("trading_desk_share_source", p.source)
              .eq("val_date", dt)
              .range(from, from + step - 1);
            if (error) throw error;
            const page = (data ?? []) as PosicaoRow[];
            rows.push(...page);
            if (page.length < step) break;
            from += step;
          }
          return rows;
        }),
      );
      return perPortfolio.flat();
    },
  });


  // 4) Informes mensais (última versão por FIDC + versão anterior por FIDC para variações).
  // H2: limitado aos últimos 24 meses (antes buscava o histórico inteiro sem filtro de data).
  // Mantém margem generosa de propósito: o Monitor de Alertas (G) navega mês a mês por todo o
  // histórico disponível, então cortar demais quebraria aquela feature — 24 meses cobre bem
  // mais que o uso típico de "mês atual vs. anterior" sem impactar o G na prática.
  const reportsCutoffIso = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 24);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }, []);

  const reportsQ = useQuery({
    queryKey: ["fidc-monthly-reports-all-monitor-v2", reportsCutoffIso],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fidc_monthly_reports")
        .select(
          "id, fidc_id, reference_month, nav_value, quota_value, credit_rights_value, overdue_value, pdd_value, cash_value, repurchase_value, subordinated_value, quota_total_nav_value, quota_validation_difference_percentage, quota_validation_status, subordinated_calculation_status, investors_count, is_current_version, main_segment, main_segment_pct, total_assets, total_liabilities, avg_nav_value, cash_strict_value, total_subscription_value, total_redemption_value, total_amortization_value, net_investor_flow_value, gross_investor_flow_value, source, source_file_name, source_url, version",
        )
        .gte("reference_month", reportsCutoffIso)
        .order("reference_month", { ascending: false })
        .order("version", { ascending: false });
      if (error) throw error;
      return (data ?? []) as (MonthlyReportRow & { source?: string | null; source_file_name?: string | null; source_url?: string | null; version?: number | null })[];
    },
  });

  const isLoading = datesPerPortfolioQ.isLoading || fidcsQ.isLoading || quotasQ.isLoading || posQ.isLoading || reportsQ.isLoading;
  // H4: antes nenhuma tela observava erro de query — uma falha de rede/permissão aparecia
  // como "sem dados" (silencioso), como se a carteira estivesse genuinamente vazia. Agora
  // fica explícito para quem consome o hook decidir como avisar o usuário.
  const isError = datesPerPortfolioQ.isError || fidcsQ.isError || quotasQ.isError || posQ.isError || reportsQ.isError;
  const error = datesPerPortfolioQ.error || fidcsQ.error || quotasQ.error || posQ.error || reportsQ.error || null;
  const fidcs = fidcsQ.data ?? [];
  const quotas = quotasQ.data ?? [];
  const positions = posQ.data ?? [];
  const reports = reportsQ.data ?? [];

  const fidcById = useMemo(() => {
    const m = new Map<string, FidcRecord>();
    fidcs.forEach((f) => m.set(f.id, f));
    return m;
  }, [fidcs]);

  const quotaByIsin = useMemo(() => {
    const m = new Map<string, QuotaRecord>();
    quotas.forEach((q) => m.set(q.isin, q));
    return m;
  }, [quotas]);

  // Agrupa relatórios por FIDC e por mês, separando fonte (CVM x Manual).
  // Para cada (fidc, mês), preserva o maior `version` por fonte.
  type SourcedPair = { month: string; cvm: any | null; manual: any | null };
  const monthsByFidc = useMemo(() => {
    const m = new Map<string, Map<string, SourcedPair>>();
    reports.forEach((r) => {
      const mo = (r.reference_month || "").slice(0, 10);
      if (!mo) return;
      if (!m.has(r.fidc_id)) m.set(r.fidc_id, new Map());
      const monthMap = m.get(r.fidc_id)!;
      if (!monthMap.has(mo)) monthMap.set(mo, { month: mo, cvm: null, manual: null });
      const pair = monthMap.get(mo)!;
      const src = (r as any).source === "cvm_open_data" ? "cvm" : "manual";
      const cur = pair[src];
      if (!cur || (Number(r.version ?? 0) > Number(cur.version ?? 0))) pair[src] = r;
    });
    return m;
  }, [reports]);

  // Resolve um mês específico (ou o mais recente) priorizando CVM.
  const resolveReportFor = (fidcId: string, monthIso?: string) => {
    const monthMap = monthsByFidc.get(fidcId);
    if (!monthMap) return resolveReport(null, null);
    const months = Array.from(monthMap.keys()).sort().reverse();
    const target = monthIso ?? months[0];
    const pair = target ? monthMap.get(target) : null;
    return resolveReport(pair?.cvm ?? null, pair?.manual ?? null);
  };

  // latestReportFor agora devolve o objeto MERGED (CVM-preferring) compatível com o tipo antigo.
  const latestReportFor = (fidcId: string): MonthlyReportRow | null => {
    const r = resolveReportFor(fidcId);
    return (r.merged as MonthlyReportRow) ?? null;
  };
  const prevReportFor = (fidcId: string): MonthlyReportRow | null => {
    const monthMap = monthsByFidc.get(fidcId);
    if (!monthMap) return null;
    const months = Array.from(monthMap.keys()).sort().reverse();
    if (months.length < 2) return null;
    return resolveReportFor(fidcId, months[1]).merged as MonthlyReportRow | null;
  };

  // Compat: reportsByFidc é exposto como lista MERGED de meses (desc).
  const reportsByFidc = useMemo(() => {
    const out = new Map<string, MonthlyReportRow[]>();
    monthsByFidc.forEach((monthMap, fid) => {
      const months = Array.from(monthMap.keys()).sort().reverse();
      out.set(
        fid,
        months
          .map((mo) => resolveReport(monthMap.get(mo)!.cvm, monthMap.get(mo)!.manual).merged as MonthlyReportRow | null)
          .filter(Boolean) as MonthlyReportRow[],
      );
    });
    return out;
  }, [monthsByFidc]);

  const reportSourceStatusFor = (fidcId: string): ReportSourceStatus =>
    classifyReportStatus(resolveReportFor(fidcId));

  const portfolioSummaries: PortfolioSummary[] = useMemo(() => {
    return FIDC_PORTFOLIOS.map((portfolio) => {
      const portRows = positions.filter((p) => p.trading_desk_share_source === portfolio.source);
      const nav = portRows.reduce((s, p) => s + valueOf(p), 0);

      const fidcRows = portRows.filter((p) => {
        const isinKnownAsFidc = !!(p.isin && quotaByIsin.has(p.isin));
        return isFidcLikeRow(p, isinKnownAsFidc);
      });

      const fidcPositions: FidcPosition[] = fidcRows.map((p) => {
        const isin = p.isin ?? "";
        const quota = isin ? quotaByIsin.get(isin) ?? null : null;
        const fidc = quota ? fidcById.get(quota.fidc_id) ?? null : null;
        return {
          portfolioId: portfolio.id,
          portfolioName: portfolio.name,
          portfolioSource: portfolio.source,
          fidcId: fidc?.id ?? null,
          fidc,
          quotaId: quota?.id ?? null,
          quota,
          isin,
          value: valueOf(p),
          valDate: p.val_date,
        };
      });

      const exposure = fidcPositions.reduce((s, p) => s + p.value, 0);
      const fidcIds = new Set(fidcPositions.map((p) => p.fidcId).filter(Boolean) as string[]);
      const unmappedCount = fidcPositions.filter((p) => !p.fidc).length;
      const lastDate = portRows[0]?.val_date ?? latestValDate;

      return {
        portfolio,
        nav,
        exposure,
        pct: nav > 0 ? exposure / nav : 0,
        fidcCount: fidcIds.size,
        positions: fidcPositions,
        unmappedCount,
        valDate: lastDate ?? null,
      };
    });
  }, [positions, quotaByIsin, fidcById, latestValDate]);

  const portfoliosForFidc = (fidcId: string) =>
    portfolioSummaries
      .filter((s) => s.positions.some((p) => p.fidcId === fidcId))
      .map((s) => s.portfolio);

  const exposureForFidc = (fidcId: string) =>
    portfolioSummaries.reduce(
      (s, p) => s + p.positions.filter((x) => x.fidcId === fidcId).reduce((a, b) => a + b.value, 0),
      0,
    );

  // Alertas: posição + métricas mensais (quando informe importado)
  type PositionAlert = {
    id: string;
    severity: "warning" | "critical";
    kind:
      | "isin_nao_mapeado"
      | "carteira_sem_pl"
      | "carteira_sem_posicao"
      | "posicao_duplicada"
      | "divergencia_pct"
      | "informe_ausente"
      | "subordinacao_inconsistente"
      | "pdd_alto"
      | "atraso_alto"
      | "queda_pl"
      | "queda_cota";
    portfolioName: string | null;
    isin: string | null;
    fidcId?: string | null;
    fidcName?: string | null;
    message: string;
    valDate: string | null;
  };

  const positionAlerts: PositionAlert[] = useMemo(() => {
    const alerts: PositionAlert[] = [];
    let i = 1;

    portfolioSummaries.forEach((s) => {
      // PL ausente
      if (s.nav <= 0) {
        alerts.push({
          id: `a${i++}`,
          severity: "warning",
          kind: "carteira_sem_pl",
          portfolioName: s.portfolio.name,
          isin: null,
          message: `PL da carteira ${s.portfolio.name} ausente na data ${s.valDate ?? "—"}.`,
          valDate: s.valDate,
        });
      }
      // Sem nenhuma posição FIDC
      if (s.positions.length === 0 && s.nav > 0) {
        alerts.push({
          id: `a${i++}`,
          severity: "warning",
          kind: "carteira_sem_posicao",
          portfolioName: s.portfolio.name,
          isin: null,
          message: `Nenhuma posição em FIDC encontrada para ${s.portfolio.name}.`,
          valDate: s.valDate,
        });
      }
      // ISIN não mapeado
      s.positions.forEach((p) => {
        if (!p.fidc) {
          alerts.push({
            id: `a${i++}`,
            severity: "critical",
            kind: "isin_nao_mapeado",
            portfolioName: s.portfolio.name,
            isin: p.isin || null,
            message: `ISIN ${p.isin || "—"} sem cota cadastrada em ${s.portfolio.name}.`,
            valDate: s.valDate,
          });
        }
      });
      // Duplicidade (mesmo ISIN em duas linhas do mesmo fundo)
      const seen = new Map<string, number>();
      s.positions.forEach((p) => {
        if (!p.isin) return;
        seen.set(p.isin, (seen.get(p.isin) ?? 0) + 1);
      });
      seen.forEach((count, isin) => {
        if (count > 1) {
          alerts.push({
            id: `a${i++}`,
            severity: "warning",
            kind: "posicao_duplicada",
            portfolioName: s.portfolio.name,
            isin,
            message: `ISIN ${isin} aparece ${count}× em ${s.portfolio.name}.`,
            valDate: s.valDate,
          });
        }
      });
    });

    // Métricas mensais → alertas por FIDC monitorado (com posição em alguma carteira Butiá)
    const monitoredFidcIds = new Set<string>();
    portfolioSummaries.forEach((s) => s.positions.forEach((p) => p.fidcId && monitoredFidcIds.add(p.fidcId)));

    monitoredFidcIds.forEach((fid) => {
      const f = fidcById.get(fid);
      const fname = f?.name ?? "—";
      const sector = f?.sector ?? null;
      const latest = reportsByFidc.get(fid)?.[0] ?? null;
      const prev = reportsByFidc.get(fid)?.[1] ?? null;
      const refDate = latest?.reference_month ?? null;

      if (!latest) {
        alerts.push({
          id: `a${i++}`,
          severity: "warning",
          kind: "informe_ausente",
          portfolioName: null,
          isin: null,
          fidcId: fid,
          fidcName: fname,
          message: `Informe mensal do FIDC ${fname} ainda não importado.`,
          valDate: null,
        });
        return;
      }

      // Subordinação inconsistente
      const subDiffPct = Number(latest.quota_validation_difference_percentage ?? 0);
      const subStatus = (latest.subordinated_calculation_status ?? "").toLowerCase();
      if (subStatus === "inconsistent" || Math.abs(subDiffPct) > 0.002) {
        alerts.push({
          id: `a${i++}`, severity: "warning", kind: "subordinacao_inconsistente",
          portfolioName: null, isin: null, fidcId: fid, fidcName: fname,
          message: `Soma das cotas diverge do PL em ${(subDiffPct * 100).toFixed(2)}% no FIDC ${fname}.`,
          valDate: refDate,
        });
      }

      // PDD / DC bruto (A1: módulo central, thresholds por setor, fórmula corrigida DC+PDD)
      const pddDc = computePddDc(latest.pdd_value, latest.credit_rights_value);
      const pddStatus = evalMetric("pdd_dc", pddDc, sector);
      if (pddDc != null && (pddStatus === "warning" || pddStatus === "critical")) {
        alerts.push({
          id: `a${i++}`, severity: pddStatus, kind: "pdd_alto",
          portfolioName: null, isin: null, fidcId: fid, fidcName: fname,
          message: `PDD/DC em ${(pddDc * 100).toFixed(2)}% no FIDC ${fname}${sector ? ` (setor: ${sector})` : ""}.`,
          valDate: refDate,
        });
      }

      // Atraso / DC bruto (A1: módulo central, thresholds por setor, fórmula corrigida DC+PDD)
      const atrasoDc = computeAtrasoDc(latest.overdue_value, latest.credit_rights_value, latest.pdd_value);
      const atrasoStatus = evalMetric("atraso_dc", atrasoDc, sector);
      if (atrasoDc != null && (atrasoStatus === "warning" || atrasoStatus === "critical")) {
        alerts.push({
          id: `a${i++}`, severity: atrasoStatus, kind: "atraso_alto",
          portfolioName: null, isin: null, fidcId: fid, fidcName: fname,
          message: `Inadimplência/DC em ${(atrasoDc * 100).toFixed(2)}% no FIDC ${fname}${sector ? ` (setor: ${sector})` : ""}.`,
          valDate: refDate,
        });
      }

      if (prev) {
        const navNow = Number(latest.nav_value ?? 0);
        const navPrev = Number(prev.nav_value ?? 0);
        if (navPrev > 0) {
          const v = (navNow - navPrev) / navPrev;
          const plStatus = evalMetric("var_pl", v, sector);
          if (plStatus === "warning" || plStatus === "critical") {
            alerts.push({
              id: `a${i++}`, severity: plStatus, kind: "queda_pl",
              portfolioName: null, isin: null, fidcId: fid, fidcName: fname,
              message: `PL do FIDC ${fname} caiu ${(v * 100).toFixed(2)}% vs. mês anterior.`,
              valDate: refDate,
            });
          }
        }
        const qNow = Number(latest.quota_value ?? 0);
        const qPrev = Number(prev.quota_value ?? 0);
        if (qPrev > 0) {
          const v = (qNow - qPrev) / qPrev;
          const cotaStatus = evalMetric("var_cota", v, sector);
          if (cotaStatus === "warning" || cotaStatus === "critical") {
            alerts.push({
              id: `a${i++}`, severity: cotaStatus, kind: "queda_cota",
              portfolioName: null, isin: null, fidcId: fid, fidcName: fname,
              message: `Cota do FIDC ${fname} caiu ${(v * 100).toFixed(2)}% vs. mês anterior.`,
              valDate: refDate,
            });
          }
        }
      }
    });

    return alerts;
  }, [portfolioSummaries, reportsByFidc, fidcById]);

  const fidcsWithReportCount = reportsByFidc.size;

  return {
    isLoading,
    isError,
    error,
    latestValDate,
    latestPerPortfolio,
    fidcs,
    quotas,
    fidcById: (id: string) => fidcById.get(id) ?? null,
    quotaByIsin: (isin: string) => quotaByIsin.get(isin) ?? null,
    portfolioSummaries,
    portfoliosForFidc,
    exposureForFidc,
    positionAlerts,
    latestReportFor,
    prevReportFor,
    resolveReportFor,
    reportSourceStatusFor,
    fidcsWithReportCount,
    // Exposto para o Monitor de Alertas (G) navegar por mês de referência.
    reportsByFidc,
  };
}
