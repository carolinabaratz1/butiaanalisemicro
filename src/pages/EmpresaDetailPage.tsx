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
import { ArrowLeft, Plus, CalendarIcon, Play, CheckCircle, Loader2, ArrowRight, X, Calendar as CalendarIconSolid, UserRoundCog, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useAnaliseEmissao, type AnaliseStatus } from '@/contexts/AnaliseEmissaoContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { registrarEvento } from '@/services/pipelineEventos';
import { RatingBadge } from '@/components/ratings/RatingBadge';
import { useResolvedRating } from '@/lib/ratings/useResolvedRating';
import { IssuerRatingHistoryDialog } from '@/components/ratings/IssuerRatingHistoryDialog';
import { History } from 'lucide-react';

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

  const queryClient = useQueryClient();
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
  const [novoFidcClasse, setNovoFidcClasse] = useState<string>('');
  const [novoFidcTipo, setNovoFidcTipo] = useState<string>('');
  const [ratingHistOpen, setRatingHistOpen] = useState(false);


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
      const { data, error } = await (supabase as any).rpc('get_active_analysts');
      if (error) throw error;
      return (data as Array<{ id: string; nome: string; funcao: string; status: string }>) || [];
    },
  });
  const isGestor = currentUser?.funcao === 'Gestor';
  const isRC = currentUser?.funcao === 'Risco e Compliance';
  const isAnalista = currentUser?.funcao === 'Analista';
  const canSolicitar = isGestor || isRC;

  // ── Fetch análises from DB for this empresa ──
  const { data: historicoPorCnpj = [] } = useQuery({
    queryKey: ['analises-historico', decodedCnpj],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('analises')
        .select('*')
        .eq('empresa_id', decodedCnpj)
        .order('versao', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // ── Fetch pipeline events for this empresa's analyses ──
  const analiseIds = historicoPorCnpj.map(a => a.id);
  const { data: pipelineEventos = [] } = useQuery({
    queryKey: ['pipeline-eventos', decodedCnpj, analiseIds],
    queryFn: async () => {
      if (analiseIds.length === 0) return [];
      const { data, error } = await supabase
        .from('pipeline_eventos' as any)
        .select('*')
        .in('analise_id', analiseIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: analiseIds.length > 0,
  });

  // ── Fetch profiles for name resolution ──
  const { data: profilesPublic = [] } = useQuery({
    queryKey: ['profiles-public-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles_public')
        .select('id, nome');
      if (error) throw error;
      return data || [];
    },
  });

  function getProfileNome(userId: string | null) {
    if (!userId) return 'Sistema';
    const p = profilesPublic.find((pr: any) => pr.id === userId);
    return p?.nome ?? userId;
  }

  function fmtDateTimeBR(d: string | null): string {
    if (!d) return '—';
    const dt = new Date(d);
    return `${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }

  const acaoConfig: Record<string, { icon: React.ReactNode; label: string }> = {
    criada: { icon: <Plus className="h-3.5 w-3.5 text-primary" />, label: 'Análise criada' },
    etapa_alterada: { icon: <ArrowRight className="h-3.5 w-3.5 text-primary" />, label: 'Etapa alterada' },
    concluida: { icon: <CheckCircle className="h-3.5 w-3.5 text-status-success" />, label: 'Análise concluída' },
    aprovado: { icon: <CheckCircle className="h-3.5 w-3.5 text-status-success" />, label: 'Aprovada' },
    reprovado: { icon: <X className="h-3.5 w-3.5 text-status-danger" />, label: 'Reprovada' },
    devolvida: { icon: <RotateCcw className="h-3.5 w-3.5 text-status-warning" />, label: 'Devolvida ao solicitante' },
    enviado_comite: { icon: <CalendarIconSolid className="h-3.5 w-3.5 text-primary" />, label: 'Enviada para Comitê' },
    data_comite_definida: { icon: <CalendarIconSolid className="h-3.5 w-3.5 text-primary" />, label: 'Data de comitê definida' },
    analista_atribuido: { icon: <UserRoundCog className="h-3.5 w-3.5 text-primary" />, label: 'Analista reatribuído' },
    reaberta: { icon: <RotateCcw className="h-3.5 w-3.5 text-primary" />, label: 'Análise reaberta' },
  };

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
        <Link to="/emissores" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
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

  const handleSolicitar = async () => {
    if (!solicitarModal || !analistaSel || !prazoDate) return;

    // Análise unificada por empresa (tipo Ações/Crédito é definido na conclusão pelo analista)
    // Calcula próxima versão (MAX+1) por empresa
    const { data: maxRows } = await supabase
      .from('analises')
      .select('versao')
      .eq('empresa_id', decodedCnpj)
      .order('versao', { ascending: false })
      .limit(1);
    const novaVersao = ((maxRows?.[0]?.versao) ?? 0) + 1;

    const { data: inserted, error } = await supabase.from('analises').insert({
      empresa_id: decodedCnpj,
      tipo: 'Geral',
      isin: solicitarModal,
      analista_responsavel: analistaSel,
      solicitante_id: currentUser?.id || '',
      status: 'Pendente',
      data_inicio: new Date().toISOString().split('T')[0],
      prazo: format(prazoDate, 'yyyy-MM-dd'),
      observacoes,
      versao: novaVersao,
    }).select('id').single();

    if (error) {
      toast({ title: 'Erro ao solicitar análise', description: error.message, variant: 'destructive' });
      return;
    }

    if (inserted?.id) {
      registrarEvento({ analise_id: inserted.id, acao: 'criada', etapa_nova: 'Pendente', comentario: `v${novaVersao} (solicitada via empresa)` });
    }

    queryClient.invalidateQueries({ queryKey: ['pipeline-analises'] });
    queryClient.invalidateQueries({ queryKey: ['analises-ativas-count'] });
    queryClient.invalidateQueries({ queryKey: ['empresa-analises', decodedCnpj] });

    toast({ title: 'Análise solicitada', description: `v${novaVersao} criada no pipeline.` });
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

  const isFidc = ((emissor?.tipo || '').toUpperCase() === 'FIDC');
  const canEditEmissao = isGestor || currentUser?.funcao === 'Coordenação/Especialista' || isAnalista;

  const handleNovaEmissao = async () => {
    if (!novoIsin || !novoTicker || !novoValDate) return;
    if (isFidc && (!novoFidcClasse || !novoFidcTipo)) {
      toast({ title: 'Campos obrigatórios', description: 'Para FIDC informe Classe e Tipo.', variant: 'destructive' });
      return;
    }
    const payload: any = {
      isin: novoIsin,
      ticker: novoTicker,
      val_date: format(novoValDate, 'yyyy-MM-dd'),
      cnpj_emissor: decodedCnpj,
    };
    if (isFidc) {
      payload.fidc_classe = novoFidcClasse;
      payload.fidc_tipo = novoFidcTipo;
    }
    const { error } = await supabase.from('emissoes').upsert(payload, { onConflict: 'isin' });
    if (error) {
      toast({ title: 'Erro ao salvar emissão', description: error.message, variant: 'destructive' });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['emissoes-by-cnpj', decodedCnpj] });
    setNovaEmissaoModal(false);
    setNovoIsin(''); setNovoTicker(''); setNovoValDate(undefined);
    setNovoFidcClasse(''); setNovoFidcTipo('');
  };

  const updateFidcField = async (isin: string, field: 'fidc_classe' | 'fidc_tipo', value: string) => {
    const { error } = await supabase.from('emissoes').update({ [field]: value } as any).eq('isin', isin);
    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['emissoes-by-cnpj', decodedCnpj] });
    queryClient.invalidateQueries({ queryKey: ['alocacao'] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/emissores" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
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
          <EmpresaRatingCell cnpj={emissor.cnpj} onOpenHistory={() => setRatingHistOpen(true)} />
          <div><p className="text-[10px] text-muted-foreground uppercase">Tipo</p><p className="text-sm font-medium">{emissor.tipo || '—'}</p></div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="emissoes">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="emissoes">Emissões ({emissoesList.length})</TabsTrigger>
          <TabsTrigger value="historico">Histórico de Análises ({historicoPorCnpj.length})</TabsTrigger>
          <TabsTrigger value="pipeline">Histórico de Pipeline ({pipelineEventos.length})</TabsTrigger>
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
                    {isFidc && <TableHead className="text-[11px] h-9">Tipo FIDC</TableHead>}
                    {isFidc && <TableHead className="text-[11px] h-9">Classe</TableHead>}
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
                        {isFidc && (
                          <TableCell className="py-2">
                            {canEditEmissao ? (
                              <Select value={(em as any).fidc_tipo ?? ''} onValueChange={(v) => updateFidcField(em.isin, 'fidc_tipo', v)}>
                                <SelectTrigger className="h-7 w-[150px] text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Padronizado">Padronizado</SelectItem>
                                  <SelectItem value="Não Padronizado">Não Padronizado</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : <span className="text-xs">{(em as any).fidc_tipo || '—'}</span>}
                          </TableCell>
                        )}
                        {isFidc && (
                          <TableCell className="py-2">
                            {canEditEmissao ? (
                              <Select value={(em as any).fidc_classe ?? ''} onValueChange={(v) => updateFidcField(em.isin, 'fidc_classe', v)}>
                                <SelectTrigger className="h-7 w-[120px] text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Sênior">Sênior</SelectItem>
                                  <SelectItem value="Mezanino">Mezanino</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : <span className="text-xs">{(em as any).fidc_classe || '—'}</span>}
                          </TableCell>
                        )}
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
                    <TableRow><TableCell colSpan={isFidc ? 9 : 7} className="text-center text-sm text-muted-foreground py-8">Nenhuma emissão vinculada a este emissor</TableCell></TableRow>
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
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-[11px] h-9">Versão</TableHead>
                    <TableHead className="text-[11px] h-9">Tipo</TableHead>
                    <TableHead className="text-[11px] h-9">Data Início</TableHead>
                    <TableHead className="text-[11px] h-9">Data Conclusão</TableHead>
                    <TableHead className="text-[11px] h-9">Status</TableHead>
                    <TableHead className="text-[11px] h-9">Analista</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicoPorCnpj.map(h => {
                    const statusColor = h.status === 'Aprovada' ? 'bg-status-success/15 text-status-success border-status-success/30'
                      : h.status === 'Reprovada' ? 'bg-status-danger/15 text-status-danger border-status-danger/30'
                      : h.status === 'Concluída' ? 'bg-status-info/15 text-status-info border-status-info/30'
                      : h.status === 'Em Análise' ? 'bg-status-warning/15 text-status-warning border-status-warning/30'
                      : 'bg-muted/50 text-muted-foreground border-border';
                    const analistaNome = getUserNome(h.analista_responsavel, analistasUsuarios);
                    return (
                      <TableRow key={h.id} className="border-border">
                        <TableCell className="text-sm py-2 font-medium">v{h.versao || 1}</TableCell>
                        <TableCell className="text-sm py-2 text-muted-foreground">{h.tipo}</TableCell>
                        <TableCell className="text-sm py-2 text-muted-foreground">{h.data_inicio || '—'}</TableCell>
                        <TableCell className="text-sm py-2 text-muted-foreground">{h.data_conclusao || '—'}</TableCell>
                        <TableCell className="py-2">
                          <Badge variant="outline" className={`text-[10px] ${statusColor}`}>
                            {h.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm py-2">{analistaNome}</TableCell>
                      </TableRow>
                    );
                  })}
                  {historicoPorCnpj.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Nenhuma análise histórica para este emissor</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Histórico de Pipeline */}
        <TabsContent value="pipeline">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              {pipelineEventos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum evento registrado para este emissor.</p>
              ) : (
                <div className="relative pl-6 space-y-4">
                  <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
                  {pipelineEventos.map((ev: any) => {
                    const cfg = acaoConfig[ev.acao] || { icon: <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />, label: ev.acao };
                    const userName = getProfileNome(ev.user_id);
                    let descricao = cfg.label;
                    if (ev.acao === 'etapa_alterada' && ev.etapa_anterior && ev.etapa_nova) {
                      descricao = `Movido de ${ev.etapa_anterior} → ${ev.etapa_nova}`;
                    } else if (ev.acao === 'analista_atribuido' && ev.comentario) {
                      descricao = `Analista reatribuído para ${ev.comentario}`;
                    } else if (ev.acao === 'reaberta' && ev.comentario) {
                      descricao = `Análise reaberta (${ev.comentario})`;
                    }

                    return (
                      <div key={ev.id} className="relative flex gap-3">
                        <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-card border-2 border-border flex items-center justify-center">
                          {cfg.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground">{descricao}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-muted-foreground">por {userName}</span>
                            <span className="text-[11px] text-muted-foreground">• {fmtDateTimeBR(ev.created_at)}</span>
                          </div>
                          {ev.comentario && ev.acao !== 'analista_atribuido' && ev.acao !== 'reaberta' && (
                            <p className="text-xs text-muted-foreground mt-1 bg-surface-1 p-2 rounded border border-border">
                              {ev.comentario}
                            </p>
                          )}
                          {ev.data_comite && (
                            <Badge variant="outline" className="text-[10px] mt-1 bg-primary/10 text-primary border-primary/30">
                              📅 Comitê: {new Date(ev.data_comite).toLocaleDateString('pt-BR')}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
            {isFidc && (
              <>
                <div>
                  <Label className="text-xs">Tipo FIDC <span className="text-status-danger">*</span></Label>
                  <Select value={novoFidcTipo} onValueChange={setNovoFidcTipo}>
                    <SelectTrigger className="mt-1 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Padronizado">Padronizado</SelectItem>
                      <SelectItem value="Não Padronizado">Não Padronizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Classe <span className="text-status-danger">*</span></Label>
                  <Select value={novoFidcClasse} onValueChange={setNovoFidcClasse}>
                    <SelectTrigger className="mt-1 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sênior">Sênior</SelectItem>
                      <SelectItem value="Mezanino">Mezanino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <Button size="sm" className="w-full" onClick={handleNovaEmissao} disabled={!novoIsin || !novoTicker || !novoValDate || (isFidc && (!novoFidcClasse || !novoFidcTipo))}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
      <IssuerRatingHistoryDialog
        open={ratingHistOpen}
        onOpenChange={setRatingHistOpen}
        cnpj={emissor.cnpj}
        emissorNome={emissor.nome}
      />
    </div>
  );
}

function EmpresaRatingCell({ cnpj, onOpenHistory }: { cnpj: string; onOpenHistory: () => void }) {
  const { data, isLoading } = useResolvedRating(cnpj);
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase">Rating</p>
      <div className="flex items-center gap-2 mt-0.5">
        <RatingBadge
          loading={isLoading}
          rating={data?.rating}
          source={data?.source}
          agencia={data?.agencia}
          data={data?.data_rating}
        />
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onOpenHistory} title="Histórico de rating">
          <History className="h-3 w-3 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}

