// Hook que cruza posições (BASE LOTE 45) com empresas/emissões/trade_ativos/análises
// para a aba "Exposição por Grupo / Emissor" da página Posições.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveRatingsBatch, ratingKey } from "@/lib/ratings/resolveRatingsBatch";
import type { ResolvedRating } from "@/lib/ratings/useResolvedRating";
import { worstRating, ratingBucket, synthesizeIssuerFromProduct, isExcludedFromPL } from "@/components/alocacao/allocationUtils";
import { getDisplayStatus, fetchAllPaged } from "@/utils/analiseStatus";

export type StatusKey =
  | "Aprovado"
  | "Com restrição"
  | "Em análise"
  | "Pendente"
  | "Vencido"
  | "Sem análise"
  | "Não aprovado";

const STATUS_SEVERITY: Record<StatusKey, number> = {
  "Não aprovado": 1,
  Vencido: 2,
  "Com restrição": 3,
  Pendente: 4,
  "Em análise": 5,
  "Sem análise": 6,
  Aprovado: 7,
};

export function mostSevereStatus(list: StatusKey[]): StatusKey {
  if (!list.length) return "Sem análise";
  return list.reduce((a, b) => (STATUS_SEVERITY[a] <= STATUS_SEVERITY[b] ? a : b));
}

function mapDisplayToStatus(s: string | undefined | null): StatusKey {
  if (!s) return "Sem análise";
  const v = s.toString();
  if (v === "Aprovada" || v === "Concluída" || v === "Buy" || v === "Hold") return "Aprovado";
  if (v === "Sell" || v === "Reprovada") return "Não aprovado";
  if (v === "Vencida") return "Vencido";
  if (v === "Em Análise") return "Em análise";
  if (v === "Pendente") return "Pendente";
  return "Sem análise";
}

const normCnpj = (s?: string | null) => (s ?? "").replace(/[^0-9]/g, "");

export interface AssetRow {
  posicaoId: string;
  ticker: string | null;
  isin: string | null;
  produto: string;
  tipoAtivo: string;
  fundo: string;
  valor: number;
  pctFundo: number | null;
  taxaLabel: string | null;
  taxaNum: number | null; // spread_emissao em % (para média ponderada)
  vencimento: string | null;
  durationDU: number | null;
  cnpj: string;
  emissorNome: string;
  grupoEconomico: string;
  setor: string;
  ratingResolved: ResolvedRating;
  ultimaAnalise: string | null;
  status: StatusKey;
}

export interface EmissorAgg {
  cnpj: string;
  nome: string;
  grupoEconomico: string;
  setor: string;
  rating: ResolvedRating;
  ratingBucketLabel: string;
  totalButia: number;
  consolidatedPct: number | null;
  exposureByFundo: Record<string, number>;
  pctByFundo: Record<string, number | null>;
  weightedRate: number | null;
  hasTaxa: boolean;
  ultimaAnalise: string | null;
  status: StatusKey;
  ativos: AssetRow[];
  mapped: boolean;
}

export interface GrupoAgg {
  grupo: string;
  nEmissores: number;
  ratingBucketLabel: string;
  setor: string;
  totalButia: number;
  consolidatedPct: number | null;
  exposureByFundo: Record<string, number>;
  pctByFundo: Record<string, number | null>;
  weightedRate: number | null;
  hasTaxa: boolean;
  ultimaAnalise: string | null;
  status: StatusKey;
  emissores: EmissorAgg[];
  mapped: boolean;
}

export interface ExposicaoData {
  valDate: string;
  fundos: string[];
  plByFundo: Record<string, number>;
  totalPosicoes: number;
  porGrupo: GrupoAgg[];
  porEmissor: EmissorAgg[];
  unmappedIssuersCount: number;
  unmappedGroupsCount: number;
  assetsWithoutRate: number;
}

interface Posicao {
  id: string;
  trading_desk_share_source: string;
  val_date: string;
  product_class: string | null;
  product: string | null;
  amount: number | null;
  isin: string | null;
  financial_price: number | null;
  duration_du: number | null;
  yield: number | null;
}

interface EmissaoRow {
  isin: string;
  ticker: string | null;
  cnpj_emissor: string | null;
}

interface EmpresaRow {
  cnpj: string;
  nome: string;
  setor: string | null;
  grupo_economico: string | null;
  rating: string | null;
}

interface TradeAtivoRow {
  ticker: string;
  emissor_cnpj: string | null;
  emissor_nome: string | null;
  venc_date: string | null;
  taxa_emissao: string | null;
  spread_emissao: number | null;
  rating: string | null;
  data_rating: string | null;
  indexador: string | null;
}

interface AnaliseRow {
  empresa_id: string;
  status: string;
  data_conclusao: string | null;
  prazo: string | null;
  data_aprovacao: string | null;
  data_comite: string | null;
  recomendacao: string | null;
  recomendacao_rf: string | null;
  tipo: string | null;
  updated_at: string;
}

export function useExposicaoData(valDate: string | null) {
  return useQuery<ExposicaoData>({
    queryKey: ["exposicao-grupo-emissor", valDate],
    enabled: !!valDate,
    staleTime: 60_000,
    queryFn: async () => {
      // 1) Posições da data (exclui DAP/Futuros — não contam para PL)
      const posicoesRaw = await fetchAllPaged<Posicao>((from, to) =>
        supabase
          .from("posicoes")
          .select(
            "id,trading_desk_share_source,val_date,product_class,product,amount,isin,financial_price,duration_du,yield",
          )
          .eq("val_date", valDate as string)
          .range(from, to),
      );
      const posicoes = posicoesRaw.filter(
        (p) => !isExcludedFromPL(p.product ?? "", p.product_class ?? ""),
      );

      const fundosSet = new Set<string>();
      const isinsSet = new Set<string>();
      for (const p of posicoes) {
        if (p.trading_desk_share_source) fundosSet.add(p.trading_desk_share_source);
        if (p.isin) isinsSet.add(p.isin);
      }
      const fundos = Array.from(fundosSet).sort();

      // PL por fundo
      const plByFundo: Record<string, number> = {};
      let totalPosicoes = 0;
      for (const p of posicoes) {
        const v = (Number(p.amount) || 0) * (Number(p.financial_price) || 0);
        if (!Number.isFinite(v) || v === 0) continue;
        plByFundo[p.trading_desk_share_source] =
          (plByFundo[p.trading_desk_share_source] ?? 0) + v;
        totalPosicoes += v;
      }

      // 2) Emissoes pelos ISINs presentes
      const isins = Array.from(isinsSet);
      const emissoesMap = new Map<string, EmissaoRow>();
      const CHUNK = 200;
      for (let i = 0; i < isins.length; i += CHUNK) {
        const slice = isins.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from("emissoes")
          .select("isin,ticker,cnpj_emissor")
          .in("isin", slice);
        if (error) throw error;
        for (const r of (data ?? []) as EmissaoRow[]) emissoesMap.set(r.isin, r);
      }

      // 3) Empresas (todas)
      const empresas = await fetchAllPaged<EmpresaRow>((from, to) =>
        supabase.from("empresas").select("cnpj,nome,setor,grupo_economico,rating").range(from, to),
      );
      const empresaByCnpj = new Map<string, EmpresaRow>();
      for (const e of empresas) empresaByCnpj.set(normCnpj(e.cnpj), e);

      // 4) Trade ativos (apenas tickers que aparecem nas emissões)
      const tickers = Array.from(
        new Set(Array.from(emissoesMap.values()).map((e) => e.ticker).filter(Boolean) as string[]),
      );
      const ativoByTicker = new Map<string, TradeAtivoRow>();
      for (let i = 0; i < tickers.length; i += CHUNK) {
        const slice = tickers.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from("trade_ativos")
          .select(
            "ticker,emissor_cnpj,emissor_nome,venc_date,taxa_emissao,spread_emissao,rating,data_rating,indexador",
          )
          .in("ticker", slice);
        if (error) throw error;
        for (const r of (data ?? []) as TradeAtivoRow[]) ativoByTicker.set(r.ticker, r);
      }

      // 5) Análises - pegar a mais recente por empresa_id (CNPJ formatado)
      const analises = await fetchAllPaged<AnaliseRow>((from, to) =>
        supabase
          .from("analises")
          .select(
            "empresa_id,status,data_conclusao,prazo,data_aprovacao,data_comite,recomendacao,recomendacao_rf,tipo,updated_at",
          )
          .order("updated_at", { ascending: false })
          .range(from, to),
      );
      const analiseByCnpj = new Map<string, AnaliseRow>();
      for (const a of analises) {
        const k = normCnpj(a.empresa_id);
        if (!k) continue;
        if (!analiseByCnpj.has(k)) analiseByCnpj.set(k, a);
      }

      // 6) Ratings resolvidos por CNPJ/ticker
      const ratingItems: Array<{ cnpj: string; ticker: string | null }> = [];
      for (const p of posicoes) {
        const em = p.isin ? emissoesMap.get(p.isin) : null;
        const cnpj = normCnpj(em?.cnpj_emissor);
        ratingItems.push({ cnpj, ticker: em?.ticker ?? null });
      }
      const ratingMap = await resolveRatingsBatch(ratingItems);

      // 7) Construir AssetRows
      const assets: AssetRow[] = [];
      let assetsWithoutRate = 0;
      for (const p of posicoes) {
        const valor = (Number(p.amount) || 0) * (Number(p.financial_price) || 0);
        if (!Number.isFinite(valor) || valor === 0) continue;

        const em = p.isin ? emissoesMap.get(p.isin) ?? null : null;
        const ativo = em?.ticker ? ativoByTicker.get(em.ticker) ?? null : null;
        const rawCnpj = em?.cnpj_emissor ?? ativo?.emissor_cnpj ?? null;
        let cnpj = normCnpj(rawCnpj);
        let empresa = cnpj ? empresaByCnpj.get(cnpj) ?? null : null;

        let emissorNome = empresa?.nome ?? ativo?.emissor_nome ?? "Emissor não mapeado";
        let grupo = empresa?.grupo_economico?.trim() || "Grupo não mapeado";
        let setor = empresa?.setor ?? "—";

        let resolved: ResolvedRating =
          ratingMap.get(ratingKey(cnpj, em?.ticker ?? null)) ?? {
            rating: null,
            source: "nr" as const,
            agencia: null,
            data_rating: null,
          };

        // Emissor sintético para Termo (B3/TERMO) e Overnight/LFT (Tesouro/CAIXA/Soberano)
        const synth = synthesizeIssuerFromProduct(p.product, p.product_class);
        if (synth) {
          const synthCnpj = normCnpj(synth.cnpj);
          const empReal = empresaByCnpj.get(synthCnpj) ?? null;
          cnpj = synthCnpj;
          empresa = empReal;
          emissorNome = synth.nome;
          grupo = synth.grupoEconomico;
          setor = empReal?.setor ?? synth.setor;
          resolved = {
            rating: synth.rating,
            source: "emissor" as const,
            agencia: null,
            data_rating: null,
          };
        }

        // taxa
        let taxaLabel: string | null = null;
        let taxaNum: number | null = null;
        if (ativo?.taxa_emissao && ativo.taxa_emissao.trim()) taxaLabel = ativo.taxa_emissao.trim();
        if (ativo?.spread_emissao != null && Number.isFinite(Number(ativo.spread_emissao)))
          taxaNum = Number(ativo.spread_emissao);
        else if (p.yield != null && Number.isFinite(Number(p.yield))) taxaNum = Number(p.yield);
        if (taxaNum == null) assetsWithoutRate += 1;

        // análise
        const analise = cnpj ? analiseByCnpj.get(cnpj) ?? null : null;
        const display = analise
          ? getDisplayStatus(analise as any)
          : null;
        const status = mapDisplayToStatus(display);

        assets.push({
          posicaoId: p.id,
          ticker: em?.ticker ?? null,
          isin: p.isin,
          produto: p.product ?? "—",
          tipoAtivo: p.product_class ?? "—",
          fundo: p.trading_desk_share_source,
          valor,
          pctFundo: plByFundo[p.trading_desk_share_source]
            ? valor / plByFundo[p.trading_desk_share_source]
            : null,
          taxaLabel,
          taxaNum,
          vencimento: ativo?.venc_date ?? null,
          durationDU: p.duration_du,
          cnpj,
          emissorNome,
          grupoEconomico: grupo,
          setor,
          ratingResolved: resolved,
          ultimaAnalise: analise?.data_conclusao ?? analise?.data_aprovacao ?? null,
          status,
        });
      }

      // 8) Agregação por Emissor
      const byEmissor = new Map<string, EmissorAgg>();
      for (const a of assets) {
        const key = a.cnpj || `__nm__${a.emissorNome}`;
        let e = byEmissor.get(key);
        if (!e) {
          e = {
            cnpj: a.cnpj,
            nome: a.emissorNome,
            grupoEconomico: a.grupoEconomico,
            setor: a.setor,
            rating: a.ratingResolved,
            ratingBucketLabel: ratingBucket(a.ratingResolved.rating ?? null),
            totalButia: 0,
            consolidatedPct: null,
            exposureByFundo: {},
            pctByFundo: {},
            weightedRate: null,
            hasTaxa: false,
            ultimaAnalise: a.ultimaAnalise,
            status: a.status,
            ativos: [],
            mapped: !!a.cnpj,
          };
          byEmissor.set(key, e);
        }
        e.ativos.push(a);
        e.totalButia += a.valor;
        e.exposureByFundo[a.fundo] = (e.exposureByFundo[a.fundo] ?? 0) + a.valor;
        // último status / análise mais recente
        if (STATUS_SEVERITY[a.status] < STATUS_SEVERITY[e.status]) e.status = a.status;
        if (a.ultimaAnalise && (!e.ultimaAnalise || a.ultimaAnalise > e.ultimaAnalise))
          e.ultimaAnalise = a.ultimaAnalise;
      }
      const totalPL = Object.values(plByFundo).reduce((s, v) => s + v, 0);
      for (const e of byEmissor.values()) {
        // pct por fundo + taxa ponderada
        for (const fundo of Object.keys(e.exposureByFundo)) {
          const pl = plByFundo[fundo];
          e.pctByFundo[fundo] = pl ? e.exposureByFundo[fundo] / pl : null;
        }
        let num = 0;
        let den = 0;
        for (const a of e.ativos) {
          if (a.taxaNum != null) {
            num += a.taxaNum * a.valor;
            den += a.valor;
          }
        }
        e.hasTaxa = den > 0;
        e.weightedRate = den > 0 ? num / den : null;
        e.consolidatedPct = totalPL ? e.totalButia / totalPL : null;
      }

      // 9) Agregação por Grupo
      const byGrupo = new Map<string, GrupoAgg>();
      for (const e of byEmissor.values()) {
        let g = byGrupo.get(e.grupoEconomico);
        if (!g) {
          g = {
            grupo: e.grupoEconomico,
            nEmissores: 0,
            ratingBucketLabel: "Sem Rating",
            setor: e.setor,
            totalButia: 0,
            consolidatedPct: null,
            exposureByFundo: {},
            pctByFundo: {},
            weightedRate: null,
            hasTaxa: false,
            ultimaAnalise: null,
            status: "Sem análise",
            emissores: [],
            mapped: e.grupoEconomico !== "Grupo não mapeado",
          };
          byGrupo.set(e.grupoEconomico, g);
        }
        g.emissores.push(e);
        g.totalButia += e.totalButia;
        for (const [f, v] of Object.entries(e.exposureByFundo)) {
          g.exposureByFundo[f] = (g.exposureByFundo[f] ?? 0) + v;
        }
      }
      for (const g of byGrupo.values()) {
        g.nEmissores = g.emissores.length;
        // rating: pior bucket dos emissores
        const buckets = g.emissores.map((e) => e.ratingBucketLabel);
        g.ratingBucketLabel = worstRating(buckets);
        // setor: maior exposição
        const setorAgg = new Map<string, number>();
        for (const e of g.emissores) setorAgg.set(e.setor, (setorAgg.get(e.setor) ?? 0) + e.totalButia);
        g.setor = Array.from(setorAgg.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
        // status mais severo
        g.status = mostSevereStatus(g.emissores.map((e) => e.status));
        g.ultimaAnalise = g.emissores
          .map((e) => e.ultimaAnalise)
          .filter(Boolean)
          .sort()
          .pop() ?? null;
        for (const f of Object.keys(g.exposureByFundo)) {
          const pl = plByFundo[f];
          g.pctByFundo[f] = pl ? g.exposureByFundo[f] / pl : null;
        }
        // taxa ponderada
        let num = 0;
        let den = 0;
        for (const e of g.emissores) {
          for (const a of e.ativos) {
            if (a.taxaNum != null) {
              num += a.taxaNum * a.valor;
              den += a.valor;
            }
          }
        }
        g.hasTaxa = den > 0;
        g.weightedRate = den > 0 ? num / den : null;
        g.consolidatedPct = totalPL ? g.totalButia / totalPL : null;
      }

      const porGrupo = Array.from(byGrupo.values()).sort((a, b) => b.totalButia - a.totalButia);
      const porEmissor = Array.from(byEmissor.values()).sort((a, b) => b.totalButia - a.totalButia);

      return {
        valDate: valDate as string,
        fundos,
        plByFundo,
        totalPosicoes,
        porGrupo,
        porEmissor,
        unmappedIssuersCount: porEmissor.filter((e) => !e.mapped).length,
        unmappedGroupsCount: porGrupo.filter((g) => !g.mapped).length,
        assetsWithoutRate,
      };
    },
  });
}
