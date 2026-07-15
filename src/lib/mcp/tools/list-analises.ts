import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "list_analises",
  title: "Listar análises",
  description:
    "Lista análises de crédito/ações com filtros opcionais. Ordenadas pelas mais recentes.",
  inputSchema: {
    empresa_id: z.string().uuid().optional().describe("Filtra por emissor (id)."),
    recomendacao: z.string().trim().optional().describe("Ex.: Compra, Venda, Neutro."),
    analista: z.string().trim().optional().describe("Nome/id do analista responsável."),
    limit: z.number().int().min(1).max(100).optional().describe("Máx. de resultados (padrão 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ empresa_id, recomendacao, analista, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    let query = supabase
      .from("analises")
      .select(
        "id, empresa_id, isin, recomendacao, decisao, conviccao, data_inicio, data_conclusao, analista_responsavel, prazo, preco_medio",
      )
      .order("data_inicio", { ascending: false })
      .limit(limit ?? 25);
    if (empresa_id) query = query.eq("empresa_id", empresa_id);
    if (recomendacao) query = query.ilike("recomendacao", recomendacao);
    if (analista) query = query.ilike("analista_responsavel", `%${analista}%`);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { analises: data, count: data?.length ?? 0 },
    };
  },
});
