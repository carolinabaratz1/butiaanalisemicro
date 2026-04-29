import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { KpiResumo } from '@/utils/desempenhoUtils';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  atual: KpiResumo;
  anterior: KpiResumo;
  loading?: boolean;
}

interface CardDef {
  label: string;
  value: string;
  delta: number;
  // higher = better? for delta colors
  higherIsBetter: boolean;
  destructive?: boolean;
}

function formatDelta(delta: number, higherIsBetter: boolean) {
  if (Math.abs(delta) < 0.05) {
    return { icon: Minus, cls: 'text-muted-foreground', text: '0' };
  }
  const positive = delta > 0;
  const good = higherIsBetter ? positive : !positive;
  return {
    icon: positive ? ArrowUp : ArrowDown,
    cls: good ? 'text-emerald-600' : 'text-destructive',
    text: `${positive ? '+' : ''}${delta.toFixed(1)}`,
  };
}

export function KpiCards({ atual, anterior, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-muted rounded-lg p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-20 mt-2" />
          </div>
        ))}
      </div>
    );
  }
  const cards: CardDef[] = [
    { label: 'Análises entregues',  value: String(atual.entregues),                        delta: atual.entregues - anterior.entregues,         higherIsBetter: true  },
    { label: 'Prazo médio (d.ú.)',  value: atual.prazoMedio.toFixed(1),                    delta: atual.prazoMedio - anterior.prazoMedio,       higherIsBetter: false },
    { label: 'Aprovação 1ª revisão',value: `${Math.round(atual.taxaAprovacao)}%`,          delta: atual.taxaAprovacao - anterior.taxaAprovacao, higherIsBetter: true  },
    { label: 'Análises em atraso',  value: String(atual.emAtraso),                          delta: atual.emAtraso - anterior.emAtraso,           higherIsBetter: false, destructive: true },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => {
        const d = formatDelta(c.delta, c.higherIsBetter);
        const Icon = d.icon;
        return (
          <div key={c.label} className="bg-muted rounded-lg p-4">
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={cn('text-[22px] font-medium leading-tight', c.destructive && 'text-destructive')}>
                {c.value}
              </span>
              <span className={cn('inline-flex items-center gap-0.5 text-xs', d.cls)}>
                <Icon className="h-3 w-3" />
                {d.text}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
