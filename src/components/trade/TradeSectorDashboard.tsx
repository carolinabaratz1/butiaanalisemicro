// src/components/trade/TradeSectorDashboard.tsx
// Dashboard setorial — scatter Spread × Duration por rating, com filtro por setor,
// mediana histórica do setor e do emissor selecionado, e tabela de tickers.
import { useMemo, useRef, useState } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Cell, ComposedChart, Line, Legend, LabelList,
} from "recharts";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { toPng } from "html-to-image";
import { TradeAtivo, TradeMode, HistoryPoint } from "@/hooks/useTradeData";
import { useEmpresasSetor } from "@/hooks/useEmpresasSetor";
import { useChartTheme } from "@/hooks/useChartTheme";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Download, Image as ImageIcon, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

interface Props {
  data: TradeAtivo[];
  history?: Record<string, HistoryPoint[]>;
  mode: TradeMode;
  modeColor: string;
  onSelectTicker: (t: string) => void;
  /** Returns true if ticker has any active position. Used by position filter. */
  hasPosition?: (ticker: string) => boolean;
}

const ALL_SECTORS = "__ALL__";

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

// Paleta de cores bem separadas no espectro para múltiplos setores.
// Combinamos com padrões de traço (sólido / tracejado / pontilhado) para
// garantir distinção visual mesmo quando há muitos setores.
const SECTOR_BASE_COLORS = [
  "#1f77b4", // azul
  "#d62728", // vermelho
  "#2ca02c", // verde
  "#ff7f0e", // laranja
  "#9467bd", // roxo
  "#17becf", // ciano
  "#e377c2", // rosa
  "#8c564b", // marrom
  "#bcbd22", // oliva
  "#7f7f7f", // cinza
];
const SECTOR_DASH_PATTERNS = ["0", "6 3", "2 3", "8 3 2 3"]; // sólido, tracejado, pontilhado, traço-ponto
function sectorStyle(i: number) {
  const color = SECTOR_BASE_COLORS[i % SECTOR_BASE_COLORS.length];
  const dash = SECTOR_DASH_PATTERNS[Math.floor(i / SECTOR_BASE_COLORS.length) % SECTOR_DASH_PATTERNS.length];
  return { color, dash };
}

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

type SortKey = "ticker" | "emissor" | "rating" | "duration" | "valor" | "delta5" | "delta21" | "z" | "vol";
type SortDir = "asc" | "desc";

export function TradeSectorDashboard({ data, history, mode, modeColor, onSelectTicker, hasPosition }: Props) {
  const { byCnpj, loading: loadingEmpresas } = useEmpresasSetor();
  const chartTheme = useChartTheme();

  // Refs para exportação como imagem
  const scatterRef = useRef<HTMLDivElement>(null);
  const sectorChartRef = useRef<HTMLDivElement>(null);
  const emissorChartRef = useRef<HTMLDivElement>(null);

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

  // Ratings disponíveis (ordenados na ordem padrão)
  const ratingsDisponiveis = useMemo(() => {
    const set = new Set<string>();
    enriched.forEach((t) => set.add(t.rating_norm));
    return RATING_ORDER.filter((r) => set.has(r));
  }, [enriched]);

  const [setor, setSetor] = useState<string | null>(null);
  const setorAtivo = setor ?? setores[0]?.[0] ?? null;
  const isAllSectors = setorAtivo === ALL_SECTORS;

  const [search, setSearch] = useState("");
  // Janela em dias úteis ("MAX" = sem corte)
  const [window, setWindow] = useState<5 | 10 | 21 | 90 | "MAX">(21);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [ratingFilter, setRatingFilter] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("z");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const noSetor = !setorAtivo;

  // Aplica filtro de rating em qualquer subconjunto
  const applyRating = (arr: typeof enriched) => {
    if (ratingFilter.size === 0) return arr;
    return arr.filter((t) => ratingFilter.has(t.rating_norm));
  };

  // Pontos do scatter: setor selecionado em destaque, restante como background.
  const inSector = useMemo(
    () => applyRating(isAllSectors ? enriched : enriched.filter((t) => t.setor === setorAtivo)),
    [enriched, setorAtivo, isAllSectors, ratingFilter],
  );
  const outSector = useMemo(
    () => (isAllSectors ? [] : enriched.filter((t) => t.setor !== setorAtivo)),
    [enriched, setorAtivo, isAllSectors],
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

  // Série única do setor atual (quando setor específico está selecionado)
  const sectorTickers = useMemo(() => new Set(inSector.map((t) => t.ticker)), [inSector]);
  const sectorSeries = useMemo(
    () => (isAllSectors ? [] : buildSeries(sectorTickers)),
    [sectorTickers, history, window, isAllSectors],
  );

  // Quando "Todos os setores": uma série por setor (respeitando filtro de rating)
  const multiSectorSeries = useMemo(() => {
    if (!isAllSectors) return { rows: [], setores: [] as { nome: string; color: string; dash: string }[] };
    const setoresList = setores.map(([s], i) => {
      const st = sectorStyle(i);
      return { nome: s, color: st.color, dash: st.dash };
    });
    const seriesPorSetor = setoresList.map((s) => {
      const tks = new Set(
        applyRating(enriched.filter((t) => t.setor === s.nome)).map((t) => t.ticker),
      );
      return { setor: s.nome, color: s.color, dash: s.dash, serie: buildSeries(tks) };
    });
    // Pivot por data
    const datas = new Set<string>();
    seriesPorSetor.forEach((ss) => ss.serie.forEach((p) => datas.add(p.d)));
    const ordered = Array.from(datas).sort();
    const rows = ordered.map((d) => {
      const row: Record<string, number | string | null> = { d };
      seriesPorSetor.forEach((ss) => {
        const pt = ss.serie.find((p) => p.d === d);
        row[ss.setor] = pt?.med ?? null;
      });
      return row;
    });
    return { rows, setores: setoresList };
  }, [isAllSectors, setores, enriched, ratingFilter, history, window]);

  // Quando "Todos os setores", o segundo gráfico mostra a mediana do universo inteiro.
  const allTickers = useMemo(() => new Set(inSector.map((t) => t.ticker)), [inSector]);
  const allSeries = useMemo(
    () => (isAllSectors ? buildSeries(allTickers) : []),
    [isAllSectors, allTickers, history, window],
  );


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

  // Tabela com ordenação
  const tableRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = inSector.filter(
      (t) =>
        !q ||
        t.ticker.toLowerCase().includes(q) ||
        t.emissor_label.toLowerCase().includes(q),
    );
    const ratingIdx = (r: string) => {
      const i = RATING_ORDER.indexOf(r as typeof RATING_ORDER[number]);
      return i === -1 ? 99 : i;
    };
    const get = (t: typeof inSector[number]) => {
      switch (sortKey) {
        case "ticker": return t.ticker;
        case "emissor": return t.emissor_label;
        case "rating": return ratingIdx(t.rating_norm);
        case "duration": return t.anos_venc ?? 0;
        case "valor": return t.last_val ?? 0;
        case "delta5": return ((t.last_val ?? 0) - (t.avg_5d ?? t.last_val ?? 0));
        case "delta21": return ((t.last_val ?? 0) - (t.avg_21d ?? t.last_val ?? 0));
        case "z": return t.z_score ?? 0;
        case "vol": return t.total_vol_fin ?? 0;
      }
    };
    const dir = sortDir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      const va = get(a); const vb = get(b);
      if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb) * dir;
      return ((va as number) - (vb as number)) * dir;
    });
  }, [inSector, search, sortKey, sortDir]);

  const yLabel = mode === "CDI_PCT" ? "% CDI" : mode === "IPCA" ? "Spread (% a.a.)" : "Taxa (% a.a.)";

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "ticker" || k === "emissor" || k === "rating" ? "asc" : "desc"); }
  }
  const sortIcon = (k: SortKey) =>
    sortKey !== k ? <ArrowUpDown className="inline w-3 h-3 opacity-40" /> :
    sortDir === "asc" ? <ArrowUp className="inline w-3 h-3" /> : <ArrowDown className="inline w-3 h-3" />;

  // ── Exportações ─────────────────────────────────────────────
  function exportTableXlsx() {
    const rows = tableRows.map((t) => ({
      Ticker: t.ticker,
      Emissor: t.emissor_label,
      Setor: t.setor,
      Rating: t.rating_norm,
      Duration: t.anos_venc,
      [yLabel]: t.last_val,
      "Δ vs 5D (bps)": t.last_val != null && t.avg_5d != null ? Math.round((t.last_val - t.avg_5d) * 100) : null,
      "Δ vs 21D (bps)": t.last_val != null && t.avg_21d != null ? Math.round((t.last_val - t.avg_21d) * 100) : null,
      Z: t.z_score,
      "Vol 90D": t.total_vol_fin,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Tickers");

    if (isAllSectors && multiSectorSeries.rows.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(multiSectorSeries.rows), "Mediana por setor");
    } else if (sectorSeries.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sectorSeries), "Mediana setor");
    }
    if (emissorSeries.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(emissorSeries), "Mediana emissor");
    }
    const tag = isAllSectors ? "todos-setores" : (setorAtivo ?? "setor").replace(/\s+/g, "-").toLowerCase();
    XLSX.writeFile(wb, `trade-${tag}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function exportElementPng(el: HTMLDivElement | null, name: string) {
    if (!el) return;
    try {
      const bg = getComputedStyle(document.documentElement).getPropertyValue("--card").trim();
      const dataUrl = await toPng(el, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: bg ? `hsl(${bg})` : "#ffffff",
      });
      const blob = await (await fetch(dataUrl)).blob();
      saveAs(blob, `${name}-${new Date().toISOString().slice(0, 10)}.png`);
    } catch (err) {
      console.error("Falha ao exportar imagem", err);
    }
  }

  return (
    <div className="p-6 space-y-4">
      {/* Filtros */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Setor
          </span>
          <Select value={setorAtivo ?? ""} onValueChange={(v) => { setSetor(v); setSelectedTicker(null); }}>
            <SelectTrigger className="h-8 w-[260px] text-xs">
              <SelectValue placeholder={loadingEmpresas ? "Carregando…" : "Selecionar setor"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SECTORS} className="text-xs font-semibold">
                Todos os setores <span className="text-muted-foreground font-mono ml-1">({enriched.length})</span>
              </SelectItem>
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

        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Rating
          </span>
          <div className="flex flex-wrap gap-1 bg-muted p-1 rounded-lg max-w-[420px]">
            <button
              onClick={() => setRatingFilter(new Set())}
              className={`px-2 h-6 text-[11px] font-mono rounded ${
                ratingFilter.size === 0 ? "bg-background shadow-sm font-bold" : "text-muted-foreground"
              }`}
            >
              Todos
            </button>
            {ratingsDisponiveis.map((r) => {
              const on = ratingFilter.has(r);
              return (
                <button
                  key={r}
                  onClick={() => {
                    const next = new Set(ratingFilter);
                    if (on) next.delete(r); else next.add(r);
                    setRatingFilter(next);
                  }}
                  className={`px-2 h-6 text-[11px] font-mono rounded ${
                    on ? "shadow-sm font-bold" : "text-muted-foreground"
                  }`}
                  style={on ? { background: (RATING_COLORS[r] ?? "#94a3b8") + "33", color: RATING_COLORS[r] } : undefined}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 min-w-[40px]" />

        <Badge variant="outline" className="font-mono text-xs gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: modeColor }} />
          {inSector.length} emissões
        </Badge>

        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={exportTableXlsx}>
          <Download className="w-3.5 h-3.5" /> Excel
        </Button>
      </div>

      {noSetor ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-sm text-muted-foreground">
          Sem ativos com setor cadastrado neste universo.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Scatter */}
            <div ref={scatterRef} className="bg-card border border-border rounded-xl p-4 lg:row-span-2">
              <div className="flex items-baseline justify-between mb-2 gap-2">
                <div>
                  <div className="text-xs font-bold">
                    Mercado secundário · {isAllSectors ? "Todos os setores" : setorAtivo} · {mode === "DI_SPREAD" ? "DI+" : mode === "IPCA" ? "IPCA+" : "%CDI"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Spread × Duration · cores = rating{!isAllSectors && " · cinza = universo fora do setor"}
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1" onClick={() => exportElementPng(scatterRef.current, "scatter")}>
                  <ImageIcon className="w-3.5 h-3.5" /> PNG
                </Button>
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

                    {bgPoints.length > 0 && (
                      <Scatter data={bgPoints} fill={chartTheme.muted} fillOpacity={0.25} shape="circle" />
                    )}

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

            {/* Mediana setor (single ou multi) */}
            <div ref={sectorChartRef} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-baseline justify-between mb-1 gap-2">
                <div className="text-xs font-bold">
                  Mediana de spread — {isAllSectors ? "por setor" : setorAtivo}
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1" onClick={() => exportElementPng(sectorChartRef.current, "mediana-setor")}>
                  <ImageIcon className="w-3.5 h-3.5" /> PNG
                </Button>
              </div>
              <div className="text-[10px] text-muted-foreground mb-2">
                Mediana móvel de 10 negociações · janela {window === "MAX" ? "máx" : `${window}du`}
                {ratingFilter.size > 0 && ` · rating ${Array.from(ratingFilter).join(", ")}`}
              </div>
              <div style={{ height: isAllSectors ? 320 : 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {isAllSectors ? (
                    <ComposedChart data={multiSectorSeries.rows} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.border} />
                      <XAxis dataKey="d" tick={{ fontSize: 9, fill: chartTheme.tickFill }} tickFormatter={fmtDate} minTickGap={32} />
                      <YAxis tick={{ fontSize: 9, fill: chartTheme.tickFill, fontFamily: "DM Mono, monospace" }} tickFormatter={(v) => v.toFixed(2) + "%"} />
                      <Tooltip
                        contentStyle={chartTheme.tooltip}
                        labelStyle={chartTheme.tooltipLabel}
                        itemStyle={chartTheme.tooltipItem}
                        labelFormatter={(l: string) => fmtDate(l)}
                        formatter={(v: number, n: string) => [v?.toFixed(3) + "%", n]}
                      />
                      <Legend wrapperStyle={{ fontSize: 9 }} iconSize={14} />
                      {multiSectorSeries.setores.map((s) => (
                        <Line
                          key={s.nome}
                          type="monotone"
                          dataKey={s.nome}
                          stroke={s.color}
                          strokeWidth={1.75}
                          strokeDasharray={s.dash === "0" ? undefined : s.dash}
                          dot={false}
                          isAnimationActive={false}
                          connectNulls
                        />
                      ))}
                    </ComposedChart>
                  ) : (
                    <ComposedChart data={sectorSeries} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.border} />
                      <XAxis dataKey="d" tick={{ fontSize: 9, fill: chartTheme.tickFill }} tickFormatter={fmtDate} minTickGap={32} />
                      <YAxis tick={{ fontSize: 9, fill: chartTheme.tickFill, fontFamily: "DM Mono, monospace" }} tickFormatter={(v) => v.toFixed(2) + "%"} />
                      <Tooltip
                        contentStyle={chartTheme.tooltip}
                        labelStyle={chartTheme.tooltipLabel}
                        itemStyle={chartTheme.tooltipItem}
                        labelFormatter={(l: string) => fmtDate(l)}
                        formatter={(v: number) => [v?.toFixed(3) + "%", "Mediana"]}
                      />
                      <Line type="monotone" dataKey="med" stroke={modeColor} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
                    </ComposedChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* Mediana emissor */}
            <div ref={emissorChartRef} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-baseline justify-between mb-1 gap-2">
                <div className="text-xs font-bold">
                  {isAllSectors
                    ? "Mediana de spread — todos os ativos"
                    : `Mediana de spread — ${focusEmissor?.nome ?? "Emissor"}`}
                </div>
                <div className="flex items-center gap-2">
                  {!isAllSectors && selectedTicker && (
                    <button
                      onClick={() => setSelectedTicker(null)}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      limpar seleção
                    </button>
                  )}
                  <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1" onClick={() => exportElementPng(emissorChartRef.current, isAllSectors ? "mediana-todos" : "mediana-emissor")}>
                    <ImageIcon className="w-3.5 h-3.5" /> PNG
                  </Button>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground mb-2">
                {isAllSectors
                  ? `${allTickers.size} ticker(s) · janela ${window === "MAX" ? "máx" : `${window}du`}`
                  : `${emissorTickers.size} ticker(s) · janela ${window === "MAX" ? "máx" : `${window}du`}`}
              </div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={isAllSectors ? allSeries : emissorSeries} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.border} />
                    <XAxis dataKey="d" tick={{ fontSize: 9, fill: chartTheme.tickFill }} tickFormatter={fmtDate} minTickGap={32} />
                    <YAxis tick={{ fontSize: 9, fill: chartTheme.tickFill, fontFamily: "DM Mono, monospace" }} tickFormatter={(v) => v.toFixed(2) + "%"} />
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
                <div className="text-xs font-bold">
                  Tickers — {isAllSectors ? "Todos os setores" : setorAtivo}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Clique para selecionar e atualizar o gráfico do emissor. Clique no cabeçalho para ordenar.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-[260px]">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar ticker ou emissor…"
                    className="h-8 pl-7 text-xs"
                  />
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={exportTableXlsx}>
                  <Download className="w-3.5 h-3.5" /> Excel
                </Button>
              </div>
            </div>
            <div className="overflow-auto max-h-[420px]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border select-none">
                    <th className="text-left py-2 px-2 cursor-pointer hover:text-foreground" onClick={() => toggleSort("ticker")}>Ticker {sortIcon("ticker")}</th>
                    <th className="text-left py-2 px-2 cursor-pointer hover:text-foreground" onClick={() => toggleSort("emissor")}>Emissor {sortIcon("emissor")}</th>
                    {isAllSectors && <th className="text-left py-2 px-2">Setor</th>}
                    <th className="text-left py-2 px-2 cursor-pointer hover:text-foreground" onClick={() => toggleSort("rating")}>Rating {sortIcon("rating")}</th>
                    <th className="text-right py-2 px-2 cursor-pointer hover:text-foreground" onClick={() => toggleSort("duration")}>Duration {sortIcon("duration")}</th>
                    <th className="text-right py-2 px-2 cursor-pointer hover:text-foreground" onClick={() => toggleSort("valor")}>{yLabel} {sortIcon("valor")}</th>
                    <th className="text-right py-2 px-2 cursor-pointer hover:text-foreground" onClick={() => toggleSort("delta5")}>Δ vs 5D {sortIcon("delta5")}</th>
                    <th className="text-right py-2 px-2 cursor-pointer hover:text-foreground" onClick={() => toggleSort("delta21")}>Δ vs 21D {sortIcon("delta21")}</th>
                    <th className="text-right py-2 px-2 cursor-pointer hover:text-foreground" onClick={() => toggleSort("z")}>Z {sortIcon("z")}</th>
                    <th className="text-right py-2 px-2 cursor-pointer hover:text-foreground" onClick={() => toggleSort("vol")}>Vol 90D {sortIcon("vol")}</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((t) => {
                    const d5 = ((t.last_val ?? 0) - (t.avg_5d ?? t.last_val ?? 0)) * 100;
                    const d21 = ((t.last_val ?? 0) - (t.avg_21d ?? t.last_val ?? 0)) * 100;
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
                        {isAllSectors && <td className="py-1.5 px-2 text-muted-foreground truncate max-w-[140px]">{t.setor}</td>}
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
                          style={{ color: d5 > 0 ? "#ef4444" : d5 < 0 ? "#10b981" : undefined }}
                        >
                          {d5 > 0 ? "+" : ""}{d5.toFixed(0)} bps
                        </td>
                        <td
                          className="py-1.5 px-2 text-right font-mono"
                          style={{ color: d21 > 0 ? "#ef4444" : d21 < 0 ? "#10b981" : undefined }}
                        >
                          {d21 > 0 ? "+" : ""}{d21.toFixed(0)} bps
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono">{(t.z_score ?? 0).toFixed(2)}</td>
                        <td className="py-1.5 px-2 text-right font-mono text-muted-foreground">{fv(t.total_vol_fin ?? 0)}</td>
                      </tr>
                    );
                  })}
                  {tableRows.length === 0 && (
                    <tr>
                      <td colSpan={isAllSectors ? 10 : 9} className="py-6 text-center text-muted-foreground">
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
