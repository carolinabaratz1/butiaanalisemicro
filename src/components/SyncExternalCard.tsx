import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Database, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface SyncResult {
  total_ms: number;
  ok: number;
  failed: number;
  report: Array<{ table: string; ok: boolean; ms: number; rows?: number; error?: string }>;
}

export default function SyncExternalCard() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  const runSync = async () => {
    setRunning(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('sync-external-supabase', {
        body: {},
      });
      if (error) throw error;
      setResult(data as SyncResult);
      const r = data as SyncResult;
      if (r.failed === 0) {
        toast.success(`Sync concluído: ${r.ok} tabelas em ${(r.total_ms / 1000).toFixed(1)}s`);
      } else {
        toast.warning(`Sync com falhas: ${r.ok} OK, ${r.failed} com erro`);
      }
    } catch (e) {
      toast.error(`Falha no sync: ${(e as Error).message}`);
    } finally {
      setRunning(false);
    }
  };

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
          Execução automática diária às 03:00 (BRT).
        </p>
        <Button onClick={runSync} disabled={running} size="sm" className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Sincronizando...' : 'Sincronizar agora'}
        </Button>

        {result && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-3 text-xs">
              <span className="text-green-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> {result.ok} OK
              </span>
              {result.failed > 0 && (
                <span className="text-red-400 flex items-center gap-1">
                  <XCircle className="h-3 w-3" /> {result.failed} falha(s)
                </span>
              )}
              <span className="text-muted-foreground">{(result.total_ms / 1000).toFixed(1)}s</span>
            </div>
            <div className="max-h-64 overflow-y-auto text-xs border border-border rounded">
              <table className="w-full">
                <thead className="bg-surface-1 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1">Tabela</th>
                    <th className="text-right px-2 py-1">Linhas</th>
                    <th className="text-right px-2 py-1">Tempo</th>
                    <th className="text-left px-2 py-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.report.map((r) => (
                    <tr key={r.table} className="border-t border-border">
                      <td className="px-2 py-1 font-mono">{r.table}</td>
                      <td className="px-2 py-1 text-right">{r.rows ?? '-'}</td>
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
