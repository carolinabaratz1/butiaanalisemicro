export type AnaliseTipo = 'Corporativo' | 'FIDC' | 'CRI' | 'CRA' | 'Financeiro';
export type AnalistaColor = 'blue' | 'teal' | 'amber' | 'pink' | 'purple';
export type StatusEntrega = 'no_prazo' | 'atencao' | 'atrasado' | 'entregue' | 'em_andamento';
export type EtapaKanban = 'Em análise' | 'Revisão' | 'Aprovado' | 'Concluído';

export interface EtapaHistorico {
  etapa: EtapaKanban;
  entradaEm: string;
  saidaEm?: string;
}

export interface AnaliseEntry {
  id: string;
  titulo: string;
  tipo: AnaliseTipo;
  analistaId: string;
  analistaNome: string;
  analistaInitials: string;
  analistaColor: AnalistaColor;
  dataInicio: string;
  dataEntrega: string;
  dataEntregueEm?: string;
  statusEntrega: StatusEntrega;
  aprovadoPrimeiraRevisao?: boolean;
  etapasKanban: EtapaHistorico[];
}

export const SLA_META_DIAS_UTEIS = 7;

// Feriados nacionais BR 2026 (YYYY-MM-DD)
export const FERIADOS_BR_2026: string[] = [
  '2026-01-01', '2026-02-17', '2026-02-18', '2026-04-03', '2026-04-21',
  '2026-05-01', '2026-06-11', '2026-09-07', '2026-10-12', '2026-11-02',
  '2026-11-15', '2026-11-20', '2026-12-25',
];

const ANALISTAS = [
  { id: 'an_la', nome: 'Lucas Almeida',  initials: 'LA', color: 'blue'   as AnalistaColor },
  { id: 'an_mc', nome: 'Marina Costa',   initials: 'MC', color: 'teal'   as AnalistaColor },
  { id: 'an_rs', nome: 'Rafael Souza',   initials: 'RS', color: 'amber'  as AnalistaColor },
  { id: 'an_jr', nome: 'Juliana Reis',   initials: 'JR', color: 'pink'   as AnalistaColor },
];

function mkEtapas(inicio: string, entregueEm?: string): EtapaHistorico[] {
  const i = new Date(inicio);
  const d = (offset: number) => {
    const x = new Date(i);
    x.setDate(x.getDate() + offset);
    return x.toISOString().slice(0, 10);
  };
  if (entregueEm) {
    return [
      { etapa: 'Em análise', entradaEm: d(0),  saidaEm: d(3) },
      { etapa: 'Revisão',    entradaEm: d(3),  saidaEm: d(5) },
      { etapa: 'Aprovado',   entradaEm: d(5),  saidaEm: d(6) },
      { etapa: 'Concluído',  entradaEm: d(6),  saidaEm: entregueEm },
    ];
  }
  return [
    { etapa: 'Em análise', entradaEm: d(0), saidaEm: d(2) },
    { etapa: 'Revisão',    entradaEm: d(2) },
  ];
}

export const ANALISES_MOCK: AnaliseEntry[] = [
  // Janeiro
  { id: 'a01', titulo: 'Simpar S.A.',          tipo: 'Corporativo', ...ANALISTAS[0], analistaId: ANALISTAS[0].id, analistaNome: ANALISTAS[0].nome, analistaInitials: ANALISTAS[0].initials, analistaColor: ANALISTAS[0].color,
    dataInicio: '2026-01-08', dataEntrega: '2026-01-19', dataEntregueEm: '2026-01-16', statusEntrega: 'entregue', aprovadoPrimeiraRevisao: true,  etapasKanban: mkEtapas('2026-01-08', '2026-01-16') },
  { id: 'a02', titulo: 'FIDC Multisetorial Alpha', tipo: 'FIDC',    ...ANALISTAS[1], analistaId: ANALISTAS[1].id, analistaNome: ANALISTAS[1].nome, analistaInitials: ANALISTAS[1].initials, analistaColor: ANALISTAS[1].color,
    dataInicio: '2026-01-12', dataEntrega: '2026-01-23', dataEntregueEm: '2026-01-22', statusEntrega: 'entregue', aprovadoPrimeiraRevisao: true,  etapasKanban: mkEtapas('2026-01-12', '2026-01-22') },
  { id: 'a03', titulo: 'CRI Rede Logística',   tipo: 'CRI',         ...ANALISTAS[2], analistaId: ANALISTAS[2].id, analistaNome: ANALISTAS[2].nome, analistaInitials: ANALISTAS[2].initials, analistaColor: ANALISTAS[2].color,
    dataInicio: '2026-01-15', dataEntrega: '2026-01-26', dataEntregueEm: '2026-01-30', statusEntrega: 'entregue', aprovadoPrimeiraRevisao: false, etapasKanban: mkEtapas('2026-01-15', '2026-01-30') },
  { id: 'a04', titulo: 'Banco Pine',           tipo: 'Financeiro',  ...ANALISTAS[3], analistaId: ANALISTAS[3].id, analistaNome: ANALISTAS[3].nome, analistaInitials: ANALISTAS[3].initials, analistaColor: ANALISTAS[3].color,
    dataInicio: '2026-01-20', dataEntrega: '2026-01-30', dataEntregueEm: '2026-01-29', statusEntrega: 'entregue', aprovadoPrimeiraRevisao: true,  etapasKanban: mkEtapas('2026-01-20', '2026-01-29') },

  // Fevereiro
  { id: 'a05', titulo: 'CRA Agro Brasil',      tipo: 'CRA',         ...ANALISTAS[0], analistaId: ANALISTAS[0].id, analistaNome: ANALISTAS[0].nome, analistaInitials: ANALISTAS[0].initials, analistaColor: ANALISTAS[0].color,
    dataInicio: '2026-02-02', dataEntrega: '2026-02-13', dataEntregueEm: '2026-02-12', statusEntrega: 'entregue', aprovadoPrimeiraRevisao: true,  etapasKanban: mkEtapas('2026-02-02', '2026-02-12') },
  { id: 'a06', titulo: 'Localiza Rent a Car',  tipo: 'Corporativo', ...ANALISTAS[1], analistaId: ANALISTAS[1].id, analistaNome: ANALISTAS[1].nome, analistaInitials: ANALISTAS[1].initials, analistaColor: ANALISTAS[1].color,
    dataInicio: '2026-02-05', dataEntrega: '2026-02-16', dataEntregueEm: '2026-02-19', statusEntrega: 'entregue', aprovadoPrimeiraRevisao: false, etapasKanban: mkEtapas('2026-02-05', '2026-02-19') },
  { id: 'a07', titulo: 'FIDC Crédito Mercantil', tipo: 'FIDC',      ...ANALISTAS[2], analistaId: ANALISTAS[2].id, analistaNome: ANALISTAS[2].nome, analistaInitials: ANALISTAS[2].initials, analistaColor: ANALISTAS[2].color,
    dataInicio: '2026-02-09', dataEntrega: '2026-02-20', dataEntregueEm: '2026-02-19', statusEntrega: 'entregue', aprovadoPrimeiraRevisao: true,  etapasKanban: mkEtapas('2026-02-09', '2026-02-19') },
  { id: 'a08', titulo: 'CRI Shopping Centers', tipo: 'CRI',         ...ANALISTAS[3], analistaId: ANALISTAS[3].id, analistaNome: ANALISTAS[3].nome, analistaInitials: ANALISTAS[3].initials, analistaColor: ANALISTAS[3].color,
    dataInicio: '2026-02-12', dataEntrega: '2026-02-25', dataEntregueEm: '2026-02-24', statusEntrega: 'entregue', aprovadoPrimeiraRevisao: true,  etapasKanban: mkEtapas('2026-02-12', '2026-02-24') },

  // Março
  { id: 'a09', titulo: 'Banco BV',             tipo: 'Financeiro',  ...ANALISTAS[0], analistaId: ANALISTAS[0].id, analistaNome: ANALISTAS[0].nome, analistaInitials: ANALISTAS[0].initials, analistaColor: ANALISTAS[0].color,
    dataInicio: '2026-03-02', dataEntrega: '2026-03-13', dataEntregueEm: '2026-03-12', statusEntrega: 'entregue', aprovadoPrimeiraRevisao: true,  etapasKanban: mkEtapas('2026-03-02', '2026-03-12') },
  { id: 'a10', titulo: 'CRA Usina Cerradinho', tipo: 'CRA',         ...ANALISTAS[1], analistaId: ANALISTAS[1].id, analistaNome: ANALISTAS[1].nome, analistaInitials: ANALISTAS[1].initials, analistaColor: ANALISTAS[1].color,
    dataInicio: '2026-03-05', dataEntrega: '2026-03-18', dataEntregueEm: '2026-03-17', statusEntrega: 'entregue', aprovadoPrimeiraRevisao: true,  etapasKanban: mkEtapas('2026-03-05', '2026-03-17') },
  { id: 'a11', titulo: 'Vale S.A.',            tipo: 'Corporativo', ...ANALISTAS[2], analistaId: ANALISTAS[2].id, analistaNome: ANALISTAS[2].nome, analistaInitials: ANALISTAS[2].initials, analistaColor: ANALISTAS[2].color,
    dataInicio: '2026-03-09', dataEntrega: '2026-03-20', dataEntregueEm: '2026-03-25', statusEntrega: 'entregue', aprovadoPrimeiraRevisao: false, etapasKanban: mkEtapas('2026-03-09', '2026-03-25') },
  { id: 'a12', titulo: 'FIDC Consignado Plus', tipo: 'FIDC',        ...ANALISTAS[3], analistaId: ANALISTAS[3].id, analistaNome: ANALISTAS[3].nome, analistaInitials: ANALISTAS[3].initials, analistaColor: ANALISTAS[3].color,
    dataInicio: '2026-03-16', dataEntrega: '2026-03-27', dataEntregueEm: '2026-03-26', statusEntrega: 'entregue', aprovadoPrimeiraRevisao: true,  etapasKanban: mkEtapas('2026-03-16', '2026-03-26') },

  // Abril (mix de em andamento, atrasados e vencidos)
  { id: 'a13', titulo: 'Cosan S.A.',           tipo: 'Corporativo', ...ANALISTAS[0], analistaId: ANALISTAS[0].id, analistaNome: ANALISTAS[0].nome, analistaInitials: ANALISTAS[0].initials, analistaColor: ANALISTAS[0].color,
    dataInicio: '2026-04-06', dataEntrega: '2026-04-17', dataEntregueEm: '2026-04-16', statusEntrega: 'entregue', aprovadoPrimeiraRevisao: true,  etapasKanban: mkEtapas('2026-04-06', '2026-04-16') },
  { id: 'a14', titulo: 'CRI Edifícios AAA',    tipo: 'CRI',         ...ANALISTAS[1], analistaId: ANALISTAS[1].id, analistaNome: ANALISTAS[1].nome, analistaInitials: ANALISTAS[1].initials, analistaColor: ANALISTAS[1].color,
    dataInicio: '2026-04-08', dataEntrega: '2026-04-22', statusEntrega: 'em_andamento', etapasKanban: mkEtapas('2026-04-08') },
  { id: 'a15', titulo: 'FIDC Energia Renovável', tipo: 'FIDC',      ...ANALISTAS[2], analistaId: ANALISTAS[2].id, analistaNome: ANALISTAS[2].nome, analistaInitials: ANALISTAS[2].initials, analistaColor: ANALISTAS[2].color,
    dataInicio: '2026-04-10', dataEntrega: '2026-04-24', statusEntrega: 'atencao', etapasKanban: mkEtapas('2026-04-10') },
  // VENCIDOS sem entrega (atrasados)
  { id: 'a16', titulo: 'CRA Açúcar Premium',   tipo: 'CRA',         ...ANALISTAS[3], analistaId: ANALISTAS[3].id, analistaNome: ANALISTAS[3].nome, analistaInitials: ANALISTAS[3].initials, analistaColor: ANALISTAS[3].color,
    dataInicio: '2026-04-01', dataEntrega: '2026-04-15', statusEntrega: 'atrasado', etapasKanban: mkEtapas('2026-04-01') },
  { id: 'a17', titulo: 'Banco Daycoval',       tipo: 'Financeiro',  ...ANALISTAS[0], analistaId: ANALISTAS[0].id, analistaNome: ANALISTAS[0].nome, analistaInitials: ANALISTAS[0].initials, analistaColor: ANALISTAS[0].color,
    dataInicio: '2026-04-03', dataEntrega: '2026-04-20', statusEntrega: 'atrasado', etapasKanban: mkEtapas('2026-04-03') },
  { id: 'a18', titulo: 'Eneva S.A.',           tipo: 'Corporativo', ...ANALISTAS[1], analistaId: ANALISTAS[1].id, analistaNome: ANALISTAS[1].nome, analistaInitials: ANALISTAS[1].initials, analistaColor: ANALISTAS[1].color,
    dataInicio: '2026-04-13', dataEntrega: '2026-04-30', statusEntrega: 'no_prazo', etapasKanban: mkEtapas('2026-04-13') },
];
