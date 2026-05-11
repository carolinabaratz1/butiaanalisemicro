import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Upload, ChevronDown, ChevronUp, Loader2, FileSpreadsheet } from 'lucide-react';
import { processUpload, type UploadResult } from '@/lib/assembleiasUpload';
import { useAuth } from '@/contexts/AuthContext';

export function UploadPanel() {
  const { currentUser } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  const proc = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Selecione um arquivo');
      return processUpload(file, user?.id ?? null);
    },
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ['assembleias'] });
      toast({ title: 'Upload processado', description: `${r.novas} novas · ${r.duplicadas} duplicadas` });
    },
    onError: (e: any) => toast({ title: 'Erro no upload', description: e.message, variant: 'destructive' }),
  });

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4 cursor-pointer select-none" onClick={() => setOpen(o => !o)}>
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2"><Upload className="h-4 w-4" /> Upload de Assembleias (B3)</span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="pt-1 pb-4 px-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Input type="file" accept=".xlsx,.xls" onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null); }} className="h-9 text-sm max-w-sm" />
            {file && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <FileSpreadsheet className="h-3.5 w-3.5" /> {file.name}
              </span>
            )}
            <Button size="sm" onClick={() => proc.mutate()} disabled={!file || proc.isPending}>
              {proc.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Processar
            </Button>
          </div>
          {result && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
              {[
                { l: 'Total', v: result.total_linhas },
                { l: 'Novas', v: result.novas, cls: 'text-status-success' },
                { l: 'Duplicadas', v: result.duplicadas, cls: 'text-muted-foreground' },
                { l: 'Com posição', v: result.com_posicao, cls: 'text-status-success' },
                { l: 'Pendente vínculo', v: result.pendente_vinculo, cls: 'text-status-warning' },
                { l: 'Sem posição', v: result.sem_posicao, cls: 'text-muted-foreground' },
              ].map(m => (
                <div key={m.l} className="rounded border border-border bg-muted/20 px-2 py-1.5">
                  <div className="text-muted-foreground text-[10px] uppercase tracking-wider leading-tight">{m.l}</div>
                  <div className={`text-base font-semibold ${m.cls ?? ''}`}>{m.v}</div>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Arquivo .xlsx do administrador com colunas: Ticker, Cabeçalho, Texto (link B3), Data Assembléia, Tipo. Duplicatas são ignoradas automaticamente.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
