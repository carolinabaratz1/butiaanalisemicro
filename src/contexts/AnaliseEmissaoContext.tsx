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

// Start with empty pipeline
const initialAnalises: AnaliseEmissao[] = [];

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
