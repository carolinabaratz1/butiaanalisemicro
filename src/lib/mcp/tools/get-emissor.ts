import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "get_emissor",
  title: "Detalhes do emissor",
  description:
    "Retorna detalhes de um emissor por CNPJ, incluindo emissões vinculadas e últimas análises.",
  inputSchema: {
    cnpj: z.string().trim().min(11).describe("CNPJ do emissor (com ou sem formatação)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ cnpj }, ctx) => {
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
    const { data: empresa, error } = await supabase
      .from("empresas")
      .select("*")
      .eq("cnpj", cnpj)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!empresa) {
      return { content: [{ type: "text", text: `Nenhum emissor com CNPJ ${cnpj}.` }], isError: true };
    }
    const [{ data: emissoes }, { data: analises }] = await Promise.all([
      supabase.from("emissoes").select("*").eq("empresa_id", empresa.id).limit(50),
      supabase
        .from("analises")
        .select("id, isin, recomendacao, decisao, data_inicio, data_conclusao, analista_responsavel")
        .eq("empresa_id", empresa.id)
        .order("data_inicio", { ascending: false })
        .limit(20),
    ]);
    const payload = { empresa, emissoes: emissoes ?? [], analises: analises ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
