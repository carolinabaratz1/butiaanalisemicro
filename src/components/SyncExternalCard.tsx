import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, Database, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface TableReport {
  table: string;
  ok: boolean;
  ms: number;
  rows?: number;
  chunks?: number;
  error?: string;
}

const CHUNK_SIZE = 2000;

export default function SyncExternalCard() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTable, setCurrentTable] = useState('');
  const [report, setReport] = useState<TableReport[]>([]);

  const runSync = async () => {
    setRunning(true);
    setReport([]);
    setProgress(0);
    setCurrentTable('');

    try {
      // 1) Descobre a lista de tabelas
      const { data: listData, error: listErr } = await supabase.functions.invoke(
        'sync-external-supabase',
        { body: { list_only: true } },
      );
      if (listErr) throw listErr;
      const tables: string[] = listData.tables ?? [];

      // 2) Uma invocação por chunk — evita estouro de CPU/memória em tabelas grandes
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

          if (error) {
            failed = error.message;
            break;
          }

          const step = data?.report?.[0];
          if (!step) {
            failed = 'sem resposta';
            break;
          }
          if (!step.ok) {
            failed = step.error ?? 'erro desconhecido';
            break;
          }

          chunks += 1;
          totalRows += step.rows ?? 0;
          totalMs += step.ms ?? 0;
          offset = step.next_offset ?? offset + (step.rows ?? 0);

          const chunkLabel = `${table} · ${totalRows.toLocaleString('pt-BR')} linhas`;
          setCurrentTable(chunkLabel);
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
    } catch (e) {
      toast.error(`Falha no sync: ${(e as Error).message}`);
    } finally {
      setRunning(false);
    }
  };

  const okCount = report.filter((r) => r.ok).length;
  const failedCount = report.filter((r) => !r.ok).length;

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
          Espelha (TRUNCATE + INSERT) todas as tabelas para o Supabase externo,
          uma por vez. Execução automática diária às 03:00 (BRT).
        </p>
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
      </CardContent>
    </Card>
  );
}
