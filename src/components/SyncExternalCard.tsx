import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, Database, CheckCircle2, XCircle, Clock, History } from 'lucide-react';
import { toast } from 'sonner';

interface TableReport {
  table: string;
  ok: boolean;
  ms: number;
  rows?: number;
  chunks?: number;
  error?: string;
}

interface SyncLogRow {
  id: string;
  trigger_source: 'cron' | 'manual';
  status: 'running' | 'success' | 'partial' | 'failed';
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  tables_total: number | null;
  tables_ok: number | null;
  tables_failed: number | null;
  error_message: string | null;
  details: TableReport[] | null;
}

const CHUNK_SIZE = 2000;

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
}

function formatDuration(ms: number | null) {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function statusColor(status: SyncLogRow['status']) {
  switch (status) {
    case 'success': return 'text-green-400';
    case 'partial': return 'text-amber-400';
    case 'failed':  return 'text-red-400';
    default:        return 'text-blue-400';
  }
}

function statusLabel(status: SyncLogRow['status']) {
  return { success: 'OK', partial: 'Parcial', failed: 'Falha', running: 'Em execução' }[status];
}

export default function SyncExternalCard() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTable, setCurrentTable] = useState('');
  const [report, setReport] = useState<TableReport[]>([]);
  const [history, setHistory] = useState<SyncLogRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from('sync_external_log')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(20);
    setHistory((data ?? []) as SyncLogRow[]);
  }, []);

  useEffect(() => {
    loadHistory();
    const t = setInterval(loadHistory, 15_000);
    return () => clearInterval(t);
  }, [loadHistory]);

  const runSync = async () => {
    setRunning(true);
    setReport([]);
    setProgress(0);
    setCurrentTable('');

    try {
      const { data: listData, error: listErr } = await supabase.functions.invoke(
        'sync-external-supabase',
        { body: { list_only: true } },
      );
      if (listErr) throw listErr;
      const tables: string[] = listData.tables ?? [];

      const results: TableReport[] = [];
      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        setCurrentTable(table);
        setProgress(Math.round((i / tables.length) * 100));

        let offset = 0;
        let totalRows = 0;
        let totalMs = 0;
        let chunks = 0;
        let failed: string | null = null;

        while (true) {
          const { data, error } = await supabase.functions.invoke(
            'sync-external-supabase',
            { body: { table, offset, limit: CHUNK_SIZE, reset: offset === 0 } },
          );
          if (error) { failed = error.message; break; }
          const step = data?.report?.[0];
          if (!step) { failed = 'sem resposta'; break; }
          if (!step.ok) { failed = step.error ?? 'erro desconhecido'; break; }

          chunks += 1;
          totalRows += step.rows ?? 0;
          totalMs += step.ms ?? 0;
          offset = step.next_offset ?? offset + (step.rows ?? 0);

          setCurrentTable(`${table} · ${totalRows.toLocaleString('pt-BR')} linhas`);
          setReport([...results, { table, ok: true, ms: totalMs, rows: totalRows, chunks }]);

          if (step.done) break;
        }

        results.push(
          failed
            ? { table, ok: false, ms: totalMs, rows: totalRows, chunks, error: failed }
            : { table, ok: true, ms: totalMs, rows: totalRows, chunks },
        );
        setReport([...results]);
      }

      setProgress(100);
      setCurrentTable('');
      const okCount = results.filter((r) => r.ok).length;
      const failed = results.length - okCount;
      if (failed === 0) toast.success(`Sync completo: ${okCount} tabelas`);
      else toast.warning(`Sync com falhas: ${okCount} OK, ${failed} com erro`);
      loadHistory();
    } catch (e) {
      toast.error(`Falha no sync: ${(e as Error).message}`);
    } finally {
      setRunning(false);
    }
  };

  const okCount = report.filter((r) => r.ok).length;
  const failedCount = report.filter((r) => !r.ok).length;
  const lastCron = history.find((h) => h.trigger_source === 'cron');

  return (
    <Card className="bg-surface-2 border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Database className="h-4 w-4" />
          Replicação para Supabase Externo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Espelha (TRUNCATE + INSERT) todas as tabelas para o Supabase externo.
          Execução automática diária às 03:00 (BRT) rodando em segundo plano no servidor.
        </p>

        {lastCron && (
          <div className="text-xs bg-surface-1 border border-border rounded px-2 py-1.5 flex items-center gap-2">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Última execução automática:</span>
            <span className={statusColor(lastCron.status)}>{statusLabel(lastCron.status)}</span>
            <span className="text-muted-foreground">·</span>
            <span>{formatDateTime(lastCron.started_at)}</span>
            {lastCron.tables_ok != null && (
              <>
                <span className="text-muted-foreground">·</span>
                <span>{lastCron.tables_ok}/{lastCron.tables_total} OK</span>
              </>
            )}
          </div>
        )}

        <Button onClick={runSync} disabled={running} size="sm" className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Sincronizando...' : 'Sincronizar agora'}
        </Button>

        {running && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{currentTable || 'Iniciando...'}</span>
              <span className="text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}

        {report.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-3 text-xs">
              <span className="text-green-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> {okCount} OK
              </span>
              {failedCount > 0 && (
                <span className="text-red-400 flex items-center gap-1">
                  <XCircle className="h-3 w-3" /> {failedCount} falha(s)
                </span>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto text-xs border border-border rounded">
              <table className="w-full">
                <thead className="bg-surface-1 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1">Tabela</th>
                    <th className="text-right px-2 py-1">Linhas</th>
                    <th className="text-right px-2 py-1">Chunks</th>
                    <th className="text-right px-2 py-1">Tempo</th>
                    <th className="text-left px-2 py-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.map((r) => (
                    <tr key={r.table} className="border-t border-border">
                      <td className="px-2 py-1 font-mono">{r.table}</td>
                      <td className="px-2 py-1 text-right">{r.rows ?? '-'}</td>
                      <td className="px-2 py-1 text-right">{r.chunks ?? '-'}</td>
                      <td className="px-2 py-1 text-right">{r.ms}ms</td>
                      <td className="px-2 py-1">
                        {r.ok ? (
                          <span className="text-green-400">OK</span>
                        ) : (
                          <span className="text-red-400" title={r.error}>{r.error}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-border">
          <div className="text-xs font-medium mb-1.5 flex items-center gap-1.5">
            <History className="h-3 w-3" /> Histórico
          </div>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma execução registrada ainda.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto text-xs border border-border rounded">
              <table className="w-full">
                <thead className="bg-surface-1 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1">Início</th>
                    <th className="text-left px-2 py-1">Origem</th>
                    <th className="text-left px-2 py-1">Status</th>
                    <th className="text-right px-2 py-1">OK/Total</th>
                    <th className="text-right px-2 py-1">Duração</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <>
                      <tr
                        key={h.id}
                        className="border-t border-border cursor-pointer hover:bg-surface-1"
                        onClick={() => setExpanded(expanded === h.id ? null : h.id)}
                      >
                        <td className="px-2 py-1">{formatDateTime(h.started_at)}</td>
                        <td className="px-2 py-1">{h.trigger_source === 'cron' ? 'Automática' : 'Manual'}</td>
                        <td className={`px-2 py-1 ${statusColor(h.status)}`}>{statusLabel(h.status)}</td>
                        <td className="px-2 py-1 text-right">
                          {h.tables_ok ?? 0}/{h.tables_total ?? 0}
                          {(h.tables_failed ?? 0) > 0 && (
                            <span className="text-red-400 ml-1">(-{h.tables_failed})</span>
                          )}
                        </td>
                        <td className="px-2 py-1 text-right">{formatDuration(h.duration_ms)}</td>
                      </tr>
                      {expanded === h.id && h.details && (
                        <tr className="bg-surface-1">
                          <td colSpan={5} className="px-2 py-2">
                            {h.error_message && (
                              <div className="text-red-400 mb-1">Erro: {h.error_message}</div>
                            )}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-0.5">
                              {h.details.map((d) => (
                                <div key={d.table} className="flex justify-between gap-2 font-mono text-[11px]">
                                  <span className="truncate">{d.table}</span>
                                  <span className={d.ok ? 'text-green-400' : 'text-red-400'}>
                                    {d.ok ? `${(d.rows ?? 0).toLocaleString('pt-BR')}` : (d.error ?? 'erro')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
