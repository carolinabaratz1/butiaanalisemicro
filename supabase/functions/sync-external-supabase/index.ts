// Espelha (TRUNCATE + INSERT) todas as tabelas do Lovable Cloud
// para o Supabase externo. Usa COPY streaming (postgres.js).
import postgres from "npm:postgres@3.4.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const TABLES = [
  // ordem indiferente — desabilitamos FKs durante o load
  "profiles", "user_roles",
  "setores", "empresas",
  "emissoes", "trade_ativos",
  "trade_ipca_ref", "trade_ntnb", "trade_taxas",
  "trade_metricas", "trade_spread_historico", "trade_spread_agg_diario",
  "trade_ticker_snapshot", "trade_upload_log",
  "posicoes",
  "analises", "credit_opinions",
  "issuer_ratings", "issuer_limits",
  "rating_emission_history", "rating_fidc_class_history", "rating_issuer_history",
  "allocation_limits", "allocation_targets", "allocation_targets_emissor",
  "allocation_targets_setor", "allocation_target_periods",
  "alert_rules", "alerts",
  "fidcs", "fidc_classes", "fidc_quota_classes",
  "fidc_monthly_reports", "fidc_monthly_quota_classes", "fidc_monthly_segments",
  "fidc_rating_history", "fidc_subordination_limits",
  "fidc_alert_rules", "fidc_alert_events",
  "assembleias", "assembleia_participacoes", "assembleia_upload_log",
  "cvm_data_dictionary", "cvm_fidc_field_mapping", "cvm_monthly_import_staging",
  "pipeline_eventos", "mfa_reset_log",
];

async function verifyCaller(req: Request): Promise<{ ok: boolean; error?: string }> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return { ok: false, error: "no_token" };
  const token = auth.slice(7);
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data: u } = await sb.auth.getUser();
  if (!u?.user) return { ok: false, error: "invalid_token" };
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: role } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id)
    .eq("role", "Gestor")
    .maybeSingle();
  if (!role) return { ok: false, error: "not_gestor" };
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const isCron = req.headers.get("x-cron-secret") === Deno.env.get("EXT_SYNC_CRON_SECRET");
  if (!isCron) {
    const v = await verifyCaller(req);
    if (!v.ok) {
      return new Response(JSON.stringify({ error: v.error }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const srcUrl = Deno.env.get("SUPABASE_DB_URL");
  const dstUrl = Deno.env.get("EXT_SUPABASE_DB_URL");
  if (!srcUrl || !dstUrl) {
    return new Response(JSON.stringify({ error: "missing_db_urls" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { tables?: string[] } = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const list = body.tables?.length ? body.tables : TABLES;

  const src = postgres(srcUrl, { max: 1, ssl: "require", idle_timeout: 20 });
  const dst = postgres(dstUrl, { max: 1, ssl: "require", idle_timeout: 20 });

  const report: Array<{ table: string; ok: boolean; ms: number; rows?: number; error?: string }> = [];
  const t0 = Date.now();

  try {
    // Desliga FKs no destino durante o load
    await dst`SET session_replication_role = replica`;

    for (const table of list) {
      const ts = Date.now();
      try {
        // Confere se a tabela existe nos dois lados
        const [{ exists: srcHas }] = await src`
          SELECT EXISTS (SELECT 1 FROM information_schema.tables
            WHERE table_schema='public' AND table_name=${table}) AS exists`;
        const [{ exists: dstHas }] = await dst`
          SELECT EXISTS (SELECT 1 FROM information_schema.tables
            WHERE table_schema='public' AND table_name=${table}) AS exists`;
        if (!srcHas || !dstHas) {
          report.push({ table, ok: false, ms: Date.now() - ts, error: `missing:src=${srcHas},dst=${dstHas}` });
          continue;
        }

        // Colunas em comum (evita erro se schemas divergirem)
        const cols = await src<{ column_name: string }[]>`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema='public' AND table_name=${table}
          ORDER BY ordinal_position`;
        const dstCols = await dst<{ column_name: string }[]>`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema='public' AND table_name=${table}`;
        const dstSet = new Set(dstCols.map((c) => c.column_name));
        const shared = cols.map((c) => c.column_name).filter((c) => dstSet.has(c));
        if (shared.length === 0) {
          report.push({ table, ok: false, ms: Date.now() - ts, error: "no_shared_columns" });
          continue;
        }
        const colList = shared.map((c) => `"${c}"`).join(",");

        await dst.unsafe(`TRUNCATE TABLE public."${table}" RESTART IDENTITY CASCADE`);

        const readable = await src.unsafe(
          `COPY (SELECT ${colList} FROM public."${table}") TO STDOUT WITH (FORMAT csv, HEADER true)`,
        ).readable();
        const writable = await dst.unsafe(
          `COPY public."${table}" (${colList}) FROM STDIN WITH (FORMAT csv, HEADER true)`,
        ).writable();
        await readable.pipeTo(writable);

        const [{ n }] = await dst.unsafe(`SELECT COUNT(*)::int AS n FROM public."${table}"`);
        report.push({ table, ok: true, ms: Date.now() - ts, rows: n });
      } catch (e) {
        report.push({ table, ok: false, ms: Date.now() - ts, error: (e as Error).message });
      }
    }
  } finally {
    try { await dst`SET session_replication_role = origin`; } catch { /* ignore */ }
    await src.end({ timeout: 5 });
    await dst.end({ timeout: 5 });
  }

  const totalMs = Date.now() - t0;
  const okCount = report.filter((r) => r.ok).length;
  return new Response(
    JSON.stringify({ total_ms: totalMs, ok: okCount, failed: report.length - okCount, report }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
