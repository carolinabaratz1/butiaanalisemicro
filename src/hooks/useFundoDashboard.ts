import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
}

const RATING_ORDER = [
  'AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-',
  'BBB+', 'BBB', 'BBB-', '<BBB', 'S/R',
];

function normalizeRating(r: string | null | undefined): string {
  if (!r || !r.trim()) return 'S/R';
  const up = r.trim().toUpperCase().replace(/\s+/g, '');
  // tenta extrair padrão (AAA|AA[+-]?|A[+-]?|BBB[+-]?)
  const m = up.match(/^(?:BR)?(AAA|AA[+-]?|A[+-]?|BBB[+-]?)/);
  if (m) {
    const v = m[1];
    if (RATING_ORDER.includes(v)) return v;
  }
  // anything else investment-grade not matched, or speculative grade
  if (/^(?:BR)?[BCD]/.test(up)) return '<BBB';
  return 'S/R';
}

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

export interface DurationBucket {
  bucket: string;
  financeiro: number;
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
    const sumBy = (key: (r: DashboardRow) => string | null | undefined) => {
      const m = new Map<string, number>();
      for (const r of rows) {
        const k = (key(r) ?? 'N/D').toString().trim() || 'N/D';
        m.set(k, (m.get(k) ?? 0) + (Number(r.financial_price) || 0));
      }
      return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
    };

    const byTipo = sumBy(r => r.product_class).sort((a, b) => b.value - a.value);
    const byIndexador = sumBy(r => r.indexador).sort((a, b) => b.value - a.value);

    const ratingMap = new Map<string, number>();
    for (const r of rows) {
      const k = normalizeRating(r.rating);
      ratingMap.set(k, (ratingMap.get(k) ?? 0) + (Number(r.financial_price) || 0));
    }
    const byRating = RATING_ORDER
      .map(name => ({ name, value: ratingMap.get(name) ?? 0 }))
      .filter(d => d.value > 0);

    const bySetor = sumBy(r => r.setor).sort((a, b) => b.value - a.value).slice(0, 10);
    const byGrupo = sumBy(r => r.grupo_economico).sort((a, b) => b.value - a.value).slice(0, 10);

    const durMap = new Map<string, number>();
    for (const r of rows) {
      const k = durationBucket(r.duration_du == null ? null : Number(r.duration_du));
      durMap.set(k, (durMap.get(k) ?? 0) + (Number(r.financial_price) || 0));
    }
    const byDuration = BUCKET_ORDER
      .map(name => ({ name, value: durMap.get(name) ?? 0 }))
      .filter(d => d.value > 0);

    // Emissores
    type Acc = {
      codigo: string; nome: string; rating: string; setor: string; grupo: string;
      financeiro: number; durWeighted: number; produtos: Set<string>;
    };
    const emiMap = new Map<string, Acc>();
    for (const r of rows) {
      const codigo = (r.codigo_emissor && r.codigo_emissor.trim()) || (r.nome_emissor ?? 'N/D');
      const fin = Number(r.financial_price) || 0;
      const dur = Number(r.duration_du) || 0;
      const a = emiMap.get(codigo) ?? {
        codigo,
        nome: r.nome_emissor ?? codigo,
        rating: normalizeRating(r.rating),
        setor: r.setor ?? 'N/D',
        grupo: r.grupo_economico ?? 'N/D',
        financeiro: 0,
        durWeighted: 0,
        produtos: new Set<string>(),
      };
      a.financeiro += fin;
      a.durWeighted += dur * fin;
      if (r.product_class) a.produtos.add(r.product_class);
      emiMap.set(codigo, a);
    }

    const totalPL = rows.reduce((s, r) => s + (Number(r.financial_price) || 0), 0);

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

    const totalAtivos = new Set(rows.map(r => r.ticker).filter(Boolean)).size;

    const totalDurWeighted = rows.reduce(
      (s, r) => s + (Number(r.duration_du) || 0) * (Number(r.financial_price) || 0),
      0,
    );
    const durationMedia = totalPL > 0 ? totalDurWeighted / totalPL : 0;

    const topConcentracao = byEmissor[0]
      ? { nome: byEmissor[0].nome, pct: byEmissor[0].pctPL }
      : { nome: '—', pct: 0 };

    // Qualidade média: rating mais frequente ponderado por financeiro
    const qualidadeMedia = byRating.length
      ? byRating.reduce((best, cur) => (cur.value > best.value ? cur : best)).name
      : '—';

    return {
      byTipo,
      byIndexador,
      byRating,
      bySetor,
      byGrupo,
      byDuration,
      byEmissor,
      totalPL,
      totalAtivos,
      durationMedia,
      spreadMedio: null as number | null,
      topConcentracao,
      qualidadeMedia,
    };
  }, [rows]);

  return {
    data: agg,
    rawRows: rows,
    isLoading: q.isLoading,
    error: q.error as Error | null,
  };
}
