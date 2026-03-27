import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { analistas, empresas } from '@/data/mockData';
import { AlertTriangle, User } from 'lucide-react';

const tipoClass: Record<string, string> = {
  'Crédito': 'bg-status-info/15 text-status-info border-status-info/30',
  'Ações': 'bg-status-success/15 text-status-success border-status-success/30',
  'Híbrido': 'bg-status-warning/15 text-status-warning border-status-warning/30',
};

export default function AnalistasPage() {
  // Check sectors without backup
  const allSetores = [...new Set(empresas.map(e => e.setor))];
  const setoresSemBackup = allSetores.filter(setor => {
    const emps = empresas.filter(e => e.setor === setor);
    return emps.some(e => !e.analistaBackup);
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Analistas</h2>

      <div className="grid grid-cols-2 gap-4">
        {analistas.map(a => (
          <Card key={a.id} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{a.nome}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px]">{a.nivel}</Badge>
                        <Badge variant="outline" className={`text-[10px] ${tipoClass[a.tipo]}`}>{a.tipo}</Badge>
                        <Badge variant="outline" className={`text-[10px] ${a.status === 'Ativo' ? 'text-status-success border-status-success/30' : 'text-muted-foreground'}`}>{a.status}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {a.setores.map(s => (
                      <Badge key={s} variant="secondary" className="text-[10px] bg-surface-1">{s}</Badge>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Análises</p>
                      <p className="text-foreground font-semibold text-sm">{a.numAnalises}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Taxa aprovação</p>
                      <p className="text-foreground font-semibold text-sm">{a.taxaAprovacao}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tempo médio</p>
                      <p className="text-foreground font-semibold text-sm">{a.tempoMedio}d</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cobertura setorial */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-foreground mb-3">Cobertura Setorial</p>
          <div className="grid grid-cols-4 gap-2">
            {allSetores.map(setor => {
              const emps = empresas.filter(e => e.setor === setor);
              const principal = emps[0] ? analistas.find(a => a.id === emps[0].analistaPrincipal)?.nome : '—';
              const backup = emps[0] ? analistas.find(a => a.id === emps[0].analistaBackup)?.nome : null;
              const semBackup = !backup;
              return (
                <div key={setor} className={`p-2.5 rounded-md bg-surface-1 border ${semBackup ? 'border-status-warning/50' : 'border-transparent'}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-foreground">{setor}</p>
                    {semBackup && <AlertTriangle className="h-3 w-3 text-status-warning" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Principal: {principal}</p>
                  <p className="text-[11px] text-muted-foreground">Backup: {backup || <span className="text-status-warning">Não definido</span>}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
