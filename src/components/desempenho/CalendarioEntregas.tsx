import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ANALISTA_COLOR_CLASSES, COR_VENCIDO, TIPO_COR, agruparPorDia } from '@/utils/desempenhoUtils';
import { AnaliseEntry, FERIADOS_BR_2026 } from '@/data/desempenhoMock';

interface Props {
  analises: AnaliseEntry[];
  loading?: boolean;
}

const FERIADOS_SET = new Set(FERIADOS_BR_2026);
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function isoKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function pontosDoDia(items: AnaliseEntry[], hoje: Date) {
  return items.map((a) => {
    const vencido = !a.dataEntregueEm && new Date(a.dataEntrega) < hoje;
    return { id: a.id, cor: vencido ? COR_VENCIDO : TIPO_COR[a.tipo] };
  });
}

export function CalendarioEntregas({ analises, loading }: Props) {
  const [ref, setRef] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const porDia = useMemo(() => agruparPorDia(analises), [analises]);
  const hoje = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const ano = ref.getFullYear();
  const mes = ref.getMonth();
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();

  const cells: Array<{ key: string; date?: Date }> = [];
  for (let i = 0; i < primeiroDiaSemana; i++) cells.push({ key: `b${i}` });
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const date = new Date(ano, mes, dia);
    cells.push({ key: isoKey(date), date });
  }

  const navegar = (offset: number) => setRef(new Date(ano, mes + offset, 1));

  if (loading) {
    return (
      <div className="bg-card rounded-lg border border-border p-4 flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Calendário de entregas</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => navegar(-1)} className="p-1 rounded hover:bg-muted text-muted-foreground" aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium min-w-[140px] text-center">{MESES[mes]} {ano}</span>
          <button onClick={() => navegar(1)} className="p-1 rounded hover:bg-muted text-muted-foreground" aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DIAS_SEMANA.map((d, i) => (
          <div key={i} className="text-center text-[10px] text-muted-foreground uppercase font-medium py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((c) => {
          if (!c.date) return <div key={c.key} className="min-h-[54px]" />;
          const key = isoKey(c.date);
          const eventos = porDia[key] ?? [];
          const isHoje = c.date.getTime() === hoje.getTime();
          const isFeriado = FERIADOS_SET.has(key);
          const dow = c.date.getDay();
          const isFimSemana = dow === 0 || dow === 6;
          const pontos = pontosDoDia(eventos, hoje);
          const visiveis = pontos.slice(0, 4);
          const extra = pontos.length - visiveis.length;

          const cellInner = (
            <div
              className={cn(
                'min-h-[54px] rounded-md p-1.5 border border-transparent transition-colors text-left w-full h-full',
                isHoje && 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900',
                !isHoje && isFeriado && 'bg-muted/60',
                !isHoje && isFimSemana && !isFeriado && 'bg-muted/20',
                eventos.length > 0 && 'hover:bg-muted/50 cursor-pointer',
              )}
            >
              <div className={cn('text-xs', isHoje ? 'font-semibold text-blue-700 dark:text-blue-300' : 'text-foreground')}>
                {c.date.getDate()}
              </div>
              {pontos.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-0.5 items-center">
                  {visiveis.map((p, i) => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full inline-block" style={{ backgroundColor: p.cor }} />
                  ))}
                  {extra > 0 && <span className="text-[9px] text-muted-foreground ml-0.5">+{extra}</span>}
                </div>
              )}
            </div>
          );

          if (eventos.length === 0) return <div key={c.key}>{cellInner}</div>;

          return (
            <Popover key={c.key}>
              <PopoverTrigger asChild>
                <button className="text-left">{cellInner}</button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-2" align="start">
                <div className="text-xs text-muted-foreground mb-2 px-1">
                  Entregas em {c.date.toLocaleDateString('pt-BR')}
                </div>
                <div className="space-y-1.5">
                  {eventos.map((a) => {
                    const vencido = !a.dataEntregueEm && new Date(a.dataEntrega) < hoje;
                    return (
                      <div key={a.id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted/50">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: vencido ? COR_VENCIDO : TIPO_COR[a.tipo] }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{a.titulo}</div>
                          <div className="text-[10px] text-muted-foreground">{a.tipo}</div>
                        </div>
                        <div className={cn('h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-medium', ANALISTA_COLOR_CLASSES[a.analistaColor])}>
                          {a.analistaInitials}
                        </div>
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-normal">
                          {a.dataEntregueEm ? 'Entregue' : vencido ? 'Vencido' : 'Pendente'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        {[
          { label: 'Corporativo', cor: TIPO_COR.Corporativo },
          { label: 'FIDC',        cor: TIPO_COR.FIDC },
          { label: 'CRI/CRA',     cor: TIPO_COR.CRI },
          { label: 'Financeiro',  cor: TIPO_COR.Financeiro },
          { label: 'Vencido',     cor: COR_VENCIDO },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.cor }} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}
