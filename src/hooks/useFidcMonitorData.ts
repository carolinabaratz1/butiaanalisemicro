// Hook que monta o Monitor de FIDCs a partir de dados reais:
// - posicoes (carteiras Butiá → exposição em FIDC via ISIN)
// - fidc_quota_classes (ISIN → cota/classe → FIDC)
// - fidcs (cadastro mestre)
// NÃO consulta fidc_monthly_reports / fidc_monthly_quota_classes —
// métricas mensais só serão preenchidas quando o informe mensal for importado.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  value: number;             // financial_price (R$) — se ausente, usa amount como fallback
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
  // Preferimos financial_price (valor financeiro). Se ausente/zero, usa amount.
  const fp = Number(p.financial_price);
  if (Number.isFinite(fp) && fp !== 0) return fp;
  return Number(p.amount) || 0;
};

export function useFidcMonitorData() {
  // 1) Última val_date geral
  const datesQ = useQuery({
    queryKey: ["fidc-monitor-dates"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_posicoes_val_dates" as any);
      if (error) throw error;
      return ((data as any[]) ?? [])
        .map((r) => r.val_date_text as string)
        .filter(Boolean);
    },
  });

  const latestValDate = datesQ.data?.[0] ?? null;

  // 2) Cadastro mestre (FIDCs + cotas/ISINs)
  const fidcsQ = useQuery({
    queryKey: ["fidcs-all-monitor"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fidcs").select("*");
      if (error) throw error;
      return (data ?? []) as FidcRecord[];
    },
  });

  const quotasQ = useQuery({
    queryKey: ["quotas-all-monitor"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fidc_quota_classes").select("*");
      if (error) throw error;
      return (data ?? []) as QuotaRecord[];
    },
  });

  // 3) Posições das 3 carteiras Butiá na data mais recente
  const sources = FIDC_PORTFOLIOS.map((p) => p.source);
  const posQ = useQuery({
    queryKey: ["fidc-monitor-positions", latestValDate],
    enabled: !!latestValDate,
    queryFn: async () => {
      let all: PosicaoRow[] = [];
      let from = 0;
      const step = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("posicoes")
          .select("id, trading_desk_share_source, val_date, product_class, product, amount, isin, financial_price")
          .in("trading_desk_share_source", sources)
          .eq("val_date", latestValDate!)
          .range(from, from + step - 1);
        if (error) throw error;
        const rows = (data ?? []) as PosicaoRow[];
        all = all.concat(rows);
        if (rows.length < step) break;
        from += step;
      }
      return all;
    },
  });

  const isLoading = datesQ.isLoading || fidcsQ.isLoading || quotasQ.isLoading || posQ.isLoading;
  const fidcs = fidcsQ.data ?? [];
  const quotas = quotasQ.data ?? [];
  const positions = posQ.data ?? [];

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

  // Alertas permitidos nesta etapa (sem métricas mensais)
  type PositionAlert = {
    id: string;
    severity: "warning" | "critical";
    kind:
      | "isin_nao_mapeado"
      | "carteira_sem_pl"
      | "carteira_sem_posicao"
      | "posicao_duplicada"
      | "divergencia_pct";
    portfolioName: string | null;
    isin: string | null;
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

    return alerts;
  }, [portfolioSummaries]);

  return {
    isLoading,
    latestValDate,
    availableDates: datesQ.data ?? [],
    fidcs,
    quotas,
    fidcById: (id: string) => fidcById.get(id) ?? null,
    quotaByIsin: (isin: string) => quotaByIsin.get(isin) ?? null,
    portfolioSummaries,
    portfoliosForFidc,
    exposureForFidc,
    positionAlerts,
  };
}
