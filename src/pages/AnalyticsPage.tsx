import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Download } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import * as XLSX from "xlsx";
import { resolveRatingsBatch, ratingKey } from "@/lib/ratings/resolveRatingsBatch";
import { resolvePositionRating } from "@/lib/ratings/resolvePositionRating";

const CHART_COLORS = ["#1B3864", "#2E5C99", "#4A80C9", "#7BAAD9", "#B6D0EA", "#F1B233", "#E07A5F", "#8FBC8F", "#9C89B8"];

function ratingBucket(rating: string | null | undefined): string {
  if (!rating) return "NR";
  const r = rating.toUpperCase();
  if (r.startsWith("AAA")) return "AAA";
  if (r.startsWith("AA")) return "AA";
  if (r.startsWith("A")) return "A";
  if (r.startsWith("BBB")) return "BBB";
  if (r.startsWith("BB")) return "BB";
  if (r.startsWith("B")) return "B";
  if (r.startsWith("CCC") || r.startsWith("CC") || r.startsWith("C") || r.startsWith("D")) return "≤CCC";
  return "Outros";
}

interface Position {
  isin: string;
  ticker: string | null;
  amount: number;
  financial_price: number;
  fundo: string;
  cnpj: string | null;
  rating: string | null;
  bucket: string;
  value: number;
}

interface EmissionRow { id: string; isin: string | null; rating_value: string | null; rating_date: string | null; }
interface IssuerRow { id: string; cnpj: string; rating_value: string | null; rating_date: string | null; }

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState<Position[]>([]);
  const [emissions, setEmissions] = useState<EmissionRow[]>([]);
  const [issuers, setIssuers] = useState<IssuerRow[]>([]);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [selectedBuckets, setSelectedBuckets] = useState<Set<string>>(new Set());

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    try {
      // 1) posicoes (última val_date)
      const { data: valDates } = await supabase.rpc("get_posicoes_val_dates");
      const lastValDate = (valDates as any)?.[0]?.val_date_text ?? null;

      let posRows: any[] = [];
      if (lastValDate) {
        const { data } = await supabase
          .from("posicoes")
          .select("isin, amount, financial_price, trading_desk_share_source")
          .eq("val_date", lastValDate)
          .gt("financial_price", 0);
        posRows = data ?? [];
      }

      // 2) emissoes p/ mapear isin → cnpj_emissor + ticker
      const isins = Array.from(new Set(posRows.map(r => r.isin).filter(Boolean)));
      let emissoesMap = new Map<string, { cnpj: string | null; ticker: string | null }>();
      if (isins.length) {
        const { data: em } = await supabase.from("emissoes").select("isin, ticker, cnpj_emissor").in("isin", isins);
        for (const e of (em ?? [])) {
          emissoesMap.set(e.isin, {
            cnpj: (e.cnpj_emissor ?? "").replace(/[^0-9]/g, "") || null,
            ticker: e.ticker ?? null,
          });
        }
      }

      // 3) resolve ratings em batch (v1 - reaproveita)
      const items = posRows.map(r => {
        const meta = emissoesMap.get(r.isin) ?? { cnpj: null, ticker: null };
        return { cnpj: meta.cnpj, ticker: meta.ticker };
      });
      const rmap = await resolveRatingsBatch(items);

      const enriched: Position[] = posRows.map(r => {
        const meta = emissoesMap.get(r.isin) ?? { cnpj: null, ticker: null };
        const key = ratingKey(meta.cnpj, meta.ticker);
        const rating = rmap.get(key)?.rating ?? null;
        const value = Number(r.amount ?? 0) * Number(r.financial_price ?? 0);
        return {
          isin: r.isin,
          ticker: meta.ticker,
          amount: Number(r.amount ?? 0),
          financial_price: Number(r.financial_price ?? 0),
          fundo: r.trading_desk_share_source ?? "—",
          cnpj: meta.cnpj,
          rating,
          bucket: ratingBucket(rating),
          value,
        };
      });
      setPositions(enriched);

      // 4) histórico de ratings emissão e emissor (últimos 500 cada)
      const [emsRes, issRes] = await Promise.all([
        (supabase.from as any)("rating_emission_history").select("id, isin, rating_value, rating_date").order("rating_date", { ascending: false, nullsFirst: false }).limit(1000),
        (supabase.from as any)("rating_issuer_history").select("id, cnpj, rating_value, rating_date").order("rating_date", { ascending: false, nullsFirst: false }).limit(1000),
      ]);
      setEmissions(emsRes.data ?? []);
      setIssuers(issRes.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  // Filtros globais aplicáveis a posições (por rating bucket) e a histórico (por data)
  const filteredPositions = useMemo(() => {
    return positions.filter(p =>
      selectedBuckets.size === 0 || selectedBuckets.has(p.bucket),
    );
  }, [positions, selectedBuckets]);

  const filteredEmissions = useMemo(() => emissions.filter(e => {
    if (!e.rating_date) return !fromDate && !toDate;
    if (fromDate && e.rating_date < fromDate) return false;
    if (toDate && e.rating_date > toDate) return false;
    return true;
  }), [emissions, fromDate, toDate]);

  const filteredIssuers = useMemo(() => issuers.filter(e => {
    if (!e.rating_date) return !fromDate && !toDate;
    if (fromDate && e.rating_date < fromDate) return false;
    if (toDate && e.rating_date > toDate) return false;
    return true;
  }), [issuers, fromDate, toDate]);

  // ===== Aggregations =====
  const ratingDist = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of filteredPositions) map.set(p.bucket, (map.get(p.bucket) ?? 0) + p.value);
    return Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredPositions]);

  const fundExposure = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of filteredPositions) map.set(p.fundo, (map.get(p.fundo) ?? 0) + p.value);
    return Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 15);
  }, [filteredPositions]);

  const emissionsByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of filteredEmissions) {
      const m = (e.rating_date ?? "").slice(0, 7);
      if (m) map.set(m, (map.get(m) ?? 0) + 1);
    }
    return Array.from(map, ([m, c]) => ({ mes: m, count: c })).sort((a, b) => a.mes.localeCompare(b.mes));
  }, [filteredEmissions]);

  const issuersByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of filteredIssuers) {
      const m = (e.rating_date ?? "").slice(0, 7);
      if (m) map.set(m, (map.get(m) ?? 0) + 1);
    }
    return Array.from(map, ([m, c]) => ({ mes: m, count: c })).sort((a, b) => a.mes.localeCompare(b.mes));
  }, [filteredIssuers]);

  const complianceRows = useMemo(() => {
    // “compliance” = posições sem rating ou em ≤CCC
    return filteredPositions.filter(p => p.bucket === "NR" || p.bucket === "≤CCC" || p.bucket === "B");
  }, [filteredPositions]);

  const totalValue = filteredPositions.reduce((s, p) => s + p.value, 0);
  const nrPct = totalValue > 0 ? filteredPositions.filter(p => p.bucket === "NR").reduce((s, p) => s + p.value, 0) / totalValue : 0;

  function toggleBucket(b: string) {
    const next = new Set(selectedBuckets);
    if (next.has(b)) next.delete(b); else next.add(b);
    setSelectedBuckets(next);
  }

  function exportXlsx() {
    const wb = XLSX.utils.book_new();

    // resumo executivo
    const resumo = [
      ["Métrica", "Valor"],
      ["Posições (filtradas)", filteredPositions.length],
      ["Valor total (R$)", totalValue],
      ["% Sem rating (NR)", (nrPct * 100).toFixed(2) + "%"],
      ["Histórico de emissões", filteredEmissions.length],
      ["Histórico de emissores", filteredIssuers.length],
      ["Filtro data inicial", fromDate || "—"],
      ["Filtro data final", toDate || "—"],
      ["Filtro buckets", selectedBuckets.size ? Array.from(selectedBuckets).join(", ") : "—"],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), "Resumo");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ratingDist), "Ratings");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filteredPositions), "Posicoes");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filteredEmissions), "Emissoes_Historico");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filteredIssuers), "Emissores_Historico");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(complianceRows), "Compliance");

    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `analytics_${stamp}.xlsx`);
  }

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin inline" /> Carregando analytics…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-sm text-muted-foreground">Dashboards consolidados sobre ratings, posições e compliance.</p>
        </div>
        <Button onClick={exportXlsx}><Download className="h-4 w-4 mr-1" /> Exportar XLSX</Button>
      </div>

      {/* Filtros globais */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Data inicial (histórico)</Label>
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <Label>Data final (histórico)</Label>
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Buckets de rating</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {["AAA","AA","A","BBB","BB","B","≤CCC","NR"].map(b => (
                <button
                  key={b}
                  onClick={() => toggleBucket(b)}
                  className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                    selectedBuckets.has(b)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >{b}</button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Posições</div><div className="text-2xl font-semibold">{filteredPositions.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Valor total</div><div className="text-2xl font-semibold">{totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">% Sem rating (NR)</div><div className="text-2xl font-semibold">{(nrPct * 100).toFixed(1)}%</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Ratings no histórico</div><div className="text-2xl font-semibold">{filteredEmissions.length + filteredIssuers.length}</div></Card>
      </div>

      <Tabs defaultValue="ratings">
        <TabsList>
          <TabsTrigger value="ratings">Ratings</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="emissoes">Emissões</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="ratings" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="text-sm font-medium mb-2">Distribuição por bucket (valor)</div>
              <div className="h-72">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={ratingDist} dataKey="value" nameKey="name" outerRadius={100} label={(d) => d.name}>
                      {ratingDist.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-medium mb-2">Alterações de rating por mês (emissões)</div>
              <div className="h-72">
                <ResponsiveContainer>
                  <LineChart data={emissionsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="mes" fontSize={11} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke={CHART_COLORS[0]} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="positions" className="space-y-4">
          <Card className="p-4">
            <div className="text-sm font-medium mb-2">Top 15 fundos por exposição</div>
            <div className="h-96">
              <ResponsiveContainer>
                <BarChart data={fundExposure} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" fontSize={11} tickFormatter={(v) => (v / 1_000_000).toFixed(1) + "M"} />
                  <YAxis type="category" dataKey="name" fontSize={11} width={100} />
                  <Tooltip formatter={(v: any) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} />
                  <Bar dataKey="value" fill={CHART_COLORS[1]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="emissoes" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="text-sm font-medium mb-2">Ratings de emissão por mês</div>
              <div className="h-72">
                <ResponsiveContainer>
                  <BarChart data={emissionsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="mes" fontSize={11} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill={CHART_COLORS[2]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-medium mb-2">Ratings de emissor por mês</div>
              <div className="h-72">
                <ResponsiveContainer>
                  <LineChart data={issuersByMonth}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="mes" fontSize={11} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="count" stroke={CHART_COLORS[4]} strokeWidth={2} name="Emissores" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b text-sm font-medium">Posições em atenção (NR / B / ≤CCC)</div>
            {complianceRows.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma posição em atenção.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">Fundo</th>
                    <th className="px-4 py-2 text-left">ISIN</th>
                    <th className="px-4 py-2 text-left">Ticker</th>
                    <th className="px-4 py-2 text-left">Rating</th>
                    <th className="px-4 py-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {complianceRows.slice(0, 200).map((p, i) => (
                    <tr key={i} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-2">{p.fundo}</td>
                      <td className="px-4 py-2 text-xs"><code>{p.isin}</code></td>
                      <td className="px-4 py-2 text-xs">{p.ticker ?? "—"}</td>
                      <td className="px-4 py-2 text-xs">{p.rating ?? "NR"} <span className="text-muted-foreground">({p.bucket})</span></td>
                      <td className="px-4 py-2 text-right">{p.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
