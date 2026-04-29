// src/components/trade/TradeDashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { TradeAtivo, TradeMode, HistoryPoint } from "@/hooks/useTradeData";
import { useChartTheme } from "@/hooks/useChartTheme";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend, ReferenceLine
} from "recharts";

interface TradeDashboardProps {
  data: TradeAtivo[];
  history?: Record<string, HistoryPoint[]>;
  mode: TradeMode;
  modeColor: string;
  onSelectTicker: (ticker: string) => void;
  selectedFund?: string | null;
  fundTotal?: number;
  allocatedInFund?: number;
}

interface TradeSummary {
  total_count: number;
  hot_count: number;
  median_last_val: number | null;
  median_avg_5d: number | null;
  median_avg_10d: number | null;
  median_avg_21d: number | null;
  median_avg_30d: number | null;
  median_avg_90d: number | null;
}

const CHART_STYLE = {
  background: "transparent",
  fontSize: 11,
  fontFamily: "DM Mono, monospace",
};

// Tooltip / axis colors come from useChartTheme() (theme-aware)

const VENC_COLORS: Record<string, string> = {
  "0–2a": "#f87171", "2–5a": "#fbbf24", "5–10a": "#34d399",
  "10–20a": "#38bdf8", "20a+": "#818cf8",
};

const RATING_COLORS: Record<string, string> = {
  AAA: "#34d399", "AA+": "#818cf8", AA: "#818cf8", "A+": "#38bdf8",
  A: "#38bdf8", BBB: "#fbbf24", "N/R": "#475569",
};

function normRating(r: string | null) {
  if (!r || ["N/A", "0", "nan", ""].includes(r.trim())) return "N/R";
  if (r.includes("AAA")) return "AAA";
  if (r.includes("AA+")) return "AA+";
  if (r.includes("AA")) return "AA";
  if (r.includes("A+")) return "A+";
  if (r.includes("| A") || r.endsWith("A")) return "A";
  if (r.includes("BBB")) return "BBB";
  return "N/R";
}

function vencBucket(a: number) {
  if (a <= 0) return "Vencido";
  if (a <= 2) return "0–2a";
  if (a <= 5) return "2–5a";
  if (a <= 10) return "5–10a";
  if (a <= 20) return "10–20a";
  return "20a+";
}

function median(arr: number[]) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function fv(v: number) {
  if (!v) return "—";
  if (v >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(0) + "K";
  return v.toFixed(0);
}

export function TradeDashboard({ data, history, mode, modeColor, onSelectTicker }: TradeDashboardProps) {
  const isIPCA = mode === "IPCA";
  const chartTheme = useChartTheme();
  const [spreadWindow, setSpreadWindow] = useState<90 | 30 | 21 | 10>(90);

  // Server-side aggregated summary (medians/counts) — avoids paginated row truncation in the client.
  // Map the analytical mode (sub_indexador) to the underlying indexador used by the RPC.
  const [summary, setSummary] = useState<TradeSummary | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const indexador =
        mode === "IPCA" ? "IPCA" : "DI"; // both DI_SPREAD and CDI_PCT live under indexador='DI'
      const { data: rows } = await supabase.rpc("get_trade_summary", {
        p_indexador: indexador,
        p_sub_indexador: mode,
      });
      if (!cancelled) setSummary((rows?.[0] as TradeSummary) ?? null);
    })();
    return () => { cancelled = true; };
  }, [mode]);

  // Pre-aggregated daily spread series (median by date) — IPCA only.
  // Read from materialized table populated during upload. Avoids re-aggregating
  // ~30k rows on the client every render.
  const [aggSeries, setAggSeries] = useState<Record<"AAA" | "UNIVERSO", { d: string; val: number }[]> | null>(null);
  useEffect(() => {
    if (mode !== "IPCA") { setAggSeries(null); return; }
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from("trade_spread_agg_diario")
        .select("data, grupo, spread_mediano")
        .order("data", { ascending: true });
      if (cancelled || !rows) return;
      const out: Record<"AAA" | "UNIVERSO", { d: string; val: number }[]> = { AAA: [], UNIVERSO: [] };
      for (const r of rows) {
        const g = r.grupo as "AAA" | "UNIVERSO";
        if (g !== "AAA" && g !== "UNIVERSO") continue;
        out[g].push({ d: r.data as string, val: Number(r.spread_mediano ?? 0) });
      }
      setAggSeries(out);
    })();
    return () => { cancelled = true; };
  }, [mode]);

  // KPIs — counts/medians come from the server summary; client data is only a fallback.
  const kpis = useMemo(() => ({
    total: summary?.total_count ?? data.length,
    hot: summary?.hot_count ?? data.filter(t => t.z_score > 1.5).length,
    median: Number(summary?.median_last_val ?? 0),
    wide: data.filter(t => (t.last_val - (t.avg_21d ?? t.last_val)) * 100 > 5).length,
    narrow: data.filter(t => (t.last_val - (t.avg_21d ?? t.last_val)) * 100 < -5).length,
    totalVolFin: data.reduce((s, t) => s + (t.total_vol_fin ?? 0), 0),
  }), [data, summary]);

  // Rating chart
  const ratingData = useMemo(() => {
    const RORDER = ["AAA", "AA+", "AA", "A+", "A", "BBB", "N/R"];
    const cnt: Record<string, number> = {};
    const hot: Record<string, number> = {};
    RORDER.forEach(r => { cnt[r] = 0; hot[r] = 0; });
    data.forEach(t => {
      const r = normRating(t.rating);
      cnt[r] = (cnt[r] ?? 0) + 1;
      if (t.z_score > 1.5) hot[r] = (hot[r] ?? 0) + 1;
    });
    return RORDER.filter(r => cnt[r] > 0).map(r => ({
      name: r, total: cnt[r], hot: hot[r] ?? 0,
      fill: RATING_COLORS[r] ?? "#475569",
    }));
  }, [data]);

  // Venc donut
  const vencData = useMemo(() => {
    const VORDER = ["0–2a", "2–5a", "5–10a", "10–20a", "20a+"];
    const cnt: Record<string, number> = {};
    VORDER.forEach(v => cnt[v] = 0);
    data.filter(t => t.anos_venc && t.anos_venc > 0).forEach(t => {
      const b = vencBucket(t.anos_venc!);
      cnt[b] = (cnt[b] ?? 0) + 1;
    });
    return VORDER.filter(v => cnt[v] > 0).map(v => ({ name: v, value: cnt[v], fill: VENC_COLORS[v] }));
  }, [data]);

  // Spread distribution
  const spreadData = useMemo(() => {
    if (isIPCA) {
      const buckets = [
        { name: "< 0%",    fn: (v: number) => v < 0 },
        { name: "0–0.5%",  fn: (v: number) => v >= 0 && v < 0.5 },
        { name: "0.5–1%",  fn: (v: number) => v >= 0.5 && v < 1 },
        { name: "1–2%",    fn: (v: number) => v >= 1 && v < 2 },
        { name: "2%+",     fn: (v: number) => v >= 2 },
      ];
      return buckets.map(b => ({ name: b.name, count: data.filter(t => b.fn(t.last_val)).length }));
    }
    const buckets = [
      { name: "< 0.5%",  fn: (v: number) => v < 0.5 },
      { name: "0.5–1%",  fn: (v: number) => v >= 0.5 && v < 1 },
      { name: "1–2%",    fn: (v: number) => v >= 1 && v < 2 },
      { name: "2–3%",    fn: (v: number) => v >= 2 && v < 3 },
      { name: "3%+",     fn: (v: number) => v >= 3 },
    ];
    return buckets.map(b => ({ name: b.name, count: data.filter(t => b.fn(t.last_val)).length }));
  }, [data, isIPCA]);

  // Evolution by window — medians come from the server-side summary so they include the full universe.
  const evoData = useMemo(() => {
    return [
      { name: "90d",  val: Number(summary?.median_avg_90d ?? 0) },
      { name: "30d",  val: Number(summary?.median_avg_30d ?? 0) },
      { name: "21d",  val: Number(summary?.median_avg_21d ?? 0) },
      { name: "10d",  val: Number(summary?.median_avg_10d ?? 0) },
      { name: "5d",   val: Number(summary?.median_avg_5d ?? 0) },
      { name: "Hoje", val: Number(summary?.median_last_val ?? 0) },
    ];
  }, [summary]);

  // Delta vs today
  const deltaData = useMemo(() => {
    const windows = ["5d", "10d", "21d", "30d"] as const;
    const keys: Record<string, keyof TradeAtivo> = {
      "5d": "avg_5d", "10d": "avg_10d", "21d": "avg_21d", "30d": "avg_30d",
    };
    return windows.map(w => {
      const key = keys[w];
      const deltas = data.map(t => ((t.last_val - ((t[key] as number) ?? t.last_val)) * 100));
      const avg = deltas.reduce((a, b) => a + b, 0) / (deltas.length || 1);
      return { name: w, val: parseFloat(avg.toFixed(2)) };
    });
  }, [data]);

  // Daily mean spread series — universe vs AAA, last N days.
  // Prefer the materialized aggregate table (instant, ~120 rows). Fallback to
  // re-computing from the per-ticker `history` blob if the table is empty.
  const spreadSeries = useMemo(() => {
    const empty = { aaa: [] as { d: string; val: number }[], universe: [] as { d: string; val: number }[], aaaAvg: 0, uniAvg: 0 };

    const meanOf = (arr: { val: number }[]) =>
      arr.length ? arr.reduce((s, p) => s + p.val, 0) / arr.length : 0;

    // Fast path: pre-aggregated table (IPCA only).
    if (aggSeries && (aggSeries.AAA.length > 0 || aggSeries.UNIVERSO.length > 0)) {
      const universe = aggSeries.UNIVERSO.slice(-spreadWindow);
      const aaa = aggSeries.AAA.slice(-spreadWindow);
      return { universe, aaa, uniAvg: meanOf(universe.filter(p => p.val > 0)), aaaAvg: meanOf(aaa.filter(p => p.val > 0)) };
    }

    if (!history) return empty;

    // Restrict to tickers in the current mode (data is already filtered by sub_indexador upstream).
    // This prevents %CDI series (e.g. 104 = 104% CDI) from polluting the IPCA+ universe.
    const modeTickers = new Set(data.map(t => t.ticker));
    const aaaTickers = new Set(
      data.filter(t => normRating(t.rating ?? null) === "AAA").map(t => t.ticker)
    );

    // Aggregate by date — only points whose ticker belongs to the current mode.
    const uniByDate: Record<string, number[]> = {};
    const aaaByDate: Record<string, number[]> = {};
    for (const [ticker, points] of Object.entries(history)) {
      if (!modeTickers.has(ticker)) continue;
      const isAaa = aaaTickers.has(ticker);
      for (const p of points) {
        if (p.r == null || !isFinite(p.r)) continue;
        (uniByDate[p.d] ??= []).push(p.r);
        if (isAaa) (aaaByDate[p.d] ??= []).push(p.r);
      }
    }
    const allDates = Object.keys(uniByDate).sort();
    const sliced = allDates.slice(-spreadWindow);
    const universe = sliced.map(d => {
      const arr = uniByDate[d] ?? [];
      return { d, val: arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0 };
    });
    const aaa = sliced.map(d => {
      const arr = aaaByDate[d] ?? [];
      return { d, val: arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0 };
    });
    return { universe, aaa, uniAvg: meanOf(universe.filter(p => p.val > 0)), aaaAvg: meanOf(aaa.filter(p => p.val > 0)) };
  }, [aggSeries, history, data, spreadWindow, mode]);

  const spreadYDomain = useMemo<[number, number] | undefined>(() => {
    const all = [...spreadSeries.aaa, ...spreadSeries.universe].map(p => p.val).filter(v => v > 0);
    if (all.length === 0) return undefined;
    const min = Math.min(...all);
    const max = Math.max(...all);
    const pad = (max - min) * 0.1 || 0.05;
    return [Math.max(0, min - pad), max + pad];
  }, [spreadSeries]);

  const formatShortDate = (d: string) => {
    const dt = new Date(d);
    return `${String(dt.getUTCDate()).padStart(2, "0")}/${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
  };

  // Top 8 opportunities
  const topOpp = useMemo(() =>
    [...data].sort((a, b) => b.z_score - a.z_score).slice(0, 8),
    [data]
  );

  // PU distribution
  const puDist = useMemo(() => {
    const valid = data.filter(t => (t.pu_ratio ?? 0) > 0);
    return [
      { name: "< 0.95",    count: valid.filter(t => (t.pu_ratio ?? 0) < 0.95).length,       fill: "#34d399" },
      { name: "0.95–0.98", count: valid.filter(t => (t.pu_ratio ?? 0) >= 0.95 && (t.pu_ratio ?? 0) < 0.98).length, fill: "#86efac" },
      { name: "0.98–1.00", count: valid.filter(t => (t.pu_ratio ?? 0) >= 0.98 && (t.pu_ratio ?? 0) < 1.00).length, fill: "#94a3b8" },
      { name: "1.00–1.02", count: valid.filter(t => (t.pu_ratio ?? 0) >= 1.00 && (t.pu_ratio ?? 0) < 1.02).length, fill: "#fca5a5" },
      { name: "> 1.02",    count: valid.filter(t => (t.pu_ratio ?? 0) >= 1.02).length,       fill: "#f87171" },
    ];
  }, [data]);

  const Section = ({ title }: { title: string }) => (
    <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 my-4">
      <span>{title}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );

  const ChartCard = ({ title, children, sub }: { title: string; children: React.ReactNode; sub?: string }) => (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-foreground">{title}</span>
        {sub && <span className="text-[10px] text-muted-foreground font-mono">{sub}</span>}
      </div>
      {children}
    </div>
  );

  return (
    <div className="p-6 space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: "Emissões",     val: kpis.total,              color: modeColor,  sub: `${mode} ativos` },
          { label: "Oportunidades",val: kpis.hot,                color: "#ff4d2e",  sub: "Z-Score > 1.5" },
          { label: isIPCA ? "Spread Mediano" : "Taxa Mediana",
                                   val: (kpis.median ?? 0).toFixed(2)+"%", color: modeColor, sub: isIPCA ? "% spread cap." : "% a.a. hoje" },
          { label: "Alarg. 21d",   val: kpis.wide,               color: "#fbbf24",  sub: "acima da média" },
          { label: "Estreit. 21d", val: kpis.narrow,             color: "#34d399",  sub: "abaixo da média" },
          { label: "Vol. Fin. 90d",val: fv(kpis.totalVolFin),    color: modeColor,  sub: "R$ Qtd × PU Ind." },
        ].map((k, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: k.color }} />
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-2 font-semibold">{k.label}</div>
            <div className="text-2xl font-extrabold font-mono leading-none" style={{ color: k.color }}>{k.val}</div>
            <div className="text-[10px] text-muted-foreground mt-1">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Distribution */}
      <Section title="Distribuição · Rating · Vencimento · Spread" />
      <div className="grid grid-cols-3 gap-4">
        <ChartCard title="Emissões por Rating">
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ratingData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} style={CHART_STYLE}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: chartTheme.tickFill }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: chartTheme.tickFill }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chartTheme.tooltip} labelStyle={chartTheme.tooltipLabel} itemStyle={chartTheme.tooltipItem} />
                <Bar dataKey="total" name="Total" radius={[3,3,0,0]} fill={chartTheme.border} />
                <Bar dataKey="hot" name="Z>1.5" radius={[3,3,0,0]}>
                  {ratingData.map((entry, i) => <Cell key={i} fill={entry.fill + "cc"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Emissões por Vencimento">
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart style={CHART_STYLE}>
                <Pie data={vencData} cx="50%" cy="45%" innerRadius={45} outerRadius={75}
                  dataKey="value" nameKey="name" paddingAngle={2}>
                  {vencData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <Tooltip contentStyle={chartTheme.tooltip} labelStyle={chartTheme.tooltipLabel} itemStyle={chartTheme.tooltipItem} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title={isIPCA ? "Distribuição Spread IPCA+" : "Distribuição Taxa DI"}>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={spreadData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} style={CHART_STYLE}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: chartTheme.tickFill }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: chartTheme.tickFill }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chartTheme.tooltip} labelStyle={chartTheme.tooltipLabel} itemStyle={chartTheme.tooltipItem} />
                <Bar dataKey="count" name="Emissões" radius={[3,3,0,0]} fill={modeColor + "88"} stroke={modeColor} strokeWidth={1} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* PU Analysis */}
      <Section title="Análise de PU · Negociação vs Curva" />
      <div className="grid grid-cols-3 gap-4">
        <ChartCard title="Distribuição PU Ind / Curva"
          sub={`${data.filter(t => (t.pu_ratio ?? 0) > 0).length}/${data.length} com PU Ind.`}>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={puDist} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} style={CHART_STYLE}>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: chartTheme.tickFill }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: chartTheme.tickFill }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chartTheme.tooltip} labelStyle={chartTheme.tooltipLabel} itemStyle={chartTheme.tooltipItem} />
                <Bar dataKey="count" name="Emissões" radius={[3,3,0,0]}>
                  {puDist.map((entry, i) => <Cell key={i} fill={entry.fill + "cc"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Spread Mediano por Janela">
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evoData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} style={CHART_STYLE}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: chartTheme.tickFill }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fontFamily: "DM Mono, monospace", fill: chartTheme.tickFill }} axisLine={false} tickLine={false}
                  tickFormatter={v => v.toFixed(2) + "%"} />
                <Tooltip contentStyle={chartTheme.tooltip} labelStyle={chartTheme.tooltipLabel} itemStyle={chartTheme.tooltipItem} formatter={(v: number) => [v.toFixed(4) + "%", "Mediana"]} />
                <Line type="monotone" dataKey="val" stroke={modeColor} strokeWidth={2}
                  dot={{ fill: modeColor, r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Variação Média vs Hoje (bps)">
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deltaData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} style={CHART_STYLE}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: chartTheme.tickFill }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fontFamily: "DM Mono, monospace", fill: chartTheme.tickFill }} axisLine={false} tickLine={false}
                  tickFormatter={v => v.toFixed(0) + " bps"} />
                <Tooltip contentStyle={chartTheme.tooltip} labelStyle={chartTheme.tooltipLabel} itemStyle={chartTheme.tooltipItem} formatter={(v: number) => [v.toFixed(1) + " bps", "Δ médio"]} />
                <Bar dataKey="val" name="bps" radius={[3,3,0,0]}>
                  {deltaData.map((entry, i) => <Cell key={i} fill={entry.val > 0 ? "#f87171cc" : "#34d399cc"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Spread behaviour — AAA vs Universe */}
      <Section title="Comportamento do Spread · AAA vs Universo" />
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-end gap-1 mb-3">
          {([90, 30, 21, 10] as const).map(w => (
            <button
              key={w}
              onClick={() => setSpreadWindow(w)}
              className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors ${
                spreadWindow === w
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {w}d
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {([
            { title: "Spread Médio AAA", series: spreadSeries.aaa, avg: spreadSeries.aaaAvg, color: "#34d399", sub: `${spreadSeries.aaa.length} dias` },
            { title: "Spread Médio Universo", series: spreadSeries.universe, avg: spreadSeries.uniAvg, color: modeColor, sub: `${spreadSeries.universe.length} dias` },
          ]).map((c, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-foreground">{c.title}</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  μ {c.avg.toFixed(3)}% · {c.sub}
                </span>
              </div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={c.series} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} style={CHART_STYLE}>
                    <XAxis
                      dataKey="d"
                      tick={{ fontSize: 9, fill: chartTheme.tickFill }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={formatShortDate}
                      minTickGap={24}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fontFamily: "DM Mono, monospace", fill: chartTheme.tickFill }}
                      axisLine={false}
                      tickLine={false}
                      domain={spreadYDomain ?? ["auto", "auto"]}
                      tickFormatter={v => v.toFixed(2) + "%"}
                    />
                    <Tooltip
                      contentStyle={chartTheme.tooltip}
                      labelStyle={chartTheme.tooltipLabel}
                      itemStyle={chartTheme.tooltipItem}
                      labelFormatter={(l: string) => formatShortDate(l)}
                      formatter={(v: number) => [v.toFixed(4) + "%", "Spread médio"]}
                    />
                    {c.avg > 0 && (
                      <ReferenceLine
                        y={c.avg}
                        stroke={chartTheme.muted}
                        strokeDasharray="4 4"
                        strokeWidth={1}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="val"
                      stroke={c.color}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Opportunities */}
      <Section title="Oportunidades Z-Score > 1.5" />
      <div className="grid grid-cols-3 gap-4">
        <ChartCard title="Oportunidades por Rating">
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ratingData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} style={CHART_STYLE}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: chartTheme.tickFill }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: chartTheme.tickFill }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chartTheme.tooltip} labelStyle={chartTheme.tooltipLabel} itemStyle={chartTheme.tooltipItem} />
                <Bar dataKey="hot" name="Z>1.5" radius={[3,3,0,0]}>
                  {ratingData.map((e, i) => <Cell key={i} fill={e.fill + "cc"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Oportunidades por Vencimento">
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={["0–2a","2–5a","5–10a","10–20a","20a+"].map(v => ({
                  name: v,
                  hot: data.filter(t => t.anos_venc && t.anos_venc > 0 && vencBucket(t.anos_venc) === v && t.z_score > 1.5).length,
                  fill: VENC_COLORS[v],
                }))}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }} style={CHART_STYLE}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: chartTheme.tickFill }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: chartTheme.tickFill }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chartTheme.tooltip} labelStyle={chartTheme.tooltipLabel} itemStyle={chartTheme.tooltipItem} />
                <Bar dataKey="hot" name="Z>1.5" radius={[3,3,0,0]}>
                  {["0–2a","2–5a","5–10a","10–20a","20a+"].map((v, i) => <Cell key={i} fill={VENC_COLORS[v] + "cc"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Top 8 */}
        <ChartCard title="Top 8 Oportunidades">
          <div className="space-y-0">
            {topOpp.map(t => (
              <button key={t.ticker}
                onClick={() => onSelectTicker(t.ticker)}
                className="w-full flex items-center justify-between py-2 border-b border-border last:border-0 hover:pl-1.5 transition-all text-left">
                <div>
                  <div className="font-mono text-sm font-medium" style={{ color: modeColor }}>{t.ticker}</div>
                  <div className="text-[10px] text-muted-foreground truncate max-w-[130px]">
                    {t.emissor_nome ?? "—"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-semibold">{(t.last_val ?? 0).toFixed(3)}%</div>
                  <div className="text-[10px] text-orange-400">Z={(t.z_score ?? 0).toFixed(2)} · +{(t.change_bps ?? 0).toFixed(0)}bps</div>
                </div>
              </button>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
