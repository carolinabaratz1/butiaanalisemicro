import { Card, CardContent } from '@/components/ui/card';
import type { EmissorGestaoRow } from '@/hooks/useEmissoresGestao';
import { cn } from '@/lib/utils';

function fmtBRL(v: number): string {
  if (!v) return 'R$ 0';
  if (Math.abs(v) >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
}

export function EmissoresSummaryCards({ rows }: { rows: EmissorGestaoRow[] }) {
  const withPos = rows.filter(r => r.exposure_total > 0);
  const totalExposure = withPos.reduce((s, r) => s + r.exposure_total, 0);

  const vencidas = withPos.filter(r => r.analise_vencida);
  const semAnalise = withPos.filter(r => !r.analise_id);
  const semLimite = withPos.filter(r => r.limit_status === 'nao_cadastrado');
  const acima = withPos.filter(r => r.limit_status === 'acima');
  const proximo = withPos.filter(r => r.limit_status === 'proximo');
  const critico = rows.filter(r => r.alerts.some(a => a.severity === 'high'));

  const items: { label: string; value: string; tone?: 'default' | 'warn' | 'danger' }[] = [
    { label: 'Exposição total', value: fmtBRL(totalExposure) },
    { label: 'Emissores com posição', value: String(withPos.length) },
    { label: 'Análise vencida', value: String(vencidas.length), tone: vencidas.length ? 'danger' : 'default' },
    { label: 'Exposição vencida', value: fmtBRL(vencidas.reduce((s, r) => s + r.exposure_total, 0)), tone: vencidas.length ? 'warn' : 'default' },
    { label: 'Sem análise', value: String(semAnalise.length), tone: semAnalise.length ? 'warn' : 'default' },
    { label: 'Exposição sem análise', value: fmtBRL(semAnalise.reduce((s, r) => s + r.exposure_total, 0)), tone: semAnalise.length ? 'warn' : 'default' },
    { label: 'Sem limite', value: String(semLimite.length), tone: semLimite.length ? 'warn' : 'default' },
    { label: 'Acima do limite', value: String(acima.length), tone: acima.length ? 'danger' : 'default' },
    { label: 'Próximo do limite', value: String(proximo.length), tone: proximo.length ? 'warn' : 'default' },
    { label: 'Alerta crítico', value: String(critico.length), tone: critico.length ? 'danger' : 'default' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
      {items.map((it, i) => (
        <Card key={i} className={cn(
          'bg-card border-border',
          it.tone === 'danger' && 'border-status-danger/40',
          it.tone === 'warn' && 'border-status-warning/40',
        )}>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">{it.label}</p>
            <p className={cn(
              'text-base font-semibold tabular-nums mt-0.5',
              it.tone === 'danger' && 'text-status-danger',
              it.tone === 'warn' && 'text-status-warning',
            )}>{it.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
