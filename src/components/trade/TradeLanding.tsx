// src/components/trade/TradeLanding.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Building2, Percent } from "lucide-react";
import type { TradeMode } from "@/hooks/useTradeData";

interface LandingStat {
  count: number;
  hot: number;
  median: number;
}

interface TradeLandingProps {
  onSelect: (mode: TradeMode) => void;
  /** kept for API compatibility — not used (KPIs come from RPC) */
  diData?: unknown[];
  ipcaData?: unknown[];
}

interface ModeDescriptor {
  mode: TradeMode;
  /** indexador filter passed to get_trade_summary */
  indexador: "DI" | "IPCA";
  /** sub_indexador filter passed to get_trade_summary */
  sub: TradeMode;
  label: string;
  short: string;
  description: string;
  color: string;
  hexBtnText: string;
  Icon: typeof TrendingUp;
  medianSuffix: string;
  medianLabel: string;
}

const MODES: ModeDescriptor[] = [
  {
    mode: "DI_SPREAD",
    indexador: "DI",
    sub: "DI_SPREAD",
    label: "DI+",
    short: "DI + spread",
    description: "Debêntures DI + X%\nScore por taxa indicativa % a.a.",
    color: "text-sky-400",
    hexBtnText: "bg-sky-400",
    Icon: TrendingUp,
    medianSuffix: "%",
    medianLabel: "Mediana",
  },
  {
    mode: "CDI_PCT",
    indexador: "DI",
    sub: "CDI_PCT",
    label: "%CDI",
    short: "% do CDI",
    description: "Debêntures X% do CDI\nScore sobre o percentual do CDI",
    color: "text-cyan-400",
    hexBtnText: "bg-cyan-400",
    Icon: Percent,
    medianSuffix: "%",
    medianLabel: "Med. %CDI",
  },
  {
    mode: "IPCA",
    indexador: "IPCA",
    sub: "IPCA",
    label: "IPCA+",
    short: "IPCA + spread",
    description: "Debêntures IPCA + X%\nScore por spread capitalizado vs NTN-B",
    color: "text-violet-400",
    hexBtnText: "bg-violet-400",
    Icon: Building2,
    medianSuffix: "%",
    medianLabel: "Spread Med.",
  },
];

export function TradeLanding({ onSelect }: TradeLandingProps) {
  const [stats, setStats] = useState<Record<TradeMode, LandingStat>>({
    DI_SPREAD: { count: 0, hot: 0, median: 0 },
    CDI_PCT:   { count: 0, hot: 0, median: 0 },
    IPCA:      { count: 0, hot: 0, median: 0 },
  });
  const [lastDate, setLastDate] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [diSpread, cdiPct, ipca, dateRes] = await Promise.all([
        supabase.rpc("get_trade_summary", { p_indexador: "DI",   p_sub_indexador: "DI_SPREAD" }),
        supabase.rpc("get_trade_summary", { p_indexador: "DI",   p_sub_indexador: "CDI_PCT"   }),
        supabase.rpc("get_trade_summary", { p_indexador: "IPCA", p_sub_indexador: "IPCA"      }),
        supabase
          .from("trade_metricas")
          .select("last_date")
          .order("last_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const toStat = (row: { total_count?: number; hot_count?: number; median_last_val?: number | string | null } | undefined): LandingStat => ({
        count:  row?.total_count ?? 0,
        hot:    row?.hot_count   ?? 0,
        median: Number(row?.median_last_val ?? 0),
      });

      setStats({
        DI_SPREAD: toStat(diSpread.data?.[0]),
        CDI_PCT:   toStat(cdiPct.data?.[0]),
        IPCA:      toStat(ipca.data?.[0]),
      });
      setLastDate(dateRes.data?.last_date ?? "");
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-8 gap-10">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">
          <span className="text-sky-400">BUTIA</span>
          <span className="text-slate-400 mx-2">·</span>
          <span>Trade Monitor</span>
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Selecione o indexador para iniciar a análise
          {lastDate && <span className="font-mono ml-2 text-xs">· {lastDate}</span>}
        </p>
      </div>

      <div className="flex gap-5 flex-wrap justify-center">
        {MODES.map((m) => {
          const s = stats[m.mode];
          const Icon = m.Icon;
          return (
            <button
              key={m.mode}
              onClick={() => onSelect(m.mode)}
              disabled={loading}
              className="w-64 p-7 rounded-2xl border border-border bg-card text-left hover:border-primary hover:shadow-lg transition-all group"
            >
              <Icon className={`w-9 h-9 mb-4 ${m.color}`} />
              <div className={`text-xl font-extrabold mb-1 ${m.color}`}>{m.label}</div>
              <p className="text-xs text-muted-foreground mb-5 leading-relaxed whitespace-pre-line">
                {m.description}
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className={`text-lg font-bold font-mono ${m.color}`}>
                    {loading ? "…" : s.count}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Emissões</div>
                </div>
                <div>
                  <div className="text-lg font-bold font-mono text-orange-400">
                    {loading ? "…" : s.hot}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Z &gt; 1.5</div>
                </div>
                <div>
                  <div className={`text-lg font-bold font-mono ${m.color}`}>
                    {loading ? "…" : `${s.median.toFixed(2)}${m.medianSuffix}`}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{m.medianLabel}</div>
                </div>
              </div>
              <div className={`mt-5 w-full py-2 rounded-lg ${m.hexBtnText} text-slate-900 text-xs font-bold text-center group-hover:brightness-110 transition-all`}>
                Abrir {m.label} →
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
