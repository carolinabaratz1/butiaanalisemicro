import { useState, useMemo, useCallback, useRef } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
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
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, CalendarIcon, Play, CheckCircle, X, RotateCcw, UserRoundCog, Loader2, AlertTriangle, ThumbsUp, ThumbsDown, ChevronDown, Trash2, MoreVertical, Check, ChevronsUpDown } from 'lucide-react';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from '@/components/ui/command';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { registrarEvento } from '@/services/pipelineEventos';

type AnaliseStatus = 'Pendente' | 'Em Análise' | 'Concluída' | 'Aprovada' | 'Reprovada' | 'Vencida c/ Alocação' | 'Vencida s/ Alocação';

const columns: { key: AnaliseStatus; label: string; color: string }[] = [
  { key: 'Pendente', label: 'Pendente', color: 'text-status-warning' },
  { key: 'Em Análise', label: 'Em Análise', color: 'text-status-info' },
  { key: 'Concluída', label: 'Concluída', color: 'text-muted-foreground' },
  { key: 'Aprovada', label: 'Aprovada', color: 'text-status-success' },
  { key: 'Reprovada', label: 'Reprovada', color: 'text-status-danger' },
  { key: 'Vencida c/ Alocação', label: 'Vencida c/ Alocação', color: 'text-red-400' },
  { key: 'Vencida s/ Alocação', label: 'Vencida s/ Alocação', color: 'text-orange-400' },
];

function getEmissorNome(cnpj: string, empresasMap: Map<string, string>) {
  return empresasMap.get(cnpj) ?? cnpj;
}
function getEmissaoTicker(isin: string, emissoesTickers: Map<string, string>) {
  return emissoesTickers.get(isin) ?? '';
}
function getAnalistaNome(id: string, profiles: { id: string; nome: string }[] = []) {
  const p = profiles.find(p => p.id === id || p.nome === id);
  if (p) return p.nome;
  return id;
}
function getAnalistaInitials(id: string, profiles: { id: string; nome: string }[] = []) {
  const nome = getAnalistaNome(id, profiles);
  return nome.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

const tipoAnaliseColors: Record<string, string> = {
  'Crédito Privado': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'Ações': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

const recomendacaoColors: Record<string, string> = {
  'Buy': 'bg-status-success/15 text-status-success border-status-success/30',
  'Hold': 'bg-status-warning/15 text-status-warning border-status-warning/30',
  'Sell': 'bg-status-danger/15 text-status-danger border-status-danger/30',
};

function fmtDateBR(d: string | null | undefined): string {
  if (!d) return '—';
  const clean = d.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return clean;
}

function isVencida(status: string, dataConclusao: string | null, tipoEmissor?: string | null): boolean {
  // FIDC analyses do not expire — they have continuous monitoring instead
  if (tipoEmissor === 'FIDC') return false;
  if (status !== 'Aprovada' || !dataConclusao) return false;
  const conclusao = new Date(dataConclusao.split('T')[0]);
  const umAnoAtras = new Date();
  umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);
  return conclusao < umAnoAtras;
}

function getDisplayStatus(status: string, dataConclusao: string | null, empresaId?: string, temPosicaoFn?: (cnpj: string) => boolean, tipoEmissor?: string | null): AnaliseStatus {
  if (isVencida(status, dataConclusao, tipoEmissor)) {
    if (empresaId && temPosicaoFn) {
      return temPosicaoFn(empresaId) ? 'Vencida c/ Alocação' : 'Vencida s/ Alocação';
    }
    return 'Vencida s/ Alocação';
  }
  return status as AnaliseStatus;
}

export default function PipelineResearchPage() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [search, setSearch] = useState('');
  const [analistaFilter, setAnalistaFilter] = useState('all');
  const [prazoFilter, setPrazoFilter] = useState('all');
  const [novaModal, setNovaModal] = useState(false);
  const [drawerAnalise, setDrawerAnalise] = useState<any | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
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

  // Entrega (conclusão) extra fields
  const [recomendacao, setRecomendacao] = useState('');
  const [precoMin, setPrecoMin] = useState('');
  const [precoMedio, setPrecoMedio] = useState('');
  const [precoMaximo, setPrecoMaximo] = useState('');
  const [dataAlvo, setDataAlvo] = useState<Date>();

  // Rejeição pelo analista (Em Análise → Pendente)
  const [rejeitarAnalistaModal, setRejeitarAnalistaModal] = useState<string | null>(null);
  const [justificativaRejeicao, setJustificativaRejeicao] = useState('');

  // Comitê modal (Aprovada / Reprovada)
  const [comiteModal, setComiteModal] = useState<{ id: string; targetStatus: 'Aprovada' | 'Reprovada' } | null>(null);
  const [dataComite, setDataComite] = useState<Date>();
  const [comentarioReprovacao, setComentarioReprovacao] = useState('');

  // Reabrir modal (com novo prazo)
  const [reabrirModal, setReabrirModal] = useState<any | null>(null);
  const [novoPrazoReabrir, setNovoPrazoReabrir] = useState<Date | undefined>();
  const [editarPrazoModal, setEditarPrazoModal] = useState<any | null>(null);
  const [novoPrazoEdicao, setNovoPrazoEdicao] = useState<Date | undefined>();

  const isGestor = currentUser?.funcao === 'Gestor';
  const isCoord = currentUser?.funcao === 'Coordenação/Especialista';
  const isRC = currentUser?.funcao === 'Risco e Compliance';
  const isAnalista = currentUser?.funcao === 'Analista';
  const canCreate = isGestor || isCoord || isRC;

  // ── Fetch active analysts/coordinators from profiles ──
  const { data: analistasAtivos = [] } = useQuery({
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

  // ── Fetch all profiles for name lookups (solicitante, etc.) ──
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['profiles-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome, email, funcao');
      if (error) throw error;
      return data || [];
    },
  });

  // ── Fetch empresas from DB for name resolution ──
  const { data: empresasDB = [] } = useQuery({
    queryKey: ['empresas-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select('id, nome, cnpj, tipo, setor, rating, grupo_economico');
      if (error) throw error;
      return data || [];
    },
  });

  const empresasMap = useMemo(() => new Map(empresasDB.map(e => [e.cnpj, e.nome])), [empresasDB]);
  const empresaTipoPorCnpj = useMemo(() => new Map(empresasDB.map(e => [e.cnpj, e.tipo])), [empresasDB]);
  const tipoEmissorDe = useCallback((cnpj: string) => empresaTipoPorCnpj.get(cnpj) ?? null, [empresaTipoPorCnpj]);

  // ── Fetch emissoes from DB for ticker resolution ──
  const { data: emissoesDB = [] } = useQuery({
    queryKey: ['emissoes-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('emissoes')
        .select('isin, ticker, cnpj_emissor');
      if (error) throw error;
      return data || [];
    },
  });

  const emissoesTickers = useMemo(() => new Map((emissoesDB || []).filter(e => e.ticker).map(e => [e.isin, e.ticker as string])), [emissoesDB]);

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

  // ── Fetch CNPJs with active positions via posicoes.isin → emissoes.cnpj_emissor ──
  const { data: cnpjsComPosicaoSet = new Set<string>() } = useQuery({
    queryKey: ['posicoes-cnpjs-ativos'],
    queryFn: async () => {
      // 1. Get distinct ISINs from posicoes
      const { data: posData, error: posErr } = await supabase
        .from('posicoes')
        .select('isin');
      if (posErr) throw posErr;
      const isinsAtivos = [...new Set((posData || []).filter(p => p.isin).map(p => p.isin as string))];
      if (isinsAtivos.length === 0) return new Set<string>();

      // 2. Find corresponding cnpj_emissor from emissoes
      const { data: emData, error: emErr } = await supabase
        .from('emissoes')
        .select('cnpj_emissor')
        .in('isin', isinsAtivos);
      if (emErr) throw emErr;
      return new Set((emData || []).map(e => e.cnpj_emissor));
    },
  });

  const temPosicaoAtiva = useCallback((cnpj: string) => {
    return cnpjsComPosicaoSet.has(cnpj);
  }, [cnpjsComPosicaoSet]);

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

  const deleteAnalise = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('analises').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-analises'] });
      queryClient.invalidateQueries({ queryKey: ['analises-ativas-count'] });
      toast({ title: 'Análise excluída com sucesso' });
    },
    onError: (err: any) => toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' }),
  });

  // ── Apply display status (Vencida) + filter superseded versions ──
  const analisesComStatus = useMemo(() => {
    const withStatus = analises.map(a => ({
      ...a,
      displayStatus: getDisplayStatus(a.status, a.data_conclusao, a.empresa_id, temPosicaoAtiva, tipoEmissorDe(a.empresa_id)),
    }));

    // Group by empresa_id — keep only highest versao per empresa
    // Exception: if latest version is terminal (Reprovada), also show previous approved/vencida
    // Group by empresa_id + tipo — different analysis types coexist independently
    const grouped = new Map<string, typeof withStatus>();
    withStatus.forEach(a => {
      const key = `${a.empresa_id}::${a.tipo}`;
      const list = grouped.get(key) || [];
      list.push(a);
      grouped.set(key, list);
    });

    const result: typeof withStatus = [];
    grouped.forEach(items => {
      if (items.length <= 1) {
        result.push(...items);
        return;
      }
      // Sort by versao descending
      items.sort((a, b) => (b.versao || 1) - (a.versao || 1));
      const latest = items[0];
      result.push(latest);
      // If latest is Reprovada, also show the previous approved/vencida version
      if (latest.displayStatus === 'Reprovada') {
        const prev = items.find(i => i.id !== latest.id && (i.displayStatus === 'Aprovada' || i.displayStatus === 'Vencida c/ Alocação' || i.displayStatus === 'Vencida s/ Alocação'));
        if (prev) result.push(prev);
      }
    });

    return result;
  }, [analises, temPosicaoAtiva, tipoEmissorDe]);

  // ── Filters ──
  const filtered = useMemo(() => {
    let items = [...analisesComStatus];

    if (isAnalista) {
      items = items.filter(a => a.analista_responsavel.trim() === currentUser?.id);
    }
    if (analistaFilter !== 'all') {
      items = items.filter(a => a.analista_responsavel.trim() === analistaFilter.trim());
    }
    if (prazoFilter === 'vencido') {
      items = items.filter(a => a.prazo && a.prazo < hoje && (a.displayStatus === 'Pendente' || a.displayStatus === 'Em Análise'));
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
        getEmissorNome(a.empresa_id, empresasMap).toLowerCase().includes(q) ||
        (a.isin && a.isin.toLowerCase().includes(q))
      );
    }

    return items;
  }, [analisesComStatus, isAnalista, currentUser?.id, analistaFilter, prazoFilter, search, hoje]);

  // ── Handlers ──
  const handleCriar = async () => {
    if (!novoEmissor || !novoAnalistaId || !novoPrazo || !novoTipo) return;
    // Calculate next version for this empresa + tipo
    const { data: maxRows } = await supabase
      .from('analises')
      .select('versao')
      .eq('empresa_id', novoEmissor)
      .eq('tipo', novoTipo)
      .order('versao', { ascending: false })
      .limit(1);
    const novaVersao = ((maxRows?.[0]?.versao) ?? 0) + 1;
    const row = {
      empresa_id: novoEmissor,
      analista_responsavel: novoAnalistaId,
      solicitante_id: currentUser?.id || '',
      tipo: novoTipo,
      status: 'Pendente',
      data_inicio: format(new Date(), 'yyyy-MM-dd'),
      prazo: format(novoPrazo, 'yyyy-MM-dd'),
      observacoes: novoObs,
      isin: '',
      versao: novaVersao,
    };
    createAnalise.mutate(row);
    setNovaModal(false);
    setNovoEmissor(''); setNovoTipo(''); setNovoAnalistaId(''); setNovoPrazo(undefined); setNovoObs('');
  };

  const entregarAnalise = useMemo(() => {
    if (!entregarModal) return null;
    return analisesComStatus.find(a => a.id === entregarModal) || null;
  }, [entregarModal, analisesComStatus]);

  const isAcoes = entregarAnalise?.tipo === 'Ações';

  const handleEntregar = () => {
    if (!entregarModal || !relatorio.trim()) return;
    if (isAcoes && !recomendacao) return;
    updateStatus.mutate({
      id: entregarModal,
      status: 'Concluída',
      extras: {
        relatorio,
        data_conclusao: new Date().toISOString().split('T')[0],
        recomendacao: isAcoes ? recomendacao : null,
        preco_min: isAcoes && precoMin ? parseFloat(precoMin) : null,
        preco_medio: isAcoes && precoMedio ? parseFloat(precoMedio) : null,
        preco_maximo: isAcoes && precoMaximo ? parseFloat(precoMaximo) : null,
        data_alvo: isAcoes && dataAlvo ? format(dataAlvo, 'yyyy-MM-dd') : null,
      },
    });
    registrarEvento({ analise_id: entregarModal, acao: 'concluida', etapa_anterior: 'Em Análise', etapa_nova: 'Concluída' });
    setEntregarModal(null);
    setRelatorio(''); setRecomendacao(''); setPrecoMin(''); setPrecoMedio(''); setPrecoMaximo(''); setDataAlvo(undefined);
    setDrawerAnalise(null);
  };

  const handleRejeitarAnalista = () => {
    if (!rejeitarAnalistaModal || !justificativaRejeicao.trim()) return;
    updateStatus.mutate({
      id: rejeitarAnalistaModal,
      status: 'Pendente',
      extras: {
        justificativa_rejeicao: justificativaRejeicao,
        data_inicio: null,
      },
    });
    registrarEvento({ analise_id: rejeitarAnalistaModal, acao: 'devolvida', etapa_anterior: 'Em Análise', etapa_nova: 'Pendente', comentario: justificativaRejeicao });
    setRejeitarAnalistaModal(null);
    setJustificativaRejeicao('');
    setDrawerAnalise(null);
  };

  const handleComite = () => {
    if (!comiteModal || !dataComite) return;
    if (comiteModal.targetStatus === 'Reprovada' && !comentarioReprovacao.trim()) return;
    const analise = analisesComStatus.find(a => a.id === comiteModal.id);
    const etapaAnterior = analise?.displayStatus || analise?.status || '';
    updateStatus.mutate({
      id: comiteModal.id,
      status: comiteModal.targetStatus,
      extras: {
        data_comite: format(dataComite, 'yyyy-MM-dd'),
        ...(comiteModal.targetStatus === 'Reprovada' ? { justificativa_rejeicao: comentarioReprovacao } : {}),
      },
    });
    registrarEvento({
      analise_id: comiteModal.id,
      acao: comiteModal.targetStatus === 'Aprovada' ? 'aprovado' : 'reprovado',
      etapa_anterior: etapaAnterior,
      etapa_nova: comiteModal.targetStatus,
      data_comite: format(dataComite, 'yyyy-MM-dd'),
      comentario: comiteModal.targetStatus === 'Reprovada' ? comentarioReprovacao : null,
    });
    setComiteModal(null);
    setDataComite(undefined);
    setComentarioReprovacao('');
    setDrawerAnalise(null);
  };

  const handleReatribuir = () => {
    if (!reatribuirModal || !novoAnalista) return;
    const analise = analises.find(a => a.id === reatribuirModal);
    const nomeNovo = getAnalistaNome(novoAnalista, allProfiles);
    updateStatus.mutate({
      id: reatribuirModal,
      status: analise?.status || 'Pendente',
      extras: { analista_responsavel: novoAnalista },
    });
    registrarEvento({ analise_id: reatribuirModal, acao: 'analista_atribuido', comentario: nomeNovo });
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
    const item = analisesComStatus.find(a => a.id === draggedId);
    if (!item || item.displayStatus === targetStatus) {
      setDraggedId(null);
      return;
    }

    // Analyst restrictions: can only do Pendente→Em Análise, Em Análise→Concluída, Em Análise→Pendente
    if (isAnalista) {
      const from = item.displayStatus;
      const allowed =
        (from === 'Pendente' && targetStatus === 'Em Análise') ||
        (from === 'Em Análise' && targetStatus === 'Concluída') ||
        (from === 'Em Análise' && targetStatus === 'Pendente');
      if (!allowed) {
        toast({ title: 'Ação não permitida', description: 'Analistas só podem iniciar, entregar ou devolver análises.', variant: 'destructive' });
        setDraggedId(null);
        return;
      }
      // Em Análise → Pendente opens rejection modal
      if (from === 'Em Análise' && targetStatus === 'Pendente') {
        setRejeitarAnalistaModal(draggedId);
        setJustificativaRejeicao('');
        setDraggedId(null);
        return;
      }
    }

    if (targetStatus === 'Concluída') {
      setEntregarModal(draggedId);
      setDraggedId(null);
      return;
    }

    if (targetStatus === 'Aprovada' || targetStatus === 'Reprovada') {
      setComiteModal({ id: draggedId, targetStatus });
      setDraggedId(null);
      return;
    }

    const fromStatus = item.displayStatus;
    const extras: Record<string, any> = {};
    if (targetStatus === 'Em Análise') {
      extras.data_inicio = new Date().toISOString().split('T')[0];
    }

    updateStatus.mutate({ id: draggedId, status: targetStatus, extras });
    registrarEvento({ analise_id: draggedId, acao: 'etapa_alterada', etapa_anterior: fromStatus, etapa_nova: targetStatus });
    setDraggedId(null);
  };

  // History for drawer
  const historico = drawerAnalise
    ? analisesComStatus.filter(a => a.empresa_id === drawerAnalise.empresa_id && a.id !== drawerAnalise.id && (a.displayStatus === 'Concluída' || a.displayStatus === 'Aprovada' || a.displayStatus === 'Reprovada' || a.displayStatus === 'Vencida c/ Alocação' || a.displayStatus === 'Vencida s/ Alocação'))
        .sort((a, b) => (b.data_conclusao || '').localeCompare(a.data_conclusao || ''))
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">Pipeline de Research</h2>
        {canCreate && (
          <Button size="sm" className="gap-1.5 w-full sm:w-auto" onClick={() => setNovaModal(true)}>
            <Plus className="h-3.5 w-3.5" /> Nova Análise
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-0 sm:max-w-xs">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar emissor ou ISIN..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm bg-surface-1 border-border" />
        </div>
        {!isAnalista && (
          <Select value={analistaFilter} onValueChange={setAnalistaFilter}>
            <SelectTrigger className="w-full sm:w-48 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Analista" /></SelectTrigger>
            <SelectContent className="bg-card border-border max-h-60">
              <SelectItem value="all">Todos os analistas</SelectItem>
              {analistasAtivos.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={prazoFilter} onValueChange={setPrazoFilter}>
          <SelectTrigger className="w-full sm:w-36 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Prazo" /></SelectTrigger>
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
        <>
        {/* Desktop Kanban */}
        <div className="hidden lg:grid grid-cols-7 gap-3">
          {columns.map(col => {
            const items = filtered.filter(a => a.displayStatus === col.key);
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
                    const prazoVencido = item.prazo && item.prazo < hoje && (item.displayStatus === 'Pendente' || item.displayStatus === 'Em Análise');
                    const posAtiva = temPosicaoAtiva(item.empresa_id);
                    const isMyAnalise = item.analista_responsavel === currentUser?.id;

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
                            <div className="flex items-center gap-1.5 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{getEmissorNome(item.empresa_id, empresasMap)}</p>
                              {(item.versao || 1) > 1 && (
                                <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/30 shrink-0">v{item.versao}</Badge>
                              )}
                            </div>
                            {isGestor && (
                              <div onClick={e => e.stopPropagation()}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground">
                                      <MoreVertical className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="bg-card border-border">
                                    <DropdownMenuItem className="text-destructive text-xs gap-2 cursor-pointer" onClick={() => setDeleteConfirmId(item.id)}>
                                      <Trash2 className="h-3 w-3" /> Excluir
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {item.tipo && (
                              <Badge variant="outline" className={`text-[9px] ${tipoAnaliseColors[item.tipo] || 'bg-muted/30 text-muted-foreground'}`}>
                                {item.tipo}
                              </Badge>
                            )}
                            {(item as any).recomendacao && (
                              <Badge variant="outline" className={`text-[9px] ${recomendacaoColors[(item as any).recomendacao] || ''}`}>
                                {(item as any).recomendacao}
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
                              {getAnalistaInitials(item.analista_responsavel, allProfiles)}
                            </div>
                            <span className="text-[11px] text-muted-foreground truncate">{getAnalistaNome(item.analista_responsavel, allProfiles)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] ${prazoVencido ? 'text-status-danger font-semibold' : 'text-muted-foreground'}`}>
                              {item.prazo ? `Prazo: ${fmtDateBR(item.prazo)}` : ''}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{fmtDateBR(item.created_at)}</span>
                          </div>
                          {item.data_comite && (
                            <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/30">
                              📅 {fmtDateBR(item.data_comite)}
                            </Badge>
                          )}

                          {/* Quick actions */}
                          <div className="flex gap-1 pt-1" onClick={e => e.stopPropagation()}>
                            {(isAnalista || isCoord) && isMyAnalise && item.displayStatus === 'Pendente' && (
                              <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2" onClick={() => { updateStatus.mutate({ id: item.id, status: 'Em Análise', extras: { data_inicio: new Date().toISOString().split('T')[0] } }); registrarEvento({ analise_id: item.id, acao: 'etapa_alterada', etapa_anterior: 'Pendente', etapa_nova: 'Em Análise' }); }}>
                                <Play className="h-2.5 w-2.5" /> Iniciar
                              </Button>
                            )}
                            {(isAnalista || isCoord) && isMyAnalise && item.displayStatus === 'Em Análise' && (
                              <>
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2" onClick={() => setEntregarModal(item.id)}>
                                  <CheckCircle className="h-2.5 w-2.5" /> Entregar
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2 text-status-danger" onClick={() => { setRejeitarAnalistaModal(item.id); setJustificativaRejeicao(''); }}>
                                  <X className="h-2.5 w-2.5" /> Devolver
                                </Button>
                              </>
                            )}
                            {(isGestor || isCoord) && item.displayStatus === 'Concluída' && (
                              <>
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2 text-status-success" onClick={() => { setComiteModal({ id: item.id, targetStatus: 'Aprovada' }); setDataComite(undefined); }}>
                                  <ThumbsUp className="h-2.5 w-2.5" /> Aprovar
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2 text-status-danger" onClick={() => { setComiteModal({ id: item.id, targetStatus: 'Reprovada' }); setDataComite(undefined); }}>
                                  <ThumbsDown className="h-2.5 w-2.5" /> Reprovar
                                </Button>
                              </>
                            )}
                            {(isGestor || isCoord) && (item.displayStatus === 'Pendente' || item.displayStatus === 'Em Análise') && (
                              <>
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2" onClick={() => { setComiteModal({ id: item.id, targetStatus: 'Reprovada' }); setDataComite(undefined); }}>
                                  <X className="h-2.5 w-2.5" /> Rejeitar
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2" onClick={() => { setReatribuirModal(item.id); setNovoAnalista(item.analista_responsavel); }}>
                                  <UserRoundCog className="h-2.5 w-2.5" />
                                </Button>
                              </>
                            )}
                            {(isGestor || isCoord) && (item.displayStatus === 'Reprovada' || item.displayStatus === 'Vencida c/ Alocação' || item.displayStatus === 'Vencida s/ Alocação') && (
                              <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2" onClick={() => { setReabrirModal(item); setNovoPrazoReabrir(undefined); }}>
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

        {/* Mobile/Tablet Accordion */}
        <div className="lg:hidden space-y-2">
          {columns.map(col => {
            const items = filtered.filter(a => a.displayStatus === col.key);
            return (
              <Collapsible key={col.key} defaultOpen={items.length > 0}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-md bg-surface-1 border border-border">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-sm font-semibold ${col.color}`}>{col.label}</h3>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">{items.length}</Badge>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-2">
                  {items.map(item => {
                    const prazoVencido = item.prazo && item.prazo < hoje && (item.displayStatus === 'Pendente' || item.displayStatus === 'Em Análise');
                    const posAtiva = temPosicaoAtiva(item.empresa_id);
                    const isMyAnalise = item.analista_responsavel === currentUser?.id;

                    return (
                      <Card
                        key={item.id}
                        className={cn(
                          'bg-card border-border',
                          prazoVencido && 'border-status-danger/60',
                        )}
                        onClick={() => setDrawerAnalise(item)}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{getEmissorNome(item.empresa_id, empresasMap)}</p>
                              {(item.versao || 1) > 1 && (
                                <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/30 shrink-0">v{item.versao}</Badge>
                              )}
                            </div>
                            {isGestor && (
                              <div onClick={e => e.stopPropagation()}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground">
                                      <MoreVertical className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="bg-card border-border">
                                    <DropdownMenuItem className="text-destructive text-xs gap-2 cursor-pointer" onClick={() => setDeleteConfirmId(item.id)}>
                                      <Trash2 className="h-3 w-3" /> Excluir
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {item.tipo && (
                              <Badge variant="outline" className={`text-[9px] ${tipoAnaliseColors[item.tipo] || 'bg-muted/30 text-muted-foreground'}`}>
                                {item.tipo}
                              </Badge>
                            )}
                            {(item as any).recomendacao && (
                              <Badge variant="outline" className={`text-[9px] ${recomendacaoColors[(item as any).recomendacao] || ''}`}>
                                {(item as any).recomendacao}
                              </Badge>
                            )}
                            {posAtiva && (
                              <Badge variant="outline" className="text-[9px] bg-orange-500/15 text-orange-400 border-orange-500/30">
                                ⚠️ Posição Ativa
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[9px] font-bold shrink-0">
                              {getAnalistaInitials(item.analista_responsavel, allProfiles)}
                            </div>
                            <span className="text-[11px] text-muted-foreground truncate">{getAnalistaNome(item.analista_responsavel, allProfiles)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] ${prazoVencido ? 'text-status-danger font-semibold' : 'text-muted-foreground'}`}>
                              {item.prazo ? `Prazo: ${fmtDateBR(item.prazo)}` : ''}
                            </span>
                          </div>
                          {item.data_comite && (
                            <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/30">
                              📅 {fmtDateBR(item.data_comite)}
                            </Badge>
                          )}

                          {/* Quick actions */}
                          <div className="flex gap-1 pt-1 flex-wrap" onClick={e => e.stopPropagation()}>
                            {(isAnalista || isCoord) && isMyAnalise && item.displayStatus === 'Pendente' && (
                              <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2" onClick={() => { updateStatus.mutate({ id: item.id, status: 'Em Análise', extras: { data_inicio: new Date().toISOString().split('T')[0] } }); registrarEvento({ analise_id: item.id, acao: 'etapa_alterada', etapa_anterior: 'Pendente', etapa_nova: 'Em Análise' }); }}>
                                <Play className="h-2.5 w-2.5" /> Iniciar
                              </Button>
                            )}
                            {(isAnalista || isCoord) && isMyAnalise && item.displayStatus === 'Em Análise' && (
                              <>
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2" onClick={() => setEntregarModal(item.id)}>
                                  <CheckCircle className="h-2.5 w-2.5" /> Entregar
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2 text-status-danger" onClick={() => { setRejeitarAnalistaModal(item.id); setJustificativaRejeicao(''); }}>
                                  <X className="h-2.5 w-2.5" /> Devolver
                                </Button>
                              </>
                            )}
                            {(isGestor || isCoord) && item.displayStatus === 'Concluída' && (
                              <>
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2 text-status-success" onClick={() => { setComiteModal({ id: item.id, targetStatus: 'Aprovada' }); setDataComite(undefined); }}>
                                  <ThumbsUp className="h-2.5 w-2.5" /> Aprovar
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2 text-status-danger" onClick={() => { setComiteModal({ id: item.id, targetStatus: 'Reprovada' }); setDataComite(undefined); }}>
                                  <ThumbsDown className="h-2.5 w-2.5" /> Reprovar
                                </Button>
                              </>
                            )}
                            {(isGestor || isCoord) && (item.displayStatus === 'Reprovada' || item.displayStatus === 'Vencida c/ Alocação' || item.displayStatus === 'Vencida s/ Alocação') && (
                              <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2" onClick={() => { setReabrirModal(item); setNovoPrazoReabrir(undefined); }}>
                                <RotateCcw className="h-2.5 w-2.5" /> Reabrir
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {items.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-md">Nenhum item</div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
        </>
      )}

      {/* Drawer */}
      <Sheet open={!!drawerAnalise} onOpenChange={() => setDrawerAnalise(null)}>
        <SheetContent className="bg-card border-border w-full sm:w-[420px]">
          {drawerAnalise && (
            <ScrollArea className="h-full pr-4">
              <SheetHeader>
                <SheetTitle className="text-foreground">{getEmissorNome(drawerAnalise.empresa_id, empresasMap)}</SheetTitle>
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
                    <Badge variant="outline" className="text-[10px] mt-0.5">{getDisplayStatus(drawerAnalise.status, drawerAnalise.data_conclusao, drawerAnalise.empresa_id, temPosicaoAtiva)}</Badge>
                  </div>
                  <div><p className="text-[10px] text-muted-foreground uppercase">Prazo</p><p className={`text-xs ${drawerAnalise.prazo && drawerAnalise.prazo < hoje && (drawerAnalise.status === 'Pendente' || drawerAnalise.status === 'Em Análise') ? 'text-status-danger font-semibold' : ''}`}>{fmtDateBR(drawerAnalise.prazo)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase">Analista</p><p className="text-xs">{getAnalistaNome(drawerAnalise.analista_responsavel, allProfiles)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase">Solicitante</p><p className="text-xs">{drawerAnalise.solicitante_id ? getAnalistaNome(drawerAnalise.solicitante_id, allProfiles) : '—'}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase">Início</p><p className="text-xs">{fmtDateBR(drawerAnalise.data_inicio)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase">Conclusão</p><p className="text-xs">{fmtDateBR(drawerAnalise.data_conclusao)}</p></div>
                </div>

                {/* Recomendação + Preços */}
                {drawerAnalise.recomendacao && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-muted-foreground uppercase">Recomendação</p>
                      <Badge variant="outline" className={`text-[10px] ${recomendacaoColors[drawerAnalise.recomendacao] || ''}`}>
                        {drawerAnalise.recomendacao}
                      </Badge>
                    </div>
                    {(drawerAnalise.preco_min || drawerAnalise.preco_medio || drawerAnalise.preco_maximo) && (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-surface-1 p-2 rounded text-center">
                          <p className="text-[9px] text-muted-foreground uppercase">Mínimo</p>
                          <p className="text-xs font-medium">{drawerAnalise.preco_min ? `R$ ${Number(drawerAnalise.preco_min).toFixed(2)}` : '—'}</p>
                        </div>
                        <div className="bg-surface-1 p-2 rounded text-center">
                          <p className="text-[9px] text-muted-foreground uppercase">Médio</p>
                          <p className="text-xs font-medium">{drawerAnalise.preco_medio ? `R$ ${Number(drawerAnalise.preco_medio).toFixed(2)}` : '—'}</p>
                        </div>
                        <div className="bg-surface-1 p-2 rounded text-center">
                          <p className="text-[9px] text-muted-foreground uppercase">Máximo</p>
                          <p className="text-xs font-medium">{drawerAnalise.preco_maximo ? `R$ ${Number(drawerAnalise.preco_maximo).toFixed(2)}` : '—'}</p>
                        </div>
                      </div>
                    )}
                    {drawerAnalise.data_alvo && (
                      <div><p className="text-[10px] text-muted-foreground uppercase">Data-Alvo</p><p className="text-xs">{fmtDateBR(drawerAnalise.data_alvo)}</p></div>
                    )}
                  </div>
                )}

                {/* Data do Comitê */}
                {drawerAnalise.data_comite && (
                  <div><p className="text-[10px] text-muted-foreground uppercase">Data do Comitê</p><p className="text-xs">{fmtDateBR(drawerAnalise.data_comite)}</p></div>
                )}

                {/* Justificativa de rejeição */}
                {drawerAnalise.justificativa_rejeicao && (
                  <div><p className="text-[10px] text-muted-foreground uppercase">Justificativa de Devolução</p><p className="text-xs mt-1 text-status-danger">{drawerAnalise.justificativa_rejeicao}</p></div>
                )}

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
                  {(isAnalista || isCoord) && drawerAnalise.analista_responsavel === currentUser?.id && drawerAnalise.status === 'Pendente' && (
                    <Button size="sm" className="gap-1 text-xs" onClick={() => { updateStatus.mutate({ id: drawerAnalise.id, status: 'Em Análise', extras: { data_inicio: new Date().toISOString().split('T')[0] } }); registrarEvento({ analise_id: drawerAnalise.id, acao: 'etapa_alterada', etapa_anterior: 'Pendente', etapa_nova: 'Em Análise' }); setDrawerAnalise(null); }}>
                      <Play className="h-3 w-3" /> Iniciar Análise
                    </Button>
                  )}
                  {(isAnalista || isCoord) && drawerAnalise.analista_responsavel === currentUser?.id && drawerAnalise.status === 'Em Análise' && (
                    <>
                      <Button size="sm" className="gap-1 text-xs" onClick={() => setEntregarModal(drawerAnalise.id)}>
                        <CheckCircle className="h-3 w-3" /> Entregar Análise
                      </Button>
                      <Button size="sm" variant="destructive" className="gap-1 text-xs" onClick={() => { setRejeitarAnalistaModal(drawerAnalise.id); setJustificativaRejeicao(''); }}>
                        <X className="h-3 w-3" /> Devolver
                      </Button>
                    </>
                  )}
                  {(isGestor || isCoord) && drawerAnalise.status === 'Concluída' && (
                    <>
                      <Button size="sm" className="gap-1 text-xs bg-status-success hover:bg-status-success/80" onClick={() => { setComiteModal({ id: drawerAnalise.id, targetStatus: 'Aprovada' }); setDataComite(undefined); }}>
                        <ThumbsUp className="h-3 w-3" /> Aprovar
                      </Button>
                      <Button size="sm" variant="destructive" className="gap-1 text-xs" onClick={() => { setComiteModal({ id: drawerAnalise.id, targetStatus: 'Reprovada' }); setDataComite(undefined); }}>
                        <ThumbsDown className="h-3 w-3" /> Reprovar
                      </Button>
                    </>
                  )}
                  {(isGestor || isCoord) && (drawerAnalise.status === 'Pendente' || drawerAnalise.status === 'Em Análise') && (
                    <Button size="sm" variant="destructive" className="gap-1 text-xs" onClick={() => { setComiteModal({ id: drawerAnalise.id, targetStatus: 'Reprovada' }); setDataComite(undefined); }}>
                      <X className="h-3 w-3" /> Rejeitar
                    </Button>
                  )}
                  {(isGestor || isCoord) && (drawerAnalise.status === 'Pendente' || drawerAnalise.status === 'Em Análise') && (
                    <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => { setEditarPrazoModal(drawerAnalise); setNovoPrazoEdicao(drawerAnalise.prazo ? new Date(drawerAnalise.prazo + 'T00:00:00') : undefined); }}>
                      <CalendarIcon className="h-3 w-3" /> Alterar Prazo
                    </Button>
                  )}
                  {(isGestor || isCoord) && (drawerAnalise.status === 'Reprovada' || isVencida(drawerAnalise.status, drawerAnalise.data_conclusao)) && (
                    <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => { setReabrirModal(drawerAnalise); setNovoPrazoReabrir(undefined); setDrawerAnalise(null); }}>
                      <RotateCcw className="h-3 w-3" /> Reabrir
                    </Button>
                  )}
                  {isGestor && (
                    <Button size="sm" variant="destructive" className="gap-1 text-xs" onClick={() => { setDeleteConfirmId(drawerAnalise.id); setDrawerAnalise(null); }}>
                      <Trash2 className="h-3 w-3" /> Excluir
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
                        <span className="text-[11px] text-muted-foreground">{fmtDateBR(h.data_conclusao)}</span>
                        <Badge variant="outline" className="text-[9px]">{h.displayStatus}</Badge>
                      </div>
                      <p className="text-[11px]">Analista: {getAnalistaNome(h.analista_responsavel, allProfiles)}</p>
                      {(h as any).recomendacao && (
                        <Badge variant="outline" className={`text-[9px] ${recomendacaoColors[(h as any).recomendacao] || ''}`}>{(h as any).recomendacao}</Badge>
                      )}
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="mt-1 h-8 w-full justify-between text-sm bg-surface-1 border-border font-normal">
                    {novoEmissor
                      ? empresasDB.find(e => e.cnpj === novoEmissor)?.nome ?? novoEmissor
                      : "Selecionar empresa..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-card border-border" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar empresa..." className="h-9" />
                    <CommandList className="max-h-60">
                      <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                      {empresasDB
                        .filter(e => e.tipo !== 'Título Público')
                        .sort((a, b) => a.nome.localeCompare(b.nome))
                        .map(e => (
                          <CommandItem
                            key={e.cnpj}
                            value={e.nome}
                            onSelect={() => setNovoEmissor(e.cnpj)}
                          >
                            <Check className={cn("mr-2 h-4 w-4", novoEmissor === e.cnpj ? "opacity-100" : "opacity-0")} />
                            {e.nome}
                          </CommandItem>
                        ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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

      {/* Entregar Modal (Conclusão) */}
      <Dialog open={!!entregarModal} onOpenChange={() => { setEntregarModal(null); setRelatorio(''); setRecomendacao(''); setPrecoMin(''); setPrecoMedio(''); setPrecoMaximo(''); setDataAlvo(undefined); }}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle>Entregar Análise {entregarAnalise ? `— ${getEmissorNome(entregarAnalise.empresa_id, empresasMap)}` : ''}</DialogTitle>
            <DialogDescription>
              {isAcoes
                ? 'Preencha o relatório, recomendação e preços sugeridos para concluir.'
                : 'Preencha o relatório para concluir a análise.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Relatório (obrigatório)</Label>
              <Textarea value={relatorio} onChange={e => setRelatorio(e.target.value)} rows={4} className="mt-1 text-sm bg-surface-1 border-border" placeholder="Descreva os resultados..." />
            </div>
            {isAcoes && (
              <>
                <div>
                  <Label className="text-xs">Recomendação (obrigatório)</Label>
                  <Select value={recomendacao} onValueChange={setRecomendacao}>
                    <SelectTrigger className="mt-1 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="Buy">Buy</SelectItem>
                      <SelectItem value="Hold">Hold</SelectItem>
                      <SelectItem value="Sell">Sell</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Preço Mín.</Label>
                    <Input type="number" step="0.01" value={precoMin} onChange={e => setPrecoMin(e.target.value)} className="mt-1 h-8 text-sm bg-surface-1 border-border" placeholder="R$" />
                  </div>
                  <div>
                    <Label className="text-xs">Preço Médio</Label>
                    <Input type="number" step="0.01" value={precoMedio} onChange={e => setPrecoMedio(e.target.value)} className="mt-1 h-8 text-sm bg-surface-1 border-border" placeholder="R$" />
                  </div>
                  <div>
                    <Label className="text-xs">Preço Máx.</Label>
                    <Input type="number" step="0.01" value={precoMaximo} onChange={e => setPrecoMaximo(e.target.value)} className="mt-1 h-8 text-sm bg-surface-1 border-border" placeholder="R$" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Data-Alvo</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("mt-1 w-full h-8 text-sm justify-start bg-surface-1 border-border", !dataAlvo && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        {dataAlvo ? format(dataAlvo, 'dd/MM/yyyy') : 'Selecionar data'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dataAlvo} onSelect={setDataAlvo} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}
            <Button size="sm" className="w-full" onClick={handleEntregar} disabled={!relatorio.trim() || (isAcoes && !recomendacao) || updateStatus.isPending}>
              {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Entregar Análise
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rejeição pelo Analista Modal (Em Análise → Pendente) */}
      <Dialog open={!!rejeitarAnalistaModal} onOpenChange={() => { setRejeitarAnalistaModal(null); setJustificativaRejeicao(''); }}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Devolver Análise</DialogTitle>
            <DialogDescription>Informe a justificativa para devolver esta análise. Ela voltará ao status Pendente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Justificativa (obrigatória)</Label>
              <Textarea value={justificativaRejeicao} onChange={e => setJustificativaRejeicao(e.target.value)} rows={4} className="mt-1 text-sm bg-surface-1 border-border" placeholder="Explique o motivo..." />
            </div>
            <Button size="sm" className="w-full" variant="destructive" onClick={handleRejeitarAnalista} disabled={!justificativaRejeicao.trim() || updateStatus.isPending}>
              {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar Devolução
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Comitê Modal (Aprovar / Reprovar) */}
      <Dialog open={!!comiteModal} onOpenChange={() => { setComiteModal(null); setDataComite(undefined); setComentarioReprovacao(''); }}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle>{comiteModal?.targetStatus === 'Aprovada' ? 'Aprovar Análise' : 'Reprovar Análise'}</DialogTitle>
            <DialogDescription>Informe a data do Comitê de Investimentos em que a decisão foi tomada.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Data do Comitê (obrigatória)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("mt-1 w-full h-8 text-sm justify-start bg-surface-1 border-border", !dataComite && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {dataComite ? format(dataComite, 'dd/MM/yyyy') : 'Selecionar data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataComite} onSelect={setDataComite} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            {comiteModal?.targetStatus === 'Reprovada' && (
              <div>
                <Label className="text-xs">Motivo da Reprovação (obrigatório)</Label>
                <Textarea value={comentarioReprovacao} onChange={e => setComentarioReprovacao(e.target.value)} rows={3} className="mt-1 text-sm bg-surface-1 border-border" placeholder="Explique o motivo da reprovação..." />
              </div>
            )}
            <Button
              size="sm"
              className="w-full"
              variant={comiteModal?.targetStatus === 'Aprovada' ? 'default' : 'destructive'}
              onClick={handleComite}
              disabled={!dataComite || (comiteModal?.targetStatus === 'Reprovada' && !comentarioReprovacao.trim()) || updateStatus.isPending}
            >
              {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {comiteModal?.targetStatus === 'Aprovada' ? 'Confirmar Aprovação' : 'Confirmar Reprovação'}
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

      {/* Reabrir Análise Modal */}
      <Dialog open={!!reabrirModal} onOpenChange={(open) => { if (!open) { setReabrirModal(null); setNovoPrazoReabrir(undefined); } }}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle>Reabrir Análise</DialogTitle>
            <DialogDescription>
              {reabrirModal ? `${getEmissorNome(reabrirModal.empresa_id, empresasMap)} · ${reabrirModal.tipo}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Novo prazo de entrega (obrigatório)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("mt-1 w-full h-8 text-sm justify-start bg-surface-1 border-border", !novoPrazoReabrir && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {novoPrazoReabrir ? format(novoPrazoReabrir, 'dd/MM/yyyy') : 'Selecionar data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={novoPrazoReabrir} onSelect={setNovoPrazoReabrir} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <Button
              size="sm"
              className="w-full"
              disabled={!novoPrazoReabrir || createAnalise.isPending}
              onClick={async () => {
                if (!reabrirModal || !novoPrazoReabrir) return;
                const item = reabrirModal;
                const { data: maxRows } = await supabase
                  .from('analises')
                  .select('versao')
                  .eq('empresa_id', item.empresa_id)
                  .eq('tipo', item.tipo)
                  .order('versao', { ascending: false })
                  .limit(1);
                const novaVersao = ((maxRows?.[0]?.versao) ?? 0) + 1;
                createAnalise.mutate({
                  empresa_id: item.empresa_id,
                  tipo: item.tipo,
                  analista_responsavel: item.analista_responsavel,
                  isin: item.isin || '',
                  status: 'Pendente',
                  data_inicio: new Date().toISOString().split('T')[0],
                  prazo: format(novoPrazoReabrir, 'yyyy-MM-dd'),
                  versao: novaVersao,
                  solicitante_id: currentUser?.id || '',
                });
                registrarEvento({ analise_id: item.id, acao: 'reaberta', etapa_nova: 'Pendente', comentario: `v${novaVersao}` });
                toast({ title: `Nova análise v${novaVersao} criada` });
                setReabrirModal(null);
                setNovoPrazoReabrir(undefined);
              }}
            >
              {createAnalise.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar Reabertura
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Alterar Prazo Modal */}
      <Dialog open={!!editarPrazoModal} onOpenChange={(open) => { if (!open) { setEditarPrazoModal(null); setNovoPrazoEdicao(undefined); } }}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle>Alterar Prazo de Entrega</DialogTitle>
            <DialogDescription>
              {editarPrazoModal ? `${getEmissorNome(editarPrazoModal.empresa_id, empresasMap)} · ${editarPrazoModal.tipo} · Prazo atual: ${fmtDateBR(editarPrazoModal.prazo)}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Novo prazo</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("mt-1 w-full h-8 text-sm justify-start bg-surface-1 border-border", !novoPrazoEdicao && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {novoPrazoEdicao ? format(novoPrazoEdicao, 'dd/MM/yyyy') : 'Selecionar data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={novoPrazoEdicao} onSelect={setNovoPrazoEdicao} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <Button
              size="sm"
              className="w-full"
              disabled={!novoPrazoEdicao || updateStatus.isPending}
              onClick={() => {
                if (!editarPrazoModal || !novoPrazoEdicao) return;
                updateStatus.mutate({
                  id: editarPrazoModal.id,
                  status: editarPrazoModal.status,
                  extras: { prazo: format(novoPrazoEdicao, 'yyyy-MM-dd') },
                });
                setEditarPrazoModal(null);
                setNovoPrazoEdicao(undefined);
                setDrawerAnalise(null);
              }}
            >
              {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Análise</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta análise? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirmId) {
                  deleteAnalise.mutate(deleteConfirmId);
                  setDeleteConfirmId(null);
                }
              }}
            >
              {deleteAnalise.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
