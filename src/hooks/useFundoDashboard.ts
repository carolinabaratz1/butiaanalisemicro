import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  classifyCreditEligibility,
  type CreditClassification,
  type DataQualityStatus,
} from '@/lib/posicoes/credit-eligibility';
import { resolveRatingsBatch, ratingKey } from '@/lib/ratings/resolveRatingsBatch';
import type { RatingSource } from '@/lib/ratings/useResolvedRating';
import {
  synthesizeIssuerFromProduct,
  isExcludedFromPL,
  resolveIndexador,
  isCaixaIntragrupo,
  isForcedAAAProduct,
} from '@/components/alocacao/allocationUtils';

export interface DashboardRow {
  ticker: string | null;
  isin: string | null;
  product: string | null;
  product_class: string | null;
  financial_price: number;
  amount: number | null;
  duration_du: number | null;
  vencimento: string | null;
  fundo: string;
  rating: string | null;
  indexador: string | null;
  sub_indexador: string | null;
  setor: string | null;
  grupo_economico: string | null;
  nome_emissor: string | null;
  codigo_emissor: string | null;
  cnpj_emissor: string | null;
  fidc_tipo: string | null;
  fidc_classe: string | null;
}

export interface ResolvedRatingMeta {
  rating: string | null;
  source: RatingSource;
  agencia: string | null;
  data_rating: string | null;
}

export interface ClassifiedRow extends DashboardRow, CreditClassification {
  financeiro: number;
  resolved_rating: ResolvedRatingMeta;
  indexador_resolvido: string;
}

const RATING_ORDER = [
  'AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-',
  'BBB+', 'BBB', 'BBB-', '<BBB',
];

function normalizeRating(r: string | null | undefined): string | null {
  if (!r || !r.trim()) return null;
  const up = r.trim().toUpperCase().replace(/\s+/g, '');
  const m = up.match(/^(?:BR)?(AAA|AA[+-]?|A[+-]?|BBB[+-]?)/);
  if (m && RATING_ORDER.includes(m[1])) return m[1];
  if (/^(?:BR)?[BCD]/.test(up)) return '<BBB';
  return null;
}

export interface CategoryDatum { name: string; value: number }

export interface EmissorAgg {
  codigo: string;
  nome: string;
  rating: string;
  setor: string;
  grupo: string;
  financeiro: number;
  pctPL: number;
  duration: number;
  produtos: string;
}

export interface TopPosicao {
  key: string;
  ticker: string;
  nome: string;
  tipo: string;
  emissor: string;
  cnpj_emissor: string | null;
  grupo: string;
  financeiro: number;
  pctPL: number;
  rating: string;
  ratingSource: RatingSource;
  ratingAgencia: string | null;
  ratingDate: string | null;
  setor: string;
  eligible: boolean;
  observacao: string;
  data_quality_status: DataQualityStatus;
}

export interface DiagnosticoRow {
  key: DataQualityStatus | 'elegivel' | 'nao_aplicavel';
  categoria: string;
  valor: number;
  pct: number;
  observacao: string;
}

function durationBucket(d: number | null): string {
  if (d == null) return 'S/D';
  if (d <= 252) return '0–1a';
  if (d <= 756) return '1–3a';
  if (d <= 1260) return '3–5a';
  if (d <= 1764) return '5–7a';
  return '>7a';
}
const BUCKET_ORDER = ['0–1a', '1–3a', '3–5a', '5–7a', '>7a', 'S/D'];

const NR_META: ResolvedRatingMeta = { rating: null, source: 'nr', agencia: null, data_rating: null };
const normCnpj = (c?: string | null) => (c ?? '').replace(/[^0-9]/g, '');

// Busca dinamicamente os CNPJs de fundos Butiá com perfil RF Crédito
// Privado (grupo_economico = 'Fundo RF CP' + nome contendo "buti"). Usado
// para reconhecer cotas intragrupo (um fundo Butiá aplicando em outro)
// sem precisar fixar CNPJ nenhum no código.
function useButiaRfCpCnpjs() {
  return useQuery({
    queryKey: ['butia-rf-cp-cnpjs'],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from('empresas')
        .select('cnpj,nome,grupo_economico')
        .eq('grupo_economico', 'Fundo RF CP')
        .ilike('nome', '%buti%');
      if (error) throw error;
      return new Set((data ?? []).map((r: any) => normCnpj(r.cnpj)));
    },
  });
}

export function useFundoDashboard(fundo: string | null) {
  const butiaCnpjsQuery = useButiaRfCpCnpjs();

  const q = useQuery({
    queryKey: ['fundo-dashboard', fundo],
    enabled: !!fundo,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_posicoes_dashboard_fundo' as never, {
        p_fundo: fundo,
      } as never);
      if (error) throw error;
      const rawRows = (data ?? []) as unknown as DashboardRow[];

      const rows: DashboardRow[] = [];
      for (const r of rawRows) {
        const prod = r.product ?? '';
        const cls = r.product_class ?? '';
        if (isExcludedFromPL(prod, cls)) continue;
        const synth = synthesizeIssuerFromProduct(prod, cls);
        if (synth) {
          rows.push({
            ...r,
            nome_emissor: synth.nome,
            grupo_economico: synth.grupoEconomico,
            cnpj_emissor: synth.cnpj,
            setor: synth.setor,
            rating: synth.isSoberano ? 'Soberano' : (r.rating ?? synth.rating),
          });
        } else {
          rows.push(r);
        }
      }

      // Resolve ratings por CNPJ + ISIN. O ISIN é essencial para FIDC: cada
      // cota (Sênior/Mezanino/Subordinada) tem seu próprio rating, então
      // resolver só por CNPJ do administrador/gestor misturaria ratings de
      // classes diferentes. Para os demais instrumentos (debênture, CDB,
      // etc.), a função de resolução ignora o ISIN e usa o CNPJ do emissor.
      const uniqueKeys = Array.from(
        new Map(
          rows
            .filter(r => normCnpj(r.cnpj_emissor) || r.isin)
            .map(r => [ratingKey(r.cnpj_emissor, null, r.isin), { cnpj: normCnpj(r.cnpj_emissor), isin: r.isin }]),
        ).values(),
      );
      const resolvedMap = await resolveRatingsBatch(uniqueKeys);
      const byKey = new Map<string, ResolvedRatingMeta>();
      for (const { cnpj, isin } of uniqueKeys) {
        byKey.set(ratingKey(cnpj, null, isin), resolvedMap.get(ratingKey(cnpj, null, isin)) ?? NR_META);
      }
      return { rows, ratingsByKey: byKey };
    },
  });

  const rows = q.data?.rows ?? [];
  const ratingsByKey = q.data?.ratingsByKey ?? new Map<string, ResolvedRatingMeta>();
  const butiaRfCpCnpjs = butiaCnpjsQuery.data ?? new Set<string>();

  const agg = useMemo(() => {
    const posVal = (r: DashboardRow) =>
      (Number(r.amount) || 0) * (Number(r.financial_price) || 0);

    const classified: ClassifiedRow[] = rows.map(r => {
      const cnpj = normCnpj(r.cnpj_emissor);
      const resolved = ratingsByKey.get(ratingKey(r.cnpj_emissor, null, r.isin)) ?? NR_META;
      const isCaixaGrupo = isCaixaIntragrupo(r.cnpj_emissor, butiaRfCpCnpjs);
      // DPGE e Compromissada são tratados como AAA pela estrutura/garantia do
      // próprio produto, independentemente do rating do banco emissor.
      const isForcedAAA = isForcedAAAProduct(r.product, r.product_class);
      const rowForClassify = {
        ...r,
        rating: (isCaixaGrupo || isForcedAAA) ? 'AAA' : (resolved.rating ?? null),
      };
      const indexadorResolvido = resolveIndexador(
        r.product ?? '',
        r.product_class ?? '',
        r.sub_indexador ?? null,
        {
          fidcTipo: r.fidc_tipo ?? null,
          cnpjEmissor: r.cnpj_emissor ?? null,
          butiaRfCpCnpjs,
        },
      );
      return {
        ...r,
        ...classifyCreditEligibility(rowForClassify),
        financeiro: posVal(r),
        resolved_rating: isCaixaGrupo
          ? { rating: 'AAA', source: 'emissor' as RatingSource, agencia: null, data_rating: null }
          : isForcedAAA
            ? { rating: 'AAA', source: 'regra_produto' as RatingSource, agencia: null, data_rating: null }
            : resolved,
        indexador_resolvido: indexadorResolvido,
      };
    });

    const totalPL = classified.reduce((s, r) => s + r.financeiro, 0);
    const totalAtivos = new Set(classified.map(r => r.ticker || r.isin).filter(Boolean)).size;

    const eligible = classified.filter(r => r.credit_analytics_eligible);
    const nonEligible = classified.filter(r => !r.credit_analytics_eligible);
    const plCredito = eligible.reduce((s, r) => s + r.financeiro, 0);
    const plNaoAplicavel = nonEligible.reduce((s, r) => s + r.financeiro, 0);
    const pctCredito = totalPL > 0 ? plCredito / totalPL : 0;
    const pctNaoAplicavel = totalPL > 0 ? plNaoAplicavel / totalPL : 0;

    const groupSum = (list: ClassifiedRow[], key: (r: ClassifiedRow) => string): CategoryDatum[] => {
      const m = new Map<string, number>();
      for (const r of list) {
        const k = key(r);
        m.set(k, (m.get(k) ?? 0) + r.financeiro);
      }
      return Array.from(m.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    };

    const byTipo = groupSum(classified, r => (r.product_class?.trim() || 'Outros'));
    const byIndexador = groupSum(classified, r => r.indexador_resolvido || 'Outros');

    const durMap = new Map<string, number>();
    for (const r of classified) {
      const k = durationBucket(r.duration_du == null ? null : Number(r.duration_du));
      durMap.set(k, (durMap.get(k) ?? 0) + r.financeiro);
    }
    const byDuration = BUCKET_ORDER
      .map(name => ({ name, value: durMap.get(name) ?? 0 }))
      .filter(d => d.value > 0);

    const posMap = new Map<string, TopPosicao>();
    for (const r of classified) {
      const key = (r.ticker?.trim() || r.isin?.trim() || `${r.product_class}-${r.nome_emissor}`) as string;
      const cur = posMap.get(key);
      const nome = r.nome_emissor?.trim() || r.ticker?.trim() || r.isin?.trim() || '—';
      if (cur) {
        cur.financeiro += r.financeiro;
      } else {
        const cnpj = normCnpj(r.cnpj_emissor);
        const synth = synthesizeIssuerFromProduct(r.product ?? '', r.product_class ?? '');
        const ratingLabel = (isCaixaIntragrupo(r.cnpj_emissor, butiaRfCpCnpjs) || isForcedAAAProduct(r.product, r.product_class))
          ? 'AAA'
          : synth
            ? (normalizeRating(r.resolved_rating.rating) ?? synth.rating)
            : !r.credit_analytics_eligible
              ? '—'
              : !cnpj && !r.isin
                ? 'CNPJ emissor não mapeado'
                : (normalizeRating(r.resolved_rating.rating) ?? 'Sem rating para o CNPJ');
        posMap.set(key, {
          key,
          ticker: r.ticker?.trim() || '—',
          nome,
          tipo: r.product_class?.trim() || '—',
          emissor: r.nome_emissor?.trim() || (r.credit_analytics_eligible ? 'Sem mapeamento' : '—'),
          cnpj_emissor: cnpj || null,
          grupo: r.grupo_economico?.trim() || (r.credit_analytics_eligible ? 'Grupo não mapeado' : '—'),
          financeiro: r.financeiro,
          pctPL: 0,
          rating: ratingLabel,
          ratingSource: r.resolved_rating.source,
          ratingAgencia: r.resolved_rating.agencia,
          ratingDate: r.resolved_rating.data_rating,
          setor: r.credit_analytics_eligible
            ? (r.setor?.trim() || 'Sem setor')
            : '—',
          eligible: r.credit_analytics_eligible,
          observacao: r.credit_analytics_eligible
            ? ''
            : (r.non_credit_reason ?? 'Não aplicável para análise de crédito'),
          data_quality_status: r.data_quality_status,
        });
      }
    }
    const topPosicoes = Array.from(posMap.values())
      .map(p => ({ ...p, pctPL: totalPL > 0 ? p.financeiro / totalPL : 0 }))
      .sort((a, b) => b.financeiro - a.financeiro);

    const ratingMap = new Map<string, number>();
    for (const r of eligible) {
      const cnpj = normCnpj(r.cnpj_emissor);
      const nr = normalizeRating(r.resolved_rating.rating);
      const k = nr ?? (cnpj || r.isin ? 'Sem rating para o CNPJ' : 'CNPJ não mapeado');
      ratingMap.set(k, (ratingMap.get(k) ?? 0) + r.financeiro);
    }
    const byRating = [...RATING_ORDER, 'Sem rating para o CNPJ', 'CNPJ não mapeado']
      .map(name => ({ name, value: ratingMap.get(name) ?? 0 }))
      .filter(d => d.value > 0);

    const bySetor = groupSum(eligible, r => (r.setor?.trim() || 'Sem setor')).slice(0, 10);
    const byGrupo = groupSum(eligible, r => (r.grupo_economico?.trim() || 'Grupo não mapeado')).slice(0, 10);

    type Acc = {
      codigo: string; nome: string; cnpj: string | null; rating: string;
      ratingSource: RatingSource; ratingAgencia: string | null; ratingDate: string | null;
      setor: string; grupo: string;
      financeiro: number; durWeighted: number; produtos: Set<string>;
    };
    const emiMap = new Map<string, Acc>();
    for (const r of eligible) {
      const cnpj = normCnpj(r.cnpj_emissor);
      const codigo = cnpj
        || (r.codigo_emissor && r.codigo_emissor.trim())
        || (r.nome_emissor ?? 'N/D');
      const dur = Number(r.duration_du) || 0;
      const nrLabel = !cnpj && !r.isin
        ? 'CNPJ emissor não mapeado'
        : (normalizeRating(r.resolved_rating.rating) ?? 'Sem rating para o CNPJ');
      const acc = emiMap.get(codigo) ?? {
        codigo,
        nome: r.nome_emissor?.trim() || codigo,
        cnpj: cnpj || null,
        rating: nrLabel,
        ratingSource: r.resolved_rating.source,
        ratingAgencia: r.resolved_rating.agencia,
        ratingDate: r.resolved_rating.data_rating,
        setor: r.setor?.trim() || 'Sem setor',
        grupo: r.grupo_economico?.trim() || 'Grupo não mapeado',
        financeiro: 0,
        durWeighted: 0,
        produtos: new Set<string>(),
      };
      acc.financeiro += r.financeiro;
      acc.durWeighted += dur * r.financeiro;
      if (r.product_class) acc.produtos.add(r.product_class);
      emiMap.set(codigo, acc);
    }
    const byEmissor: EmissorAgg[] = Array.from(emiMap.values())
      .map(a => ({
        codigo: a.codigo,
        nome: a.nome,
        rating: a.rating,
        setor: a.setor,
        grupo: a.grupo,
        financeiro: a.financeiro,
        pctPL: totalPL > 0 ? a.financeiro / totalPL : 0,
        duration: a.financeiro > 0 ? a.durWeighted / a.financeiro : 0,
        produtos: Array.from(a.produtos).join(', '),
      }))
      .sort((a, b) => b.financeiro - a.financeiro);

    const totalDurWeighted = classified.reduce(
      (s, r) => s + (Number(r.duration_du) || 0) * r.financeiro, 0,
    );
    const durationMedia = totalPL > 0 ? totalDurWeighted / totalPL : 0;

    const topConcentracao = topPosicoes[0]
      ? { nome: topPosicoes[0].nome, pct: topPosicoes[0].pctPL }
      : { nome: '—', pct: 0 };

    const qualidadeMedia = byRating.length && plCredito > 0
      ? byRating.reduce((best, cur) => (cur.value > best.value ? cur : best)).name
      : '—';

    const plByStatus: Record<DataQualityStatus, number> = {
      ok: 0, sem_rating: 0, cnpj_nao_mapeado: 0, sem_setor: 0, sem_mapeamento: 0, nao_aplicavel: 0,
    };
    const countByStatus: Record<DataQualityStatus, number> = {
      ok: 0, sem_rating: 0, cnpj_nao_mapeado: 0, sem_setor: 0, sem_mapeamento: 0, nao_aplicavel: 0,
    };
    for (const r of classified) {
      plByStatus[r.data_quality_status] += r.financeiro;
      countByStatus[r.data_quality_status] += 1;
    }
    const pctOf = (v: number) => (totalPL > 0 ? v / totalPL : 0);
    const pctOfCredito = (v: number) => (plCredito > 0 ? v / plCredito : 0);

    const plComRating = plByStatus.ok + plByStatus.sem_setor + plByStatus.sem_mapeamento;
    const pctComRating = pctOfCredito(plComRating);
    const pctComSetor  = pctOfCredito(plByStatus.ok + plByStatus.sem_rating + plByStatus.sem_mapeamento);
    const pctComGrupo  = pctOfCredito(plByStatus.ok + plByStatus.sem_rating + plByStatus.sem_setor);

    const emissoresSemRating = new Set<string>();
    const emissoresSemCnpj = new Set<string>();
    for (const r of eligible) {
      const cnpj = normCnpj(r.cnpj_emissor);
      const nome = r.nome_emissor?.trim() || r.ticker?.trim() || 'sem-nome';
      if (!cnpj && !r.isin) emissoresSemCnpj.add(nome);
      else if (!normalizeRating(r.resolved_rating.rating)) emissoresSemRating.add(cnpj || r.isin || nome);
    }

    const diagnostico: DiagnosticoRow[] = [
      { key: 'elegivel',        categoria: 'Elegível para análise de crédito', valor: plCredito,                       pct: pctOf(plCredito),                       observacao: 'Ativos privados com emissor identificável' },
      { key: 'nao_aplicavel',   categoria: 'Não aplicável para análise',       valor: plNaoAplicavel,                  pct: pctOf(plNaoAplicavel),                  observacao: 'LFT, Termo, DAP, Compromissada, Fundos, etc.' },
      { key: 'cnpj_nao_mapeado',categoria: 'CNPJ emissor não mapeado',         valor: plByStatus.cnpj_nao_mapeado,     pct: pctOf(plByStatus.cnpj_nao_mapeado),     observacao: 'Elegível sem CNPJ do emissor vinculado ao ISIN' },
      { key: 'sem_rating',      categoria: 'Sem rating para o CNPJ',           valor: plByStatus.sem_rating,           pct: pctOf(plByStatus.sem_rating),           observacao: 'CNPJ mapeado mas sem rating cadastrado' },
      { key: 'sem_setor',       categoria: 'Elegível sem setor',               valor: plByStatus.sem_setor,            pct: pctOf(plByStatus.sem_setor),            observacao: 'Elegível para crédito mas sem setor mapeado' },
      { key: 'sem_mapeamento',  categoria: 'Elegível sem grupo/emissor',       valor: plByStatus.sem_mapeamento,       pct: pctOf(plByStatus.sem_mapeamento),       observacao: 'Ativo elegível sem grupo econômico mapeado' },
      { key: 'ok',              categoria: 'Mapeado corretamente',             valor: plByStatus.ok,                   pct: pctOf(plByStatus.ok),                   observacao: 'Rating + setor + grupo/emissor presentes' },
    ];

    return {
      totalPL,
      totalAtivos,
      durationMedia,
      topConcentracao,
      qualidadeMedia,
      plCredito,
      pctCredito,
      plNaoAplicavel,
      pctNaoAplicavel,
      total: { byTipo, byIndexador, byDuration, topPosicoes },
      credito: {
        byRating, bySetor, byGrupo, byEmissor,
        hasEligible: eligible.length > 0,
      },
      qualidade: {
        pctElegivel: pctCredito,
        pctNaoAplicavel,
        pctComRating,
        pctComSetor,
        pctComGrupo,
        pctSemMapeamento: pctOfCredito(plByStatus.sem_mapeamento),
        pctCnpjNaoMapeado: pctOfCredito(plByStatus.cnpj_nao_mapeado),
        emissoresSemRating: emissoresSemRating.size,
        ativosCnpjNaoMapeado: countByStatus.cnpj_nao_mapeado,
        diagnostico,
      },
      rowsClassified: classified,
    };
  }, [rows, ratingsByKey, butiaRfCpCnpjs]);

  return {
    data: agg,
    rawRows: rows,
    isLoading: q.isLoading || butiaCnpjsQuery.isLoading,
    error: (q.error as Error | null) ?? (butiaCnpjsQuery.error as Error | null),
  };
}
