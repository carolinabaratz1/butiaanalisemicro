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

export const analistas: Analista[] = [
  { id: 'a1', nome: 'Rafael Mendes', nivel: 'N2', tipo: 'Crédito', setores: ['Energia', 'Infraestrutura', 'Utilities'], status: 'Ativo', numAnalises: 34, taxaAprovacao: 88, tempoMedio: 12 },
  { id: 'a2', nome: 'Carolina Duarte', nivel: 'N2', tipo: 'Crédito', setores: ['Saúde', 'Varejo', 'Shopping Centers'], status: 'Ativo', numAnalises: 28, taxaAprovacao: 92, tempoMedio: 10 },
  { id: 'a3', nome: 'Lucas Ferreira', nivel: 'N1', tipo: 'Ações', setores: ['Mineração', 'Siderurgia', 'Alimentos'], status: 'Ativo', numAnalises: 22, taxaAprovacao: 85, tempoMedio: 15 },
  { id: 'a4', nome: 'Beatriz Santos', nivel: 'N2', tipo: 'Híbrido', setores: ['Locação', 'Transportes', 'Agro'], status: 'Ativo', numAnalises: 19, taxaAprovacao: 90, tempoMedio: 11 },
];

export const empresas: Empresa[] = [
  { id: 'e1', nome: 'Petrobras', cnpj: '33.000.167/0001-01', setor: 'Energia', subsetor: 'Petróleo & Gás', tipo: 'Aberta', pais: 'Brasil', descricao: 'Empresa integrada de energia, maior produtora de petróleo do Brasil.', analistaPrincipal: 'a1', analistaBackup: 'a4' },
  { id: 'e2', nome: 'Vale', cnpj: '33.592.510/0001-54', setor: 'Mineração', subsetor: 'Mineração', tipo: 'Aberta', pais: 'Brasil', descricao: 'Maior produtora global de minério de ferro e níquel.', analistaPrincipal: 'a3', analistaBackup: 'a1' },
  { id: 'e3', nome: 'Localiza', cnpj: '16.670.085/0001-55', setor: 'Locação', subsetor: 'Locação de Veículos', tipo: 'Aberta', pais: 'Brasil', descricao: 'Maior empresa de aluguel de carros da América Latina.', analistaPrincipal: 'a4', analistaBackup: 'a2' },
  { id: 'e4', nome: 'CTEEP', cnpj: '02.998.611/0001-04', setor: 'Utilities', subsetor: 'Transmissão de Energia', tipo: 'Aberta', pais: 'Brasil', descricao: 'Principal empresa de transmissão de energia elétrica de SP.', analistaPrincipal: 'a1', analistaBackup: 'a4' },
  { id: 'e5', nome: 'Marfrig', cnpj: '03.853.896/0001-40', setor: 'Alimentos', subsetor: 'Proteína Animal', tipo: 'Aberta', pais: 'Brasil', descricao: 'Uma das maiores empresas de alimentos à base de proteína animal.', analistaPrincipal: 'a3', analistaBackup: 'a4' },
  { id: 'e6', nome: 'Iguatemi', cnpj: '51.218.147/0001-93', setor: 'Shopping Centers', subsetor: 'Shopping Centers', tipo: 'Aberta', pais: 'Brasil', descricao: 'Administradora de shopping centers de alto padrão.', analistaPrincipal: 'a2', analistaBackup: 'a3' },
  { id: 'e7', nome: 'Rede D\'Or', cnpj: '06.047.087/0001-39', setor: 'Saúde', subsetor: 'Hospitais', tipo: 'Aberta', pais: 'Brasil', descricao: 'Maior rede hospitalar privada do Brasil.', analistaPrincipal: 'a2', analistaBackup: 'a1' },
];

export const analises: Analise[] = [
  { id: 'an1', empresaId: 'e1', tipo: 'Crédito', analistaResponsavel: 'a1', analistaSecundario: 'a4', dataInicio: '2026-02-01', dataConclusao: '2026-02-20', status: 'Aprovado', decisao: 'Investir', conviccao: 'Alta', riscos: 'Risco político, oscilação do preço do petróleo', gatilhos: 'Mudança na política de dividendos, rebaixamento de rating', justificativa: 'Fundamentos sólidos, geração de caixa robusta, rating investment grade', versao: 2, aprovadoPor: 'Carolina Duarte', dataAprovacao: '2026-02-20T14:30:00' },
  { id: 'an2', empresaId: 'e2', tipo: 'Ação', analistaResponsavel: 'a3', analistaSecundario: 'a1', dataInicio: '2026-03-01', dataConclusao: null, status: 'Em análise', decisao: null, conviccao: null, riscos: 'Desaceleração da China, queda do preço do minério', gatilhos: 'Preço do minério abaixo de USD 90/ton', justificativa: '', versao: 1, aprovadoPor: null, dataAprovacao: null },
  { id: 'an3', empresaId: 'e3', tipo: 'Crédito', analistaResponsavel: 'a4', analistaSecundario: 'a2', dataInicio: '2026-02-15', dataConclusao: '2026-03-10', status: 'Aprovado', decisao: 'Investir', conviccao: 'Média', riscos: 'Aumento de frota acima da demanda, risco de crédito do consumidor', gatilhos: 'Alavancagem acima de 3x EBITDA', justificativa: 'Posição dominante no mercado, bom histórico de crédito', versao: 1, aprovadoPor: 'Rafael Mendes', dataAprovacao: '2026-03-10T10:00:00' },
  { id: 'an4', empresaId: 'e4', tipo: 'Crédito', analistaResponsavel: 'a1', analistaSecundario: 'a4', dataInicio: '2026-03-05', dataConclusao: null, status: 'Em revisão', decisao: 'Investir', conviccao: 'Alta', riscos: 'Risco regulatório, renovação de concessões', gatilhos: 'Alteração na regulação da ANEEL', justificativa: 'Fluxo de caixa previsível, contratos longos', versao: 1, aprovadoPor: null, dataAprovacao: null },
  { id: 'an5', empresaId: 'e5', tipo: 'Ação', analistaResponsavel: 'a3', analistaSecundario: 'a4', dataInicio: '2026-01-20', dataConclusao: '2026-02-15', status: 'Reprovado', decisao: 'Não investir', conviccao: 'Baixa', riscos: 'Alta alavancagem, risco cambial, dependência da National Beef', gatilhos: 'Desalavancagem abaixo de 2.5x', justificativa: 'Risco de crédito elevado e margens pressionadas', versao: 1, aprovadoPor: null, dataAprovacao: null },
  { id: 'an6', empresaId: 'e6', tipo: 'Crédito', analistaResponsavel: 'a2', analistaSecundario: 'a3', dataInicio: '2026-03-10', dataConclusao: null, status: 'Em análise', decisao: null, conviccao: null, riscos: 'Risco de vacância, ciclo econômico', gatilhos: 'Vacância acima de 8%', justificativa: '', versao: 1, aprovadoPor: null, dataAprovacao: null },
  { id: 'an7', empresaId: 'e7', tipo: 'Crédito', analistaResponsavel: 'a2', analistaSecundario: 'a1', dataInicio: '2026-02-10', dataConclusao: '2026-03-05', status: 'Aprovado', decisao: 'Monitorar', conviccao: 'Média', riscos: 'Aquisições agressivas, integração, risco regulatório ANS', gatilhos: 'Alavancagem acima de 3.5x, mudança regulatória', justificativa: 'Líder de mercado com diversificação geográfica', versao: 1, aprovadoPor: 'Rafael Mendes', dataAprovacao: '2026-03-05T16:00:00' },
  { id: 'an8', empresaId: 'e1', tipo: 'Ação', analistaResponsavel: 'a3', analistaSecundario: 'a1', dataInicio: '2026-03-15', dataConclusao: null, status: 'Em análise', decisao: null, conviccao: null, riscos: 'Risco político, preço do petróleo, câmbio', gatilhos: 'Brent abaixo de USD 65', justificativa: '', versao: 1, aprovadoPor: null, dataAprovacao: null },
];

export const pipelineItems: PipelineItem[] = [
  { id: 'p1', empresaId: 'e2', tipo: 'Ação', analistaResponsavel: 'a3', prioridade: 'Alta', dataPrevista: '2026-03-28', status: 'Em andamento' },
  { id: 'p2', empresaId: 'e6', tipo: 'Crédito', analistaResponsavel: 'a2', prioridade: 'Média', dataPrevista: '2026-03-31', status: 'Em andamento' },
  { id: 'p3', empresaId: 'e4', tipo: 'Crédito', analistaResponsavel: 'a1', prioridade: 'Alta', dataPrevista: '2026-03-25', status: 'Atrasado' },
  { id: 'p4', empresaId: 'e1', tipo: 'Ação', analistaResponsavel: 'a3', prioridade: 'Média', dataPrevista: '2026-04-05', status: 'Planejado' },
  { id: 'p5', empresaId: 'e5', tipo: 'Ação', analistaResponsavel: 'a3', prioridade: 'Baixa', dataPrevista: '2026-04-10', status: 'Planejado' },
  { id: 'p6', empresaId: 'e3', tipo: 'Crédito', analistaResponsavel: 'a4', prioridade: 'Alta', dataPrevista: '2026-03-20', status: 'Concluído' },
  { id: 'p7', empresaId: 'e7', tipo: 'Crédito', analistaResponsavel: 'a2', prioridade: 'Média', dataPrevista: '2026-03-22', status: 'Concluído' },
];

export const ratingsInternos: RatingInterno[] = [
  { id: 'ri1', empresaId: 'e1', rating: 'AA+', data: '2025-06-15', analista: 'a1', comentario: 'Forte geração de caixa, rating estável' },
  { id: 'ri2', empresaId: 'e1', rating: 'AA+', data: '2025-12-15', analista: 'a1', comentario: 'Manutenção do rating, métricas sólidas' },
  { id: 'ri3', empresaId: 'e1', rating: 'AAA', data: '2026-03-10', analista: 'a1', comentario: 'Upgrade: melhora operacional significativa' },
  { id: 'ri4', empresaId: 'e2', rating: 'AA', data: '2025-06-20', analista: 'a3', comentario: 'Rating sólido, boa geração de caixa' },
  { id: 'ri5', empresaId: 'e2', rating: 'AA', data: '2025-12-20', analista: 'a3', comentario: 'Manutenção' },
  { id: 'ri6', empresaId: 'e2', rating: 'AA-', data: '2026-02-28', analista: 'a3', comentario: 'Downgrade: pressão de minério de ferro' },
  { id: 'ri7', empresaId: 'e3', rating: 'AA', data: '2025-08-10', analista: 'a4', comentario: 'Rating inicial pós-fusão' },
  { id: 'ri8', empresaId: 'e3', rating: 'AA+', data: '2026-01-15', analista: 'a4', comentario: 'Upgrade: sinergias realizadas' },
  { id: 'ri9', empresaId: 'e3', rating: 'AA+', data: '2026-03-10', analista: 'a4', comentario: 'Manutenção do rating' },
  { id: 'ri10', empresaId: 'e4', rating: 'AAA', data: '2025-07-01', analista: 'a1', comentario: 'Excelente perfil de crédito' },
  { id: 'ri11', empresaId: 'e4', rating: 'AAA', data: '2026-01-01', analista: 'a1', comentario: 'Manutenção' },
  { id: 'ri12', empresaId: 'e4', rating: 'AAA', data: '2026-03-15', analista: 'a1', comentario: 'Manutenção do rating máximo' },
  { id: 'ri13', empresaId: 'e7', rating: 'AA-', data: '2025-09-01', analista: 'a2', comentario: 'Rating inicial' },
  { id: 'ri14', empresaId: 'e7', rating: 'AA', data: '2026-01-20', analista: 'a2', comentario: 'Upgrade: expansão controlada' },
  { id: 'ri15', empresaId: 'e7', rating: 'AA', data: '2026-03-05', analista: 'a2', comentario: 'Manutenção' },
];

export const ratingsExternos: RatingExterno[] = [
  { id: 're1', empresaId: 'e1', agencia: 'S&P', rating: 'BB-', data: '2025-11-20', perspectiva: 'Estável' },
  { id: 're2', empresaId: 'e1', agencia: 'Moody\'s', rating: 'Ba1', data: '2025-12-10', perspectiva: 'Positiva' },
  { id: 're3', empresaId: 'e1', agencia: 'Fitch', rating: 'BB', data: '2026-02-15', perspectiva: 'Estável' },
  { id: 're4', empresaId: 'e2', agencia: 'S&P', rating: 'BBB-', data: '2025-10-05', perspectiva: 'Estável' },
  { id: 're5', empresaId: 'e2', agencia: 'Moody\'s', rating: 'Baa3', data: '2026-01-15', perspectiva: 'Negativa' },
  { id: 're6', empresaId: 'e3', agencia: 'Fitch', rating: 'AA(bra)', data: '2025-09-30', perspectiva: 'Positiva' },
  { id: 're7', empresaId: 'e4', agencia: 'S&P', rating: 'brAAA', data: '2026-01-10', perspectiva: 'Estável' },
  { id: 're8', empresaId: 'e7', agencia: 'Fitch', rating: 'AA+(bra)', data: '2026-02-20', perspectiva: 'Estável' },
];

export const eventosCredito: EventoCredito[] = [
  { id: 'ec1', tipo: 'Assembleia de debenturistas', data: '2026-01-15', empresaId: 'e1', participacao: true, representante: 'Rafael Mendes', decisao: 'Aprovação de waiver para covenant financeiro' },
  { id: 'ec2', tipo: 'Waiver', data: '2025-11-20', empresaId: 'e3', participacao: true, representante: 'Beatriz Santos', decisao: 'Concessão de waiver temporário para alavancagem' },
  { id: 'ec3', tipo: 'Reestruturação', data: '2026-02-10', empresaId: 'e5', participacao: false, representante: '', decisao: 'Reestruturação do perfil de dívida aprovada' },
];

export const instrumentosEstruturados: InstrumentoEstruturado[] = [
  {
    id: 'ie1', nome: 'FIDC Automotivo Sênior', tipo: 'FIDC', codigoCetip: 'FDCA11', isin: 'BRFDCACTF001',
    emissor: 'Vórtx DTVM', cedentes: ['Companhia de Crédito Automotivo S.A.'], administrador: 'Vórtx DTVM',
    custodiante: 'Banco Itaú', gestor: 'Butiá Investimentos', dataEmissao: '2024-06-15', dataVencimento: '2028-06-15',
    volumeTotal: 350000000, indexador: 'CDI', spread: 2.5, setorSubjacente: 'Consumo',
    analistaResponsavel: 'a1', tipoCarteira: 'Fechado', tipoAtivoCedido: 'Crédito pessoal',
    concentracaoMaxCedente: 20, 
    cotas: [
      { classe: 'Sênior', volume: 250000000, pctPL: 71.4, taxaAlvo: 1.8, subordinacaoMinima: 25 },
      { classe: 'Mezanino', volume: 50000000, pctPL: 14.3, taxaAlvo: 3.5, subordinacaoMinima: 10 },
      { classe: 'Subordinada', volume: 50000000, pctPL: 14.3, taxaAlvo: 0, subordinacaoMinima: 0 },
    ],
    indiceSubordinacao: 28.6, pddAtual: 3.2, razaoGarantia: 130, coberturaInadimplencia: 2.1,
  },
  {
    id: 'ie2', nome: 'AXIOS NPL FIDC SR1', tipo: 'FIDC', codigoCetip: 'AXIO11', isin: 'BRAXIOCTF001',
    emissor: 'Oliveira Trust', cedentes: ['Banco Pan', 'Banco BMG'], administrador: 'Oliveira Trust',
    custodiante: 'Banco Bradesco', gestor: 'Axios Capital', dataEmissao: '2024-03-01', dataVencimento: '2029-03-01',
    volumeTotal: 200000000, indexador: 'CDI', spread: 4.0, setorSubjacente: 'Multi-setor',
    analistaResponsavel: 'a1', tipoCarteira: 'Fechado', tipoAtivoCedido: 'Multi-classe',
    concentracaoMaxCedente: 35,
    cotas: [
      { classe: 'Sênior', volume: 120000000, pctPL: 60, taxaAlvo: 2.8, subordinacaoMinima: 35 },
      { classe: 'Mezanino', volume: 40000000, pctPL: 20, taxaAlvo: 5.5, subordinacaoMinima: 15 },
      { classe: 'Subordinada', volume: 40000000, pctPL: 20, taxaAlvo: 0, subordinacaoMinima: 0 },
    ],
    indiceSubordinacao: 38, pddAtual: 8.5, razaoGarantia: 115, coberturaInadimplencia: 1.5,
  },
  {
    id: 'ie3', nome: 'CRI Cyrela 2022 IPCA+6,2%', tipo: 'CRI', codigoCetip: 'CRI2201', isin: 'BRCYRICTF001',
    emissor: 'Securitizadora Habitasec', cedentes: ['Cyrela Brazil Realty'], administrador: 'Pentágono DTVM',
    custodiante: 'Banco Itaú', gestor: '', dataEmissao: '2022-09-15', dataVencimento: '2032-09-15',
    volumeTotal: 180000000, indexador: 'IPCA', spread: 6.2, setorSubjacente: 'Imobiliário',
    analistaResponsavel: 'a2', tipoLastro: 'Residencial', devedorPrincipal: 'Cyrela Brazil Realty',
    regimeFiduciario: true, ltvInicial: 65, garantiasCRI: 'Alienação fiduciária',
  },
  {
    id: 'ie4', nome: 'CRA BRF 2023 CDI+1,8%', tipo: 'CRA', codigoCetip: 'CRA2301', isin: 'BRBRFCRTF001',
    emissor: 'Eco Securitizadora', cedentes: ['BRF S.A.'], administrador: 'Vórtx DTVM',
    custodiante: 'Banco Bradesco', gestor: '', dataEmissao: '2023-04-10', dataVencimento: '2028-04-10',
    volumeTotal: 250000000, indexador: 'CDI', spread: 1.8, setorSubjacente: 'Agro',
    analistaResponsavel: 'a4', produtoAgricola: 'Proteína Animal', devedorPrincipal: 'BRF S.A.',
    cprVinculada: true, garantiasCRA: 'Aval', sazonalidadeRisco: 'Março-Abril',
  },
];

export const monitoramentosFIDC: MonitoramentoFIDC[] = [
  { id: 'mf1', instrumentoId: 'ie1', dataReferencia: '2026-01-31', plFundo: 340000000, inadimplencia30d: 2.1, inadimplencia90d: 0.8, pddConstituida: 2.5, indiceSubordinacao: 29.1, razaoGarantia: 132, concentracaoMaiorCedente: 18, statusCovenants: 'OK', comentario: 'Fundamento sólido, inadimplência controlada' },
  { id: 'mf2', instrumentoId: 'ie1', dataReferencia: '2026-02-28', plFundo: 338000000, inadimplencia30d: 2.4, inadimplencia90d: 1.1, pddConstituida: 2.8, indiceSubordinacao: 28.8, razaoGarantia: 131, concentracaoMaiorCedente: 19, statusCovenants: 'OK', comentario: 'Leve aumento na inadimplência, ainda dentro do normal' },
  { id: 'mf3', instrumentoId: 'ie2', dataReferencia: '2026-01-31', plFundo: 195000000, inadimplencia30d: 5.8, inadimplencia90d: 4.2, pddConstituida: 7.5, indiceSubordinacao: 37, razaoGarantia: 116, concentracaoMaiorCedente: 32, statusCovenants: 'Em monitoramento', comentario: 'Inadimplência crescente, monitorar concentração do Banco Pan' },
  { id: 'mf4', instrumentoId: 'ie2', dataReferencia: '2026-02-28', plFundo: 192000000, inadimplencia30d: 6.5, inadimplencia90d: 4.8, pddConstituida: 8.5, indiceSubordinacao: 36, razaoGarantia: 114, concentracaoMaiorCedente: 33, statusCovenants: 'Em monitoramento', comentario: 'Inadimplência continua subindo, atenção redobrada' },
];

export const monitoramentosCRICRA: MonitoramentoCRICRA[] = [
  { id: 'mc1', instrumentoId: 'ie3', dataReferencia: '2026-01-31', saldoDevedor: 165000000, pagamentosEmDia: true, ltvAtual: 58, statusGarantias: 'Íntegras', statusCovenants: 'OK', comentario: 'Cyrela mantendo pagamentos regulares' },
  { id: 'mc2', instrumentoId: 'ie3', dataReferencia: '2026-02-28', saldoDevedor: 162000000, pagamentosEmDia: true, ltvAtual: 56, statusGarantias: 'Íntegras', statusCovenants: 'OK', comentario: 'LTV melhorando com amortizações' },
  { id: 'mc3', instrumentoId: 'ie4', dataReferencia: '2026-01-31', saldoDevedor: 230000000, pagamentosEmDia: true, statusGarantias: 'Íntegras', statusCovenants: 'OK', comentario: 'BRF cumprindo obrigações regularmente' },
  { id: 'mc4', instrumentoId: 'ie4', dataReferencia: '2026-02-28', saldoDevedor: 225000000, pagamentosEmDia: true, statusGarantias: 'Íntegras', statusCovenants: 'OK', comentario: 'Sem eventos relevantes no período' },
];

export const originacoes: OriginacaoAnalise[] = [
  { id: 'or1', instrumentoId: 'ie1', status: 'Aprovado', decisao: 'Investir', conviccao: 'Alta', tese: 'FIDC com lastro automotivo diversificado, subordinação adequada e histórico de inadimplência controlado.', riscos: 'Risco de crédito do cedente; Concentração setorial; Risco de pré-pagamento', gatilhos: 'Inadimplência > 5%; Subordinação abaixo de 25%', aprovador: 'Carolina Duarte', dataAprovacao: '2024-06-10', versao: 1, analistaResponsavel: 'a1' },
  { id: 'or2', instrumentoId: 'ie2', status: 'Aprovado', decisao: 'Investir', conviccao: 'Média', tese: 'FIDC de créditos inadimplidos com desconto agressivo. Retorno ajustado ao risco atrativo.', riscos: 'Risco de recuperação abaixo do esperado; Risco legal nas execuções; Concentração em poucos cedentes', gatilhos: 'Taxa de recuperação abaixo de 30%; Aumento de custos judiciais', aprovador: 'Rafael Mendes', dataAprovacao: '2024-02-25', versao: 1, analistaResponsavel: 'a1' },
  { id: 'or3', instrumentoId: 'ie3', status: 'Aprovado', decisao: 'Investir', conviccao: 'Alta', tese: 'CRI de empresa líder no setor imobiliário, com alienação fiduciária de imóveis residenciais premium.', riscos: 'Risco imobiliário; Risco de concentração no devedor; Risco de mercado (IPCA)', gatilhos: 'LTV acima de 80%; Default do devedor', aprovador: 'Rafael Mendes', dataAprovacao: '2022-09-10', versao: 1, analistaResponsavel: 'a2' },
  { id: 'or4', instrumentoId: 'ie4', status: 'Aprovado', decisao: 'Investir', conviccao: 'Média', tese: 'CRA de grande player de proteína animal. Risco de crédito corporativo com garantia de aval.', riscos: 'Risco de crédito BRF; Sazonalidade do setor agrícola; Risco cambial indireto', gatilhos: 'Rebaixamento de rating BRF; Alavancagem acima de 4x', aprovador: 'Carolina Duarte', dataAprovacao: '2023-04-05', versao: 1, analistaResponsavel: 'a4' },
];

export const eventosEstruturados: EventoCredito[] = [
  { id: 'ee1', tipo: 'Assembleia de cotistas', data: '2025-12-10', empresaId: '', instrumentoId: 'ie1', participacao: true, representante: 'Rafael Mendes', decisao: 'Aprovação de relatório anual', voto: 'A favor', impacto: 'Neutro', comentario: 'Aprovação unânime' },
  { id: 'ee2', tipo: 'Assembleia de cotistas', data: '2026-02-15', empresaId: '', instrumentoId: 'ie2', participacao: true, representante: 'Rafael Mendes', decisao: 'Discussão sobre aumento de PDD', voto: 'A favor', impacto: 'Negativo', comentario: 'Necessidade de reforço na provisão' },
  { id: 'ee3', tipo: 'Assembleia de debenturistas', data: '2025-11-20', empresaId: '', instrumentoId: 'ie3', participacao: true, representante: 'Carolina Duarte', decisao: 'Waiver para LTV temporário', voto: 'A favor', impacto: 'Neutro', comentario: 'LTV temporariamente elevado por reavaliação' },
  { id: 'ee4', tipo: 'Amortização extraordinária', data: '2026-01-05', empresaId: '', instrumentoId: 'ie4', participacao: false, representante: '', decisao: 'Amortização de 5% do saldo', voto: 'N/A', impacto: 'Positivo', comentario: 'BRF realizou amortização antecipada' },
];

export const ratingsEstruturados: RatingInterno[] = [
  { id: 'rie1', instrumentoId: 'ie1', empresaId: '', rating: 'AA', data: '2024-07-01', analista: 'a1', comentario: 'Rating inicial do FIDC Automotivo' },
  { id: 'rie2', instrumentoId: 'ie1', empresaId: '', rating: 'AA+', data: '2025-07-01', analista: 'a1', comentario: 'Upgrade por performance acima do esperado' },
  { id: 'rie3', instrumentoId: 'ie2', empresaId: '', rating: 'A+', data: '2024-04-01', analista: 'a1', comentario: 'Rating inicial, risco elevado por NPL' },
  { id: 'rie4', instrumentoId: 'ie2', empresaId: '', rating: 'A', data: '2026-01-15', analista: 'a1', comentario: 'Downgrade: inadimplência crescente' },
  { id: 'rie5', instrumentoId: 'ie3', empresaId: '', rating: 'AA+', data: '2022-10-01', analista: 'a2', comentario: 'Rating inicial do CRI Cyrela' },
  { id: 'rie6', instrumentoId: 'ie3', empresaId: '', rating: 'AA+', data: '2025-10-01', analista: 'a2', comentario: 'Manutenção' },
  { id: 'rie7', instrumentoId: 'ie4', empresaId: '', rating: 'AA', data: '2023-05-01', analista: 'a4', comentario: 'Rating inicial do CRA BRF' },
  { id: 'rie8', instrumentoId: 'ie4', empresaId: '', rating: 'AA', data: '2026-02-01', analista: 'a4', comentario: 'Manutenção do rating' },
];

export const ratingsExternosEstruturados: RatingExterno[] = [
  { id: 'ree1', instrumentoId: 'ie1', empresaId: '', agencia: 'Fitch', rating: 'AA(bra)', data: '2024-08-15', perspectiva: 'Estável' },
  { id: 'ree2', instrumentoId: 'ie2', empresaId: '', agencia: 'Austin', rating: 'A+(bra)', data: '2024-05-20', perspectiva: 'Negativa' },
  { id: 'ree3', instrumentoId: 'ie3', empresaId: '', agencia: 'S&P', rating: 'brAA+', data: '2023-01-10', perspectiva: 'Estável' },
  { id: 'ree4', instrumentoId: 'ie4', empresaId: '', agencia: 'Fitch', rating: 'AA(bra)', data: '2023-06-15', perspectiva: 'Positiva' },
];

export const targetPrices: TargetPrice[] = [
  { id: 'tp1', empresaId: 'e1', precoAlvo: 42.00, dataRecomendacao: '2026-01-15', horizonte: 12, teseResumida: 'Upside pela desalavancagem e dividend yield atrativo', precoAtual: 38.50, status: 'Em andamento', tempoRestante: 10 },
  { id: 'tp2', empresaId: 'e1', precoAlvo: 35.00, dataRecomendacao: '2025-06-01', horizonte: 12, teseResumida: 'Valuation descontado vs peers globais', precoAtual: 38.50, status: 'Atingido', tempoRestante: 0 },
  { id: 'tp3', empresaId: 'e2', precoAlvo: 68.00, dataRecomendacao: '2026-02-01', horizonte: 12, teseResumida: 'Recuperação do minério de ferro e custo competitivo', precoAtual: 58.20, status: 'Em andamento', tempoRestante: 11 },
  { id: 'tp4', empresaId: 'e2', precoAlvo: 72.00, dataRecomendacao: '2025-03-01', horizonte: 12, teseResumida: 'Ciclo de alta de commodities', precoAtual: 58.20, status: 'Expirado', tempoRestante: 0 },
  { id: 'tp5', empresaId: 'e3', precoAlvo: 85.00, dataRecomendacao: '2026-01-20', horizonte: 12, teseResumida: 'Sinergias da fusão e crescimento do RAC', precoAtual: 72.30, status: 'Em andamento', tempoRestante: 10 },
  { id: 'tp6', empresaId: 'e3', precoAlvo: 70.00, dataRecomendacao: '2025-04-15', horizonte: 12, teseResumida: 'Integração Unidas e normalização de frota', precoAtual: 72.30, status: 'Atingido', tempoRestante: 0 },
  { id: 'tp7', empresaId: 'e5', precoAlvo: 10.00, dataRecomendacao: '2025-12-01', horizonte: 12, teseResumida: 'Desalavancagem e melhora de margens', precoAtual: 7.80, status: 'Em andamento', tempoRestante: 9 },
  { id: 'tp8', empresaId: 'e5', precoAlvo: 12.00, dataRecomendacao: '2025-01-15', horizonte: 12, teseResumida: 'Recuperação operacional', precoAtual: 7.80, status: 'Não atingido', tempoRestante: 0 },
  { id: 'tp9', empresaId: 'e6', precoAlvo: 28.00, dataRecomendacao: '2026-02-15', horizonte: 12, teseResumida: 'Melhora de mix e vendas por m²', precoAtual: 24.50, status: 'Em andamento', tempoRestante: 11 },
  { id: 'tp10', empresaId: 'e6', precoAlvo: 25.00, dataRecomendacao: '2025-05-01', horizonte: 12, teseResumida: 'Retomada do varejo físico', precoAtual: 24.50, status: 'Expirado', tempoRestante: 0 },
  { id: 'tp11', empresaId: 'e7', precoAlvo: 35.00, dataRecomendacao: '2026-03-01', horizonte: 12, teseResumida: 'Expansão de leitos e verticalização', precoAtual: 29.80, status: 'Em andamento', tempoRestante: 12 },
  { id: 'tp12', empresaId: 'e7', precoAlvo: 30.00, dataRecomendacao: '2025-06-15', horizonte: 12, teseResumida: 'Aquisição e crescimento inorgânico', precoAtual: 29.80, status: 'Atingido', tempoRestante: 0 },
  { id: 'tp13', empresaId: 'e4', precoAlvo: 28.00, dataRecomendacao: '2026-01-10', horizonte: 12, teseResumida: 'Reajuste tarifário e novos contratos de concessão', precoAtual: 25.10, status: 'Em andamento', tempoRestante: 10 },
  { id: 'tp14', empresaId: 'e4', precoAlvo: 24.00, dataRecomendacao: '2025-02-01', horizonte: 12, teseResumida: 'Estabilidade regulatória e dividend yield', precoAtual: 25.10, status: 'Atingido', tempoRestante: 0 },
];

// Mock positions data
export const mockPosicoes: Posicao[] = [
  { tradingDeskShareSource: 'BUTIÁ TOP MASTER FI RENDA FIXA CRÉDITO PRIVADO', valDate: '03/26/2026', productClass: 'Debenture', product: 'ALGAC2', amount: 150, isin: 'BRALGTDBS0I0', financialPrice: 1115.82, durationDU: 1039, yield: 0.0843, impliedSpread: 0.0045, dv01: -0.00038 },
  { tradingDeskShareSource: 'BUTIÁ TOP MASTER FI RENDA FIXA CRÉDITO PRIVADO', valDate: '03/26/2026', productClass: 'Debenture', product: 'CTEEP6', amount: 300, isin: 'BRCTEEDBS061', financialPrice: 1045.50, durationDU: 890, yield: 0.0925, impliedSpread: 0.0065, dv01: -0.00041 },
  { tradingDeskShareSource: 'BUTIÁ TOP MASTER FI RENDA FIXA CRÉDITO PRIVADO', valDate: '03/26/2026', productClass: 'Equity', product: 'VALE3', amount: 5000, isin: 'BRVALEACNOR0', financialPrice: 58.20, durationDU: null, yield: null, impliedSpread: null, dv01: null },
  { tradingDeskShareSource: 'BUTIÁ TOP MASTER FI RENDA FIXA CRÉDITO PRIVADO', valDate: '03/26/2026', productClass: 'Equity', product: 'PETR4', amount: 8000, isin: 'BRPETRACNPR6', financialPrice: 38.50, durationDU: null, yield: null, impliedSpread: null, dv01: null },
  { tradingDeskShareSource: 'BUTIÁ TOP MASTER FI RENDA FIXA CRÉDITO PRIVADO', valDate: '03/26/2026', productClass: 'LFT', product: 'LFT 2028', amount: 200, isin: 'BRSTNCLFT0T7', financialPrice: 14250.30, durationDU: 500, yield: 0.0, impliedSpread: 0.0, dv01: -0.0001 },
  { tradingDeskShareSource: 'BUTIÁ DEBÊNTURES FI INFRA RENDA FIXA LP', valDate: '03/26/2026', productClass: 'Debenture', product: 'ALGAC2', amount: 270, isin: 'BRALGTDBS0I0', financialPrice: 1115.82, durationDU: 1039, yield: 0.0843, impliedSpread: 0.0045, dv01: -0.00038 },
  { tradingDeskShareSource: 'BUTIÁ DEBÊNTURES FI INFRA RENDA FIXA LP', valDate: '03/26/2026', productClass: 'Debenture', product: 'ALGTA4', amount: 500, isin: 'BRALGTDBS0K6', financialPrice: 1032.70, durationDU: 1248, yield: 0.0837, impliedSpread: 0.0047, dv01: -0.000457 },
  { tradingDeskShareSource: 'BUTIÁ DEBÊNTURES FI INFRA RENDA FIXA LP', valDate: '03/26/2026', productClass: 'Equity', product: 'AMER3', amount: 2068, isin: 'BRAMERACNOR6', financialPrice: 5.80, durationDU: null, yield: null, impliedSpread: null, dv01: null },
  { tradingDeskShareSource: 'BUTIÁ DEBÊNTURES FI INFRA RENDA FIXA LP', valDate: '03/26/2026', productClass: 'Debenture Pct DI', product: 'AMERF2', amount: 1542, isin: 'BRAMERDBS0G7', financialPrice: 52.35, durationDU: 833, yield: 0.1841, impliedSpread: 0.0376, dv01: null },
  { tradingDeskShareSource: 'BUTIÁ DEBÊNTURES FI INFRA RENDA FIXA LP', valDate: '03/26/2026', productClass: 'Letra Financeira DI Spread', product: 'LF Itaú 2027', amount: 100, isin: 'BRITAUDBS001', financialPrice: 1023.40, durationDU: 650, yield: 0.1105, impliedSpread: 0.0120, dv01: -0.00025 },
  { tradingDeskShareSource: 'Butiá Plus Crédito Privado FI RF LP', valDate: '03/26/2026', productClass: 'Debenture', product: 'CTEEP6', amount: 200, isin: 'BRCTEEDBS061', financialPrice: 1045.50, durationDU: 890, yield: 0.0925, impliedSpread: 0.0065, dv01: -0.00041 },
  { tradingDeskShareSource: 'Butiá Plus Crédito Privado FI RF LP', valDate: '03/26/2026', productClass: 'Letra Financeira Subordinada DI Spread', product: 'LF Sub Bradesco 2028', amount: 50, isin: 'BRBRADLFS001', financialPrice: 1052.80, durationDU: 720, yield: 0.1230, impliedSpread: 0.0195, dv01: -0.00032 },
  { tradingDeskShareSource: 'Butiá Plus Crédito Privado FI RF LP', valDate: '03/26/2026', productClass: 'Funds BR', product: 'FIDC AUTOMOTIVO', amount: 1500, isin: 'BRFDCACTF001', financialPrice: 1.12, durationDU: null, yield: null, impliedSpread: null, dv01: null },
  { tradingDeskShareSource: 'Butiá Plus Crédito Privado FI RF LP', valDate: '03/26/2026', productClass: 'Funds BR', product: 'AXIOS NPL FIDC', amount: 800, isin: 'BRAXIOCTF001', financialPrice: 1.08, durationDU: null, yield: null, impliedSpread: null, dv01: null },
  { tradingDeskShareSource: 'Butiá Plus Crédito Privado FI RF LP', valDate: '03/26/2026', productClass: 'Debenture', product: 'RDOR35', amount: 400, isin: 'BRRDORDBS035', financialPrice: 1078.90, durationDU: 1100, yield: 0.0890, impliedSpread: 0.0055, dv01: -0.00045 },
  { tradingDeskShareSource: 'BUTIA TOP PREV FIFE FIRF CP', valDate: '03/26/2026', productClass: 'Debenture', product: 'IGTA15', amount: 350, isin: 'BRIGTADBS015', financialPrice: 1035.20, durationDU: 780, yield: 0.0955, impliedSpread: 0.0080, dv01: -0.00035 },
  { tradingDeskShareSource: 'BUTIA TOP PREV FIFE FIRF CP', valDate: '03/26/2026', productClass: 'LFT', product: 'LFT 2029', amount: 100, isin: 'BRSTNCLFT0U5', financialPrice: 14180.50, durationDU: 750, yield: 0.0, impliedSpread: 0.0, dv01: -0.00012 },
  { tradingDeskShareSource: 'BUTIA TOP PREV FIFE FIRF CP', valDate: '03/26/2026', productClass: 'Overnight', product: 'SELIC', amount: 50000000, isin: '', financialPrice: 1.0, durationDU: 1, yield: null, impliedSpread: null, dv01: null },
  { tradingDeskShareSource: 'BUTIA TOP PREV FIFE FIRF CP', valDate: '03/26/2026', productClass: 'Debenture', product: 'VALE39', amount: 250, isin: 'BRVALEDBS039', financialPrice: 1062.30, durationDU: 950, yield: 0.0875, impliedSpread: 0.0050, dv01: -0.00040 },
  { tradingDeskShareSource: 'BUTIA TOP PREV FIFE FIRF CP', valDate: '03/26/2026', productClass: 'Equity', product: 'PETR4', amount: 3000, isin: 'BRPETRACNPR6', financialPrice: 38.50, durationDU: null, yield: null, impliedSpread: null, dv01: null },
  { tradingDeskShareSource: 'BUTIÁ TOP MASTER FI RENDA FIXA CRÉDITO PRIVADO', valDate: '03/26/2026', productClass: 'Letra Financeira DI Spread', product: 'LF Santander 2027', amount: 80, isin: 'BRSANTLFS001', financialPrice: 1018.60, durationDU: 580, yield: 0.1085, impliedSpread: 0.0105, dv01: -0.00022 },
  { tradingDeskShareSource: 'BUTIÁ TOP MASTER FI RENDA FIXA CRÉDITO PRIVADO', valDate: '03/26/2026', productClass: 'Overnight', product: 'SELIC', amount: 30000000, isin: '', financialPrice: 1.0, durationDU: 1, yield: null, impliedSpread: null, dv01: null },
  { tradingDeskShareSource: 'Butiá Plus Crédito Privado FI RF LP', valDate: '03/26/2026', productClass: 'CDB DI Spread', product: 'CDB Inter 2027', amount: 120, isin: 'BRINTRCDB001', financialPrice: 1015.30, durationDU: 480, yield: 0.1150, impliedSpread: 0.0135, dv01: -0.00020 },
  { tradingDeskShareSource: 'BUTIÁ DEBÊNTURES FI INFRA RENDA FIXA LP', valDate: '03/26/2026', productClass: 'Debenture', product: 'MFRA42', amount: 180, isin: 'BRMFRADBS042', financialPrice: 998.50, durationDU: 1050, yield: 0.0980, impliedSpread: 0.0095, dv01: -0.00043 },
];

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
