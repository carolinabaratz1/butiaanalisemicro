import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ratingsInternos, ratingsExternos, eventosCredito, empresas, getEmpresaNome, getAnalistaNome } from '@/data/mockData';

const perspClass: Record<string, string> = {
  'Positiva': 'text-status-success',
  'Estável': 'text-status-info',
  'Negativa': 'text-status-danger',
  'Em observação': 'text-status-warning',
};

export default function CreditoCorporativoPage() {
  // Only show ratings for companies (not instruments)
  const ri = ratingsInternos.filter(r => r.empresaId);
  const re = ratingsExternos.filter(r => r.empresaId);

  // Group ratings by empresa for timeline
  const empresasComRating = [...new Set(ri.map(r => r.empresaId))];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Crédito Corporativo</h2>
      <Tabs defaultValue="internos" className="space-y-4">
        <TabsList className="bg-surface-1 border border-border">
          <TabsTrigger value="internos" className="text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Ratings Internos</TabsTrigger>
          <TabsTrigger value="externos" className="text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Ratings Externos</TabsTrigger>
          <TabsTrigger value="eventos" className="text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Eventos de Crédito</TabsTrigger>
        </TabsList>

        <TabsContent value="internos" className="space-y-4">
          {empresasComRating.map(empId => {
            const ratings = ri.filter(r => r.empresaId === empId).sort((a, b) => a.data.localeCompare(b.data));
            return (
              <Card key={empId} className="bg-card border-border overflow-x-auto">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{getEmpresaNome(empId)}</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Timeline */}
                  <div className="flex items-center gap-1 mb-3 overflow-x-auto">
                    {ratings.map((r, i) => (
                      <div key={r.id} className="flex items-center">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-primary">{r.rating}</span>
                          </div>
                          <span className="text-[9px] text-muted-foreground mt-1">{r.data}</span>
                        </div>
                        {i < ratings.length - 1 && <div className="w-8 h-px bg-border mx-1" />}
                      </div>
                    ))}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-[11px] h-8">Rating</TableHead>
                        <TableHead className="text-[11px] h-8">Data</TableHead>
                        <TableHead className="text-[11px] h-8">Analista</TableHead>
                        <TableHead className="text-[11px] h-8">Comentário</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ratings.map(r => (
                        <TableRow key={r.id} className="border-border">
                          <TableCell className="text-sm py-1.5 font-mono font-bold">{r.rating}</TableCell>
                          <TableCell className="text-sm py-1.5 text-muted-foreground">{r.data}</TableCell>
                          <TableCell className="text-sm py-1.5">{getAnalistaNome(r.analista)}</TableCell>
                          <TableCell className="text-sm py-1.5 text-muted-foreground">{r.comentario}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="externos">
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-[11px] h-9">Empresa</TableHead>
                    <TableHead className="text-[11px] h-9">Agência</TableHead>
                    <TableHead className="text-[11px] h-9">Rating</TableHead>
                    <TableHead className="text-[11px] h-9">Data</TableHead>
                    <TableHead className="text-[11px] h-9">Perspectiva</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {re.map(r => (
                    <TableRow key={r.id} className="border-border">
                      <TableCell className="text-sm py-2 font-medium">{getEmpresaNome(r.empresaId)}</TableCell>
                      <TableCell className="text-sm py-2">{r.agencia}</TableCell>
                      <TableCell className="text-sm py-2 font-mono font-bold">{r.rating}</TableCell>
                      <TableCell className="text-sm py-2 text-muted-foreground">{r.data}</TableCell>
                      <TableCell className={`text-sm py-2 ${perspClass[r.perspectiva]}`}>{r.perspectiva}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="eventos">
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-[11px] h-9">Tipo</TableHead>
                    <TableHead className="text-[11px] h-9">Data</TableHead>
                    <TableHead className="text-[11px] h-9">Empresa</TableHead>
                    <TableHead className="text-[11px] h-9">Participação</TableHead>
                    <TableHead className="text-[11px] h-9">Representante</TableHead>
                    <TableHead className="text-[11px] h-9">Decisão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventosCredito.map(e => (
                    <TableRow key={e.id} className="border-border">
                      <TableCell className="text-sm py-2">{e.tipo}</TableCell>
                      <TableCell className="text-sm py-2 text-muted-foreground">{e.data}</TableCell>
                      <TableCell className="text-sm py-2 font-medium">{getEmpresaNome(e.empresaId)}</TableCell>
                      <TableCell className="text-sm py-2">
                        <Badge variant="outline" className={`text-[10px] ${e.participacao ? 'text-status-success border-status-success/30' : 'text-muted-foreground'}`}>
                          {e.participacao ? 'Sim' : 'Não'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm py-2">{e.representante || '—'}</TableCell>
                      <TableCell className="text-sm py-2 text-muted-foreground">{e.decisao}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
