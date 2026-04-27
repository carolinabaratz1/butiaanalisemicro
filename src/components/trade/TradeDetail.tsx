// src/components/trade/TradeDetail.tsx
import { useState } from "react";
import { TradeAtivo, HistoryPoint, NTNBPoint, useTickerDetail } from "@/hooks/useTradeData";
import { useChartTheme } from "@/hooks/useChartTheme";
import { X, ExternalLink } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface TradeDetailProps {
  ticker: string;
  data: TradeAtivo[];
  history: Record<string, HistoryPoint[]>;
  ntnbHist: Record<string, NTNBPoint[]>;
  mode: "DI" | "IPCA";
  modeColor: string;
  onClose: () => void;
  onViewEmissor?: (cnpj: string) => void;
}

function rBadge(r: string | null) {
  if (!r || ["N/A","0","nan",""].includes((r ?? "").trim())) return <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700">—</span>;
  const cls = r.includes("AAA") ? "bg-emerald-900/40 text-emerald-400 border-emerald-800"
    : r.includes("AA") ? "bg-indigo-900/40 text-indigo-400 border-indigo-800"
    : r.includes("| A") ? "bg-sky-900/40 text-sky-400 border-sky-800"
    : r.includes("BBB") ? "bg-yellow-900/40 text-yellow-400 border-yellow-800"
    : "bg-slate-800 text-slate-500 border-slate-700";
  const s = r.replace("MOODY'S | ","M|").replace("MOODYS | ","M|").replace("FITCH | ","F|").replace("S&P | ","S|");
  return <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${cls}`}>{s}</span>;
}

function fmtNTNB(ref: string | null | undefined): string {
  if (!ref) return "";
  // Strip any "NTN-B ..." prefix; keep the trailing 8-digit YYYYMMDD code
  const m = ref.match(/(\d{8})\s*$/);
  if (!m) return ref.startsWith("NTN-B") ? ref : `NTN-B ${ref}`;
  const code = m[1];
  return `NTN-B ${code.slice(0, 4)}-${code.slice(4, 6)}`;
}

// Tooltip / axis colors are now derived from CSS tokens via useChartTheme()


type ChartWin = "90d" | "30d" | "21d" | "10d" | "pu";

export function TradeDetail({ ticker, data, history, ntnbHist, mode, modeColor, onClose, onViewEmissor }: TradeDetailProps) {
  const [chartWin, setChartWin] = useState<ChartWin>("90d");
  const t = data.find(x => x.ticker === ticker);
  const chartTheme = useChartTheme();

  // Fetch full per-ticker history (paginated, computed via RPC for IPCA).
  // Falls back to the global `history` map if the per-ticker fetch is empty.
  const { history: tickerHist } = useTickerDetail(ticker);

  if (!t) return null;

  const isIPCA = mode === "IPCA";
  const hist = tickerHist.length > 0 ? tickerHist : (history[ticker] ?? []);
  const zColor = (t.z_score ?? 0) > 1.5 ? "#ff4d2e" : (t.z_score ?? 0) > 0.5 ? "#fb923c" : "#34d399";

  // Slice history by window
  const displayHist = chartWin === "90d" ? hist
    : chartWin === "30d" ? hist.slice(-30)
    : chartWin === "21d" ? hist.slice(-21)
    : chartWin === "10d" ? hist.slice(-10)
    : hist; // pu uses same hist

  const chartData = chartWin === "pu"
    ? displayHist.filter(h => h.pc || h.pi).map(h => ({ d: h.d.slice(5), pc: h.pc, pi: h.pi }))
    : displayHist.map(h => ({ d: h.d.slice(5), val: h.r, avg90: t.avg_90d ?? 0 }));

  const WINDOWS = [
    { key: "z_score_5d" as keyof TradeAtivo,  label: "5d",  avg: "avg_5d"  as keyof TradeAtivo },
    { key: "z_score_10d" as keyof TradeAtivo, label: "10d", avg: "avg_10d" as keyof TradeAtivo },
    { key: "z_score_21d" as keyof TradeAtivo, label: "21d", avg: "avg_21d" as keyof TradeAtivo },
    { key: "z_score"     as keyof TradeAtivo, label: "90d", avg: "avg_90d" as keyof TradeAtivo },
  ];

  const Metric = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div className="bg-muted border border-border rounded-lg p-2.5">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <div className="text-sm font-bold font-mono" style={{ color: color ?? "inherit" }}>{value}</div>
    </div>
  );

  return (
    <>
      {/* Mobile backdrop — closes on tap */}
      <div
        className="md:hidden fixed inset-0 bg-foreground/40 z-40 animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden
      />
      <div className="
        fixed md:static
        inset-x-0 bottom-0 md:inset-auto
        z-50 md:z-auto
        w-full md:w-72 flex-shrink-0
        max-h-[85vh] md:max-h-none
        rounded-t-2xl md:rounded-none
        border-t md:border-t-0 md:border-l border-border bg-card
        flex flex-col overflow-hidden
        shadow-2xl md:shadow-none
        animate-in slide-in-from-bottom md:slide-in-from-bottom-0 duration-300
      ">
        {/* Mobile drag handle */}
        <div className="md:hidden flex justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
      {/* Header */}
      <div className="p-4 border-b border-border flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-2xl font-extrabold font-mono leading-tight" style={{ color: modeColor }}>
              {t.ticker}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
              {t.emissor_nome}
              {t.emissor_cnpj && <span className="ml-1 opacity-60">· {t.emissor_cnpj}</span>}
            </div>
            {isIPCA && t.ntnb_ref && (
              <div className="text-[9px] text-violet-300 font-mono mt-1">
                {fmtNTNB(t.ntnb_ref)} · {(t.ntnb_taxa ?? 0).toFixed(4)}%
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tags */}
        <div className="flex gap-1.5 flex-wrap mt-2.5">
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
            style={{ borderColor: modeColor, color: modeColor, background: modeColor + "18" }}>
            {mode}+
          </span>
          {rBadge(t.rating)}
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
            style={{ borderColor: zColor, color: zColor, background: zColor + "18" }}>
            {(t.z_score ?? 0) > 1.5 ? "🔥" : (t.z_score ?? 0) > 0.5 ? "👀" : "✅"} Z={(t.z_score ?? 0).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Main metrics */}
        <div className="grid grid-cols-2 gap-1.5">
          <Metric label={isIPCA ? "Spread Atual" : "Taxa Atual"} value={(t.last_val ?? 0).toFixed(4) + "%"} color={modeColor} />
          <Metric label="Vencimento" value={t.venc_date ? `${t.venc_date} (${t.anos_venc}a)` : "—"} />
          <Metric label="Emissão" value={t.taxa_emissao ?? "—"} />
          <Metric label="Rating" value={(() => {const r=t.rating??'—';return r.replace("MOODY'S | ","M|").replace("FITCH | ","F|").replace("S&P | ","S|");})()} />
        </div>

        {/* PU metrics */}
        <div className="grid grid-cols-2 gap-1.5">
          <Metric label="PU Curva" value={(t.pu_curva ?? 0) > 0 ? `R$ ${(t.pu_curva ?? 0).toFixed(2)}` : "—"} />
          <Metric label="PU Indicativo" value={(t.pu_indicativo ?? 0) > 0 ? `R$ ${(t.pu_indicativo ?? 0).toFixed(2)}` : "—"} />
          <Metric label="PU Ind / Curva"
            value={(t.pu_ratio ?? 0) > 0 ? (t.pu_ratio ?? 0).toFixed(4) : "—"}
            color={(t.pu_ratio ?? 0) > 1.02 ? "#f87171" : (t.pu_ratio ?? 0) < 0.98 && (t.pu_ratio ?? 0) > 0 ? "#34d399" : undefined} />
          <Metric label="Vol. Financeiro" value={(t.last_vol_fin ?? 0) > 0 ? (() => { const v = t.last_vol_fin!; return v >= 1e6 ? (v/1e6).toFixed(1)+"M" : v >= 1e3 ? (v/1e3).toFixed(0)+"K" : v.toFixed(0); })() : "—"} />
        </div>

        {/* Window table */}
        <div className="bg-muted border border-border rounded-lg overflow-hidden">
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold px-3 py-2 bg-muted border-b border-border">
            Médias por Janela
          </div>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-border">
                {["Janela","Média","Z-Score","Δ bps"].map(h => (
                  <th key={h} className="px-2.5 py-1.5 text-left text-[9px] text-muted-foreground font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WINDOWS.map(w => {
                const avg = (t[w.avg] as number | null) ?? (t.last_val ?? 0);
                const z   = (t[w.key] as number | null) ?? 0;
                const db  = (((t.last_val ?? 0) - avg) * 100).toFixed(1);
                const zc  = z > 1.5 ? "#ff4d2e" : z > 0.5 ? "#fb923c" : z > 0 ? "#94a3b8" : "#34d399";
                return (
                  <tr key={w.label} className="border-b border-border last:border-0">
                    <td className="px-2.5 py-1.5 text-muted-foreground">{w.label}</td>
                    <td className="px-2.5 py-1.5 font-mono">{avg.toFixed(4)}%</td>
                    <td className="px-2.5 py-1.5 font-mono" style={{ color: zc }}>{z.toFixed(2)}</td>
                    <td className={`px-2.5 py-1.5 font-mono ${+db > 0 ? "text-red-400" : +db < 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
                      {+db > 0 ? "+" : ""}{db}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Chart */}
        <div className="bg-muted border border-border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
              {chartWin === "pu" ? "PU Curva vs Indicativo" : isIPCA ? "Spread cap." : "Taxa % a.a."}
            </span>
            <div className="flex gap-0.5 bg-card p-0.5 rounded">
              {(["90d","30d","21d","10d","pu"] as ChartWin[]).map(w => (
                <button key={w} onClick={() => setChartWin(w)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all
                    ${chartWin === w ? "bg-muted text-foreground border border-border" : "text-muted-foreground"}`}>
                  {w}
                </button>
              ))}
            </div>
          </div>
          <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              {chartWin === "pu" ? (
                <LineChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <XAxis dataKey="d" tick={{ fontSize: 8, fill: chartTheme.tickFill }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 8, fontFamily: "DM Mono", fill: chartTheme.tickFill }} axisLine={false} tickLine={false}
                    tickFormatter={v => "R$"+Math.round(v)} />
                  <Tooltip contentStyle={chartTheme.tooltip} labelStyle={chartTheme.tooltipLabel} itemStyle={chartTheme.tooltipItem}
                    formatter={(v: number, name: string) => ["R$ "+v?.toFixed(2), name === "pc" ? "PU Curva" : "PU Indicativo"]} />
                  <Legend iconSize={6} wrapperStyle={{ fontSize: 9, color: chartTheme.muted }} />
                  <Line type="monotone" dataKey="pc" stroke={chartTheme.muted} strokeWidth={1.5} dot={false} name="PU Curva" strokeDasharray="4 3" connectNulls />
                  <Line type="monotone" dataKey="pi" stroke={modeColor} strokeWidth={2} dot={false} name="PU Indicativo" connectNulls />
                </LineChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <XAxis dataKey="d" tick={{ fontSize: 8, fill: chartTheme.tickFill }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 8, fontFamily: "DM Mono", fill: chartTheme.tickFill }} axisLine={false} tickLine={false}
                    tickFormatter={v => v.toFixed(2)+"%"} />
                  <Tooltip contentStyle={chartTheme.tooltip} labelStyle={chartTheme.tooltipLabel} itemStyle={chartTheme.tooltipItem}
                    formatter={(v: number, name: string) => [v.toFixed(4)+"%", name === "val" ? (isIPCA ? "Spread" : "Taxa") : "Média 90d"]} />
                  <Line type="monotone" dataKey="val" stroke={modeColor} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="avg90" stroke={chartTheme.border} strokeWidth={1} strokeDasharray="4 3" dot={false} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Note */}
        <div className="text-[10px] text-muted-foreground leading-relaxed bg-muted border border-border rounded-lg p-3">
          {isIPCA ? (
            <><strong className="text-foreground">Spread capitalizado</strong> = (1+taxa_ativo) ÷ (1+taxa_NTN-B) − 1<br />
            {t.ntnb_ref && (
              <>Ref: <span className="text-foreground">{fmtNTNB(t.ntnb_ref)}</span> · NTN-B atual: <span className="text-foreground">{(t.ntnb_taxa ?? 0).toFixed(4)}%</span><br /></>
            )}
            Z-Score calculado sobre o spread, não sobre a taxa bruta.</>
          ) : (
            <><strong className="text-foreground">DI + Spread</strong> · Taxa indicativa % a.a.<br />
            <span style={{ color: "#ff4d2e" }}>🔥 Z &gt; 1.5</span> = taxa muito acima do histórico</>
          )}
        </div>

        {/* Link to emissor */}
        {onViewEmissor && t.emissor_cnpj && (
          <button
            onClick={() => onViewEmissor(t.emissor_cnpj!)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-all">
            <ExternalLink className="w-3.5 h-3.5" />
            Ver ficha do emissor
          </button>
        )}
      </div>
      </div>
    </>
  );
}
