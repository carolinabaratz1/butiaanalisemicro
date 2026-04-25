// ============================================================
// BUTIA · Edge Function: process-upload
// Supabase Deno runtime — deploy em:
//   supabase/functions/process-upload/index.ts
//
// Recebe um FormData com o arquivo Excel, processa todas as
// abas e popula as tabelas trade_* no Supabase.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Background task API exposed by Supabase Edge Runtime
// deno-lint-ignore no-explicit-any
declare const EdgeRuntime: { waitUntil(p: Promise<any>): void };

// ── Helpers ────────────────────────────────────────────────

function parseNomeAtivo(nome: string) {
  const parts = nome.split(" - ");
  const vencStr = parts[2]?.trim() ?? "";
  const taxaEmissao = parts[3]?.trim() ?? "";

  let vencDate: string | null = null;
  let anosVenc: number | null = null;
  const hoje = new Date("2026-04-25");

  if (/^\d{8}$/.test(vencStr)) {
    const y = vencStr.slice(0, 4);
    const m = vencStr.slice(4, 6);
    const d = vencStr.slice(6, 8);
    vencDate = `${y}-${m}-${d}`;
    const diff = (new Date(vencDate).getTime() - hoje.getTime()) / (365.25 * 24 * 3600 * 1000);
    anosVenc = Math.round(diff * 10) / 10;
  }

  const u = taxaEmissao.toUpperCase();
  let indexador: "DI" | "IPCA" | "PRE" | "OUTRO" = "OUTRO";
  if (u.includes("IPCA")) indexador = "IPCA";
  else if (u.includes("PRÉ") || u.includes("PRE")) indexador = "PRE";
  else if (u.includes("DI") || u.includes("CDI")) indexador = "DI";

  const spreadMatch = taxaEmissao.match(/[\+\s]+([\d\.]+)%/);
  const spreadEmissao = spreadMatch ? parseFloat(spreadMatch[1]) : null;

  return { vencDate, anosVenc, indexador, taxaEmissao, spreadEmissao };
}

function excelDateToISO(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === "string") {
    // Already a date string
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
  }
  if (typeof val === "number") {
    // Excel serial date
    const d = new Date((val - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function num(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

// Batch upsert helper (Supabase has 1000-row limit per call)
// deno-lint-ignore no-explicit-any
async function batchUpsert(
  supabase: any,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  batchSize = 500
) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error, count } = await supabase
      .from(table)
      .upsert(batch, { onConflict, count: "exact" });
    if (error) throw new Error(`${table} upsert: ${error.message}`);
    inserted += count ?? batch.length;
  }
  return inserted;
}

// ── Main handler ───────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Extract user from JWT for upload log
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabase.auth.getUser(token);

  let logId: number | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) throw new Error("Nenhum arquivo recebido.");

    // Create upload log entry (sync, fast)
    const { data: logRow } = await supabase
      .from("trade_upload_log")
      .insert({ filename: file.name, uploaded_by: user?.id, status: "processing" })
      .select("id")
      .single();
    logId = logRow?.id ?? null;

    // Capture file bytes before backgrounding (req body closes after response)
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Offload heavy work (XLSX parse + upserts + RPC) to background
    // so we don't blow the 2s CPU limit on the request handler.
    EdgeRuntime.waitUntil(
      processWorkbook(supabase, bytes, logId).catch(async (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("process-upload background error:", msg);
        if (logId) {
          await supabase
            .from("trade_upload_log")
            .update({ status: "error", erro_msg: msg })
            .eq("id", logId);
        }
      })
    );

    // Respond immediately; client polls trade_upload_log for status.
    return new Response(
      JSON.stringify({ success: true, log_id: logId, status: "processing" }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (logId) {
      await supabase.from("trade_upload_log").update({ status: "error", erro_msg: msg }).eq("id", logId);
    }
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Background worker ─────────────────────────────────────
// deno-lint-ignore no-explicit-any
async function processWorkbook(supabase: any, bytes: Uint8Array, logId: number | null) {
  const wb = XLSX.read(bytes, { type: "array", cellDates: true });

  const sheetTaxas   = wb.Sheets["Taxas dos Titulos"];
  const sheetEmissao = wb.Sheets["Dados Emissao e emissor"];
  const sheetIPCARef = wb.Sheets["IPCA e NTN-B referencia"];
  const sheetNTNB    = wb.Sheets["TAXA NTN-B"];

  if (!sheetTaxas) throw new Error("Aba 'Taxas dos Titulos' não encontrada.");

  // ── ABA 1: Taxas dos Titulos ──────────────────────────
  const rawTaxas: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheetTaxas, { defval: null });

  const taxasRows: Record<string, unknown>[] = [];
  const ativosMap = new Map<string, Record<string, unknown>>();
  let dataInicio: string | null = null;
  let dataFim: string | null = null;

  for (const r of rawTaxas) {
    const ticker = String(r["Ticker"] ?? "").trim();
    const nomeCompleto = String(r["Nome do Ativo"] ?? "").trim();
    const dataISO = excelDateToISO(r["Data"]);
    if (!ticker || !dataISO) continue;

    if (!dataInicio || dataISO < dataInicio) dataInicio = dataISO;
    if (!dataFim   || dataISO > dataFim)   dataFim   = dataISO;

    taxasRows.push({
      ticker,
      data:            dataISO,
      taxa_indicativa: num(r["Taxa Indicativa"]),
      qtd_negociada:   num(r["Quantidade Negociada"]),
      pu_curva:        num(r["PU Curva"]),
      pu_indicativo:   num(r["PU Indicativo"]),
    });

    if (!ativosMap.has(ticker) && nomeCompleto) {
      const parsed = parseNomeAtivo(nomeCompleto);
      ativosMap.set(ticker, { ticker, nome_completo: nomeCompleto, ...parsed });
    }
  }

  // ── ABA 2: Dados Emissão e Emissor ────────────────────
  if (sheetEmissao) {
    const rawEmissao: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheetEmissao, { defval: null });
    for (const r of rawEmissao) {
      const ticker = String(r["Código CETIP"] ?? "").trim();
      if (!ticker) continue;
      const existing = ativosMap.get(ticker) ?? { ticker };
      ativosMap.set(ticker, {
        ...existing,
        emissor_nome: r["Emissor Nome"] ?? existing["emissor_nome"],
        emissor_cnpj: r["Emissor CNPJ"] ?? existing["emissor_cnpj"],
        rating:       r["Rating 1"]    ?? existing["rating"],
        data_rating:  excelDateToISO(r["Data do Rating 1"]) ?? existing["data_rating"],
      });
    }
  }

  // ── ABA 3: IPCA e NTN-B referência ────────────────────
  const ipcaRefRows: Record<string, unknown>[] = [];
  if (sheetIPCARef) {
    const rawRef: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheetIPCARef, { defval: null });
    for (const r of rawRef) {
      const ticker  = String(r["Ticker"] ?? "").trim();
      const ntnbRef = String(r["NTN's Referencia"] ?? "").trim();
      if (!ticker || !ntnbRef) continue;
      ipcaRefRows.push({ ticker, emissao: r["Emissao"], ntnb_ref: ntnbRef });
    }
  }

  // ── ABA 4: TAXA NTN-B ─────────────────────────────────
  const ntnbRows: Record<string, unknown>[] = [];
  if (sheetNTNB) {
    const rawNTNB: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheetNTNB, { defval: null });
    for (const r of rawNTNB) {
      const nome = String(r["Nome do Ativo"] ?? "").trim();
      const dataISO = excelDateToISO(r["Data"]);
      if (!nome.startsWith("NTN-B") || !dataISO) continue;
      ntnbRows.push({
        bond_name:       nome,
        data:            dataISO,
        taxa_indicativa: num(r["Taxa Indicativa"]),
        pu_indicativo:   num(r["PU Indicativo"]),
      });
    }
  }

  const ativosRows = Array.from(ativosMap.values());

  // Sequential (not Promise.all) to spread CPU over time
  const nTaxas  = await batchUpsert(supabase, "trade_taxas",    taxasRows,   "ticker,data");
  const nAtivos = await batchUpsert(supabase, "trade_ativos",   ativosRows,  "ticker");
  const nNTNB   = await batchUpsert(supabase, "trade_ntnb",     ntnbRows,    "bond_name,data");
  const nRef    = await batchUpsert(supabase, "trade_ipca_ref", ipcaRefRows, "ticker");

  await recalcMetrics(supabase);

  if (logId) {
    await supabase.from("trade_upload_log").update({
      status: "success",
      data_inicio: dataInicio,
      data_fim: dataFim,
      ativos_di:   ativosRows.filter(a => a["indexador"] === "DI").length,
      ativos_ipca: ativosRows.filter(a => a["indexador"] === "IPCA").length,
      linhas_inseridas:   nTaxas,
      linhas_atualizadas: nAtivos,
    }).eq("id", logId);
  }

  console.log("process-upload done:", { nTaxas, nAtivos, nNTNB, nRef });
}

// ── Metrics recalculation ──────────────────────────────────
// Runs a SQL RPC to avoid pulling all data to the Edge Function.
// The function "recalc_trade_metricas" is defined below in SQL.
// deno-lint-ignore no-explicit-any
async function recalcMetrics(supabase: any) {
  const { error } = await supabase.rpc("recalc_trade_metricas");
  if (error) throw new Error(`recalc_trade_metricas: ${error.message}`);
}
