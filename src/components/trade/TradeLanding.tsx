// src/components/trade/TradeLanding.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Building2 } from "lucide-react";

interface LandingStat {
  count: number;
  hot: number;
  median: number;
}

interface TradeLandingProps {
  onSelect: (mode: "DI" | "IPCA") => void;
  diData: unknown[];
  ipcaData: unknown[];
}

export function TradeLanding({ onSelect }: TradeLandingProps) {
  const [di, setDi] = useState<LandingStat>({ count: 0, hot: 0, median: 0 });
  const [ipca, setIpca] = useState<LandingStat>({ count: 0, hot: 0, median: 0 });
  const [lastDate, setLastDate] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Use server-side aggregation via RPC so paginated row limits don't skew medians.
      const [diRes, ipcaRes, dateRes] = await Promise.all([
        supabase.rpc("get_trade_summary", { p_indexador: "DI" }),
        supabase.rpc("get_trade_summary", { p_indexador: "IPCA" }),
        supabase
          .from("trade_metricas")
          .select("last_date")
          .order("last_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const di0 = diRes.data?.[0];
      const ipca0 = ipcaRes.data?.[0];

      setDi({
        count: di0?.total_count ?? 0,
        hot: di0?.hot_count ?? 0,
        median: Number(di0?.median_last_val ?? 0),
      });
      setIpca({
        count: ipca0?.total_count ?? 0,
        hot: ipca0?.hot_count ?? 0,
        median: Number(ipca0?.median_last_val ?? 0),
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
        {/* DI Card */}
        <button
          onClick={() => onSelect("DI")}
          disabled={loading}
          className="w-64 p-7 rounded-2xl border border-border bg-card text-left hover:border-sky-400 hover:shadow-[0_0_30px_rgba(56,189,248,0.12)] transition-all group"
        >
          <TrendingUp className="w-9 h-9 text-sky-400 mb-4" />
          <div className="text-xl font-extrabold text-sky-400 mb-1">DI+</div>
          <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
            Debêntures indexadas ao CDI<br />Score por taxa indicativa % a.a.
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-bold font-mono text-sky-400">{loading ? "…" : di.count}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Emissões</div>
            </div>
            <div>
              <div className="text-lg font-bold font-mono text-orange-400">{loading ? "…" : di.hot}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Z &gt; 1.5</div>
            </div>
            <div>
              <div className="text-lg font-bold font-mono text-sky-400">{loading ? "…" : di.median.toFixed(2)}%</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Mediana</div>
            </div>
          </div>
          <div className="mt-5 w-full py-2 rounded-lg bg-sky-400 text-slate-900 text-xs font-bold text-center group-hover:brightness-110 transition-all">
            Abrir DI →
          </div>
        </button>

        {/* IPCA Card */}
        <button
          onClick={() => onSelect("IPCA")}
          disabled={loading}
          className="w-64 p-7 rounded-2xl border border-border bg-card text-left hover:border-violet-400 hover:shadow-[0_0_30px_rgba(167,139,250,0.12)] transition-all group"
        >
          <Building2 className="w-9 h-9 text-violet-400 mb-4" />
          <div className="text-xl font-extrabold text-violet-400 mb-1">IPCA+</div>
          <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
            Debêntures indexadas ao IPCA<br />Score por spread capitalizado vs NTN-B
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-bold font-mono text-violet-400">{loading ? "…" : ipca.count}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Emissões</div>
            </div>
            <div>
              <div className="text-lg font-bold font-mono text-orange-400">{loading ? "…" : ipca.hot}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Z &gt; 1.5</div>
            </div>
            <div>
              <div className="text-lg font-bold font-mono text-violet-400">{loading ? "…" : ipca.median.toFixed(2)}%</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Spread Med.</div>
            </div>
          </div>
          <div className="mt-5 w-full py-2 rounded-lg bg-violet-400 text-slate-900 text-xs font-bold text-center group-hover:brightness-110 transition-all">
            Abrir IPCA →
          </div>
        </button>
      </div>
    </div>
  );
}
