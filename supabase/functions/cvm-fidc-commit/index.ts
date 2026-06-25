// POC commit: grava os informes selecionados (vindos do diagnóstico /cvm-fidc-import)
// em fidc_monthly_reports + fidc_monthly_quota_classes com source='cvm_open_data'.
// O front envia os dados já agregados; aqui só persistimos.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

type ClassItem = { name: string; type?: string; pl?: number | null; quotaValue?: number | null; numberOfQuotas?: number | null; monthlyYieldPct?: number | null };
type Item = {
  fidcId: string; cnpj: string; referenceMonth: string; // YYYY-MM-DD
  mode: "replace" | "new_version";
  pl: number | null; creditRights: number | null; caixaAmpliado: number | null;
  cash: number | null; pdd: number | null;
  overdueTotal: number | null; overdue30: number | null; overdue60: number | null; overdue90: number | null; overdue120: number | null;
  repurchase: number | null; investors: number | null;
  classes: ClassItem[]; sumClassesPL: number;
  plDiff: number | null; plDiffPct: number | null;
  status: string;
};
type Body = { referenceMonth: string; sourceUrl: string; fileHash: string; items: Item[] };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.claims.sub as string;
    // Checa permissão usando função existente
    const { data: canWrite, error: roleErr } = await userClient.rpc("fidc_can_write", { _user_id: userId });
    if (roleErr || !canWrite) {
      return new Response(JSON.stringify({ error: "Permissão negada" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = (await req.json()) as Body;
    const results: Array<{ fidcId: string; cnpj: string; ok: boolean; reportId?: string; error?: string }> = [];

    for (const it of body.items) {
      try {
        // Versionamento: se modo replace → atualizar registro corrente; se new_version → marcar atuais como não-correntes e inserir.
        const { data: existing } = await admin
          .from("fidc_monthly_reports")
          .select("id, version, is_current_version")
          .eq("fidc_id", it.fidcId).eq("reference_month", it.referenceMonth);

        const baseRow = {
          fidc_id: it.fidcId,
          reference_month: it.referenceMonth,
          nav_value: it.pl,
          credit_rights_value: it.creditRights,
          cash_value: (it.cash ?? 0) + (it.caixaAmpliado != null && it.cash != null ? (it.caixaAmpliado - it.cash) : 0) || it.caixaAmpliado,
          pdd_value: it.pdd,
          overdue_value: it.overdueTotal,
          overdue_30d_value: it.overdue30, overdue_60d_value: it.overdue60,
          overdue_90d_value: it.overdue90, overdue_120d_value: it.overdue120,
          repurchase_value: it.repurchase,
          investors_count: it.investors,
          quota_total_nav_value: it.sumClassesPL,
          quota_validation_difference: it.plDiff,
          quota_validation_difference_percentage: it.plDiffPct,
          quota_validation_status: it.status === "validacao_critica" ? "invalid" : it.status === "cotas_ausentes" ? "quota_data_missing" : "valid",
          quota_classes_found_count: it.classes.length,
          subordinated_calculation_status: it.classes.length > 1 ? "calculated" : "single_class",
          raw_data: { source: "cvm_open_data", url: body.sourceUrl, classes: it.classes, status: it.status } as Record<string, unknown>,
          source: "cvm_open_data",
          source_url: body.sourceUrl,
          file_hash: body.fileHash,
          imported_at: new Date().toISOString(),
          imported_by: userId,
          is_current_version: true,
        };

        let reportId: string;
        if (existing && existing.length && it.mode === "replace") {
          const current = existing.find((e) => e.is_current_version) ?? existing[0];
          const { error } = await admin.from("fidc_monthly_reports").update(baseRow).eq("id", current.id);
          if (error) throw error;
          reportId = current.id;
          // limpa cotas antigas desse report
          await admin.from("fidc_monthly_quota_classes").delete().eq("fidc_monthly_report_id", reportId);
        } else {
          // marca anteriores como não-correntes
          if (existing && existing.length) {
            await admin.from("fidc_monthly_reports")
              .update({ is_current_version: false })
              .eq("fidc_id", it.fidcId).eq("reference_month", it.referenceMonth);
          }
          const nextVersion = (existing?.reduce((m, e) => Math.max(m, e.version ?? 1), 0) ?? 0) + 1;
          const { data: inserted, error } = await admin.from("fidc_monthly_reports")
            .insert({ ...baseRow, version: nextVersion }).select("id").single();
          if (error) throw error;
          reportId = inserted.id;
        }

        // Cotas
        if (it.classes.length) {
          const rows = it.classes.map((c) => ({
            fidc_monthly_report_id: reportId,
            class_name: c.name,
            quota_type: c.type ?? null,
            nav_value: c.pl ?? null,
            quota_value: c.quotaValue ?? null,
            number_of_quotas: c.numberOfQuotas ?? null,
            monthly_yield_pct: c.monthlyYieldPct ?? null,
            matching_status: "cvm_import",
            source: "cvm_open_data",
          }));
          const { error } = await admin.from("fidc_monthly_quota_classes").insert(rows);
          if (error) throw error;
        }

        results.push({ fidcId: it.fidcId, cnpj: it.cnpj, ok: true, reportId });
      } catch (e) {
        results.push({ fidcId: it.fidcId, cnpj: it.cnpj, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    return new Response(JSON.stringify({ ok: true, total: results.length, success: okCount, failed: results.length - okCount, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
