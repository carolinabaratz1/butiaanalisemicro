import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  FundoKey, sourceFromFundo, tipoAtivoFromProduct, ratingBucket, worstRating,
  isExcludedFromPL, isTermo, isTesouroNacional, resolveIndexador, CREDITO_PRIVADO_TIPOS,
  fidcTipoFromClasse, FidcClasse,
} from "./allocationUtils";

export interface FidcClassRow {
  isin: string;
  classe: FidcClasse;
}

export function useFidcClasses() {
  return useQuery({
    queryKey: ["fidc_classes"],
    queryFn: async (): Promise<FidcClassRow[]> => {
      const { data, error } = await supabase
        .from("fidc_classes" as any)
        .select("isin,classe");
      if (error) throw error;
      return (data ?? []) as any;
    },
  });
}

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

export interface TargetPeriod {
  id: string;
  fundo: string;
  nome: string;
  data_inicio: string;
  data_fim: string | null;
  ativo: boolean;
  created_at: string;
}

export function useAllocationTargetPeriods(fundo?: FundoKey) {
  return useQuery({
    queryKey: ["allocation_target_periods", fundo ?? "all"],
    queryFn: async (): Promise<TargetPeriod[]> => {
      let q: any = supabase
        .from("allocation_target_periods" as any)
        .select("id,fundo,nome,data_inicio,data_fim,ativo,created_at")
        .order("data_inicio", { ascending: false });
      if (fundo) q = q.eq("fundo", fundo);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any;
    },
  });
}

export interface TargetRow {
  id?: string;
  period_id: string | null;
  fundo: string;
  tipo_ativo: string;
  target_pct: number | null;
  updated_at: string;
}

export function useAllocationTargets(periodId?: string | null) {
  return useQuery({
    queryKey: ["allocation_targets", periodId ?? "all"],
    queryFn: async (): Promise<TargetRow[]> => {
      let q: any = supabase
        .from("allocation_targets" as any)
        .select("id,period_id,fundo,tipo_ativo,target_pct,updated_at");
      if (periodId) q = q.eq("period_id", periodId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any;
    },
    enabled: periodId !== undefined,
  });
}

export interface EmissorTargetRow {
  id?: string;
  period_id: string;
  fundo: string;
  cnpj_emissor: string;
  target_pct: number | null;
  updated_at?: string;
}

export function useAllocationEmissorTargets(periodId?: string | null, fundo?: FundoKey) {
  return useQuery({
    queryKey: ["allocation_targets_emissor", periodId ?? "none", fundo ?? "all"],
    queryFn: async (): Promise<EmissorTargetRow[]> => {
      if (!periodId) return [];
      let q: any = supabase
        .from("allocation_targets_emissor" as any)
        .select("id,period_id,fundo,cnpj_emissor,target_pct,updated_at")
        .eq("period_id", periodId);
      if (fundo) q = q.eq("fundo", fundo);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any;
    },
    enabled: !!periodId,
  });
}

export interface AggBucket {
  key: string;
  total: number;
  pct: number;
}

export interface IssuerRow {
  grupo: string;
  emissores: { nome: string; cnpj: string; empresaId: string | null; rating: string | null }[];
  ratingBucket: string;
  total: number;
  pct: number;
  isSoberano?: boolean;
  isTermoSummary?: boolean;
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

export function useAllocationDates(fundo: FundoKey) {
  const source = sourceFromFundo(fundo);
  return useQuery({
    queryKey: ["alocacao-dates", fundo],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.rpc("get_posicoes_val_dates" as any);
      if (error) throw error;
      const allDates = ((data as any[]) ?? [])
        .map((r) => r.val_date_text as string)
        .filter(Boolean);
      if (allDates.length === 0) return [];
      const { data: fundDates } = await supabase
        .from("posicoes")
        .select("val_date")
        .eq("trading_desk_share_source", source)
        .limit(10000);
      const fundSet = new Set(((fundDates as any[]) ?? []).map((r) => r.val_date));
      return allDates.filter((d) => fundSet.has(d));
    },
  });
}

export function useAllocationData(fundo: FundoKey, valDateOverride?: string | null) {
  return useQuery({
    queryKey: ["alocacao", fundo, valDateOverride ?? "latest"],
    queryFn: async (): Promise<AllocationData> => {
      const source = sourceFromFundo(fundo);

      let valDate: string | null = valDateOverride ?? null;
      if (!valDate) {
        const { data: fundDates } = await supabase
          .from("posicoes")
          .select("val_date")
          .eq("trading_desk_share_source", source)
          .limit(10000);
        const uniq = Array.from(new Set(((fundDates as any[]) ?? []).map((r) => r.val_date).filter(Boolean))) as string[];
        const parseDate = (s: string): number => {
          if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
            const [y, m, d] = s.split("-").map(Number);
            return new Date(y, (m || 1) - 1, d || 1).getTime();
          }
          const [m, d, y] = s.split("/").map(Number);
          return new Date(y, (m || 1) - 1, d || 1).getTime();
        };
        uniq.sort((a, b) => parseDate(b) - parseDate(a));
        valDate = uniq[0] ?? null;
      }

      if (!valDate) {
        return {
          loading: false, valDate: null, totalFundo: 0,
          porTipo: new Map(), porIndexador: new Map(), porRating: new Map(), porGrupo: [],
        };
      }

      const { data: posicoes, error: posErr } = await supabase
        .from("posicoes")
        .select("isin,product,product_class,amount,financial_price")
        .eq("trading_desk_share_source", source)
        .eq("val_date", valDate);
      if (posErr) throw posErr;

      // Excluir DAP/Futuros do PL e de toda agregação
      const positionsAll = (posicoes ?? []).map((p: any) => ({
        ...p,
        posicao_rs: (Number(p.amount) || 0) * (Number(p.financial_price) || 0),
      })) as any[];
      const positions = positionsAll.filter(p => !isExcludedFromPL(p.product, p.product_class));

      const isins = Array.from(new Set(positions.map(p => p.isin).filter(Boolean))) as string[];

      const [emissoesRes, empresasRes, fidcRes] = await Promise.all([
        isins.length ? supabase.from("emissoes").select("isin,cnpj_emissor,ticker").in("isin", isins) : Promise.resolve({ data: [] as any }),
        supabase.from("empresas").select("id,cnpj,nome,grupo_economico,rating"),
        supabase.from("fidc_classes" as any).select("isin,classe"),
      ]);
      const emissoes = (emissoesRes.data ?? []) as any[];
      const empresas = (empresasRes.data ?? []) as any[];
      const fidcRows = (fidcRes.data ?? []) as any[];
      const tickers = Array.from(new Set(emissoes.map(e => e.ticker).filter(Boolean))) as string[];
      const tradeAtivosRes = tickers.length
        ? await supabase.from("trade_ativos").select("ticker,sub_indexador").in("ticker", tickers)
        : { data: [] as any };
      const tradeAtivos = (tradeAtivosRes.data ?? []) as any[];

      const isinToEmissao = new Map(emissoes.map(e => [e.isin, e]));
      const tickerToSub = new Map(tradeAtivos.map(t => [t.ticker, t.sub_indexador]));
      const cnpjToEmpresa = new Map(empresas.map(e => [e.cnpj, e]));
      const isinToFidcClasse = new Map<string, FidcClasse>(fidcRows.map(r => [r.isin, r.classe as FidcClasse]));

      const totalFundo = positions.reduce((s, p) => s + p.posicao_rs, 0);

      const porTipo = new Map<string, AggBucket>();
      const porIndexador = new Map<string, AggBucket>();
      const porRating = new Map<string, AggBucket>();
      const grupoMap = new Map<string, IssuerRow>();
      let termoTotal = 0;

      const addTo = (map: Map<string, AggBucket>, key: string, value: number) => {
        const cur = map.get(key) ?? { key, total: 0, pct: 0 };
        cur.total += value;
        map.set(key, cur);
      };

      for (const p of positions) {
        const fin = p.posicao_rs;
        const tipo = tipoAtivoFromProduct(p.product, p.product_class);
        addTo(porTipo, tipo, fin);
        // Agregador "Crédito Privado"
        if (CREDITO_PRIVADO_TIPOS.has(tipo)) {
          addTo(porTipo, "Crédito Privado", fin);
        }

        const emissao = p.isin ? isinToEmissao.get(p.isin) : null;
        const sub = emissao?.ticker ? tickerToSub.get(emissao.ticker) : null;
        const indexLabel = resolveIndexador(p.product, p.product_class, sub);
        addTo(porIndexador, indexLabel, fin);

        const empresa = emissao?.cnpj_emissor ? cnpjToEmpresa.get(emissao.cnpj_emissor) : null;
        // Rating: Termo -> AAA (risco B3)
        const ratingB = isTermo(p.product, p.product_class) ? "AAA" : ratingBucket(empresa?.rating);
        addTo(porRating, ratingB, fin);

        // Termo: não listar como emissor, agregar em linha resumo
        if (isTermo(p.product, p.product_class)) {
          termoTotal += fin;
          continue;
        }

        if (empresa) {
          const isSoberano = isTesouroNacional(empresa.nome) || isTesouroNacional(empresa.grupo_economico);
          const grupoKey = isSoberano
            ? "Tesouro Nacional"
            : (empresa.grupo_economico?.trim() || empresa.nome);
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
              ratingBucket: isSoberano ? "AAA" : ratingB,
              total: fin,
              pct: 0,
              isSoberano,
            });
          }
        }
      }

      const finalize = (map: Map<string, AggBucket>) => {
        for (const v of map.values()) v.pct = totalFundo > 0 ? (v.total / totalFundo) * 100 : 0;
      };
      finalize(porTipo); finalize(porIndexador); finalize(porRating);

      const porGrupo: IssuerRow[] = Array.from(grupoMap.values()).map(g => ({
        ...g,
        pct: totalFundo > 0 ? (g.total / totalFundo) * 100 : 0,
        ratingBucket: g.isSoberano ? "AAA" : worstRating(g.emissores.map(e => ratingBucket(e.rating))),
      })).sort((a, b) => b.pct - a.pct);

      // Linha resumo de Termo
      if (termoTotal > 0) {
        porGrupo.push({
          grupo: "Termo (B3)",
          emissores: [],
          ratingBucket: "AAA",
          total: termoTotal,
          pct: totalFundo > 0 ? (termoTotal / totalFundo) * 100 : 0,
          isTermoSummary: true,
        });
      }

      return { loading: false, valDate, totalFundo, porTipo, porIndexador, porRating, porGrupo };
    },
  });
}
