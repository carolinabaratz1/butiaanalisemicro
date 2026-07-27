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
const LISTAGEM_FALLBACK_DE = "01/01/1990"; // primeira carga (base vazia)
const LISTAGEM_JANELA_DIAS = 30; // janela incremental para bases já populadas
const LISTAGEM_PAGE_SIZE = 150;
const MAX_PAGES_PER_INVOCATION = 3;
const ENRICH_BATCH_SIZE = 40;
const ENRICH_CONCURRENCY = 2;
const REVISIT_BATCH_SIZE = 40;
const REVISIT_CONCURRENCY = 2;
const FETCH_TIMEOUT_MS_SEARCH = 45_000; // /pesquisar/detalhado tende a demorar
const FETCH_TIMEOUT_MS_DETAIL = 20_000; // /infOferta, /documentosPublicados, /historicoStatus
const INVOCATION_SOFT_DEADLINE_MS = 40_000;

// Situações terminais NÃO são revisitadas (nunca mudam de status).
// Situações fora dessa lista (Registro Concedido, Aguardando Bookbuilding,
// Oferta Suspensa, Em cumprimento de exigências) são revisitadas via /infOferta
// para capturar transição para Encerrada. Linhas com situacao null e/ou
// id_requerimento_cvm null (legadas do CSV) ficam de fora — não há como
// consultar.
const TERMINAL_SITUACOES = new Set<string>([
  "Oferta Encerrada",
  "Registro Caducado",
  "Oferta Revogada",
  "Requerimento Expirado",
  "Cancelado",
]);
const NON_TERMINAL_SITUACOES = [
  "Registro Concedido",
  "Aguardando Bookbuilding",
  "Oferta Suspensa",
  "Em cumprimento de exigências",
];

// Mapa exato campoNome (como vem da CVM, com acentuação) → coluna dedicada.
// Qualquer campo fora deste mapa vai inteiro para detalhe_oferta (jsonb).
// "Gestor" continua sendo tratado à parte e vai para a coluna `gestora`
// (mantido do comportamento anterior — não mexer).
const CAMPO_TO_COLUMN: Record<string, string> = {
  "Escriturador": "escriturador",
  "Custodiante": "custodiante",
  "Administrador": "administrador",
  "Avaliador de risco": "avaliador_risco",
  "Agente fiduciário": "agente_fiduciario",
  "Tipo de lastro": "tipo_lastro",
  "Regime de distribuição": "regime_distribuicao",
};

type SyncBody = {
  log_id?: string;
  // 0 = listagem incremental, 1 = revisita de não-terminais, 2 = enriquecimento, 3 = concluído
  file_index?: number;
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

async function buscarInfOferta(idRequerimento: string): Promise<Array<{ campoNome?: string; valor?: string }>> {
  const res = await fetchWithRetry(`${SRE_BASE}/pesquisar/infOferta/${idRequerimento}`, { method: "GET" });
  const campos = (await res.json()) as Array<{ campoNome?: string; valor?: string }>;
  return Array.isArray(campos) ? campos : [];
}

async function buscarDocumentosPublicados(idRequerimento: string): Promise<unknown[]> {
  const res = await fetchWithRetry(`${SRE_BASE}/pesquisar/documentosPublicados/${idRequerimento}`, { method: "GET" });
  const arr = await res.json();
  return Array.isArray(arr) ? arr : [];
}

async function buscarHistoricoStatus(idRequerimento: string): Promise<unknown[]> {
  const res = await fetchWithRetry(`${SRE_BASE}/pesquisar/historicoStatus/${idRequerimento}`, { method: "GET" });
  const arr = await res.json();
  return Array.isArray(arr) ? arr : [];
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
  // Enriquecimento agora vale para TODOS os tipos de ativo (não só FIDC).
  // Usamos `detalhe_oferta IS NULL` como marcador de "ainda não enriquecido"
  // — depois do enriquecimento essa coluna sempre fica preenchida (nem que
  // seja com {} para ofertas em que a API retornou lista vazia), então a
  // fase não reprocessa infinitamente as mesmas linhas.
  const { data: pendentes, error: selectError } = await supabase
    .from("ofertas_publicas_cvm")
    .select("id, id_requerimento_cvm, tipo_ativo")
    .is("detalhe_oferta", null)
    .not("id_requerimento_cvm", "is", null)
    .order("id_requerimento_cvm", { ascending: true })
    .limit(ENRICH_BATCH_SIZE);

  if (selectError) throw selectError;

  let runningTotals = { ...totals };

  if (!pendentes || pendentes.length === 0) {
    return { totals: runningTotals, nextFileIndex: 2, nextRowOffset: 0, allDone: true };
  }

  let cursor = 0;
  let processedThisInvocation = 0;
  async function worker() {
    while (cursor < pendentes.length && Date.now() < deadlineAt) {
      const row = pendentes[cursor];
      cursor++;
      try {
        // 3 chamadas em paralelo por oferta (independentes entre si). Usamos
        // allSettled para que a falha de um endpoint específico não descarte
        // as outras duas — assim ainda registramos o que deu certo.
        const [infoRes, docsRes, histRes] = await Promise.allSettled([
          buscarInfOferta(row.id_requerimento_cvm),
          buscarDocumentosPublicados(row.id_requerimento_cvm),
          buscarHistoricoStatus(row.id_requerimento_cvm),
        ]);

        // deno-lint-ignore no-explicit-any
        const update: Record<string, any> = {};

        if (infoRes.status === "fulfilled") {
          const campos = infoRes.value;
          // Mapa completo campoNome:valor — fonte de verdade caso a CVM
          // mude/adicione campos no futuro.
          const detalhe: Record<string, string> = {};
          for (const c of campos) {
            const nome = c.campoNome?.trim();
            const valor = c.valor?.trim() ?? "";
            if (!nome) continue;
            detalhe[nome] = valor;
            if (nome === "Gestor") {
              update.gestora = valor;
              continue;
            }
            const col = CAMPO_TO_COLUMN[nome];
            if (col) update[col] = valor;
          }
          update.detalhe_oferta = detalhe;
        } else {
          console.warn(`sync-cvm-ofertas: infOferta falhou id=${row.id_requerimento_cvm}`, infoRes.reason);
          // Marca como {} pra não travar essa oferta na fila para sempre;
          // uma próxima sincronização não a reprocessa (fica fora do
          // filtro `detalhe_oferta IS NULL`).
          update.detalhe_oferta = {};
        }

        if (docsRes.status === "fulfilled") {
          update.documentos_publicados = docsRes.value;
        } else {
          console.warn(`sync-cvm-ofertas: documentosPublicados falhou id=${row.id_requerimento_cvm}`, docsRes.reason);
        }

        if (histRes.status === "fulfilled") {
          update.historico_status = histRes.value;
        } else {
          console.warn(`sync-cvm-ofertas: historicoStatus falhou id=${row.id_requerimento_cvm}`, histRes.reason);
        }

        await supabase.from("ofertas_publicas_cvm").update(update).eq("id", row.id);
        runningTotals.totalAtualizadas += 1;
        processedThisInvocation += 1;
      } catch (err) {
        console.warn(`sync-cvm-ofertas: falha ao enriquecer idRequerimento=${row.id_requerimento_cvm}`, err);
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
    .is("detalhe_oferta", null)
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
