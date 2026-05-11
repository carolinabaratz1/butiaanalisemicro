import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Lista dinâmica de fundos derivada da tabela `posicoes`
 * (coluna `trading_desk_share_source`). Atualiza automaticamente
 * a cada novo upload de posições.
 */
export function useFundos() {
  return useQuery({
    queryKey: ['fundos-distintos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posicoes')
        .select('trading_desk_share_source')
        .not('trading_desk_share_source', 'is', null);

      if (error) {
        console.error('[useFundos] erro ao buscar fundos:', error);
        throw error;
      }

      const distintos = [
        ...new Set(
          (data ?? [])
            .map((row) => (row.trading_desk_share_source as string | null)?.trim())
            .filter((v): v is string => !!v),
        ),
      ].sort((a, b) => a.localeCompare(b, 'pt-BR'));

      return distintos;
    },
    staleTime: 5 * 60 * 1000,
  });
}
