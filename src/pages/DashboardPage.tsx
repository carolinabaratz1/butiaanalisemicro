import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Building2,
  FileCheck,
  AlertCircle,
  Briefcase,
  Shield,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    Buy: "bg-status-success/15 text-status-success border-status-success/30",
    Hold: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    Sell: "bg-status-danger/15 text-status-danger border-status-danger/30",
    "Em Análise": "bg-status-info/15 text-status-info border-status-info/30",
    Pendente: "bg-status-warning/15 text-status-warning border-status-warning/30",
    Concluída: "bg-muted/50 text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={`text-[11px] ${map[status] || ""}`}>
      {status}
    </Badge>
  );
};

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const isGestor = currentUser?.funcao === "Gestor";
  const hojeFormatado = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  // ========== CNPJs com posição ativa (latest val_date) ==========
  const { data: cnpjsComPosicao } = useQuery({
    queryKey: ["dashboard-cnpjs-posicao"],
    queryFn: async () => {
      // Get latest val_date
      const { data: latestRow } = await supabase
        .from("posicoes")
        .select("val_date")
        .order("val_date", { ascending: false })
        .limit(1);
      if (!latestRow || latestRow.length === 0) return new Set<string>();
      const maxDate = latestRow[0].val_date;

      // Get ISINs from latest date
      const { data: posRows } = await supabase
        .from("posicoes")
        .select("isin")
        .eq("val_date", maxDate)
        .not("isin", "is", null);
      const isins = [...new Set((posRows ?? []).map((r) => r.isin).filter(Boolean))];
      if (isins.length === 0) return new Set<string>();

      // Map ISINs to CNPJs via emissoes
      const { data: emRows } = await supabase.from("emissoes").select("cnpj_emissor").in("isin", isins);
      return new Set((emRows ?? []).map((e) => e.cnpj_emissor));
    },
  });

  // ========== Todas as análises ==========
  const { data: todasAnalises } = useQuery({
    queryKey: ["dashboard-analises"],
    queryFn: async () => {
      const { data } = await supabase
        .from("analises")
        .select("id, empresa_id, tipo, versao, analista_responsavel, status, data_conclusao, data_inicio, data_comite, decisao, conviccao");
      return data ?? [];
    },
  });

  // ========== Empresas ==========
  const { data: empresasData } = useQuery({
    queryKey: ["dashboard-empresas"],
    queryFn: async () => {
      const { data } = await supabase.from("empresas").select("id, nome, cnpj, tipo");
      return data ?? [];
    },
  });

  // ========== Posições importadas hoje ==========
  const { data: posicoesHoje } = useQuery({
    queryKey: ["posicoes-hoje"],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const { count } = await supabase
        .from("posicoes")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart.toISOString())
        .lte("created_at", todayEnd.toISOString());
      return count ?? 0;
    },
  });

  // ========== Ativos na carteira (distinct CNPJs) ==========
  const ativosCarteira = cnpjsComPosicao?.size ?? 0;

  // ========== Classificar análises ==========
  const umAnoAtras = new Date();
  umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);
  const cnpjSet = cnpjsComPosicao ?? new Set<string>();
  const empresaMap = new Map((empresasData ?? []).map((e) => [e.cnpj, e]));
  const empresaCnpjById = new Map((empresasData ?? []).map((e) => [e.id, e.cnpj]));
  const empresaNomeById = new Map((empresasData ?? []).map((e) => [e.id, e.nome]));

  // Helper: get empresa nome by empresa_id (which is cnpj)
  const getEmpresaNome = (empresaId: string) => {
    // empresa_id is cnpj in analises
    const byId = empresaNomeById.get(empresaId);
    if (byId) return byId;
    const byCnpj = empresaMap.get(empresaId);
    if (byCnpj) return byCnpj.nome;
    return empresaId;
  };

  const analises = todasAnalises ?? [];

  // Compute statuses (same logic as PipelineResearchPage)
  // FIDC analyses do not expire — they have continuous monitoring instead
  const APROVADOS = new Set(["Buy", "Hold", "Sell"]);
  const computedAnalisesRaw = analises.map((a) => {
    let computedStatus = a.status;
    // Vencimento aplica-se a Buy/Hold (Sell = posição encerrada não expira)
    if ((a.status === "Buy" || a.status === "Hold") && a.data_conclusao) {
      const tipoEmissor = empresaMap.get(a.empresa_id)?.tipo ?? null;
      if (tipoEmissor !== "FIDC") {
        const dt = new Date(a.data_conclusao.split("T")[0]);
        if (dt < umAnoAtras) {
          const hasPosicao = cnpjSet.has(a.empresa_id);
          computedStatus = hasPosicao ? "Vencida c/ Alocação" : "Vencida s/ Alocação";
        }
      }
    }
    return { ...a, computedStatus };
  });

  // Deduplicate by (empresa_id + tipo) keeping highest versao
  const groupedDedup = new Map<string, typeof computedAnalisesRaw>();
  computedAnalisesRaw.forEach((a) => {
    const key = `${a.empresa_id}::${a.tipo}`;
    const list = groupedDedup.get(key) || [];
    list.push(a);
    groupedDedup.set(key, list);
  });
  const computedAnalises: typeof computedAnalisesRaw = [];
  groupedDedup.forEach((items) => {
    if (items.length <= 1) {
      computedAnalises.push(...items);
      return;
    }
    items.sort((a, b) => ((b as any).versao || 1) - ((a as any).versao || 1));
    computedAnalises.push(items[0]);
  });

  const pendentes = computedAnalises.filter((a) => a.computedStatus === "Pendente");
  const emAnalise = computedAnalises.filter((a) => a.computedStatus === "Em Análise");
  const concluidas = computedAnalises.filter((a) => a.computedStatus === "Concluída");
  const buys = computedAnalises.filter((a) => a.computedStatus === "Buy");
  const holds = computedAnalises.filter((a) => a.computedStatus === "Hold");
  const sells = computedAnalises.filter((a) => a.computedStatus === "Sell");
  const deliberadas = computedAnalises.filter((a) => APROVADOS.has(a.computedStatus));
  const vencidasComAlocacao = computedAnalises.filter((a) => a.computedStatus === "Vencida c/ Alocação");
  const vencidasSemAlocacao = computedAnalises.filter((a) => a.computedStatus === "Vencida s/ Alocação");

  // KPIs
  const analisesEmAndamento = pendentes.length + emAnalise.length;

  // Aprovadas no mês atual: status IN (Buy,Hold,Sell) E data_comite >= início do mês
  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
  const aprovadasMes = deliberadas.filter((a) => {
    const ref = (a as any).data_comite || a.data_conclusao;
    if (!ref) return false;
    const dt = new Date(String(ref).split("T")[0]);
    return dt >= inicioMes;
  }).length;

  // Alertas: vencidas com alocação
  const alertasPendentes = vencidasComAlocacao.length;

  // Cobertura ativa: emissores distintos com pelo menos uma análise Buy ou Hold
  const cnpjsCobertura = new Set([...buys, ...holds].map((a) => a.empresa_id));
  const coberturaAtiva = cnpjsCobertura.size;

  // Sem análise vinculada: CNPJs com posição ativa sem análise Buy/Hold
  const semAnalise = [...cnpjSet].filter((cnpj) => !cnpjsCobertura.has(cnpj)).length;

  const posicoesValue = (posicoesHoje ?? 0) > 0 ? `Sim — ${hojeFormatado}` : "Não";
  const posicoesColor = (posicoesHoje ?? 0) > 0 ? "text-status-success" : "text-status-danger";

  const summaryCards = [
    { label: "Análises em andamento", value: analisesEmAndamento, icon: Clock, color: "text-status-warning" },
    { label: "Aprovadas (mês)", value: aprovadasMes, icon: CheckCircle, color: "text-status-success" },
    { label: "Alertas pendentes", value: alertasPendentes, icon: AlertTriangle, color: "text-status-danger" },
    { label: "Cobertura ativa", value: coberturaAtiva, icon: Building2, color: "text-status-info" },
    { label: "Posições importadas hoje", value: posicoesValue, icon: FileCheck, color: posicoesColor },
    { label: "Ativos na carteira", value: ativosCarteira, icon: Briefcase, color: "text-foreground" },
    { label: "Sem análise vinculada", value: semAnalise, icon: AlertCircle, color: "text-status-warning" },
  ];

  // Pipeline da semana: análises pendentes/em análise, ordenadas por data_inicio
  const pipelineSemana = [...pendentes, ...emAnalise]
    .sort((a, b) => (a.data_inicio ?? "").localeCompare(b.data_inicio ?? ""))
    .slice(0, 5);

  // Últimas análises deliberadas pelo Comitê (5 mais recentes por data_comite)
  const ultimasAprovadas = [...deliberadas]
    .sort((a, b) => {
      const da = String((b as any).data_comite || b.data_conclusao || "");
      const db = String((a as any).data_comite || a.data_conclusao || "");
      return da.localeCompare(db);
    })
    .slice(0, 5);

  // Alertas dinâmicos: vencidas com alocação (mais urgentes)
  const alertasDinamicos = vencidasComAlocacao
    .sort((a, b) => (a.data_conclusao ?? "").localeCompare(b.data_conclusao ?? ""))
    .slice(0, 5)
    .map((a) => ({
      tipo: "Análise vencida c/ alocação",
      empresa: getEmpresaNome(a.empresa_id),
      data: a.data_conclusao ? new Date(a.data_conclusao.split("T")[0]).toLocaleDateString("pt-BR") : "-",
      severity: "danger" as const,
    }));

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Dashboard</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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

      {/* Pipeline Geral — visible for all, expanded for Gestor */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Pipeline Geral
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4 flex-wrap">
            <div className="text-center">
              <p className="text-xl font-bold text-status-warning">{pendentes.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Pendente</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-status-info">{emAnalise.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Em Análise</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-muted-foreground">{concluidas.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Concluída</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-status-success">{buys.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Buy</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-amber-500">{holds.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Hold</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-status-danger">{sells.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Sell</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-orange-400">{vencidasComAlocacao.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Vencida c/ Aloc.</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-orange-300">{vencidasSemAlocacao.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Vencida s/ Aloc.</p>
            </div>
          </div>
          {vencidasComAlocacao.length > 0 && (
            <div className="mb-3 p-2 rounded-md bg-status-danger/10 border border-status-danger/30">
              <p className="text-xs text-status-danger font-semibold flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {vencidasComAlocacao.length} análise(s) vencida(s) com posição
                ativa na carteira
              </p>
            </div>
          )}
          <Link to="/pipeline-de-research" className="text-xs text-primary hover:underline mt-2 inline-block">
            Ver pipeline completo →
          </Link>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Pipeline da Semana</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pipelineSemana.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma análise pendente</p>}
            {pipelineSemana.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2.5 rounded-md bg-surface-1 border border-transparent"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{getEmpresaNome(item.empresa_id)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {item.analista_responsavel} · {item.data_inicio}
                  </p>
                </div>
                {statusBadge(item.computedStatus)}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Últimas Análises Aprovadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-[11px] h-8">Empresa</TableHead>
                    <TableHead className="text-[11px] h-8">Tipo</TableHead>
                    <TableHead className="text-[11px] h-8 hidden sm:table-cell">Analista</TableHead>
                    <TableHead className="text-[11px] h-8">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ultimasAprovadas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-sm text-muted-foreground">
                        Nenhuma
                      </TableCell>
                    </TableRow>
                  )}
                  {ultimasAprovadas.map((a) => (
                    <TableRow key={a.id} className="border-border">
                      <TableCell className="text-sm py-2">{getEmpresaNome(a.empresa_id)}</TableCell>
                      <TableCell className="text-sm py-2">{a.tipo}</TableCell>
                      <TableCell className="text-sm py-2 hidden sm:table-cell">{a.analista_responsavel}</TableCell>
                      <TableCell className="text-sm py-2">
                        {a.data_conclusao ? new Date(a.data_conclusao.split("T")[0]).toLocaleDateString("pt-BR") : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Alertas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alertasDinamicos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum alerta</p>}
            {alertasDinamicos.map((alerta, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-md bg-surface-1 border border-transparent">
                <AlertTriangle
                  className={`h-4 w-4 shrink-0 ${alerta.severity === "danger" ? "text-status-danger" : "text-status-warning"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{alerta.tipo}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {alerta.empresa} · {alerta.data}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
