import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Search, ExternalLink, Plus, Pencil, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { fetchAllPaged } from '@/utils/analiseStatus';
import { RatingBadge } from '@/components/ratings/RatingBadge';

import { IssuerRatingHistoryDialog } from '@/components/ratings/IssuerRatingHistoryDialog';
import { History } from 'lucide-react';

const TIPOS = ['FINANCEIRO', 'CORPORATIVO', 'FIDC', 'CRA', 'CDB', 'Fundo', 'Título Público'];

export default function EmpresasPage() {
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState('all');
  const [setorFilter, setSetorFilter] = useState('all');
  const [grupoFilter, setGrupoFilter] = useState('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [formNome, setFormNome] = useState('');
  const [formCnpj, setFormCnpj] = useState('');
  const [formTipo, setFormTipo] = useState('CORPORATIVO');
  const [formSetor, setFormSetor] = useState('');
  const [formRating, setFormRating] = useState('');
  const [formGrupo, setFormGrupo] = useState('');
  const [formCodigo, setFormCodigo] = useState('');

  // Rating edit state
  const [editingRatingId, setEditingRatingId] = useState<string | null>(null);
  const [editRatingValue, setEditRatingValue] = useState('');
  const [historyFor, setHistoryFor] = useState<{ cnpj: string; nome: string } | null>(null);

  const canEdit = currentUser?.funcao === 'Gestor' || currentUser?.funcao === 'Coordenação/Especialista';

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ['empresas'],
    queryFn: async () =>
      fetchAllPaged<any>((from, to) =>
        supabase.from('empresas').select('*').order('nome').range(from, to),
      ),
  });

  const { data: setoresOficiais = [] } = useQuery({
    queryKey: ['setores-oficiais'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('setores' as any)
        .select('nome')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return (data ?? []).map((r: any) => r.nome as string);
    },
  });

  const { data: analisesCounts = {} } = useQuery({
    queryKey: ['analises-ativas-count'],
    queryFn: async () => {
      const data = await fetchAllPaged<any>((from, to) =>
        supabase.from('analises').select('empresa_id, status, versao, data_conclusao').range(from, to),
      );

      // Group by empresa_id, keep only max versao per empresa
      const grouped = new Map<string, typeof data>();
      (data || []).forEach(row => {
        const list = grouped.get(row.empresa_id) || [];
        list.push(row);
        grouped.set(row.empresa_id, list);
      });

      const counts: Record<string, number> = {};
      grouped.forEach((items, empresaId) => {
        const maxVersao = Math.max(...items.map(i => i.versao || 1));
        const latest = items.filter(i => (i.versao || 1) === maxVersao);
        const active = latest.filter(i => {
          if (['Reprovada', 'Concluído', 'Rejeitado'].includes(i.status)) return false;
          // Exclude expired (Aprovada > 1 year old)
          if (i.status === 'Aprovada' && i.data_conclusao) {
            const conclusao = new Date(i.data_conclusao.split('T')[0]);
            const umAnoAtras = new Date();
            umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);
            if (conclusao < umAnoAtras) return false;
          }
          return true;
        });
        if (active.length > 0) counts[empresaId] = active.length;
      });
      return counts;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      // Check if CNPJ already exists
      const { data: existing } = await supabase
        .from('empresas')
        .select('nome')
        .eq('cnpj', formCnpj.trim())
        .maybeSingle();
      if (existing) throw new Error(`CNPJ já cadastrado para: ${existing.nome}`);

      const { error } = await supabase.from('empresas').insert({
        nome: formNome.trim(),
        cnpj: formCnpj.trim(),
        tipo: formTipo,
        setor: formSetor.trim() || null,
        rating: formRating.trim() || null,
        grupo_economico: formGrupo.trim() || null,
        codigo_emissor: formCodigo.trim().toUpperCase() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      toast.success('Empresa criada com sucesso');
      setCreateOpen(false);
      setFormNome(''); setFormCnpj(''); setFormTipo('CORPORATIVO'); setFormSetor(''); setFormRating(''); setFormGrupo(''); setFormCodigo('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao criar empresa');
    },
  });

  const updateRatingMutation = useMutation({
    mutationFn: async ({ cnpj, rating }: { id: string; cnpj: string; rating: string }) => {
      const normCnpj = (cnpj || '').replace(/[^0-9]/g, '');
      const trimmed = rating.trim();
      if (!trimmed) {
        // Clear rating: remove all issuer_ratings entries for this CNPJ + clear empresas.rating
        const { error: delErr } = await supabase.from('issuer_ratings').delete().eq('cnpj', normCnpj);
        if (delErr) throw delErr;
        const { error: clearErr } = await supabase.from('empresas').update({ rating: null }).eq('cnpj', cnpj);
        if (clearErr) throw clearErr;
        return;
      }
      const { error } = await supabase.from('issuer_ratings').insert({
        cnpj: normCnpj,
        rating: trimmed,
        agencia: null,
        data_rating: new Date().toISOString().slice(0, 10),
        observacao: 'Atualização rápida via lista de empresas',
        created_by: currentUser?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      queryClient.invalidateQueries({ queryKey: ['resolvedRating'] });
      queryClient.invalidateQueries({ queryKey: ['issuer_ratings'] });
      toast.success('Rating atualizado');
      setEditingRatingId(null);
    },
    onError: () => toast.error('Erro ao atualizar rating'),
  });

  const tipos = useMemo(() => [...new Set(empresas.map((e: any) => e.tipo).filter(Boolean))].sort(), [empresas]);
  const setores = useMemo(() => [...new Set(empresas.map((e: any) => e.setor).filter(Boolean))].sort(), [empresas]);
  const grupos = useMemo(() => [...new Set(empresas.map((e: any) => e.grupo_economico).filter(Boolean))].sort(), [empresas]);

  const filtered = useMemo(() => empresas.filter((e: any) => {
    const q = search.toLowerCase();
    const matchSearch = e.nome?.toLowerCase().includes(q) || e.cnpj?.includes(search) || e.grupo_economico?.toLowerCase().includes(q);
    const matchTipo = tipoFilter === 'all' || e.tipo === tipoFilter;
    const matchSetor = setorFilter === 'all' || e.setor === setorFilter;
    const matchGrupo = grupoFilter === 'all' || e.grupo_economico === grupoFilter;
    return matchSearch && matchTipo && matchSetor && matchGrupo;
  }), [empresas, search, tipoFilter, setorFilter, grupoFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );
  // reset page on filter change
  useEffect(() => { setPage(1); }, [search, tipoFilter, setorFilter, grupoFilter]);


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-foreground">Empresas / Emissores</h2>
        {canEdit && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 text-xs gap-1">
                <Plus className="h-3.5 w-3.5" /> Nova Empresa
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-card border-border">
              <DialogHeader>
                <DialogTitle>Criar Nova Empresa</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div>
                  <Label className="text-xs">Nome *</Label>
                  <Input value={formNome} onChange={e => setFormNome(e.target.value)} className="h-8 text-sm bg-background" />
                </div>
                <div>
                  <Label className="text-xs">CNPJ *</Label>
                  <Input value={formCnpj} onChange={e => setFormCnpj(e.target.value)} placeholder="00.000.000/0001-00" className="h-8 text-sm bg-background" />
                </div>
                <div>
                  <Label className="text-xs">Código Emissor *</Label>
                  <Input value={formCodigo} onChange={e => setFormCodigo(e.target.value.toUpperCase())} placeholder="Ex: TTEN" maxLength={10} className="h-8 text-sm bg-background font-mono" />
                </div>
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={formTipo} onValueChange={setFormTipo}>
                    <SelectTrigger className="h-8 text-sm bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Grupo Econômico</Label>
                  <Input value={formGrupo} onChange={e => setFormGrupo(e.target.value)} className="h-8 text-sm bg-background" />
                </div>
                <div>
                  <Label className="text-xs">Setor</Label>
                  <Select value={formSetor || 'none'} onValueChange={v => setFormSetor(v === 'none' ? '' : v)}>
                    <SelectTrigger className="h-8 text-sm bg-background"><SelectValue placeholder="Selecione um setor" /></SelectTrigger>
                    <SelectContent className="bg-card border-border max-h-64">
                      <SelectItem value="none">— Sem setor —</SelectItem>
                      {setoresOficiais.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Rating</Label>
                  <Input value={formRating} onChange={e => setFormRating(e.target.value)} className="h-8 text-sm bg-background" />
                </div>
              </div>
              <DialogFooter>
                <Button size="sm" disabled={!formNome.trim() || !formCnpj.trim() || !formCodigo.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
                  {createMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-0 sm:max-w-xs">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar nome, CNPJ ou grupo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm bg-surface-1 border-border" />
        </div>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-full sm:w-40 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">Todos os tipos</SelectItem>
            {tipos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={setorFilter} onValueChange={setSetorFilter}>
          <SelectTrigger className="w-full sm:w-48 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Setor" /></SelectTrigger>
          <SelectContent className="bg-card border-border max-h-60">
            <SelectItem value="all">Todos os setores</SelectItem>
            {setores.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={grupoFilter} onValueChange={setGrupoFilter}>
          <SelectTrigger className="w-full sm:w-48 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Grupo Econômico" /></SelectTrigger>
          <SelectContent className="bg-card border-border max-h-60">
            <SelectItem value="all">Todos os grupos</SelectItem>
            {grupos.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} empresa(s) encontrada(s)</p>

      <Card className="bg-card border-border">
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : (
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-[11px] h-9">Nome</TableHead>
                  <TableHead className="text-[11px] h-9">Código</TableHead>
                  <TableHead className="text-[11px] h-9">CNPJ</TableHead>
                  <TableHead className="text-[11px] h-9">Tipo</TableHead>
                  <TableHead className="text-[11px] h-9">Grupo Econômico</TableHead>
                  <TableHead className="text-[11px] h-9">Setor</TableHead>
                  <TableHead className="text-[11px] h-9">Rating</TableHead>
                  <TableHead className="text-[11px] h-9">Análises Ativas</TableHead>
                  <TableHead className="text-[11px] h-9 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((e: any) => {
                  const ativas = analisesCounts[e.cnpj] || 0;
                  return (
                    <TableRow key={e.id} className="border-border group">
                      <TableCell className="text-sm py-2 font-medium max-w-[280px] truncate">{e.nome}</TableCell>
                      <TableCell className="py-2">
                        {e.codigo_emissor ? (
                          <Badge variant="outline" className="text-[10px] font-mono bg-primary/10 text-primary border-primary/30">{e.codigo_emissor}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs py-2 text-muted-foreground font-mono">{e.cnpj}</TableCell>
                      <TableCell className="py-2"><Badge variant="outline" className="text-[10px]">{e.tipo || '—'}</Badge></TableCell>
                      <TableCell className="text-xs py-2 text-muted-foreground">{e.grupo_economico || '—'}</TableCell>
                      <TableCell className="text-xs py-2 text-muted-foreground">{e.setor || '—'}</TableCell>
                      <TableCell className="py-2">
                        {editingRatingId === e.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editRatingValue}
                              onChange={ev => setEditRatingValue(ev.target.value)}
                              className="h-6 w-20 text-xs bg-background"
                              autoFocus
                              onKeyDown={ev => {
                                if (ev.key === 'Enter') updateRatingMutation.mutate({ id: e.id, cnpj: e.cnpj, rating: editRatingValue });
                                if (ev.key === 'Escape') setEditingRatingId(null);
                              }}
                            />
                            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => updateRatingMutation.mutate({ id: e.id, cnpj: e.cnpj, rating: editRatingValue })}>
                              <Check className="h-3 w-3 text-primary" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setEditingRatingId(null)}>
                              <X className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <RatingCell
                            cnpj={e.cnpj}
                            currentRating={e.rating}
                            canEdit={!!canEdit}
                            onEdit={() => { setEditingRatingId(e.id); setEditRatingValue(e.rating || ''); }}
                            onOpenHistory={() => setHistoryFor({ cnpj: e.cnpj, nome: e.nome })}
                          />
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        {ativas > 0 ? (
                          <Badge variant="outline" className="text-[10px] bg-primary/15 text-primary border-primary/30">{ativas}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-muted/30 text-muted-foreground border-border">0</Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <Link to={`/empresas/${encodeURIComponent(e.cnpj)}`}>
                          <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1">
                            <ExternalLink className="h-3 w-3" /> Detalhe
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Página {currentPage} de {totalPages} · mostrando {pageItems.length} de {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-7 px-2" disabled={currentPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2" disabled={currentPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <IssuerRatingHistoryDialog
        open={!!historyFor}
        onOpenChange={(o) => { if (!o) setHistoryFor(null); }}
        cnpj={historyFor?.cnpj || ''}
        emissorNome={historyFor?.nome}
      />
    </div>
  );
}

function RatingCell({ cnpj, currentRating, canEdit, onEdit, onOpenHistory }: { cnpj: string; currentRating?: string | null; canEdit: boolean; onEdit: () => void; onOpenHistory: () => void; }) {
  // Lightweight: use empresas.rating (mirrored) for badge to avoid one RPC per row.
  return (
    <div className="flex items-center gap-1">
      <RatingBadge
        rating={currentRating || null}
        source={currentRating ? 'emissor' : 'nr'}
      />
      <Button size="icon" variant="ghost" className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:opacity-100" onClick={onOpenHistory} title="Histórico de rating">
        <History className="h-3 w-3 text-muted-foreground" />
      </Button>
      {canEdit && (
        <Button size="icon" variant="ghost" className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:opacity-100" onClick={onEdit} title="Editar rating">
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </Button>
      )}
    </div>
  );
}

