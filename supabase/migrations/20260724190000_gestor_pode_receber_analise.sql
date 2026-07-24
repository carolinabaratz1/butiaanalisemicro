-- Permite que usuários com função "Gestor" também apareçam como responsáveis elegíveis
-- para receber análises no Pipeline Research (mantendo Analista e Coordenação/Especialista).
-- O acompanhamento em Desempenho & Agenda continua não exibindo análises de Gestores
-- (filtro aplicado no client, ver src/hooks/useDesempenhoData.ts).
CREATE OR REPLACE FUNCTION public.get_active_analysts()
 RETURNS TABLE(id uuid, nome text, funcao text, status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, nome, funcao, status
  FROM public.profiles
  WHERE status = 'Ativo'
    AND funcao IN ('Analista', 'Coordenação/Especialista', 'Gestor');
$function$;
