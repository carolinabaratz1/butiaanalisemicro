// ============================================================
// src/components/trade/UploadPage.tsx
// Página de upload do Excel — integra ao sistema Lovable.
// ============================================================

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { CheckCircle, XCircle, Clock, FileSpreadsheet, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface UploadLog {
  id: number;
  filename: string;
  created_at: string;
  status: "processing" | "success" | "error";
  data_inicio: string | null;
  data_fim: string | null;
  ativos_di: number | null;
  ativos_ipca: number | null;
  linhas_inseridas: number | null;
  linhas_atualizadas: number | null;
  erro_msg: string | null;
}

interface UploadResult {
  success: boolean;
  log?: UploadLog;
  error?: string;
  ratingsImportados?: number;
  ratingsIgnorados?: number;
}

type UploadTable = "trade_taxas" | "trade_ativos" | "trade_ntnb" | "trade_ipca_ref";

type UploadRows = Record<UploadTable, Record<string, unknown>[]>;

interface IssuerRatingCandidate {
  cnpj: string;
  rating: string;
  agencia: string | null;
  data_rating: string | null;
}

interface ParsedTradeUpload {
  rows: UploadRows;
  issuerRatingCandidates: IssuerRatingCandidate[];
  summary: {
    data_inicio: string | null;
    data_fim: string | null;
    ativos_di: number;
    ativos_ipca: number;
    linhas_inseridas: number;
    linhas_atualizadas: number;
  };
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 min
const UPLOAD_BATCH_SIZE = 400;
const PROCESS_UPLOAD_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-upload`;
const UPLOAD_TABLES: UploadTable[] = ["trade_taxas", "trade_ativos", "trade_ntnb", "trade_ipca_ref"];

export function UploadPage() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusLabel, setStatusLabel] = useState<string>("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [logs, setLogs] = useState<UploadLog[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);

  const loadLogs = useCallback(async () => {
    const { data } = await supabase
      .from("trade_upload_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    setLogs((data ?? []) as UploadLog[]);
    setLogsLoaded(true);
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  async function pollUploadLog(logId: number): Promise<UploadLog> {
    const started = Date.now();
    let pct = 80;
    while (Date.now() - started < POLL_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const { data, error } = await supabase
        .from("trade_upload_log")
        .select("*")
        .eq("id", logId)
        .single();
      if (error) throw new Error(error.message);
      const log = data as UploadLog;
      if (log.status === "success" || log.status === "error") return log;
      pct = Math.min(90, pct + 2);
      setProgress(pct);
      setStatusLabel("Recalculando métricas…");
    }
    throw new Error("Tempo limite excedido aguardando processamento.");
  }

  async function invokeProcessUpload(
    accessToken: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const res = await fetch(PROCESS_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) {
      throw new Error(String(json?.error || `Falha no envio (HTTP ${res.status}).`));
    }
    return json;
  }

  // Importa ratings de emissor extraídos da planilha (aba "Dados Emissao e
  // emissor") para a tabela issuer_ratings. SEMPRE por inserção — nunca faz
  // update/overwrite. A tabela tem uma constraint de unicidade em
  // (cnpj, agencia, data_rating) — NÃO inclui o texto do rating — então a
  // deduplicação (tanto dentro do próprio arquivo quanto contra o que já
  // existe no banco) precisa usar exatamente essa mesma chave, senão o
  // insert é rejeitado pelo banco (duplicate key).
  async function importIssuerRatings(
    userId: string | null,
    candidatesRaw: IssuerRatingCandidate[],
  ): Promise<{ importados: number; ignorados: number }> {
    // issuer_ratings.cnpj é normalizado (só dígitos) por um trigger no banco.
    // A planilha traz o CNPJ formatado ("08.213.823/0001-07"), então
    // normalizamos aqui ANTES de comparar com o que já existe — senão a
    // checagem de duplicata nunca bate e reimporta tudo a cada upload.
    const candidates = candidatesRaw
      .map((c) => ({ ...c, cnpj: c.cnpj.replace(/[^0-9]/g, "") }))
      .filter((c) => c.cnpj);
    if (candidates.length === 0) return { importados: 0, ignorados: 0 };

    // Chave real de unicidade do banco: cnpj + agência + data (sem rating).
    const uniqKey = (cnpj: string, agencia: string | null, dataRating: string | null) =>
      `${cnpj}||${agencia ?? ""}||${dataRating ?? ""}`;

    // Dedup dentro do próprio arquivo: se duas linhas caírem na mesma chave
    // (cnpj+agência+data), mantemos só a primeira — senão o próprio lote de
    // insert já viria com duplicata interna.
    const dedupedMap = new Map<string, IssuerRatingCandidate>();
    for (const c of candidates) {
      const key = uniqKey(c.cnpj, c.agencia, c.data_rating);
      if (!dedupedMap.has(key)) dedupedMap.set(key, c);
    }
    const deduped = Array.from(dedupedMap.values());

    const cnpjs = Array.from(new Set(deduped.map((c) => c.cnpj)));
    const existingKeys = new Set<string>();
    for (let i = 0; i < cnpjs.length; i += 200) {
      const batch = cnpjs.slice(i, i + 200);
      const { data, error } = await supabase
        .from("issuer_ratings")
        .select("cnpj,rating_agency,data_rating")
        .in("cnpj", batch);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) {
        existingKeys.add(uniqKey(row.cnpj, row.rating_agency, row.data_rating));
      }
    }

    const toInsert = deduped.filter((c) => !existingKeys.has(uniqKey(c.cnpj, c.agencia, c.data_rating)));

    for (let i = 0; i < toInsert.length; i += UPLOAD_BATCH_SIZE) {
      const batch = toInsert.slice(i, i + UPLOAD_BATCH_SIZE).map((c) => ({
        cnpj: c.cnpj,
        rating: c.rating,
        rating_agency: c.agencia,
        data_rating: c.data_rating,
        observacao: "Importado automaticamente da planilha diária (Dados Emissao e emissor).",
        created_by: userId,
      }));
      const { error } = await supabase.from("issuer_ratings").insert(batch);
      if (error) throw new Error(`Falha ao importar ratings de emissor: ${error.message}`);
    }


    return { importados: toInsert.length, ignorados: candidates.length - toInsert.length };
  }

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setResult({ success: false, error: "Apenas arquivos .xlsx são aceitos." });
      return;
    }

    setUploading(true);
    setResult(null);
    setProgress(10);
    setStatusLabel("Lendo planilha…");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não encontrada. Faça login novamente.");

      const parsed = await parseTradeWorkbook(file);
      const totalRows = UPLOAD_TABLES.reduce((sum, table) => sum + parsed.rows[table].length, 0);
      if (totalRows === 0) throw new Error("Nenhuma linha válida encontrada na planilha.");

      setProgress(25);
      setStatusLabel("Criando registro de upload…");

      const start = await invokeProcessUpload(session.access_token, {
        action: "start",
        filename: file.name,
      });
      const logId = Number(start.log_id);
      if (!Number.isInteger(logId)) throw new Error("A função não retornou um log_id válido.");

      await loadLogs();

      let sentRows = 0;
      for (const table of UPLOAD_TABLES) {
        const rows = parsed.rows[table];
        for (let i = 0; i < rows.length; i += UPLOAD_BATCH_SIZE) {
          const batch = rows.slice(i, i + UPLOAD_BATCH_SIZE);
          setStatusLabel(`Gravando ${table.replace("trade_", "")}…`);
          await invokeProcessUpload(session.access_token, {
            action: "upsert",
            log_id: logId,
            table,
            rows: batch,
          });
          sentRows += batch.length;
          setProgress(Math.min(65, 25 + Math.round((sentRows / totalRows) * 40)));
        }
      }

      setProgress(70);
      setStatusLabel("Recalculando métricas…");
      await invokeProcessUpload(session.access_token, {
        action: "finish",
        log_id: logId,
        summary: parsed.summary,
      });

      const finalLog = await pollUploadLog(logId);

      if (finalLog.status !== "success") {
        setProgress(100);
        setStatusLabel("Erro");
        setResult({ success: false, error: finalLog.erro_msg ?? "Erro no processamento." });
        await loadLogs();
        return;
      }

      // Trade Monitor OK — agora importa ratings de emissor (issuer_ratings),
      // sempre por inserção nova, nunca sobrescrevendo histórico existente.
      setProgress(92);
      setStatusLabel("Importando ratings de emissor…");
      const { importados, ignorados } = await importIssuerRatings(
        session.user?.id ?? null,
        parsed.issuerRatingCandidates,
      );

      setProgress(100);
      setStatusLabel("Concluído");
      setResult({
        success: true,
        log: finalLog,
        ratingsImportados: importados,
        ratingsIgnorados: ignorados,
      });

      await loadLogs();
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : "Erro desconhecido" });
    } finally {
      setUploading(false);
      setTimeout(() => {
        setProgress(0);
        setStatusLabel("");
      }, 1500);
    }
  }, [loadLogs]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Atualizar Dados de Mercado</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Faça upload da planilha Excel exportada para atualizar as taxas, spreads, PUs e ratings de emissor.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
              ${isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"}
              ${uploading ? "opacity-60 cursor-not-allowed" : ""}
            `}
          >
            <input {...getInputProps()} />
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="font-semibold text-primary">Solte o arquivo aqui</p>
            ) : (
              <>
                <p className="font-semibold">Arraste o arquivo .xlsx ou clique para selecionar</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Planilha exportada com as abas: Taxas dos Titulos · Dados Emissao · IPCA e NTN-B · TAXA NTN-B
                </p>
              </>
            )}
          </div>

          {progress > 0 && (
            <div className="mt-4 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{statusLabel || (progress < 100 ? "Processando…" : "Concluído")}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card className={result.success ? "border-primary/40 bg-primary/5" : "border-destructive/40 bg-destructive/5"}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              {result.success
                ? <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                : <XCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />}
              <div>
                <p className="font-semibold">{result.success ? "Upload realizado com sucesso" : "Erro no processamento"}</p>
                {result.success && result.log && (
                  <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground">
                    <span>Linhas de taxa:   <strong className="text-foreground">{(result.log.linhas_inseridas ?? 0).toLocaleString("pt-BR")}</strong></span>
                    <span>Ativos:          <strong className="text-foreground">{(result.log.linhas_atualizadas ?? 0).toLocaleString("pt-BR")}</strong></span>
                    <span>DI / IPCA:       <strong className="text-foreground">{result.log.ativos_di ?? 0} / {result.log.ativos_ipca ?? 0}</strong></span>
                    <span>Período:         <strong className="text-foreground">{result.log.data_inicio} → {result.log.data_fim}</strong></span>
                    <span className="col-span-2 pt-1 border-t border-border/50 mt-1">
                      Ratings de emissor: <strong className="text-foreground">{result.ratingsImportados ?? 0} novos importados</strong>
                      {" "}({result.ratingsIgnorados ?? 0} já existiam, ignorados)
                    </span>
                  </div>
                )}
                {!result.success && (
                  <p className="mt-1 text-sm text-destructive">{result.error}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Histórico de Uploads</CardTitle>
            <Button variant="ghost" size="sm" onClick={loadLogs}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 pb-6">Nenhum upload realizado ainda.</p>
          ) : (
            <div className="divide-y">
              {logs.map((log) => (
                <div key={log.id} className="px-6 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{log.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString("pt-BR")}
                      {log.data_inicio && ` · ${log.data_inicio} → ${log.data_fim}`}
                    </p>
                    {log.erro_msg && (
                      <p className="text-xs text-destructive mt-0.5 truncate">{log.erro_msg}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {log.status === "success" && (
                      <span className="text-xs text-muted-foreground">
                        DI: {log.ativos_di} · IPCA: {log.ativos_ipca}
                      </span>
                    )}
                    <StatusBadge status={log.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Extrai ticker, data de vencimento e taxa de emissão do "Nome do Ativo".
// Formato: "TICKER - NOME DO EMISSOR - DATA(YYYYMMDD) - TAXA".
//
// IMPORTANTE: o nome do emissor pode conter " - " no meio (ex.: "V.TAL -
// REDE NEUTRA DE TELECOMUNICACOES S.A.", "ENERGISA MATO GROSSO -
// DISTRIBUIDORA DE ENERGIA S.A.", "CESP - COMPANHIA ENERGETICA..."), o que
// gera mais de 4 partes no split. Por isso NÃO usamos posição fixa
// (parts[2]/parts[3]) — usamos posição relativa ao FINAL da string, já que
// a data e a taxa são sempre os dois últimos segmentos, não importa quantos
// hífens o nome do emissor tenha no meio.
function parseNomeAtivo(nome: string) {
  const parts = nome.split(" - ");
  const vencStr = parts[parts.length - 2]?.trim() ?? "";
  const taxaEmissao = parts[parts.length - 1]?.trim() ?? "";

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

  const spreadMatch = taxaEmissao.match(/[\+\s]+([\d.]+)%/);
  const spreadEmissao = spreadMatch ? parseFloat(spreadMatch[1]) : null;

  return { venc_date: vencDate, anos_venc: anosVenc, indexador, taxa_emissao: taxaEmissao, spread_emissao: spreadEmissao };
}

// Extrai agência + nota do campo "Rating 1" da planilha, formato
// "AGÊNCIA | NOTA" (ex.: "S&P | AA+", "FITCH | AAA", "MOODY'S | A",
// "FITCH | Retirado"). Se não houver "|", trata o texto todo como rating,
// sem agência identificada.
function parseRating1(raw: unknown): { agencia: string | null; rating: string | null } {
  const s = String(raw ?? "").trim();
  if (!s) return { agencia: null, rating: null };
  const parts = s.split("|").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return { agencia: parts[0], rating: parts.slice(1).join(" | ") };
  return { agencia: null, rating: parts[0] ?? null };
}

function excelDateToISO(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date && !Number.isNaN(val.getTime())) return val.toISOString().slice(0, 10);
  if (typeof val === "string") {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
  }
  if (typeof val === "number") {
    const d = new Date((val - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function num(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

async function parseTradeWorkbook(file: File): Promise<ParsedTradeUpload> {
  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });

  const sheetTaxas = wb.Sheets["Taxas dos Titulos"];
  const sheetEmissao = wb.Sheets["Dados Emissao e emissor"];
  const sheetIPCARef = wb.Sheets["IPCA e NTN-B referencia"];
  const sheetNTNB = wb.Sheets["TAXA NTN-B"];

  if (!sheetTaxas) throw new Error("Aba 'Taxas dos Titulos' não encontrada.");

  // V2 da planilha: a coluna A da aba "Taxas dos Titulos" tem como cabeçalho uma
  // fórmula QTLINK e contém o "Nome do Ativo" completo (ex.: "AALM12 - AURA ...").
  // Lemos por posição (skip da 1ª linha) e derivamos o ticker do nome.
  const rawTaxas: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheetTaxas, {
    defval: null,
    range: 1,
    header: ["Nome do Ativo", "Data", "Taxa Indicativa", "Quantidade Negociada", "PU Curva", "PU Indicativo", "Duration"],
  });
  const taxasRows: Record<string, unknown>[] = [];
  const ativosMap = new Map<string, Record<string, unknown>>();
  let dataInicio: string | null = null;
  let dataFim: string | null = null;

  for (const r of rawTaxas) {
    const nomeCompleto = String(r["Nome do Ativo"] ?? "").trim();
    const ticker = (String(r["Ticker"] ?? "").trim()) || nomeCompleto.split(" - ")[0]?.trim() || "";
    const dataISO = excelDateToISO(r["Data"]);
    if (!ticker || !dataISO) continue;

    if (!dataInicio || dataISO < dataInicio) dataInicio = dataISO;
    if (!dataFim || dataISO > dataFim) dataFim = dataISO;

    const durationDu = num(r["Duration"]);
    taxasRows.push({
      ticker,
      data: dataISO,
      taxa_indicativa: num(r["Taxa Indicativa"]),
      qtd_negociada: num(r["Quantidade Negociada"]),
      pu_curva: num(r["PU Curva"]),
      pu_indicativo: num(r["PU Indicativo"]),
      duration_du: durationDu,
    });

    if (!ativosMap.has(ticker) && nomeCompleto) {
      const parsed = parseNomeAtivo(nomeCompleto);
      ativosMap.set(ticker, { ticker, nome_completo: nomeCompleto, ...parsed });
    }

    // Track latest available duration per ticker to override anos_venc
    if (durationDu !== null && durationDu > 0) {
      const existing = ativosMap.get(ticker) ?? { ticker };
      const prevDate = existing.__duration_date as string | undefined;
      if (!prevDate || dataISO >= prevDate) {
        ativosMap.set(ticker, {
          ...existing,
          __duration_date: dataISO,
          __duration_anos: durationDu / 252,
        });
      }
    }
  }

  // Apply duration-based anos_venc override (fallback to date-based when missing)
  for (const [ticker, ativo] of ativosMap) {
    const dAnos = ativo.__duration_anos as number | undefined;
    if (dAnos !== undefined && dAnos !== null) {
      ativo.anos_venc = Number(dAnos.toFixed(4));
    }
    delete ativo.__duration_anos;
    delete ativo.__duration_date;
    ativosMap.set(ticker, ativo);
  }

  // Candidatos de rating de emissor (para issuer_ratings, append-only).
  // Deduplicados aqui por (cnpj + rating + agência + data), já que várias
  // linhas (tickers diferentes) do mesmo emissor podem repetir exatamente o
  // mesmo rating — isso evita mandar tuplas idênticas repetidas para o banco
  // dentro do próprio arquivo (a checagem contra o que já existe no banco é
  // feita depois, no momento da importação).
  const issuerRatingCandidatesMap = new Map<string, IssuerRatingCandidate>();

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
        rating: r["Rating 1"] ?? existing["rating"],
        data_rating: excelDateToISO(r["Data do Rating 1"]) ?? existing["data_rating"],
      });

      const cnpj = String(r["Emissor CNPJ"] ?? "").trim();
      const { agencia, rating } = parseRating1(r["Rating 1"]);
      const dataRating = excelDateToISO(r["Data do Rating 1"]);
      if (cnpj && rating) {
        const key = `${cnpj}||${rating}||${agencia ?? ""}||${dataRating ?? ""}`;
        if (!issuerRatingCandidatesMap.has(key)) {
          issuerRatingCandidatesMap.set(key, { cnpj, rating, agencia, data_rating: dataRating });
        }
      }
    }
  }

  const ipcaRefRows: Record<string, unknown>[] = [];
  if (sheetIPCARef) {
    const rawRef: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheetIPCARef, { defval: null });
    for (const r of rawRef) {
      const ticker = String(r["Ticker"] ?? "").trim();
      const ntnbRef = String(r["NTN's Referencia"] ?? "").trim();
      if (!ticker || !ntnbRef) continue;
      ipcaRefRows.push({ ticker, emissao: r["Emissao"], ntnb_ref: ntnbRef });
    }
  }

  const ntnbRows: Record<string, unknown>[] = [];
  if (sheetNTNB) {
    // Mesma estrutura v2: coluna A com fórmula QTLINK e nome do ativo abaixo.
    const rawNTNB: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheetNTNB, {
      defval: null,
      range: 1,
      header: ["Nome do Ativo", "Data", "Taxa Indicativa", "Quantidade Negociada", "PU Curva", "PU Indicativo", "Duration"],
    });
    for (const r of rawNTNB) {
      const nome = String(r["Nome do Ativo"] ?? "").trim();
      const dataISO = excelDateToISO(r["Data"]);
      if (!nome.startsWith("NTN-B") || !dataISO) continue;
      ntnbRows.push({
        bond_name: nome,
        data: dataISO,
        taxa_indicativa: num(r["Taxa Indicativa"]),
        pu_indicativo: num(r["PU Indicativo"]),
      });
    }
  }

  // Remove chaves vazias das linhas de ativos para que a edge function
  // preserve os valores já existentes no banco (merge parcial).
  const ativosRows = Array.from(ativosMap.values()).map((row) => {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v !== null && v !== undefined && v !== "") cleaned[k] = v;
    }
    return cleaned;
  });

  return {
    rows: {
      trade_taxas: taxasRows,
      trade_ativos: ativosRows,
      trade_ntnb: ntnbRows,
      trade_ipca_ref: ipcaRefRows,
    },
    issuerRatingCandidates: Array.from(issuerRatingCandidatesMap.values()),
    summary: {
      data_inicio: dataInicio,
      data_fim: dataFim,
      ativos_di: ativosRows.filter((a) => a.indexador === "DI").length,
      ativos_ipca: ativosRows.filter((a) => a.indexador === "IPCA").length,
      linhas_inseridas: taxasRows.length,
      linhas_atualizadas: ativosRows.length,
    },
  };
}

function StatusBadge({ status }: { status: UploadLog["status"] }) {
  if (status === "success") {
    return <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 px-2.5 py-0.5 text-xs font-semibold text-primary"><CheckCircle className="w-3 h-3" /> OK</span>;
  }
  if (status === "error") {
    return <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 px-2.5 py-0.5 text-xs font-semibold text-destructive"><XCircle className="w-3 h-3" /> Erro</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground"><Clock className="w-3 h-3" /> Processando</span>;
}
