import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AnaliseEntry,
  AnaliseTipo,
  AnalistaColor,
  EtapaHistorico,
  EtapaKanban,
  StatusEntrega,
  SLA_META_DIAS_UTEIS,
} from '@/data/desempenhoMock';
import { Periodo, inicioDoPeriodo } from '@/utils/desempenhoUtils';
import { fetchAllPaged } from '@/utils/analiseStatus';

const COLORS: AnalistaColor[] = ['blue', 'teal', 'amber', 'pink', 'purple'];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function colorFor(id: string): AnalistaColor {
  return COLORS[hashStr(id) % COLORS.length];
}

function initialsOf(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function isUuid(s: string | null | undefined): boolean {
  return !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function deriveTipo(empresaTipo?: string | null, setor?: string | null): AnaliseTipo {
  const t = (empresaTipo ?? '').toUpperCase();
  const s = (setor ?? '').toUpperCase();
  if (t === 'FINANCEIRO') return 'Financeiro';
  if (t === 'FIDC' || s.includes('FIDC')) return 'FIDC';
  if (s.includes('CRI')) return 'CRI';
  if (s.includes('CRA')) return 'CRA';
  return 'Corporativo';
}

const STATUS_ENTREGUE = new Set([
  'Concluída',
  'Buy',
  'Hold',
  'Sell',
  'Vencida c/ Alocação',
  'Vencida s/ Alocação',
]);

const STATUS_DELIBERADO = new Set(['Buy', 'Hold', 'Sell']);

function deriveStatusEntrega(
  dataEntregueEm: string | undefined,
  dataEntrega: string,
  hoje: Date,
): StatusEntrega {
  const prazo = new Date(dataEntrega);
  if (!dataEntregueEm) {
    return prazo < hoje ? 'atrasado' : 'em_andamento';
  }
  const entregue = new Date(dataEntregueEm);
  return entregue <= prazo ? 'no_prazo' : 'atencao';
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const ETAPA_MAP: Record<string, EtapaKanban> = {
  'Em Análise': 'Em análise',
  'Concluída': 'Revisão',
  'Aprovada': 'Aprovado',
};

function buildEtapas(
  eventos: Array<{ etapa_nova: string | null; created_at: string | null }>,
  dataConclusao: string | undefined,
): EtapaHistorico[] {
  const seq = eventos
    .filter((e) => e.etapa_nova && ETAPA_MAP[e.etapa_nova] && e.created_at)
    .map((e) => ({
      etapa: ETAPA_MAP[e.etapa_nova as string]!,
      entradaEm: (e.created_at as string).slice(0, 10),
    }));

  const out: EtapaHistorico[] = seq.map((s, i) => ({
    etapa: s.etapa,
    entradaEm: s.entradaEm,
    saidaEm: seq[i + 1]?.entradaEm,
  }));

  if (dataConclusao) {
    const last = out[out.length - 1];
    if (last && !last.saidaEm) last.saidaEm = dataConclusao;
    out.push({ etapa: 'Concluído', entradaEm: dataConclusao, saidaEm: dataConclusao });
  }
  return out;
}

interface AnaliseRow {
  id: string;
  empresa_id: string;
  tipo: string;
  status: string;
  analista_responsavel: string | null;
  data_inicio: string;
  prazo: string | null;
  data_conclusao: string | null;
  versao: number | null;
}

interface EmpresaRow {
  cnpj: string;
  nome: string;
  tipo: string | null;
  setor: string | null;
  grupo_economico: string | null;
}

interface ProfileRow {
  id: string;
  nome: string;
}

interface EventoRow {
  analise_id: string;
  acao: string;
  etapa_anterior: string | null;
  etapa_nova: string | null;
  created_at: string | null;
}

async function fetchDesempenho(periodo: Periodo): Promise<AnaliseEntry[]> {
  const isoInicio = inicioDoPeriodo(periodo).toISOString().slice(0, 10);

  const [analisesRes, empresasRes, profilesRes] = await Promise.all([
    supabase
      .from('analises')
      .select('id,empresa_id,tipo,status,analista_responsavel,data_inicio,prazo,data_conclusao,versao')
      .or(`data_inicio.gte.${isoInicio},data_conclusao.gte.${isoInicio}`),
    fetchAllPaged<EmpresaRow>((from, to) =>
      supabase.from('empresas').select('cnpj,nome,tipo,setor,grupo_economico').range(from, to),
    ).then((data) => ({ data, error: null as any })),
    fetchAllPaged<ProfileRow>((from, to) =>
      supabase.from('profiles').select('id,nome').range(from, to),
    ).then((data) => ({ data, error: null as any })),
  ]);

  if (analisesRes.error) throw analisesRes.error;
  if (empresasRes.error) throw empresasRes.error;
  if (profilesRes.error) throw profilesRes.error;

  const analises = (analisesRes.data ?? []) as AnaliseRow[];
  const empresas = (empresasRes.data ?? []) as EmpresaRow[];
  const profiles = (profilesRes.data ?? []) as ProfileRow[];

  let eventos: EventoRow[] = [];
  if (analises.length > 0) {
    const ids = analises.map((a) => a.id);
    const evRes = await supabase
      .from('pipeline_eventos')
      .select('analise_id,acao,etapa_anterior,etapa_nova,created_at')
      .in('analise_id', ids)
      .order('created_at', { ascending: true });
    if (evRes.error) throw evRes.error;
    eventos = (evRes.data ?? []) as EventoRow[];
  }

  const normNome = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const empresaByCnpj = new Map(empresas.map((e) => [e.cnpj, e]));
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const profileByNome = new Map(profiles.map((p) => [normNome(p.nome), p]));
  const eventosByAnalise = new Map<string, EventoRow[]>();
  for (const ev of eventos) {
    const arr = eventosByAnalise.get(ev.analise_id) ?? [];
    arr.push(ev);
    eventosByAnalise.set(ev.analise_id, arr);
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return analises.map((a) => {
    const empresa = empresaByCnpj.get(a.empresa_id);
    const titulo = empresa?.nome ?? a.empresa_id;
    const grupoEconomico = empresa?.grupo_economico ?? undefined;
    const tipo = deriveTipo(empresa?.tipo, empresa?.setor);

    let analistaId = a.analista_responsavel ?? 'sem-analista';
    let analistaNome = 'Sem analista';
    if (a.analista_responsavel) {
      if (isUuid(a.analista_responsavel)) {
        const p = profileById.get(a.analista_responsavel);
        analistaNome = p?.nome ?? 'Analista desconhecido';
        analistaId = p?.id ?? a.analista_responsavel;
      } else {
        const p = profileByNome.get(normNome(a.analista_responsavel));
        analistaNome = p?.nome ?? a.analista_responsavel;
        analistaId = p?.id ?? normNome(a.analista_responsavel);
      }
    }

    const dataInicio = a.data_inicio;
    const dataEntrega = a.prazo ?? addDaysISO(dataInicio, SLA_META_DIAS_UTEIS + 2);
    const dataEntregueEm = STATUS_ENTREGUE.has(a.status) ? a.data_conclusao ?? undefined : undefined;
    const statusEntrega = deriveStatusEntrega(dataEntregueEm, dataEntrega, hoje);
    // Aprovado em 1ª revisão: deliberado pelo Comitê (Buy/Hold/Sell) sem ter sido devolvido para revisão
    const eventos = eventosByAnalise.get(a.id) ?? [];
    const foiDevolvida = eventos.some(
      (e) => e.etapa_anterior === 'Concluída' && e.etapa_nova === 'Em Análise',
    );
    const aprovadoPrimeiraRevisao = STATUS_DELIBERADO.has(a.status) && !foiDevolvida;
    const etapasKanban = buildEtapas(eventos, dataEntregueEm);

    return {
      id: a.id,
      titulo,
      grupoEconomico,
      tipo,
      analistaId,
      analistaNome,
      analistaInitials: initialsOf(analistaNome),
      analistaColor: colorFor(analistaId),
      dataInicio,
      dataEntrega,
      dataEntregueEm,
      statusEntrega,
      aprovadoPrimeiraRevisao,
      etapasKanban,
    };
  });
}

export function useDesempenhoData(periodo: Periodo) {
  const query = useQuery({
    queryKey: ['desempenho', periodo],
    queryFn: () => fetchDesempenho(periodo),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (query.isError) {
      toast.error('Erro ao carregar dados de desempenho. Tente novamente.');
    }
  }, [query.isError]);

  return {
    analises: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
