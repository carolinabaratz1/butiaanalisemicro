import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { targetPrices, getEmpresaNome, empresas } from '@/data/mockData';

const statusClass: Record<string, string> = {
  'Atingido': 'bg-status-success/15 text-status-success border-status-success/30',
  'Não atingido': 'bg-status-danger/15 text-status-danger border-status-danger/30',
  'Em andamento': 'bg-status-warning/15 text-status-warning border-status-warning/30',
  'Expirado': 'bg-muted/50 text-muted-foreground',
};

export default function AcoesPage() {
  // Group by empresa
  const empresasComTarget = [...new Set(targetPrices.map(t => t.empresaId))];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Ações — Target Prices</h2>

      {empresasComTarget.map(empId => {
        const targets = targetPrices.filter(t => t.empresaId === empId).sort((a, b) => b.dataRecomendacao.localeCompare(a.dataRecomendacao));
        const latest = targets[0];
        const pctDiff = latest ? ((latest.precoAtual - latest.precoAlvo) / latest.precoAlvo * 100) : 0;

        return (
          <Card key={empId} className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{getEmpresaNome(empId)}</CardTitle>
                {latest && (
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">Atual: <span className="text-foreground font-mono">R$ {latest.precoAtual.toFixed(2)}</span></span>
                    <span className="text-muted-foreground">Target: <span className="text-foreground font-mono">R$ {latest.precoAlvo.toFixed(2)}</span></span>
                    <span className={pctDiff < 0 ? 'text-status-success' : 'text-status-danger'}>
                      {pctDiff > 0 ? '+' : ''}{pctDiff.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-[11px] h-8">Preço Alvo</TableHead>
                    <TableHead className="text-[11px] h-8">Data</TableHead>
                    <TableHead className="text-[11px] h-8">Horizonte</TableHead>
                    <TableHead className="text-[11px] h-8">Status</TableHead>
                    <TableHead className="text-[11px] h-8">Tempo Restante</TableHead>
                    <TableHead className="text-[11px] h-8">Tese</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {targets.map(t => (
                    <TableRow key={t.id} className="border-border">
                      <TableCell className="text-sm py-1.5 font-mono font-bold">R$ {t.precoAlvo.toFixed(2)}</TableCell>
                      <TableCell className="text-sm py-1.5 text-muted-foreground">{t.dataRecomendacao}</TableCell>
                      <TableCell className="text-sm py-1.5">{t.horizonte} meses</TableCell>
                      <TableCell className="py-1.5"><Badge variant="outline" className={`text-[10px] ${statusClass[t.status]}`}>{t.status}</Badge></TableCell>
                      <TableCell className="text-sm py-1.5 text-muted-foreground">{t.tempoRestante > 0 ? `${t.tempoRestante} meses` : '—'}</TableCell>
                      <TableCell className="text-sm py-1.5 text-muted-foreground max-w-[250px] truncate">{t.teseResumida}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
