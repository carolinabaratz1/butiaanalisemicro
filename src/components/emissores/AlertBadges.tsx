import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { EmissorAlert } from '@/hooks/useEmissoresGestao';
import { cn } from '@/lib/utils';

export function AlertBadges({ alerts, max = 3 }: { alerts: EmissorAlert[]; max?: number }) {
  if (!alerts?.length) {
    return <span className="text-[10px] text-muted-foreground">—</span>;
  }
  const sorted = [...alerts].sort((a, b) => {
    const w = { high: 0, medium: 1, low: 2 } as const;
    return (w[a.severity] ?? 3) - (w[b.severity] ?? 3);
  });
  const visible = sorted.slice(0, max);
  const rest = sorted.length - visible.length;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1 flex-wrap">
        {visible.map((a, i) => {
          const Icon = a.severity === 'high' ? AlertCircle : a.severity === 'medium' ? AlertTriangle : Info;
          const color =
            a.severity === 'high' ? 'text-status-danger bg-status-danger/10 border-status-danger/30'
            : a.severity === 'medium' ? 'text-status-warning bg-status-warning/10 border-status-warning/30'
            : 'text-muted-foreground bg-muted/40 border-border';
          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]', color)}>
                  <Icon className="h-3 w-3" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">{a.label}</TooltipContent>
            </Tooltip>
          );
        })}
        {rest > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">+{rest}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <div className="space-y-0.5">
                {sorted.slice(max).map((a, i) => <div key={i}>{a.label}</div>)}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

export function analysisStatusBadgeClass(status: string | null | undefined, vencida?: boolean): string {
  if (!status) return 'bg-muted/40 text-muted-foreground border-border';
  if (vencida) return 'bg-status-danger/10 text-status-danger border-status-danger/30';
  if (status === 'Buy' || status === 'Aprovada' || status === 'Concluída') return 'bg-status-success/15 text-status-success border-status-success/30';
  if (status === 'Sell' || status === 'Reprovada' || status === 'Rejeitado') return 'bg-status-danger/15 text-status-danger border-status-danger/30';
  if (status === 'Hold') return 'bg-status-info/15 text-status-info border-status-info/30';
  if (status === 'Vencida c/ Alocação' || status === 'Vencida s/ Alocação') return 'bg-status-danger/10 text-status-danger border-status-danger/30';
  return 'bg-status-warning/15 text-status-warning border-status-warning/30';
}
