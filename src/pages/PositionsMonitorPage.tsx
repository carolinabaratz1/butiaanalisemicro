import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, Search, Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchAllPaged } from "@/utils/analiseStatus";
import { resolveRatingsBatch, ratingKey } from "@/lib/ratings/resolveRatingsBatch";
import { resolvePositionRating } from "@/lib/ratings/resolvePositionRating";
import { cn } from "@/lib/utils";

// ---------- helpers ----------
const fmtCurrency = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtNum = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function parseValDate(s?: string | null): Date | null {
  if (!s) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [mm, dd, yyyy] = s.split("/");
    return new Date(+yyyy, +mm - 1, +dd);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s);
  return null;
}
function formatDateBR(s?: string | null) {
  const d = parseValDate(s);
  if (!d) return s ?? "—";
  return d.toLocaleDateString("pt-BR");
}
function bucketRating(r?: string | null): string {
  if (!r) return "—";
  const up = r.toUpperCase().replace(/[^A-Z+\-]/g, "");
  if (up.startsWith("AAA")) return "AAA";
  if (up.startsWith("AA")) return "AA";
  if (up.startsWith("A")) return "A";
  if (up.startsWith("BBB")) return "BBB";
  if (up.startsWith("BB")) return "BB";
  if (up.startsWith("B")) return "B";
  if (up.startsWith("C")) return "C";
  if (up.startsWith("D")) return "D";
  return r;
}
const BUCKETS = ["AAA", "AA", "A", "BBB", "BB", "B", "C", "D", "—"] as const;
const RATING_COLORS: Record<string, string> = {
  AAA: "#059669",
  AA: "#10b981",
  A: "#84cc16",
  BBB: "#eab308",
  BB: "#f97316",
  B: "#ef4444",
  C: "#b91c1c",
  D: "#7f1d1d",
  "—": "#6b7280",
};
function ratingRowClass(bucket: string): string {
  switch (bucket) {
    case "AAA":
    case "AA":
      return "border-l-4 border-l-emerald-500/60";
    case "A":
      return "border-l-4 border-l-lime-500/60";
    case "BBB":
      return "border-l-4 border-l-yellow-500/60";
    case "BB":
      return "border-l-4 border-l-orange-500/60";
    case "B":
    case "C":
    case "D":
      return "border-l-4 border-l-red-500/60";
    default:
      return "border-l-4 border-l-muted";
  }
}
const SOURCE_LABEL: Record<string, string> = {
  ticker: "ativo",
  emissor: "emissor",
  grupo: "grupo",
  nr: "s/rating",
};

interface Row {
  id: string;
  isin: string | null;
  ticker: string | null;
  cnpj: string;
  fundo: string;
  produto: string | null;
  productClass: string | null;
  amount: number;
  price: number;
  total: number;
  yieldPct: number | null;
  valDate: string | null;
  dateObj: Date | null;
  rating: string | null;
  ratingBucket: string;
  sourceLevel: string;
}

// ---------- data ----------
async function fetchAllPositions(): Promise<Row[]> {
  const pos = await fetchAllPaged<any>((from, to) =>
    supabase
      .from("posicoes")
      .select("id, isin, val_date, product_class, product, amount, financial_price, yield, trading_desk_share_source")
      .range(from, to),
  );
  const filtered = pos.filter((p) => Number(p.amount) > 0 && Number(p.financial_price) > 0);
  const isins = Array.from(new Set(filtered.map((p) => p.isin).filter(Boolean))) as string[];

  const emissoesMap = new Map<string, { ticker: string | null; cnpj: string | null }>();
  // chunk fetch emissoes to avoid huge in()
  for (let i = 0; i < isins.length; i += 500) {
    const chunk = isins.slice(i, i + 500);
    const { data, error } = await supabase
      .from("emissoes")
      .select("isin, ticker, cnpj_emissor")
      .in("isin", chunk);
    if (error) throw error;
    (data ?? []).forEach((e: any) => emissoesMap.set(e.isin, { ticker: e.ticker, cnpj: e.cnpj_emissor }));
  }

  const partials = filtered.map((p) => {
    const em = emissoesMap.get(p.isin ?? "") ?? { ticker: null, cnpj: null };
    const cnpj = (em.cnpj ?? "").replace(/[^0-9]/g, "");
    return {
      raw: p,
      ticker: em.ticker,
      cnpj,
    };
  });

  const ratingsMap = await resolveRatingsBatch(
    partials.map((p) => ({ cnpj: p.cnpj, ticker: p.ticker })),
  );

  return partials.map(({ raw, ticker, cnpj }) => {
    const rr = ratingsMap.get(ratingKey(cnpj, ticker));
    const amount = Number(raw.amount) || 0;
    const price = Number(raw.financial_price) || 0;
    return {
      id: raw.id,
      isin: raw.isin,
      ticker,
      cnpj,
      fundo: raw.trading_desk_share_source ?? "—",
      produto: raw.product,
      productClass: raw.product_class,
      amount,
      price,
      total: amount * price,
      yieldPct: raw.yield != null ? Number(raw.yield) : null,
      valDate: raw.val_date,
      dateObj: parseValDate(raw.val_date),
      rating: rr?.rating ?? null,
      ratingBucket: bucketRating(rr?.rating),
      sourceLevel: rr?.source ?? "nr",
    } as Row;
  });
}

// ---------- component ----------
type SortKey = "ticker" | "fundo" | "amount" | "price" | "total" | "date" | "rating";

export default function PositionsMonitorPage() {
  const { data: rows = [], isLoading, isError, error } = useQuery({
    queryKey: ["positions-monitor"],
    queryFn: fetchAllPositions,
    staleTime: 60_000,
  });

  const [search, setSearch] = useState("");
  const [selectedRatings, setSelectedRatings] = useState<string[]>([]);
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [valueRange, setValueRange] = useState<[number, number] | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const maxValue = useMemo(
    () => rows.reduce((m, r) => Math.max(m, r.total), 0),
    [rows],
  );
  const effectiveValueRange = valueRange ?? [0, maxValue];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const startD = dateStart ? new Date(dateStart) : null;
    const endD = dateEnd ? new Date(dateEnd) : null;
    return rows.filter((r) => {
      if (q) {
        const hay = `${r.ticker ?? ""} ${r.isin ?? ""} ${r.produto ?? ""} ${r.fundo}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (selectedRatings.length && !selectedRatings.includes(r.ratingBucket)) return false;
      if (startD && (!r.dateObj || r.dateObj < startD)) return false;
      if (endD && (!r.dateObj || r.dateObj > endD)) return false;
      if (r.total < effectiveValueRange[0] || r.total > effectiveValueRange[1]) return false;
      return true;
    });
  }, [rows, search, selectedRatings, dateStart, dateEnd, effectiveValueRange]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "ticker": av = a.ticker ?? a.isin ?? ""; bv = b.ticker ?? b.isin ?? ""; break;
        case "fundo": av = a.fundo; bv = b.fundo; break;
        case "amount": av = a.amount; bv = b.amount; break;
        case "price": av = a.price; bv = b.price; break;
        case "total": av = a.total; bv = b.total; break;
        case "date": av = a.dateObj?.getTime() ?? 0; bv = b.dateObj?.getTime() ?? 0; break;
        case "rating": av = BUCKETS.indexOf(a.ratingBucket as any); bv = BUCKETS.indexOf(b.ratingBucket as any); break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  // KPIs (usam filtered — não a página)
  const kpis = useMemo(() => {
    const total = filtered.reduce((s, r) => s + r.total, 0);
    const count = filtered.length;
    const top = filtered.reduce<Row | null>((best, r) => (!best || r.total > best.total ? r : best), null);
    // Herfindahl-Hirschman index (0..1) baseado em share por ativo
    let hhi = 0;
    if (total > 0) {
      for (const r of filtered) {
        const s = r.total / total;
        hhi += s * s;
      }
    }
    return {
      count,
      total,
      avg: count ? total / count : 0,
      hhi,
      top,
    };
  }, [filtered]);

  const chartData = useMemo(() => {
    const bucketCount: Record<string, number> = {};
    filtered.forEach((r) => {
      bucketCount[r.ratingBucket] = (bucketCount[r.ratingBucket] ?? 0) + 1;
    });
    return BUCKETS.filter((b) => bucketCount[b])
      .map((b) => ({ name: b, value: bucketCount[b], fill: RATING_COLORS[b] }));
  }, [filtered]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  }

  function toggleRating(b: string) {
    setPage(0);
    setSelectedRatings((prev) => prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]);
  }

  function exportCSV() {
    const header = ["Ticker","ISIN","Fundo","CNPJ","Produto","Quantidade","Preço","Total","Rating","Fonte","Data"];
    const csvRows = [header.join(";")];
    for (const r of sorted) {
      csvRows.push([
        r.ticker ?? "",
        r.isin ?? "",
        r.fundo,
        r.cnpj,
        r.produto ?? "",
        r.amount,
        r.price,
        r.total,
        r.rating ?? "",
        r.sourceLevel,
        formatDateBR(r.valDate),
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"));
    }
    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `positions-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Positions Monitor</h1>
          <p className="text-sm text-muted-foreground">
            Todas as posições ativas com rating resolvido automaticamente por CNPJ/ISIN/Ticker.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={!sorted.length} className="gap-1">
          <Download className="h-3 w-3" /> Exportar CSV
        </Button>
      </header>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando posições e resolvendo ratings…
        </div>
      )}
      {isError && (
        <p className="text-sm text-destructive">Erro: {(error as any)?.message ?? "desconhecido"}</p>
      )}

      {!isLoading && !isError && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Posições</div><div className="text-2xl font-semibold">{kpis.count.toLocaleString("pt-BR")}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Valor total</div><div className="text-2xl font-semibold">{fmtCurrency(kpis.total)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Valor médio</div><div className="text-2xl font-semibold">{fmtCurrency(kpis.avg)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground" title="Herfindahl-Hirschman Index">Concentração (HHI)</div><div className="text-2xl font-semibold">{(kpis.hhi * 100).toFixed(2)}%</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Top ativo</div><div className="text-sm font-semibold truncate" title={kpis.top?.ticker ?? kpis.top?.isin ?? ""}>{kpis.top?.ticker ?? kpis.top?.isin ?? "—"}</div><div className="text-xs text-muted-foreground">{kpis.top ? fmtCurrency(kpis.top.total) : ""}</div></CardContent></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
            {/* Filtros */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Filtros</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs">Busca (ticker/ISIN/produto/fundo)</Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                    <Input value={search} onChange={(e) => { setPage(0); setSearch(e.target.value); }} className="h-8 pl-7" placeholder="ex.: VALE, BR..." />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Rating</Label>
                  <div className="mt-2 grid grid-cols-3 gap-1">
                    {BUCKETS.map((b) => (
                      <label key={b} className="flex items-center gap-1 text-xs cursor-pointer">
                        <Checkbox checked={selectedRatings.includes(b)} onCheckedChange={() => toggleRating(b)} />
                        <span className="font-mono">{b}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">De</Label>
                    <Input type="date" value={dateStart} onChange={(e) => { setPage(0); setDateStart(e.target.value); }} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Até</Label>
                    <Input type="date" value={dateEnd} onChange={(e) => { setPage(0); setDateEnd(e.target.value); }} className="h-8" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Valor total (R$)</Label>
                  <div className="text-[11px] text-muted-foreground">
                    {fmtCurrency(effectiveValueRange[0])} – {fmtCurrency(effectiveValueRange[1])}
                  </div>
                  <Slider
                    className="mt-2"
                    min={0}
                    max={Math.max(1, maxValue)}
                    step={Math.max(1, Math.floor(maxValue / 100))}
                    value={effectiveValueRange}
                    onValueChange={(v) => { setPage(0); setValueRange([v[0], v[1]] as [number, number]); }}
                  />
                </div>
                <Button variant="ghost" size="sm" className="w-full" onClick={() => {
                  setSearch(""); setSelectedRatings([]); setDateStart(""); setDateEnd(""); setValueRange(null); setPage(0);
                }}>Limpar filtros</Button>
              </CardContent>
            </Card>

            {/* Tabela + Chart */}
            <div className="space-y-4 min-w-0">
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[11px] cursor-pointer" onClick={() => toggleSort("ticker")}>Ativo</TableHead>
                          <TableHead className="text-[11px] cursor-pointer" onClick={() => toggleSort("fundo")}>Fundo</TableHead>
                          <TableHead className="text-[11px] text-right cursor-pointer" onClick={() => toggleSort("amount")}>Qtd</TableHead>
                          <TableHead className="text-[11px] text-right cursor-pointer" onClick={() => toggleSort("price")}>Preço</TableHead>
                          <TableHead className="text-[11px] text-right cursor-pointer" onClick={() => toggleSort("total")}>Total</TableHead>
                          <TableHead className="text-[11px] cursor-pointer" onClick={() => toggleSort("rating")}>Rating</TableHead>
                          <TableHead className="text-[11px]">Fonte</TableHead>
                          <TableHead className="text-[11px] cursor-pointer" onClick={() => toggleSort("date")}>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pageRows.length === 0 && (
                          <TableRow><TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-6">Nenhuma posição para os filtros atuais.</TableCell></TableRow>
                        )}
                        {pageRows.map((r) => (
                          <TableRow key={r.id} className={cn(ratingRowClass(r.ratingBucket))}>
                            <TableCell className="text-xs font-mono">
                              <div className="font-semibold">{r.ticker ?? r.isin ?? "—"}</div>
                              <div className="text-[10px] text-muted-foreground truncate max-w-[180px]" title={r.produto ?? ""}>{r.produto ?? ""}</div>
                            </TableCell>
                            <TableCell className="text-xs">{r.fundo}</TableCell>
                            <TableCell className="text-xs text-right">{fmtNum(r.amount)}</TableCell>
                            <TableCell className="text-xs text-right">{fmtCurrency(r.price)}</TableCell>
                            <TableCell className="text-xs text-right font-semibold">{fmtCurrency(r.total)}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className="font-mono" style={{ borderColor: RATING_COLORS[r.ratingBucket], color: RATING_COLORS[r.ratingBucket] }}>
                                {r.rating ?? "N/R"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-[11px] text-muted-foreground">{SOURCE_LABEL[r.sourceLevel] ?? r.sourceLevel}</TableCell>
                            <TableCell className="text-xs">{formatDateBR(r.valDate)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex items-center justify-between p-3 border-t border-border text-xs">
                    <span className="text-muted-foreground">
                      Mostrando {sorted.length === 0 ? 0 : currentPage * pageSize + 1}
                      –{Math.min((currentPage + 1) * pageSize, sorted.length)} de {sorted.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0}>
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <span>Página {currentPage + 1} / {totalPages}</span>
                      <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1}>
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Distribuição por rating</CardTitle></CardHeader>
                <CardContent>
                  {chartData.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem dados para o gráfico.</p>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%" cy="50%"
                            innerRadius={50}
                            outerRadius={90}
                            onClick={(d: any) => toggleRating(d.name)}
                          >
                            {chartData.map((entry) => (
                              <Cell key={entry.name} fill={entry.fill} />
                            ))}
                          </Pie>
                          <ReTooltip formatter={(v: any, n: any) => [`${v} posições`, n]} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
