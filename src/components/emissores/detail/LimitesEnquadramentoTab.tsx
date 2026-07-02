import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { IssuerLimitDialog } from './IssuerLimitDialog';
import { LimitUsageBar } from '../LimitUsageBar';
import type { EmissorGestaoRow } from '@/hooks/useEmissoresGestao';
import { cn } from '@/lib/utils';

function fmtBRL(v: number | null | undefined): string {
  if (v == null) return '—';
  if (Math.abs(v) >= 1e9) return `R$ ${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `R$ ${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `R$ ${(v / 1e3).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${(v * 100).toFixed(2)}%`;
}

export function LimitesEnquadramentoTab({ row, cnpjNorm }: { row: EmissorGestaoRow | null; cnpjNorm: string }) {
  const { currentUser } = useAuth();
  const canEdit = currentUser?.funcao === 'Gestor' || currentUser?.funcao === 'Risco e Compliance';
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: history = [] } = useQuery({
    queryKey: ['issuer-limits', cnpjNorm],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('issuer_limits')
        .select('*')
        .eq('cnpj_emissor', cnpjNorm)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!cnpjNorm,
  });

  const active = history[0];
  const exposure = row?.exposure_total ?? 0;
  const usage = row?.usage_ratio;
  const folga = active?.limit_value ? Math.max(0, active.limit_value - exposure) : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <SummaryCard label="Limite (R$)" value={active?.limit_value ? fmtBRL(active.limit_value) : '—'} />
        <SummaryCard label="Limite (% PL)" value={active?.limit_pct_nav ? `${(active.limit_pct_nav * 100).toFixed(2)}%` : '—'} />
        <SummaryCard label="Exposição atual" value={fmtBRL(exposure)} />
        <SummaryCard label="Folga" value={folga != null ? fmtBRL(folga) : '—'} />
        <SummaryCard label="Uso" value={usage != null ? `${(usage * 100).toFixed(0)}%` : '—'} highlight={row?.limit_status} />
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Enquadramento consolidado</p>
            {canEdit && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setEditing(null); setDialogOpen(true); }}>
                <Plus className="h-3 w-3" /> Novo limite
              </Button>
            )}
          </div>
          <LimitUsageBar ratio={usage ?? null} status={row?.limit_status ?? 'nao_cadastrado'} className="w-full" />
          {active && (
            <div className="text-[11px] text-muted-foreground grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-border">
              <div><span className="uppercase text-[10px]">Aprovado por</span><br />{active.approved_by || '—'}</div>
              <div><span className="uppercase text-[10px]">Comitê</span><br />{active.committee_date || '—'}</div>
              <div><span className="uppercase text-[10px]">Fonte</span><br />{active.source || '—'}</div>
              <div className="col-span-2 md:col-span-1"><span className="uppercase text-[10px]">Observações</span><br />{active.notes || '—'}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="px-3 py-2 border-b border-border text-xs font-medium">Exposição por fundo</div>
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-[11px] h-9">Fundo</TableHead>
                <TableHead className="text-[11px] h-9 text-right">Exposição</TableHead>
                <TableHead className="text-[11px] h-9 text-right">% do PL</TableHead>
                <TableHead className="text-[11px] h-9">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(row?.funds_list ?? []).map((f, i) => (
                <TableRow key={i} className="border-border">
                  <TableCell className="text-sm py-2">{f.fundo}</TableCell>
                  <TableCell className="py-2 text-right text-sm tabular-nums">{fmtBRL(f.valor)}</TableCell>
                  <TableCell className="py-2 text-right text-xs tabular-nums text-muted-foreground">{fmtPct(f.pct_fund)}</TableCell>
                  <TableCell className="py-2">
                    <Badge variant="outline" className="text-[10px]">
                      {f.pct_fund != null && active?.limit_pct_nav && f.pct_fund > active.limit_pct_nav ? 'Acima' : 'OK'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {!row?.funds_list?.length && (
                <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">Sem posições ativas.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="px-3 py-2 border-b border-border text-xs font-medium">Histórico de limites</div>
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-[11px] h-9">Vigência</TableHead>
                <TableHead className="text-[11px] h-9 text-right">Valor</TableHead>
                <TableHead className="text-[11px] h-9 text-right">% PL</TableHead>
                <TableHead className="text-[11px] h-9">Comitê</TableHead>
                <TableHead className="text-[11px] h-9">Aprovado por</TableHead>
                <TableHead className="text-[11px] h-9">Fonte</TableHead>
                <TableHead className="text-[11px] h-9 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((h: any) => (
                <TableRow key={h.id} className="border-border">
                  <TableCell className="text-xs py-2">{h.effective_from || '—'} → {h.effective_to || 'sem fim'}</TableCell>
                  <TableCell className="text-xs py-2 text-right tabular-nums">{h.limit_value ? fmtBRL(h.limit_value) : '—'}</TableCell>
                  <TableCell className="text-xs py-2 text-right tabular-nums">{h.limit_pct_nav ? `${(h.limit_pct_nav * 100).toFixed(2)}%` : '—'}</TableCell>
                  <TableCell className="text-xs py-2">{h.committee_date || '—'}</TableCell>
                  <TableCell className="text-xs py-2">{h.approved_by || '—'}</TableCell>
                  <TableCell className="text-xs py-2 text-muted-foreground">{h.source || '—'}</TableCell>
                  <TableCell className="py-2 text-right">
                    {canEdit && (
                      <Button size="sm" variant="ghost" className="h-6 text-[11px] gap-1" onClick={() => { setEditing(h); setDialogOpen(true); }}>
                        <Pencil className="h-3 w-3" /> Editar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!history.length && (
                <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-6">Nenhum limite cadastrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <IssuerLimitDialog open={dialogOpen} onOpenChange={setDialogOpen} cnpj={cnpjNorm} existing={editing} />
    </div>
  );
}

function SummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <Card className={cn(
      'bg-card border-border',
      highlight === 'acima' && 'border-status-danger/40',
      highlight === 'proximo' && 'border-status-warning/40',
    )}>
      <CardContent className="p-3">
        <p className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</p>
        <p className={cn(
          'text-base font-semibold tabular-nums mt-0.5',
          highlight === 'acima' && 'text-status-danger',
          highlight === 'proximo' && 'text-status-warning',
        )}>{value}</p>
      </CardContent>
    </Card>
  );
}
