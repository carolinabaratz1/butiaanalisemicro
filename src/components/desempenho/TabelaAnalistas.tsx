import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3 } from 'lucide-react';
import { ANALISTA_COLOR_CLASSES, AnalistaMetrica } from '@/utils/desempenhoUtils';

interface Props {
  metricas: AnalistaMetrica[];
  onSelect: (m: AnalistaMetrica) => void;
  loading?: boolean;
}

const STATUS_LABEL: Record<AnalistaMetrica['status'], { text: string; cls: string }> = {
  no_prazo: { text: 'No prazo', cls: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' },
  atencao:  { text: 'Atenção',  cls: 'bg-amber-100 text-amber-800 hover:bg-amber-100' },
  em_atraso:{ text: 'Em atraso',cls: 'bg-red-100 text-red-700 hover:bg-red-100' },
};

export function TabelaAnalistas({ metricas, onSelect, loading }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground bg-muted/40">
              <th className="px-4 py-2.5 font-medium">Analista</th>
              <th className="px-4 py-2.5 font-medium text-center">Entregues</th>
              <th className="px-4 py-2.5 font-medium text-center">Prazo médio</th>
              <th className="px-4 py-2.5 font-medium text-center">vs Meta</th>
              <th className="px-4 py-2.5 font-medium">Aprovação 1ª rev.</th>
              <th className="px-4 py-2.5 font-medium text-center">Em andamento</th>
              <th className="px-4 py-2.5 font-medium text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {metricas.map((m) => {
              const st = STATUS_LABEL[m.status];
              const folga = m.diferencaMeta;
              const folgaCls = folga >= 0 ? 'text-emerald-600' : 'text-destructive';
              return (
                <tr
                  key={m.analistaId}
                  onClick={() => onSelect(m)}
                  className="border-b border-border/40 hover:bg-muted/40 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={cn('h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium', ANALISTA_COLOR_CLASSES[m.analistaColor])}>
                        {m.analistaInitials}
                      </div>
                      <span>{m.analistaNome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">{m.entregues}</td>
                  <td className="px-4 py-3 text-center">{m.prazoMedio.toFixed(1)}d</td>
                  <td className={cn('px-4 py-3 text-center font-medium', folgaCls)}>
                    {folga >= 0 ? '+' : ''}{folga.toFixed(1)}d
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Progress value={m.taxaAprovacao} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground w-9 text-right">{Math.round(m.taxaAprovacao)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">{m.emAndamento}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={cn('font-normal', st.cls)} variant="secondary">{st.text}</Badge>
                  </td>
                </tr>
              );
            })}
            {loading && Array.from({ length: 4 }).map((_, i) => (
              <tr key={`sk-${i}`} className="border-b border-border/40">
                <td colSpan={7} className="px-4 py-3"><Skeleton className="h-6 w-full" /></td>
              </tr>
            ))}
            {!loading && metricas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Nenhuma análise encontrada no período selecionado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
