// ============================================================
// src/hooks/useTradeIntegration.ts
// Liga Trade Monitor às tabelas internas:
//  - posicoes  → fundos com posição em cada ISIN
//  - emissoes  → mapping ISIN ↔ ticker ↔ CNPJ emissor
//  - empresas  → CNPJ → empresa_id
//  - analises  → status mais recente por ISIN/empresa
// Usa TanStack Query, com fetches paginados (PostgREST limit 1000).
// ============================================================

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AnaliseStatus =
  | "Aprovada"
  | "Reprovada"
  | "Pendente"
  | "Em Análise"
  | "Concluída"
  | "Vencida";

export interface Allocation {
  fundo: string;
  val_date: string;
  amount: number;
  financial_price: number;
  pct_fundo: number; // share of the fund's total financial in this position
}

interface PosRow {
  isin: string | null;
  trading_desk_share_source: string;
  val_date: string;
  amount: number | null;
  financial_price: number | null;
}

interface EmissaoRow {
  ticker: string | null;
  isin: string;
  cnpj_emissor: string;
}

interface EmpresaRow {
  id: string;
  cnpj: string;
}

interface AnaliseRow {
  id: string;
  empresa_id: string;
  isin: string | null;
  status: string;
  recomendacao: string | null;
  data_aprovacao: string | null;
  data_conclusao: string | null;
  prazo: string | null;
  versao: number;
  created_at: string;
}

async function paginate<T>(
  fn: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  let from = 0;
  // Hard cap to avoid runaway loops
  for (let i = 0; i < 50; i++) {
    const { data, error } = await fn(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

function parseAprovacao(s: string | null): Date | null {
  if (!s) return null;
  // Try ISO first then DD/MM/YYYY
  const iso = new Date(s);
  if (!isNaN(iso.getTime())) return iso;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}

export function useTradeIntegration() {
  // ── Latest val_date for posicoes ──────────────────────────
  const latestValDateQ = useQuery({
    queryKey: ["trade-int", "latest-val-date"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posicoes")
        .select("val_date")
        .not("val_date", "is", null)
        .order("val_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data?.val_date as string | undefined) ?? null;
    },
  });

  const latestValDate = latestValDateQ.data ?? null;

  // ── Posições da última val_date ───────────────────────────
  const posicoesQ = useQuery({
    queryKey: ["trade-int", "posicoes", latestValDate],
    enabled: !!latestValDate,
    staleTime: 5 * 60_000,
    queryFn: async () =>
      paginate<PosRow>((from, to) =>
        supabase
          .from("posicoes")
          .select("isin, trading_desk_share_source, val_date, amount, financial_price")
          .eq("val_date", latestValDate as string)
          .not("isin", "is", null)
          .range(from, to) as unknown as PromiseLike<{ data: PosRow[] | null; error: unknown }>,
      ),
  });

  // ── Emissões (mapping) ────────────────────────────────────
  const emissoesQ = useQuery({
    queryKey: ["trade-int", "emissoes"],
    staleTime: 5 * 60_000,
    queryFn: async () =>
      paginate<EmissaoRow>((from, to) =>
        supabase.from("emissoes").select("ticker, isin, cnpj_emissor").range(from, to) as unknown as PromiseLike<{ data: EmissaoRow[] | null; error: unknown }>,
      ),
  });

  // ── Empresas (CNPJ → id) ──────────────────────────────────
  const empresasQ = useQuery({
    queryKey: ["trade-int", "empresas"],
    staleTime: 5 * 60_000,
    queryFn: async () =>
      paginate<EmpresaRow>((from, to) =>
        supabase.from("empresas").select("id, cnpj").range(from, to) as unknown as PromiseLike<{ data: EmpresaRow[] | null; error: unknown }>,
      ),
  });

  // ── Análises (todas, depois reduzimos para a mais recente) ─
  const analisesQ = useQuery({
    queryKey: ["trade-int", "analises"],
    staleTime: 5 * 60_000,
    queryFn: async () =>
      paginate<AnaliseRow>((from, to) =>
        supabase
          .from("analises")
          .select(
            "id, empresa_id, isin, status, recomendacao, data_aprovacao, data_conclusao, prazo, versao, created_at",
          )
          .order("versao", { ascending: false })
          .range(from, to) as unknown as PromiseLike<{ data: AnaliseRow[] | null; error: unknown }>,
      ),
  });

  const isLoading =
    latestValDateQ.isLoading ||
    posicoesQ.isLoading ||
    emissoesQ.isLoading ||
    empresasQ.isLoading ||
    analisesQ.isLoading;

  // ── Derived maps ──────────────────────────────────────────
  const maps = useMemo(() => {
    const posicoes = posicoesQ.data ?? [];
    const emissoes = emissoesQ.data ?? [];
    const empresas = empresasQ.data ?? [];
    const analises = analisesQ.data ?? [];

    // CNPJ → empresa_id (kept for reference; analises.empresa_id armazena CNPJ direto)
    const cnpjToEmpresa = new Map<string, string>();
    for (const e of empresas) cnpjToEmpresa.set(e.cnpj, e.id);

    // Normaliza CNPJ removendo pontuação para casamento robusto
    const normCnpj = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

    // ticker → { isin, cnpj }
    const tickerInfo = new Map<string, { isin: string; cnpj: string }>();
    const isinToTicker = new Map<string, string>();
    for (const e of emissoes) {
      if (e.ticker) tickerInfo.set(e.ticker, { isin: e.isin, cnpj: e.cnpj_emissor });
      isinToTicker.set(e.isin, e.ticker ?? "");
    }

    // Latest analise por isin e por CNPJ (analises.empresa_id contém o CNPJ formatado)
    const analiseByIsin = new Map<string, AnaliseRow>();
    const analiseByCnpj = new Map<string, AnaliseRow>();
    for (const a of analises) {
      if (a.isin && a.isin.trim() && !analiseByIsin.has(a.isin)) analiseByIsin.set(a.isin, a);
      const key = normCnpj(a.empresa_id);
      if (key && !analiseByCnpj.has(key)) analiseByCnpj.set(key, a);
    }

    // isin → posições[]
    const posByIsin = new Map<string, PosRow[]>();
    // fundo → total financeiro
    const fundTotal = new Map<string, number>();
    // fundo → set<isin>
    const fundIsins = new Map<string, Set<string>>();
    for (const p of posicoes) {
      if (!p.isin) continue;
      const arr = posByIsin.get(p.isin) ?? [];
      arr.push(p);
      posByIsin.set(p.isin, arr);
      fundTotal.set(
        p.trading_desk_share_source,
        (fundTotal.get(p.trading_desk_share_source) ?? 0) + (p.financial_price ?? 0),
      );
      const s = fundIsins.get(p.trading_desk_share_source) ?? new Set<string>();
      s.add(p.isin);
      fundIsins.set(p.trading_desk_share_source, s);
    }

    return {
      cnpjToEmpresa,
      tickerInfo,
      isinToTicker,
      analiseByIsin,
      analiseByEmpresa,
      posByIsin,
      fundTotal,
      fundIsins,
    };
  }, [posicoesQ.data, emissoesQ.data, empresasQ.data, analisesQ.data]);

  // ── Helpers ───────────────────────────────────────────────
  const helpers = useMemo(() => {
    const today = new Date();

    function resolveAnalise(ticker: string): AnaliseRow | null {
      const info = maps.tickerInfo.get(ticker);
      if (!info) return null;
      // First try by ISIN
      const byIsin = info.isin ? maps.analiseByIsin.get(info.isin) : undefined;
      if (byIsin) return byIsin;
      // Fallback: by company
      const empresaId = maps.cnpjToEmpresa.get(info.cnpj);
      if (!empresaId) return null;
      return maps.analiseByEmpresa.get(empresaId) ?? null;
    }

    function getStatus(ticker: string): AnaliseStatus | null {
      const a = resolveAnalise(ticker);
      if (!a) return null;
      const raw = (a.status as AnaliseStatus) ?? null;
      // Vencida: aprovada há mais de 1 ano
      if (raw === "Aprovada") {
        const ap = parseAprovacao(a.data_aprovacao);
        if (ap) {
          const expires = new Date(ap);
          expires.setFullYear(expires.getFullYear() + 1);
          if (expires < today) return "Vencida";
        }
      }
      return raw;
    }

    function getAllocations(ticker: string): Allocation[] {
      const info = maps.tickerInfo.get(ticker);
      if (!info?.isin) return [];
      const rows = maps.posByIsin.get(info.isin) ?? [];
      return rows
        .map((r) => {
          const total = maps.fundTotal.get(r.trading_desk_share_source) ?? 0;
          const fin = r.financial_price ?? 0;
          return {
            fundo: r.trading_desk_share_source,
            val_date: r.val_date,
            amount: r.amount ?? 0,
            financial_price: fin,
            pct_fundo: total > 0 ? fin / total : 0,
          } as Allocation;
        })
        .sort((a, b) => b.financial_price - a.financial_price);
    }

    function hasPosition(ticker: string): boolean {
      const info = maps.tickerInfo.get(ticker);
      if (!info?.isin) return false;
      return (maps.posByIsin.get(info.isin)?.length ?? 0) > 0;
    }

    function getFundsList(): string[] {
      return Array.from(maps.fundTotal.keys()).sort();
    }

    function getTickersByFund(fund: string): Set<string> {
      const isins = maps.fundIsins.get(fund);
      if (!isins) return new Set();
      const out = new Set<string>();
      for (const isin of isins) {
        const tk = maps.isinToTicker.get(isin);
        if (tk) out.add(tk);
      }
      return out;
    }

    function getFundTotal(fund: string): number {
      return maps.fundTotal.get(fund) ?? 0;
    }

    return { getStatus, getAllocations, hasPosition, getFundsList, getTickersByFund, getFundTotal };
  }, [maps]);

  return {
    isLoading,
    latestValDate,
    ...helpers,
  };
}

export type TradeIntegration = ReturnType<typeof useTradeIntegration>;
