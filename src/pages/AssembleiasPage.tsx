import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CalendarIcon, Plus, Search, MoreVertical, Pencil, Trash2, Eye, CheckCircle, Clock, AlertTriangle, CalendarDays, Loader2, FileText, Link2, Building2, ExternalLink } from 'lucide-react';
import { UploadPanel } from '@/components/assembleias/UploadPanel';
import { ParticipacoesPanel } from '@/components/assembleias/ParticipacoesPanel';

type EventoTipo = 'AGO' | 'AGE' | 'AGO/E' | 'AGDEB' | 'Reunião de Debenturistas' | 'Assembleia de Cotistas' | 'Fato Relevante';
type EventoStatus = 'Agendado' | 'Realizado' | 'Cancelado' | 'Adiado';
type VotoButia = 'A favor' | 'Contra' | 'Abstenção' | 'Não votou';
type Modalidade = 'Presencial' | 'Híbrida' | 'Digital';
type Triagem = 'com_posicao' | 'sem_posicao' | 'pendente_vinculo';
type Origem = 'manual' | 'upload';
interface Documento { nome: string; url: string; }
interface Assembleia {
  id: string; created_at: string; updated_at: string;
  cnpj_empresa: string | null; isin: string | null;
  tipo: EventoTipo; titulo: string; descricao: string | null;
  data_evento: string; hora_evento: string | null; data_limite_voto: string | null;
  modalidade: Modalidade | null; local_link: string | null; status: EventoStatus;
  voto_butia: VotoButia | null; justificativa_voto: string | null; resultado: string | null;
  quorum_atingido: boolean | null; observacoes: string | null; responsavel_id: string | null;
  documentos: Documento[];
  ticker: string | null; url_b3: string | null; data_assembleia: string | null;
  origem: Origem | null; cnpj_emissor: string | null; triagem: Triagem | null;
  isins_vinculados: string[] | null;
}

const TIPOS: EventoTipo[] = ['AGO', 'AGE', 'AGO/E', 'AGDEB', 'Fato Relevante', 'Reunião de Debenturistas', 'Assembleia de Cotistas'];
const TIPOS_EMPRESA: EventoTipo[] = ['AGO', 'AGE', 'AGO/E', 'Fato Relevante'];
const TIPOS_ISIN: EventoTipo[] = ['AGDEB', 'Reunião de Debenturistas', 'Assembleia de Cotistas'];
const TIPOS_COM_VOTO: EventoTipo[] = ['AGO', 'AGE', 'AGO/E', 'AGDEB', 'Reunião de Debenturistas', 'Assembleia de Cotistas'];

const TIPO_COLOR: Record<string, string> = {
  AGO: 'bg-blue-500/15 text-blue-700 border-blue-400/30 dark:text-blue-300',
  AGE: 'bg-orange-500/15 text-orange-700 border-orange-400/30 dark:text-orange-300',
  'AGO/E': 'bg-muted/50 text-muted-foreground border-border',
  AGDEB: 'bg-purple-500/15 text-purple-700 border-purple-400/30 dark:text-purple-300',
  'Fato Relevante': 'bg-amber-500/15 text-amber-700 border-amber-400/30 dark:text-amber-300',
  'Reunião de Debenturistas': 'bg-purple-500/15 text-purple-700 border-purple-400/30 dark:text-purple-300',
  'Assembleia de Cotistas': 'bg-purple-500/15 text-purple-700 border-purple-400/30 dark:text-purple-300',
};

const TRIAGEM_CFG: Record<Triagem, { label: string; cls: string }> = {
  com_posicao: { label: 'Com posição', cls: 'bg-status-success/15 text-status-success border-status-success/30' },
  pendente_vinculo: { label: 'Pendente vínculo', cls: 'bg-status-warning/15 text-status-warning border-status-warning/30' },
  sem_posicao: { label: 'Sem posição', cls: 'bg-muted/50 text-muted-foreground border-border' },
};

const STATUS_CFG: Record<EventoStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  Agendado:  { label: 'Agendado',  cls: 'bg-status-info/15 text-status-info border-status-info/30',          icon: <Clock className="h-3 w-3" /> },
  Realizado: { label: 'Realizado', cls: 'bg-status-success/15 text-status-success border-status-success/30', icon: <CheckCircle className="h-3 w-3" /> },
  Cancelado: { label: 'Cancelado', cls: 'bg-muted/50 text-muted-foreground border-border',                    icon: <AlertTriangle className="h-3 w-3" /> },
  Adiado:    { label: 'Adiado',    cls: 'bg-status-warning/15 text-status-warning border-status-warning/30', icon: <AlertTriangle className="h-3 w-3" /> },
};

const VOTO_CLS: Record<VotoButia, string> = {
  'A favor':   'bg-status-success/15 text-status-success border-status-success/30',
  'Contra':    'bg-status-danger/15 text-status-danger border-status-danger/30',
  'Abstenção': 'bg-status-warning/15 text-status-warning border-status-warning/30',
  'Não votou': 'bg-muted/50 text-muted-foreground border-border',
};

function emptyForm() {
  return {
    tipo: '' as EventoTipo | '', cnpj_empresa: '', isin: '', titulo: '', descricao: '',
    data_evento: undefined as Date | undefined, hora_evento: '',
    data_limite_voto: undefined as Date | undefined,
    modalidade: '' as Modalidade | '', local_link: '', status: 'Agendado' as EventoStatus,
    voto_butia: '' as VotoButia | '', justificativa_voto: '', resultado: '',
    quorum_atingido: '' as '' | 'true' | 'false', observacoes: '', responsavel_id: '',
    documentos: [] as Documento[],
  };
}

function usaIsin(tipo: string) { return TIPOS_ISIN.includes(tipo as EventoTipo); }
function temVoto(tipo: string) { return TIPOS_COM_VOTO.includes(tipo as EventoTipo); }

function urgencyBadge(dataEvento: string, status: EventoStatus) {
  if (status !== 'Agendado') return null;
  const diff = differenceInDays(parseISO(dataEvento), new Date());
  if (diff < 0)   return { label: 'Vencido', cls: 'text-status-danger font-medium' };
  if (diff === 0) return { label: 'Hoje',    cls: 'text-status-warning font-semibold' };
  if (diff <= 7)  return { label: diff + 'd', cls: 'text-status-warning' };
  if (diff <= 30) return { label: diff + 'd', cls: 'text-status-info' };
  return null;
}

export default function AssembleiasPage() {
  const { permissions } = useAuth();
  const canWrite = permissions.canWrite;
  const qc = useQueryClient();

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('Todos');
  const [filtroTipo, setFiltroTipo] = useState('Todos');
  const [filtroTriagem, setFiltroTriagem] = useState('ocultar_sem_posicao');
  const [filtroOrigem, setFiltroOrigem] = useState('Todas');
  const [formOpen, setFormOpen] = useState(false);
  const [detalheEvento, setDetalhe] = useState(null as Assembleia | null);
  const [editando, setEditando] = useState(null as Assembleia | null);
  const [deleteId, setDeleteId] = useState(null as string | null);
  const [form, setForm] = useState(emptyForm());
  const [novoDoc, setNovoDoc] = useState({ nome: '', url: '' });

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ['assembleias'],
    queryFn: async () => {
      const { data, error } = await supabase.from('assembleias' as any).select('*').order('data_evento', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Assembleia[];
    },
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-list'],
    queryFn: async () => { const { data } = await supabase.from('empresas').select('cnpj, nome').order('nome'); return data ?? []; },
  });

  const { data: emissoes = [] } = useQuery({
    queryKey: ['emissoes-list'],
    queryFn: async () => { const { data } = await supabase.from('emissoes').select('isin, ticker, cnpj_emissor').order('isin'); return data ?? []; },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-public'],
    queryFn: async () => { const { data } = await supabase.from('profiles_public').select('id, nome').order('nome'); return data ?? []; },
  });

  const { data: participacoesCount = {} as Record<string, number> } = useQuery({
    queryKey: ['participacoes-count'],
    queryFn: async () => {
      const { data } = await supabase.from('assembleia_participacoes' as any).select('assembleia_id');
      const map: Record<string, number> = {};
      ((data ?? []) as unknown as Array<{ assembleia_id: string }>).forEach(r => { map[r.assembleia_id] = (map[r.assembleia_id] ?? 0) + 1; });
      return map;
    },
  });

  const empresasMap = useMemo(() => new Map(empresas.map((e: any) => [e.cnpj, e.nome])), [empresas]);
  const nomePerfil = (id: string | null) => id ? (profiles.find((p: any) => p.id === id)?.nome ?? id) : '—';

  const vinculoLabel = (ev: Assembleia) => {
    if (ev.cnpj_empresa) return empresasMap.get(ev.cnpj_empresa) ?? ev.cnpj_empresa;
    if (ev.isin) { const em = emissoes.find((e: any) => e.isin === ev.isin); return em?.ticker ? ev.isin + ' (' + em.ticker + ')' : ev.isin; }
    return '—';
  };

  const isinLabel = (isin: string) => {
    const em = emissoes.find((e: any) => e.isin === isin);
    if (!em) return isin;
    return isin + (em.ticker ? ' (' + em.ticker + ')' : '') + ' — ' + (empresasMap.get(em.cnpj_emissor) ?? em.cnpj_emissor);
  };

  const filtrados = useMemo(() => eventos.filter(ev => {
    if (filtroStatus !== 'Todos' && ev.status !== filtroStatus) return false;
    if (filtroTipo !== 'Todos' && ev.tipo !== filtroTipo) return false;
    {
      const tri = ev.triagem ?? 'sem_posicao';
      if (filtroTriagem === 'ocultar_sem_posicao' && tri === 'sem_posicao') return false;
      if (filtroTriagem !== 'Todas' && filtroTriagem !== 'ocultar_sem_posicao' && tri !== filtroTriagem) return false;
    }
    if (filtroOrigem !== 'Todas' && (ev.origem ?? 'manual') !== filtroOrigem) return false;
    if (busca) {
      const b = busca.toLowerCase();
      if (!ev.titulo.toLowerCase().includes(b) && !vinculoLabel(ev).toLowerCase().includes(b) && !ev.tipo.toLowerCase().includes(b) && !(ev.ticker ?? '').toLowerCase().includes(b)) return false;
    }
    return true;
  }), [eventos, filtroStatus, filtroTipo, filtroTriagem, filtroOrigem, busca, empresasMap, emissoes]);

  const alertas = useMemo(() =>
    eventos.filter(e => { const d = differenceInDays(parseISO(e.data_evento), new Date()); return e.status === 'Agendado' && d >= 0 && d <= 30 && (e.triagem === 'com_posicao' || e.triagem === 'pendente_vinculo' || e.origem === 'manual' || !e.origem); })
      .sort((a, b) => a.data_evento.localeCompare(b.data_evento)).slice(0, 6), [eventos]);

  const kpis = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const inScope = (e: Assembleia) => e.triagem === 'com_posicao' || e.triagem === 'pendente_vinculo' || !e.origem || e.origem === 'manual';
    return {
      agendados:  eventos.filter(e => { const d = parseISO(e.data_evento); return d >= today && inScope(e); }).length,
      semana:     eventos.filter(e => { const d = differenceInDays(parseISO(e.data_evento), today); return d >= 0 && d <= 7 && inScope(e); }).length,
      realizados: eventos.filter(e => { const d = parseISO(e.data_evento); return d < today && (participacoesCount[e.id] ?? 0) > 0; }).length,
      semVoto:    eventos.filter(e => { const d = parseISO(e.data_evento); return d < today && inScope(e) && (participacoesCount[e.id] ?? 0) === 0; }).length,
    };
  }, [eventos, participacoesCount]);

  const upsert = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (editando) { const { error } = await supabase.from('assembleias' as any).update(payload).eq('id', editando.id); if (error) throw error; }
      else { const { error } = await supabase.from('assembleias' as any).insert(payload); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assembleias'] }); toast({ title: editando ? 'Evento atualizado' : 'Evento criado' }); fecharForm(); },
    onError: (e: any) => toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' }),
  });

  const deletar = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('assembleias' as any).delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assembleias'] }); toast({ title: 'Evento excluído' }); setDeleteId(null); },
  });

  function abrirCriar() { setEditando(null); setForm(emptyForm()); setFormOpen(true); }

  function abrirEditar(ev: Assembleia) {
    setEditando(ev);
    setForm({ tipo: ev.tipo, cnpj_empresa: ev.cnpj_empresa ?? '', isin: ev.isin ?? '', titulo: ev.titulo, descricao: ev.descricao ?? '',
      data_evento: parseISO(ev.data_evento), hora_evento: ev.hora_evento ?? '',
      data_limite_voto: ev.data_limite_voto ? parseISO(ev.data_limite_voto) : undefined,
      modalidade: ev.modalidade ?? '', local_link: ev.local_link ?? '', status: ev.status,
      voto_butia: ev.voto_butia ?? '', justificativa_voto: ev.justificativa_voto ?? '',
      resultado: ev.resultado ?? '', quorum_atingido: ev.quorum_atingido === true ? 'true' : ev.quorum_atingido === false ? 'false' : '',
      observacoes: ev.observacoes ?? '', responsavel_id: ev.responsavel_id ?? '', documentos: ev.documentos ?? [],
    });
    setDetalhe(null); setFormOpen(true);
  }

  function fecharForm() { setFormOpen(false); setEditando(null); setForm(emptyForm()); setNovoDoc({ nome: '', url: '' }); }
  function set(field: string, value: unknown) { setForm(f => ({ ...f, [field]: value })); }

  function setTipo(v: EventoTipo) {
    setForm(f => ({ ...f, tipo: v, cnpj_empresa: usaIsin(v) ? '' : f.cnpj_empresa, isin: usaIsin(v) ? f.isin : '' }));
  }

  function adicionarDoc() {
    if (!novoDoc.nome || !novoDoc.url) return;
    setForm(f => ({ ...f, documentos: [...f.documentos, { nome: novoDoc.nome, url: novoDoc.url }] }));
    setNovoDoc({ nome: '', url: '' });
  }

  function removerDoc(i: number) { setForm(f => ({ ...f, documentos: f.documentos.filter((_, idx) => idx !== i) })); }

  async function handleSalvar() {
    if (!form.tipo || !form.titulo || !form.data_evento) { toast({ title: 'Preencha tipo, título e data', variant: 'destructive' }); return; }
    if (usaIsin(form.tipo) && !form.isin) { toast({ title: 'Selecione a emissão (ISIN)', variant: 'destructive' }); return; }
    if (!usaIsin(form.tipo) && !form.cnpj_empresa) { toast({ title: 'Selecione a empresa', variant: 'destructive' }); return; }

    // Triagem automática para evento manual: verifica se há posição em algum ISIN relacionado
    let triagem: 'com_posicao' | 'sem_posicao' = 'sem_posicao';
    let isinsVinculados: string[] = [];
    try {
      let candidateIsins: string[] = [];
      if (usaIsin(form.tipo) && form.isin) candidateIsins = [form.isin];
      else if (form.cnpj_empresa) {
        const { data: ems } = await supabase.from('emissoes').select('isin').eq('cnpj_emissor', form.cnpj_empresa);
        candidateIsins = (ems ?? []).map((e: any) => e.isin).filter(Boolean);
      }
      if (candidateIsins.length > 0) {
        const { data: pos } = await supabase.from('posicoes').select('isin').in('isin', candidateIsins);
        const comPos = [...new Set((pos ?? []).map((p: any) => p.isin).filter(Boolean))];
        if (comPos.length > 0) { triagem = 'com_posicao'; isinsVinculados = comPos; }
      }
    } catch (err) { console.warn('[handleSalvar] triagem manual falhou', err); }

    upsert.mutate({
      tipo: form.tipo, cnpj_empresa: usaIsin(form.tipo) ? null : form.cnpj_empresa,
      isin: usaIsin(form.tipo) ? form.isin : null, titulo: form.titulo,
      triagem, isins_vinculados: isinsVinculados,
      descricao: form.descricao || null, data_evento: format(form.data_evento, 'yyyy-MM-dd'),
      hora_evento: form.hora_evento || null,
      data_limite_voto: form.data_limite_voto ? format(form.data_limite_voto, 'yyyy-MM-dd') : null,
      modalidade: form.modalidade || null, local_link: form.local_link || null, status: form.status,
      voto_butia: form.voto_butia || null, justificativa_voto: form.justificativa_voto || null,
      resultado: form.resultado || null,
      quorum_atingido: form.quorum_atingido === 'true' ? true : form.quorum_atingido === 'false' ? false : null,
      observacoes: form.observacoes || null, responsavel_id: form.responsavel_id || null, documentos: form.documentos,
    });
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Assembleias e Eventos Corporativos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">AGO/AGE e fatos relevantes vinculados à empresa · Reuniões de debenturistas e assembleias de cotistas vinculadas ao ISIN</p>
        </div>
        {canWrite && (<Button onClick={abrirCriar} size="sm" className="shrink-0 gap-1.5"><Plus className="h-4 w-4" /> Novo evento</Button>)}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Agendados', value: kpis.agendados, warn: false },
          { label: 'Próximos 7 dias', value: kpis.semana, warn: kpis.semana > 0 },
          { label: 'Realizados', value: kpis.realizados, warn: false },
          { label: 'Sem posição de voto', value: kpis.semVoto, warn: kpis.semVoto > 0 },
        ].map(k => (
          <Card key={k.label}><CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground leading-tight">{k.label}</p>
            <p className={cn('text-2xl font-semibold mt-1', k.warn && 'text-status-warning')}>{k.value}</p>
          </CardContent></Card>
        ))}
      </div>

      {alertas.length > 0 && (
        <Card className="border-status-warning/30 bg-status-warning/5">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-status-warning flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Próximos 30 dias
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <div className="flex flex-col divide-y divide-border/50">
              {alertas.map(ev => {
                const urg = urgencyBadge(ev.data_evento, ev.status);
                const semVoto = temVoto(ev.tipo) && !ev.voto_butia;
                return (
                  <div key={ev.id} className="flex items-center justify-between py-2 gap-3 cursor-pointer hover:bg-muted/20 -mx-4 px-4 transition-colors" onClick={() => setDetalhe(ev)}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className={cn('text-[10px] shrink-0', TIPO_COLOR[ev.tipo])}>{ev.tipo}</Badge>
                      <span className="text-sm truncate font-medium">{ev.titulo}</span>
                      <span className="text-xs text-muted-foreground truncate hidden sm:block">{vinculoLabel(ev)}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-xs">
                      {semVoto && <span className="text-status-danger font-medium">sem voto</span>}
                      {urg && <span className={cn(urg.cls)}>{urg.label}</span>}
                      <span className="text-muted-foreground">{format(parseISO(ev.data_evento), 'dd/MM')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {canWrite && <UploadPanel />}

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-8 h-8 text-sm" placeholder="Buscar por título, ticker, empresa ou ISIN..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="h-8 text-sm w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos os tipos</SelectItem>
            {TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroTriagem} onValueChange={setFiltroTriagem}>
          <SelectTrigger className="h-8 text-sm w-44"><SelectValue placeholder="Triagem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ocultar_sem_posicao">Ocultar sem posição</SelectItem>
            <SelectItem value="Todas">Todas as triagens</SelectItem>
            <SelectItem value="com_posicao">Com posição</SelectItem>
            <SelectItem value="pendente_vinculo">Pendente vínculo</SelectItem>
            <SelectItem value="sem_posicao">Sem posição</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
          <SelectTrigger className="h-8 text-sm w-32"><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Todas">Todas</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="upload">Upload</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="h-8 text-sm w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos os status</SelectItem>
            {(['Agendado','Realizado','Cancelado','Adiado'] as EventoStatus[]).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando eventos...</div>
          ) : filtrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <CalendarDays className="h-9 w-9 opacity-25" /><p className="text-sm">Nenhum evento encontrado</p>
              {canWrite && <Button variant="outline" size="sm" onClick={abrirCriar}>Cadastrar primeiro evento</Button>}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Data</TableHead>
                  <TableHead className="w-[90px]">Tipo</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="w-[80px]">Ticker</TableHead>
                  <TableHead className="w-[130px]">Triagem</TableHead>
                  <TableHead className="w-[96px]">Voto Butiá</TableHead>
                  <TableHead className="w-[60px]">B3</TableHead>
                  <TableHead className="w-[36px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map(ev => {
                  const urg = urgencyBadge(ev.data_evento, ev.status);
                  const tri = ev.triagem ?? 'sem_posicao';
                  const triCfg = TRIAGEM_CFG[tri];
                  const empresaNome = ev.cnpj_empresa ? (empresasMap.get(ev.cnpj_empresa) ?? ev.titulo) : ev.titulo;
                  const nParts = participacoesCount[ev.id] ?? 0;
                  return (
                    <TableRow key={ev.id} className={cn('cursor-pointer hover:bg-muted/30', tri === 'sem_posicao' && 'opacity-50')} onClick={() => setDetalhe(ev)}>
                      <TableCell className="text-sm py-2.5">
                        <div className="font-medium tabular-nums">{format(parseISO(ev.data_evento), 'dd/MM/yyyy')}</div>
                        {urg && <div className={cn('text-[11px]', urg.cls)}>{urg.label}</div>}
                      </TableCell>
                      <TableCell className="py-2.5"><Badge variant="outline" className={cn('text-[10px]', TIPO_COLOR[ev.tipo])}>{ev.tipo}</Badge></TableCell>
                      <TableCell className="py-2.5">
                        <div className="text-sm font-medium leading-snug truncate">{empresaNome}</div>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs font-mono text-muted-foreground">{ev.ticker ?? '—'}</TableCell>
                      <TableCell className="py-2.5"><Badge variant="outline" className={cn('text-[10px]', triCfg.cls)}>{triCfg.label}</Badge></TableCell>
                      <TableCell className="py-2.5">
                        {nParts > 0 ? <Badge variant="outline" className="text-[10px] bg-status-success/15 text-status-success border-status-success/30">{nParts} voto{nParts > 1 ? 's' : ''}</Badge>
                          : ev.voto_butia ? <Badge variant="outline" className={cn('text-[10px]', VOTO_CLS[ev.voto_butia])}>{ev.voto_butia}</Badge>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell className="py-2.5" onClick={e => e.stopPropagation()}>
                        {ev.url_b3 ? <a href={ev.url_b3} target="_blank" rel="noreferrer" className="text-primary inline-flex"><ExternalLink className="h-3.5 w-3.5" /></a> : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell className="py-2.5" onClick={e => e.stopPropagation()}>
                        {canWrite && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setDetalhe(ev)}><Eye className="h-3.5 w-3.5 mr-2" /> Ver detalhes</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => abrirEditar(ev)}><Pencil className="h-3.5 w-3.5 mr-2" /> Editar</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteId(ev.id)}><Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={open => { if (!open) fecharForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar evento' : 'Novo evento'}</DialogTitle>
            <DialogDescription>{editando ? 'Atualize as informações do evento.' : 'Cadastre uma assembleia, reunião ou fato relevante.'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs mb-1.5 block">Tipo de evento *</Label>
                <div className="grid grid-cols-5 gap-1.5">
                  {TIPOS.map(t => (
                    <button key={t} type="button" onClick={() => setTipo(t)} className={cn('rounded-md border px-2 py-2 text-xs leading-tight transition-colors text-center', form.tipo === t ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:bg-muted/40')}>{t}</button>
                  ))}
                </div>
                {form.tipo && <p className="text-[11px] text-muted-foreground mt-1.5">{usaIsin(form.tipo) ? '→ vinculado à emissão (ISIN)' : '→ vinculado à empresa (CNPJ)'}</p>}
              </div>
              {form.tipo && !usaIsin(form.tipo) && (
                <div className="col-span-2">
                  <Label className="text-xs mb-1.5 block">Empresa *</Label>
                  <Select value={form.cnpj_empresa} onValueChange={v => set('cnpj_empresa', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione a empresa..." /></SelectTrigger>
                    <SelectContent>{empresas.map((e: any) => <SelectItem key={e.cnpj} value={e.cnpj}>{e.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {form.tipo && usaIsin(form.tipo) && (
                <div className="col-span-2">
                  <Label className="text-xs mb-1.5 block">Emissão (ISIN) *</Label>
                  <Select value={form.isin} onValueChange={v => set('isin', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione o ISIN..." /></SelectTrigger>
                    <SelectContent>{emissoes.map((e: any) => <SelectItem key={e.isin} value={e.isin}>{e.isin}{e.ticker ? ' (' + e.ticker + ')' : ''} — {empresasMap.get(e.cnpj_emissor) ?? e.cnpj_emissor}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-xs mb-1.5 block">Responsável interno</Label>
                <Select value={form.responsavel_id || '__none__'} onValueChange={v => set('responsavel_id', v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent><SelectItem value="__none__">— Nenhum</SelectItem>{profiles.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs mb-1.5 block">Título *</Label>
                <Input value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder={form.tipo === 'Fato Relevante' ? 'Ex: Fato Relevante — Aquisição...' : form.tipo === 'Reunião de Debenturistas' ? 'Ex: 3ª Reunião de Debenturistas...' : 'Ex: AGO 2025 — Aprovação das demonstrações...'} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs mb-1.5 block">{form.tipo === 'Fato Relevante' ? 'Conteúdo / Resumo' : 'Pauta'}</Label>
                <Textarea rows={3} value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder={form.tipo === 'Fato Relevante' ? 'Resumo do fato relevante...' : 'Itens da pauta...'} />
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">Data *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-sm font-normal', !form.data_evento && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />{form.data_evento ? format(form.data_evento, 'dd/MM/yyyy') : 'Selecionar data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={form.data_evento} onSelect={d => set('data_evento', d)} locale={ptBR} /></PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Horário</Label>
                <Input type="time" value={form.hora_evento} onChange={e => set('hora_evento', e.target.value)} />
              </div>
              {temVoto(form.tipo) && (
                <div>
                  <Label className="text-xs mb-1.5 block">Prazo limite para votos</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn('w-full justify-start text-sm font-normal', !form.data_limite_voto && 'text-muted-foreground')}>
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />{form.data_limite_voto ? format(form.data_limite_voto, 'dd/MM/yyyy') : 'Selecionar'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={form.data_limite_voto} onSelect={d => set('data_limite_voto', d)} locale={ptBR} /></PopoverContent>
                  </Popover>
                </div>
              )}
              <div>
                <Label className="text-xs mb-1.5 block">Modalidade</Label>
                <Select value={form.modalidade || '__none__'} onValueChange={v => set('modalidade', v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent><SelectItem value="__none__">— Não informada</SelectItem>{(['Presencial','Híbrida','Digital'] as Modalidade[]).map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs mb-1.5 block">Local / Link de acesso</Label>
                <Input value={form.local_link} onChange={e => set('local_link', e.target.value)} placeholder="Endereço ou URL da reunião online" />
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">Status</Label>
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(['Agendado','Realizado','Cancelado','Adiado'] as EventoStatus[]).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {temVoto(form.tipo) && (
                <div>
                  <Label className="text-xs mb-1.5 block">Quórum atingido</Label>
                  <Select value={form.quorum_atingido || '__none__'} onValueChange={v => set('quorum_atingido', v === '__none__' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent><SelectItem value="__none__">— Não informado</SelectItem><SelectItem value="true">Sim</SelectItem><SelectItem value="false">Não</SelectItem></SelectContent>
                  </Select>
                </div>
              )}
              {form.status === 'Realizado' && (
                <div className="col-span-2">
                  <Label className="text-xs mb-1.5 block">Resultado / Deliberações</Label>
                  <Textarea rows={2} value={form.resultado} onChange={e => set('resultado', e.target.value)} placeholder="Descreva as deliberações e resultado..." />
                </div>
              )}
            </div>
            {temVoto(form.tipo) && (<>
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1.5 block">Posicionamento / Voto da Butia</Label>
                  <Select value={form.voto_butia || '__none__'} onValueChange={v => set('voto_butia', v === '__none__' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="— Sem posição definida" /></SelectTrigger>
                    <SelectContent><SelectItem value="__none__">— Sem posição definida</SelectItem>{(['A favor','Contra','Abstenção','Não votou'] as VotoButia[]).map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs mb-1.5 block">Justificativa do voto</Label>
                  <Textarea rows={2} value={form.justificativa_voto} onChange={e => set('justificativa_voto', e.target.value)} placeholder="Fundamento da decisão de voto da Butia..." />
                </div>
              </div>
            </>)}
            <div>
              <Label className="text-xs mb-1.5 block">Observações internas</Label>
              <Textarea rows={2} value={form.observacoes} onChange={e => set('observacoes', e.target.value)} placeholder="Anotações internas da equipe..." />
            </div>
            <Separator />
            <div>
              <Label className="text-xs mb-2 block">Documentos e links (edital, ata, apresentação)</Label>
              {form.documentos.length > 0 && (
                <div className="mb-3 flex flex-col gap-1.5">
                  {form.documentos.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 bg-muted/30 rounded px-3 py-1.5 text-sm">
                      <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
                      <a href={d.url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate flex-1">{d.nome}</a>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removerDoc(i)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input placeholder="Nome" value={novoDoc.nome} onChange={e => setNovoDoc(d => ({ ...d, nome: e.target.value }))} className="text-sm w-36 shrink-0" />
                <Input placeholder="URL do documento..." value={novoDoc.url} onChange={e => setNovoDoc(d => ({ ...d, url: e.target.value }))} className="text-sm flex-1" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarDoc(); } }} />
                <Button variant="outline" size="sm" onClick={adicionarDoc} className="shrink-0">Adicionar</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={fecharForm}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={upsert.isPending}>
              {upsert.isPending && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
              {editando ? 'Salvar alterações' : 'Criar evento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detalheEvento} onOpenChange={open => { if (!open) setDetalhe(null); }}>
        {detalheEvento && (() => {
          const ev = detalheEvento;
          const scfg = STATUS_CFG[ev.status];
          return (
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-start gap-2 flex-wrap">
                  <Badge variant="outline" className={cn('text-[10px] mt-0.5 shrink-0', TIPO_COLOR[ev.tipo])}>{ev.tipo}</Badge>
                  <DialogTitle className="text-base leading-snug">{ev.titulo}</DialogTitle>
                </div>
              </DialogHeader>
              <div className="grid gap-3.5 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                  {ev.cnpj_empresa ? <><Building2 className="h-3.5 w-3.5 shrink-0" />{empresasMap.get(ev.cnpj_empresa) ?? ev.cnpj_empresa}</>
                    : <><FileText className="h-3.5 w-3.5 shrink-0" />{isinLabel(ev.isin ?? '')}</>}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                  <span><strong className="text-foreground">Data:</strong> {format(parseISO(ev.data_evento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}{ev.hora_evento ? ' às ' + ev.hora_evento.slice(0,5) : ''}</span>
                  {ev.modalidade && <span><strong className="text-foreground">Modalidade:</strong> {ev.modalidade}</span>}
                  {ev.data_limite_voto && <span><strong className="text-foreground">Prazo voto:</strong> {format(parseISO(ev.data_limite_voto), 'dd/MM/yyyy')}</span>}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant="outline" className={cn('text-[10px] flex items-center gap-1', scfg.cls)}>{scfg.icon}{scfg.label}</Badge>
                  {ev.quorum_atingido !== null && <span className="text-xs text-muted-foreground">Quórum: {ev.quorum_atingido ? '✓ Atingido' : '✗ Não atingido'}</span>}
                </div>
                {ev.local_link && <div><strong>Local / link:</strong> <a href={ev.local_link} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">{ev.local_link}</a></div>}
                {ev.descricao && <div><strong>{ev.tipo === 'Fato Relevante' ? 'Conteúdo:' : 'Pauta:'}</strong><p className="text-muted-foreground mt-0.5 whitespace-pre-wrap">{ev.descricao}</p></div>}
                {ev.voto_butia && <div className="flex items-center gap-2"><strong>Voto Butia:</strong><Badge variant="outline" className={cn('text-[10px]', VOTO_CLS[ev.voto_butia])}>{ev.voto_butia}</Badge></div>}
                {ev.justificativa_voto && <div><strong>Justificativa:</strong><p className="text-muted-foreground mt-0.5">{ev.justificativa_voto}</p></div>}
                {ev.resultado && <div><strong>Resultado:</strong><p className="text-muted-foreground mt-0.5">{ev.resultado}</p></div>}
                {ev.observacoes && <div><strong>Observações:</strong><p className="text-muted-foreground mt-0.5">{ev.observacoes}</p></div>}
                {ev.responsavel_id && <div><strong>Responsável:</strong> {nomePerfil(ev.responsavel_id)}</div>}
                {(ev.documentos ?? []).length > 0 && (
                  <div><strong>Documentos:</strong>
                    <div className="mt-1.5 flex flex-col gap-1">
                      {ev.documentos.map((d, i) => <a key={i} href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-primary hover:underline"><FileText className="h-3.5 w-3.5 shrink-0" />{d.nome}</a>)}
                    </div>
                  </div>
                )}
                <Separator />
                {ev.url_b3 && <a href={ev.url_b3} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1"><ExternalLink className="h-3 w-3" /> Abrir notícia na B3</a>}
                <ParticipacoesPanel
                  assembleiaId={ev.id}
                  cnpjEmissor={ev.cnpj_emissor ?? ev.cnpj_empresa}
                  tipo={ev.tipo}
                  isinsVinculados={ev.isins_vinculados ?? []}
                  canWrite={canWrite}
                />
              </div>
              <DialogFooter>
                {canWrite && <Button variant="outline" size="sm" onClick={() => abrirEditar(ev)}><Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar</Button>}
                <Button variant="outline" size="sm" onClick={() => setDetalhe(null)}>Fechar</Button>
              </DialogFooter>
            </DialogContent>
          );
        })()}
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir evento?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteId && deletar.mutate(deleteId)}>
              {deletar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
                  }
