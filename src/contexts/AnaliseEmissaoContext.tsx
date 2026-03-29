import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export type AnaliseStatus = 'pendente' | 'em_analise' | 'concluido' | 'rejeitado';

export interface AnaliseEmissao {
  id: string;
  isin: string;
  cnpj_emissor: string;
  analista_id: string;
  solicitante_id: string;
  status: AnaliseStatus;
  prazo: string;
  observacoes: string;
  relatorio: string;
  data_solicitacao: string;
  data_inicio: string | null;
  data_conclusao: string | null;
  created_at: string;
  updated_at: string;
}

interface AnaliseEmissaoContextType {
  analises: AnaliseEmissao[];
  criarAnalise: (data: Omit<AnaliseEmissao, 'id' | 'created_at' | 'updated_at' | 'data_inicio' | 'data_conclusao' | 'relatorio'>) => void;
  iniciarAnalise: (id: string) => void;
  concluirAnalise: (id: string, relatorio: string) => void;
  rejeitarAnalise: (id: string) => void;
  reabrirAnalise: (id: string) => void;
  reatribuirAnalista: (id: string, novoAnalistaId: string) => void;
  getAnalisesByEmissor: (cnpj: string) => AnaliseEmissao[];
  getAnalisesByIsin: (isin: string) => AnaliseEmissao[];
  getAnalisesByAnalista: (analistaId: string) => AnaliseEmissao[];
  getAnalisesAtivas: (cnpj: string) => number;
  temPrazoVencido: (cnpj: string) => boolean;
}

const AnaliseEmissaoContext = createContext<AnaliseEmissaoContextType | null>(null);

const now = () => new Date().toISOString();

// Seed mock data
const initialAnalises: AnaliseEmissao[] = [];
    analista_id: 'u5', solicitante_id: 'u2', status: 'concluido',
    prazo: '2026-03-15', observacoes: 'Análise de crédito da debênture ALGAC2',
    relatorio: 'Análise concluída. A Algar Telecom apresenta perfil de crédito sólido com geração de caixa estável. Recomendamos manutenção da posição. A empresa tem demonstrado disciplina na alavancagem, mantendo o indicador Dívida Líquida/EBITDA abaixo de 2.5x.',
    data_solicitacao: '2026-03-01T10:00:00', data_inicio: '2026-03-02T09:00:00',
    data_conclusao: '2026-03-14T16:30:00', created_at: '2026-03-01T10:00:00', updated_at: '2026-03-14T16:30:00',
  },
  {
    id: 'ae2', isin: 'BRALGTDBS0K6', cnpj_emissor: '71.208.516/0001-74',
    analista_id: 'u6', solicitante_id: 'u2', status: 'em_analise',
    prazo: '2026-04-05', observacoes: 'Análise da debênture ALGTA4 - verificar indexador',
    relatorio: '', data_solicitacao: '2026-03-20T14:00:00', data_inicio: '2026-03-21T08:30:00',
    data_conclusao: null, created_at: '2026-03-20T14:00:00', updated_at: '2026-03-21T08:30:00',
  },
  {
    id: 'ae3', isin: 'BRARTRDBS0B6', cnpj_emissor: '02.919.555/0001-67',
    analista_id: 'u7', solicitante_id: 'u3', status: 'pendente',
    prazo: '2026-04-10', observacoes: 'Avaliar risco de concessão rodoviária',
    relatorio: '', data_solicitacao: '2026-03-25T11:00:00', data_inicio: null,
    data_conclusao: null, created_at: '2026-03-25T11:00:00', updated_at: '2026-03-25T11:00:00',
  },
  {
    id: 'ae4', isin: 'BRASAIDBS044', cnpj_emissor: '06.057.223/0001-71',
    analista_id: 'u8', solicitante_id: 'u1', status: 'pendente',
    prazo: '2026-03-25', observacoes: 'Urgente - prazo curto. Analisar risco de crédito Assaí.',
    relatorio: '', data_solicitacao: '2026-03-18T09:00:00', data_inicio: null,
    data_conclusao: null, created_at: '2026-03-18T09:00:00', updated_at: '2026-03-18T09:00:00',
  },
  {
    id: 'ae5', isin: 'BRBBDCLTRRA2', cnpj_emissor: '60.746.948/0001-12',
    analista_id: 'u5', solicitante_id: 'u2', status: 'em_analise',
    prazo: '2026-04-01', observacoes: 'Análise de LF Bradesco',
    relatorio: '', data_solicitacao: '2026-03-15T10:00:00', data_inicio: '2026-03-16T09:00:00',
    data_conclusao: null, created_at: '2026-03-15T10:00:00', updated_at: '2026-03-16T09:00:00',
  },
  {
    id: 'ae6', isin: 'BRBBASLFIDT2', cnpj_emissor: '00.000.000/0001-91',
    analista_id: 'u9', solicitante_id: 'u4', status: 'concluido',
    prazo: '2026-03-10', observacoes: 'Análise padrão de LF Banco do Brasil',
    relatorio: 'Banco do Brasil apresenta solidez institucional e métricas de crédito compatíveis com rating AAA. LF adequada para carteira de alta qualidade. Recomendação: manter posição.',
    data_solicitacao: '2026-02-25T08:00:00', data_inicio: '2026-02-26T09:00:00',
    data_conclusao: '2026-03-08T15:00:00', created_at: '2026-02-25T08:00:00', updated_at: '2026-03-08T15:00:00',
  },
  {
    id: 'ae7', isin: 'BRCCRODBS0B7', cnpj_emissor: '02.846.056/0001-97',
    analista_id: 'u7', solicitante_id: 'u2', status: 'rejeitado',
    prazo: '2026-03-20', observacoes: 'Análise de debênture CCR',
    relatorio: 'Análise rejeitada por falta de documentação atualizada do emissor. Necessário reavaliar após recebimento dos documentos.',
    data_solicitacao: '2026-03-05T10:00:00', data_inicio: '2026-03-06T09:00:00',
    data_conclusao: '2026-03-18T14:00:00', created_at: '2026-03-05T10:00:00', updated_at: '2026-03-18T14:00:00',
  },
  {
    id: 'ae8', isin: 'BRSABORLFI4M2', cnpj_emissor: '43.776.517/0001-80',
    analista_id: 'u6', solicitante_id: 'u3', status: 'concluido',
    prazo: '2026-03-12', observacoes: 'Revisão periódica Sabesp',
    relatorio: 'Sabesp mantém perfil de crédito AAA pós-privatização. Melhora operacional significativa observada. Dívida líquida/EBITDA em 1.8x. Recomendamos aumento de exposição.',
    data_solicitacao: '2026-02-28T11:00:00', data_inicio: '2026-03-01T09:00:00',
    data_conclusao: '2026-03-11T17:00:00', created_at: '2026-02-28T11:00:00', updated_at: '2026-03-11T17:00:00',
  },
  {
    id: 'ae9', isin: 'BR0M1TCTF011', cnpj_emissor: '57.283.589/0001-08',
    analista_id: 'u8', solicitante_id: 'u1', status: 'em_analise',
    prazo: '2026-03-30', observacoes: 'FIDC AXIOS NPL - monitorar inadimplência',
    relatorio: '', data_solicitacao: '2026-03-22T08:30:00', data_inicio: '2026-03-23T09:00:00',
    data_conclusao: null, created_at: '2026-03-22T08:30:00', updated_at: '2026-03-23T09:00:00',
  },
  {
    id: 'ae10', isin: 'BRALGEDBS045', cnpj_emissor: '12.009.135/0001-05',
    analista_id: 'u11', solicitante_id: 'u2', status: 'pendente',
    prazo: '2026-04-15', observacoes: 'Primeira análise de debênture Aliança Geração',
    relatorio: '', data_solicitacao: '2026-03-27T10:00:00', data_inicio: null,
    data_conclusao: null, created_at: '2026-03-27T10:00:00', updated_at: '2026-03-27T10:00:00',
  },
];

export function AnaliseEmissaoProvider({ children }: { children: ReactNode }) {
  const [analises, setAnalises] = useState<AnaliseEmissao[]>(initialAnalises);

  const criarAnalise = useCallback((data: Omit<AnaliseEmissao, 'id' | 'created_at' | 'updated_at' | 'data_inicio' | 'data_conclusao' | 'relatorio'>) => {
    const nova: AnaliseEmissao = {
      ...data,
      id: `ae${Date.now()}`,
      relatorio: '',
      data_inicio: null,
      data_conclusao: null,
      created_at: now(),
      updated_at: now(),
    };
    setAnalises(prev => [...prev, nova]);
  }, []);

  const iniciarAnalise = useCallback((id: string) => {
    setAnalises(prev => prev.map(a => a.id === id ? { ...a, status: 'em_analise' as const, data_inicio: now(), updated_at: now() } : a));
  }, []);

  const concluirAnalise = useCallback((id: string, relatorio: string) => {
    setAnalises(prev => prev.map(a => a.id === id ? { ...a, status: 'concluido' as const, relatorio, data_conclusao: now(), updated_at: now() } : a));
  }, []);

  const rejeitarAnalise = useCallback((id: string) => {
    setAnalises(prev => prev.map(a => a.id === id ? { ...a, status: 'rejeitado' as const, data_conclusao: now(), updated_at: now() } : a));
  }, []);

  const reabrirAnalise = useCallback((id: string) => {
    setAnalises(prev => prev.map(a => a.id === id ? { ...a, status: 'pendente' as const, data_inicio: null, data_conclusao: null, updated_at: now() } : a));
  }, []);

  const reatribuirAnalista = useCallback((id: string, novoAnalistaId: string) => {
    setAnalises(prev => prev.map(a => a.id === id ? { ...a, analista_id: novoAnalistaId, updated_at: now() } : a));
  }, []);

  const getAnalisesByEmissor = useCallback((cnpj: string) => analises.filter(a => a.cnpj_emissor === cnpj), [analises]);
  const getAnalisesByIsin = useCallback((isin: string) => analises.filter(a => a.isin === isin), [analises]);
  const getAnalisesByAnalista = useCallback((analistaId: string) => analises.filter(a => a.analista_id === analistaId), [analises]);
  const getAnalisesAtivas = useCallback((cnpj: string) => analises.filter(a => a.cnpj_emissor === cnpj && (a.status === 'pendente' || a.status === 'em_analise')).length, [analises]);
  const temPrazoVencido = useCallback((cnpj: string) => {
    const hoje = new Date().toISOString().split('T')[0];
    return analises.some(a => a.cnpj_emissor === cnpj && (a.status === 'pendente' || a.status === 'em_analise') && a.prazo < hoje);
  }, [analises]);

  return (
    <AnaliseEmissaoContext.Provider value={{
      analises, criarAnalise, iniciarAnalise, concluirAnalise, rejeitarAnalise,
      reabrirAnalise, reatribuirAnalista, getAnalisesByEmissor, getAnalisesByIsin,
      getAnalisesByAnalista, getAnalisesAtivas, temPrazoVencido,
    }}>
      {children}
    </AnaliseEmissaoContext.Provider>
  );
}

export function useAnaliseEmissao() {
  const ctx = useContext(AnaliseEmissaoContext);
  if (!ctx) throw new Error('useAnaliseEmissao must be used within AnaliseEmissaoProvider');
  return ctx;
}
