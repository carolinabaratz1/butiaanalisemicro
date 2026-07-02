import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

export function IssuerLimitDialog({
  open, onOpenChange, cnpj, existing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cnpj: string;
  existing?: any;
}) {
  const { currentUser } = useAuth();
  const qc = useQueryClient();
  const [limitValue, setLimitValue] = useState('');
  const [limitPct, setLimitPct] = useState('');
  const [limitType, setLimitType] = useState('valor');
  const [approvedBy, setApprovedBy] = useState('');
  const [committeeDate, setCommitteeDate] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setLimitValue(existing?.limit_value?.toString() ?? '');
      setLimitPct(existing?.limit_pct_nav != null ? (existing.limit_pct_nav * 100).toString() : '');
      setLimitType(existing?.limit_type ?? 'valor');
      setApprovedBy(existing?.approved_by ?? '');
      setCommitteeDate(existing?.committee_date ?? '');
      setEffectiveFrom(existing?.effective_from ?? '');
      setEffectiveTo(existing?.effective_to ?? '');
      setSource(existing?.source ?? '');
      setNotes(existing?.notes ?? '');
    }
  }, [open, existing]);

  const canEdit = currentUser?.funcao === 'Gestor' || currentUser?.funcao === 'Risco e Compliance';

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        cnpj_emissor: cnpj,
        limit_value: limitValue ? Number(limitValue) : null,
        limit_pct_nav: limitPct ? Number(limitPct) / 100 : null,
        limit_type: limitType,
        approved_by: approvedBy || null,
        committee_date: committeeDate || null,
        effective_from: effectiveFrom || null,
        effective_to: effectiveTo || null,
        source: source || null,
        notes: notes || null,
        created_by: currentUser?.id ?? null,
      };
      if (existing?.id) {
        const { error } = await (supabase as any).from('issuer_limits').update(payload).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('issuer_limits').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emissores-gestao'] });
      qc.invalidateQueries({ queryKey: ['issuer-limits', cnpj] });
      toast.success('Limite salvo');
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader><DialogTitle>{existing ? 'Editar limite' : 'Novo limite'} · {cnpj}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2 text-sm">
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={limitType} onValueChange={setLimitType}>
              <SelectTrigger className="h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="valor">Valor (R$)</SelectItem>
                <SelectItem value="percentual">% do PL</SelectItem>
                <SelectItem value="ambos">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Limite (R$)</Label>
            <Input type="number" value={limitValue} onChange={e => setLimitValue(e.target.value)} className="h-8 text-sm bg-background" />
          </div>
          <div>
            <Label className="text-xs">Limite (% PL)</Label>
            <Input type="number" step="0.01" value={limitPct} onChange={e => setLimitPct(e.target.value)} className="h-8 text-sm bg-background" />
          </div>
          <div>
            <Label className="text-xs">Aprovado por</Label>
            <Input value={approvedBy} onChange={e => setApprovedBy(e.target.value)} className="h-8 text-sm bg-background" />
          </div>
          <div>
            <Label className="text-xs">Data do comitê</Label>
            <Input type="date" value={committeeDate} onChange={e => setCommitteeDate(e.target.value)} className="h-8 text-sm bg-background" />
          </div>
          <div>
            <Label className="text-xs">Vigente a partir</Label>
            <Input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} className="h-8 text-sm bg-background" />
          </div>
          <div>
            <Label className="text-xs">Vigente até</Label>
            <Input type="date" value={effectiveTo} onChange={e => setEffectiveTo(e.target.value)} className="h-8 text-sm bg-background" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Fonte</Label>
            <Input value={source} onChange={e => setSource(e.target.value)} placeholder="Comitê de risco, política, etc." className="h-8 text-sm bg-background" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="text-sm bg-background min-h-[70px]" />
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" disabled={!canEdit || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
