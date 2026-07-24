import { AnaliseEntry, FERIADOS_BR_2026, SLA_META_DIAS_UTEIS } from '@/data/desempenhoMock';

export type Periodo = '7d' | '30d' | '90d' | 'YTD';

const FERIADOS_SET = new Set(FERIADOS_BR_2026);

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function diasUteisEntre(inicio: Date, fim: Date): number {
  if (fim < inicio) return 0;
  let count = 0;
  const cur = new Date(inicio);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(fim);
  end.setHours(0, 0, 0, 0);
  while (cur < end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6 && !FERIADOS_SET.has(isoDate(cur))) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function inicioDoPeriodo(periodo: Periodo, ref: Date = new Date()): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  if (periodo === 'YTD') return new Date(d.getFullYear(), 0, 1);
  const days = periodo === '7d' ? 7 : periodo === '30d' ? 30 : 90;
  d.setDate(d.getDate() - days);
  return d;
}

export function periodoAnterior(periodo: Periodo, ref: Date = new Date()): { inicio: Date; fim: Date } {
  const fim = inicioDoPeriodo(periodo, ref);
  if (periodo === 'YTD') {
    const inicio = new Date(fim.getFullYear() - 1, 0, 1);
    const fimAnt = new Date(fim.getFullYear() - 1, fim.getMonth(), fim.getDate());
    return { inicio, fim: fimAnt };
  }
  const days = periodo === '7d' ? 7 : periodo === '30d' ? 30 : 90;
  const inicio = new Date(fim);
  inicio.setDate(inicio.getDate() - days);
  return { inicio, fim };
}

export function filtrarPorPeriodo(analises: AnaliseEntry[], inicio: Date, fim?: Date): AnaliseEntry[] {
  return analises.filter((a) => {
    // Análises já entregues contam no período em que a ENTREGA aconteceu (não a data de início) -
    // uma análise iniciada há meses mas entregue esta semana deve aparecer como entrega desta semana.
    if (a.dataEntregueEm) {
      const entrega = new Date(a.dataEntregueEm);
      if (entrega < inicio) return false;
      if (fim && entrega >= fim) return false;
      return true;
    }
    // Análises ainda em aberto representam trabalho atual e não devem sumir só porque começaram
    // antes da janela selecionada. Isso só vale para o período "atual" (sem `fim`) - numa janela
    // histórica ("período anterior", com `fim` definido) uma análise ainda aberta hoje não fazia
    // parte, por definição, daquele período já encerrado no passado.
    return !fim;
  });
}

export interface KpiResumo {
  entregues: number;
  prazoMedio: number;
  taxaAprovacao: number;
  emAtraso: number;
}

export function calcularKpis(analises: AnaliseEntry[]): KpiResumo {
  const entregues = analises.filter((a) => a.dataEntregueEm);
  const prazos = entregues.map((a) => diasUteisEntre(new Date(a.dataInicio), new Date(a.dataEntregueEm!)));
  const prazoMedio = prazos.length ? prazos.reduce((s, n) => s + n, 0) / prazos.length : 0;
  const aprovados = entregues.filter((a) => a.aprovadoPrimeiraRevisao === true).length;
  const taxaAprovacao = entregues.length ? (aprovados / entregues.length) * 100 : 0;
  const emAtraso = analises.filter((a) => a.statusEntrega === 'atrasado' && !a.dataEntregueEm).length;
  return { entregues: entregues.length, prazoMedio, taxaAprovacao, emAtraso };
}

export type StatusBadge = 'no_prazo' | 'atencao' | 'em_atraso';

export interface AnalistaMetrica {
  analistaId: string;
  analistaNome: string;
  analistaInitials: string;
  analistaColor: AnaliseEntry['analistaColor'];
  entregues: number;
  prazoMedio: number;
  diferencaMeta: number;
  taxaAprovacao: number;
  emAndamento: number;
  status: StatusBadge;
  analises: AnaliseEntry[];
}

export function calcularMetricasPorAnalista(analises: AnaliseEntry[]): AnalistaMetrica[] {
  const map = new Map<string, AnaliseEntry[]>();
  for (const a of analises) {
    if (!map.has(a.analistaId)) map.set(a.analistaId, []);
    map.get(a.analistaId)!.push(a);
  }
  const hoje = new Date();
  const result: AnalistaMetrica[] = [];
  for (const [, lista] of map) {
    const ref = lista[0];
    const entregues = lista.filter((a) => a.dataEntregueEm);
    const prazos = entregues.map((a) => diasUteisEntre(new Date(a.dataInicio), new Date(a.dataEntregueEm!)));
    const prazoMedio = prazos.length ? prazos.reduce((s, n) => s + n, 0) / prazos.length : 0;
    const aprovados = entregues.filter((a) => a.aprovadoPrimeiraRevisao === true).length;
    const taxaAprovacao = entregues.length ? (aprovados / entregues.length) * 100 : 0;
    const emAndamento = lista.filter((a) => !a.dataEntregueEm).length;
    const temVencidaPendente = lista.some((a) => !a.dataEntregueEm && new Date(a.dataEntrega) < hoje);
    let status: StatusBadge = 'no_prazo';
    if (prazoMedio > SLA_META_DIAS_UTEIS + 1.5 || temVencidaPendente) status = 'em_atraso';
    else if (prazoMedio > SLA_META_DIAS_UTEIS) status = 'atencao';
    result.push({
      analistaId: ref.analistaId,
      analistaNome: ref.analistaNome,
      analistaInitials: ref.analistaInitials,
      analistaColor: ref.analistaColor,
      entregues: entregues.length,
      prazoMedio,
      diferencaMeta: SLA_META_DIAS_UTEIS - prazoMedio,
      taxaAprovacao,
      emAndamento,
      status,
      analises: lista,
    });
  }
  return result.sort((a, b) => a.analistaNome.localeCompare(b.analistaNome));
}

export function agruparPorDia(analises: AnaliseEntry[]): Record<string, AnaliseEntry[]> {
  const map: Record<string, AnaliseEntry[]> = {};
  for (const a of analises) {
    const key = a.dataEntrega;
    if (!map[key]) map[key] = [];
    map[key].push(a);
  }
  return map;
}

export interface AcertividadeMes {
  ano: number;
  mes: number;
  label: string;
  percentual: number;
  totalEntregues: number;
}

const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function calcularAcertividade6Meses(analises: AnaliseEntry[], ref: Date = new Date()): AcertividadeMes[] {
  const out: AcertividadeMes[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    const ano = d.getFullYear();
    const mes = d.getMonth();
    const noMes = analises.filter((a) => {
      if (!a.dataEntregueEm) return false;
      const de = new Date(a.dataEntregueEm);
      return de.getFullYear() === ano && de.getMonth() === mes;
    });
    const noPrazo = noMes.filter((a) => new Date(a.dataEntregueEm!) <= new Date(a.dataEntrega)).length;
    const pct = noMes.length ? (noPrazo / noMes.length) * 100 : 0;
    out.push({ ano, mes, label: MESES_ABBR[mes], percentual: pct, totalEntregues: noMes.length });
  }
  return out;
}

export function pendentesOrdenadasPorUrgencia(analises: AnaliseEntry[]): Array<AnaliseEntry & { diasAteVencimento: number; vencido: boolean }> {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return analises
    .filter((a) => !a.dataEntregueEm)
    .map((a) => {
      const dv = new Date(a.dataEntrega);
      dv.setHours(0, 0, 0, 0);
      const diff = Math.round((dv.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      return { ...a, diasAteVencimento: diff, vencido: diff < 0 };
    })
    .sort((a, b) => a.diasAteVencimento - b.diasAteVencimento);
}

export function diasNaEtapa(etapa: { entradaEm: string; saidaEm?: string }): number {
  const inicio = new Date(etapa.entradaEm);
  const fim = etapa.saidaEm ? new Date(etapa.saidaEm) : new Date();
  return diasUteisEntre(inicio, fim);
}

export const ANALISTA_COLOR_CLASSES: Record<AnaliseEntry['analistaColor'], string> = {
  blue:   'bg-blue-100 text-blue-700',
  teal:   'bg-teal-100 text-teal-700',
  amber:  'bg-amber-100 text-amber-700',
  pink:   'bg-pink-100 text-pink-700',
  purple: 'bg-purple-100 text-purple-700',
};

export const TIPO_COR: Record<AnaliseEntry['tipo'], string> = {
  Corporativo: '#378ADD',
  FIDC:        '#EF9F27',
  CRI:         '#639922',
  CRA:         '#639922',
  Financeiro:  '#7F77DD',
};

export const COR_VENCIDO = '#E24B4A';
