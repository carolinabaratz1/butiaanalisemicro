// ============================================================
// src/hooks/useTradeData.ts
// Hook central para o Trade Monitor.
// Lê trade_monitor_view + histórico paginado do Supabase.
// ============================================================

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client"; // ajuste o path

// ── Types ────────────────────────────────────────────────────

export type Indexador = "DI" | "IPCA" | "PRE" | "OUTRO";

/**
 * Sub-indexador analítico — separa ativos com naturezas de taxa diferentes
 * para que Z-scores e visualizações não misturem grupos heterogêneos.
 *  - DI_SPREAD : "DI + X%"
 *  - CDI_PCT  : "X% do CDI" / "X% do DI"
 *  - IPCA     : "IPCA + X%"
 *  - PRE / OUTRO : demais
 */
export type TradeMode = "DI_SPREAD" | "CDI_PCT" | "IPCA";

export interface TradeAtivo {
  ticker: string;
  indexador: Indexador;
  sub_indexador: TradeMode | "PRE" | "OUTRO" | null;
  last_date: string;
  last_val: number;          // taxa (DI) ou spread cap. (IPCA)
  last_qtd: number | null;
  last_vol_fin: number | null;
  pu_curva: number | null;
  pu_indicativo: number | null;
  pu_ratio: number | null;
  avg_5d: number;
  avg_10d: number;
  avg_21d: number;
  avg_30d: number;
  avg_90d: number;
  std_90d: number;
  z_score: number;
  z_score_5d: number;
  z_score_10d: number;
  z_score_21d: number;
  change_bps: number;
  total_qtd: number | null;
  total_vol_fin: number | null;
  ntnb_ref: string | null;
  ntnb_taxa: number | null;
  // from trade_ativos join
  nome_completo: string | null;
  emissor_nome: string | null;
  emissor_cnpj: string | null;
  venc_date: string | null;
  anos_venc: number | null;
  taxa_emissao: string | null;
  spread_emissao: number | null;
  rating: string | null;
  data_rating: string | null;
}

export interface HistoryPoint {
  d: string;
  r: number;       // spread or taxa
  pc: number | null;  // pu_curva
  pi: number | null;  // pu_indicativo
}

export interface NTNBPoint {
  d: string;
  r: number;
}

export interface TradeDataState {
  data: TradeAtivo[];
  history: Record<string, HistoryPoint[]>;
  ntnbHist: Record<string, NTNBPoint[]>;
  lastDate: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

// ── Hook ─────────────────────────────────────────────────────

export function useTradeData(mode: TradeMode | null): TradeDataState {
  const [data, setData] = useState<TradeAtivo[]>([]);
  const [history, setHistory] = useState<Record<string, HistoryPoint[]>>({});
  const [ntnbHist, setNtnbHist] = useState<Record<string, NTNBPoint[]>>({});
  const [lastDate, setLastDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!mode) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch metrics — filter by sub_indexador (DI_SPREAD, CDI_PCT, IPCA)
      const { data: metrics, error: metricsErr } = await supabase
        .from("trade_monitor_view")
        .select("*")
        .eq("sub_indexador", mode)
        .not("last_val", "is", null)
        .neq("last_val", 0)
        .order("z_score", { ascending: false });

      if (metricsErr) throw metricsErr;
      setData((metrics ?? []) as TradeAtivo[]);

      const latest = metrics?.[0]?.last_date ?? null;
      setLastDate(latest);

      // 2. Fetch historical rates (last 90 trading rows per ticker)
      const tickers = (metrics ?? []).map((m) => m.ticker as string);
      if (tickers.length === 0) { setLoading(false); return; }

      // Get 90 trading-day cutoff. Selecting plain `data` returns one row
      // per (ticker,date), so we need DISTINCT dates — fetch the latest date
      // and walk back ~135 calendar days (~90 trading days w/ slack).
      const { data: latestRow } = await supabase
        .from("trade_taxas")
        .select("data")
        .order("data", { ascending: false })
        .limit(1)
        .maybeSingle();
      const latestDate = latestRow?.data ? new Date(latestRow.data) : new Date();
      const cutoffDate = new Date(latestDate);
      cutoffDate.setDate(cutoffDate.getDate() - 135);
      const cutoff = cutoffDate.toISOString().slice(0, 10);

      const PAGE = 1000;

      if (mode === "IPCA") {
        // For IPCA we need to compute spread on the fly via RPC.
        // Use real LIMIT/OFFSET inside the function (pushdown) to avoid timeouts.
        const byTicker: Record<string, HistoryPoint[]> = {};
        let offset = 0;
        while (true) {
          const { data: hist, error: histErr } = await supabase
            .rpc("get_ipca_history", { p_cutoff: cutoff, p_limit: PAGE, p_offset: offset });
          if (histErr) throw histErr;
          for (const row of hist ?? []) {
            const t = row.ticker as string;
            if (!byTicker[t]) byTicker[t] = [];
            byTicker[t].push({ d: row.data, r: row.spread, pc: row.pu_curva, pi: row.pu_indicativo });
          }
          if (!hist || hist.length < PAGE) break;
          offset += PAGE;
        }
        setHistory(byTicker);
      } else {
        // DI: raw taxas — paginate to bypass 1000-row PostgREST limit
        const batchSize = 200;
        const byTicker: Record<string, HistoryPoint[]> = {};

        for (let i = 0; i < tickers.length; i += batchSize) {
          const batch = tickers.slice(i, i + batchSize);
          let from = 0;
          while (true) {
            const { data: hist, error: histErr } = await supabase
              .from("trade_taxas")
              .select("ticker, data, taxa_indicativa, pu_curva, pu_indicativo")
              .in("ticker", batch)
              .gte("data", cutoff)
              .order("data", { ascending: true })
              .range(from, from + PAGE - 1);
            if (histErr) throw histErr;
            for (const row of hist ?? []) {
              const t = row.ticker as string;
              if (!byTicker[t]) byTicker[t] = [];
              byTicker[t].push({
                d:  row.data,
                r:  (row.taxa_indicativa ?? 0) * 100,
                pc: row.pu_curva,
                pi: row.pu_indicativo,
              });
            }
            if (!hist || hist.length < PAGE) break;
            from += PAGE;
          }
        }
        setHistory(byTicker);
      }

      // 3. NTN-B history (IPCA only) — paginated
      if (mode === "IPCA") {
        const byBond: Record<string, NTNBPoint[]> = {};
        let from = 0;
        while (true) {
          const { data: ntnb, error: ntnbErr } = await supabase
            .from("trade_ntnb")
            .select("bond_name, data, taxa_indicativa, pu_indicativo")
            .like("bond_name", "NTN-B%")
            .gte("data", cutoff)
            .order("data", { ascending: true })
            .range(from, from + PAGE - 1);
          if (ntnbErr) throw ntnbErr;
          for (const row of ntnb ?? []) {
            if (!byBond[row.bond_name]) byBond[row.bond_name] = [];
            byBond[row.bond_name].push({ d: row.data, r: (row.taxa_indicativa ?? 0) * 100 });
          }
          if (!ntnb || ntnb.length < PAGE) break;
          from += PAGE;
        }
        setNtnbHist(byBond);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => { load(); }, [load]);

  return { data, history, ntnbHist, lastDate, loading, error, refresh: load };
}

// ── Hook de detalhe por ticker (para ficha do emissor) ───────

export function useTickerDetail(ticker: string | null) {
  const [detail, setDetail] = useState<TradeAtivo | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);

    (async () => {
      const PAGE = 1000;
      const { data: m } = await supabase
        .from("trade_monitor_view").select("*").eq("ticker", ticker).single();
      setDetail((m ?? null) as TradeAtivo | null);

      const isIPCA = (m as TradeAtivo | null)?.indexador === "IPCA";

      if (isIPCA) {
        // For IPCA, fetch capitalized spread history via the RPC filtered by ticker
        const allHist: HistoryPoint[] = [];
        let from = 0;
        while (true) {
          const { data: page } = await supabase
            .rpc("get_ipca_history", { p_ticker: ticker })
            .range(from, from + PAGE - 1);
          if (!page || page.length === 0) break;
          for (const row of page) {
            allHist.push({
              d: row.data,
              r: row.spread,
              pc: row.pu_curva,
              pi: row.pu_indicativo,
            });
          }
          if (page.length < PAGE) break;
          from += PAGE;
        }
        setHistory(allHist);
      } else {
        // DI/PRE/OUTRO: raw indicative rate
        const allHist: { data: string; taxa_indicativa: number | null; pu_curva: number | null; pu_indicativo: number | null }[] = [];
        let from = 0;
        while (true) {
          const { data: page } = await supabase
            .from("trade_taxas")
            .select("data, taxa_indicativa, pu_curva, pu_indicativo")
            .eq("ticker", ticker)
            .order("data", { ascending: true })
            .range(from, from + PAGE - 1);
          if (!page || page.length === 0) break;
          allHist.push(...page);
          if (page.length < PAGE) break;
          from += PAGE;
        }
        setHistory(
          allHist.map((r) => ({
            d: r.data, r: (r.taxa_indicativa ?? 0) * 100, pc: r.pu_curva, pi: r.pu_indicativo,
          }))
        );
      }
      setLoading(false);
    })();
  }, [ticker]);

  return { detail, history, loading };
}
