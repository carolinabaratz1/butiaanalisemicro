import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { ANALISTA_COLOR_CLASSES, AnalistaMetrica, diasNaEtapa } from '@/utils/desempenhoUtils';
import { EtapaKanban } from '@/data/desempenhoMock';

interface Props {
  metrica: AnalistaMetrica | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_LABEL: Record<AnalistaMetrica['status'], { text: string; cls: string }> = {
  no_prazo: { text: 'No prazo', cls: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' },
  atencao:  { text: 'Atenção',  cls: 'bg-amber-100 text-amber-800 hover:bg-amber-100' },
  em_atraso:{ text: 'Em atraso',cls: 'bg-red-100 text-red-700 hover:bg-red-100' },
};

const ETAPAS: EtapaKanban[] = ['Em análise', 'Revisão', 'Aprovado', 'Concluído'];

function fmt(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function AnalistaSheet({ metrica, open, onOpenChange }: Props) {
  if (!metrica) return null;
  const st = STATUS_LABEL[metrica.status];

  // Tempo médio (d.ú.) por etapa
  const mediasEtapa: Record<EtapaKanban, number> = { 'Em análise': 0, 'Revisão': 0, 'Aprovado': 0, 'Concluído': 0 };
  for (const etapa of ETAPAS) {
    const tempos: number[] = [];
    for (const an of metrica.analises) {
      const e = an.etapasKanban.find((x) => x.etapa === etapa);
      if (e) tempos.push(diasNaEtapa(e));
    }
    mediasEtapa[etapa] = tempos.length ? tempos.reduce((s, n) => s + n, 0) / tempos.length : 0;
  }

  const miniKpis = [
    { label: 'Entregues',     value: String(metrica.entregues) },
    { label: 'Prazo médio',   value: `${metrica.prazoMedio.toFixed(1)}d` },
    { label: 'Aprovação 1ª',  value: `${Math.round(metrica.taxaAprovacao)}%` },
    { label: 'Em andamento',  value: String(metrica.emAndamento) },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className={cn('h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium', ANALISTA_COLOR_CLASSES[metrica.analistaColor])}>
              {metrica.analistaInitials}
            </div>
            <div className="flex-1">
              <SheetTitle className="text-left">{metrica.analistaNome}</SheetTitle>
              <Badge className={cn('mt-1 font-normal', st.cls)} variant="secondary">{st.text}</Badge>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 grid grid-cols-4 gap-2">
          {miniKpis.map((k) => (
            <div key={k.label} className="bg-muted rounded-lg p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{k.label}</div>
              <div className="text-lg font-medium mt-0.5">{k.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <h4 className="text-sm font-medium mb-2">Tempo médio por etapa</h4>
          <div className="grid grid-cols-4 gap-2">
            {ETAPAS.map((e) => (
              <div key={e} className="bg-muted rounded-lg p-3">
                <div className="text-[10px] text-muted-foreground">{e}</div>
                <div className="text-base font-medium mt-0.5">{mediasEtapa[e].toFixed(1)}d</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <h4 className="text-sm font-medium mb-2">Análises do analista</h4>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground text-left">
                  <th className="px-3 py-2 font-medium">Título</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Início</th>
                  <th className="px-3 py-2 font-medium">Prazo</th>
                  <th className="px-3 py-2 font-medium">Entregue</th>
                  <th className="px-3 py-2 font-medium text-center">1ª rev.</th>
                </tr>
              </thead>
              <tbody>
                {metrica.analises.map((a) => (
                  <tr key={a.id} className="border-b border-border/40">
                    <td className="px-3 py-2">{a.titulo}</td>
                    <td className="px-3 py-2 text-muted-foreground">{a.tipo}</td>
                    <td className="px-3 py-2">{fmt(a.dataInicio)}</td>
                    <td className="px-3 py-2">{fmt(a.dataEntrega)}</td>
                    <td className="px-3 py-2">{fmt(a.dataEntregueEm)}</td>
                    <td className="px-3 py-2 text-center">
                      {a.aprovadoPrimeiraRevisao === true
                        ? <Check className="h-3.5 w-3.5 text-emerald-600 inline" />
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
