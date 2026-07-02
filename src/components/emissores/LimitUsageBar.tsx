import { cn } from '@/lib/utils';

interface Props {
  ratio: number | null;
  status: 'dentro' | 'proximo' | 'acima' | 'nao_cadastrado';
  className?: string;
}

export function LimitUsageBar({ ratio, status, className }: Props) {
  if (status === 'nao_cadastrado' || ratio == null) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="h-1.5 flex-1 min-w-[60px] bg-muted rounded" />
        <span className="text-[10px] text-muted-foreground">—</span>
      </div>
    );
  }
  const pct = Math.min(ratio, 1.2) * 100;
  const color =
    status === 'acima' ? 'bg-status-danger'
    : status === 'proximo' ? 'bg-status-warning'
    : 'bg-status-success';
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-1.5 flex-1 min-w-[60px] bg-muted rounded overflow-hidden">
        <div className={cn('h-full transition-all', color)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={cn(
        'text-[10px] font-mono tabular-nums w-10 text-right',
        status === 'acima' && 'text-status-danger font-semibold',
        status === 'proximo' && 'text-status-warning',
      )}>
        {(ratio * 100).toFixed(0)}%
      </span>
    </div>
  );
}
