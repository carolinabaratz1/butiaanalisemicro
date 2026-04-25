// ============================================================
// src/components/trade/UploadPage.tsx
// Página de upload do Excel — integra ao sistema Lovable.
// ============================================================

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { Upload, CheckCircle, XCircle, Clock, FileSpreadsheet, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  erro_msg: string | null;
}

interface UploadResult {
  success: boolean;
  log?: UploadLog;
  error?: string;
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 min

export function UploadPage() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusLabel, setStatusLabel] = useState<string>("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [logs, setLogs] = useState<UploadLog[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);

  async function pollUploadLog(logId: number): Promise<UploadLog> {
    const started = Date.now();
    let pct = 50;
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
      pct = Math.min(95, pct + 5);
      setProgress(pct);
      setStatusLabel("Processando no servidor…");
    }
    throw new Error("Tempo limite excedido aguardando processamento.");
  }

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (!file.name.endsWith(".xlsx")) {
      setResult({ success: false, error: "Apenas arquivos .xlsx são aceitos." });
      return;
    }

    setUploading(true);
    setResult(null);
    setProgress(10);
    setStatusLabel("Enviando arquivo…");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não encontrada. Faça login novamente.");

      const formData = new FormData();
      formData.append("file", file);

      setProgress(30);

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-upload`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        }
      );

      const json = await res.json();
      if (!res.ok || !json?.success || !json?.log_id) {
        throw new Error(json?.error || `Falha no envio (HTTP ${res.status}).`);
      }

      setProgress(50);
      setStatusLabel("Aguardando processamento…");
      loadLogs();

      const finalLog = await pollUploadLog(json.log_id);
      setProgress(100);
      setStatusLabel(finalLog.status === "success" ? "Concluído" : "Erro");

      if (finalLog.status === "success") {
        setResult({ success: true, log: finalLog });
      } else {
        setResult({ success: false, error: finalLog.erro_msg ?? "Erro no processamento." });
      }

      loadLogs();
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : "Erro desconhecido" });
    } finally {
      setUploading(false);
      setTimeout(() => {
        setProgress(0);
        setStatusLabel("");
      }, 1500);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
    maxFiles: 1,
    disabled: uploading,
  });

  async function loadLogs() {
    const { data } = await supabase
      .from("trade_upload_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    setLogs((data ?? []) as UploadLog[]);
    setLogsLoaded(true);
  }

  if (!logsLoaded) loadLogs();

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Atualizar Dados de Mercado</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Faça upload da planilha Excel exportada para atualizar as taxas, spreads e PUs.
        </p>
      </div>

      {/* Dropzone */}
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

      {/* Result */}
      {result && (
        <Card className={result.success ? "border-green-500/40 bg-green-500/5" : "border-red-500/40 bg-red-500/5"}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              {result.success
                ? <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                : <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />}
              <div>
                <p className="font-semibold">{result.success ? "Upload realizado com sucesso" : "Erro no processamento"}</p>
                {result.success && result.log && (
                  <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground">
                    <span>Linhas de taxa:   <strong className="text-foreground">{(result.log.linhas_inseridas ?? 0).toLocaleString("pt-BR")}</strong></span>
                    <span>Ativos:          <strong className="text-foreground">{(result.log.linhas_atualizadas ?? 0).toLocaleString("pt-BR")}</strong></span>
                    <span>DI / IPCA:       <strong className="text-foreground">{result.log.ativos_di ?? 0} / {result.log.ativos_ipca ?? 0}</strong></span>
                    <span>Período:         <strong className="text-foreground">{result.log.data_inicio} → {result.log.data_fim}</strong></span>
                  </div>
                )}
                {!result.success && (
                  <p className="mt-1 text-sm text-red-600">{result.error}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload history */}
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
                      <p className="text-xs text-red-500 mt-0.5 truncate">{log.erro_msg}</p>
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

function StatusBadge({ status }: { status: UploadLog["status"] }) {
  if (status === "success") return <Badge variant="outline" className="border-green-500 text-green-600 gap-1"><CheckCircle className="w-3 h-3" /> OK</Badge>;
  if (status === "error")   return <Badge variant="outline" className="border-red-500 text-red-600 gap-1"><XCircle className="w-3 h-3" /> Erro</Badge>;
  return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" /> Processando</Badge>;
}
