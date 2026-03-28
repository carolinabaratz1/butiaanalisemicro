import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { analistas } from '@/data/analistas';
import { historicoAnalises } from '@/data/historicoAnalises';
import { Users, UserCheck, UserX } from 'lucide-react';

const totalAnalistas = analistas.length;
const ativos = analistas.filter(a => a.ativo).length;
const exAnalistas = analistas.filter(a => !a.ativo).length;

function getQtdAnalises(analistaId: string) {
  return historicoAnalises.filter(h => h.analista_id === analistaId).length;
}

export default function AnalistasPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Analistas</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total de Analistas</p>
              <p className="text-2xl font-bold text-foreground">{totalAnalistas}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-status-success/15 flex items-center justify-center">
              <UserCheck className="h-5 w-5 text-status-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Analistas Ativos</p>
              <p className="text-2xl font-bold text-foreground">{ativos}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center">
              <UserX className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ex-Analistas</p>
              <p className="text-2xl font-bold text-foreground">{exAnalistas}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-[11px] h-9">Nome</TableHead>
                <TableHead className="text-[11px] h-9">Data de Entrada</TableHead>
                <TableHead className="text-[11px] h-9">Data de Saída</TableHead>
                <TableHead className="text-[11px] h-9">Status</TableHead>
                <TableHead className="text-[11px] h-9 text-right">Qtd. Análises</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analistas.map(a => (
                <TableRow key={a.id} className="border-border">
                  <TableCell className="text-sm py-2 font-medium">{a.nome}</TableCell>
                  <TableCell className="text-sm py-2 text-muted-foreground">{a.data_entrada}</TableCell>
                  <TableCell className="text-sm py-2 text-muted-foreground">{a.data_saida || '—'}</TableCell>
                  <TableCell className="py-2">
                    <Badge variant="outline" className={`text-[10px] ${a.ativo ? 'text-status-success border-status-success/30 bg-status-success/10' : 'text-muted-foreground border-border bg-muted/30'}`}>
                      {a.ativo ? 'Ativo' : 'Ex-Analista'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm py-2 text-right font-semibold">{getQtdAnalises(a.id)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
