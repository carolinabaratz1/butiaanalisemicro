import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { FUNDOS_BUTIA } from '@/data/fundos';

interface Props {
  assembleiaId: string;
  cnpjEmissor: string | null;
  tipo: string;
  isinsVinculados: string[];
  canWrite: boolean;
}

const VOTOS = ['A favor', 'Contra', 'Abstenção', 'Não votou'] as const;
const VOTO_CLS: Record<string, string> = {
  'A favor': 'bg-status-success/15 text-status-success border-status-success/30',
  'Contra': 'bg-status-danger/15 text-status-danger border-status-danger/30',
  'Abstenção': 'bg-status-warning/15 text-status-warning border-status-warning/30',
  'Não votou': 'bg-muted/50 text-muted-foreground border-border',
};

export function ParticipacoesPanel({ assembleiaId, cnpjEmissor, tipo, isinsVinculados, canWrite }: Props) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [novo, setNovo] = useState({ fundo: '', isin: '__none__', voto: '', representante: '', observacoes: '' });
  const [vinculos, setVinculos] = useState<string[]>(isinsVinculados ?? []);
  const isAGDEB = tipo === 'AGDEB';

  // Emissões do emissor (para AGDEB)
  const { data: emissoesEmissor = [] } = useQuery({
    queryKey: ['emissoes-emissor', cnpjEmissor],
    enabled: !!cnpjEmissor && isAGDEB,
    queryFn: async () => {
      const { data } = await supabase.from('emissoes').select('isin, ticker').eq('cnpj_emissor', cnpjEmissor!);
      return data ?? [];
    },
  });

  const { data: participacoes = [] } = useQuery({
    queryKey: ['participacoes', assembleiaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assembleia_participacoes' as any)
        .select('*')
        .eq('assembleia_id', assembleiaId)
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const isinsParaVoto = useMemo(() => {
    if (isAGDEB) return vinculos.length > 0 ? vinculos : emissoesEmissor.map((e: any) => e.isin);
    return [];
  }, [isAGDEB, vinculos, emissoesEmissor]);

  const salvarVinculos = useMutation({
    mutationFn: async (isins: string[]) => {
      const triagem = isins.length > 0 ? 'com_posicao' : 'pendente_vinculo';
      const { error } = await supabase.from('assembleias' as any).update({ isins_vinculados: isins, triagem }).eq('id', assembleiaId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assembleias'] }); toast({ title: 'Vínculos salvos' }); },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const adicionar = useMutation({
    mutationFn: async () => {
      if (!novo.fundo || !novo.voto) throw new Error('Selecione fundo e voto');
      const { error } = await supabase.from('assembleia_participacoes' as any).insert({
        assembleia_id: assembleiaId,
        fundo: novo.fundo,
        isin: novo.isin === '__none__' ? null : novo.isin,
        voto: novo.voto,
        representante: novo.representante || null,
        observacoes: novo.observacoes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['participacoes', assembleiaId] });
      setNovo({ fundo: '', isin: '__none__', voto: '', representante: '', observacoes: '' });
      setAdding(false);
      toast({ title: 'Participação registrada' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assembleia_participacoes' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['participacoes', assembleiaId] }),
  });

  function toggleVinculo(isin: string) {
    setVinculos(v => v.includes(isin) ? v.filter(x => x !== isin) : [...v, isin]);
  }

  return (
    <div className="flex flex-col gap-4">
      {isAGDEB && (
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Vínculo de Emissões</Label>
          {emissoesEmissor.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma emissão cadastrada para este emissor.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {emissoesEmissor.map((e: any) => (
                <label key={e.isin} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={vinculos.includes(e.isin)} onCheckedChange={() => canWrite && toggleVinculo(e.isin)} disabled={!canWrite} />
                  <span className="font-mono text-xs">{e.isin}</span>
                  {e.ticker && <span className="text-xs text-muted-foreground">({e.ticker})</span>}
                </label>
              ))}
              {canWrite && (
                <Button size="sm" variant="outline" className="self-start mt-1" onClick={() => salvarVinculos.mutate(vinculos)} disabled={salvarVinculos.isPending}>
                  {salvarVinculos.isPending && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                  Salvar vínculos
                </Button>
              )}
              {vinculos.length === 0 && (
                <Badge variant="outline" className="self-start text-[10px] mt-1 bg-status-warning/15 text-status-warning border-status-warning/30">Pendente vinculação</Badge>
              )}
            </div>
          )}
          <Separator className="mt-4" />
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Participação da Butiá</Label>
          {canWrite && !adding && (
            <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setAdding(true)}><Plus className="h-3 w-3" /> Registrar</Button>
          )}
        </div>

        {participacoes.length === 0 && !adding && (
          <p className="text-xs text-muted-foreground">Nenhuma participação registrada.</p>
        )}

        {participacoes.length > 0 && (
          <div className="flex flex-col gap-1.5 mb-2">
            {participacoes.map(p => (
              <div key={p.id} className="flex items-center gap-2 text-xs bg-muted/20 rounded px-2 py-1.5">
                <span className="font-medium flex-1 min-w-0 truncate">{p.fundo}</span>
                {p.isin && <span className="font-mono text-muted-foreground">{p.isin}</span>}
                <Badge variant="outline" className={`text-[10px] ${VOTO_CLS[p.voto] ?? ''}`}>{p.voto}</Badge>
                {p.representante && <span className="text-muted-foreground hidden sm:inline truncate max-w-[100px]">{p.representante}</span>}
                {canWrite && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => excluir.mutate(p.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {adding && (
          <div className="border border-border rounded p-3 grid gap-2 bg-muted/10">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px]">Fundo *</Label>
                <Select value={novo.fundo} onValueChange={v => setNovo(n => ({ ...n, fundo: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>{FUNDOS_BUTIA.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">Voto *</Label>
                <Select value={novo.voto} onValueChange={v => setNovo(n => ({ ...n, voto: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>{VOTOS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {isAGDEB && (
                <div className="col-span-2">
                  <Label className="text-[11px]">ISIN</Label>
                  <Select value={novo.isin} onValueChange={v => setNovo(n => ({ ...n, isin: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="N/A" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— N/A</SelectItem>
                      {(isinsParaVoto.length > 0 ? isinsParaVoto : emissoesEmissor.map((e: any) => e.isin)).map(i => (
                        <SelectItem key={i} value={i}>{i}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="col-span-2">
                <Label className="text-[11px]">Representante</Label>
                <Input className="h-8 text-xs" value={novo.representante} onChange={e => setNovo(n => ({ ...n, representante: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label className="text-[11px]">Observações</Label>
                <Textarea rows={2} className="text-xs" value={novo.observacoes} onChange={e => setNovo(n => ({ ...n, observacoes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
              <Button size="sm" onClick={() => adicionar.mutate()} disabled={adicionar.isPending}>
                {adicionar.isPending && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}Salvar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
