import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { pipelineItems, getEmpresaNome, getAnalistaNome } from '@/data/mockData';

const columns = ['Planejado', 'Em andamento', 'Concluído', 'Atrasado'] as const;

const prioClass: Record<string, string> = {
  'Alta': 'bg-status-danger/15 text-status-danger border-status-danger/30',
  'Média': 'bg-status-warning/15 text-status-warning border-status-warning/30',
  'Baixa': 'bg-status-info/15 text-status-info border-status-info/30',
};

const colHeaderClass: Record<string, string> = {
  'Planejado': 'text-status-info',
  'Em andamento': 'text-status-warning',
  'Concluído': 'text-status-success',
  'Atrasado': 'text-status-danger',
};

export default function PipelinePage() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Pipeline de Research</h2>
      <div className="grid grid-cols-4 gap-4">
        {columns.map(col => {
          const items = pipelineItems.filter(p => p.status === col);
          return (
            <div key={col} className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className={`text-sm font-semibold ${colHeaderClass[col]}`}>{col}</h3>
                <Badge variant="outline" className="text-[10px] text-muted-foreground">{items.length}</Badge>
              </div>
              <div className="space-y-2">
                {items.map(item => (
                  <Card key={item.id} className={`bg-card border-border ${item.status === 'Atrasado' ? 'border-status-danger/60' : ''}`}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">{getEmpresaNome(item.empresaId)}</p>
                        <Badge variant="outline" className={`text-[9px] ${prioClass[item.prioridade]}`}>{item.prioridade}</Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground space-y-0.5">
                        <p>{item.tipo} · {getAnalistaNome(item.analistaResponsavel)}</p>
                        <p>Prazo: {item.dataPrevista}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {items.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-8 border border-dashed border-border rounded-md">
                    Nenhum item
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
