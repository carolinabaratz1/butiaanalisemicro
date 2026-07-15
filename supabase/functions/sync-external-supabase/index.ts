// Espelha (TRUNCATE + INSERT em lotes JSON) todas as tabelas do Lovable Cloud
// para o Supabase externo. Compatível com pooler (transaction mode).
import postgres from "npm:postgres@3.4.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const TABLES_ALL = [
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

const DEFAULT_BATCH_SIZE = 2000;
const MAX_BATCH_SIZE = 5000;
const TIME_BUDGET_MS = 20_000;

type SyncBody = {
  table?: string;
  tables?: string[];
  offset?: number;
  limit?: number;
  reset?: boolean;
  list_only?: boolean;
};

const TABLE_SET = new Set(TABLES_ALL);

function clampBatchSize(value: unknown) {
  const parsed = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : DEFAULT_BATCH_SIZE;
  return Math.min(Math.max(parsed, 1), MAX_BATCH_SIZE);
}

function safeOffset(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function resolveRequestedTable(body: SyncBody) {
  const table = body.table ?? body.tables?.[0];
  if (!table) return { error: "table_required" } as const;
  if (!TABLE_SET.has(table)) return { error: "table_not_allowed" } as const;
  return { table } as const;
}

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

  let body: SyncBody = {};
  try { body = await req.json(); } catch { /* ignore */ }

  if (body.list_only) {
    return new Response(JSON.stringify({ tables: TABLES_ALL }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const requested = resolveRequestedTable(body);
  if ("error" in requested) {
    return new Response(JSON.stringify({ error: requested.error, tables: TABLES_ALL }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const table = requested.table;
  const offset = safeOffset(body.offset);
  const limit = clampBatchSize(body.limit);
  const reset = body.reset === true;

  // prepare:false é necessário para pooler em transaction mode (pgBouncer)
  const src = postgres(srcUrl, { max: 1, ssl: "require", prepare: false, idle_timeout: 20 });
  const dst = postgres(dstUrl, { max: 1, ssl: "require", prepare: false, idle_timeout: 20 });

  const report: Array<{ table: string; ok: boolean; ms: number; rows?: number; offset?: number; next_offset?: number; done?: boolean; reset?: boolean; error?: string }> = [];
  const t0 = Date.now();

  try {
    await dst`SET session_replication_role = replica`;

    const ts = Date.now();
    try {
      // Colunas em comum
      const srcCols = await src<{ column_name: string }[]>`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name=${table}
        ORDER BY ordinal_position`;
      const dstCols = await dst<{ column_name: string }[]>`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name=${table}`;
      if (srcCols.length === 0 || dstCols.length === 0) {
        report.push({ table, ok: false, ms: Date.now() - ts, error: `missing_schema (src=${srcCols.length},dst=${dstCols.length})` });
      } else {
        const dstSet = new Set(dstCols.map((c) => c.column_name));
        const shared = srcCols.map((c) => c.column_name).filter((c) => dstSet.has(c));
        if (shared.length === 0) {
          report.push({ table, ok: false, ms: Date.now() - ts, error: "no_shared_columns" });
        } else {
          const colListQuoted = shared.map((c) => `"${c.replaceAll('"', '""')}"`).join(",");

          if (reset) {
            await dst.unsafe(`TRUNCATE TABLE public."${table}" RESTART IDENTITY CASCADE`);
          }

          // Loop internamente múltiplos chunks até esgotar o time budget
          let curOffset = offset;
          let totalRows = 0;
          let done = false;
          while (Date.now() - ts < TIME_BUDGET_MS) {
            const rows = await src.unsafe(
              `SELECT ${colListQuoted} FROM public."${table}" ORDER BY 1 OFFSET ${curOffset} LIMIT ${limit}`,
            );
            if (rows.length > 0) {
              await dst`
                INSERT INTO ${dst(table)} (${dst.unsafe(colListQuoted)})
                SELECT ${dst.unsafe(colListQuoted)}
                FROM jsonb_populate_recordset(NULL::${dst(table)}, ${dst.json(rows)})
              `;
            }
            curOffset += rows.length;
            totalRows += rows.length;
            if (rows.length < limit) { done = true; break; }
          }

          report.push({
            table,
            ok: true,
            ms: Date.now() - ts,
            rows: totalRows,
            offset,
            next_offset: curOffset,
            done,
            reset,
          });
        }

      }
    } catch (e) {
      report.push({ table, ok: false, ms: Date.now() - ts, error: (e as Error).message });
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
