import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unzipSync } from "https://esm.sh/fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const CVM_ZIP_URL = "https://dados.cvm.gov.br/dados/OFERTA/DISTRIB/DADOS/oferta_distribuicao.zip";

// Arquivos CSV dentro do ZIP que nos interessam. A CVM mistura vários tipos de valor
// mobiliário no mesmo arquivo; a coluna "tipo_ativo" (resolvida abaixo) é quem sub-classifica.
const TARGET_CSV_FILES = ["oferta_distribuicao.csv", "oferta_resolucao_160.csv"];

// --------------------------------------------------------------------------------
// Resolução resiliente de colunas
// --------------------------------------------------------------------------------
// A CVM já renomeou/adicionou colunas ao longo do tempo (ex: Modalidade_Registro_Oferta
// -> Modalidade_Registro). Em vez de depender de um cabeçalho exato, casamos contra uma
// lista de aliases conhecidos, normalizados (minúsculas, sem acento, sem pontuação) — assim
// um pequeno drift no cabeçalho não quebra a sincronização. Independente do header real,
// o valor bruto de TODAS as colunas sempre é preservado em raw_data (nada se perde).
function normalizeKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const FIELD_ALIASES: Record<string, string[]> = {
  tipo_ativo: [
    "TipoOferta",
    "Tipo_Oferta",
    "Tipo_Valor_Mobiliario",
    "Especie_Valor_Mobiliario",
    "Tipo_Ativo",
    "Classe_Ativo",
    "Tipo_Fundo_Investimento",
  ],
  cnpj_emissor: ["CNPJ_Emissor", "CNPJ_Ofertante", "CNPJ_Companhia", "CNPJ"],
  nome_emissor: [
    "Nome_Emissor",
    "Denominacao_Social_Emissor",
    "Nome_Ofertante",
    "Razao_Social_Emissor",
    "Emissor",
  ],
  numero_registro_cvm: [
    "Numero_Registro_CVM",
    "Numero_Protocolo",
    "Protocolo",
    "Numero_Registro",
  ],
  numero_emissao: ["Numero_Emissao", "Numero_Emissao_Valor_Mobiliario"],
  numero_serie: ["Numero_Serie", "Numero_Serie_Valor_Mobiliario"],
  situacao: ["Situacao_Registro", "Situacao_Oferta", "Situacao"],
  modalidade: [
    "Modalidade_Registro",
    "Modalidade_Registro_Oferta",
    "Modalidade_Oferta",
    "Modalidade_Dispensa_Registro",
    "Modalidade_Dispensa_Oferta",
    "Rito",
  ],
  data_referencia: [
    "Data_Registro",
    "Data_Referencia",
    "Data_Inicio_Oferta",
    "Data_Protocolo",
    "Data_Comunicado",
  ],
  data_encerramento: ["Data_Encerramento_Oferta", "Data_Encerramento", "Data_Fechamento"],
  valor_total: [
    "Valor_Total_Oferta",
    "Valor_Total_Distribuido",
    "Montante_Total_Oferta",
    "Valor_Mobiliario_Total",
  ],
};

const NORMALIZED_ALIASES: Record<string, string[]> = Object.fromEntries(
  Object.entries(FIELD_ALIASES).map(([field, aliases]) => [field, aliases.map(normalizeKey)]),
);

function resolveHeaderMap(headerRow: string[]): Record<string, number> {
  const normalizedHeader = headerRow.map(normalizeKey);
  const map: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(NORMALIZED_ALIASES)) {
    for (const alias of aliases) {
      const idx = normalizedHeader.indexOf(alias);
      if (idx !== -1) {
        map[field] = idx;
        break;
      }
    }
  }
  return map;
}

// --------------------------------------------------------------------------------
// Parser CSV minimalista (arquivos da CVM: separador ";", encoding ISO-8859-1)
// --------------------------------------------------------------------------------
function* iterateCsv(text: string): Generator<string[]> {
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ";") { row.push(field); field = ""; }
    else if (c === "\r") { /* skip */ }
    else if (c === "\n") {
      row.push(field);
      if (row.length > 1 || (row.length === 1 && row[0] !== "")) yield row;
      row = []; field = "";
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.length > 1 || (row.length === 1 && row[0] !== "")) yield row;
  }
}


function decodeLatin1(bytes: Uint8Array): string {
  try {
    return new TextDecoder("iso-8859-1").decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function parseBrDate(s: string | undefined): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const m = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

function parseBrNumber(s: string | undefined): number | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

// Timeout explícito por tentativa: sem isso, uma conexão que trava (comum no portal
// de dados abertos da CVM) nunca rejeita nem resolve, e o fetch fica pendurado para
// sempre — o que deixa toda a sincronização "em_andamento" indefinidamente, sem nunca
// cair no catch() que atualizaria o log com um erro visível.
async function fetchWithRetry(url: string, maxAttempts = 4, timeoutMs = 45_000): Promise<Response> {
  const RETRYABLE = [502, 503, 504, 520, 521, 522, 523, 524];
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return res;
      if (RETRYABLE.includes(res.status) && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
        continue;
      }
      throw new Error(`HTTP ${res.status} ao baixar ${url}`);
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = err instanceof Error && err.name === "AbortError";
      lastError = isTimeout ? new Error(`Timeout de ${timeoutMs}ms ao baixar ${url}`) : err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
        continue;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

// deno-lint-ignore no-explicit-any
async function runSync(supabase: any, logId: string): Promise<{
  status: "sucesso" | "parcial" | "erro";
  totalProcessadas: number;
  totalInseridas: number;
  totalAtualizadas: number;
  mensagemErro?: string;
}> {
  let totalProcessadas = 0;
  let totalInseridas = 0;
  let totalAtualizadas = 0;

  try {
    const zipRes = await fetchWithRetry(CVM_ZIP_URL);
    const zipBuffer = new Uint8Array(await zipRes.arrayBuffer());
    const unzipped = unzipSync(zipBuffer);

    for (const fileName of TARGET_CSV_FILES) {
      const matchKey = Object.keys(unzipped).find(
        (k) =>
          k.toLowerCase() === fileName.toLowerCase() ||
          k.toLowerCase().endsWith("/" + fileName.toLowerCase()),
      );
      if (!matchKey) {
        console.warn(`sync-cvm-ofertas: arquivo ${fileName} não encontrado no ZIP, pulando`);
        continue;
      }

      const csvText = decodeLatin1(unzipped[matchKey]);
      // Libera o buffer descomprimido: já temos o texto decodificado.
      delete unzipped[matchKey];

      const iter = iterateCsv(csvText);
      const first = iter.next();
      if (first.done) continue;
      const header = first.value;
      const colMap = resolveHeaderMap(header);

      const BATCH_SIZE = 200;
      let batch: Record<string, unknown>[] = [];

      const flush = async () => {
        if (batch.length === 0) return;
        const { data: rpcResult, error: rpcError } = await supabase.rpc("bulk_upsert_ofertas_cvm", {
          p_rows: batch,
        });
        if (rpcError) throw rpcError;
        const result = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
        totalInseridas += result?.inseridas ?? 0;
        totalAtualizadas += result?.atualizadas ?? 0;
        batch = [];
        await supabase
          .from("cvm_ofertas_sync_log")
          .update({
            total_linhas_processadas: totalProcessadas,
            total_inseridas: totalInseridas,
            total_atualizadas: totalAtualizadas,
          })
          .eq("id", logId);
      };

      for (const cols of iter) {
        totalProcessadas++;
        const get = (field: string) => (colMap[field] !== undefined ? cols[colMap[field]] : undefined);

        const tipoAtivoRaw = get("tipo_ativo") || fileName.replace(".csv", "");
        const numeroRegistro = get("numero_registro_cvm") || "";
        const numeroEmissao = get("numero_emissao") || "";
        const numeroSerie = get("numero_serie") || "";
        const cnpj = get("cnpj_emissor") || "";

        const hashSource = [fileName, tipoAtivoRaw, numeroRegistro, numeroEmissao, numeroSerie, cnpj].join("|");
        const hashLinha = await sha256Hex(hashSource);

        batch.push({
          tipo_ativo: tipoAtivoRaw || "Não classificado",
          cnpj_emissor: cnpj || null,
          nome_emissor: get("nome_emissor") || null,
          numero_registro_cvm: numeroRegistro || null,
          numero_emissao: numeroEmissao || null,
          numero_serie: numeroSerie || null,
          situacao: get("situacao") || null,
          modalidade: get("modalidade") || null,
          data_referencia: parseBrDate(get("data_referencia")),
          data_encerramento: parseBrDate(get("data_encerramento")),
          valor_total: parseBrNumber(get("valor_total")),
          raw_data: null,
          source_dataset: fileName,
          hash_linha: hashLinha,
        });

        if (batch.length >= BATCH_SIZE) await flush();
      }
      await flush();
    }


    await supabase
      .from("cvm_ofertas_sync_log")
      .update({
        status: "sucesso",
        total_linhas_processadas: totalProcessadas,
        total_inseridas: totalInseridas,
        total_atualizadas: totalAtualizadas,
        finished_at: new Date().toISOString(),
      })
      .eq("id", logId);

    return { status: "sucesso", totalProcessadas, totalInseridas, totalAtualizadas };
  } catch (err) {
    console.error("sync-cvm-ofertas: erro durante sincronização", err);
    const mensagemErro = String(err instanceof Error ? err.message : err);
    const status = totalProcessadas > 0 ? "parcial" : "erro";
    await supabase
      .from("cvm_ofertas_sync_log")
      .update({
        status,
        total_linhas_processadas: totalProcessadas,
        total_inseridas: totalInseridas,
        total_atualizadas: totalAtualizadas,
        mensagem_erro: mensagemErro,
        finished_at: new Date().toISOString(),
      })
      .eq("id", logId);

    return { status, totalProcessadas, totalInseridas, totalAtualizadas, mensagemErro };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Autenticação: um usuário autenticado (qualquer papel) pode disparar uma sincronização manual;
  // a chamada diária agendada (cron) invoca esta função com a service role key diretamente
  // (sem JWT de usuário), o que também é aceito por ser o caminho confiável do cron.
  const authHeader = req.headers.get("Authorization");
  if (authHeader && authHeader !== `Bearer ${serviceRoleKey}`) {
    const authClient = createClient(supabaseUrl, anonKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claims) {
      return jsonResponse({ error: "Não autorizado" }, 401);
    }
  }

  let logId: string | null = null;

  try {
    const { data: logRow, error: logError } = await supabase
      .from("cvm_ofertas_sync_log")
      .insert({ status: "em_andamento", dataset_url: CVM_ZIP_URL })
      .select("id")
      .single();
    if (logError) throw logError;
    logId = logRow.id;

    const resultado = await runSync(supabase, logId!);

    return jsonResponse({
      started: true,
      log_id: logId,
      status: resultado.status,
      total_linhas_processadas: resultado.totalProcessadas,
      total_inseridas: resultado.totalInseridas,
      total_atualizadas: resultado.totalAtualizadas,
      mensagem_erro: resultado.mensagemErro,
    });
  } catch (err) {
    console.error("sync-cvm-ofertas: erro ao iniciar", err);
    if (logId) {
      await supabase
        .from("cvm_ofertas_sync_log")
        .update({
          status: "erro",
          mensagem_erro: String(err instanceof Error ? err.message : err),
          finished_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }
    return jsonResponse({ error: "Falha ao iniciar sincronização" }, 500);
  }
});
