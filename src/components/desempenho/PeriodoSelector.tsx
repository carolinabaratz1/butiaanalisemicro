import { cn } from '@/lib/utils';
import { Periodo } from '@/utils/desempenhoUtils';

const OPCOES: { value: Periodo; label: string }[] = [
  { value: '7d',  label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'YTD', label: 'YTD' },
];

interface Props {
  value: Periodo;
  onChange: (p: Periodo) => void;
}

export function PeriodoSelector({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-md border border-border bg-background p-0.5">
      {OPCOES.map((op) => (
        <button
          key={op.value}
          onClick={() => onChange(op.value)}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-sm transition-colors',
            value === op.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
          )}
        >
          {op.label}
        </button>
      ))}
    </div>
  );
}
