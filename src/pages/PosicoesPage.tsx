import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Upload, Link2, AlertCircle, Briefcase, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { mockPosicoes, empresas, type Posicao } from '@/data/mockData';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1', '#84cc16', '#f43f5e'];

const allFunds = [...new Set(mockPosicoes.map(p => p.tradingDeskShareSource))];
const allProductClasses = [...new Set(mockPosicoes.map(p => p.productClass))];

export default function PosicoesPage() {
  const [fundFilter, setFundFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const filtered = useMemo(() => {
    return mockPosicoes.filter(p => {
      return (fundFilter === 'all' || p.tradingDeskShareSource === fundFilter)
        && (classFilter === 'all' || p.productClass === classFilter);
    });
  }, [fundFilter, classFilter]);

  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  // Analytics
  const totalAtivos = mockPosicoes.length;
  const totalFundos = allFunds.length;
  const totalTipos = allProductClasses.length;

  const byClass = allProductClasses.map(pc => ({
    name: pc,
    value: mockPosicoes.filter(p => p.productClass === pc).length,
  }));

  const byFund = allFunds.map(f => ({
    name: f.length > 25 ? f.substring(0, 25) + '…' : f,
    fullName: f,
    value: mockPosicoes.filter(p => p.tradingDeskShareSource === f).length,
  }));

  // Check if product matches an empresa
  const hasLink = (p: Posicao) => {
    return empresas.some(e => {
      const tickers = ['PETR4', 'VALE3', 'AMER3'];
      return tickers.includes(p.product);
    });
  };

  const fmtNum = (v: number | null) => v === null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
  const fmtPct = (v: number | null) => v === null ? '—' : (v * 100).toFixed(2) + '%';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Posições</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 border-border">
            <Upload className="h-3.5 w-3.5" /> Importar posições
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 border-border">
            <Download className="h-3.5 w-3.5" /> Exportar .xlsx
          </Button>
        </div>
      </div>

      <Tabs defaultValue="tabela">
        <TabsList className="bg-surface-1 border border-border">
          <TabsTrigger value="tabela" className="text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Tabela</TabsTrigger>
          <TabsTrigger value="analitico" className="text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Painel Analítico</TabsTrigger>
        </TabsList>

        <TabsContent value="tabela" className="space-y-3 mt-3">
          <div className="flex gap-3">
            <Select value={fundFilter} onValueChange={setFundFilter}>
              <SelectTrigger className="w-72 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Fundo" /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">Todos os fundos</SelectItem>
                {allFunds.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-52 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">Todos os tipos</SelectItem>
                {allProductClasses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center text-xs text-muted-foreground ml-auto">
              Data ref: <span className="text-foreground font-medium ml-1">26/03/2026</span>
            </div>
          </div>

          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-[11px] h-9">Fundo</TableHead>
                    <TableHead className="text-[11px] h-9">Tipo</TableHead>
                    <TableHead className="text-[11px] h-9">Produto</TableHead>
                    <TableHead className="text-[11px] h-9">ISIN</TableHead>
                    <TableHead className="text-[11px] h-9 text-right">Qtd</TableHead>
                    <TableHead className="text-[11px] h-9 text-right">PU (R$)</TableHead>
                    <TableHead className="text-[11px] h-9 text-right">Duration</TableHead>
                    <TableHead className="text-[11px] h-9 text-right">Yield</TableHead>
                    <TableHead className="text-[11px] h-9 text-right">Spread</TableHead>
                    <TableHead className="text-[11px] h-9 text-right">DV01</TableHead>
                    <TableHead className="text-[11px] h-9 w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((p, i) => {
                    const isDimmed = p.dv01 === null;
                    const linked = hasLink(p);
                    return (
                      <TableRow key={i} className={`border-border ${isDimmed ? 'text-muted-foreground/60' : ''}`}>
                        <TableCell className="text-[11px] py-1.5 max-w-[200px] truncate">{p.tradingDeskShareSource}</TableCell>
                        <TableCell className="text-[11px] py-1.5">{p.productClass}</TableCell>
                        <TableCell className="text-[11px] py-1.5 font-mono font-medium">{p.product}</TableCell>
                        <TableCell className="text-[11px] py-1.5 font-mono text-muted-foreground">{p.isin || '—'}</TableCell>
                        <TableCell className="text-[11px] py-1.5 text-right font-mono">{p.amount.toLocaleString('pt-BR')}</TableCell>
                        <TableCell className="text-[11px] py-1.5 text-right font-mono">{fmtNum(p.financialPrice)}</TableCell>
                        <TableCell className="text-[11px] py-1.5 text-right font-mono">{fmtNum(p.durationDU)}</TableCell>
                        <TableCell className="text-[11px] py-1.5 text-right font-mono">{fmtPct(p.yield)}</TableCell>
                        <TableCell className="text-[11px] py-1.5 text-right font-mono">{fmtPct(p.impliedSpread)}</TableCell>
                        <TableCell className="text-[11px] py-1.5 text-right font-mono">{fmtNum(p.dv01)}</TableCell>
                        <TableCell className="py-1.5">
                          {linked ? (
                            <Link2 className="h-3 w-3 text-status-info" />
                          ) : ['Equity', 'Debenture'].includes(p.productClass) ? (
                            <Badge variant="outline" className="text-[8px] px-1 py-0 text-status-warning border-status-warning/30">Sem análise</Badge>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{filtered.length} registros</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="h-7 text-xs border-border">Anterior</Button>
                <span className="flex items-center px-2">{page + 1} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="h-7 text-xs border-border">Próxima</Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="analitico" className="space-y-4 mt-3">
          <div className="grid grid-cols-4 gap-3">
            <Card className="bg-card border-border"><CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground uppercase">Total de ativos</p>
              <p className="text-xl font-bold text-foreground mt-1">{totalAtivos}</p>
            </CardContent></Card>
            <Card className="bg-card border-border"><CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground uppercase">Fundos com posição</p>
              <p className="text-xl font-bold text-foreground mt-1">{totalFundos}</p>
            </CardContent></Card>
            <Card className="bg-card border-border"><CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground uppercase">Tipos distintos</p>
              <p className="text-xl font-bold text-foreground mt-1">{totalTipos}</p>
            </CardContent></Card>
            <Card className="bg-card border-border"><CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground uppercase">Data referência</p>
              <p className="text-xl font-bold text-foreground mt-1">26/03</p>
            </CardContent></Card>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição por Tipo</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={byClass} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={2} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {byClass.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(240 6% 10%)', border: '1px solid hsl(240 4% 20%)', borderRadius: '6px', fontSize: '12px', color: 'hsl(0 0% 95%)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Posição por Fundo</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={byFund} layout="vertical" margin={{ left: 10 }}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(240 5% 65%)' }} />
                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 9, fill: 'hsl(240 5% 65%)' }} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(240 6% 10%)', border: '1px solid hsl(240 4% 20%)', borderRadius: '6px', fontSize: '12px', color: 'hsl(0 0% 95%)' }} />
                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
