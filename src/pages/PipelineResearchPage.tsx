import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Plus, Search, CalendarIcon, Play, CheckCircle, X, RotateCcw, UserRoundCog, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { emissores, emissoes } from '@/data/emissores';
import { analistas as catalogoAnalistas } from '@/data/analistas';
import { users } from '@/data/users';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type AnaliseStatus = 'Pendente' | 'Em Análise' | 'Concluído' | 'Rejeitado';

const columns: { key: AnaliseStatus; label: string; color: string }[] = [
  { key: 'Pendente', label: 'Pendente', color: 'text-status-warning' },
  { key: 'Em Análise', label: 'Em Análise', color: 'text-status-info' },
  { key: 'Concluído', label: 'Concluído', color: 'text-status-success' },
  { key: 'Rejeitado', label: 'Rejeitado', color: 'text-status-danger' },
];

function getEmissorNome(cnpj: string) {
  return emissores.find(e => e.cnpj === cnpj)?.nomeAbreviado ?? cnpj;
}
function getEmissaoTicker(isin: string) {
  return emissoes.find(e => e.isin === isin)?.ticker ?? '';
}
function getAnalistaNome(id: string) {
  const a = catalogoAnalistas.find(a => a.id === id);
  if (a) return a.nome;
  return users.find(u => u.id === id)?.nome ?? id;
}
function getAnalistaInitials(id: string) {
  const nome = getAnalistaNome(id);
  return nome.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

const tipoAnaliseColors: Record<string, string> = {
  'Crédito Privado': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'Ações': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

function fmtDateBR(d: string | null | undefined): string {
  if (!d) return '—';
  const clean = d.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return clean;
}

export default function PipelineResearchPage() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [analistaFilter, setAnalistaFilter] = useState('all');
  const [prazoFilter, setPrazoFilter] = useState('all');
  const [novaModal, setNovaModal] = useState(false);
  const [drawerAnalise, setDrawerAnalise] = useState<any | null>(null);
  const [entregarModal, setEntregarModal] = useState<string | null>(null);
  const [relatorio, setRelatorio] = useState('');
  const [reatribuirModal, setReatribuirModal] = useState<string | null>(null);
  const [novoAnalista, setNovoAnalista] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Nova análise form
  const [novoEmissor, setNovoEmissor] = useState('');
  const [novoTipo, setNovoTipo] = useState('');
  const [novoAnalistaId, setNovoAnalistaId] = useState('');
  const [novoPrazo, setNovoPrazo] = useState<Date>();
  const [novoObs, setNovoObs] = useState('');

  const isGestor = currentUser.funcao === 'Gestor';
  const isRC = currentUser.funcao === 'Risco e Compliance';
  const isAnalista = currentUser.funcao === 'Analista';
  const canCreate = isGestor || isRC;

  const analistasAtivos = catalogoAnalistas.filter(a => a.ativo);
  const hoje = new Date().toISOString().split('T')[0];

  // ── Fetch analises from Supabase ──
  const { data: analises = [], isLoading } = useQuery({
    queryKey: ['pipeline-analises'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('analises')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // ── Fetch empresas with active positions ──
  const { data: empresasComPosicao = [] } = useQuery({
    queryKey: ['posicoes-empresas-ativas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posicoes')
        .select('product');
      if (error) throw error;
      // Return unique product identifiers
      return [...new Set((data || []).map(p => p.product))];
    },
  });

  // Check if an empresa_id (CNPJ) has active positions
  const temPosicaoAtiva = useCallback((cnpj: string) => {
    // Check if any emissor name or CNPJ matches products in posicoes
    const emissor = emissores.find(e => e.cnpj === cnpj);
    if (!emissor) return false;
    // Check by nomeAbreviado partial match or CNPJ in products
    return empresasComPosicao.some(product =>
      product.toLowerCase().includes(emissor.nomeAbreviado.toLowerCase().split(' ')[0].toLowerCase()) ||
      product.includes(cnpj)
    );
  }, [empresasComPosicao]);

  // ── Mutations ──
  const updateStatus = useMutation({
    mutationFn: async ({ id, status, extras }: { id: string; status: string; extras?: Record<string, any> }) => {
      const { error } = await supabase
        .from('analises')
        .update({ status, updated_at: new Date().toISOString(), ...extras })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipeline-analises'] }),
    onError: (err: any) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const createAnalise = useMutation({
    mutationFn: async (row: any) => {
      const { error } = await supabase.from('analises').insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-analises'] });
      queryClient.invalidateQueries({ queryKey: ['analises-ativas-count'] });
      toast({ title: 'Análise criada com sucesso' });
    },
    onError: (err: any) => toast({ title: 'Erro ao criar análise', description: err.message, variant: 'destructive' }),
  });

  // ── Filters ──
  const filtered = useMemo(() => {
    let items = [...analises];

    if (isAnalista) {
      items = items.filter(a => a.analista_responsavel === currentUser.id);
    }
    if (analistaFilter !== 'all') {
      items = items.filter(a => a.analista_responsavel === analistaFilter);
    }
    if (prazoFilter === 'vencido') {
      items = items.filter(a => a.prazo && a.prazo < hoje && (a.status === 'Pendente' || a.status === 'Em Análise'));
    } else if (prazoFilter === 'semana') {
      const end = new Date(); end.setDate(end.getDate() + 7);
      const endStr = format(end, 'yyyy-MM-dd');
      items = items.filter(a => a.prazo && a.prazo <= endStr && a.prazo >= hoje);
    } else if (prazoFilter === 'mes') {
      const end = new Date(); end.setDate(end.getDate() + 30);
      const endStr = format(end, 'yyyy-MM-dd');
      items = items.filter(a => a.prazo && a.prazo <= endStr && a.prazo >= hoje);
    }

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(a =>
        getEmissorNome(a.empresa_id).toLowerCase().includes(q) ||
        (a.isin && a.isin.toLowerCase().includes(q))
      );
    }

    return items;
  }, [analises, isAnalista, currentUser.id, analistaFilter, prazoFilter, search, hoje]);

  // ── Handlers ──
  const handleCriar = () => {
    if (!novoEmissor || !novoAnalistaId || !novoPrazo || !novoTipo) return;
    createAnalise.mutate({
      empresa_id: novoEmissor,
      analista_responsavel: novoAnalistaId,
      solicitante_id: currentUser.id,
      tipo: novoTipo,
      status: 'Pendente',
      data_inicio: format(new Date(), 'yyyy-MM-dd'),
      prazo: format(novoPrazo, 'yyyy-MM-dd'),
      observacoes: novoObs,
      isin: '',
    });
    setNovaModal(false);
    setNovoEmissor(''); setNovoTipo(''); setNovoAnalistaId(''); setNovoPrazo(undefined); setNovoObs('');
  };

  const handleEntregar = () => {
    if (!entregarModal || !relatorio.trim()) return;
    updateStatus.mutate({
      id: entregarModal,
      status: 'Concluído',
      extras: { relatorio, data_conclusao: new Date().toISOString().split('T')[0] },
    });
    setEntregarModal(null);
    setRelatorio('');
    setDrawerAnalise(null);
  };

  const handleReatribuir = () => {
    if (!reatribuirModal || !novoAnalista) return;
    updateStatus.mutate({
      id: reatribuirModal,
      status: analises.find(a => a.id === reatribuirModal)?.status || 'Pendente',
      extras: { analista_responsavel: novoAnalista },
    });
    setReatribuirModal(null);
    setNovoAnalista('');
  };

  // ── Drag & Drop ──
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetStatus: AnaliseStatus) => {
    e.preventDefault();
    if (!draggedId) return;
    const item = analises.find(a => a.id === draggedId);
    if (!item || item.status === targetStatus) {
      setDraggedId(null);
      return;
    }

    // Validate: if dropping to Concluído, require relatorio
    if (targetStatus === 'Concluído') {
      setEntregarModal(draggedId);
      setDraggedId(null);
      return;
    }

    const extras: Record<string, any> = {};
    if (targetStatus === 'Em Análise') {
      extras.data_inicio = new Date().toISOString().split('T')[0];
    }
    if (targetStatus === 'Rejeitado') {
      extras.data_conclusao = new Date().toISOString().split('T')[0];
    }

    updateStatus.mutate({ id: draggedId, status: targetStatus, extras });
    setDraggedId(null);
  };

  // History for drawer
  const historico = drawerAnalise
    ? analises.filter(a => a.empresa_id === drawerAnalise.empresa_id && a.id !== drawerAnalise.id && (a.status === 'Concluído' || a.status === 'Rejeitado'))
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
          <Input placeholder="Buscar emissor ou ISIN..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm bg-surface-1 border-border" />
        </div>
        {!isAnalista && (
          <Select value={analistaFilter} onValueChange={setAnalistaFilter}>
            <SelectTrigger className="w-48 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Analista" /></SelectTrigger>
            <SelectContent className="bg-card border-border max-h-60">
              <SelectItem value="all">Todos os analistas</SelectItem>
              {analistasAtivos.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
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
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Carregando pipeline...</span>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {columns.map(col => {
            const items = filtered.filter(a => a.status === col.key);
            return (
              <div
                key={col.key}
                className="space-y-3"
                onDragOver={handleDragOver}
                onDrop={e => handleDrop(e, col.key)}
              >
                <div className="flex items-center gap-2">
                  <h3 className={`text-sm font-semibold ${col.color}`}>{col.label}</h3>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">{items.length}</Badge>
                </div>
                <div className={cn(
                  "space-y-2 min-h-[100px] rounded-md p-1 transition-colors",
                  draggedId && "border-2 border-dashed border-primary/30 bg-primary/5"
                )}>
                  {items.map(item => {
                    const prazoVencido = item.prazo && item.prazo < hoje && (item.status === 'Pendente' || item.status === 'Em Análise');
                    const posAtiva = temPosicaoAtiva(item.empresa_id);
                    const isMyAnalise = item.analista_responsavel === currentUser.id;

                    return (
                      <Card
                        key={item.id}
                        draggable
                        onDragStart={e => handleDragStart(e, item.id)}
                        className={cn(
                          'bg-card border-border cursor-grab hover:border-primary/40 transition-colors active:cursor-grabbing',
                          prazoVencido && 'border-status-danger/60',
                          draggedId === item.id && 'opacity-40'
                        )}
                        onClick={() => setDrawerAnalise(item)}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-sm font-medium text-foreground truncate">{getEmissorNome(item.empresa_id)}</p>
                          </div>
                          {/* Tipo badge */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {item.tipo && (
                              <Badge variant="outline" className={`text-[9px] ${tipoAnaliseColors[item.tipo] || 'bg-muted/30 text-muted-foreground'}`}>
                                {item.tipo}
                              </Badge>
                            )}
                            {posAtiva && (
                              <Badge variant="outline" className="text-[9px] bg-orange-500/15 text-orange-400 border-orange-500/30">
                                ⚠️ Posição Ativa
                              </Badge>
                            )}
                          </div>
                          {item.isin && (
                            <div className="text-[11px] text-muted-foreground font-mono">{item.isin}</div>
                          )}
                          <div className="flex items-center gap-2">
                            <div className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[9px] font-bold shrink-0">
                              {getAnalistaInitials(item.analista_responsavel)}
                            </div>
                            <span className="text-[11px] text-muted-foreground truncate">{getAnalistaNome(item.analista_responsavel)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] ${prazoVencido ? 'text-status-danger font-semibold' : 'text-muted-foreground'}`}>
                              {item.prazo ? `Prazo: ${fmtDateBR(item.prazo)}` : ''}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{fmtDateBR(item.created_at)}</span>
                          </div>

                          {/* Quick actions */}
                          <div className="flex gap-1 pt-1" onClick={e => e.stopPropagation()}>
                            {isAnalista && isMyAnalise && item.status === 'Pendente' && (
                              <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2" onClick={() => updateStatus.mutate({ id: item.id, status: 'Em Análise', extras: { data_inicio: new Date().toISOString().split('T')[0] } })}>
                                <Play className="h-2.5 w-2.5" /> Iniciar
                              </Button>
                            )}
                            {isAnalista && isMyAnalise && item.status === 'Em Análise' && (
                              <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2" onClick={() => setEntregarModal(item.id)}>
                                <CheckCircle className="h-2.5 w-2.5" /> Entregar
                              </Button>
                            )}
                            {isGestor && (item.status === 'Pendente' || item.status === 'Em Análise') && (
                              <>
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2" onClick={() => updateStatus.mutate({ id: item.id, status: 'Rejeitado', extras: { data_conclusao: new Date().toISOString().split('T')[0] } })}>
                                  <X className="h-2.5 w-2.5" /> Rejeitar
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2" onClick={() => { setReatribuirModal(item.id); setNovoAnalista(item.analista_responsavel); }}>
                                  <UserRoundCog className="h-2.5 w-2.5" />
                                </Button>
                              </>
                            )}
                            {isGestor && (item.status === 'Rejeitado' || item.status === 'Concluído') && (
                              <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2" onClick={() => updateStatus.mutate({ id: item.id, status: 'Pendente' })}>
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
      )}

      {/* Drawer */}
      <Sheet open={!!drawerAnalise} onOpenChange={() => setDrawerAnalise(null)}>
        <SheetContent className="bg-card border-border w-[420px] sm:w-[420px]">
          {drawerAnalise && (
            <ScrollArea className="h-full pr-4">
              <SheetHeader>
                <SheetTitle className="text-foreground">{getEmissorNome(drawerAnalise.empresa_id)}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  {drawerAnalise.isin && (
                    <div><p className="text-[10px] text-muted-foreground uppercase">ISIN</p><p className="text-xs font-mono">{drawerAnalise.isin}</p></div>
                  )}
                  <div><p className="text-[10px] text-muted-foreground uppercase">Tipo</p>
                    <Badge variant="outline" className={`text-[10px] mt-0.5 ${tipoAnaliseColors[drawerAnalise.tipo] || ''}`}>{drawerAnalise.tipo}</Badge>
                  </div>
                  <div><p className="text-[10px] text-muted-foreground uppercase">Status</p>
                    <Badge variant="outline" className="text-[10px] mt-0.5">{drawerAnalise.status}</Badge>
                  </div>
                  <div><p className="text-[10px] text-muted-foreground uppercase">Prazo</p><p className={`text-xs ${drawerAnalise.prazo && drawerAnalise.prazo < hoje && (drawerAnalise.status === 'Pendente' || drawerAnalise.status === 'Em Análise') ? 'text-status-danger font-semibold' : ''}`}>{fmtDateBR(drawerAnalise.prazo)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase">Analista</p><p className="text-xs">{getAnalistaNome(drawerAnalise.analista_responsavel)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase">Solicitante</p><p className="text-xs">{drawerAnalise.solicitante_id ? (users.find(u => u.id === drawerAnalise.solicitante_id)?.nome || drawerAnalise.solicitante_id) : '—'}</p></div>
                </div>

                {drawerAnalise.observacoes && (
                  <div><p className="text-[10px] text-muted-foreground uppercase">Observações</p><p className="text-xs mt-1">{drawerAnalise.observacoes}</p></div>
                )}

                {drawerAnalise.relatorio && (
                  <div><p className="text-[10px] text-muted-foreground uppercase">Relatório</p><p className="text-xs mt-1 whitespace-pre-wrap">{drawerAnalise.relatorio}</p></div>
                )}

                {temPosicaoAtiva(drawerAnalise.empresa_id) && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-orange-500/10 border border-orange-500/30">
                    <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0" />
                    <span className="text-xs text-orange-400">Este emissor possui posição ativa na carteira</span>
                  </div>
                )}

                {/* Drawer actions */}
                <div className="flex gap-2 flex-wrap">
                  {isAnalista && drawerAnalise.analista_responsavel === currentUser.id && drawerAnalise.status === 'Pendente' && (
                    <Button size="sm" className="gap-1 text-xs" onClick={() => { updateStatus.mutate({ id: drawerAnalise.id, status: 'Em Análise', extras: { data_inicio: new Date().toISOString().split('T')[0] } }); setDrawerAnalise(null); }}>
                      <Play className="h-3 w-3" /> Iniciar Análise
                    </Button>
                  )}
                  {isAnalista && drawerAnalise.analista_responsavel === currentUser.id && drawerAnalise.status === 'Em Análise' && (
                    <Button size="sm" className="gap-1 text-xs" onClick={() => setEntregarModal(drawerAnalise.id)}>
                      <CheckCircle className="h-3 w-3" /> Entregar Análise
                    </Button>
                  )}
                  {isGestor && (drawerAnalise.status === 'Pendente' || drawerAnalise.status === 'Em Análise') && (
                    <Button size="sm" variant="destructive" className="gap-1 text-xs" onClick={() => { updateStatus.mutate({ id: drawerAnalise.id, status: 'Rejeitado', extras: { data_conclusao: new Date().toISOString().split('T')[0] } }); setDrawerAnalise(null); }}>
                      <X className="h-3 w-3" /> Rejeitar
                    </Button>
                  )}
                  {isGestor && (drawerAnalise.status === 'Rejeitado' || drawerAnalise.status === 'Concluído') && (
                    <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => { updateStatus.mutate({ id: drawerAnalise.id, status: 'Pendente' }); setDrawerAnalise(null); }}>
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
                        <Badge variant="outline" className="text-[9px]">{h.status}</Badge>
                      </div>
                      <p className="text-[11px]">Analista: {getAnalistaNome(h.analista_responsavel)}</p>
                      {h.relatorio && <p className="text-[11px] text-muted-foreground">{String(h.relatorio).slice(0, 200)}{String(h.relatorio).length > 200 ? '...' : ''}</p>}
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
          <DialogHeader>
            <DialogTitle>Nova Análise</DialogTitle>
            <DialogDescription>Preencha os campos para solicitar uma nova análise de crédito ou ações.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Empresa / Emissor</Label>
              <Select value={novoEmissor} onValueChange={setNovoEmissor}>
                <SelectTrigger className="mt-1 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Selecionar empresa" /></SelectTrigger>
                <SelectContent className="bg-card border-border max-h-60">
                  {emissores.filter(e => e.tipo !== 'Título Público').map(e => (
                    <SelectItem key={e.cnpj} value={e.cnpj}>{e.nomeAbreviado}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo de Análise</Label>
              <Select value={novoTipo} onValueChange={setNovoTipo}>
                <SelectTrigger className="mt-1 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Selecionar tipo" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="Crédito Privado">Crédito Privado</SelectItem>
                  <SelectItem value="Ações">Ações</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Analista Responsável</Label>
              <Select value={novoAnalistaId} onValueChange={setNovoAnalistaId}>
                <SelectTrigger className="mt-1 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Selecionar analista" /></SelectTrigger>
                <SelectContent className="bg-card border-border max-h-60">
                  {analistasAtivos.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
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
            <Button size="sm" className="w-full" onClick={handleCriar} disabled={!novoEmissor || !novoAnalistaId || !novoPrazo || !novoTipo || createAnalise.isPending}>
              {createAnalise.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Criar Análise
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Entregar Modal */}
      <Dialog open={!!entregarModal} onOpenChange={() => setEntregarModal(null)}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Entregar Análise</DialogTitle>
            <DialogDescription>O relatório é obrigatório para concluir a análise.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Relatório (obrigatório)</Label>
              <Textarea value={relatorio} onChange={e => setRelatorio(e.target.value)} rows={6} className="mt-1 text-sm bg-surface-1 border-border" placeholder="Descreva os resultados..." />
            </div>
            <Button size="sm" className="w-full" onClick={handleEntregar} disabled={!relatorio.trim() || updateStatus.isPending}>
              {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Entregar Análise
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reatribuir Modal */}
      <Dialog open={!!reatribuirModal} onOpenChange={() => setReatribuirModal(null)}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle>Reatribuir Analista</DialogTitle>
            <DialogDescription>Selecione o novo analista responsável.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={novoAnalista} onValueChange={setNovoAnalista}>
              <SelectTrigger className="h-8 text-sm bg-surface-1 border-border"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border max-h-60">
                {analistasAtivos.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" className="w-full" onClick={handleReatribuir}>Confirmar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
