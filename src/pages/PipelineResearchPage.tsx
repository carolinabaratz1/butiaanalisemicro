import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Plus, Search, CalendarIcon, Play, CheckCircle, X, RotateCcw, UserRoundCog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { emissores, emissoes } from '@/data/emissores';
import { users } from '@/data/users';
import { useAuth } from '@/contexts/AuthContext';
import { useAnaliseEmissao, type AnaliseEmissao, type AnaliseStatus } from '@/contexts/AnaliseEmissaoContext';

const columns: { key: AnaliseStatus; label: string; color: string }[] = [
  { key: 'pendente', label: 'Pendente', color: 'text-status-warning' },
  { key: 'em_analise', label: 'Em Análise', color: 'text-status-info' },
  { key: 'concluido', label: 'Concluído', color: 'text-status-success' },
  { key: 'rejeitado', label: 'Rejeitado', color: 'text-status-danger' },
];

function getEmissorNome(cnpj: string) {
  return emissores.find(e => e.cnpj === cnpj)?.nomeAbreviado ?? cnpj;
}
function getEmissorTipo(cnpj: string) {
  return emissores.find(e => e.cnpj === cnpj)?.tipo ?? '';
}
function getEmissaoTicker(isin: string) {
  return emissoes.find(e => e.isin === isin)?.ticker ?? '';
}
function getUserNome(id: string) {
  return users.find(u => u.id === id)?.nome ?? 'N/A';
}
function getUserInitials(id: string) {
  const nome = users.find(u => u.id === id)?.nome ?? '';
  return nome.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

const tipoChipClass: Record<string, string> = {
  FIDC: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  CORPORATIVO: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  FINANCEIRO: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  CRA: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  CDB: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  Fundo: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
};

export default function PipelineResearchPage() {
  const { currentUser } = useAuth();
  const {
    analises, criarAnalise, iniciarAnalise, concluirAnalise,
    rejeitarAnalise, reabrirAnalise, reatribuirAnalista,
  } = useAnaliseEmissao();

  const [search, setSearch] = useState('');
  const [analistaFilter, setAnalistaFilter] = useState('all');
  const [prazoFilter, setPrazoFilter] = useState('all');
  const [novaModal, setNovaModal] = useState(false);
  const [drawerAnalise, setDrawerAnalise] = useState<AnaliseEmissao | null>(null);
  const [entregarModal, setEntregarModal] = useState<string | null>(null);
  const [relatorio, setRelatorio] = useState('');
  const [reatribuirModal, setReatribuirModal] = useState<string | null>(null);
  const [novoAnalista, setNovoAnalista] = useState('');

  // Nova análise form
  const [novoEmissor, setNovoEmissor] = useState('');
  const [novoIsin, setNovoIsin] = useState('');
  const [novoAnalistaId, setNovoAnalistaId] = useState('');
  const [novoPrazo, setNovoPrazo] = useState<Date>();
  const [novoObs, setNovoObs] = useState('');

  const isGestor = currentUser.funcao === 'Gestor';
  const isRC = currentUser.funcao === 'Risco e Compliance';
  const isAnalista = currentUser.funcao === 'Analista';
  const isConsulta = currentUser.funcao === 'Consulta';
  const canCreate = isGestor || isRC;

  const analistas = users.filter(u => u.funcao === 'Analista' && u.status === 'Ativo');
  const hoje = new Date().toISOString().split('T')[0];

  const filtered = useMemo(() => {
    let items = [...analises];

    // Analista sees only own
    if (isAnalista) {
      items = items.filter(a => a.analista_id === currentUser.id);
    }

    if (analistaFilter !== 'all') {
      items = items.filter(a => a.analista_id === analistaFilter);
    }

    if (prazoFilter === 'vencido') {
      items = items.filter(a => a.prazo < hoje && (a.status === 'pendente' || a.status === 'em_analise'));
    } else if (prazoFilter === 'semana') {
      const end = new Date(); end.setDate(end.getDate() + 7);
      items = items.filter(a => a.prazo <= format(end, 'yyyy-MM-dd') && a.prazo >= hoje);
    } else if (prazoFilter === 'mes') {
      const end = new Date(); end.setDate(end.getDate() + 30);
      items = items.filter(a => a.prazo <= format(end, 'yyyy-MM-dd') && a.prazo >= hoje);
    }

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(a =>
        getEmissorNome(a.cnpj_emissor).toLowerCase().includes(q) ||
        a.isin.toLowerCase().includes(q) ||
        getEmissaoTicker(a.isin).toLowerCase().includes(q)
      );
    }

    return items;
  }, [analises, isAnalista, currentUser.id, analistaFilter, prazoFilter, search, hoje]);

  const emissoesFiltradas = useMemo(() => {
    if (!novoEmissor) return [];
    return emissoes.filter(e => e.cnpjEmissor === novoEmissor);
  }, [novoEmissor]);

  const handleCriar = () => {
    if (!novoIsin || !novoAnalistaId || !novoPrazo || !novoEmissor) return;
    criarAnalise({
      isin: novoIsin,
      cnpj_emissor: novoEmissor,
      analista_id: novoAnalistaId,
      solicitante_id: currentUser.id,
      status: 'pendente',
      prazo: format(novoPrazo, 'yyyy-MM-dd'),
      observacoes: novoObs,
      data_solicitacao: new Date().toISOString(),
    });
    setNovaModal(false);
    setNovoEmissor(''); setNovoIsin(''); setNovoAnalistaId(''); setNovoPrazo(undefined); setNovoObs('');
  };

  const handleEntregar = () => {
    if (!entregarModal || !relatorio.trim()) return;
    concluirAnalise(entregarModal, relatorio);
    setEntregarModal(null);
    setRelatorio('');
    setDrawerAnalise(null);
  };

  const handleReatribuir = () => {
    if (!reatribuirModal || !novoAnalista) return;
    reatribuirAnalista(reatribuirModal, novoAnalista);
    setReatribuirModal(null);
    setNovoAnalista('');
  };

  // History for drawer
  const historico = drawerAnalise
    ? analises.filter(a => a.cnpj_emissor === drawerAnalise.cnpj_emissor && a.id !== drawerAnalise.id && (a.status === 'concluido' || a.status === 'rejeitado'))
        .sort((a, b) => (b.data_conclusao || '').localeCompare(a.data_conclusao || ''))
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Pipeline de Research</h2>
        {canCreate && (
          <Button size="sm" className="gap-1.5" onClick={() => setNovaModal(true)}>
            <Plus className="h-3.5 w-3.5" /> Nova Análise
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar emissor, ISIN ou ticker..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm bg-surface-1 border-border" />
        </div>
        {!isAnalista && (
          <Select value={analistaFilter} onValueChange={setAnalistaFilter}>
            <SelectTrigger className="w-48 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Analista" /></SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">Todos os analistas</SelectItem>
              {analistas.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={prazoFilter} onValueChange={setPrazoFilter}>
          <SelectTrigger className="w-36 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Prazo" /></SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="vencido">Vencido</SelectItem>
            <SelectItem value="semana">Esta semana</SelectItem>
            <SelectItem value="mes">Este mês</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-4 gap-4">
        {columns.map(col => {
          const items = filtered.filter(a => a.status === col.key);
          return (
            <div key={col.key} className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className={`text-sm font-semibold ${col.color}`}>{col.label}</h3>
                <Badge variant="outline" className="text-[10px] text-muted-foreground">{items.length}</Badge>
              </div>
              <div className="space-y-2 min-h-[100px]">
                {items.map(item => {
                  const prazoVencido = item.prazo < hoje && (item.status === 'pendente' || item.status === 'em_analise');
                  const tipo = getEmissorTipo(item.cnpj_emissor);
                  const isMyAnalise = item.analista_id === currentUser.id;

                  return (
                    <Card
                      key={item.id}
                      className={cn('bg-card border-border cursor-pointer hover:border-primary/40 transition-colors', prazoVencido && 'border-status-danger/60')}
                      onClick={() => setDrawerAnalise(item)}
                    >
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-sm font-medium text-foreground truncate">{getEmissorNome(item.cnpj_emissor)}</p>
                          {tipo && <Badge variant="outline" className={`text-[8px] shrink-0 ${tipoChipClass[tipo] || ''}`}>{tipo}</Badge>}
                        </div>
                        <div className="text-[11px] text-muted-foreground space-y-0.5">
                          <p className="font-mono">{item.isin}</p>
                          {getEmissaoTicker(item.isin) && <p>Ticker: {getEmissaoTicker(item.isin)}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[9px] font-bold shrink-0">
                            {getUserInitials(item.analista_id)}
                          </div>
                          <span className="text-[11px] text-muted-foreground truncate">{getUserNome(item.analista_id)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] ${prazoVencido ? 'text-status-danger font-semibold' : 'text-muted-foreground'}`}>
                            Prazo: {item.prazo}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{item.data_solicitacao.split('T')[0]}</span>
                        </div>

                        {/* Quick actions */}
                        <div className="flex gap-1 pt-1" onClick={e => e.stopPropagation()}>
                          {isAnalista && isMyAnalise && item.status === 'pendente' && (
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2" onClick={() => iniciarAnalise(item.id)}>
                              <Play className="h-2.5 w-2.5" /> Iniciar
                            </Button>
                          )}
                          {isAnalista && isMyAnalise && item.status === 'em_analise' && (
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2" onClick={() => { setEntregarModal(item.id); }}>
                              <CheckCircle className="h-2.5 w-2.5" /> Entregar
                            </Button>
                          )}
                          {isGestor && (item.status === 'pendente' || item.status === 'em_analise') && (
                            <>
                              <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2" onClick={() => rejeitarAnalise(item.id)}>
                                <X className="h-2.5 w-2.5" /> Rejeitar
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2" onClick={() => { setReatribuirModal(item.id); setNovoAnalista(item.analista_id); }}>
                                <UserRoundCog className="h-2.5 w-2.5" />
                              </Button>
                            </>
                          )}
                          {isGestor && (item.status === 'rejeitado' || item.status === 'concluido') && (
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2" onClick={() => reabrirAnalise(item.id)}>
                              <RotateCcw className="h-2.5 w-2.5" /> Reabrir
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {items.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-8 border border-dashed border-border rounded-md">Nenhum item</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Drawer */}
      <Sheet open={!!drawerAnalise} onOpenChange={() => setDrawerAnalise(null)}>
        <SheetContent className="bg-card border-border w-[420px] sm:w-[420px]">
          {drawerAnalise && (
            <ScrollArea className="h-full pr-4">
              <SheetHeader>
                <SheetTitle className="text-foreground">{getEmissorNome(drawerAnalise.cnpj_emissor)}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-[10px] text-muted-foreground uppercase">ISIN</p><p className="text-xs font-mono">{drawerAnalise.isin}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase">Ticker</p><p className="text-xs">{getEmissaoTicker(drawerAnalise.isin) || '—'}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase">Status</p>
                    <Badge variant="outline" className="text-[10px] mt-0.5">
                      {drawerAnalise.status === 'pendente' ? 'Pendente' : drawerAnalise.status === 'em_analise' ? 'Em Análise' : drawerAnalise.status === 'concluido' ? 'Concluído' : 'Rejeitado'}
                    </Badge>
                  </div>
                  <div><p className="text-[10px] text-muted-foreground uppercase">Prazo</p><p className={`text-xs ${drawerAnalise.prazo < hoje && (drawerAnalise.status === 'pendente' || drawerAnalise.status === 'em_analise') ? 'text-status-danger font-semibold' : ''}`}>{drawerAnalise.prazo}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase">Analista</p><p className="text-xs">{getUserNome(drawerAnalise.analista_id)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase">Solicitante</p><p className="text-xs">{getUserNome(drawerAnalise.solicitante_id)}</p></div>
                </div>

                {drawerAnalise.observacoes && (
                  <div><p className="text-[10px] text-muted-foreground uppercase">Observações</p><p className="text-xs mt-1">{drawerAnalise.observacoes}</p></div>
                )}

                {drawerAnalise.relatorio && (
                  <div><p className="text-[10px] text-muted-foreground uppercase">Relatório</p><p className="text-xs mt-1 whitespace-pre-wrap">{drawerAnalise.relatorio}</p></div>
                )}

                {/* Drawer actions */}
                <div className="flex gap-2 flex-wrap">
                  {isAnalista && drawerAnalise.analista_id === currentUser.id && drawerAnalise.status === 'pendente' && (
                    <Button size="sm" className="gap-1 text-xs" onClick={() => { iniciarAnalise(drawerAnalise.id); setDrawerAnalise({ ...drawerAnalise, status: 'em_analise' }); }}>
                      <Play className="h-3 w-3" /> Iniciar Análise
                    </Button>
                  )}
                  {isAnalista && drawerAnalise.analista_id === currentUser.id && drawerAnalise.status === 'em_analise' && (
                    <Button size="sm" className="gap-1 text-xs" onClick={() => setEntregarModal(drawerAnalise.id)}>
                      <CheckCircle className="h-3 w-3" /> Entregar Análise
                    </Button>
                  )}
                  {isGestor && (drawerAnalise.status === 'pendente' || drawerAnalise.status === 'em_analise') && (
                    <Button size="sm" variant="destructive" className="gap-1 text-xs" onClick={() => { rejeitarAnalise(drawerAnalise.id); setDrawerAnalise(null); }}>
                      <X className="h-3 w-3" /> Rejeitar
                    </Button>
                  )}
                  {isGestor && (drawerAnalise.status === 'rejeitado' || drawerAnalise.status === 'concluido') && (
                    <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => { reabrirAnalise(drawerAnalise.id); setDrawerAnalise(null); }}>
                      <RotateCcw className="h-3 w-3" /> Reabrir
                    </Button>
                  )}
                </div>

                <Separator className="bg-border" />

                {/* Histórico */}
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">Histórico deste emissor</p>
                  {historico.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma análise anterior.</p>}
                  {historico.map(h => (
                    <div key={h.id} className="p-2 rounded-md bg-surface-1 mb-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">{h.data_conclusao?.split('T')[0]}</span>
                        <Badge variant="outline" className="text-[9px]">{h.status === 'concluido' ? 'Concluído' : 'Rejeitado'}</Badge>
                      </div>
                      <p className="text-[11px]">Analista: {getUserNome(h.analista_id)}</p>
                      <p className="text-[11px] font-mono">{h.isin}</p>
                      {h.relatorio && <p className="text-[11px] text-muted-foreground">{h.relatorio.slice(0, 200)}{h.relatorio.length > 200 ? '...' : ''}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>

      {/* Nova Análise Modal */}
      <Dialog open={novaModal} onOpenChange={setNovaModal}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader><DialogTitle>Nova Análise</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Emissor</Label>
              <Select value={novoEmissor} onValueChange={v => { setNovoEmissor(v); setNovoIsin(''); }}>
                <SelectTrigger className="mt-1 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Selecionar emissor" /></SelectTrigger>
                <SelectContent className="bg-card border-border max-h-60">
                  {emissores.filter(e => e.tipo !== 'Título Público').slice(0, 50).map(e => (
                    <SelectItem key={e.cnpj} value={e.cnpj}>{e.nomeAbreviado} ({e.cnpj})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Emissão (ISIN)</Label>
              <Select value={novoIsin} onValueChange={setNovoIsin} disabled={!novoEmissor}>
                <SelectTrigger className="mt-1 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Selecionar emissão" /></SelectTrigger>
                <SelectContent className="bg-card border-border max-h-60">
                  {emissoesFiltradas.map(e => <SelectItem key={e.isin} value={e.isin}>{e.isin} {e.ticker ? `(${e.ticker})` : ''}</SelectItem>)}
                  {emissoesFiltradas.length === 0 && <p className="text-xs text-muted-foreground p-2">Nenhuma emissão encontrada</p>}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Analista</Label>
              <Select value={novoAnalistaId} onValueChange={setNovoAnalistaId}>
                <SelectTrigger className="mt-1 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Selecionar analista" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {analistas.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Prazo de Entrega</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("mt-1 w-full h-8 text-sm justify-start bg-surface-1 border-border", !novoPrazo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {novoPrazo ? format(novoPrazo, 'dd/MM/yyyy') : 'Selecionar data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={novoPrazo} onSelect={setNovoPrazo} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={novoObs} onChange={e => setNovoObs(e.target.value)} rows={3} className="mt-1 text-sm bg-surface-1 border-border" placeholder="Opcional..." />
            </div>
            <Button size="sm" className="w-full" onClick={handleCriar} disabled={!novoIsin || !novoAnalistaId || !novoPrazo}>Criar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Entregar Modal */}
      <Dialog open={!!entregarModal} onOpenChange={() => setEntregarModal(null)}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader><DialogTitle>Entregar Análise</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Relatório (obrigatório)</Label>
              <Textarea value={relatorio} onChange={e => setRelatorio(e.target.value)} rows={6} className="mt-1 text-sm bg-surface-1 border-border" placeholder="Descreva os resultados..." />
            </div>
            <Button size="sm" className="w-full" onClick={handleEntregar} disabled={!relatorio.trim()}>Entregar Análise</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reatribuir Modal */}
      <Dialog open={!!reatribuirModal} onOpenChange={() => setReatribuirModal(null)}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>Reatribuir Analista</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={novoAnalista} onValueChange={setNovoAnalista}>
              <SelectTrigger className="h-8 text-sm bg-surface-1 border-border"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                {analistas.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" className="w-full" onClick={handleReatribuir}>Confirmar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
