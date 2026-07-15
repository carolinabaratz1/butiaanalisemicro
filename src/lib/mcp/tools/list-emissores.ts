import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "list_emissores",
  title: "Listar emissores",
  description:
    "Lista emissores (empresas) da plataforma Butiá com filtros opcionais por nome, setor e rating. Máximo 100 resultados.",
  inputSchema: {
    search: z.string().trim().optional().describe("Busca em nome ou CNPJ."),
    setor: z.string().trim().optional().describe("Filtra por setor."),
    limit: z.number().int().min(1).max(100).optional().describe("Máx. de resultados (padrão 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, setor, limit }, ctx) => {
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
      .from("empresas")
      .select("id, nome, cnpj, setor, grupo_economico, rating, status, tipo")
      .order("nome", { ascending: true })
      .limit(limit ?? 25);
    if (search) query = query.or(`nome.ilike.%${search}%,cnpj.ilike.%${search}%`);
    if (setor) query = query.eq("setor", setor);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { emissores: data, count: data?.length ?? 0 },
    };
  },
});
