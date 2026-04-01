import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Plus, CalendarIcon, Play, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useAnaliseEmissao, type AnaliseStatus } from '@/contexts/AnaliseEmissaoContext';
import { historicoAnalises } from '@/data/historicoAnalises';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const statusConfig: Record<AnaliseStatus | 'sem_analise', { label: string; className: string }> = {
  sem_analise: { label: 'Sem análise', className: 'bg-muted/50 text-muted-foreground border-border' },
  pendente: { label: 'Pendente', className: 'bg-status-warning/15 text-status-warning border-status-warning/30' },
  em_analise: { label: 'Em análise', className: 'bg-status-info/15 text-status-info border-status-info/30' },
  concluido: { label: 'Concluído', className: 'bg-status-success/15 text-status-success border-status-success/30' },
  rejeitado: { label: 'Rejeitado', className: 'bg-status-danger/15 text-status-danger border-status-danger/30' },
};

const resultadoConfig: Record<string, string> = {
  'Aprovada': 'bg-status-success/15 text-status-success border-status-success/30',
  'Rejeitada': 'bg-status-danger/15 text-status-danger border-status-danger/30',
  'Aprovada com Restrição': 'bg-status-warning/15 text-status-warning border-status-warning/30',
};

function getUserNome(id: string, profiles: { id: string; nome: string }[] = []) {
  const p = profiles.find(p => p.id === id || p.nome === id);
  return p?.nome ?? id;
}

export default function EmpresaDetailPage() {
  const { cnpj } = useParams<{ cnpj: string }>();
  const decodedCnpj = decodeURIComponent(cnpj || '');
  const { currentUser } = useAuth();
  const { analises, criarAnalise, iniciarAnalise, concluirAnalise, getAnalisesByIsin } = useAnaliseEmissao();

  const [solicitarModal, setSolicitarModal] = useState<string | null>(null);
  const [novaEmissaoModal, setNovaEmissaoModal] = useState(false);
  const [entregarModal, setEntregarModal] = useState<string | null>(null);
  const [relatorio, setRelatorio] = useState('');
  const [analistaSel, setAnalistaSel] = useState('');
  const [prazoDate, setPrazoDate] = useState<Date>();
  const [observacoes, setObservacoes] = useState('');
  const [novoIsin, setNovoIsin] = useState('');
  const [novoTicker, setNovoTicker] = useState('');
  const [novoValDate, setNovoValDate] = useState<Date>();

  // ── Fetch empresa from DB ──
  const { data: emissor, isLoading: loadingEmpresa } = useQuery({
    queryKey: ['empresa-detail', decodedCnpj],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .eq('cnpj', decodedCnpj)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // ── Fetch emissoes from DB ──
  const { data: emissoesList = [] } = useQuery({
    queryKey: ['emissoes-by-cnpj', decodedCnpj],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('emissoes')
        .select('*')
        .eq('cnpj_emissor', decodedCnpj);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: analistasUsuarios = [] } = useQuery({
    queryKey: ['profiles-analistas-ativos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome, email, funcao')
        .in('funcao', ['Analista', 'Coordenação/Especialista'])
        .eq('status', 'Ativo');
      if (error) throw error;
      return data || [];
    },
  });
  const isGestor = currentUser?.funcao === 'Gestor';
  const isRC = currentUser?.funcao === 'Risco e Compliance';
  const isAnalista = currentUser?.funcao === 'Analista';
  const canSolicitar = isGestor || isRC;

  // Histórico filtrado por CNPJ
  const historicoPorCnpj = historicoAnalises
    .filter(h => h.cnpj === decodedCnpj)
    .sort((a, b) => b.data.localeCompare(a.data));

  if (loadingEmpresa) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  if (!emissor) {
    return (
      <div className="space-y-4">
        <Link to="/empresas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <p className="text-muted-foreground">Emissor não encontrado.</p>
      </div>
    );
  }

  const getEmissaoStatus = (isin: string): AnaliseStatus | 'sem_analise' => {
    const ans = getAnalisesByIsin(isin);
    const active = ans.find(a => a.status === 'pendente' || a.status === 'em_analise');
    if (active) return active.status;
    const concluded = ans.find(a => a.status === 'concluido');
    if (concluded) return 'concluido';
    const rejected = ans.find(a => a.status === 'rejeitado');
    if (rejected) return 'rejeitado';
    return 'sem_analise';
  };

  const getActiveAnalise = (isin: string) => {
    return analises.find(a => a.isin === isin && (a.status === 'pendente' || a.status === 'em_analise'));
  };

  const handleSolicitar = () => {
    if (!solicitarModal || !analistaSel || !prazoDate) return;
    criarAnalise({
      isin: solicitarModal,
      cnpj_emissor: decodedCnpj,
      analista_id: analistaSel,
      solicitante_id: currentUser?.id || '',
      status: 'pendente',
      prazo: format(prazoDate, 'yyyy-MM-dd'),
      observacoes,
      data_solicitacao: new Date().toISOString(),
    });
    setSolicitarModal(null);
    setAnalistaSel('');
    setPrazoDate(undefined);
    setObservacoes('');
  };

  const handleEntregar = () => {
    if (!entregarModal || !relatorio.trim()) return;
    concluirAnalise(entregarModal, relatorio);
    setEntregarModal(null);
    setRelatorio('');
  };

  const handleNovaEmissao = async () => {
    if (!novoIsin || !novoTicker || !novoValDate) return;
    const { error } = await supabase.from('emissoes').upsert({
      isin: novoIsin,
      ticker: novoTicker,
      val_date: format(novoValDate, 'yyyy-MM-dd'),
      cnpj_emissor: decodedCnpj,
    }, { onConflict: 'isin' });
    if (!error) {
      // Refetch emissoes
      window.location.reload();
    }
    setNovaEmissaoModal(false);
    setNovoIsin('');
    setNovoTicker('');
    setNovoValDate(undefined);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/empresas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="text-lg font-semibold text-foreground">{emissor.nome}</h2>
          <p className="text-xs text-muted-foreground">{emissor.cnpj}</p>
        </div>
        <Badge variant="outline" className="ml-auto text-[10px]">{emissor.tipo || '—'}</Badge>
      </div>

      {/* Info card */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div><p className="text-[10px] text-muted-foreground uppercase">Setor</p><p className="text-sm font-medium">{emissor.setor || '—'}</p></div>
          <div><p className="text-[10px] text-muted-foreground uppercase">Grupo Econômico</p><p className="text-sm font-medium">{emissor.grupo_economico || '—'}</p></div>
          <div><p className="text-[10px] text-muted-foreground uppercase">Rating</p><p className="text-sm font-medium">{emissor.rating || '—'}</p></div>
          <div><p className="text-[10px] text-muted-foreground uppercase">Tipo</p><p className="text-sm font-medium">{emissor.tipo || '—'}</p></div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="emissoes">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="emissoes">Emissões ({emissoesList.length})</TabsTrigger>
          <TabsTrigger value="historico">Histórico de Análises ({historicoPorCnpj.length})</TabsTrigger>
        </TabsList>

        {/* Tab Emissões */}
        <TabsContent value="emissoes">
          <div className="flex items-center justify-end mb-2">
            {isGestor && (
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setNovaEmissaoModal(true)}>
                <Plus className="h-3 w-3" /> Nova Emissão
              </Button>
            )}
          </div>
          <Card className="bg-card border-border">
            <CardContent className="p-0 overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-[11px] h-9">ISIN</TableHead>
                    <TableHead className="text-[11px] h-9">Ticker</TableHead>
                    <TableHead className="text-[11px] h-9">Val Date</TableHead>
                    <TableHead className="text-[11px] h-9">Status Análise</TableHead>
                    <TableHead className="text-[11px] h-9">Analista</TableHead>
                    <TableHead className="text-[11px] h-9">Prazo</TableHead>
                    <TableHead className="text-[11px] h-9 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emissoesList.map(em => {
                    const status = getEmissaoStatus(em.isin);
                    const activeAnalise = getActiveAnalise(em.isin);
                    const cfg = statusConfig[status];
                    const isMyAnalise = activeAnalise?.analista_id === currentUser?.id;
                    const prazoVencido = activeAnalise && activeAnalise.prazo < new Date().toISOString().split('T')[0] && (activeAnalise.status === 'pendente' || activeAnalise.status === 'em_analise');

                    return (
                      <TableRow key={em.isin} className="border-border">
                        <TableCell className="text-xs py-2 font-mono">{em.isin}</TableCell>
                        <TableCell className="text-sm py-2">{em.ticker || '—'}</TableCell>
                        <TableCell className="text-sm py-2 text-muted-foreground">{em.val_date || '—'}</TableCell>
                        <TableCell className="py-2">
                          <Badge variant="outline" className={`text-[10px] ${cfg.className}`}>{cfg.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm py-2">{activeAnalise ? getUserNome(activeAnalise.analista_id) : '—'}</TableCell>
                        <TableCell className={`text-sm py-2 ${prazoVencido ? 'text-status-danger font-medium' : 'text-muted-foreground'}`}>
                          {activeAnalise?.prazo || '—'}
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          {canSolicitar && (status === 'sem_analise' || status === 'rejeitado') && (
                            <Button size="sm" variant="outline" className="text-[11px] h-7" onClick={() => setSolicitarModal(em.isin)}>
                              Solicitar Análise
                            </Button>
                          )}
                          {isAnalista && isMyAnalise && activeAnalise?.status === 'pendente' && (
                            <Button size="sm" variant="outline" className="text-[11px] h-7 gap-1" onClick={() => iniciarAnalise(activeAnalise.id)}>
                              <Play className="h-3 w-3" /> Iniciar
                            </Button>
                          )}
                          {isAnalista && isMyAnalise && activeAnalise?.status === 'em_analise' && (
                            <Button size="sm" variant="outline" className="text-[11px] h-7 gap-1" onClick={() => setEntregarModal(activeAnalise.id)}>
                              <CheckCircle className="h-3 w-3" /> Entregar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {emissoesList.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Nenhuma emissão vinculada a este emissor</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Histórico de Análises */}
        <TabsContent value="historico">
          <Card className="bg-card border-border">
            <CardContent className="p-0 overflow-x-auto">
              <Table className="min-w-[500px]">
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-[11px] h-9">Data</TableHead>
                    <TableHead className="text-[11px] h-9">Resultado</TableHead>
                    <TableHead className="text-[11px] h-9">Analista</TableHead>
                    <TableHead className="text-[11px] h-9">Status do Analista</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicoPorCnpj.map(h => {
                    const matchedProfile = analistasUsuarios.find(a => a.id === h.analista_id || a.nome === h.analista_nome);
                    const analistaAtivo = !!matchedProfile;
                    return (
                      <TableRow key={h.id} className="border-border">
                        <TableCell className="text-sm py-2 text-muted-foreground">{h.data}</TableCell>
                        <TableCell className="py-2">
                          <Badge variant="outline" className={`text-[10px] ${resultadoConfig[h.resultado] || ''}`}>
                            {h.resultado}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm py-2">{h.analista_nome}</TableCell>
                        <TableCell className="py-2">
                          <Badge variant="outline" className={`text-[10px] ${analistaAtivo ? 'text-status-success border-status-success/30 bg-status-success/10' : 'text-muted-foreground border-border bg-muted/30'}`}>
                            {analistaAtivo ? 'Ativo' : 'Ex-Analista'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {historicoPorCnpj.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">Nenhuma análise histórica para este emissor</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Solicitar Análise */}
      <Dialog open={!!solicitarModal} onOpenChange={() => setSolicitarModal(null)}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader><DialogTitle>Solicitar Análise</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground font-mono">{solicitarModal}</p>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Analista Responsável</Label>
              <Select value={analistaSel} onValueChange={setAnalistaSel}>
                <SelectTrigger className="mt-1 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Selecionar analista" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {analistasUsuarios.map(a => <SelectItem key={a.id} value={a.nome}>{a.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Prazo de Entrega</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("mt-1 w-full h-8 text-sm justify-start bg-surface-1 border-border", !prazoDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {prazoDate ? format(prazoDate, 'dd/MM/yyyy') : 'Selecionar data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={prazoDate} onSelect={setPrazoDate} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} className="mt-1 text-sm bg-surface-1 border-border" placeholder="Opcional..." />
            </div>
            <Button size="sm" className="w-full" onClick={handleSolicitar} disabled={!analistaSel || !prazoDate}>Confirmar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Entregar Análise */}
      <Dialog open={!!entregarModal} onOpenChange={() => setEntregarModal(null)}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader><DialogTitle>Entregar Análise</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Relatório (obrigatório)</Label>
              <Textarea value={relatorio} onChange={e => setRelatorio(e.target.value)} rows={6} className="mt-1 text-sm bg-surface-1 border-border" placeholder="Descreva os resultados da análise..." />
            </div>
            <Button size="sm" className="w-full" onClick={handleEntregar} disabled={!relatorio.trim()}>Entregar Análise</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Nova Emissão */}
      <Dialog open={novaEmissaoModal} onOpenChange={setNovaEmissaoModal}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader><DialogTitle>Nova Emissão</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">ISIN</Label><Input value={novoIsin} onChange={e => setNovoIsin(e.target.value)} className="mt-1 h-8 text-sm bg-surface-1 border-border" /></div>
            <div><Label className="text-xs">Ticker</Label><Input value={novoTicker} onChange={e => setNovoTicker(e.target.value)} className="mt-1 h-8 text-sm bg-surface-1 border-border" /></div>
            <div>
              <Label className="text-xs">Val Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("mt-1 w-full h-8 text-sm justify-start bg-surface-1 border-border", !novoValDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {novoValDate ? format(novoValDate, 'dd/MM/yyyy') : 'Selecionar data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={novoValDate} onSelect={setNovoValDate} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs">CNPJ do Emissor</Label>
              <Input value={decodedCnpj} disabled className="mt-1 h-8 text-sm bg-muted border-border" />
            </div>
            <Button size="sm" className="w-full" onClick={handleNovaEmissao} disabled={!novoIsin || !novoTicker || !novoValDate}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
