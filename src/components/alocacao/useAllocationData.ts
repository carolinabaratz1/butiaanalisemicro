import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  FundoKey, sourceFromFundo, tipoAtivoFromProduct, ratingBucket, worstRating,
  isExcludedFromPL, isTermo, isTesouroNacional, resolveIndexador, CREDITO_PRIVADO_TIPOS,
  fidcTipoFromClasse, FidcClasse,
} from "./allocationUtils";
import { getDisplayStatus } from "@/utils/analiseStatus";
import { resolveRatingsBatch, ratingKey } from "@/lib/ratings/resolveRatingsBatch";
import type { RatingSource } from "@/lib/ratings/useResolvedRating";

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
  limite_pct: number | null;
  updated_at: string;
}

export function useAllocationTargets(periodId?: string | null) {
  return useQuery({
    queryKey: ["allocation_targets", periodId ?? "all"],
    queryFn: async (): Promise<TargetRow[]> => {
      let q: any = supabase
        .from("allocation_targets" as any)
        .select("id,period_id,fundo,tipo_ativo,target_pct,limite_pct,updated_at");
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

export interface AtivoInfo {
  ticker: string;
  isin: string | null;
  emissorNome: string;
  emissorCnpj: string;
  inCarteira: boolean;
  indexador: string | null;
  subIndexador: string | null;
  taxaEmissao: string | null;
  lastSpread: number | null;
  ntnbTaxa: number | null;
  vencDate: string | null;
  anosVenc: number | null;
  duration: number | null;
  yieldAbs: number | null;
  pu: number | null;
  puPar: number | null;
  quantidade: number | null;
  posicaoRs: number | null;
}

export interface IssuerRow {
  grupo: string;
  emissores: {
    nome: string; cnpj: string; empresaId: string | null; rating: string | null;
    ratingSource?: RatingSource; ratingAgencia?: string | null; ratingDate?: string | null;
  }[];
  ratingBucket: string;
  ratingSource?: RatingSource;
  ratingAgencia?: string | null;
  ratingDate?: string | null;
  total: number;
  pct: number;
  isSoberano?: boolean;
  isTermoSummary?: boolean;
  statusAnalise?: string | null;
  ativos?: AtivoInfo[];
}

export interface AtivoBreakdown {
  ticker: string;
  emissor: string;
  posicaoRs: number;
  pct: number;
}

export interface AllocationData {
  loading: boolean;
  valDate: string | null;
  totalFundo: number;
  porTipo: Map<string, AggBucket>;
  porIndexador: Map<string, AggBucket>;
  porRating: Map<string, AggBucket>;
  porSetor: Map<string, AggBucket>;
  porGrupo: IssuerRow[];
  breakdownPorTipo: Map<string, AtivoBreakdown[]>;
  breakdownPorIndexador: Map<string, AtivoBreakdown[]>;
  breakdownPorRating: Map<string, AtivoBreakdown[]>;
  breakdownPorSetor: Map<string, AtivoBreakdown[]>;
}

export interface SetorTargetRow {
  id?: string;
  period_id: string;
  fundo: string;
  setor: string;
  target_pct: number | null;
  limite_pct: number | null;
  updated_at?: string;
}

export function useAllocationSetorTargets(periodId?: string | null, fundo?: FundoKey) {
  return useQuery({
    queryKey: ["allocation_targets_setor", periodId ?? "none", fundo ?? "all"],
    queryFn: async (): Promise<SetorTargetRow[]> => {
      if (!periodId) return [];
      let q: any = supabase
        .from("allocation_targets_setor" as any)
        .select("id,period_id,fundo,setor,target_pct,limite_pct,updated_at")
        .eq("period_id", periodId);
      if (fundo) q = q.eq("fundo", fundo);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any;
    },
    enabled: !!periodId,
  });
}

async function fetchFundDates(source: string): Promise<string[]> {
  const { data, error } = await supabase.rpc(
    "get_posicoes_val_dates_by_source" as any,
    { p_source: source }
  );
  if (error) throw error;
  return ((data as any[]) ?? [])
    .map((r) => r.val_date_text as string)
    .filter(Boolean);
}

export function useAllocationDates(fundo: FundoKey) {
  const source = sourceFromFundo(fundo);
  return useQuery({
    queryKey: ["alocacao-dates", fundo],
    queryFn: async (): Promise<string[]> => fetchFundDates(source),
  });
}

export function useAllocationData(fundo: FundoKey, valDateOverride?: string | null) {
  return useQuery({
    queryKey: ["alocacao", fundo, valDateOverride ?? "latest"],
    queryFn: async (): Promise<AllocationData> => {
      const source = sourceFromFundo(fundo);

      let valDate: string | null = valDateOverride ?? null;
      if (!valDate) {
        const dates = await fetchFundDates(source);
        valDate = dates[0] ?? null;
      }


      if (!valDate) {
        return {
          loading: false, valDate: null, totalFundo: 0,
          porTipo: new Map(), porIndexador: new Map(), porRating: new Map(), porSetor: new Map(), porGrupo: [],
          breakdownPorTipo: new Map(), breakdownPorIndexador: new Map(), breakdownPorRating: new Map(), breakdownPorSetor: new Map(),
        };
      }

      const { data: posicoes, error: posErr } = await supabase
        .from("posicoes")
        .select("isin,product,product_class,amount,financial_price,duration_du,yield")
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

      const emissoesRes = isins.length
        ? await supabase.from("emissoes").select("isin,cnpj_emissor,ticker,fidc_classe,fidc_tipo" as any).in("isin", isins)
        : { data: [] as any };
      const emissoes = (emissoesRes.data ?? []) as any[];
      const cnpjsNeeded = Array.from(new Set(emissoes.map(e => e.cnpj_emissor).filter(Boolean))) as string[];
      const empresasRes = cnpjsNeeded.length
        ? await supabase.from("empresas").select("id,cnpj,nome,grupo_economico,rating,tipo").in("cnpj", cnpjsNeeded)
        : { data: [] as any };
      const empresas = (empresasRes.data ?? []) as any[];

      // Resolve ratings via RPC (hierarchy: ticker → emissor → grupo → N/R).
      // Overwrite empresa.rating with the resolved value so the existing
      // downstream code automatically uses ticker/issuer/group fallback,
      // while exposing the source for badge rendering.
      const ratingResolvedMap = empresas.length
        ? await resolveRatingsBatch(empresas.map((e) => ({ cnpj: e.cnpj })))
        : new Map();
      const ratingByCnpj = new Map<string, { rating: string | null; source: RatingSource; agencia: string | null; data_rating: string | null }>();
      for (const e of empresas) {
        const r = ratingResolvedMap.get(ratingKey(e.cnpj));
        if (r) {
          ratingByCnpj.set(e.cnpj, r);
          if (r.rating) e.rating = r.rating; // keep legacy field in sync
        }
      }

      // Buscar TODOS os tickers (em carteira ou não) dos emissores envolvidos
      const tradeAtivosGrupoRes = cnpjsNeeded.length
        ? await supabase
            .from("trade_ativos")
            .select("ticker,nome_completo,emissor_cnpj,emissor_nome,indexador,sub_indexador,taxa_emissao,venc_date,anos_venc")
            .in("emissor_cnpj", cnpjsNeeded)
        : { data: [] as any };
      const tradeAtivosGrupo = (tradeAtivosGrupoRes.data ?? []) as any[];

      // Garantir que tickers vindos da carteira (via emissoes) entrem mesmo se não estiverem em trade_ativos
      const tickersCarteira = Array.from(new Set(emissoes.map(e => e.ticker).filter(Boolean))) as string[];
      const allTickersSet = new Set<string>([
        ...tradeAtivosGrupo.map(t => t.ticker),
        ...tickersCarteira,
      ]);

      const tradeMetricasRes = allTickersSet.size
        ? await supabase
            .from("trade_metricas")
            .select("ticker,indexador,last_val,pu_curva,pu_indicativo,ntnb_taxa")
            .in("ticker", Array.from(allTickersSet))
        : { data: [] as any };
      const tradeMetricas = (tradeMetricasRes.data ?? []) as any[];
      const tickerToMetricas = new Map(tradeMetricas.map(m => [m.ticker, m]));

      // Para tickers da carteira que não vieram em tradeAtivosGrupo (sem cadastro), buscar metadados
      const missingTickers = tickersCarteira.filter(t => !tradeAtivosGrupo.find(a => a.ticker === t));
      const tradeAtivosExtraRes = missingTickers.length
        ? await supabase
            .from("trade_ativos")
            .select("ticker,nome_completo,emissor_cnpj,emissor_nome,indexador,sub_indexador,taxa_emissao,venc_date,anos_venc")
            .in("ticker", missingTickers)
        : { data: [] as any };
      const tradeAtivosAll: any[] = [...tradeAtivosGrupo, ...((tradeAtivosExtraRes.data ?? []) as any[])];
      const tickerToAtivo = new Map(tradeAtivosAll.map(a => [a.ticker, a]));
      const tickerToSub = new Map(tradeAtivosAll.map(t => [t.ticker, t.sub_indexador]));

      // Análises (última versão por empresa, tipo Crédito Privado)
      const empresaIds = empresas.map(e => e.cnpj);
      const analisesRes = empresaIds.length
        ? await supabase
            .from("analises")
            .select("empresa_id,tipo,status,recomendacao,recomendacao_rf,data_aprovacao,data_conclusao,data_comite,prazo,versao,updated_at")
            .eq("tipo", "Crédito Privado")
            .in("empresa_id", empresaIds)
        : { data: [] as any };
      const analises = (analisesRes.data ?? []) as any[];
      const latestAnalisePorCnpj = new Map<string, any>();
      for (const a of analises) {
        const cur = latestAnalisePorCnpj.get(a.empresa_id);
        if (!cur || (a.versao ?? 0) > (cur.versao ?? 0)) {
          latestAnalisePorCnpj.set(a.empresa_id, a);
        }
      }

      const isinToEmissao = new Map(emissoes.map(e => [e.isin, e]));
      const cnpjToEmpresa = new Map(empresas.map(e => [e.cnpj, e]));
      const isinToFidcClasse = new Map<string, FidcClasse>(
        emissoes
          .filter(e => e.fidc_tipo === "Não Padronizado" || e.fidc_classe === "Sênior" || e.fidc_classe === "Mezanino")
          .map(e => [e.isin, (e.fidc_tipo === "Não Padronizado" ? "NP" : e.fidc_classe) as FidcClasse])
      );

      const totalFundo = positions.reduce((s, p) => s + p.posicao_rs, 0);

      const porTipo = new Map<string, AggBucket>();
      const porIndexador = new Map<string, AggBucket>();
      const porRating = new Map<string, AggBucket>();
      const porSetor = new Map<string, AggBucket>();
      const grupoMap = new Map<string, IssuerRow>();
      // ticker -> AtivoInfo (em carteira), por grupo
      const grupoAtivosCarteira = new Map<string, Map<string, AtivoInfo>>();
      // breakdown: categoria_key -> ticker -> AtivoBreakdown (acumulado)
      const breakdownPorTipo = new Map<string, Map<string, AtivoBreakdown>>();
      const breakdownPorIndexador = new Map<string, Map<string, AtivoBreakdown>>();
      const breakdownPorRating = new Map<string, Map<string, AtivoBreakdown>>();
      const breakdownPorSetor = new Map<string, Map<string, AtivoBreakdown>>();
      let termoTotal = 0;

      const addBreakdown = (
        map: Map<string, Map<string, AtivoBreakdown>>,
        key: string,
        ticker: string,
        emissor: string,
        value: number,
      ) => {
        let inner = map.get(key);
        if (!inner) { inner = new Map(); map.set(key, inner); }
        const id = ticker || `(sem ticker) ${emissor}`;
        const cur = inner.get(id);
        if (cur) cur.posicaoRs += value;
        else inner.set(id, { ticker: id, emissor, posicaoRs: value, pct: 0 });
      };

      const addTo = (map: Map<string, AggBucket>, key: string, value: number) => {
        const cur = map.get(key) ?? { key, total: 0, pct: 0 };
        cur.total += value;
        map.set(key, cur);
      };

      const buildAtivo = (
        ticker: string,
        emissorNome: string,
        emissorCnpj: string,
        inCarteira: boolean,
        pos?: any,
      ): AtivoInfo => {
        const ativo = tickerToAtivo.get(ticker);
        const m = tickerToMetricas.get(ticker);
        return {
          ticker,
          isin: pos?.isin ?? null,
          emissorNome,
          emissorCnpj,
          inCarteira,
          indexador: ativo?.indexador ?? null,
          subIndexador: ativo?.sub_indexador ?? null,
          taxaEmissao: ativo?.taxa_emissao ?? null,
          lastSpread: m?.last_val != null ? Number(m.last_val) : null,
          ntnbTaxa: m?.ntnb_taxa != null ? Number(m.ntnb_taxa) : null,
          vencDate: ativo?.venc_date ?? null,
          anosVenc: ativo?.anos_venc != null ? Number(ativo.anos_venc) : null,
          duration: pos?.duration_du != null ? Number(pos.duration_du) : null,
          yieldAbs: pos?.yield != null ? Number(pos.yield) : null,
          pu: m?.pu_indicativo != null ? Number(m.pu_indicativo) : (pos?.financial_price ?? null),
          puPar: m?.pu_curva != null ? Number(m.pu_curva) : null,
          quantidade: pos?.amount != null ? Number(pos.amount) : null,
          posicaoRs: pos?.posicao_rs ?? null,
        };
      };

      for (const p of positions) {
        const fin = p.posicao_rs;
        let tipo = tipoAtivoFromProduct(p.product, p.product_class);
        if (tipo === "Cotas de Fundos CP" && p.isin) {
          tipo = fidcTipoFromClasse(isinToFidcClasse.get(p.isin) ?? null);
        }
        addTo(porTipo, tipo, fin);
        if (CREDITO_PRIVADO_TIPOS.has(tipo)) {
          addTo(porTipo, "Crédito Privado", fin);
        }

        const emissao = p.isin ? isinToEmissao.get(p.isin) : null;
        const sub = emissao?.ticker ? tickerToSub.get(emissao.ticker) : null;
        const indexLabel = resolveIndexador(p.product, p.product_class, sub);
        addTo(porIndexador, indexLabel, fin);

        const empresa = emissao?.cnpj_emissor ? cnpjToEmpresa.get(emissao.cnpj_emissor) : null;
        const ratingB = isTermo(p.product, p.product_class) ? "AAA" : ratingBucket(empresa?.rating);
        addTo(porRating, ratingB, fin);

        if (isTermo(p.product, p.product_class)) {
          termoTotal += fin;
          const tk = emissao?.ticker || "(Termo)";
          const em = empresa?.nome || "Termo (B3)";
          addBreakdown(breakdownPorTipo, tipo, tk, em, fin);
          if (CREDITO_PRIVADO_TIPOS.has(tipo)) addBreakdown(breakdownPorTipo, "Crédito Privado", tk, em, fin);
          addBreakdown(breakdownPorIndexador, indexLabel, tk, em, fin);
          addBreakdown(breakdownPorRating, ratingB, tk, em, fin);
          continue;
        }

        // Overnight / Compromissadas / LFT (Tesouro) — agregar sob Tesouro Nacional
        const prodLc = (p.product || "").toLowerCase();
        const classLc = (p.product_class || "").toLowerCase();
        const isOvernightOrTesouro =
          prodLc.includes("overnight") || classLc.includes("overnight") ||
          prodLc.includes("compromiss") || classLc.includes("compromiss") ||
          prodLc.includes("lft") || prodLc.includes("ltn") || prodLc.includes("ntn");

        let empresaEff = empresa;
        let isSoberanoEff = !!empresa && (isTesouroNacional(empresa.nome) || isTesouroNacional(empresa.grupo_economico));
        if (!empresaEff && isOvernightOrTesouro) {
          // Sintetiza emissor Tesouro Nacional para garantir agregação no grupo
          empresaEff = cnpjToEmpresa.get("00.000.000/0001-91") || {
            id: null,
            cnpj: "00.000.000/0001-91",
            nome: "TESOURO NACIONAL",
            grupo_economico: "Tesouro Nacional",
            rating: "AAA",
            setor: "Título Público",
          } as any;
          isSoberanoEff = true;
        } else if (empresaEff && isOvernightOrTesouro) {
          isSoberanoEff = true;
        }

        // Determinar setor
        let setorKey: string;
        if (isSoberanoEff) setorKey = "Título Público";
        else if (tipo === "FIDC Cota Sênior" || tipo === "FIDC Mezanino" || tipo === "FIDC NP" || tipo === "Cotas de Fundos CP") setorKey = "FIDC";
        else setorKey = (empresaEff as any)?.setor?.trim() || "Sem Setor";
        addTo(porSetor, setorKey, fin);

        // Breakdown por categoria
        const tickerKey = emissao?.ticker || "(sem ticker)";
        const emissorNome = empresaEff?.nome || "—";
        addBreakdown(breakdownPorTipo, tipo, tickerKey, emissorNome, fin);
        if (CREDITO_PRIVADO_TIPOS.has(tipo)) addBreakdown(breakdownPorTipo, "Crédito Privado", tickerKey, emissorNome, fin);
        addBreakdown(breakdownPorIndexador, indexLabel, tickerKey, emissorNome, fin);
        addBreakdown(breakdownPorRating, ratingB, tickerKey, emissorNome, fin);
        addBreakdown(breakdownPorSetor, setorKey, tickerKey, emissorNome, fin);

        if (empresaEff) {
          const grupoKey = isSoberanoEff
            ? "CAIXA"
            : (empresaEff.grupo_economico?.trim() || empresaEff.nome);
          const resolvedR = ratingByCnpj.get(empresaEff.cnpj);
          const emissorEntry = {
            nome: empresaEff.nome, cnpj: empresaEff.cnpj, empresaId: empresaEff.id, rating: empresaEff.rating,
            ratingSource: isSoberanoEff ? ("emissor" as RatingSource) : (resolvedR?.source ?? ("nr" as RatingSource)),
            ratingAgencia: resolvedR?.agencia ?? null,
            ratingDate: resolvedR?.data_rating ?? null,
          };
          const existing = grupoMap.get(grupoKey);
          if (existing) {
            existing.total += fin;
            if (!existing.emissores.find(e => e.cnpj === empresaEff!.cnpj)) {
              existing.emissores.push(emissorEntry);
            }
          } else {
            grupoMap.set(grupoKey, {
              grupo: grupoKey,
              emissores: [emissorEntry],
              ratingBucket: isSoberanoEff ? "AAA" : ratingB,
              total: fin,
              pct: 0,
              isSoberano: isSoberanoEff,
            });
          }

          // Coleta ativo em carteira (quando há ticker)
          if (emissao?.ticker) {
            let map = grupoAtivosCarteira.get(grupoKey);
            if (!map) { map = new Map(); grupoAtivosCarteira.set(grupoKey, map); }
            const existingAtivo = map.get(emissao.ticker);
            if (existingAtivo) {
              existingAtivo.quantidade = (existingAtivo.quantidade ?? 0) + (Number(p.amount) || 0);
              existingAtivo.posicaoRs = (existingAtivo.posicaoRs ?? 0) + fin;
            } else {
              map.set(emissao.ticker, buildAtivo(emissao.ticker, empresaEff.nome, empresaEff.cnpj, true, p));
            }
          }
        }
      }


      const finalize = (map: Map<string, AggBucket>) => {
        for (const v of map.values()) v.pct = totalFundo > 0 ? (v.total / totalFundo) * 100 : 0;
      };
      finalize(porTipo); finalize(porIndexador); finalize(porRating); finalize(porSetor);

      const finalizeBreakdown = (m: Map<string, Map<string, AtivoBreakdown>>) => {
        const out = new Map<string, AtivoBreakdown[]>();
        for (const [k, inner] of m.entries()) {
          const arr = Array.from(inner.values())
            .map(a => ({ ...a, pct: totalFundo > 0 ? (a.posicaoRs / totalFundo) * 100 : 0 }))
            .sort((a, b) => b.posicaoRs - a.posicaoRs);
          out.set(k, arr);
        }
        return out;
      };
      const breakdownTipoOut = finalizeBreakdown(breakdownPorTipo);
      const breakdownIndexOut = finalizeBreakdown(breakdownPorIndexador);
      const breakdownRatingOut = finalizeBreakdown(breakdownPorRating);
      const breakdownSetorOut = finalizeBreakdown(breakdownPorSetor);

      // CNPJ -> grupoKey
      const cnpjToGrupo = new Map<string, string>();
      for (const [grupoKey, row] of grupoMap.entries()) {
        for (const e of row.emissores) cnpjToGrupo.set(e.cnpj, grupoKey);
      }

      const porGrupo: IssuerRow[] = Array.from(grupoMap.values()).map(g => {
        const ativosCarteiraMap = grupoAtivosCarteira.get(g.grupo) ?? new Map<string, AtivoInfo>();
        const ativosCarteira = Array.from(ativosCarteiraMap.values());

        // Tickers extras do grupo (não em carteira) via trade_ativos por cnpj
        const tickersDoGrupo = tradeAtivosGrupo.filter(a => a.emissor_cnpj && cnpjToGrupo.get(a.emissor_cnpj) === g.grupo);
        const extras: AtivoInfo[] = [];
        for (const a of tickersDoGrupo) {
          if (ativosCarteiraMap.has(a.ticker)) continue;
          const emp = cnpjToEmpresa.get(a.emissor_cnpj);
          extras.push(buildAtivo(a.ticker, emp?.nome ?? a.emissor_nome ?? "—", a.emissor_cnpj, false));
        }

        const ativos = [...ativosCarteira, ...extras].sort((x, y) => {
          if (x.inCarteira !== y.inCarteira) return x.inCarteira ? -1 : 1;
          return x.ticker.localeCompare(y.ticker);
        });

        // Status: usa a análise mais recente entre os emissores do grupo
        let statusAnalise: string | null = null;
        for (const e of g.emissores) {
          const an = latestAnalisePorCnpj.get(e.cnpj);
          if (!an) continue;
          const emp = cnpjToEmpresa.get(e.cnpj);
          const s = getDisplayStatus(an, emp?.tipo);
          if (s) { statusAnalise = s; break; }
        }

        // Representação da fonte do rating no nível do grupo:
        // 'grupo' se algum emissor foi resolvido por grupo, senão 'emissor' se houver
        // ao menos um com rating cadastrado, caso contrário 'nr'. Para soberano força 'emissor'.
        let groupSource: RatingSource = "nr";
        let groupAgencia: string | null = null;
        let groupDate: string | null = null;
        if (g.isSoberano) {
          groupSource = "emissor";
        } else {
          const sources = g.emissores.map(e => e.ratingSource ?? "nr");
          if (sources.some(s => s === "grupo")) groupSource = "grupo";
          else if (sources.some(s => s === "ticker")) groupSource = "ticker";
          else if (sources.some(s => s === "emissor")) groupSource = "emissor";
          const ref = g.emissores.find(e => e.ratingSource === groupSource);
          groupAgencia = ref?.ratingAgencia ?? null;
          groupDate = ref?.ratingDate ?? null;
        }

        return {
          ...g,
          pct: totalFundo > 0 ? (g.total / totalFundo) * 100 : 0,
          ratingBucket: g.isSoberano ? "AAA" : worstRating(g.emissores.map(e => ratingBucket(e.rating))),
          ratingSource: groupSource,
          ratingAgencia: groupAgencia,
          ratingDate: groupDate,
          ativos,
          statusAnalise,
        };
      }).sort((a, b) => b.pct - a.pct);

      if (termoTotal > 0) {
        porGrupo.push({
          grupo: "TERMO",
          emissores: [],
          ratingBucket: "AAA",
          total: termoTotal,
          pct: totalFundo > 0 ? (termoTotal / totalFundo) * 100 : 0,
          isTermoSummary: true,
        });
      }

      return {
        loading: false, valDate, totalFundo,
        porTipo, porIndexador, porRating, porSetor, porGrupo,
        breakdownPorTipo: breakdownTipoOut,
        breakdownPorIndexador: breakdownIndexOut,
        breakdownPorRating: breakdownRatingOut,
        breakdownPorSetor: breakdownSetorOut,
      };
    },
  });
}
