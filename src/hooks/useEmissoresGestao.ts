import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type EmissorAlert = {
  type: string;
  severity: 'high' | 'medium' | 'low';
  label: string;
};

export type EmissorFundExposure = {
  fundo: string;
  valor: number;
  pct_fund: number | null;
};

export type EmissorGestaoRow = {
  cnpj: string;
  cnpj_norm: string;
  nome: string;
  grupo_economico: string | null;
  setor: string | null;
  tipo: string | null;
  rating: string | null;
  rating_source: 'ticker' | 'emissor' | 'grupo' | 'nr' | null;
  rating_agencia: string | null;
  rating_data: string | null;
  analise_id: string | null;
  analise_status: string | null;
  analise_recomendacao: string | null;
  analise_data_conclusao: string | null;
  analise_data_validade: string | null;
  analise_vencida: boolean;
  analista_id: string | null;
  analista_nome?: string | null;
  exposure_total: number;
  funds_count: number;
  funds_list: EmissorFundExposure[];
  largest_fund: string | null;
  largest_fund_value: number | null;
  largest_fund_pct: number | null;
  consolidated_pct: number | null;
  limit_value: number | null;
  limit_pct_nav: number | null;
  limit_type: string | null;
  usage_ratio: number | null;
  limit_status: 'dentro' | 'proximo' | 'acima' | 'nao_cadastrado';
  alerts: EmissorAlert[];
};

export function useEmissoresGestao() {
  return useQuery({
    queryKey: ['emissores-gestao'],
    queryFn: async (): Promise<EmissorGestaoRow[]> => {
      const [{ data, error }, profilesRes] = await Promise.all([
        (supabase as any).rpc('get_emissores_gestao'),
        (supabase as any).rpc('get_profile_names'),
      ]);
      if (error) throw error;
      const profileMap = new Map<string, string>();
      (profilesRes?.data ?? []).forEach((p: any) => {
        if (p?.id) profileMap.set(p.id, p.nome);
        if (p?.nome) profileMap.set(p.nome, p.nome);
      });
      return (data as any[]).map((r) => ({
        ...r,
        exposure_total: Number(r.exposure_total ?? 0),
        funds_count: Number(r.funds_count ?? 0),
        funds_list: Array.isArray(r.funds_list) ? r.funds_list : [],
        alerts: Array.isArray(r.alerts) ? r.alerts : [],
        analista_nome: r.analista_id ? profileMap.get(r.analista_id) ?? r.analista_id : null,
      })) as EmissorGestaoRow[];
    },
    staleTime: 60_000,
  });
}
