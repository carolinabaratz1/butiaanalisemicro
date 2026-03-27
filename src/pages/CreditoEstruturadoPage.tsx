import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import {
  instrumentosEstruturados, monitoramentosFIDC, monitoramentosCRICRA,
  originacoes, eventosEstruturados, ratingsEstruturados, ratingsExternosEstruturados,
  getAnalistaNome, type InstrumentoEstruturado
} from '@/data/mockData';

const statusClass: Record<string, string> = {
  'OK': 'bg-status-success/15 text-status-success border-status-success/30',
  'Em monitoramento': 'bg-status-warning/15 text-status-warning border-status-warning/30',
  'Quebrado': 'bg-status-danger/15 text-status-danger border-status-danger/30',
};

const impactoClass: Record<string, string> = {
  'Positivo': 'text-status-success',
  'Neutro': 'text-status-info',
  'Negativo': 'text-status-danger',
  'A avaliar': 'text-status-warning',
};

export default function CreditoEstruturadoPage() {
  const [tipoFilter, setTipoFilter] = useState('all');
  const [selected, setSelected] = useState<InstrumentoEstruturado | null>(null);
  const [detailTab, setDetailTab] = useState('cadastro');

  const filtered = instrumentosEstruturados.filter(i => tipoFilter === 'all' || i.tipo === tipoFilter);

  const getMonitoramentos = (id: string, tipo: string) => {
    if (tipo === 'FIDC') return monitoramentosFIDC.filter(m => m.instrumentoId === id);
    return monitoramentosCRICRA.filter(m => m.instrumentoId === id);
  };

  const getOriginacao = (id: string) => originacoes.find(o => o.instrumentoId === id);
  const getEventos = (id: string) => eventosEstruturados.filter(e => e.instrumentoId === id);
  const getRatings = (id: string) => ratingsEstruturados.filter(r => r.instrumentoId === id);
  const getRatingsExt = (id: string) => ratingsExternosEstruturados.filter(r => r.instrumentoId === id);

  // Alert check
  const hasAlert = (inst: InstrumentoEstruturado) => {
    if (inst.tipo === 'FIDC') {
      const mons = monitoramentosFIDC.filter(m => m.instrumentoId === inst.id);
      const latest = mons[mons.length - 1];
      if (!latest) return false;
      return latest.inadimplencia90d > 5 || (inst.cotas && latest.indiceSubordinacao < (inst.cotas[0]?.subordinacaoMinima || 0));
    }
    const mons = monitoramentosCRICRA.filter(m => m.instrumentoId === inst.id);
    const latest = mons[mons.length - 1];
    if (!latest) return false;
    return !latest.pagamentosEmDia || (latest.ltvAtual && latest.ltvAtual > 80) || latest.statusCovenants === 'Quebrado';
  };

  const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Crédito Estruturado</h2>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-32 h-8 text-sm bg-surface-1 border-border"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="FIDC">FIDC</SelectItem>
            <SelectItem value="CRI">CRI</SelectItem>
            <SelectItem value="CRA">CRA</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-[11px] h-9">Nome</TableHead>
                <TableHead className="text-[11px] h-9">Tipo</TableHead>
                <TableHead className="text-[11px] h-9">Emissor</TableHead>
                <TableHead className="text-[11px] h-9">Volume</TableHead>
                <TableHead className="text-[11px] h-9">Indexador</TableHead>
                <TableHead className="text-[11px] h-9">Spread</TableHead>
                <TableHead className="text-[11px] h-9">Analista</TableHead>
                <TableHead className="text-[11px] h-9">Status</TableHead>
                <TableHead className="text-[11px] h-9 w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(inst => {
                const alert = hasAlert(inst);
                const mons = inst.tipo === 'FIDC'
                  ? monitoramentosFIDC.filter(m => m.instrumentoId === inst.id)
                  : monitoramentosCRICRA.filter(m => m.instrumentoId === inst.id);
                const latestStatus = inst.tipo === 'FIDC'
                  ? (mons.length > 0 ? (mons[mons.length - 1] as any).statusCovenants : 'OK')
                  : (mons.length > 0 ? (mons[mons.length - 1] as any).statusCovenants : 'OK');
                return (
                  <TableRow key={inst.id} className={`border-border ${alert ? 'bg-status-danger/5' : ''}`}>
                    <TableCell className="text-sm py-2 font-medium">{inst.nome}</TableCell>
                    <TableCell className="text-sm py-2"><Badge variant="outline" className="text-[10px]">{inst.tipo}</Badge></TableCell>
                    <TableCell className="text-sm py-2">{inst.emissor}</TableCell>
                    <TableCell className="text-sm py-2 font-mono text-xs">{fmtBRL(inst.volumeTotal)}</TableCell>
                    <TableCell className="text-sm py-2">{inst.indexador}</TableCell>
                    <TableCell className="text-sm py-2">{inst.spread}%</TableCell>
                    <TableCell className="text-sm py-2">{getAnalistaNome(inst.analistaResponsavel)}</TableCell>
                    <TableCell className="py-2">
                      <Badge variant="outline" className={`text-[10px] ${statusClass[latestStatus] || ''}`}>{latestStatus}</Badge>
                      {alert && <Badge variant="outline" className="text-[9px] ml-1 bg-status-danger/15 text-status-danger border-status-danger/30">Alerta</Badge>}
                    </TableCell>
                    <TableCell className="py-2">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setSelected(inst); setDetailTab('cadastro'); }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-4xl bg-card border-border max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.nome}</DialogTitle>
              </DialogHeader>
              <Tabs value={detailTab} onValueChange={setDetailTab}>
                <TabsList className="bg-surface-1 border border-border">
                  <TabsTrigger value="cadastro" className="text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Cadastro</TabsTrigger>
                  <TabsTrigger value="originacao" className="text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Originação</TabsTrigger>
                  <TabsTrigger value="monitoramento" className="text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Monitoramento</TabsTrigger>
                  <TabsTrigger value="eventos" className="text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Eventos</TabsTrigger>
                  <TabsTrigger value="ratings" className="text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Ratings</TabsTrigger>
                </TabsList>

                <TabsContent value="cadastro" className="space-y-3 mt-4">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div><span className="text-xs text-muted-foreground">Tipo:</span> <span>{selected.tipo}</span></div>
                    <div><span className="text-xs text-muted-foreground">CETIP:</span> <span className="font-mono">{selected.codigoCetip}</span></div>
                    <div><span className="text-xs text-muted-foreground">ISIN:</span> <span className="font-mono">{selected.isin}</span></div>
                    <div><span className="text-xs text-muted-foreground">Emissor:</span> <span>{selected.emissor}</span></div>
                    <div><span className="text-xs text-muted-foreground">Administrador:</span> <span>{selected.administrador}</span></div>
                    <div><span className="text-xs text-muted-foreground">Custodiante:</span> <span>{selected.custodiante}</span></div>
                    <div><span className="text-xs text-muted-foreground">Cedentes:</span> <span>{selected.cedentes.join(', ')}</span></div>
                    <div><span className="text-xs text-muted-foreground">Emissão:</span> <span>{selected.dataEmissao}</span></div>
                    <div><span className="text-xs text-muted-foreground">Vencimento:</span> <span>{selected.dataVencimento}</span></div>
                    <div><span className="text-xs text-muted-foreground">Volume:</span> <span className="font-mono">{fmtBRL(selected.volumeTotal)}</span></div>
                    <div><span className="text-xs text-muted-foreground">Indexador:</span> <span>{selected.indexador} + {selected.spread}%</span></div>
                    <div><span className="text-xs text-muted-foreground">Setor:</span> <span>{selected.setorSubjacente}</span></div>
                  </div>
                  {/* Type-specific fields */}
                  {selected.tipo === 'FIDC' && selected.cotas && (
                    <div className="mt-4">
                      <p className="text-xs text-muted-foreground mb-2">Estrutura de Cotas:</p>
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border">
                            <TableHead className="text-[11px] h-8">Classe</TableHead>
                            <TableHead className="text-[11px] h-8">Volume</TableHead>
                            <TableHead className="text-[11px] h-8">% PL</TableHead>
                            <TableHead className="text-[11px] h-8">Taxa Alvo</TableHead>
                            <TableHead className="text-[11px] h-8">Sub. Mín.</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selected.cotas.map((c, i) => (
                            <TableRow key={i} className="border-border">
                              <TableCell className="text-sm py-1.5">{c.classe}</TableCell>
                              <TableCell className="text-sm py-1.5 font-mono text-xs">{fmtBRL(c.volume)}</TableCell>
                              <TableCell className="text-sm py-1.5">{c.pctPL}%</TableCell>
                              <TableCell className="text-sm py-1.5">{c.taxaAlvo}%</TableCell>
                              <TableCell className="text-sm py-1.5">{c.subordinacaoMinima}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                        <div><span className="text-xs text-muted-foreground">Tipo carteira:</span> {selected.tipoCarteira}</div>
                        <div><span className="text-xs text-muted-foreground">Ativo cedido:</span> {selected.tipoAtivoCedido}</div>
                        <div><span className="text-xs text-muted-foreground">Conc. máx cedente:</span> {selected.concentracaoMaxCedente}%</div>
                      </div>
                    </div>
                  )}
                  {selected.tipo === 'CRI' && (
                    <div className="grid grid-cols-2 gap-3 text-sm mt-3">
                      <div><span className="text-xs text-muted-foreground">Lastro:</span> {selected.tipoLastro}</div>
                      <div><span className="text-xs text-muted-foreground">Devedor:</span> {selected.devedorPrincipal}</div>
                      <div><span className="text-xs text-muted-foreground">Regime fiduciário:</span> {selected.regimeFiduciario ? 'Sim' : 'Não'}</div>
                      <div><span className="text-xs text-muted-foreground">LTV inicial:</span> {selected.ltvInicial}%</div>
                      <div><span className="text-xs text-muted-foreground">Garantias:</span> {selected.garantiasCRI}</div>
                    </div>
                  )}
                  {selected.tipo === 'CRA' && (
                    <div className="grid grid-cols-2 gap-3 text-sm mt-3">
                      <div><span className="text-xs text-muted-foreground">Produto agrícola:</span> {selected.produtoAgricola}</div>
                      <div><span className="text-xs text-muted-foreground">Devedor:</span> {selected.devedorPrincipal}</div>
                      <div><span className="text-xs text-muted-foreground">CPR vinculada:</span> {selected.cprVinculada ? 'Sim' : 'Não'}</div>
                      <div><span className="text-xs text-muted-foreground">Garantias:</span> {selected.garantiasCRA}</div>
                      <div><span className="text-xs text-muted-foreground">Sazonalidade:</span> {selected.sazonalidadeRisco}</div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="originacao" className="mt-4">
                  {(() => {
                    const orig = getOriginacao(selected.id);
                    if (!orig) return <p className="text-sm text-muted-foreground">Sem análise de originação</p>;
                    const origStatusClass: Record<string, string> = {
                      'Em análise': 'bg-status-info/15 text-status-info',
                      'Aprovado': 'bg-status-success/15 text-status-success',
                      'Reprovado': 'bg-status-danger/15 text-status-danger',
                      'Em revisão': 'bg-status-warning/15 text-status-warning',
                    };
                    return (
                      <div className="space-y-3 text-sm">
                        <div className="grid grid-cols-3 gap-3">
                          <div><span className="text-xs text-muted-foreground">Status:</span> <Badge variant="outline" className={`text-[10px] ml-1 ${origStatusClass[orig.status]}`}>{orig.status}</Badge></div>
                          <div><span className="text-xs text-muted-foreground">Decisão:</span> {orig.decisao || '—'}</div>
                          <div><span className="text-xs text-muted-foreground">Convicção:</span> {orig.conviccao || '—'}</div>
                          <div><span className="text-xs text-muted-foreground">Aprovador:</span> {orig.aprovador || '—'}</div>
                          <div><span className="text-xs text-muted-foreground">Data aprovação:</span> {orig.dataAprovacao || '—'}</div>
                          <div><span className="text-xs text-muted-foreground">Versão:</span> v{orig.versao}</div>
                        </div>
                        <div><p className="text-xs text-muted-foreground mb-1">Tese:</p><p className="bg-surface-1 p-2 rounded text-sm">{orig.tese}</p></div>
                        <div><p className="text-xs text-muted-foreground mb-1">Riscos:</p><p className="bg-surface-1 p-2 rounded text-sm">{orig.riscos}</p></div>
                        <div><p className="text-xs text-muted-foreground mb-1">Gatilhos:</p><p className="bg-surface-1 p-2 rounded text-sm">{orig.gatilhos}</p></div>
                      </div>
                    );
                  })()}
                </TabsContent>

                <TabsContent value="monitoramento" className="mt-4">
                  {selected.tipo === 'FIDC' ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="text-[11px] h-8">Data</TableHead>
                          <TableHead className="text-[11px] h-8">PL</TableHead>
                          <TableHead className="text-[11px] h-8">Inad. 30d</TableHead>
                          <TableHead className="text-[11px] h-8">Inad. 90d</TableHead>
                          <TableHead className="text-[11px] h-8">PDD</TableHead>
                          <TableHead className="text-[11px] h-8">Subordinação</TableHead>
                          <TableHead className="text-[11px] h-8">Covenants</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monitoramentosFIDC.filter(m => m.instrumentoId === selected.id).map(m => (
                          <TableRow key={m.id} className="border-border">
                            <TableCell className="text-sm py-1.5">{m.dataReferencia}</TableCell>
                            <TableCell className="text-sm py-1.5 font-mono text-xs">{fmtBRL(m.plFundo)}</TableCell>
                            <TableCell className="text-sm py-1.5">{m.inadimplencia30d}%</TableCell>
                            <TableCell className={`text-sm py-1.5 ${m.inadimplencia90d > 5 ? 'text-status-danger font-bold' : ''}`}>{m.inadimplencia90d}%</TableCell>
                            <TableCell className="text-sm py-1.5">{m.pddConstituida}%</TableCell>
                            <TableCell className="text-sm py-1.5">{m.indiceSubordinacao}%</TableCell>
                            <TableCell className="py-1.5"><Badge variant="outline" className={`text-[10px] ${statusClass[m.statusCovenants]}`}>{m.statusCovenants}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="text-[11px] h-8">Data</TableHead>
                          <TableHead className="text-[11px] h-8">Saldo Devedor</TableHead>
                          <TableHead className="text-[11px] h-8">Pgto em dia</TableHead>
                          {selected.tipo === 'CRI' && <TableHead className="text-[11px] h-8">LTV</TableHead>}
                          <TableHead className="text-[11px] h-8">Garantias</TableHead>
                          <TableHead className="text-[11px] h-8">Covenants</TableHead>
                          <TableHead className="text-[11px] h-8">Comentário</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monitoramentosCRICRA.filter(m => m.instrumentoId === selected.id).map(m => (
                          <TableRow key={m.id} className="border-border">
                            <TableCell className="text-sm py-1.5">{m.dataReferencia}</TableCell>
                            <TableCell className="text-sm py-1.5 font-mono text-xs">{fmtBRL(m.saldoDevedor)}</TableCell>
                            <TableCell className="py-1.5">
                              <Badge variant="outline" className={`text-[10px] ${m.pagamentosEmDia ? 'text-status-success' : 'text-status-danger'}`}>{m.pagamentosEmDia ? 'Sim' : 'Não'}</Badge>
                            </TableCell>
                            {selected.tipo === 'CRI' && <TableCell className={`text-sm py-1.5 ${(m.ltvAtual || 0) > 80 ? 'text-status-danger font-bold' : ''}`}>{m.ltvAtual ? `${m.ltvAtual}%` : '—'}</TableCell>}
                            <TableCell className="text-sm py-1.5">{m.statusGarantias}</TableCell>
                            <TableCell className="py-1.5"><Badge variant="outline" className={`text-[10px] ${statusClass[m.statusCovenants]}`}>{m.statusCovenants}</Badge></TableCell>
                            <TableCell className="text-sm py-1.5 text-muted-foreground max-w-[200px] truncate">{m.comentario}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                <TabsContent value="eventos" className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-[11px] h-8">Tipo</TableHead>
                        <TableHead className="text-[11px] h-8">Data</TableHead>
                        <TableHead className="text-[11px] h-8">Participação</TableHead>
                        <TableHead className="text-[11px] h-8">Voto</TableHead>
                        <TableHead className="text-[11px] h-8">Impacto</TableHead>
                        <TableHead className="text-[11px] h-8">Decisão</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getEventos(selected.id).map(e => (
                        <TableRow key={e.id} className="border-border">
                          <TableCell className="text-sm py-1.5">{e.tipo}</TableCell>
                          <TableCell className="text-sm py-1.5 text-muted-foreground">{e.data}</TableCell>
                          <TableCell className="py-1.5">
                            <Badge variant="outline" className={`text-[10px] ${e.participacao ? 'text-status-success' : 'text-muted-foreground'}`}>{e.participacao ? 'Sim' : 'Não'}</Badge>
                          </TableCell>
                          <TableCell className="text-sm py-1.5">{e.voto || '—'}</TableCell>
                          <TableCell className={`text-sm py-1.5 ${impactoClass[e.impacto || ''] || ''}`}>{e.impacto || '—'}</TableCell>
                          <TableCell className="text-sm py-1.5 text-muted-foreground">{e.decisao}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="ratings" className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2 font-semibold">Ratings Internos</p>
                    {(() => {
                      const ratings = getRatings(selected.id);
                      if (!ratings.length) return <p className="text-sm text-muted-foreground">Sem ratings internos</p>;
                      return (
                        <>
                          <div className="flex items-center gap-1 mb-3">
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
                            <TableHeader><TableRow className="border-border"><TableHead className="text-[11px] h-8">Rating</TableHead><TableHead className="text-[11px] h-8">Data</TableHead><TableHead className="text-[11px] h-8">Analista</TableHead><TableHead className="text-[11px] h-8">Comentário</TableHead></TableRow></TableHeader>
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
                        </>
                      );
                    })()}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2 font-semibold">Ratings Externos</p>
                    {(() => {
                      const ext = getRatingsExt(selected.id);
                      if (!ext.length) return <p className="text-sm text-muted-foreground">Sem ratings externos</p>;
                      return (
                        <Table>
                          <TableHeader><TableRow className="border-border"><TableHead className="text-[11px] h-8">Agência</TableHead><TableHead className="text-[11px] h-8">Rating</TableHead><TableHead className="text-[11px] h-8">Data</TableHead><TableHead className="text-[11px] h-8">Perspectiva</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {ext.map(r => (
                              <TableRow key={r.id} className="border-border">
                                <TableCell className="text-sm py-1.5">{r.agencia}</TableCell>
                                <TableCell className="text-sm py-1.5 font-mono font-bold">{r.rating}</TableCell>
                                <TableCell className="text-sm py-1.5 text-muted-foreground">{r.data}</TableCell>
                                <TableCell className="text-sm py-1.5">{r.perspectiva}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      );
                    })()}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
