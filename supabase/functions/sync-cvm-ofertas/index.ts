import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { Unzip, UnzipInflate } from "npm:fflate@0.8.2";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const CVM_ZIP_URL = "https://dados.cvm.gov.br/dados/OFERTA/DISTRIB/DADOS/oferta_distribuicao.zip";
const TARGET_CSV_FILES = ["oferta_distribuicao.csv", "oferta_resolucao_160.csv"];
const BATCH_SIZE = 500;
const MAX_ROWS_PER_INVOCATION = 5_000;
const FETCH_TIMEOUT_MS = 45_000;

type SyncBody = {
  log_id?: string;
  file_index?: number;
  row_offset?: number;
  totals?: Partial<SyncTotals>;
};

type SyncTotals = {
  totalProcessadas: number;
  totalInseridas: number;
  totalAtualizadas: number;
};

type FileProcessResult = SyncTotals & {
  nextFileIndex: number;
  nextRowOffset: number;
  fileDone: boolean;
  allDone: boolean;
};

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

function* iterateCsv(text: string): Generator<string[]> {
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ";") {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      // skip
    } else if (c === "\n") {
      row.push(field);
      if (row.length > 1 || (row.length === 1 && row[0] !== "")) yield row;
      row = [];
      field = "";
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

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

async function fetchWithRetry(url: string, maxAttempts = 4, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const retryable = [502, 503, 504, 520, 521, 522, 523, 524];
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return res;
      if (retryable.includes(res.status) && attempt < maxAttempts) {
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

async function extractCsvFromZip(fileName: string): Promise<Uint8Array | null> {
  const res = await fetchWithRetry(CVM_ZIP_URL);
  const body = res.body;
  if (!body) throw new Error("Resposta da CVM sem corpo para leitura");

  return await new Promise<Uint8Array | null>(async (resolve, reject) => {
    const chunks: Uint8Array[] = [];
    const unzip = new Unzip((file) => {
      const normalized = file.name.toLowerCase();
      const isTarget = normalized === fileName.toLowerCase() || normalized.endsWith("/" + fileName.toLowerCase());
      if (!isTarget) return;

      file.ondata = (err, data, final) => {
        if (err) {
          reject(err);
          return;
        }
        chunks.push(data);
        if (final) {
          const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
          const merged = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
          }
          resolve(merged);
        }
      };
      file.start();
    });

    unzip.register(UnzipInflate);
    const reader = body.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          unzip.push(new Uint8Array(0), true);
          if (chunks.length === 0) resolve(null);
          break;
        }
        unzip.push(value, false);
      }
    } catch (err) {
      reject(err);
    }
  });
}

function normalizeTotals(totals?: Partial<SyncTotals>): SyncTotals {
  return {
    totalProcessadas: Number(totals?.totalProcessadas ?? 0),
    totalInseridas: Number(totals?.totalInseridas ?? 0),
    totalAtualizadas: Number(totals?.totalAtualizadas ?? 0),
  };
}

// deno-lint-ignore no-explicit-any
async function processFileStep(supabase: any, logId: string, fileIndex: number, rowOffset: number, totals: SyncTotals): Promise<FileProcessResult> {
  const fileName = TARGET_CSV_FILES[fileIndex];
  if (!fileName) {
    return { ...totals, nextFileIndex: fileIndex, nextRowOffset: 0, fileDone: true, allDone: true };
  }

  const csvBytes = await extractCsvFromZip(fileName);
  if (!csvBytes) {
    console.warn(`sync-cvm-ofertas: arquivo ${fileName} não encontrado no ZIP, pulando`);
    const nextFileIndex = fileIndex + 1;
    return {
      ...totals,
      nextFileIndex,
      nextRowOffset: 0,
      fileDone: true,
      allDone: nextFileIndex >= TARGET_CSV_FILES.length,
    };
  }

  const csvText = decodeLatin1(csvBytes);
  const iter = iterateCsv(csvText);
  const first = iter.next();
  if (first.done) {
    const nextFileIndex = fileIndex + 1;
    return {
      ...totals,
      nextFileIndex,
      nextRowOffset: 0,
      fileDone: true,
      allDone: nextFileIndex >= TARGET_CSV_FILES.length,
    };
  }

  const header = first.value;
  const colMap = resolveHeaderMap(header);
  let physicalRowIndex = 0;
  let processedThisInvocation = 0;
  let batch: Record<string, unknown>[] = [];
  let runningTotals = { ...totals };

  const flush = async () => {
    if (batch.length === 0) return;
    const { data: rpcResult, error: rpcError } = await supabase.rpc("bulk_upsert_ofertas_cvm", { p_rows: batch });
    if (rpcError) throw rpcError;
    const result = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
    runningTotals.totalInseridas += result?.inseridas ?? 0;
    runningTotals.totalAtualizadas += result?.atualizadas ?? 0;
    batch = [];
    await supabase
      .from("cvm_ofertas_sync_log")
      .update({
        total_linhas_processadas: runningTotals.totalProcessadas,
        total_inseridas: runningTotals.totalInseridas,
        total_atualizadas: runningTotals.totalAtualizadas,
      })
      .eq("id", logId);
  };

  for (const cols of iter) {
    physicalRowIndex++;
    if (physicalRowIndex <= rowOffset) continue;

    const get = (field: string) => (colMap[field] !== undefined ? cols[colMap[field]] : undefined);
    const tipoAtivoRaw = get("tipo_ativo") || fileName.replace(".csv", "");
    const numeroRegistro = get("numero_registro_cvm") || "";
    const numeroEmissao = get("numero_emissao") || "";
    const numeroSerie = get("numero_serie") || "";
    const cnpj = get("cnpj_emissor") || "";
    const hashSource = [fileName, tipoAtivoRaw, numeroRegistro, numeroEmissao, numeroSerie, cnpj].join("|");

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
      hash_source: hashSource,
    });

    runningTotals.totalProcessadas++;
    processedThisInvocation++;

    if (batch.length >= BATCH_SIZE) await flush();
    if (processedThisInvocation >= MAX_ROWS_PER_INVOCATION) {
      await flush();
      return {
        ...runningTotals,
        nextFileIndex: fileIndex,
        nextRowOffset: physicalRowIndex,
        fileDone: false,
        allDone: false,
      };
    }
  }

  await flush();
  const nextFileIndex = fileIndex + 1;
  return {
    ...runningTotals,
    nextFileIndex,
    nextRowOffset: 0,
    fileDone: true,
    allDone: nextFileIndex >= TARGET_CSV_FILES.length,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const authHeader = req.headers.get("Authorization");
  if (authHeader && authHeader !== `Bearer ${serviceRoleKey}`) {
    const authClient = createClient(supabaseUrl, anonKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claims) return jsonResponse({ error: "Não autorizado" }, 401);
  }

  let body: SyncBody = {};
  try {
    body = await req.json();
  } catch {
    // chamadas sem body iniciam uma nova sincronização
  }

  let logId = body.log_id ?? null;

  try {
    if (!logId) {
      const { data: logRow, error: logError } = await supabase
        .from("cvm_ofertas_sync_log")
        .insert({ status: "em_andamento", dataset_url: CVM_ZIP_URL })
        .select("id")
        .single();
      if (logError) throw logError;
      logId = logRow.id;
    }

    const fileIndex = Math.max(0, Math.min(Number(body.file_index ?? 0), TARGET_CSV_FILES.length));
    const rowOffset = Math.max(0, Number(body.row_offset ?? 0));
    const totals = normalizeTotals(body.totals);

    const result = await processFileStep(supabase, logId, fileIndex, rowOffset, totals);

    if (result.allDone) {
      await supabase
        .from("cvm_ofertas_sync_log")
        .update({
          status: "sucesso",
          total_linhas_processadas: result.totalProcessadas,
          total_inseridas: result.totalInseridas,
          total_atualizadas: result.totalAtualizadas,
          finished_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    return jsonResponse({
      started: true,
      log_id: logId,
      status: result.allDone ? "sucesso" : "em_andamento",
      total_linhas_processadas: result.totalProcessadas,
      total_inseridas: result.totalInseridas,
      total_atualizadas: result.totalAtualizadas,
      next_file_index: result.nextFileIndex,
      next_row_offset: result.nextRowOffset,
      done: result.allDone,
    });
  } catch (err) {
    console.error("sync-cvm-ofertas: erro durante sincronização", err);
    const mensagemErro = errorMessage(err);
    if (logId) {
      await supabase
        .from("cvm_ofertas_sync_log")
        .update({
          status: body.totals?.totalProcessadas ? "parcial" : "erro",
          mensagem_erro: mensagemErro,
          finished_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }
    return jsonResponse({ error: "Falha ao sincronizar ofertas CVM", mensagem_erro: mensagemErro }, 500);
  }
});