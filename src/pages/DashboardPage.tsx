import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, CheckCircle, Clock, Building2, FileCheck, AlertCircle, Briefcase, Shield, TrendingUp } from 'lucide-react';
import { analises, pipelineItems, empresas, getEmpresaNome, getAnalistaNome, instrumentosEstruturados, monitoramentosFIDC } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { useAnaliseEmissao } from '@/contexts/AnaliseEmissaoContext';
import { users } from '@/data/users';
import { emissores } from '@/data/emissores';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

function getEmissorNome(cnpj: string) {
  return emissores.find(e => e.cnpj === cnpj)?.nomeAbreviado ?? cnpj;
}
function getUserNome(id: string) {
  return users.find(u => u.id === id)?.nome ?? 'N/A';
}

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const { analises: analisesEmissao } = useAnaliseEmissao();
  const isAnalista = currentUser?.funcao === 'Analista';
  const isGestor = currentUser?.funcao === 'Gestor';
  const hoje = new Date().toISOString().split('T')[0];
  const hojeFormatado = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  // Query posições importadas hoje (by created_at)
  const { data: posicoesHoje } = useQuery({
    queryKey: ['posicoes-hoje'],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const { count, error } = await supabase
        .from('posicoes' as any)
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString())
        .lte('created_at', todayEnd.toISOString());
      if (error) return 0;
      return count ?? 0;
    },
  });

  // Query total de ativos na carteira (latest val_date only)
  const { data: totalPosicoes } = useQuery({
    queryKey: ['posicoes-total-latest'],
    queryFn: async () => {
      // First get the max val_date
      const { data: latest, error: latestErr } = await supabase
        .from('posicoes' as any)
        .select('val_date')
        .order('val_date', { ascending: false })
        .limit(1);
      if (latestErr || !latest || latest.length === 0) return 0;
      const maxDate = (latest[0] as any).val_date;
      // Count rows with that val_date
      const { count, error } = await supabase
        .from('posicoes' as any)
        .select('*', { count: 'exact', head: true })
        .eq('val_date', maxDate);
      if (error) return 0;
      return count ?? 0;
    },
  });

  // Query empresas com posição ativa (latest val_date) + sem análise vinculada
  const { data: portfolioStats } = useQuery({
    queryKey: ['portfolio-cobertura'],
    queryFn: async () => {
      // Get latest val_date
      const { data: latestRow } = await supabase
        .from('posicoes' as any)
        .select('val_date')
        .order('val_date', { ascending: false })
        .limit(1);
      if (!latestRow || latestRow.length === 0) return { cobertura: 0, semAnalise: 0 };
      const maxDate = (latestRow[0] as any).val_date;

      // Get distinct product names from latest date (these represent companies in portfolio)
      const { data: posRows } = await supabase
        .from('posicoes' as any)
        .select('product')
        .eq('val_date', maxDate);
      const productosUnicos = [...new Set((posRows ?? []).map((r: any) => r.product))];
      const cobertura = productosUnicos.length;

      // Get empresa_ids with active analyses
      const { data: analisesAtivas } = await supabase
        .from('analises')
        .select('empresa_id')
        .not('status', 'in', '("Concluído","Rejeitado")');
      const comAnalise = new Set((analisesAtivas ?? []).map(a => a.empresa_id));

      // Count portfolio companies without active analysis — match by product name against empresas
      const { data: allEmpresas } = await supabase.from('empresas').select('cnpj, nome');
      const empresasNaCarteira = (allEmpresas ?? []).filter(e => productosUnicos.some((p: string) => p.toLowerCase().includes(e.nome.toLowerCase()) || e.nome.toLowerCase().includes(p.toLowerCase())));
      const semAnalise = empresasNaCarteira.filter(e => !comAnalise.has(e.cnpj)).length;

      return { cobertura, semAnalise };
    },
  });

  // Pipeline Geral — count from analises table by status
  const { data: pipelineCounts } = useQuery({
    queryKey: ['analises-pipeline-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('analises').select('status, data_conclusao');
      if (error) return { pendente: 0, emAnalise: 0, concluida: 0, aprovada: 0, reprovada: 0, vencida: 0 };
      const rows = data ?? [];
      const umAnoAtras = new Date();
      umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);
      let vencidaCount = 0;
      let aprovadaCount = 0;
      rows.forEach(r => {
        if (r.status === 'Aprovada' && r.data_conclusao) {
          const dt = new Date(r.data_conclusao.split('T')[0]);
          if (dt < umAnoAtras) { vencidaCount++; } else { aprovadaCount++; }
        } else if (r.status === 'Aprovada') { aprovadaCount++; }
      });
      return {
        pendente: rows.filter(r => r.status === 'Pendente').length,
        emAnalise: rows.filter(r => r.status === 'Em Análise').length,
        concluida: rows.filter(r => r.status === 'Concluída').length,
        aprovada: aprovadaCount,
        reprovada: rows.filter(r => r.status === 'Reprovada').length,
        vencida: vencidaCount + rows.filter(r => r.status === 'Vencida').length,
      };
    },
  });

  const analisesEmAndamento = analises.filter(a => a.status === 'Em análise' || a.status === 'Em revisão').length;
  const analisesAprovadas = analises.filter(a => a.status === 'Aprovado').length;
  const alertasPendentes = 3;
  const coberturaAtiva = portfolioStats?.cobertura ?? 0;
  const alertasCreditoEstruturado = monitoramentosFIDC.filter(m => m.statusCovenants !== 'OK').length;

  const posicoesValue = (posicoesHoje ?? 0) > 0 ? `Sim — ${hojeFormatado}` : 'Não';
  const posicoesColor = (posicoesHoje ?? 0) > 0 ? 'text-status-success' : 'text-status-danger';

  const summaryCards = [
    { label: 'Análises em andamento', value: analisesEmAndamento, icon: Clock, color: 'text-status-warning' },
    { label: 'Aprovadas (mês)', value: analisesAprovadas, icon: CheckCircle, color: 'text-status-success' },
    { label: 'Alertas pendentes', value: alertasPendentes, icon: AlertTriangle, color: 'text-status-danger' },
    { label: 'Cobertura ativa', value: coberturaAtiva, icon: Building2, color: 'text-status-info' },
    { label: 'Posições importadas hoje', value: posicoesValue, icon: FileCheck, color: posicoesColor },
    { label: 'Ativos na carteira', value: totalPosicoes ?? 0, icon: Briefcase, color: 'text-foreground' },
    { label: 'Sem análise vinculada', value: portfolioStats?.semAnalise ?? 0, icon: AlertCircle, color: 'text-status-warning' },
    { label: 'Alertas crédito estr.', value: alertasCreditoEstruturado, icon: Shield, color: 'text-status-danger' },
  ];

  const pipelineSemana = pipelineItems.filter(p => p.status !== 'Concluído').slice(0, 5);
  const ultimasAprovadas = analises.filter(a => a.status === 'Aprovado');

  const alertas = [
    { tipo: 'Covenant', empresa: 'AXIOS NPL FIDC', data: '28/02/2026', severity: 'danger' as const },
    { tipo: 'Vencimento', empresa: 'CRI Cyrela', data: '15/09/2032', severity: 'warning' as const },
    { tipo: 'Target expirado', empresa: 'Vale', data: '01/03/2026', severity: 'warning' as const },
  ];

  // Analyst widget data
  const minhasAnalises = analisesEmissao.filter(a => a.analista_id === currentUser?.id);
  const minhasPendentes = minhasAnalises.filter(a => a.status === 'pendente').length;
  const minhasEmAnalise = minhasAnalises.filter(a => a.status === 'em_analise').length;
  const minhasConcluidas = minhasAnalises.filter(a => a.status === 'concluido').length;
  const urgentes = minhasAnalises
    .filter(a => a.status === 'pendente' || a.status === 'em_analise')
    .sort((a, b) => a.prazo.localeCompare(b.prazo))
    .slice(0, 5);

  // Gestor widget data — from Supabase
  const totalPendentes = pipelineCounts?.pendente ?? 0;
  const totalEmAnalise2 = pipelineCounts?.emAnalise ?? 0;
  const totalConcluidas = pipelineCounts?.concluida ?? 0;
  const totalAprovadas = pipelineCounts?.aprovada ?? 0;
  const totalReprovadas = pipelineCounts?.reprovada ?? 0;
  const totalVencidas = pipelineCounts?.vencida ?? 0;
  const vencidas = analisesEmissao.filter(a => (a.status === 'pendente' || a.status === 'em_analise') && a.prazo < hoje);

  const analistasPendentes = users
    .filter(u => u.funcao === 'Analista')
    .map(u => ({ nome: u.nome, id: u.id, count: analisesEmissao.filter(a => a.analista_id === u.id && a.status === 'pendente').length }))
    .filter(a => a.count > 0)
    .sort((a, b) => b.count - a.count);

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

      {/* Analyst Widget */}
      {isAnalista && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Minhas Análises
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <div className="text-center">
                <p className="text-xl font-bold text-status-warning">{minhasPendentes}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Pendente</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-status-info">{minhasEmAnalise}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Em Análise</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-status-success">{minhasConcluidas}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Concluído</p>
              </div>
            </div>
            {urgentes.length > 0 && (
              <>
                <p className="text-xs font-semibold text-foreground mb-2">Mais urgentes</p>
                <div className="space-y-1.5">
                  {urgentes.map(a => (
                    <div key={a.id} className={`flex items-center justify-between p-2 rounded-md bg-surface-1 ${a.prazo < hoje ? 'border border-status-danger/50' : 'border border-transparent'}`}>
                      <div>
                        <p className="text-sm font-medium">{getEmissorNome(a.cnpj_emissor)}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{a.isin}</p>
                      </div>
                      <span className={`text-[11px] ${a.prazo < hoje ? 'text-status-danger font-semibold' : 'text-muted-foreground'}`}>{a.prazo}</span>
                    </div>
                  ))}
                </div>
                <Link to="/pipeline" className="text-xs text-primary hover:underline mt-2 inline-block">Ver pipeline completo →</Link>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Gestor Widget */}
      {isGestor && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Pipeline Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4 flex-wrap">
              <div className="text-center">
                <p className="text-xl font-bold text-status-warning">{totalPendentes}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Pendente</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-status-info">{totalEmAnalise2}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Em Análise</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-muted-foreground">{totalConcluidas}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Concluída</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-status-success">{totalAprovadas}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Aprovada</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-status-danger">{totalReprovadas}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Reprovada</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-orange-400">{totalVencidas}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Vencida</p>
              </div>
            </div>
            {vencidas.length > 0 && (
              <div className="mb-3 p-2 rounded-md bg-status-danger/10 border border-status-danger/30">
                <p className="text-xs text-status-danger font-semibold flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {vencidas.length} análise(s) com prazo vencido</p>
              </div>
            )}
            {analistasPendentes.length > 0 && (
              <>
                <p className="text-xs font-semibold text-foreground mb-2">Analistas com pendências</p>
                <div className="space-y-1">
                  {analistasPendentes.map(a => (
                    <div key={a.id} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{a.nome}</span>
                      <Badge variant="outline" className="text-[10px] bg-status-warning/15 text-status-warning border-status-warning/30">{a.count} pendente(s)</Badge>
                    </div>
                  ))}
                </div>
              </>
            )}
            <Link to="/pipeline" className="text-xs text-primary hover:underline mt-2 inline-block">Ver pipeline completo →</Link>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Pipeline da Semana</CardTitle></CardHeader>
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

        <Card className="bg-card border-border">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Últimas Análises Aprovadas</CardTitle></CardHeader>
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

        <Card className="bg-card border-border">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Alertas</CardTitle></CardHeader>
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
