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
      // Paginate to overcome the default 1000-row limit (trade_metricas has ~1.7k rows)
      const PAGE = 1000;
      type Row = { indexador: string | null; last_val: number | null; z_score: number | null; last_date: string | null };
      const all: Row[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("trade_metricas")
          .select("indexador, last_val, z_score, last_date")
          .in("indexador", ["DI", "IPCA", "PRE", "OUTRO"])
          .range(from, from + PAGE - 1);
        if (error || !data) break;
        all.push(...(data as Row[]));
        if (data.length < PAGE) break;
        from += PAGE;
      }

      if (all.length === 0) { setLoading(false); return; }

      const diRows  = all.filter(r => r.indexador === "DI" || r.indexador === "PRE" || r.indexador === "OUTRO");
      const ipcaRows = all.filter(r => r.indexador === "IPCA");

      const med = (rows: Row[]) => {
        const sorted = rows.map(r => r.last_val ?? 0).sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)] ?? 0;
      };

      setDi({
        count: diRows.length,
        hot: diRows.filter(r => (r.z_score ?? 0) > 1.5).length,
        median: med(diRows),
      });
      setIpca({
        count: ipcaRows.length,
        hot: ipcaRows.filter(r => (r.z_score ?? 0) > 1.5).length,
        median: med(ipcaRows),
      });
      setLastDate(all.find(r => r.last_date)?.last_date ?? "");
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
