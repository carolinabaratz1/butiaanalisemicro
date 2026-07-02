import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { BarChart3, Loader2, Info } from 'lucide-react';
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

export function FundoDashboard() {
  const [fundo, setFundo] = useState<string | null>(null);
  const { data: fundos = [] } = useFundos();
  const { data, isLoading, error } = useFundoDashboard(fundo);
  const total = data?.totalPL ?? 0;

  const renderTooltip = useMemo(
    () => (props: any) => <ChartTooltip {...props} total={total} />,
    [total],
  );

  const topPos = data?.total.topPosicoes ?? [];

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
                  Visão consolidada do fundo · última posição importada
                </span>
              </div>
            </CardContent>
          </Card>

          {/* KPIs consolidados */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="PL Total" value={fmtMi(data.totalPL)} tone="accent" />
            <Kpi label="Nº de Ativos" value={data.totalAtivos.toLocaleString('pt-BR')} />
            <Kpi label="Duration Médio" value={fmtDU(data.durationMedia)} hint="Ponderado pelo financeiro em dias úteis." />
            <Kpi label="Maior Concentração" value={`${data.topConcentracao.nome} · ${fmtPct(data.topConcentracao.pct)}`} />
          </div>

          {/* Composição consolidada */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Distribuição por Tipo de Ativo">
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

            <ChartCard title="Distribuição por Indexador">
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

            <ChartCard title="Distribuição por Duration">
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

            <ChartCard title="Top 10 Posições" subtitle="Agregado por ticker/ISIN">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topPos.slice(0, 10).map(p => ({ name: p.ticker || p.nome, value: p.financeiro }))}
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

          {/* Top Posições - tabela consolidada */}
          <Card className="bg-surface-1 border-border">
            <CardHeader className="pb-2 flex-row items-baseline justify-between space-y-0">
              <div>
                <CardTitle className="text-sm font-medium">Top Posições do Fundo</CardTitle>
                <div className="text-[10.5px] text-muted-foreground">Visão consolidada da carteira</div>
              </div>
              <div className="text-[10.5px] text-muted-foreground">
                {topPos.length} posições
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topPos.slice(0, 200).map((p) => (
                      <TableRow key={p.key}>
                        <TableCell className="py-1.5 font-medium truncate max-w-[180px]" title={p.nome}>{p.nome}</TableCell>
                        <TableCell className="py-1.5">{p.ticker}</TableCell>
                        <TableCell className="py-1.5">{p.tipo}</TableCell>
                        <TableCell className="py-1.5 truncate max-w-[160px]" title={p.emissor}>{p.emissor}</TableCell>
                        <TableCell className="py-1.5 truncate max-w-[160px]" title={p.grupo}>{p.grupo}</TableCell>
                        <TableCell className="py-1.5 text-right tabular-nums">{fmtBRL(p.financeiro)}</TableCell>
                        <TableCell className="py-1.5 text-right tabular-nums">{fmtPct(p.pctPL)}</TableCell>
                      </TableRow>
                    ))}
                    {topPos.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                          Sem posições para este fundo.
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
