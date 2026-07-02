import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEmissoresGestao } from '@/hooks/useEmissoresGestao';
import { EmissoresSummaryCards } from '@/components/emissores/EmissoresSummaryCards';
import { EmissoresFilters, applyFilters, defaultFilters, type EmissoresFilterState } from '@/components/emissores/EmissoresFilters';
import { EmissoresTable } from '@/components/emissores/EmissoresTable';

const TIPOS = ['FINANCEIRO', 'CORPORATIVO', 'FIDC', 'CRA', 'CDB', 'Fundo', 'Título Público'];

export default function EmpresasPage() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = currentUser?.funcao === 'Gestor' || currentUser?.funcao === 'Coordenação/Especialista';

  const { data: rows = [], isLoading } = useEmissoresGestao();
  const [filters, setFilters] = useState<EmissoresFilterState>(defaultFilters);
  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters]);

  // Create dialog state (mantido para não perder o fluxo atual)
  const [createOpen, setCreateOpen] = useState(false);
  const [formNome, setFormNome] = useState('');
  const [formCnpj, setFormCnpj] = useState('');
  const [formTipo, setFormTipo] = useState('CORPORATIVO');
  const [formSetor, setFormSetor] = useState('');
  const [formRating, setFormRating] = useState('');
  const [formGrupo, setFormGrupo] = useState('');
  const [formCodigo, setFormCodigo] = useState('');

  const { data: setoresOficiais = [] } = useQuery({
    queryKey: ['setores-oficiais'],
    queryFn: async () => {
      const { data, error } = await supabase.from('setores' as any).select('nome').eq('ativo', true).order('nome');
      if (error) throw error;
      return (data ?? []).map((r: any) => r.nome as string);
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase.from('empresas').select('nome').eq('cnpj', formCnpj.trim()).maybeSingle();
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
      queryClient.invalidateQueries({ queryKey: ['emissores-gestao'] });
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      toast.success('Emissor criado com sucesso');
      setCreateOpen(false);
      setFormNome(''); setFormCnpj(''); setFormTipo('CORPORATIVO');
      setFormSetor(''); setFormRating(''); setFormGrupo(''); setFormCodigo('');
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao criar emissor'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Emissores</h2>
          <p className="text-xs text-muted-foreground">Visão de gestão: exposição, análise, limites e alertas por emissor.</p>
        </div>
        {canEdit && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 text-xs gap-1"><Plus className="h-3.5 w-3.5" /> Novo Emissor</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-card border-border">
              <DialogHeader><DialogTitle>Novo emissor</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div><Label className="text-xs">Nome *</Label>
                  <Input value={formNome} onChange={e => setFormNome(e.target.value)} className="h-8 text-sm bg-background" />
                </div>
                <div><Label className="text-xs">CNPJ *</Label>
                  <Input value={formCnpj} onChange={e => setFormCnpj(e.target.value)} placeholder="00.000.000/0001-00" className="h-8 text-sm bg-background" />
                </div>
                <div><Label className="text-xs">Código Emissor *</Label>
                  <Input value={formCodigo} onChange={e => setFormCodigo(e.target.value.toUpperCase())} placeholder="Ex: TTEN" maxLength={10} className="h-8 text-sm bg-background font-mono" />
                </div>
                <div><Label className="text-xs">Tipo</Label>
                  <Select value={formTipo} onValueChange={setFormTipo}>
                    <SelectTrigger className="h-8 text-sm bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Grupo Econômico</Label>
                  <Input value={formGrupo} onChange={e => setFormGrupo(e.target.value)} className="h-8 text-sm bg-background" />
                </div>
                <div><Label className="text-xs">Setor</Label>
                  <Select value={formSetor || 'none'} onValueChange={v => setFormSetor(v === 'none' ? '' : v)}>
                    <SelectTrigger className="h-8 text-sm bg-background"><SelectValue placeholder="Selecione um setor" /></SelectTrigger>
                    <SelectContent className="bg-card border-border max-h-64">
                      <SelectItem value="none">— Sem setor —</SelectItem>
                      {setoresOficiais.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Rating</Label>
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

      {isLoading ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando emissores...
          </CardContent>
        </Card>
      ) : (
        <>
          <EmissoresSummaryCards rows={filtered} />
          <EmissoresFilters filters={filters} onChange={setFilters} rows={rows} />
          <EmissoresTable rows={filtered} />
        </>
      )}
    </div>
  );
}
