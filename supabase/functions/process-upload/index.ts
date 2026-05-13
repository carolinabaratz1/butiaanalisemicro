// ============================================================
// BUTIA · Edge Function: process-upload
// Lightweight coordinator for trade uploads.
//
// The browser parses the XLSX and sends normalized row chunks.
// This function only creates the upload log, performs chunked
// upserts with the service role, and finalizes metrics in the
// background so the Edge worker does not hold large workbooks in
// memory.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Background task API exposed by Supabase Edge Runtime
// deno-lint-ignore no-explicit-any
declare const EdgeRuntime: { waitUntil(p: Promise<any>): void };

type UploadTable = "trade_taxas" | "trade_ativos" | "trade_ntnb" | "trade_ipca_ref";

type UploadSummary = {
  data_inicio?: string | null;
  data_fim?: string | null;
  ativos_di?: number | null;
  ativos_ipca?: number | null;
  linhas_inseridas?: number | null;
  linhas_atualizadas?: number | null;
};

type IpcaBatchResult = {
  processed_count?: number | string | null;
  next_after_ticker?: string | null;
  has_more?: boolean | null;
};

const tableConfig: Record<UploadTable, { onConflict: string }> = {
  trade_taxas: { onConflict: "ticker,data" },
  trade_ativos: { onConflict: "ticker" },
  trade_ntnb: { onConflict: "bond_name,data" },
  trade_ipca_ref: { onConflict: "ticker" },
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isUploadTable(value: unknown): value is UploadTable {
  return typeof value === "string" && value in tableConfig;
}

function asLogId(value: unknown): number {
  const logId = Number(value);
  if (!Number.isInteger(logId) || logId <= 0) throw new Error("log_id inválido.");
  return logId;
}

function asRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error("rows deve ser uma lista.");
  if (value.length > 500) throw new Error("Envie no máximo 500 linhas por lote.");
  return value.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error("Cada item de rows deve ser um objeto.");
    }
    return row as Record<string, unknown>;
  });
}

function dedupeRows(
  table: UploadTable,
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  const keys = tableConfig[table].onConflict.split(",").map((k) => k.trim());
  const map = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = keys.map((k) => {
      const v = row[k];
      return v === null || v === undefined ? "" : String(v);
    }).join("||");
    // Last occurrence wins (mesma semântica de um upsert linha-a-linha)
    map.set(key, row);
  }
  return Array.from(map.values());
}

function isTransientError(msg: string): boolean {
  // Cloudflare 5xx HTML pages, gateway timeouts, connection resets
  return /\b(520|521|522|523|524|502|503|504)\b/.test(msg)
    || /Web server is returning an unknown error/i.test(msg)
    || /cloudflare/i.test(msg)
    || /fetch failed|network|timeout|ECONNRESET|terminated/i.test(msg);
}

async function upsertChunk(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  table: UploadTable,
  chunk: Record<string, unknown>[],
) {
  let lastErr = "";
  for (let attempt = 1; attempt <= 4; attempt++) {
    const { error } = await supabase.from(table).upsert(chunk, {
      onConflict: tableConfig[table].onConflict,
    });
    if (!error) return;
    lastErr = error.message ?? String(error);
    if (!isTransientError(lastErr) || attempt === 4) {
      throw new Error(`${table} upsert: ${lastErr.slice(0, 500)}`);
    }
    await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
  }
  throw new Error(`${table} upsert: ${lastErr.slice(0, 500)}`);
}

async function batchUpsert(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  table: UploadTable,
  rows: Record<string, unknown>[],
) {
  if (rows.length === 0) return 0;
  const deduped = dedupeRows(table, rows);
  // Sub-chunk to keep payloads small and reduce 520 risk on large batches.
  const SUB = 200;
  for (let i = 0; i < deduped.length; i += SUB) {
    await upsertChunk(supabase, table, deduped.slice(i, i + SUB));
  }
  return deduped.length;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Método não permitido." }, 405);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return jsonResponse({ success: false, error: "Sessão inválida. Faça login novamente." }, 401);
  }

  // Role check: only Gestor / Coordenação/Especialista / Analista can upload trade data
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["Gestor", "Coordenação/Especialista", "Analista"])
    .maybeSingle();
  if (!roleRow) {
    return jsonResponse({ success: false, error: "Sem permissão para fazer upload." }, 403);
  }

  let body: Record<string, unknown> | null = null;

  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return jsonResponse({
        success: false,
        error: "Cliente desatualizado: envie os dados processados em JSON.",
      }, 400);
    }

    body = await req.json();
    const action = body?.action;

    if (action === "start") {
      const filename = String(body?.filename ?? "").trim();
      if (!filename) throw new Error("filename é obrigatório.");

      const { data: logRow, error } = await supabase
        .from("trade_upload_log")
        .insert({ filename, uploaded_by: user.id, status: "processing" })
        .select("id")
        .single();

      if (error) throw new Error(`trade_upload_log insert: ${error.message}`);
      return jsonResponse({ success: true, log_id: logRow.id, status: "processing" }, 202);
    }

    if (action === "upsert") {
      const logId = asLogId(body?.log_id);
      const table = body?.table;
      if (!isUploadTable(table)) throw new Error("Tabela de upload inválida.");

      const rows = asRows(body?.rows);
      const count = await batchUpsert(supabase, table, rows);
      return jsonResponse({ success: true, log_id: logId, table, count });
    }

    if (action === "finish") {
      const logId = asLogId(body?.log_id);
      const summary = (body?.summary ?? {}) as UploadSummary;

      EdgeRuntime.waitUntil(finalizeUpload(supabase, logId, summary));
      return jsonResponse({ success: true, log_id: logId, status: "processing" }, 202);
    }

    throw new Error("Ação inválida.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const maybeLogId = Number(body?.log_id);
    if (Number.isInteger(maybeLogId) && maybeLogId > 0) {
      await supabase.from("trade_upload_log").update({ status: "error", erro_msg: msg }).eq("id", maybeLogId);
    }
    return jsonResponse({ success: false, error: msg }, 500);
  }
});

// deno-lint-ignore no-explicit-any
async function finalizeUpload(supabase: any, logId: number, summary: UploadSummary) {
  try {
    await recalcMetrics(supabase);
    await supabase.from("trade_upload_log").update({
      status: "success",
      data_inicio: summary.data_inicio ?? null,
      data_fim: summary.data_fim ?? null,
      ativos_di: summary.ativos_di ?? 0,
      ativos_ipca: summary.ativos_ipca ?? 0,
      linhas_inseridas: summary.linhas_inseridas ?? 0,
      linhas_atualizadas: summary.linhas_atualizadas ?? 0,
      erro_msg: null,
    }).eq("id", logId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("process-upload finalize error:", msg);
    await supabase.from("trade_upload_log").update({ status: "error", erro_msg: msg }).eq("id", logId);
  }
}

// deno-lint-ignore no-explicit-any
async function recalcMetrics(supabase: any) {
  // Forward fill: preenche taxas faltantes com a taxa do dia anterior
  // para tickers com >= 90% de cobertura. Roda ANTES do recálculo para
  // que as médias móveis e z-scores usem séries contínuas.
  const { data: ffCount, error: errFf } = await supabase.rpc("apply_forward_fill");
  if (errFf) throw new Error(`apply_forward_fill: ${errFf.message}`);
  console.log(`apply_forward_fill: ${ffCount ?? 0} linhas preenchidas`);

  // Quebra o recálculo em duas RPCs separadas para evitar timeout no plano gratuito.
  // Primeiro DI/PRE/OUTRO, depois IPCA em lotes de 100 tickers. Cada chamada RPC
  // do batch IPCA roda em uma transação própria, então o banco faz commit ao fim
  // de cada lote e libera locks antes do próximo.
  const { error: errDi } = await supabase.rpc("recalc_trade_metricas_di");
  if (errDi) throw new Error(`recalc_trade_metricas_di: ${errDi.message}`);

  let afterTicker: string | null = null;
  let hasMore = true;
  let guard = 0;

  while (hasMore) {
    const response: { data: IpcaBatchResult[] | IpcaBatchResult | null; error: { message: string } | null } = await supabase.rpc("recalc_trade_metricas_ipca_batch", {
      p_after_ticker: afterTicker,
      p_limit: 100,
    });
    const { data, error: errIpca } = response;
    if (errIpca) throw new Error(`recalc_trade_metricas_ipca_batch: ${errIpca.message}`);

    const batch: IpcaBatchResult | null | undefined = Array.isArray(data) ? data[0] : data;
    const processedCount = Number(batch?.processed_count ?? 0);
    afterTicker = batch?.next_after_ticker ?? afterTicker;
    hasMore = Boolean(batch?.has_more) && processedCount > 0;

    guard += 1;
    if (guard > 1000) throw new Error("recalc_trade_metricas_ipca_batch: limite de segurança excedido.");
  }

  // Pré-calcula séries e snapshots usados pelos gráficos do Trade Monitor.
  // Roda DEPOIS do recálculo de métricas para que rating/indexador estejam atualizados.
  const { data: histRows, error: errHist } = await supabase.rpc("refresh_spread_historico");
  if (errHist) throw new Error(`refresh_spread_historico: ${errHist.message}`);
  console.log(`refresh_spread_historico: ${histRows ?? 0} linhas`);

  const { data: aggRows, error: errAgg } = await supabase.rpc("refresh_spread_agg_diario");
  if (errAgg) throw new Error(`refresh_spread_agg_diario: ${errAgg.message}`);
  console.log(`refresh_spread_agg_diario: ${aggRows ?? 0} linhas`);

  const { data: snapRows, error: errSnap } = await supabase.rpc("refresh_ticker_snapshots");
  if (errSnap) throw new Error(`refresh_ticker_snapshots: ${errSnap.message}`);
  console.log(`refresh_ticker_snapshots: ${snapRows ?? 0} tickers`);
}
