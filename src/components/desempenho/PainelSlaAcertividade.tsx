import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ANALISTA_COLOR_CLASSES, calcularAcertividade6Meses, pendentesOrdenadasPorUrgencia } from '@/utils/desempenhoUtils';
import { AnaliseEntry } from '@/data/desempenhoMock';

interface Props {
  pendentes: AnaliseEntry[];
  todasParaAcertividade: AnaliseEntry[];
}

function corBarra(pct: number) {
  if (pct >= 85) return '#639922';
  if (pct >= 70) return '#EF9F27';
  return '#E24B4A';
}

export function PainelSlaAcertividade({ pendentes, todasParaAcertividade }: Props) {
  const [verTodas, setVerTodas] = useState(false);
  const lista = useMemo(() => pendentesOrdenadasPorUrgencia(pendentes), [pendentes]);
  const visiveis = verTodas ? lista : lista.slice(0, 6);
  const acertividade = useMemo(() => calcularAcertividade6Meses(todasParaAcertividade), [todasParaAcertividade]);
  const maxPct = Math.max(100, ...acertividade.map((a) => a.percentual));

  return (
    <div className="bg-card rounded-lg border border-border p-4 flex flex-col gap-5">
      {/* SLA pendentes */}
      <div>
        <h3 className="text-sm font-medium mb-3">SLA de entregas pendentes</h3>
        {visiveis.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma análise pendente.</p>
        ) : (
          <div className="space-y-2">
            {visiveis.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-1.5 border-b border-border/40 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.titulo}</div>
                  <div className="text-[11px] text-muted-foreground">{p.tipo}</div>
                </div>
                <div className={cn('text-xs', p.vencido ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                  {p.vencido
                    ? `Vencido há ${Math.abs(p.diasAteVencimento)}d`
                    : p.diasAteVencimento === 0 ? 'Vence hoje' : `Vence em ${p.diasAteVencimento}d`}
                </div>
                <div
                  className={cn('h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium', ANALISTA_COLOR_CLASSES[p.analistaColor])}
                  title={p.analistaNome}
                >
                  {p.analistaInitials}
                </div>
              </div>
            ))}
          </div>
        )}
        {lista.length > 6 && (
          <button
            onClick={() => setVerTodas(!verTodas)}
            className="mt-2 text-xs text-primary hover:underline"
          >
            {verTodas ? 'Mostrar menos' : `Ver todas (${lista.length})`}
          </button>
        )}
      </div>

      {/* Acertividade */}
      <div>
        <h3 className="text-sm font-medium mb-3">Acertividade no prazo (últimos 6 meses)</h3>
        <div className="flex items-end justify-between gap-2 h-[80px]">
          {acertividade.map((m) => {
            const altura = m.totalEntregues > 0 ? Math.max(4, (m.percentual / maxPct) * 52) : 4;
            const cor = m.totalEntregues > 0 ? corBarra(m.percentual) : 'hsl(var(--muted))';
            return (
              <div key={`${m.ano}-${m.mes}`} className="flex flex-col items-center gap-1 flex-1">
                <div className="text-[10px] text-muted-foreground font-medium">
                  {m.totalEntregues > 0 ? `${Math.round(m.percentual)}%` : '—'}
                </div>
                <div
                  className="w-full max-w-[28px] rounded-sm transition-all"
                  style={{ height: `${altura}px`, backgroundColor: cor }}
                />
                <div className="text-[10px] text-muted-foreground">{m.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
