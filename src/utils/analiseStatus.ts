// Util único para mapear status de análise em todo o sistema.
// Mantém compat com lógica existente: validade de 1 ano para Aprovada/Buy/Hold/Sell
// (FIDC isento) e adiciona Vencida quando prazo < hoje sem conclusão.

export type DisplayStatus =
  | 'Pendente'
  | 'Em Análise'
  | 'Concluída'
  | 'Aprovada'
  | 'Reprovada'
  | 'Vencida'
  | 'Buy'
  | 'Hold'
  | 'Sell'
  | string;

export interface AnaliseStatusInput {
  status: string;
  data_conclusao?: string | null;
  prazo?: string | null;
  data_aprovacao?: string | null;
  data_comite?: string | null;
  recomendacao?: string | null;
}

const RECOMENDACOES = new Set(['Buy', 'Hold', 'Sell']);

function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  const clean = String(s).split('T')[0];
  const d = new Date(clean);
  return isNaN(d.getTime()) ? null : d;
}

function umAnoAtras(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function hojeMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Status de exibição padronizado.
 * Regras (em ordem):
 *  1) Recomendação Buy/Hold/Sell + data_aprovacao > 1 ano (não FIDC) → Vencida
 *  2) Recomendação definida → mostra a recomendação
 *  3) status === 'Aprovada' + data_conclusao > 1 ano (não FIDC) → Vencida
 *  4) sem data_conclusao + prazo < hoje → Vencida
 *  5) demais: status original (Pendente / Em Análise / Concluída / Aprovada / Reprovada)
 */
export function getDisplayStatus(
  a: AnaliseStatusInput,
  tipoEmissor?: string | null,
): DisplayStatus {
  const isFidc = (tipoEmissor ?? '').toUpperCase() === 'FIDC';
  const um = umAnoAtras();

  if (a.recomendacao && RECOMENDACOES.has(a.recomendacao)) {
    if (!isFidc) {
      const ap = parseDate(a.data_aprovacao || a.data_comite || a.data_conclusao);
      if (ap && ap < um) return 'Vencida';
    }
    return a.recomendacao;
  }

  if (!isFidc && a.status === 'Aprovada' && a.data_conclusao) {
    const dc = parseDate(a.data_conclusao);
    if (dc && dc < um) return 'Vencida';
  }

  if (!a.data_conclusao && a.prazo) {
    const p = parseDate(a.prazo);
    if (p && p < hojeMidnight()) return 'Vencida';
  }

  return a.status || 'Pendente';
}

export function isVencida(a: AnaliseStatusInput, tipoEmissor?: string | null): boolean {
  return getDisplayStatus(a, tipoEmissor) === 'Vencida';
}

export const STATUS_BADGE_CLASS: Record<string, string> = {
  'Pendente':   'bg-status-warning/15 text-status-warning border-status-warning/30',
  'Em Análise': 'bg-status-info/15 text-status-info border-status-info/30',
  'Concluída':  'bg-muted/30 text-muted-foreground border-border',
  'Aprovada':   'bg-status-success/15 text-status-success border-status-success/30',
  'Reprovada':  'bg-status-danger/15 text-status-danger border-status-danger/30',
  'Vencida':    'bg-status-danger/15 text-status-danger border-status-danger/30',
  'Buy':        'bg-status-success/15 text-status-success border-status-success/30',
  'Hold':       'bg-status-warning/15 text-status-warning border-status-warning/30',
  'Sell':       'bg-status-danger/15 text-status-danger border-status-danger/30',
};

export function statusBadgeClass(s: string): string {
  return STATUS_BADGE_CLASS[s] ?? '';
}

/** Helper p/ paginar consultas Supabase além do cap default (1000). */
export async function fetchAllPaged<T>(
  fetcher: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  // safety upper bound
  for (let i = 0; i < 200; i++) {
    const { data, error } = await fetcher(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
