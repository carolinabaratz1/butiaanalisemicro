// ==================== TYPES ====================
export interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
  setor: string;
  subsetor: string;
  tipo: 'Aberta' | 'Fechada';
  pais: string;
  descricao: string;
  analistaPrincipal: string;
  analistaBackup: string;
}

export interface Analista {
  id: string;
  nome: string;
  nivel: 'N1' | 'N2';
  tipo: 'Crédito' | 'Ações' | 'Híbrido';
  setores: string[];
  status: 'Ativo' | 'Inativo';
  numAnalises: number;
  taxaAprovacao: number;
  tempoMedio: number;
}

export interface Analise {
  id: string;
  empresaId: string;
  tipo: 'Crédito' | 'Ação';
  analistaResponsavel: string;
  analistaSecundario: string;
  dataInicio: string;
  dataConclusao: string | null;
  status: 'Em análise' | 'Em revisão' | 'Aprovado' | 'Reprovado';
  decisao: 'Investir' | 'Não investir' | 'Monitorar' | null;
  conviccao: 'Alta' | 'Média' | 'Baixa' | null;
  riscos: string;
  gatilhos: string;
  justificativa: string;
  versao: number;
  aprovadoPor: string | null;
  dataAprovacao: string | null;
}

export interface PipelineItem {
  id: string;
  empresaId: string;
  tipo: 'Crédito' | 'Ação';
  analistaResponsavel: string;
  prioridade: 'Alta' | 'Média' | 'Baixa';
  dataPrevista: string;
  status: 'Planejado' | 'Em andamento' | 'Concluído' | 'Atrasado';
}

export interface RatingInterno {
  id: string;
  empresaId: string;
  instrumentoId?: string;
  rating: string;
  data: string;
  analista: string;
  comentario: string;
}

export interface RatingExterno {
  id: string;
  empresaId: string;
  instrumentoId?: string;
  agencia: string;
  rating: string;
  data: string;
  perspectiva: 'Positiva' | 'Estável' | 'Negativa' | 'Em observação';
}

export interface EventoCredito {
  id: string;
  tipo: string;
  data: string;
  empresaId: string;
  instrumentoId?: string;
  participacao: boolean;
  representante: string;
  decisao: string;
  voto?: string;
  impacto?: string;
  comentario?: string;
}

export interface InstrumentoEstruturado {
  id: string;
  nome: string;
  tipo: 'FIDC' | 'CRI' | 'CRA';
  codigoCetip: string;
  isin: string;
  emissor: string;
  cedentes: string[];
  administrador: string;
  custodiante: string;
  gestor: string;
  dataEmissao: string;
  dataVencimento: string;
  volumeTotal: number;
  indexador: 'CDI' | 'IPCA' | 'IGPM' | 'Prefixado';
  spread: number;
  setorSubjacente: string;
  analistaResponsavel: string;
  // FIDC specific
  tipoCarteira?: 'Aberto' | 'Fechado';
  tipoAtivoCedido?: string;
  concentracaoMaxCedente?: number;
  cotas?: { classe: string; volume: number; pctPL: number; taxaAlvo: number; subordinacaoMinima: number }[];
  indiceSubordinacao?: number;
  pddAtual?: number;
  razaoGarantia?: number;
  coberturaInadimplencia?: number;
  // CRI specific
  tipoLastro?: string;
  devedorPrincipal?: string;
  regimeFiduciario?: boolean;
  ltvInicial?: number;
  garantiasCRI?: string;
  // CRA specific
  produtoAgricola?: string;
  cprVinculada?: boolean;
  garantiasCRA?: string;
  sazonalidadeRisco?: string;
}

export interface MonitoramentoFIDC {
  id: string;
  instrumentoId: string;
  dataReferencia: string;
  plFundo: number;
  inadimplencia30d: number;
  inadimplencia90d: number;
  pddConstituida: number;
  indiceSubordinacao: number;
  razaoGarantia: number;
  concentracaoMaiorCedente: number;
  statusCovenants: 'OK' | 'Em monitoramento' | 'Quebrado';
  comentario: string;
}

export interface MonitoramentoCRICRA {
  id: string;
  instrumentoId: string;
  dataReferencia: string;
  saldoDevedor: number;
  pagamentosEmDia: boolean;
  ltvAtual?: number;
  statusGarantias: 'Íntegras' | 'Comprometidas' | 'Executadas';
  statusCovenants: 'OK' | 'Em monitoramento' | 'Quebrado';
  comentario: string;
}

export interface OriginacaoAnalise {
  id: string;
  instrumentoId: string;
  status: 'Em análise' | 'Aprovado' | 'Reprovado' | 'Em revisão';
  decisao: 'Investir' | 'Não investir' | 'Monitorar' | null;
  conviccao: 'Alta' | 'Média' | 'Baixa' | null;
  tese: string;
  riscos: string;
  gatilhos: string;
  aprovador: string | null;
  dataAprovacao: string | null;
  versao: number;
  analistaResponsavel: string;
}

export interface TargetPrice {
  id: string;
  empresaId: string;
  precoAlvo: number;
  dataRecomendacao: string;
  horizonte: number;
  teseResumida: string;
  precoAtual: number;
  status: 'Atingido' | 'Não atingido' | 'Em andamento' | 'Expirado';
  tempoRestante: number;
}

export interface Posicao {
  tradingDeskShareSource: string;
  valDate: string;
  productClass: string;
  product: string;
  amount: number;
  isin: string;
  financialPrice: number;
  durationDU: number | null;
  yield: number | null;
  impliedSpread: number | null;
  dv01: number | null;
}

// ==================== DATA ====================

export const analistas: Analista[] = [];

export const empresas: Empresa[] = [];

export const analises: Analise[] = [];

export const pipelineItems: PipelineItem[] = [];

export const ratingsInternos: RatingInterno[] = [];

export const ratingsExternos: RatingExterno[] = [];

export const eventosCredito: EventoCredito[] = [];

export const instrumentosEstruturados: InstrumentoEstruturado[] = [];

export const monitoramentosFIDC: MonitoramentoFIDC[] = [];

export const monitoramentosCRICRA: MonitoramentoCRICRA[] = [];

export const originacoes: OriginacaoAnalise[] = [];

export const eventosEstruturados: EventoCredito[] = [];

export const ratingsEstruturados: RatingInterno[] = [];

export const ratingsExternosEstruturados: RatingExterno[] = [];

export const targetPrices: TargetPrice[] = [];

export const mockPosicoes: Posicao[] = [];

// Helper functions
export function getEmpresaNome(id: string): string {
  return empresas.find(e => e.id === id)?.nome ?? 'N/A';
}

export function getAnalistaNome(id: string): string {
  return analistas.find(a => a.id === id)?.nome ?? 'N/A';
}

export function getAnalistaById(id: string): Analista | undefined {
  return analistas.find(a => a.id === id);
}
