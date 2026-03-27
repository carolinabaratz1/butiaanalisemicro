import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { analises, getEmpresaNome, getAnalistaNome, analistas, empresas, type Analise } from '@/data/mockData';
import { Eye } from 'lucide-react';

const statusClass: Record<string, string> = {
  'Em análise': 'bg-status-info/15 text-status-info border-status-info/30',
  'Em revisão': 'bg-status-warning/15 text-status-warning border-status-warning/30',
  'Aprovado': 'bg-status-success/15 text-status-success border-status-success/30',
  'Reprovado': 'bg-status-danger/15 text-status-danger border-status-danger/30',
};

export default function AnalisesPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [tipoFilter, setTipoFilter] = useState('all');
  const [analistaFilter, setAnalistaFilter] = useState('all');
  const [selected, setSelected] = useState<Analise | null>(null);

  const filtered = analises.filter(a => {
    return (statusFilter === 'all' || a.status === statusFilter)
      && (tipoFilter === 'all' || a.tipo === tipoFilter)
      && (analistaFilter === 'all' || a.analistaResponsavel === analistaFilter);
  });

  // Group by empresa for version history
  const versions = selected ? analises.filter(a => a.empresaId === selected.empresaId && a.tipo === selected.tipo) : [];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Análises</h2>
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="Em análise">Em análise</SelectItem>
            <SelectItem value="Em revisão">Em revisão</SelectItem>
            <SelectItem value="Aprovado">Aprovado</SelectItem>
            <SelectItem value="Reprovado">Reprovado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-32 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">Todos tipos</SelectItem>
            <SelectItem value="Crédito">Crédito</SelectItem>
            <SelectItem value="Ação">Ação</SelectItem>
          </SelectContent>
        </Select>
        <Select value={analistaFilter} onValueChange={setAnalistaFilter}>
          <SelectTrigger className="w-44 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Analista" /></SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">Todos analistas</SelectItem>
            {analistas.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-[11px] h-9">Empresa</TableHead>
                <TableHead className="text-[11px] h-9">Tipo</TableHead>
                <TableHead className="text-[11px] h-9">Analista</TableHead>
                <TableHead className="text-[11px] h-9">Início</TableHead>
                <TableHead className="text-[11px] h-9">Conclusão</TableHead>
                <TableHead className="text-[11px] h-9">Status</TableHead>
                <TableHead className="text-[11px] h-9">Decisão</TableHead>
                <TableHead className="text-[11px] h-9">Versão</TableHead>
                <TableHead className="text-[11px] h-9 w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(a => (
                <TableRow key={a.id} className="border-border">
                  <TableCell className="text-sm py-2 font-medium">{getEmpresaNome(a.empresaId)}</TableCell>
                  <TableCell className="text-sm py-2">{a.tipo}</TableCell>
                  <TableCell className="text-sm py-2">{getAnalistaNome(a.analistaResponsavel)}</TableCell>
                  <TableCell className="text-sm py-2 text-muted-foreground">{a.dataInicio}</TableCell>
                  <TableCell className="text-sm py-2 text-muted-foreground">{a.dataConclusao || '—'}</TableCell>
                  <TableCell className="py-2"><Badge variant="outline" className={`text-[10px] ${statusClass[a.status]}`}>{a.status}</Badge></TableCell>
                  <TableCell className="text-sm py-2">{a.decisao || '—'}</TableCell>
                  <TableCell className="text-sm py-2 text-muted-foreground">v{a.versao}</TableCell>
                  <TableCell className="py-2">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSelected(a)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl bg-card border-border max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{getEmpresaNome(selected.empresaId)} — Análise v{selected.versao}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground text-xs">Tipo:</span> <span>{selected.tipo}</span></div>
                  <div><span className="text-muted-foreground text-xs">Status:</span> <Badge variant="outline" className={`text-[10px] ml-1 ${statusClass[selected.status]}`}>{selected.status}</Badge></div>
                  <div><span className="text-muted-foreground text-xs">Analista Responsável:</span> <span>{getAnalistaNome(selected.analistaResponsavel)}</span></div>
                  <div><span className="text-muted-foreground text-xs">Analista Secundário:</span> <span>{getAnalistaNome(selected.analistaSecundario)}</span></div>
                  <div><span className="text-muted-foreground text-xs">Decisão:</span> <span>{selected.decisao || '—'}</span></div>
                  <div><span className="text-muted-foreground text-xs">Convicção:</span> <span>{selected.conviccao || '—'}</span></div>
                  {selected.aprovadoPor && <div><span className="text-muted-foreground text-xs">Aprovado por:</span> <span>{selected.aprovadoPor}</span></div>}
                  {selected.dataAprovacao && <div><span className="text-muted-foreground text-xs">Data aprovação:</span> <span>{selected.dataAprovacao}</span></div>}
                </div>
                <div><p className="text-xs text-muted-foreground mb-1">Riscos:</p><p className="text-sm bg-surface-1 p-2 rounded">{selected.riscos || '—'}</p></div>
                <div><p className="text-xs text-muted-foreground mb-1">Gatilhos:</p><p className="text-sm bg-surface-1 p-2 rounded">{selected.gatilhos || '—'}</p></div>
                <div><p className="text-xs text-muted-foreground mb-1">Justificativa:</p><p className="text-sm bg-surface-1 p-2 rounded">{selected.justificativa || '—'}</p></div>
                {versions.length > 1 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Histórico de versões:</p>
                    <div className="space-y-1">
                      {versions.map(v => (
                        <div key={v.id} className="flex items-center gap-3 text-xs p-2 bg-surface-1 rounded">
                          <span className="font-medium">v{v.versao}</span>
                          <Badge variant="outline" className={`text-[9px] ${statusClass[v.status]}`}>{v.status}</Badge>
                          <span className="text-muted-foreground">{v.dataInicio}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
