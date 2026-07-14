// ============================================================
// Fase 6 — Trade Monitor Dashboard (standalone)
// Painel resumido de atividade de trade sobre trade_taxas +
// trade_ativos + trade_metricas. Não altera TradeMonitorPage.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar,
} from "recharts";
import { Activity, Download, RefreshCw, TrendingUp } from "lucide-react";

type Row = {
  id: number;
  ticker: string;
  data: string;
  taxa_indicativa: number | null;
  qtd_negociada: number | null;
  vol_financeiro: number | null;
  pu_indicativo: number | null;
};

type AtivoMeta = {
  ticker: string;
  indexador: string | null;
  emissor_nome: string | null;
  rating: string | null;
};

const INDEXADORES = ["DI", "IPCA", "PRE", "OUTRO"] as const;
type Indexador = (typeof INDEXADORES)[number];

const fmtDate = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
const fmtMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);
const fmtPct = (v: number, digits = 3) =>
  v == null || Number.isNaN(v) ? "—" : `${(v * 100).toFixed(digits)}%`;

function ratingBucket(r: string | null): "AAA" | "AA" | "A" | "BBB" | "HY" | "NR" {
  if (!r) return "NR";
  const u = r.toUpperCase();
  if (u.includes("AAA")) return "AAA";
  if (u.includes("AA")) return "AA";
  if (/(^|[^A-Z])A([+\-]|\b)/.test(u) || u.startsWith("A")) return "A";
  if (u.includes("BBB")) return "BBB";
  return "HY";
}

export default function TradeActivityDashboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [ativos, setAtivos] = useState<Record<string, AtivoMeta>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [days, setDays] = useState<number>(30);
  const [tickerQ, setTickerQ] = useState("");
  const [indexador, setIndexador] = useState<Indexador | "ALL">("ALL");
  const [rating, setRating] = useState<string>("ALL");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceIso = since.toISOString().slice(0, 10);

      const [{ data: taxas, error: e1 }, { data: metas, error: e2 }] = await Promise.all([
        supabase
          .from("trade_taxas")
          .select("id,ticker,data,taxa_indicativa,qtd_negociada,vol_financeiro,pu_indicativo")
          .gte("data", sinceIso)
          .order("data", { ascending: false })
          .limit(10000),
        supabase.from("trade_ativos").select("ticker,indexador,emissor_nome,rating"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;

      const map: Record<string, AtivoMeta> = {};
      for (const a of (metas ?? []) as AtivoMeta[]) map[a.ticker] = a;
      setAtivos(map);
      setRows((taxas ?? []) as Row[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  // ── Filtered dataset ───────────────────────────────────────
  const filtered = useMemo(() => {
    const q = tickerQ.trim().toUpperCase();
    return rows.filter((r) => {
      if (q && !r.ticker.toUpperCase().includes(q)) return false;
      const meta = ativos[r.ticker];
      if (indexador !== "ALL" && (meta?.indexador ?? "OUTRO") !== indexador) return false;
      if (rating !== "ALL" && ratingBucket(meta?.rating ?? null) !== rating) return false;
      return true;
    });
  }, [rows, ativos, tickerQ, indexador, rating]);

  // ── KPIs ───────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const nOps = filtered.length;
    const totalVol = filtered.reduce((s, r) => s + (r.vol_financeiro ?? 0), 0);
    const rates = filtered.map((r) => r.taxa_indicativa).filter((x): x is number => x != null);
    const avgRate = rates.length ? rates.reduce((s, x) => s + x, 0) / rates.length : 0;

    const byTicker = new Map<string, number>();
    for (const r of filtered) byTicker.set(r.ticker, (byTicker.get(r.ticker) ?? 0) + (r.vol_financeiro ?? 0));
    const top = [...byTicker.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      nOps,
      totalVol,
      avgRate,
      topTicker: top?.[0] ?? "—",
      topVol: top?.[1] ?? 0,
    };
  }, [filtered]);

  // ── Chart series (30d): média por dia ──────────────────────
  const timeSeries = useMemo(() => {
    const byDay = new Map<string, { r: number; c: number; v: number }>();
    for (const r of filtered) {
      const k = r.data.slice(0, 10);
      const acc = byDay.get(k) ?? { r: 0, c: 0, v: 0 };
      if (r.taxa_indicativa != null) {
        acc.r += r.taxa_indicativa;
        acc.c += 1;
      }
      acc.v += r.vol_financeiro ?? 0;
      byDay.set(k, acc);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, v]) => ({
        data: fmtDate(d),
        taxa: v.c ? (v.r / v.c) * 100 : null,
        volume: v.v,
      }));
  }, [filtered]);

  // ── Ticker-specific series (top selected) ─────────────────
  const tickerSeries = useMemo(() => {
    if (!selectedTicker) return [];
    return filtered
      .filter((r) => r.ticker === selectedTicker)
      .sort((a, b) => a.data.localeCompare(b.data))
      .map((r) => ({
        data: fmtDate(r.data),
        taxa: r.taxa_indicativa != null ? r.taxa_indicativa * 100 : null,
        volume: r.vol_financeiro ?? 0,
      }));
  }, [filtered, selectedTicker]);

  // ── Últimas 20 ops ─────────────────────────────────────────
  const lastOps = useMemo(() => filtered.slice(0, 20), [filtered]);

  const uniqueTickers = useMemo(() => {
    const set = new Set(filtered.map((r) => r.ticker));
    return [...set].sort();
  }, [filtered]);

  const exportCsv = () => {
    const header = ["data", "ticker", "indexador", "rating", "taxa", "qtd", "vol_financeiro", "pu_indicativo"];
    const lines = [header.join(";")];
    for (const r of filtered) {
      const m = ativos[r.ticker];
      lines.push([
        fmtDate(r.data),
        r.ticker,
        m?.indexador ?? "",
        m?.rating ?? "",
        r.taxa_indicativa ?? "",
        r.qtd_negociada ?? "",
        r.vol_financeiro ?? "",
        r.pu_indicativo ?? "",
      ].join(";"));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trade_activity_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6" /> Trade Activity Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Painel resumido dos últimos {days} dias — <span className="font-mono">trade_taxas</span> · <span className="font-mono">trade_ativos</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7d</SelectItem>
              <SelectItem value="15">Últimos 15d</SelectItem>
              <SelectItem value="30">Últimos 30d</SelectItem>
              <SelectItem value="60">Últimos 60d</SelectItem>
              <SelectItem value="90">Últimos 90d</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="w-4 h-4 mr-1.5" /> CSV
          </Button>
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          className="h-8 w-[220px] text-xs"
          placeholder="Buscar ticker..."
          value={tickerQ}
          onChange={(e) => setTickerQ(e.target.value)}
        />
        <Select value={indexador} onValueChange={(v) => setIndexador(v as Indexador | "ALL")}>
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue placeholder="Indexador" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos indexadores</SelectItem>
            {INDEXADORES.map((i) => (
              <SelectItem key={i} value={i}>{i}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={rating} onValueChange={setRating}>
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue placeholder="Rating" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos ratings</SelectItem>
            <SelectItem value="AAA">AAA</SelectItem>
            <SelectItem value="AA">AA</SelectItem>
            <SelectItem value="A">A</SelectItem>
            <SelectItem value="BBB">BBB</SelectItem>
            <SelectItem value="HY">High Yield</SelectItem>
            <SelectItem value="NR">Sem rating</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedTicker ?? "__all__"} onValueChange={(v) => setSelectedTicker(v === "__all__" ? null : v)}>
          <SelectTrigger className="h-8 w-[220px] text-xs">
            <SelectValue placeholder="Foco em ticker (opcional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Agregado (todos)</SelectItem>
            {uniqueTickers.slice(0, 200).map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">{error}</div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Operações</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{kpis.nOps.toLocaleString("pt-BR")}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Volume total</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmtMoney(kpis.totalVol)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Taxa média</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmtPct(kpis.avgRate)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Top ativo (vol)</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{kpis.topTicker}</div>
            <div className="text-xs text-muted-foreground">{fmtMoney(kpis.topVol)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              {selectedTicker ? `Taxa/Volume — ${selectedTicker}` : `Taxa média diária (agregada)`}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={selectedTicker ? tickerSeries : timeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="l" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Line yAxisId="l" type="monotone" dataKey="taxa" name="Taxa (%)" stroke="#38bdf8" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Volume diário</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={selectedTicker ? tickerSeries : timeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <Bar dataKey="volume" name="Volume" fill="#b78cf7" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Últimas 20 ops */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Últimas 20 operações</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Ticker</TableHead>
                <TableHead>Indexador</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead className="text-right">Taxa</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Volume</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lastOps.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhuma operação encontrada.</TableCell></TableRow>
              )}
              {lastOps.map((r) => {
                const m = ativos[r.ticker];
                return (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelectedTicker(r.ticker)}>
                    <TableCell className="font-mono text-xs">{fmtDate(r.data)}</TableCell>
                    <TableCell className="font-mono text-xs">{r.ticker}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{m?.indexador ?? "—"}</Badge></TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{m?.rating ?? "NR"}</Badge></TableCell>
                    <TableCell className="text-right font-mono text-xs">{r.taxa_indicativa != null ? fmtPct(r.taxa_indicativa) : "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{r.qtd_negociada?.toLocaleString("pt-BR") ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmtMoney(r.vol_financeiro ?? 0)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
