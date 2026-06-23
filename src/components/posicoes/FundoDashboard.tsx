import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { BarChart3, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
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

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="bg-surface-1 border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[260px]">{children}</CardContent>
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">Selecione o fundo</label>
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

      {/* Empty state */}
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

      {/* Loading */}
      {fundo && isLoading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando posições do fundo…
        </div>
      )}

      {/* Error */}
      {fundo && error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">
            Erro ao carregar dados: {error.message}
          </CardContent>
        </Card>
      )}

      {/* Content */}
      {fundo && !isLoading && !error && data && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {[
              { label: 'PL Total', value: fmtMi(data.totalPL) },
              { label: 'Nº de Ativos', value: data.totalAtivos.toLocaleString('pt-BR') },
              { label: 'Duration Médio', value: fmtDU(data.durationMedia) },
              {
                label: 'Maior Concentração',
                value: `${data.topConcentracao.nome} · ${fmtPct(data.topConcentracao.pct)}`,
              },
              { label: 'Qualidade Média', value: data.qualidadeMedia },
            ].map((k) => (
              <Card key={k.label} className="bg-surface-1 border-border">
                <CardContent className="p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k.label}</div>
                  <div className="text-base font-semibold mt-1 truncate" title={k.value}>{k.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Distribuição por Tipo de Ativo">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.byTipo} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={1}>
                    {data.byTipo.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                  <Tooltip content={renderTooltip} />
                  <Legend verticalAlign="bottom" height={28} iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Distribuição por Indexador">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.byIndexador} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={1}>
                    {data.byIndexador.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                  <Tooltip content={renderTooltip} />
                  <Legend verticalAlign="bottom" height={28} iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Distribuição por Rating">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byRating} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={48} />
                  <Tooltip content={renderTooltip} cursor={{ fill: 'hsl(var(--muted)/0.4)' }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Distribuição por Setor (TOP 10)">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.bySetor} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                  <Tooltip content={renderTooltip} cursor={{ fill: 'hsl(var(--muted)/0.4)' }} />
                  <Bar dataKey="value" fill={PALETTE[1]} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Distribuição por Duration">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byDuration} margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                  <Tooltip content={renderTooltip} cursor={{ fill: 'hsl(var(--muted)/0.4)' }} />
                  <Bar dataKey="value" fill={PALETTE[2]} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Concentração por Grupo Econômico (TOP 10)">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byGrupo} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140} />
                  <Tooltip content={renderTooltip} cursor={{ fill: 'hsl(var(--muted)/0.4)' }} />
                  <Bar dataKey="value" fill={PALETTE[3]} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Emissores table */}
          <Card className="bg-surface-1 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Emissores</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-auto">
                <Table className="text-xs [&_tr:nth-child(even)]:bg-muted/30">
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="h-8">Emissor</TableHead>
                      <TableHead className="h-8">Grupo Econômico</TableHead>
                      <TableHead className="h-8">Setor</TableHead>
                      <TableHead className="h-8">Rating</TableHead>
                      <TableHead className="h-8 text-right">Financeiro (R$)</TableHead>
                      <TableHead className="h-8 text-right">% do PL</TableHead>
                      <TableHead className="h-8 text-right">Duration (d.u.)</TableHead>
                      <TableHead className="h-8">Produto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.byEmissor.map((e) => (
                      <TableRow key={e.codigo}>
                        <TableCell className="py-1.5 font-medium">{e.nome}</TableCell>
                        <TableCell className="py-1.5">{e.grupo}</TableCell>
                        <TableCell className="py-1.5">{e.setor}</TableCell>
                        <TableCell className="py-1.5">{e.rating}</TableCell>
                        <TableCell className="py-1.5 text-right tabular-nums">{fmtBRL(e.financeiro)}</TableCell>
                        <TableCell className="py-1.5 text-right tabular-nums">{fmtPct(e.pctPL)}</TableCell>
                        <TableCell className="py-1.5 text-right tabular-nums">{Math.round(e.duration).toLocaleString('pt-BR')}</TableCell>
                        <TableCell className="py-1.5">{e.produtos}</TableCell>
                      </TableRow>
                    ))}
                    {data.byEmissor.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                          Sem dados.
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
