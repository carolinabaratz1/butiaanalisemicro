import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, ExternalLink, AlertTriangle, Plus, Pencil, Check, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const TIPOS = ['FINANCEIRO', 'CORPORATIVO', 'FIDC', 'CRA', 'CDB', 'Fundo', 'Título Público'];

export default function EmpresasPage() {
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState('all');
  const [setorFilter, setSetorFilter] = useState('all');
  const { currentUser, permissions } = useAuth();
  const queryClient = useQueryClient();

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [formNome, setFormNome] = useState('');
  const [formCnpj, setFormCnpj] = useState('');
  const [formTipo, setFormTipo] = useState('CORPORATIVO');
  const [formSetor, setFormSetor] = useState('');
  const [formRating, setFormRating] = useState('');

  // Rating edit state
  const [editingRatingId, setEditingRatingId] = useState<string | null>(null);
  const [editRatingValue, setEditRatingValue] = useState('');

  const canEdit = currentUser?.funcao === 'Gestor' || currentUser?.funcao === 'Coordenação/Especialista';

  // Fetch empresas from DB
  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ['empresas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data;
    },
  });

  // Fetch active analysis counts
  const { data: analisesCounts = {} } = useQuery({
    queryKey: ['analises-ativas-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('analises')
        .select('empresa_id, status')
        .not('status', 'in', '("Concluído","Rejeitado","Reprovado")');
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach(row => {
        counts[row.empresa_id] = (counts[row.empresa_id] || 0) + 1;
      });
      return counts;
    },
  });

  // Create empresa mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('empresas').insert({
        nome: formNome.trim(),
        cnpj: formCnpj.trim(),
        tipo: formTipo,
        setor: formSetor.trim() || null,
        rating: formRating.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      toast.success('Empresa criada com sucesso');
      setCreateOpen(false);
      setFormNome(''); setFormCnpj(''); setFormTipo('CORPORATIVO'); setFormSetor(''); setFormRating('');
    },
    onError: (err: any) => {
      toast.error(err.message?.includes('duplicate') ? 'CNPJ já cadastrado' : 'Erro ao criar empresa');
    },
  });

  // Update rating mutation
  const updateRatingMutation = useMutation({
    mutationFn: async ({ id, rating }: { id: string; rating: string }) => {
      const { error } = await supabase.from('empresas').update({ rating: rating || null }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      toast.success('Rating atualizado');
      setEditingRatingId(null);
    },
    onError: () => toast.error('Erro ao atualizar rating'),
  });

  const tipos = useMemo(() => [...new Set(empresas.map((e: any) => e.tipo).filter(Boolean))].sort(), [empresas]);
  const setores = useMemo(() => [...new Set(empresas.map((e: any) => e.setor).filter(Boolean))].sort(), [empresas]);

  const filtered = useMemo(() => empresas.filter((e: any) => {
    const q = search.toLowerCase();
    const matchSearch = e.nome?.toLowerCase().includes(q) || e.cnpj?.includes(search);
    const matchTipo = tipoFilter === 'all' || e.tipo === tipoFilter;
    const matchSetor = setorFilter === 'all' || e.setor === setorFilter;
    return matchSearch && matchTipo && matchSetor;
  }), [empresas, search, tipoFilter, setorFilter]);

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
                  <Label className="text-xs">Tipo</Label>
                  <Select value={formTipo} onValueChange={setFormTipo}>
                    <SelectTrigger className="h-8 text-sm bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Setor</Label>
                  <Input value={formSetor} onChange={e => setFormSetor(e.target.value)} className="h-8 text-sm bg-background" />
                </div>
                <div>
                  <Label className="text-xs">Rating</Label>
                  <Input value={formRating} onChange={e => setFormRating(e.target.value)} className="h-8 text-sm bg-background" />
                </div>
              </div>
              <DialogFooter>
                <Button size="sm" disabled={!formNome.trim() || !formCnpj.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
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
          <Input placeholder="Buscar por nome ou CNPJ..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm bg-surface-1 border-border" />
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
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : (
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-[11px] h-9">Nome</TableHead>
                  <TableHead className="text-[11px] h-9">CNPJ</TableHead>
                  <TableHead className="text-[11px] h-9">Tipo</TableHead>
                  <TableHead className="text-[11px] h-9">Setor</TableHead>
                  <TableHead className="text-[11px] h-9">Rating</TableHead>
                  <TableHead className="text-[11px] h-9">Análises Ativas</TableHead>
                  <TableHead className="text-[11px] h-9 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 50).map((e: any) => {
                  const ativas = analisesCounts[e.cnpj] || 0;
                  return (
                    <TableRow key={e.id} className="border-border group">
                      <TableCell className="text-sm py-2 font-medium">{e.nome}</TableCell>
                      <TableCell className="text-xs py-2 text-muted-foreground font-mono">{e.cnpj}</TableCell>
                      <TableCell className="py-2"><Badge variant="outline" className="text-[10px]">{e.tipo || '—'}</Badge></TableCell>
                      <TableCell className="text-sm py-2 text-muted-foreground">{e.setor || '—'}</TableCell>
                      <TableCell className="py-2">
                        {editingRatingId === e.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editRatingValue}
                              onChange={ev => setEditRatingValue(ev.target.value)}
                              className="h-6 w-20 text-xs bg-background"
                              autoFocus
                              onKeyDown={ev => {
                                if (ev.key === 'Enter') updateRatingMutation.mutate({ id: e.id, rating: editRatingValue });
                                if (ev.key === 'Escape') setEditingRatingId(null);
                              }}
                            />
                            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => updateRatingMutation.mutate({ id: e.id, rating: editRatingValue })}>
                              <Check className="h-3 w-3 text-primary" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setEditingRatingId(null)}>
                              <X className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="text-sm">{e.rating || '—'}</span>
                            {canEdit && (
                              <Button size="icon" variant="ghost" className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:opacity-100" onClick={() => { setEditingRatingId(e.id); setEditRatingValue(e.rating || ''); }}>
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
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
          {filtered.length > 50 && <p className="text-xs text-muted-foreground text-center py-2">Mostrando 50 de {filtered.length} resultados. Refine a busca.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
