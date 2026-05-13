// src/components/trade/TradeSectorDashboard.tsx
// Dashboard setorial — scatter Spread × Duration por rating, com filtro por setor,
// mediana histórica do setor e do emissor selecionado, e tabela de tickers.
import { useMemo, useState } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Cell, ComposedChart, Bar, Line, Legend, LabelList,
} from "recharts";
import { TradeAtivo, TradeMode, HistoryPoint } from "@/hooks/useTradeData";
import { useEmpresasSetor } from "@/hooks/useEmpresasSetor";
import { useChartTheme } from "@/hooks/useChartTheme";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

interface Props {
  data: TradeAtivo[];
  history?: Record<string, HistoryPoint[]>;
  mode: TradeMode;
  modeColor: string;
  onSelectTicker: (t: string) => void;
}

const RATING_ORDER = ["AAA", "AA+", "AA", "AA-", "A+", "A", "A-", "BBB+", "BBB", "BBB-", "N/R"] as const;
const RATING_COLORS: Record<string, string> = {
  AAA: "#16a34a",
  "AA+": "#22c55e",
  AA: "#4ade80",
  "AA-": "#86efac",
  "A+": "#eab308",
  A: "#f59e0b",
  "A-": "#fbbf24",
  "BBB+": "#fb923c",
  BBB: "#f97316",
  "BBB-": "#ef4444",
  "N/R": "#94a3b8",
};

function normRating(r: string | null): string {
  if (!r) return "N/R";
  const t = r.trim().toUpperCase();
  if (!t || ["N/A", "0", "NAN"].includes(t)) return "N/R";
  for (const rk of RATING_ORDER) {
    if (rk === "N/R") continue;
    if (t.includes(rk)) return rk;
  }
  return "N/R";
}

function rollingMedian(values: { d: string; v: number; vol: number }[], window: number) {
  const out: { d: string; med: number | null; vol: number }[] = [];
  for (let i = 0; i < values.length; i++) {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1).map((p) => p.v).sort((a, b) => a - b);
    const med = slice.length ? slice[Math.floor(slice.length / 2)] : null;
    out.push({ d: values[i].d, med, vol: values[i].vol });
  }
  return out;
}

function fmtDate(d: string) {
  const dt = new Date(d);
  return `${String(dt.getUTCDate()).padStart(2, "0")}/${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}

function fv(v: number) {
  if (!v) return "—";
  if (v >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(0) + "K";
  return v.toFixed(0);
}

export function TradeSectorDashboard({ data, history, mode, modeColor, onSelectTicker }: Props) {
  const { byCnpj, loading: loadingEmpresas } = useEmpresasSetor();
  const chartTheme = useChartTheme();

  // Enriquecer cada ativo com setor / nome de emissor a partir do CNPJ.
  const enriched = useMemo(() => {
    return data
      .filter((t) => t.anos_venc != null && t.anos_venc > 0 && t.last_val != null)
      .map((t) => {
        const info = t.emissor_cnpj ? byCnpj.get(t.emissor_cnpj) : null;
        return {
          ...t,
          setor: info?.setor ?? "Sem setor",
          emissor_label: info?.nome ?? t.emissor_nome ?? "—",
          rating_norm: normRating(t.rating),
        };
      });
  }, [data, byCnpj]);

  // Setores disponíveis ordenados por nº de emissões.
  const setores = useMemo(() => {
    const cnt = new Map<string, number>();
    enriched.forEach((t) => cnt.set(t.setor, (cnt.get(t.setor) ?? 0) + 1));
    return Array.from(cnt.entries()).sort((a, b) => b[1] - a[1]);
  }, [enriched]);

  const [setor, setSetor] = useState<string | null>(null);
  const setorAtivo = setor ?? setores[0]?.[0] ?? null;

  const [search, setSearch] = useState("");
  // Janela em dias úteis ("MAX" = sem corte)
  const [window, setWindow] = useState<5 | 10 | 21 | 90 | "MAX">(21);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const noSetor = !setorAtivo;

  // Pontos do scatter: setor selecionado em destaque, restante como background.
  const inSector = useMemo(
    () => enriched.filter((t) => t.setor === setorAtivo),
    [enriched, setorAtivo],
  );
  const outSector = useMemo(
    () => enriched.filter((t) => t.setor !== setorAtivo),
    [enriched, setorAtivo],
  );

  // Agrupa pontos do setor por rating (uma <Scatter/> por série → cor por rating).
  const sectorByRating = useMemo(() => {
    const map = new Map<string, typeof inSector>();
    for (const r of RATING_ORDER) map.set(r, []);
    for (const t of inSector) {
      const arr = map.get(t.rating_norm) ?? [];
      arr.push(t);
      map.set(t.rating_norm, arr);
    }
    return Array.from(map.entries())
      .filter(([, arr]) => arr.length > 0)
      .map(([rating, arr]) => ({
        rating,
        color: RATING_COLORS[rating] ?? "#94a3b8",
        points: arr.map((t) => ({
          x: t.anos_venc!,
          y: t.last_val,
          ticker: t.ticker,
          emissor: t.emissor_label,
          rating: t.rating_norm,
          vol: t.total_vol_fin ?? 0,
        })),
      }));
  }, [inSector]);

  const bgPoints = useMemo(
    () => outSector.map((t) => ({ x: t.anos_venc!, y: t.last_val })),
    [outSector],
  );

  // Série temporal: mediana de spread por dia, com janela móvel de 10 negociações.
  function buildSeries(tickers: Set<string>) {
    if (!history || tickers.size === 0) return [] as { d: string; med: number | null; vol: number }[];
    let cutoffStr = "0000-00-00";
    if (window !== "MAX") {
      const cutoff = new Date();
      // Aprox. dias úteis → calendário (×7/5)
      cutoff.setDate(cutoff.getDate() - Math.ceil(window * 1.4));
      cutoffStr = cutoff.toISOString().slice(0, 10);
    }

    const byDate = new Map<string, number[]>();
    const volByDate = new Map<string, number>();
    for (const tk of tickers) {
      const pts = history[tk];
      if (!pts) continue;
      for (const p of pts) {
        if (p.d < cutoffStr) continue;
        if (p.r == null || !isFinite(p.r)) continue;
        const arr = byDate.get(p.d) ?? [];
        arr.push(p.r);
        byDate.set(p.d, arr);
        // volume não está no HistoryPoint — deixamos zero (barra suprimida)
        volByDate.set(p.d, volByDate.get(p.d) ?? 0);
      }
    }
    const dates = Array.from(byDate.keys()).sort();
    const dailyMed = dates.map((d) => {
      const arr = byDate.get(d)!.slice().sort((a, b) => a - b);
      return { d, v: arr[Math.floor(arr.length / 2)], vol: volByDate.get(d) ?? 0 };
    });
    return rollingMedian(dailyMed, 10);
  }

  const sectorTickers = useMemo(() => new Set(inSector.map((t) => t.ticker)), [inSector]);
  const sectorSeries = useMemo(() => buildSeries(sectorTickers), [sectorTickers, history, window]);

  // Emissor selecionado: o do ticker clicado, ou o emissor com mais tickers no setor.
  const selectedTickerData = inSector.find((t) => t.ticker === selectedTicker);
  const focusEmissorCnpj =
    selectedTickerData?.emissor_cnpj ??
    (() => {
      const cnt = new Map<string, number>();
      inSector.forEach((t) => {
        if (t.emissor_cnpj) cnt.set(t.emissor_cnpj, (cnt.get(t.emissor_cnpj) ?? 0) + 1);
      });
      let top: [string, number] | null = null;
      for (const e of cnt.entries()) if (!top || e[1] > top[1]) top = e;
      return top?.[0] ?? null;
    })();
  const focusEmissor = focusEmissorCnpj ? byCnpj.get(focusEmissorCnpj) : null;

  const emissorTickers = useMemo(() => {
    if (!focusEmissorCnpj) return new Set<string>();
    return new Set(inSector.filter((t) => t.emissor_cnpj === focusEmissorCnpj).map((t) => t.ticker));
  }, [inSector, focusEmissorCnpj]);
  const emissorSeries = useMemo(() => buildSeries(emissorTickers), [emissorTickers, history, window]);

  // Tabela
  const tableRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inSector
      .filter(
        (t) =>
          !q ||
          t.ticker.toLowerCase().includes(q) ||
          t.emissor_label.toLowerCase().includes(q),
      )
      .sort((a, b) => (b.z_score ?? 0) - (a.z_score ?? 0));
  }, [inSector, search]);

  const yLabel = mode === "CDI_PCT" ? "% CDI" : mode === "IPCA" ? "Spread (% a.a.)" : "Taxa (% a.a.)";

  return (
    <div className="p-6 space-y-4">
      {/* Filtros */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Setor
          </span>
          <Select value={setorAtivo ?? ""} onValueChange={(v) => setSetor(v)}>
            <SelectTrigger className="h-8 w-[260px] text-xs">
              <SelectValue placeholder={loadingEmpresas ? "Carregando…" : "Selecionar setor"} />
            </SelectTrigger>
            <SelectContent>
              {setores.map(([s, n]) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {s} <span className="text-muted-foreground font-mono ml-1">({n})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Janela histórica
          </span>
          <div className="flex gap-1 bg-muted p-1 rounded-lg">
            {([5, 10, 21, 90, "MAX"] as const).map((w) => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className={`px-2 h-6 text-[11px] font-mono rounded ${
                  window === w ? "bg-background shadow-sm font-bold" : "text-muted-foreground"
                }`}
              >
                {w === "MAX" ? "Máx" : `${w}du`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-[180px]" />

        <Badge variant="outline" className="font-mono text-xs gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: modeColor }} />
          {inSector.length} emissões no setor
        </Badge>
      </div>

      {noSetor ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-sm text-muted-foreground">
          Sem ativos com setor cadastrado neste universo.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Scatter */}
            <div className="bg-card border border-border rounded-xl p-4 lg:row-span-2">
              <div className="flex items-baseline justify-between mb-2">
                <div>
                  <div className="text-xs font-bold">
                    Mercado secundário · {setorAtivo} · {mode === "DI_SPREAD" ? "DI+" : mode === "IPCA" ? "IPCA+" : "%CDI"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Spread × Duration · cores = rating · cinza = universo fora do setor
                  </div>
                </div>
              </div>
              <div style={{ height: 460 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.border} />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name="Duration"
                      domain={[0, "dataMax + 0.5"]}
                      tick={{ fontSize: 10, fill: chartTheme.tickFill }}
                      label={{ value: "Duration (anos)", position: "insideBottom", offset: -2, fontSize: 10, fill: chartTheme.tickFill }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name={yLabel}
                      tick={{ fontSize: 10, fill: chartTheme.tickFill, fontFamily: "DM Mono, monospace" }}
                      tickFormatter={(v) => v.toFixed(2)}
                      label={{ value: yLabel, angle: -90, position: "insideLeft", fontSize: 10, fill: chartTheme.tickFill }}
                    />
                    <ZAxis range={[40, 40]} />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      contentStyle={chartTheme.tooltip}
                      labelStyle={chartTheme.tooltipLabel}
                      itemStyle={chartTheme.tooltipItem}
                      formatter={(value: number, name: string) => {
                        if (name === "Duration") return [value.toFixed(2) + " a", name];
                        if (name === yLabel) return [value.toFixed(3) + "%", name];
                        return [value, name];
                      }}
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const p = payload[0].payload as {
                          ticker?: string; emissor?: string; rating?: string;
                          x: number; y: number; vol?: number;
                        };
                        if (!p.ticker) return null;
                        return (
                          <div className="bg-popover border border-border rounded-md px-3 py-2 text-xs shadow-md">
                            <div className="font-mono font-bold">{p.ticker}</div>
                            <div className="text-muted-foreground">{p.emissor}</div>
                            <div className="mt-1 grid grid-cols-2 gap-x-3 font-mono">
                              <span className="text-muted-foreground">Rating</span><span>{p.rating}</span>
                              <span className="text-muted-foreground">Duration</span><span>{p.x.toFixed(2)}a</span>
                              <span className="text-muted-foreground">{yLabel}</span><span>{p.y.toFixed(3)}%</span>
                              <span className="text-muted-foreground">Vol 90d</span><span>R$ {fv(p.vol ?? 0)}</span>
                            </div>
                          </div>
                        );
                      }}
                    />

                    {/* Background: universo fora do setor */}
                    {bgPoints.length > 0 && (
                      <Scatter data={bgPoints} fill={chartTheme.muted} fillOpacity={0.25} shape="circle" />
                    )}

                    {/* Setor: uma série por rating, com label */}
                    {sectorByRating.map((s) => (
                      <Scatter
                        key={s.rating}
                        name={s.rating}
                        data={s.points}
                        fill={s.color}
                        onClick={(d) => {
                          const t = (d as { ticker?: string }).ticker;
                          if (t) {
                            setSelectedTicker(t);
                            onSelectTicker(t);
                          }
                        }}
                        cursor="pointer"
                      >
                        <LabelList
                          dataKey="ticker"
                          position="top"
                          style={{ fontSize: 9, fill: chartTheme.tickFill, fontFamily: "DM Mono, monospace" }}
                        />
                        {s.points.map((_, i) => (
                          <Cell key={i} stroke={s.color} strokeWidth={1} />
                        ))}
                      </Scatter>
                    ))}

                    <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Mediana setor */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs font-bold mb-1">Mediana de spread — {setorAtivo}</div>
              <div className="text-[10px] text-muted-foreground mb-2">
                Mediana móvel de 10 negociações · janela {window}d
              </div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={sectorSeries} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.border} />
                    <XAxis
                      dataKey="d"
                      tick={{ fontSize: 9, fill: chartTheme.tickFill }}
                      tickFormatter={fmtDate}
                      minTickGap={32}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: chartTheme.tickFill, fontFamily: "DM Mono, monospace" }}
                      tickFormatter={(v) => v.toFixed(2) + "%"}
                    />
                    <Tooltip
                      contentStyle={chartTheme.tooltip}
                      labelStyle={chartTheme.tooltipLabel}
                      itemStyle={chartTheme.tooltipItem}
                      labelFormatter={(l: string) => fmtDate(l)}
                      formatter={(v: number) => [v?.toFixed(3) + "%", "Mediana"]}
                    />
                    <Line type="monotone" dataKey="med" stroke={modeColor} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Mediana emissor */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-baseline justify-between mb-1">
                <div className="text-xs font-bold">
                  Mediana de spread — {focusEmissor?.nome ?? "Emissor"}
                </div>
                {selectedTicker && (
                  <button
                    onClick={() => setSelectedTicker(null)}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    limpar seleção
                  </button>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground mb-2">
                {emissorTickers.size} ticker(s) · janela {window}d
              </div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={emissorSeries} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.border} />
                    <XAxis
                      dataKey="d"
                      tick={{ fontSize: 9, fill: chartTheme.tickFill }}
                      tickFormatter={fmtDate}
                      minTickGap={32}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: chartTheme.tickFill, fontFamily: "DM Mono, monospace" }}
                      tickFormatter={(v) => v.toFixed(2) + "%"}
                    />
                    <Tooltip
                      contentStyle={chartTheme.tooltip}
                      labelStyle={chartTheme.tooltipLabel}
                      itemStyle={chartTheme.tooltipItem}
                      labelFormatter={(l: string) => fmtDate(l)}
                      formatter={(v: number) => [v?.toFixed(3) + "%", "Mediana"]}
                    />
                    <Line type="monotone" dataKey="med" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Tabela */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 gap-3">
              <div>
                <div className="text-xs font-bold">Tickers do setor — {setorAtivo}</div>
                <div className="text-[10px] text-muted-foreground">
                  Clique para selecionar e atualizar o gráfico do emissor.
                </div>
              </div>
              <div className="relative w-[260px]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar ticker ou emissor…"
                  className="h-8 pl-7 text-xs"
                />
              </div>
            </div>
            <div className="overflow-auto max-h-[360px]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card">
                  <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                    <th className="text-left py-2 px-2">Ticker</th>
                    <th className="text-left py-2 px-2">Emissor</th>
                    <th className="text-left py-2 px-2">Rating</th>
                    <th className="text-right py-2 px-2">Duration</th>
                    <th className="text-right py-2 px-2">{yLabel}</th>
                    <th className="text-right py-2 px-2">Δ vs 21d</th>
                    <th className="text-right py-2 px-2">Z</th>
                    <th className="text-right py-2 px-2">Vol 90d</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((t) => {
                    const delta = ((t.last_val ?? 0) - (t.avg_21d ?? t.last_val ?? 0)) * 100;
                    const sel = selectedTicker === t.ticker;
                    return (
                      <tr
                        key={t.ticker}
                        onClick={() => {
                          setSelectedTicker(t.ticker);
                          onSelectTicker(t.ticker);
                        }}
                        className={`border-b border-border/60 cursor-pointer hover:bg-muted/40 ${
                          sel ? "bg-muted/60" : ""
                        }`}
                      >
                        <td className="py-1.5 px-2 font-mono font-medium" style={{ color: modeColor }}>{t.ticker}</td>
                        <td className="py-1.5 px-2 truncate max-w-[220px]">{t.emissor_label}</td>
                        <td className="py-1.5 px-2">
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold"
                            style={{ background: (RATING_COLORS[t.rating_norm] ?? "#94a3b8") + "22", color: RATING_COLORS[t.rating_norm] ?? "#94a3b8" }}
                          >
                            {t.rating_norm}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono">{t.anos_venc?.toFixed(2)}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{(t.last_val ?? 0).toFixed(3)}%</td>
                        <td
                          className="py-1.5 px-2 text-right font-mono"
                          style={{ color: delta > 0 ? "#ef4444" : delta < 0 ? "#10b981" : undefined }}
                        >
                          {delta > 0 ? "+" : ""}
                          {delta.toFixed(0)} bps
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono">{(t.z_score ?? 0).toFixed(2)}</td>
                        <td className="py-1.5 px-2 text-right font-mono text-muted-foreground">{fv(t.total_vol_fin ?? 0)}</td>
                      </tr>
                    );
                  })}
                  {tableRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-muted-foreground">
                        Nenhum ticker encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
