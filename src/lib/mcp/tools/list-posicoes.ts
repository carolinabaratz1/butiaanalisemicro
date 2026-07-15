import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "list_posicoes",
  title: "Listar posições",
  description:
    "Lista posições da carteira em uma data (padrão: mais recente). Filtros opcionais por ISIN e classe do produto.",
  inputSchema: {
    val_date: z.string().trim().optional().describe("Data de referência YYYY-MM-DD. Padrão: última."),
    isin: z.string().trim().optional().describe("Filtra por ISIN."),
    product_class: z.string().trim().optional().describe("Classe do produto (ex.: DEB, LFT)."),
    limit: z.number().int().min(1).max(200).optional().describe("Máx. de resultados (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ val_date, isin, product_class, limit }, ctx) => {
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

    let dateFilter = val_date;
    if (!dateFilter) {
      const { data: latest } = await supabase
        .from("posicoes")
        .select("val_date")
        .order("val_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      dateFilter = latest?.val_date;
    }
    if (!dateFilter) {
      return { content: [{ type: "text", text: "Nenhuma posição encontrada." }] };
    }

    let query = supabase
      .from("posicoes")
      .select(
        "id, val_date, isin, product, product_class, amount, financial_price, duration_du, yield, implied_spread",
      )
      .eq("val_date", dateFilter)
      .order("amount", { ascending: false })
      .limit(limit ?? 50);
    if (isin) query = query.eq("isin", isin);
    if (product_class) query = query.eq("product_class", product_class);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify({ val_date: dateFilter, posicoes: data }) }],
      structuredContent: { val_date: dateFilter, posicoes: data, count: data?.length ?? 0 },
    };
  },
});
