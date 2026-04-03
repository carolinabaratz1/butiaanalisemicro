import { supabase } from '@/integrations/supabase/client';

export interface PipelineEvento {
  analise_id: string;
  acao: string;
  etapa_anterior?: string | null;
  etapa_nova?: string | null;
  comentario?: string | null;
  data_comite?: string | null;
}

/**
 * Fire-and-forget: registra evento no audit trail do pipeline.
 * Erros são logados no console mas não bloqueiam a ação principal.
 */
export async function registrarEvento(evento: PipelineEvento) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('pipeline_eventos' as any).insert({
      analise_id: evento.analise_id,
      user_id: user?.id ?? null,
      acao: evento.acao,
      etapa_anterior: evento.etapa_anterior ?? null,
      etapa_nova: evento.etapa_nova ?? null,
      comentario: evento.comentario ?? null,
      data_comite: evento.data_comite ?? null,
    });
  } catch (err) {
    console.error('[AuditTrail] Erro ao registrar evento:', err);
  }
}
