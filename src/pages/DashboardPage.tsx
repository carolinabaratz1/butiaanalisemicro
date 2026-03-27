import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, CheckCircle, Clock, Building2, FileCheck, AlertCircle, Briefcase, Shield } from 'lucide-react';
import { analises, pipelineItems, empresas, getEmpresaNome, getAnalistaNome, mockPosicoes, instrumentosEstruturados, monitoramentosFIDC } from '@/data/mockData';

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    'Aprovado': 'bg-status-success/15 text-status-success border-status-success/30',
    'Em análise': 'bg-status-info/15 text-status-info border-status-info/30',
    'Em revisão': 'bg-status-warning/15 text-status-warning border-status-warning/30',
    'Reprovado': 'bg-status-danger/15 text-status-danger border-status-danger/30',
    'Em andamento': 'bg-status-warning/15 text-status-warning border-status-warning/30',
    'Planejado': 'bg-status-info/15 text-status-info border-status-info/30',
    'Concluído': 'bg-status-success/15 text-status-success border-status-success/30',
    'Atrasado': 'bg-status-danger/15 text-status-danger border-status-danger/30',
  };
  return <Badge variant="outline" className={`text-[11px] ${map[status] || ''}`}>{status}</Badge>;
};

export default function DashboardPage() {
  const analisesEmAndamento = analises.filter(a => a.status === 'Em análise' || a.status === 'Em revisão').length;
  const analisesAprovadas = analises.filter(a => a.status === 'Aprovado').length;
  const alertasPendentes = 3;
  const coberturaAtiva = empresas.length;
  const ativosSemAnalise = 2;
  const alertasCreditoEstruturado = monitoramentosFIDC.filter(m => m.statusCovenants !== 'OK').length;

  const summaryCards = [
    { label: 'Análises em andamento', value: analisesEmAndamento, icon: Clock, color: 'text-status-warning' },
    { label: 'Aprovadas (mês)', value: analisesAprovadas, icon: CheckCircle, color: 'text-status-success' },
    { label: 'Alertas pendentes', value: alertasPendentes, icon: AlertTriangle, color: 'text-status-danger' },
    { label: 'Cobertura ativa', value: coberturaAtiva, icon: Building2, color: 'text-status-info' },
    { label: 'Posições importadas hoje', value: 'Sim — 26/03', icon: FileCheck, color: 'text-status-success' },
    { label: 'Ativos na carteira', value: mockPosicoes.length, icon: Briefcase, color: 'text-foreground' },
    { label: 'Sem análise vinculada', value: ativosSemAnalise, icon: AlertCircle, color: 'text-status-warning' },
    { label: 'Alertas crédito estr.', value: alertasCreditoEstruturado, icon: Shield, color: 'text-status-danger' },
  ];

  const pipelineSemana = pipelineItems.filter(p => p.status !== 'Concluído').slice(0, 5);
  const ultimasAprovadas = analises.filter(a => a.status === 'Aprovado');

  const alertas = [
    { tipo: 'Covenant', empresa: 'AXIOS NPL FIDC', data: '28/02/2026', severity: 'danger' as const },
    { tipo: 'Vencimento', empresa: 'CRI Cyrela', data: '15/09/2032', severity: 'warning' as const },
    { tipo: 'Target expirado', empresa: 'Vale', data: '01/03/2026', severity: 'warning' as const },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Dashboard</h2>
      <div className="grid grid-cols-4 gap-3">
        {summaryCards.map((card, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{card.label}</p>
                  <p className={`text-xl font-bold mt-1 ${card.color}`}>{card.value}</p>
                </div>
                <card.icon className={`h-5 w-5 ${card.color} opacity-50`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Pipeline da semana */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Pipeline da Semana</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pipelineSemana.map(item => (
              <div key={item.id} className={`flex items-center justify-between p-2.5 rounded-md bg-surface-1 ${item.status === 'Atrasado' ? 'border border-status-danger/50' : 'border border-transparent'}`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{getEmpresaNome(item.empresaId)}</p>
                  <p className="text-[11px] text-muted-foreground">{getAnalistaNome(item.analistaResponsavel)} · {item.dataPrevista}</p>
                </div>
                {statusBadge(item.status)}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Últimas análises aprovadas */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Últimas Análises Aprovadas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-[11px] h-8">Empresa</TableHead>
                  <TableHead className="text-[11px] h-8">Tipo</TableHead>
                  <TableHead className="text-[11px] h-8">Analista</TableHead>
                  <TableHead className="text-[11px] h-8">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ultimasAprovadas.map(a => (
                  <TableRow key={a.id} className="border-border">
                    <TableCell className="text-sm py-2">{getEmpresaNome(a.empresaId)}</TableCell>
                    <TableCell className="text-sm py-2">{a.tipo}</TableCell>
                    <TableCell className="text-sm py-2">{getAnalistaNome(a.analistaResponsavel)}</TableCell>
                    <TableCell className="text-sm py-2">{a.dataConclusao}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Alertas */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Alertas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alertas.map((alerta, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-md bg-surface-1 border border-transparent">
                <AlertTriangle className={`h-4 w-4 shrink-0 ${alerta.severity === 'danger' ? 'text-status-danger' : 'text-status-warning'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{alerta.tipo}</p>
                  <p className="text-[11px] text-muted-foreground">{alerta.empresa} · {alerta.data}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
