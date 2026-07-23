import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// ============================================================================
// sync-cvm-ofertas — v2 (2026-07-23)
//
// Trocou a fonte de dados: em vez de baixar o ZIP/CSV diário da CVM
// (dados.cvm.gov.br), que nunca populou situacao/valor_total/numero_registro
// (mismatch de nome de coluna) e não tem Coordenador Líder/Gestora em nenhum
// lugar, agora consome a API própria (não documentada, mas aberta, sem auth)
// do site de consulta pública da CVM: web.cvm.gov.br/sre-publico-cvm.
//
// Duas fases, resumíveis entre invocações (mesmo padrão de "loop limitado"
// que o front-end (RadarDeOfertasPage.tsx) já implementa — reaproveita os
// MESMOS nomes de campo (file_index/row_offset) para não precisar tocar no
// front-end：
//   fase 0 (file_index=0): "listagem" — pagina por /pesquisar/detalhado e
//     grava tipo_ativo, status, volume, coordenador líder, público-alvo
//     (inferido) para TODAS as ofertas do período. Cada página tem até 500
//     registros; ~15-30 páginas cobre o histórico inteiro, então isso cabe
//     numa invocação só (mas ainda é resumível via row_offset=página, por
//     segurança caso o volume cresça).
//   fase 1 (file_index=1): "enriquecimento" — só para ofertas de Cotas de
//     FIDC / FIAGRO-FIDC, busca o Gestor via /pesquisar/infOferta/{id} (não
//     vem na listagem). Processa em lotes pequenos (ENRICH_BATCH_SIZE) com
//     um delay entre chamadas — a API não documenta rate limit, então
//     preferimos ser conservadores.
// ============================================================================

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SRE_BASE = "https://web.cvm.gov.br/sre-publico-cvm/rest/sitePublico";
const LISTAGEM_PERIODO_DE = "01/01/1990";
const LISTAGEM_PAGE_SIZE = 150;
// Conservador de propósito: já vimos a Edge Function anterior estourar
// WORKER_RESOURCE_LIMIT ao tentar processar tudo de uma vez. Preferimos mais
// invocações resumíveis (o front-end já faz o loop) a arriscar timeout/limite
// de recursos numa invocação só.
const MAX_PAGES_PER_INVOCATION = 3; // reduzido para evitar WORKER_RESOURCE_LIMIT em produção
// ~4.900 ofertas de FIDC/FIAGRO-FIDC no total. Com processamento sequencial
// (1 a 1 + delay) isso exigiria ~80+ invocações, estourando o loop de 30
// chamadas que o front-end já tem. Por isso usamos um pool com concorrência
// limitada (ENRICH_CONCURRENCY) em vez de fila estritamente sequencial —
// ainda é um limite deliberado (não dispara tudo de uma vez), só que várias
// chamadas em paralelo por lote em vez de uma atrás da outra.
const ENRICH_BATCH_SIZE = 60;
const ENRICH_CONCURRENCY = 2;
const FETCH_TIMEOUT_MS = 20_000;
const INVOCATION_SOFT_DEADLINE_MS = 40_000;

type SyncBody = {
  log_id?: string;
  file_index?: number; // 0 = listagem, 1 = enriquecimento (Gestora), 2 = concluído
  row_offset?: number; // durante a fase 0, é o número da próxima página a buscar
  totals?: Partial<SyncTotals>;
};

type SyncTotals = {
  totalProcessadas: number;
  totalInseridas: number;
  totalAtualizadas: number;
};

function normalizeKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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

function parseBrDate(s: string | undefined | null): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  return null;
}

function parseBrNumber(s: string | undefined | null): number | null {
  if (!s) return null;
  const trimmed = String(s).trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

// Inferência best-effort: a API não tem um campo dedicado de "público-alvo".
// Só assumimos quando o texto é explícito; caso contrário fica null (melhor
// não saber do que errar silenciosamente).
function inferPublicoAlvo(nomeTipoRequerimento: string | null | undefined): string | null {
  if (!nomeTipoRequerimento) return null;
  const norm = normalizeKey(nomeTipoRequerimento);
  if (norm.includes("profissional")) return "Investidor Profissional";
  if (norm.includes("qualificado")) return "Investidor Qualificado";
  return null;
}

function isFidc(tipoAtivo: string | null | undefined): boolean {
  if (!tipoAtivo) return false;
  const norm = normalizeKey(tipoAtivo);
  return norm.includes("fidc");
}

function todayBr(): string {
  const now = new Date();
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = now.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit | undefined,
  maxAttempts = 4,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const retryable = [429, 500, 502, 503, 504, 520, 521, 522, 523, 524];
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return res;
      if (retryable.includes(res.status) && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 500));
        continue;
      }
      throw new Error(`HTTP ${res.status} ao chamar ${url}`);
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = err instanceof Error && err.name === "AbortError";
      lastError = isTimeout ? new Error(`Timeout de ${timeoutMs}ms ao chamar ${url}`) : err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 500));
        continue;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function buscarPaginaDetalhado(pagina: number) {
  const res = await fetchWithRetry(`${SRE_BASE}/pesquisar/detalhado`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      periodoCriacaoProcesso: { de: LISTAGEM_PERIODO_DE, ate: todayBr() },
      opa: false,
      tipoOferta: "OFERTA_REGULAR",
      modalidade: "TODAS",
      direcaoOrdenacao: "DESC",
      colunaOrdenacao: "data",
      pagina,
      tamanhoPagina: String(LISTAGEM_PAGE_SIZE),
    }),
  });
  return (await res.json()) as {
    totalRegistros: number;
    totalPaginas: number;
    registros: Array<Record<string, unknown>>;
  };
}

async function buscarGestorInfOferta(idRequerimento: string): Promise<string> {
  const res = await fetchWithRetry(`${SRE_BASE}/pesquisar/infOferta/${idRequerimento}`, { method: "GET" });
  const campos = (await res.json()) as Array<{ campoNome?: string; valor?: string }>;
  const gestor = Array.isArray(campos) ? campos.find((c) => c.campoNome === "Gestor") : null;
  return gestor?.valor?.trim() || "";
}

// deno-lint-ignore no-explicit-any
async function rodarFaseListagem(supabase: any, logId: string, paginaInicial: number, totals: SyncTotals, deadlineAt: number) {
  let pagina = Math.max(1, paginaInicial);
  let runningTotals = { ...totals };
  let totalPaginas = 1;
  let paginasProcessadasNestaInvocacao = 0;

  do {
    const resultado = await buscarPaginaDetalhado(pagina);
    totalPaginas = resultado.totalPaginas || 1;

    const linhas = (resultado.registros || []).map((r) => {
      const tipoAtivo = String(r["nomeValorMobiliario"] ?? "Não classificado");
      const idRequerimento = r["idRequerimento"] != null ? String(r["idRequerimento"]) : null;
      return {
        tipo_ativo: tipoAtivo,
        cnpj_emissor: r["cnpjEmissor"] ? String(r["cnpjEmissor"]) : null,
        nome_emissor: r["nomeEmissor"] ? String(r["nomeEmissor"]) : null,
        numero_registro_cvm: r["numeroRegistro"] ? String(r["numeroRegistro"]) : null,
        situacao: r["statusDaOferta"] ? String(r["statusDaOferta"]) : null,
        data_referencia: parseBrDate(r["data"] as string | undefined),
        data_encerramento: null, // não vem na listagem; precisaria de historicoStatus/{id} por oferta
        valor_total: parseBrNumber(r["valorTotalEmReais"] as string | undefined),
        id_requerimento_cvm: idRequerimento,
        numero_processo_cvm: r["numeroProcesso"] ? String(r["numeroProcesso"]) : null,
        coordenador_lider: r["nomeCoordenadorLider"] ? String(r["nomeCoordenadorLider"]) : null,
        cnpj_coordenador_lider: r["cnpjCoordenadorLider"] ? String(r["cnpjCoordenadorLider"]) : null,
        gestora: null, // preenchido na fase de enriquecimento, só para FIDC
        publico_alvo: inferPublicoAlvo(r["nomeTipoRequerimento"] as string | undefined),
        nome_tipo_requerimento: r["nomeTipoRequerimento"] ? String(r["nomeTipoRequerimento"]) : null,
      };
    });

    if (linhas.length > 0) {
      const { data: rpcResult, error: rpcError } = await supabase.rpc("bulk_upsert_ofertas_cvm_sre", {
        p_rows: linhas,
      });
      if (rpcError) throw rpcError;
      const result = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
      runningTotals.totalInseridas += result?.inseridas ?? 0;
      runningTotals.totalAtualizadas += result?.atualizadas ?? 0;
      runningTotals.totalProcessadas += linhas.length;
    }

    await supabase
      .from("cvm_ofertas_sync_log")
      .update({
        total_linhas_processadas: runningTotals.totalProcessadas,
        total_inseridas: runningTotals.totalInseridas,
        total_atualizadas: runningTotals.totalAtualizadas,
      })
      .eq("id", logId);

    pagina++;
    paginasProcessadasNestaInvocacao++;
  } while (
    pagina <= totalPaginas &&
    paginasProcessadasNestaInvocacao < MAX_PAGES_PER_INVOCATION &&
    Date.now() < deadlineAt
  );

  const listagemConcluida = pagina > totalPaginas;
  return {
    totals: runningTotals,
    nextFileIndex: listagemConcluida ? 1 : 0,
    nextRowOffset: listagemConcluida ? 0 : pagina,
    allDone: false,
  };
}

// deno-lint-ignore no-explicit-any
async function rodarFaseEnriquecimento(supabase: any, logId: string, totals: SyncTotals, deadlineAt: number) {
  const { data: pendentes, error: selectError } = await supabase
    .from("ofertas_publicas_cvm")
    .select("id, id_requerimento_cvm")
    .is("gestora", null)
    .ilike("tipo_ativo", "%FIDC%")
    .not("id_requerimento_cvm", "is", null)
    .order("id_requerimento_cvm", { ascending: true })
    .limit(ENRICH_BATCH_SIZE);

  if (selectError) throw selectError;

  let runningTotals = { ...totals };

  if (!pendentes || pendentes.length === 0) {
    return { totals: runningTotals, nextFileIndex: 2, nextRowOffset: 0, allDone: true };
  }

  // Pool com concorrência limitada: processa até ENRICH_CONCURRENCY ofertas
  // por vez (em vez de uma fila 100% sequencial), pra caber no orçamento de
  // tempo de uma invocação sem martelar a API da CVM com tudo de uma vez.
  let cursor = 0;
  let processedThisInvocation = 0;
  async function worker() {
    while (cursor < pendentes.length && Date.now() < deadlineAt) {
      const row = pendentes[cursor];
      cursor++;
      try {
        const gestor = await buscarGestorInfOferta(row.id_requerimento_cvm);
        await supabase
          .from("ofertas_publicas_cvm")
          .update({ gestora: gestor }) // string vazia = "já verificado, sem Gestor informado" (evita reprocessar pra sempre)
          .eq("id", row.id);
        runningTotals.totalAtualizadas += 1;
        processedThisInvocation += 1;
      } catch (err) {
        console.warn(`sync-cvm-ofertas: falha ao buscar Gestor de idRequerimento=${row.id_requerimento_cvm}`, err);
        // não interrompe o lote inteiro por causa de uma oferta específica
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(ENRICH_CONCURRENCY, pendentes.length) }, () => worker()));

  await supabase
    .from("cvm_ofertas_sync_log")
    .update({
      total_atualizadas: runningTotals.totalAtualizadas,
    })
    .eq("id", logId);

  if (cursor < pendentes.length || processedThisInvocation === 0) {
    return { totals: runningTotals, nextFileIndex: 1, nextRowOffset: 0, allDone: false };
  }

  const { data: restante, error: remainingError } = await supabase
    .from("ofertas_publicas_cvm")
    .select("id")
    .is("gestora", null)
    .ilike("tipo_ativo", "%FIDC%")
    .not("id_requerimento_cvm", "is", null)
    .limit(1);
  if (remainingError) throw remainingError;

  return { totals: runningTotals, nextFileIndex: 1, nextRowOffset: 0, allDone: !restante || restante.length === 0 };
}

function normalizeTotals(totals?: Partial<SyncTotals>): SyncTotals {
  return {
    totalProcessadas: Number(totals?.totalProcessadas ?? 0),
    totalInseridas: Number(totals?.totalInseridas ?? 0),
    totalAtualizadas: Number(totals?.totalAtualizadas ?? 0),
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
        .insert({ status: "em_andamento", dataset_url: `${SRE_BASE}/pesquisar/detalhado` })
        .select("id")
        .single();
      if (logError) throw logError;
      logId = logRow.id;
    }

    const fileIndex = Math.max(0, Math.min(Number(body.file_index ?? 0), 2));
    const rowOffset = Math.max(0, Number(body.row_offset ?? 0));
    const totals = normalizeTotals(body.totals);
    const deadlineAt = Date.now() + INVOCATION_SOFT_DEADLINE_MS;

    const resultado =
      fileIndex >= 1
        ? await rodarFaseEnriquecimento(supabase, logId, totals, deadlineAt)
        : await rodarFaseListagem(supabase, logId, rowOffset || 1, totals, deadlineAt);

    const tudoConcluido = resultado.nextFileIndex >= 2 || resultado.allDone;

    if (tudoConcluido) {
      await supabase
        .from("cvm_ofertas_sync_log")
        .update({
          status: "sucesso",
          total_linhas_processadas: resultado.totals.totalProcessadas,
          total_inseridas: resultado.totals.totalInseridas,
          total_atualizadas: resultado.totals.totalAtualizadas,
          finished_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    return jsonResponse({
      started: true,
      log_id: logId,
      status: tudoConcluido ? "sucesso" : "em_andamento",
      total_linhas_processadas: resultado.totals.totalProcessadas,
      total_inseridas: resultado.totals.totalInseridas,
      total_atualizadas: resultado.totals.totalAtualizadas,
      next_file_index: resultado.nextFileIndex,
      next_row_offset: resultado.nextRowOffset,
      done: tudoConcluido,
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
