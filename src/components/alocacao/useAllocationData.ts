import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  FundoKey, sourceFromFundo, tipoAtivoFromProduct, indexadorFromSub, ratingBucket, worstRating,
} from "./allocationUtils";

export interface LimitRow {
  fundo: string;
  categoria: string;
  subcategoria: string;
  limite_pct: number | null;
}

export function useAllocationLimits() {
  return useQuery({
    queryKey: ["allocation_limits"],
    queryFn: async (): Promise<LimitRow[]> => {
      const { data, error } = await supabase
        .from("allocation_limits" as any)
        .select("fundo,categoria,subcategoria,limite_pct");
      if (error) throw error;
      return (data ?? []) as any;
    },
  });
}

export interface TargetRow {
  fundo: string;
  tipo_ativo: string;
  target_pct: number | null;
  updated_at: string;
}

export function useAllocationTargets() {
  return useQuery({
    queryKey: ["allocation_targets"],
    queryFn: async (): Promise<TargetRow[]> => {
      const { data, error } = await supabase
        .from("allocation_targets" as any)
        .select("fundo,tipo_ativo,target_pct,updated_at");
      if (error) throw error;
      return (data ?? []) as any;
    },
  });
}

export interface AggBucket {
  key: string;
  total: number;       // financial sum
  pct: number;         // percent of fund
}

export interface IssuerRow {
  grupo: string;
  emissores: { nome: string; cnpj: string; empresaId: string | null; rating: string | null }[];
  ratingBucket: string;
  total: number;
  pct: number;
}

export interface AllocationData {
  loading: boolean;
  valDate: string | null;
  totalFundo: number;
  porTipo: Map<string, AggBucket>;
  porIndexador: Map<string, AggBucket>;
  porRating: Map<string, AggBucket>;
  porGrupo: IssuerRow[];
}

export function useAllocationData(fundo: FundoKey) {
  return useQuery({
    queryKey: ["alocacao", fundo],
    queryFn: async (): Promise<AllocationData> => {
      const source = sourceFromFundo(fundo);

      // 1. Get latest val_date for this fund (val_date stored as MM/DD/YYYY text — must parse to compare)
      const { data: dateData } = await supabase
        .from("posicoes")
        .select("val_date")
        .eq("trading_desk_share_source", source);
      const parseDate = (s: string): number => {
        const [m, d, y] = s.split("/").map(Number);
        return new Date(y, (m || 1) - 1, d || 1).getTime();
      };
      const allDates = Array.from(new Set((dateData ?? []).map((r: any) => r.val_date).filter(Boolean))) as string[];
      allDates.sort((a, b) => parseDate(b) - parseDate(a));
      const valDate = allDates[0] ?? null;

      if (!valDate) {
        return {
          loading: false, valDate: null, totalFundo: 0,
          porTipo: new Map(), porIndexador: new Map(), porRating: new Map(), porGrupo: [],
        };
      }

      // 2. Positions for this fund/date
      const { data: posicoes, error: posErr } = await supabase
        .from("posicoes")
        .select("isin,product,product_class,financial_price")
        .eq("trading_desk_share_source", source)
        .eq("val_date", valDate);
      if (posErr) throw posErr;

      const positions = (posicoes ?? []) as any[];
      const isins = Array.from(new Set(positions.map(p => p.isin).filter(Boolean))) as string[];

      // 3. Lookups: emissoes (isin -> cnpj, ticker), trade_ativos (ticker -> sub_indexador), empresas (cnpj -> rating, grupo, nome, id)
      const [emissoesRes, empresasRes] = await Promise.all([
        isins.length ? supabase.from("emissoes").select("isin,cnpj_emissor,ticker").in("isin", isins) : Promise.resolve({ data: [] as any }),
        supabase.from("empresas").select("id,cnpj,nome,grupo_economico,rating"),
      ]);
      const emissoes = (emissoesRes.data ?? []) as any[];
      const empresas = (empresasRes.data ?? []) as any[];
      const tickers = Array.from(new Set(emissoes.map(e => e.ticker).filter(Boolean))) as string[];
      const tradeAtivosRes = tickers.length
        ? await supabase.from("trade_ativos").select("ticker,sub_indexador").in("ticker", tickers)
        : { data: [] as any };
      const tradeAtivos = (tradeAtivosRes.data ?? []) as any[];

      const isinToEmissao = new Map(emissoes.map(e => [e.isin, e]));
      const tickerToSub = new Map(tradeAtivos.map(t => [t.ticker, t.sub_indexador]));
      const cnpjToEmpresa = new Map(empresas.map(e => [e.cnpj, e]));

      const totalFundo = positions.reduce((s, p) => s + (Number(p.financial_price) || 0), 0);

      const porTipo = new Map<string, AggBucket>();
      const porIndexador = new Map<string, AggBucket>();
      const porRating = new Map<string, AggBucket>();
      const grupoMap = new Map<string, IssuerRow>();

      const addTo = (map: Map<string, AggBucket>, key: string, value: number) => {
        const cur = map.get(key) ?? { key, total: 0, pct: 0 };
        cur.total += value;
        map.set(key, cur);
      };

      for (const p of positions) {
        const fin = Number(p.financial_price) || 0;
        const tipo = tipoAtivoFromProduct(p.product, p.product_class);
        addTo(porTipo, tipo, fin);

        const emissao = p.isin ? isinToEmissao.get(p.isin) : null;
        const sub = emissao?.ticker ? tickerToSub.get(emissao.ticker) : null;
        const indexLabel = indexadorFromSub(sub);
        addTo(porIndexador, indexLabel, fin);

        const empresa = emissao?.cnpj_emissor ? cnpjToEmpresa.get(emissao.cnpj_emissor) : null;
        const ratingB = ratingBucket(empresa?.rating);
        addTo(porRating, ratingB, fin);

        if (empresa) {
          const grupoKey = empresa.grupo_economico?.trim() || empresa.nome;
          const existing = grupoMap.get(grupoKey);
          if (existing) {
            existing.total += fin;
            if (!existing.emissores.find(e => e.cnpj === empresa.cnpj)) {
              existing.emissores.push({ nome: empresa.nome, cnpj: empresa.cnpj, empresaId: empresa.id, rating: empresa.rating });
            }
          } else {
            grupoMap.set(grupoKey, {
              grupo: grupoKey,
              emissores: [{ nome: empresa.nome, cnpj: empresa.cnpj, empresaId: empresa.id, rating: empresa.rating }],
              ratingBucket: ratingB,
              total: fin,
              pct: 0,
            });
          }
        }
      }

      // compute pct
      const finalize = (map: Map<string, AggBucket>) => {
        for (const v of map.values()) v.pct = totalFundo > 0 ? (v.total / totalFundo) * 100 : 0;
      };
      finalize(porTipo); finalize(porIndexador); finalize(porRating);

      const porGrupo = Array.from(grupoMap.values()).map(g => ({
        ...g,
        pct: totalFundo > 0 ? (g.total / totalFundo) * 100 : 0,
        ratingBucket: worstRating(g.emissores.map(e => ratingBucket(e.rating))),
      })).sort((a, b) => b.pct - a.pct);

      return { loading: false, valDate, totalFundo, porTipo, porIndexador, porRating, porGrupo };
    },
  });
}
