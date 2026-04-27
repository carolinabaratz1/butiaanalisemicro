// src/components/trade/TradeTable.tsx
import { useState, useMemo } from "react";
import { TradeAtivo } from "@/hooks/useTradeData";
import { ChevronUp, ChevronDown } from "lucide-react";

interface TradeTableProps {
  data: TradeAtivo[];
  mode: "DI" | "IPCA";
  modeColor: string;
  onSelectTicker: (ticker: string) => void;
  selectedTicker: string | null;
}

type SortField = keyof TradeAtivo;

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

function vPill(a: number | null) {
  if (!a || a <= 0) return <span className="text-muted-foreground text-xs">—</span>;
  const cls = a <= 2 ? "bg-red-900/40 text-red-400 border-red-800"
    : a <= 7 ? "bg-yellow-900/40 text-yellow-400 border-yellow-800"
    : "bg-emerald-900/40 text-emerald-400 border-emerald-800";
  return <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${cls}`}>{a}a</span>;
}

function fmtQ(v: number | null) {
  if (!v) return "—";
  if (v >= 1e6) return (v/1e6).toFixed(2)+"M";
  if (v >= 1e3) return (v/1e3).toFixed(1)+"K";
  return Math.round(v).toString();
}

function fv(v: number | null) {
  if (!v) return "—";
  if (v >= 1e9) return (v/1e9).toFixed(1)+"B";
  if (v >= 1e6) return (v/1e6).toFixed(1)+"M";
  if (v >= 1e3) return (v/1e3).toFixed(0)+"K";
  return v.toFixed(0);
}

const Z_WINDOWS = [
  { key: "z_score",    label: "90d" },
  { key: "z_score_21d", label: "21d" },
  { key: "z_score_10d", label: "10d" },
  { key: "z_score_5d",  label: "5d"  },
] as const;

export function TradeTable({ data, mode, modeColor, onSelectTicker, selectedTicker }: TradeTableProps) {
  const isIPCA = mode === "IPCA";
  const [sortField, setSortField] = useState<SortField>("z_score");
  const [sortAsc, setSortAsc]   = useState(false);
  const [page, setPage]         = useState(1);
  const [zWin, setZWin]         = useState<typeof Z_WINDOWS[number]["key"]>("z_score");
  const [search, setSearch]     = useState("");
  const [ratFilter, setRatFilter] = useState<string[]>(["AAA","AA","| A","BBB","__na__"]);
  const [sigFilter, setSigFilter] = useState<string[]>(["hot","watch","ok"]);
  const [vencMax, setVencMax]   = useState(35);
  const [sprFilter, setSprFilter] = useState("");
  const PER = 20;

  function toggleFilter(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
    setPage(1);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const src = [...data].filter(t => {
      if (q && !t.ticker.toLowerCase().includes(q) && !(t.emissor_nome ?? "").toLowerCase().includes(q)) return false;
      const zv = (t[zWin] as number) ?? 0;
      const sig = zv > 1.5 ? "hot" : zv > 0.5 ? "watch" : "ok";
      if (!sigFilter.includes(sig)) return false;
      const rat = t.rating ?? "N/A";
      const isNA = ["N/A","0","nan",""].includes(rat.trim());
      const mr = isNA ? ratFilter.includes("__na__") : ratFilter.filter(r => r !== "__na__").some(r => rat.includes(r));
      if (!mr) return false;
      if ((t.anos_venc ?? 99) > vencMax) return false;
      if (sprFilter) {
        const v = t.last_val;
        if (sprFilter === "lt05" && v >= 0.5) return false;
        if (sprFilter === "0510" && (v < 0.5 || v >= 1)) return false;
        if (sprFilter === "1020" && (v < 1 || v >= 2)) return false;
        if (sprFilter === "2030" && (v < 2 || v >= 3)) return false;
        if (sprFilter === "gt30" && v < 3) return false;
        if (sprFilter === "ipca-lt0" && v >= 0) return false;
        if (sprFilter === "ipca-0005" && (v < 0 || v >= 0.5)) return false;
        if (sprFilter === "ipca-0510" && (v < 0.5 || v >= 1)) return false;
        if (sprFilter === "ipca-gt10" && v < 1) return false;
      }
      return true;
    });

    src.sort((a, b) => {
      if (sortField === "anos_venc") return (a.anos_venc ?? 99) - (b.anos_venc ?? 99);
      const av = (a[sortField] as number) ?? 0;
      const bv = (b[sortField] as number) ?? 0;
      return sortAsc ? av - bv : bv - av;
    });
    return src;
  }, [data, search, zWin, sigFilter, ratFilter, vencMax, sprFilter, sortField, sortAsc]);

  const pages = Math.ceil(filtered.length / PER);
  const slice = filtered.slice((page-1)*PER, page*PER);

  function srt(f: SortField) {
    if (sortField === f) setSortAsc(a => !a);
    else { setSortField(f); setSortAsc(false); }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return null;
    return sortAsc ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />;
  }

  const Chip = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button onClick={onClick} className={`text-[10px] font-semibold px-2 py-1 rounded-full border transition-all
      ${active ? "border-sky-400 text-sky-400 bg-sky-400/10" : "border-border text-muted-foreground bg-transparent hover:text-foreground"}`}
      style={active ? { borderColor: modeColor, color: modeColor, background: modeColor + "18" } : {}}>
      {label}
    </button>
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <aside className="w-48 flex-shrink-0 border-r border-border bg-card p-3 overflow-y-auto space-y-4">
        <div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Busca</div>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Ticker ou emissor…"
            className="w-full bg-muted border border-border rounded-md px-2 py-1.5 text-xs outline-none focus:border-sky-400" />
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Sinal</div>
          <div className="flex flex-wrap gap-1">
            {[["hot","🔥 Quente"],["watch","👀 Atenção"],["ok","✅ Normal"]].map(([v,l]) => (
              <Chip key={v} label={l} active={sigFilter.includes(v)} onClick={() => { toggleFilter(sigFilter, setSigFilter, v); }} />
            ))}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Rating</div>
          <div className="flex flex-wrap gap-1">
            {[["AAA","AAA"],["AA","AA/AA+"],["| A","A/A+"],["BBB","BBB"],["__na__","S/Rat."]].map(([v,l]) => (
              <Chip key={v} label={l} active={ratFilter.includes(v)} onClick={() => toggleFilter(ratFilter, setRatFilter, v)} />
            ))}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Venc. máx (anos)</div>
          <input type="range" min={0} max={35} value={vencMax} onChange={e => { setVencMax(+e.target.value); setPage(1); }}
            className="w-full accent-sky-400" style={{ accentColor: modeColor }} />
          <div className="text-[9px] font-mono text-muted-foreground text-center mt-0.5">
            {vencMax >= 35 ? "35+a" : `≤ ${vencMax}a`}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Ordenar</div>
          <select value={sortField} onChange={e => { setSortField(e.target.value as SortField); setPage(1); }}
            className="w-full bg-muted border border-border rounded-md px-2 py-1 text-[11px] outline-none">
            <option value="z_score">Z-Score 90d ↓</option>
            <option value="z_score_21d">Z-Score 21d ↓</option>
            <option value="z_score_10d">Z-Score 10d ↓</option>
            <option value="z_score_5d">Z-Score 5d ↓</option>
            <option value="change_bps">Var bps ↓</option>
            <option value="last_val">Taxa/Spread ↓</option>
            <option value="anos_venc">Vencimento ↑</option>
            <option value="total_vol_fin">Vol. Financeiro ↓</option>
          </select>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Spread</div>
          <select value={sprFilter} onChange={e => { setSprFilter(e.target.value); setPage(1); }}
            className="w-full bg-muted border border-border rounded-md px-2 py-1 text-[11px] outline-none">
            <option value="">Todos</option>
            {isIPCA ? <>
              <option value="ipca-lt0">{"< 0%"}</option>
              <option value="ipca-0005">0 – 0.5%</option>
              <option value="ipca-0510">0.5 – 1%</option>
              <option value="ipca-gt10">{"1%+"}</option>
            </> : <>
              <option value="lt05">{"< 0.5%"}</option>
              <option value="0510">0.5 – 1%</option>
              <option value="1020">1 – 2%</option>
              <option value="2030">2 – 3%</option>
              <option value="gt30">{"3%+"}</option>
            </>}
          </select>
        </div>
      </aside>

      {/* Table area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card text-xs text-muted-foreground flex-shrink-0">
          <span><strong className="text-foreground">{filtered.length}</strong> emissões
            &nbsp;·&nbsp; 🔥 {filtered.filter(t => (t[zWin] as number ?? 0) > 1.5).length} oportunidades
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px]">Janela Z:</span>
            <div className="flex gap-0.5 bg-muted p-0.5 rounded">
              {Z_WINDOWS.map(w => (
                <button key={w.key} onClick={() => setZWin(w.key)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all
                    ${zWin === w.key ? "bg-card text-foreground border border-border" : "text-muted-foreground"}`}>
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[11px] border-collapse min-w-[950px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-muted border-b border-border">
                <th className="px-2.5 py-2 text-left text-[9px] uppercase tracking-widest text-muted-foreground">Sinal</th>
                <th className="px-2.5 py-2 text-left text-[9px] uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => srt("ticker")}>Ticker <SortIcon field="ticker" /></th>
                <th className="px-2.5 py-2 text-left text-[9px] uppercase tracking-widest text-muted-foreground">Emissor</th>
                <th className="px-2.5 py-2 text-left text-[9px] uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => srt("anos_venc")}>Venc. <SortIcon field="anos_venc" /></th>
                {isIPCA && <th className="px-2.5 py-2 text-left text-[9px] uppercase tracking-widest text-muted-foreground">NTN-B</th>}
                <th className="px-2.5 py-2 text-left text-[9px] uppercase tracking-widest text-muted-foreground">Rating</th>
                <th className="px-2.5 py-2 text-left text-[9px] uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => srt("last_val")}>{isIPCA ? "Spread" : "Taxa"} <SortIcon field="last_val" /></th>
                <th className="px-2.5 py-2 text-left text-[9px] uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => srt("avg_5d")}>5d <SortIcon field="avg_5d" /></th>
                <th className="px-2.5 py-2 text-left text-[9px] uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => srt("avg_21d")}>21d <SortIcon field="avg_21d" /></th>
                <th className="px-2.5 py-2 text-left text-[9px] uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => srt("avg_90d")}>90d <SortIcon field="avg_90d" /></th>
                <th className="px-2.5 py-2 text-left text-[9px] uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => srt(zWin)}>Z-Score <SortIcon field={zWin} /></th>
                <th className="px-2.5 py-2 text-left text-[9px] uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => srt("change_bps")}>Δ bps <SortIcon field="change_bps" /></th>
                <th className="px-2.5 py-2 text-left text-[9px] uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => srt("last_qtd")}>Qtd. <SortIcon field="last_qtd" /></th>
              </tr>
            </thead>
            <tbody>
              {slice.length === 0 && (
                <tr><td colSpan={14} className="text-center py-12 text-muted-foreground text-sm">Nenhuma emissão encontrada</td></tr>
              )}
              {slice.map(t => {
                const zv = (t[zWin] as number) ?? 0;
                const isHot = zv > 1.5, isWatch = zv > 0.5;
                const zColor = zv > 2 ? "#ff4d2e" : zv > 1 ? "#fb923c" : zv > 0 ? "#94a3b8" : "#34d399";
                const bps = t.change_bps ?? 0;
                const ntnbS = t.ntnb_ref ? t.ntnb_ref.replace("NTN-B 760199 ","").replace(/(\d{4})(\d{2}).*/,"$1/$2") : "—";

                return (
                  <tr key={t.ticker}
                    onClick={() => onSelectTicker(t.ticker)}
                    className={`border-b border-border cursor-pointer transition-colors hover:bg-muted/50
                      ${selectedTicker === t.ticker ? "bg-sky-400/5 border-l-2" : ""}`}
                    style={selectedTicker === t.ticker ? { borderLeftColor: modeColor } : {}}>
                    <td className="px-2.5 py-2">
                      {isHot ? (
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_4px_#ff4d2e]" />
                          <span className="text-[9px] font-bold text-orange-400">QUENTE</span>
                        </div>
                      ) : isWatch ? (
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                          <span className="text-[9px] font-bold text-orange-400">ATENÇÃO</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span className="text-[9px] text-muted-foreground">NORMAL</span>
                        </div>
                      )}
                    </td>
                    <td className="px-2.5 py-2">
                      <span className="font-mono font-semibold text-xs" style={{ color: modeColor }}>{t.ticker}</span>
                    </td>
                    <td className="px-2.5 py-2 max-w-[150px] truncate text-foreground">{t.emissor_nome ?? "—"}</td>
                    <td className="px-2.5 py-2">{vPill(t.anos_venc)}</td>
                    {isIPCA && <td className="px-2.5 py-2"><span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-violet-900/40 text-violet-300 border border-violet-800">{ntnbS}</span></td>}
                    <td className="px-2.5 py-2">{rBadge(t.rating)}</td>
                    <td className="px-2.5 py-2 font-mono font-semibold text-xs">{(t.last_val ?? 0).toFixed(3)}%</td>
                    <td className="px-2.5 py-2 font-mono text-muted-foreground text-[11px]">{(t.avg_5d ?? 0).toFixed(3)}%</td>
                    <td className="px-2.5 py-2 font-mono text-muted-foreground text-[11px]">{(t.avg_21d ?? 0).toFixed(3)}%</td>
                    <td className="px-2.5 py-2 font-mono text-muted-foreground text-[11px]">{(t.avg_90d ?? 0).toFixed(3)}%</td>
                    <td className="px-2.5 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs min-w-[34px]" style={{ color: zColor }}>{zv.toFixed(2)}</span>
                        <div className="w-9 h-0.5 bg-border rounded overflow-hidden">
                          <div className="h-full rounded" style={{ width: `${Math.min(Math.abs(zv)/3*100,100)}%`, background: zColor }} />
                        </div>
                      </div>
                    </td>
                    <td className={`px-2.5 py-2 font-mono text-[10px] ${bps > 5 ? "text-red-400" : bps < -5 ? "text-emerald-400" : "text-muted-foreground"}`}>
                      {bps > 0 ? "+" : ""}{bps.toFixed(0)}
                    </td>
                    <td className="px-2.5 py-2 font-mono text-muted-foreground text-[10px]">{fmtQ(t.last_qtd)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pager */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-card flex-shrink-0 text-xs text-muted-foreground">
          <span>{(page-1)*PER+1}–{Math.min(page*PER, filtered.length)} de {filtered.length}</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1}
              className="px-3 py-1 bg-muted border border-border rounded text-xs disabled:opacity-30 hover:border-sky-400 transition-colors">‹</button>
            <button onClick={() => setPage(p => Math.min(pages, p+1))} disabled={page >= pages}
              className="px-3 py-1 bg-muted border border-border rounded text-xs disabled:opacity-30 hover:border-sky-400 transition-colors">›</button>
          </div>
        </div>
      </div>
    </div>
  );
}
