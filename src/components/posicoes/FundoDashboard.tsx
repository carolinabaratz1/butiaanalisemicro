import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { BarChart3, Loader2, Info, ShieldCheck, Wallet, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFundos } from '@/hooks/useFundos';
import { useFundoDashboard } from '@/hooks/useFundoDashboard';

const PALETTE = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 200 80% 55%))',
  'hsl(var(--chart-3, 280 65% 60%))',
  'hsl(var(--chart-4, 35 90% 55%))',
  'hsl(var(--chart-5, 150 60% 45%))',
  'hsl(var(--chart-1, 340 75% 55%))',
  'hsl(var(--muted-foreground))',
  'hsl(var(--accent))',
  'hsl(var(--secondary))',
  'hsl(var(--destructive))',
];

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtMi = (n: number) => `R$ ${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`;
const fmtPct = (n: number) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const fmtDU = (n: number) => `${Math.round(n).toLocaleString('pt-BR')} d.u.`;

function ChartTooltip({ active, payload, total }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const val = Number(p.value) || 0;
  const name = p.name ?? p.payload?.name;
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow">
      <div className="font-medium">{name}</div>
      <div className="text-muted-foreground">
        {fmtMi(val)} {total > 0 && <span className="ml-1">· {fmtPct(val / total)}</span>}
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle, icon }: { title: string; subtitle: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 border-b border-border/60 pb-2 mb-3">
      {icon}
      <div>
        <div className="text-sm font-semibold tracking-tight">{title}</div>
        <div className="text-[11px] text-muted-foreground">{subtitle}</div>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="bg-surface-1 border-border">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {subtitle && <div className="text-[10.5px] text-muted-foreground">{subtitle}</div>}
      </CardHeader>
      <CardContent className="h-[260px]">{children}</CardContent>
    </Card>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'muted' | 'accent' }) {
  return (
    <Card className={`bg-surface-1 border-border ${tone === 'accent' ? 'border-primary/30' : ''}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
          {hint && (
            <TooltipProvider><UiTooltip>
              <TooltipTrigger asChild><Info className="w-3 h-3 opacity-60" /></TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] text-xs">{hint}</TooltipContent>
            </UiTooltip></TooltipProvider>
          )}
        </div>
        <div className="text-base font-semibold mt-1 truncate" title={value}>{value}</div>
      </CardContent>
    </Card>
  );
}

type ViewMode = 'total' | 'credito' | 'nao_aplicavel';

export function FundoDashboard() {
  const [fundo, setFundo] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('total');
  const { data: fundos = [] } = useFundos();
  const { data, isLoading, error } = useFundoDashboard(fundo);
  const total = data?.totalPL ?? 0;

  const renderTooltip = useMemo(
    () => (props: any) => <ChartTooltip {...props} total={total} />,
    [total],
  );
  const renderTooltipCredito = useMemo(
    () => (props: any) => <ChartTooltip {...props} total={data?.plCredito ?? 0} />,
    [data?.plCredito],
  );

  const filteredTopPos = useMemo(() => {
    if (!data) return [];
    const list = data.total.topPosicoes;
    if (viewMode === 'credito') return list.filter(p => p.eligible);
    if (viewMode === 'nao_aplicavel') return list.filter(p => !p.eligible);
    return list;
  }, [data, viewMode]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">Fundo</label>
          <Select value={fundo ?? ''} onValueChange={(v) => setFundo(v || null)}>
            <SelectTrigger className="w-full sm:w-96 h-9 text-sm bg-surface-1 border-border">
              <SelectValue placeholder="Escolha um fundo para visualizar o dashboard" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {fundos.map((f) => (
                <SelectItem key={f} value={f} className="text-sm">{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {fundo && data && (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Visão</label>
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <SelectTrigger className="w-56 h-9 text-sm bg-surface-1 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="total">Carteira total</SelectItem>
                <SelectItem value="credito">Crédito privado</SelectItem>
                <SelectItem value="nao_aplicavel">Não aplicável a crédito</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {!fundo && (
        <Card className="bg-surface-1 border-border">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <BarChart3 className="w-12 h-12 text-muted-foreground mb-3" />
            <div className="text-sm text-muted-foreground">
              Selecione um fundo para visualizar o dashboard
            </div>
          </CardContent>
        </Card>
      )}

      {fundo && isLoading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando posições do fundo…
        </div>
      )}

      {fundo && error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">
            Erro ao carregar dados: {error.message}
          </CardContent>
        </Card>
      )}

      {fundo && !isLoading && !error && data && (
        <>
          {/* Header institucional */}
          <Card className="bg-surface-1 border-border">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <div className="text-base font-semibold tracking-tight">{fundo}</div>
                <Badge variant="outline" className="text-[10px] font-normal">Fonte: BASE LOTE 45</Badge>
                <span className="text-xs text-muted-foreground">
                  Lâmina consolidada do fundo · última posição importada
                </span>
              </div>
            </CardContent>
          </Card>

          {/* KPIs (8) */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-3">
            <Kpi label="PL Total" value={fmtMi(data.totalPL)} tone="accent" />
            <Kpi label="Nº de Ativos" value={data.totalAtivos.toLocaleString('pt-BR')} />
            <Kpi label="Duration Médio" value={fmtDU(data.durationMedia)} hint="Ponderado pelo financeiro em dias úteis." />
            <Kpi label="Taxa Média Pond." value="—" hint="Requer taxa unitária por ativo — não disponível na fonte atual." />
            <Kpi label="Maior Concentração" value={`${data.topConcentracao.nome} · ${fmtPct(data.topConcentracao.pct)}`} />
            <Kpi label="Exposição Crédito Privado" value={fmtMi(data.plCredito)} hint="Soma dos ativos elegíveis para análise de crédito." />
            <Kpi label="% do PL em Crédito" value={fmtPct(data.pctCredito)} />
            <Kpi label="Rating Médio (crédito)" value={data.qualidadeMedia} hint="Rating com maior exposição no universo elegível a crédito." />
          </div>

          {/* SEÇÃO A - Total */}
          <div>
            <SectionHeader
              title="Composição Total da Carteira"
              subtitle="Base: todos os ativos da posição importada."
              icon={<Wallet className="w-4 h-4 text-primary mt-0.5" />}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Distribuição por Tipo de Ativo" subtitle="Base: carteira total">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.total.byTipo} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={1}>
                      {data.total.byTipo.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Pie>
                    <Tooltip content={renderTooltip} />
                    <Legend verticalAlign="bottom" height={28} iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Distribuição por Indexador" subtitle="Base: carteira total">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.total.byIndexador} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={1}>
                      {data.total.byIndexador.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Pie>
                    <Tooltip content={renderTooltip} />
                    <Legend verticalAlign="bottom" height={28} iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Distribuição por Duration" subtitle="Base: carteira total">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.total.byDuration} margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                    <Tooltip content={renderTooltip} cursor={{ fill: 'hsl(var(--muted)/0.4)' }} />
                    <Bar dataKey="value" fill={PALETTE[2]} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Top 10 Posições" subtitle="Base: carteira total, agregado por ticker/ISIN">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.total.topPosicoes.slice(0, 10).map(p => ({ name: p.ticker || p.nome, value: p.financeiro }))}
                    layout="vertical"
                    margin={{ left: 8, right: 16 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                    <Tooltip content={renderTooltip} cursor={{ fill: 'hsl(var(--muted)/0.4)' }} />
                    <Bar dataKey="value" fill={PALETTE[0]} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </div>

          {/* SEÇÃO B - Crédito */}
          <div>
            <SectionHeader
              title="Análise de Crédito"
              subtitle="Base: apenas ativos elegíveis para análise de emissor, rating, setor e grupo econômico."
              icon={<ShieldCheck className="w-4 h-4 text-primary mt-0.5" />}
            />
            {!data.credito.hasEligible ? (
              <Card className="bg-surface-1 border-border">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Este fundo não possui ativos elegíveis para análise de crédito/emissor nesta data.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard title="Distribuição por Rating" subtitle="Base: universo de crédito privado">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.credito.byRating} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
                      <Tooltip content={renderTooltipCredito} cursor={{ fill: 'hsl(var(--muted)/0.4)' }} />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Distribuição por Setor (TOP 10)" subtitle="Base: universo de crédito privado">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.credito.bySetor} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                      <Tooltip content={renderTooltipCredito} cursor={{ fill: 'hsl(var(--muted)/0.4)' }} />
                      <Bar dataKey="value" fill={PALETTE[1]} radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Top 10 Grupos Econômicos" subtitle="Base: universo de crédito privado">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.credito.byGrupo} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140} />
                      <Tooltip content={renderTooltipCredito} cursor={{ fill: 'hsl(var(--muted)/0.4)' }} />
                      <Bar dataKey="value" fill={PALETTE[3]} radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Top 10 Emissores" subtitle="Base: universo de crédito privado">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.credito.byEmissor.slice(0, 10).map(e => ({ name: e.nome, value: e.financeiro }))}
                      layout="vertical"
                      margin={{ left: 8, right: 16 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140} />
                      <Tooltip content={renderTooltipCredito} cursor={{ fill: 'hsl(var(--muted)/0.4)' }} />
                      <Bar dataKey="value" fill={PALETTE[4]} radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            )}
          </div>

          {/* SEÇÃO C - Qualidade */}
          <div>
            <SectionHeader
              title="Qualidade dos Dados"
              subtitle="Cobertura de rating, setor e grupo econômico no universo elegível a crédito."
              icon={<AlertCircle className="w-4 h-4 text-primary mt-0.5" />}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-3 mb-3">
              <Kpi label="% Elegível" value={fmtPct(data.qualidade.pctElegivel)} />
              <Kpi label="% Não Aplicável" value={fmtPct(data.qualidade.pctNaoAplicavel)} />
              <Kpi label="% Crédito c/ Rating (CNPJ)" value={fmtPct(data.qualidade.pctComRating)} hint="Cobertura de rating no universo de crédito, buscado pelo CNPJ do emissor." />
              <Kpi label="% Crédito c/ Setor" value={fmtPct(data.qualidade.pctComSetor)} />
              <Kpi label="% Crédito c/ Grupo" value={fmtPct(data.qualidade.pctComGrupo)} />
              <Kpi label="% CNPJ não mapeado" value={fmtPct(data.qualidade.pctCnpjNaoMapeado)} hint="Ativos elegíveis sem CNPJ do emissor vinculado ao ISIN." />
              <Kpi label="Emissores sem rating" value={data.qualidade.emissoresSemRating.toLocaleString('pt-BR')} hint="CNPJs elegíveis sem rating cadastrado (via cadastro de emissores/grupo)." />
              <Kpi label="Ativos s/ CNPJ mapeado" value={data.qualidade.ativosCnpjNaoMapeado.toLocaleString('pt-BR')} />
            </div>
            <Card className="bg-surface-1 border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Diagnóstico de Cobertura</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table className="text-xs">
                  <TableHeader className="bg-card">
                    <TableRow>
                      <TableHead className="h-8">Categoria</TableHead>
                      <TableHead className="h-8 text-right">Valor (R$)</TableHead>
                      <TableHead className="h-8 text-right">% do PL</TableHead>
                      <TableHead className="h-8">Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.qualidade.diagnostico.map((d) => (
                      <TableRow key={d.key}>
                        <TableCell className="py-1.5 font-medium">{d.categoria}</TableCell>
                        <TableCell className="py-1.5 text-right tabular-nums">{fmtBRL(d.valor)}</TableCell>
                        <TableCell className="py-1.5 text-right tabular-nums">{fmtPct(d.pct)}</TableCell>
                        <TableCell className="py-1.5 text-muted-foreground">{d.observacao}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Top Posições */}
          <Card className="bg-surface-1 border-border">
            <CardHeader className="pb-2 flex-row items-baseline justify-between space-y-0">
              <div>
                <CardTitle className="text-sm font-medium">Top Posições do Fundo</CardTitle>
                <div className="text-[10.5px] text-muted-foreground">
                  Filtrado pela visão: {viewMode === 'total' ? 'Carteira total' : viewMode === 'credito' ? 'Crédito privado' : 'Não aplicável a crédito'}
                </div>
              </div>
              <div className="text-[10.5px] text-muted-foreground">
                {filteredTopPos.length} posições
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[440px] overflow-auto">
                <Table className="text-xs [&_tr:nth-child(even)]:bg-muted/30">
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="h-8">Ativo</TableHead>
                      <TableHead className="h-8">Ticker</TableHead>
                      <TableHead className="h-8">Tipo</TableHead>
                      <TableHead className="h-8">Emissor</TableHead>
                      <TableHead className="h-8">Grupo</TableHead>
                      <TableHead className="h-8 text-right">Valor (R$)</TableHead>
                      <TableHead className="h-8 text-right">% do PL</TableHead>
                      <TableHead className="h-8">Rating</TableHead>
                      <TableHead className="h-8">Setor</TableHead>
                      <TableHead className="h-8">Elegível crédito?</TableHead>
                      <TableHead className="h-8">Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTopPos.slice(0, 200).map((p) => (
                      <TableRow key={p.key}>
                        <TableCell className="py-1.5 font-medium truncate max-w-[180px]" title={p.nome}>{p.nome}</TableCell>
                        <TableCell className="py-1.5">{p.ticker}</TableCell>
                        <TableCell className="py-1.5">{p.tipo}</TableCell>
                        <TableCell className="py-1.5 truncate max-w-[160px]" title={p.emissor}>{p.emissor}</TableCell>
                        <TableCell className="py-1.5 truncate max-w-[160px]" title={p.grupo}>{p.grupo}</TableCell>
                        <TableCell className="py-1.5 text-right tabular-nums">{fmtBRL(p.financeiro)}</TableCell>
                        <TableCell className="py-1.5 text-right tabular-nums">{fmtPct(p.pctPL)}</TableCell>
                        <TableCell className="py-1.5">
                          {p.rating === 'Sem rating'
                            ? <Badge variant="outline" className="text-[10px] font-normal border-amber-500/50 text-amber-600">Sem rating</Badge>
                            : p.rating}
                        </TableCell>
                        <TableCell className="py-1.5">
                          {p.setor === 'Sem setor'
                            ? <Badge variant="outline" className="text-[10px] font-normal border-amber-500/50 text-amber-600">Sem setor</Badge>
                            : p.setor}
                        </TableCell>
                        <TableCell className="py-1.5">
                          {p.eligible
                            ? <Badge variant="outline" className="text-[10px] font-normal border-emerald-500/50 text-emerald-600">Sim</Badge>
                            : <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">Não</Badge>}
                        </TableCell>
                        <TableCell className="py-1.5 text-muted-foreground text-[11px] truncate max-w-[220px]" title={p.observacao}>
                          {p.observacao || (p.data_quality_status === 'sem_mapeamento' ? 'Grupo não mapeado' : '')}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredTopPos.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-6 text-muted-foreground">
                          Sem posições para esta visão.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
