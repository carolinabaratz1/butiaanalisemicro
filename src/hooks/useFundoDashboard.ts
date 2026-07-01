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

export interface DashboardRow {
  ticker: string | null;
  isin: string | null;
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

export function useFundoDashboard(fundo: string | null) {
  const q = useQuery({
    queryKey: ['fundo-dashboard', fundo],
    enabled: !!fundo,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_posicoes_dashboard_fundo' as never, {
        p_fundo: fundo,
      } as never);
      if (error) throw error;
      return (data ?? []) as unknown as DashboardRow[];
    },
  });

  const rows = q.data ?? [];

  const agg = useMemo(() => {
    const posVal = (r: DashboardRow) =>
      (Number(r.amount) || 0) * (Number(r.financial_price) || 0);

    const classified: ClassifiedRow[] = rows.map(r => ({
      ...r,
      ...classifyCreditEligibility(r),
      financeiro: posVal(r),
    }));

    const totalPL = classified.reduce((s, r) => s + r.financeiro, 0);
    const totalAtivos = new Set(classified.map(r => r.ticker || r.isin).filter(Boolean)).size;

    const eligible = classified.filter(r => r.credit_analytics_eligible);
    const nonEligible = classified.filter(r => !r.credit_analytics_eligible);
    const plCredito = eligible.reduce((s, r) => s + r.financeiro, 0);
    const plNaoAplicavel = nonEligible.reduce((s, r) => s + r.financeiro, 0);
    const pctCredito = totalPL > 0 ? plCredito / totalPL : 0;
    const pctNaoAplicavel = totalPL > 0 ? plNaoAplicavel / totalPL : 0;

    // ---- Universo TOTAL ----
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
    const byIndexador = groupSum(classified, r => (r.indexador?.trim() || 'Outros'));

    const durMap = new Map<string, number>();
    for (const r of classified) {
      const k = durationBucket(r.duration_du == null ? null : Number(r.duration_du));
      durMap.set(k, (durMap.get(k) ?? 0) + r.financeiro);
    }
    const byDuration = BUCKET_ORDER
      .map(name => ({ name, value: durMap.get(name) ?? 0 }))
      .filter(d => d.value > 0);

    // Top posições (agregando por ticker/isin)
    const posMap = new Map<string, TopPosicao>();
    for (const r of classified) {
      const key = (r.ticker?.trim() || r.isin?.trim() || `${r.product_class}-${r.nome_emissor}`) as string;
      const cur = posMap.get(key);
      const nome = r.nome_emissor?.trim() || r.ticker?.trim() || r.isin?.trim() || '—';
      if (cur) {
        cur.financeiro += r.financeiro;
      } else {
        posMap.set(key, {
          key,
          ticker: r.ticker?.trim() || '—',
          nome,
          tipo: r.product_class?.trim() || '—',
          emissor: r.nome_emissor?.trim() || (r.credit_analytics_eligible ? 'Sem mapeamento' : '—'),
          grupo: r.grupo_economico?.trim() || (r.credit_analytics_eligible ? 'Grupo não mapeado' : '—'),
          financeiro: r.financeiro,
          pctPL: 0,
          rating: r.credit_analytics_eligible
            ? (normalizeRating(r.rating) ?? 'Sem rating')
            : '—',
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

    // ---- Universo CRÉDITO ----
    const ratingMap = new Map<string, number>();
    for (const r of eligible) {
      const nr = normalizeRating(r.rating);
      const k = nr ?? 'Sem rating';
      ratingMap.set(k, (ratingMap.get(k) ?? 0) + r.financeiro);
    }
    const byRating = [...RATING_ORDER, 'Sem rating']
      .map(name => ({ name, value: ratingMap.get(name) ?? 0 }))
      .filter(d => d.value > 0);

    const bySetor = groupSum(eligible, r => (r.setor?.trim() || 'Sem setor')).slice(0, 10);
    const byGrupo = groupSum(eligible, r => (r.grupo_economico?.trim() || 'Grupo não mapeado')).slice(0, 10);

    // Emissores
    type Acc = {
      codigo: string; nome: string; rating: string; setor: string; grupo: string;
      financeiro: number; durWeighted: number; produtos: Set<string>;
    };
    const emiMap = new Map<string, Acc>();
    for (const r of eligible) {
      const codigo = (r.codigo_emissor && r.codigo_emissor.trim()) || (r.nome_emissor ?? 'N/D');
      const dur = Number(r.duration_du) || 0;
      const acc = emiMap.get(codigo) ?? {
        codigo,
        nome: r.nome_emissor?.trim() || codigo,
        rating: normalizeRating(r.rating) ?? 'Sem rating',
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

    // Rating médio (universo crédito, ponderado por financeiro)
    const qualidadeMedia = byRating.length && plCredito > 0
      ? byRating.reduce((best, cur) => (cur.value > best.value ? cur : best)).name
      : '—';

    // ---- Qualidade dos dados ----
    const plByStatus: Record<DataQualityStatus, number> = {
      ok: 0, sem_rating: 0, sem_setor: 0, sem_mapeamento: 0, nao_aplicavel: 0,
    };
    for (const r of classified) {
      plByStatus[r.data_quality_status] += r.financeiro;
    }
    const pctOf = (v: number) => (totalPL > 0 ? v / totalPL : 0);
    const pctOfCredito = (v: number) => (plCredito > 0 ? v / plCredito : 0);

    const pctComRating = pctOfCredito(plByStatus.ok + plByStatus.sem_setor + plByStatus.sem_mapeamento);
    const pctComSetor  = pctOfCredito(plByStatus.ok + plByStatus.sem_rating + plByStatus.sem_mapeamento);
    const pctComGrupo  = pctOfCredito(plByStatus.ok + plByStatus.sem_rating + plByStatus.sem_setor);

    const diagnostico: DiagnosticoRow[] = [
      { key: 'elegivel',       categoria: 'Elegível para análise de crédito', valor: plCredito,             pct: pctOf(plCredito),             observacao: 'Ativos privados com emissor identificável' },
      { key: 'nao_aplicavel',  categoria: 'Não aplicável para análise',       valor: plNaoAplicavel,        pct: pctOf(plNaoAplicavel),        observacao: 'LFT, Termo, DAP, Compromissada, Fundos, etc.' },
      { key: 'sem_rating',     categoria: 'Elegível sem rating',              valor: plByStatus.sem_rating, pct: pctOf(plByStatus.sem_rating), observacao: 'Elegível para crédito mas sem rating informado' },
      { key: 'sem_setor',      categoria: 'Elegível sem setor',               valor: plByStatus.sem_setor,  pct: pctOf(plByStatus.sem_setor),  observacao: 'Elegível para crédito mas sem setor mapeado' },
      { key: 'sem_mapeamento', categoria: 'Elegível sem grupo/emissor',       valor: plByStatus.sem_mapeamento, pct: pctOf(plByStatus.sem_mapeamento), observacao: 'Ativo elegível sem grupo econômico mapeado' },
      { key: 'ok',             categoria: 'Mapeado corretamente',             valor: plByStatus.ok,         pct: pctOf(plByStatus.ok),         observacao: 'Rating + setor + grupo/emissor presentes' },
    ];

    return {
      // KPIs
      totalPL,
      totalAtivos,
      durationMedia,
      topConcentracao,
      qualidadeMedia,
      plCredito,
      pctCredito,
      plNaoAplicavel,
      pctNaoAplicavel,
      // Universo total
      total: { byTipo, byIndexador, byDuration, topPosicoes },
      // Universo crédito
      credito: {
        byRating, bySetor, byGrupo, byEmissor,
        hasEligible: eligible.length > 0,
      },
      // Qualidade
      qualidade: {
        pctElegivel: pctCredito,
        pctNaoAplicavel,
        pctComRating,
        pctComSetor,
        pctComGrupo,
        pctSemMapeamento: pctOfCredito(plByStatus.sem_mapeamento),
        diagnostico,
      },
      rowsClassified: classified,
    };
  }, [rows]);

  return {
    data: agg,
    rawRows: rows,
    isLoading: q.isLoading,
    error: q.error as Error | null,
  };
}
