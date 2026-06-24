import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  FIDC_PORTFOLIOS, PortfolioSummary, FidcPosition, MonthlyReportRow,
} from "@/hooks/useFidcMonitorData";
import { BRL, PCT, formatCNPJ } from "@/lib/fidc/format";
import { cn } from "@/lib/utils";
import { ArrowRight, RotateCcw, AlertTriangle, CheckCircle2 } from "lucide-react";

// Paleta institucional Butiá
const PALETTE = [
  "hsl(217 71% 28%)",   // azul institucional escuro
  "hsl(217 60% 48%)",   // azul médio
  "hsl(199 70% 55%)",   // azul claro
  "hsl(160 45% 42%)",   // verde discreto
  "hsl(38 85% 55%)",    // amarelo/laranja atenção
  "hsl(217 15% 55%)",   // cinza médio
  "hsl(280 35% 48%)",   // roxo discreto
  "hsl(0 70% 50%)",     // vermelho risco
  "hsl(170 30% 38%)",   // teal
  "hsl(30 25% 50%)",    // marrom suave
];
const OTHERS_COLOR = "hsl(217 10% 65%)";

type Grouping =
  | "fidc" | "anbima" | "cotaTipo" | "gestor"
  | "admin" | "rating" | "informe";
type ChartKind = "donut" | "pie" | "bar";
type Metric = "expR" | "pctCart" | "pctExpo";
type TopN = 5 | 10 | 999;

const GROUPING_OPTS: { id: Grouping; label: string }[] = [
  { id: "fidc",     label: "Por FIDC/CNPJ" },
  { id: "anbima",   label: "Por Tipo ANBIMA / Setor" },
  { id: "cotaTipo", label: "Por Tipo de Cota" },
  { id: "gestor",   label: "Por Gestor" },
  { id: "admin",    label: "Por Administrador" },
  { id: "rating",   label: "Por Rating" },
  { id: "informe",  label: "Por Status do Informe" },
];

// Tipo de cota = Classe cadastrada em COTAS/ISIN (fidc_quota_classes.class_name).
// Fallback para nomes internos/CVM e, por último, quota_type bruto.
const classifyCotaTipo = (p: FidcPosition): string => {
  const cls = (p.quota?.class_name || "").trim();
  if (cls) return cls;
  const internal = (p.quota?.internal_quota_name || "").trim();
  if (internal) return internal;
  const cvm = (p.quota?.cvm_quota_name || "").trim();
  if (cvm) return cvm;
  const qt = (p.quota?.quota_type || "").trim();
  if (qt) return qt;
  return "Não cadastrado";
};

const informeStatus = (report: MonthlyReportRow | null): { label: string; tone: "ok" | "warn" | "crit" | "muted" } => {
  if (!report) return { label: "Pendente", tone: "muted" };
  const subStatus = (report.subordinated_calculation_status ?? "").toLowerCase();
  const qStatus = (report.quota_validation_status ?? "").toLowerCase();
  if (subStatus === "inconsistent" || qStatus === "inconsistent") return { label: "Inválido", tone: "crit" };
  const dc = Number(report.credit_rights_value ?? 0);
  const pdd = Math.abs(Number(report.pdd_value ?? 0));
  const overdue = Number(report.overdue_value ?? 0);
  if (dc > 0 && (pdd / dc > 0.05 || overdue / dc > 0.1)) return { label: "Com alerta", tone: "warn" };
  if (subStatus === "partial" || qStatus === "partial") return { label: "Parcial", tone: "warn" };
  return { label: "Completo", tone: "ok" };
};

const ratingOf = (p: FidcPosition): string => {
  const r = (p.quota?.current_rating || "").trim();
  if (r) return r;
  return "Sem rating";
};

// Setor / Tipo ANBIMA vindo do Cadastro Mestre (fidcs).
// Prioriza o campo "setor" do mestre — não inventar a partir de strategy/fidc_type.
const anbimaOf = (p: FidcPosition): string => {
  const f = p.fidc;
  const s = (f?.sector || "").trim();
  if (s) return s;
  const t = (f?.fidc_type || "").trim();
  if (t) return t;
  return "Não classificado";
};

type Bucket = {
  key: string;
  label: string;
  value: number;
  positionsCount: number;
  fidcIds: Set<string>;
  topFidc?: { id: string; name: string; value: number };
  meta?: Record<string, any>;
};

interface Props {
  portfolioSummaries: PortfolioSummary[];
  latestReportFor: (fidcId: string) => MonthlyReportRow | null;
}

export function CompositionSection({ portfolioSummaries, latestReportFor }: Props) {
  const [portfolioId, setPortfolioId] = useState<string>("all");
  const [grouping, setGrouping] = useState<Grouping>("fidc");
  const [chart, setChart] = useState<ChartKind>("donut");
  const [topN, setTopN] = useState<TopN>(10);
  const [metric, setMetric] = useState<Metric>("expR");
  const [showOthers, setShowOthers] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const resetFilters = () => {
    setPortfolioId("all"); setGrouping("fidc"); setChart("donut");
    setTopN(10); setMetric("expR"); setShowOthers(true); setSelectedKey(null);
  };

  // Universo filtrado por carteira
  const selectedSummaries = useMemo(() => {
    if (portfolioId === "all") return portfolioSummaries;
    return portfolioSummaries.filter((s) => s.portfolio.id === portfolioId);
  }, [portfolioSummaries, portfolioId]);

  const allPositions: FidcPosition[] = useMemo(
    () => selectedSummaries.flatMap((s) => s.positions),
    [selectedSummaries],
  );

  const navTotal = selectedSummaries.reduce((a, s) => a + s.nav, 0);
  const exposureTotal = allPositions.reduce((a, p) => a + p.value, 0);

  // Quantas cotas existem por fidc (para classificar "Única")
  const quotasPerFidc = useMemo(() => {
    const m = new Map<string, Set<string>>();
    portfolioSummaries.forEach((s) =>
      s.positions.forEach((p) => {
        if (!p.fidcId || !p.quotaId) return;
        if (!m.has(p.fidcId)) m.set(p.fidcId, new Set());
        m.get(p.fidcId)!.add(p.quotaId);
      }),
    );
    return m;
  }, [portfolioSummaries]);

  // Agrupamento
  const buckets: Bucket[] = useMemo(() => {
    const map = new Map<string, Bucket>();
    const add = (key: string, label: string, p: FidcPosition) => {
      if (!map.has(key)) {
        map.set(key, { key, label, value: 0, positionsCount: 0, fidcIds: new Set() });
      }
      const b = map.get(key)!;
      b.value += p.value;
      b.positionsCount += 1;
      if (p.fidcId) b.fidcIds.add(p.fidcId);
      if (p.fidc) {
        const cur = b.topFidc;
        if (!cur || p.value > cur.value) b.topFidc = { id: p.fidc.id, name: p.fidc.name, value: p.value };
      }
    };
    allPositions.forEach((p) => {
      switch (grouping) {
        case "fidc": {
          const k = p.fidcId ?? `unmapped::${p.isin || "—"}`;
          const lbl = p.fidc?.name ?? `ISIN ${p.isin || "—"} (não mapeado)`;
          add(k, lbl, p);
          const b = map.get(k)!;
          b.meta = { cnpj: p.fidc?.cnpj ?? null, fidcId: p.fidcId };
          break;
        }
        case "anbima":   add(anbimaOf(p), anbimaOf(p), p); break;
        case "cotaTipo": {
          const lbl = classifyCotaTipo(p);
          add(lbl, lbl, p);
          break;
        }
        case "gestor":   add(p.fidc?.manager || "Não informado", p.fidc?.manager || "Não informado", p); break;
        case "admin":    add(p.fidc?.administrator || "Não informado", p.fidc?.administrator || "Não informado", p); break;
        case "rating":   add(ratingOf(p), ratingOf(p), p); break;
        case "informe": {
          const st = p.fidcId ? informeStatus(latestReportFor(p.fidcId)) : { label: "Pendente", tone: "muted" as const };
          add(st.label, st.label, p);
          const b = map.get(st.label)!;
          b.meta = { tone: st.tone };
          break;
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [allPositions, grouping, quotasPerFidc, latestReportFor]);

  // Top N + outros
  const displayBuckets: Bucket[] = useMemo(() => {
    if (topN >= 999 || buckets.length <= topN) return buckets;
    const head = buckets.slice(0, topN);
    if (!showOthers) return head;
    const tail = buckets.slice(topN);
    const others: Bucket = {
      key: "__others__",
      label: `Outros (${tail.length})`,
      value: tail.reduce((a, b) => a + b.value, 0),
      positionsCount: tail.reduce((a, b) => a + b.positionsCount, 0),
      fidcIds: new Set(tail.flatMap((b) => Array.from(b.fidcIds))),
    };
    return [...head, others];
  }, [buckets, topN, showOthers]);

  const totalDisplay = displayBuckets.reduce((a, b) => a + b.value, 0);

  const chartData = displayBuckets.map((b, i) => ({
    name: b.label,
    value: b.value,
    pctCart: navTotal > 0 ? b.value / navTotal : 0,
    pctExpo: exposureTotal > 0 ? b.value / exposureTotal : 0,
    nFidcs: b.fidcIds.size,
    color: b.key === "__others__" ? OTHERS_COLOR : PALETTE[i % PALETTE.length],
    key: b.key,
  }));

  const filteredTableRows = selectedKey
    ? displayBuckets.filter((b) => b.key === selectedKey)
    : displayBuckets;

  // Cards de destaque
  const top5Sum = buckets
    .filter((b) => b.key.startsWith("unmapped::") ? false : true)
    .slice(0, 5)
    .reduce((a, b) => a + b.value, 0);

  const fidcBuckets = useMemo(() => {
    // Reagrupa sempre por FIDC para os cards de destaque
    const m = new Map<string, { id: string | null; name: string; cnpj: string | null; value: number; portfolios: Set<string> }>();
    allPositions.forEach((p) => {
      const k = p.fidcId ?? `unmapped::${p.isin}`;
      if (!m.has(k)) m.set(k, {
        id: p.fidcId, name: p.fidc?.name ?? `ISIN ${p.isin || "—"}`,
        cnpj: p.fidc?.cnpj ?? null, value: 0, portfolios: new Set(),
      });
      const v = m.get(k)!;
      v.value += p.value;
      v.portfolios.add(p.portfolioName);
    });
    return Array.from(m.values()).sort((a, b) => b.value - a.value);
  }, [allPositions]);

  const biggestFidc = fidcBuckets[0] ?? null;
  const top5Fidcs = fidcBuckets.slice(0, 5);
  const top5FidcSum = top5Fidcs.reduce((a, b) => a + b.value, 0);

  // Exposição sem informe completo
  const exposureNoReport = allPositions.reduce((a, p) => {
    if (!p.fidcId) return a;
    const st = informeStatus(latestReportFor(p.fidcId));
    return st.tone !== "ok" ? a + p.value : a;
  }, 0);
  const fidcsNoReport = new Set(
    allPositions
      .filter((p) => p.fidcId && informeStatus(latestReportFor(p.fidcId)).tone !== "ok")
      .map((p) => p.fidcId!),
  ).size;

  // Diversificação — Nº de FIDCs conta CNPJs únicos (não ISINs).
  // Posições sem CNPJ no mestre são contadas em "sem cadastro" e expostas na validação.
  const div = {
    fidcs: new Set(
      allPositions.map((p) => (p.fidc?.cnpj || "").replace(/\D/g, "")).filter((c) => c.length > 0),
    ).size,
    gestores: new Set(allPositions.map((p) => p.fidc?.manager).filter(Boolean)).size,
    admins: new Set(allPositions.map((p) => p.fidc?.administrator).filter(Boolean)).size,
    setores: new Set(allPositions.map((p) => p.fidc?.sector).filter(Boolean)).size,
  };

  // ===== Validação dos dados exibidos =====
  type Check = { id: string; ok: boolean; label: string; detail?: string };
  const validation: Check[] = useMemo(() => {
    const checks: Check[] = [];
    const unmapped = allPositions.filter((p) => !p.fidc);
    checks.push({
      id: "isin-mapeado",
      ok: unmapped.length === 0,
      label: "Todos os ISINs em carteira estão mapeados em COTAS/ISIN",
      detail: unmapped.length === 0
        ? `${allPositions.length} posições conferidas.`
        : `${unmapped.length} posição(ões) sem cota cadastrada: ${
            Array.from(new Set(unmapped.map((p) => p.isin || "—"))).slice(0, 5).join(", ")
          }${unmapped.length > 5 ? " …" : ""}`,
    });

    const cnpjMissing = allPositions.filter((p) => p.fidc && !(p.fidc.cnpj || "").trim());
    checks.push({
      id: "cnpj",
      ok: cnpjMissing.length === 0,
      label: "Todos os FIDCs em carteira têm CNPJ no Cadastro Mestre",
      detail: cnpjMissing.length === 0
        ? `${div.fidcs} CNPJ(s) distinto(s) usados na contagem de diversificação.`
        : `${cnpjMissing.length} posição(ões) com FIDC sem CNPJ: ${
            Array.from(new Set(cnpjMissing.map((p) => p.fidc?.name || "—"))).slice(0, 5).join(", ")
          }`,
    });

    const classMissing = allPositions.filter((p) => p.fidc && !(p.quota?.class_name || "").trim());
    checks.push({
      id: "classe",
      ok: classMissing.length === 0,
      label: "Todas as cotas têm Classe preenchida em COTAS/ISIN",
      detail: classMissing.length === 0
        ? "Classificação por Tipo de Cota usa o campo Classe."
        : `${classMissing.length} cota(s) sem Classe: ${
            Array.from(new Set(classMissing.map((p) => `${p.fidc?.name} · ${p.isin}`))).slice(0, 4).join(" | ")
          }`,
    });

    const sectorMissing = allPositions.filter((p) => p.fidc && !(p.fidc.sector || "").trim());
    checks.push({
      id: "setor",
      ok: sectorMissing.length === 0,
      label: "Todos os FIDCs têm Setor no Cadastro Mestre",
      detail: sectorMissing.length === 0
        ? "Agrupamento por Tipo ANBIMA / Setor usa o campo Setor do mestre."
        : `${sectorMissing.length} posição(ões) sem setor: ${
            Array.from(new Set(sectorMissing.map((p) => p.fidc?.name || "—"))).slice(0, 5).join(", ")
          }`,
    });

    const cnpjsPorIsin = new Map<string, Set<string>>();
    allPositions.forEach((p) => {
      const isin = p.isin || "";
      const cnpj = (p.fidc?.cnpj || "").replace(/\D/g, "");
      if (!isin || !cnpj) return;
      if (!cnpjsPorIsin.has(isin)) cnpjsPorIsin.set(isin, new Set());
      cnpjsPorIsin.get(isin)!.add(cnpj);
    });
    const isinAmbiguos = Array.from(cnpjsPorIsin.entries()).filter(([, s]) => s.size > 1);
    checks.push({
      id: "isin-unico-cnpj",
      ok: isinAmbiguos.length === 0,
      label: "Cada ISIN aponta para um único CNPJ de FIDC",
      detail: isinAmbiguos.length === 0
        ? "Sem ISIN duplicado entre FIDCs diferentes."
        : `${isinAmbiguos.length} ISIN(s) ambíguo(s): ${isinAmbiguos.slice(0, 3).map(([i]) => i).join(", ")}`,
    });

    return checks;
  }, [allPositions, div.fidcs]);

  const validationOkCount = validation.filter((c) => c.ok).length;


  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Composição da exposição em FIDCs
        </div>
        <button
          onClick={resetFilters}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" /> Limpar filtros
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border p-3 flex flex-wrap gap-2 items-end mb-3">
        <FilterSelect label="Carteira" value={portfolioId} onChange={setPortfolioId}
          options={[{ v: "all", l: "Todas" }, ...FIDC_PORTFOLIOS.map((p) => ({ v: p.id, l: p.name }))]} />
        <FilterSelect label="Agrupamento" value={grouping} onChange={(v) => { setGrouping(v as Grouping); setSelectedKey(null); }}
          options={GROUPING_OPTS.map((o) => ({ v: o.id, l: o.label }))} />
        <FilterSelect label="Visualização" value={chart} onChange={(v) => setChart(v as ChartKind)}
          options={[{ v: "donut", l: "Donut" }, { v: "pie", l: "Pizza" }, { v: "bar", l: "Barra horizontal" }]} />
        <FilterSelect label="Top N" value={String(topN)} onChange={(v) => setTopN(Number(v) as TopN)}
          options={[{ v: "5", l: "Top 5" }, { v: "10", l: "Top 10" }, { v: "999", l: "Todos" }]} />
        <FilterSelect label="Métrica" value={metric} onChange={(v) => setMetric(v as Metric)}
          options={[{ v: "expR", l: "Exposição R$" }, { v: "pctCart", l: "% da carteira" }, { v: "pctExpo", l: "% da exposição em FIDCs" }]} />
        <label className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground ml-auto cursor-pointer">
          <input type="checkbox" className="h-3 w-3" checked={showOthers} onChange={(e) => setShowOthers(e.target.checked)} />
          Mostrar "Outros" como grupo agregado
        </label>
      </div>

      {/* Grid: gráfico | tabela | ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Bloco 1 */}
        <div className="lg:col-span-5 bg-card border border-border p-4">
          <div className="text-[11.5px] text-muted-foreground mb-2">
            Gráfico — {GROUPING_OPTS.find((g) => g.id === grouping)?.label}
            {selectedKey && (
              <button onClick={() => setSelectedKey(null)} className="ml-2 text-primary hover:underline">
                limpar seleção
              </button>
            )}
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              {chart === "bar" ? (
                <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                  <CartesianGrid horizontal={false} strokeOpacity={0.15} />
                  <XAxis type="number" tickFormatter={(v) => BRL(v, { compact: true })} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
                  <RTooltip content={<CustomTooltip metric={metric} grouping={grouping} />} />
                  <Bar dataKey="value" onClick={(d: any) => setSelectedKey(d.key)}>
                    {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              ) : (
                <PieChart>
                  <RTooltip content={<CustomTooltip metric={metric} grouping={grouping} />} />
                  <Pie
                    data={chartData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%"
                    innerRadius={chart === "donut" ? 60 : 0}
                    outerRadius={100}
                    paddingAngle={1}
                    onClick={(d: any) => setSelectedKey(d.key)}
                  >
                    {chartData.map((d, i) => <Cell key={i} fill={d.color} stroke="hsl(var(--background))" />)}
                  </Pie>
                  <Legend
                    verticalAlign="bottom" height={36}
                    wrapperStyle={{ fontSize: 10 }}
                    formatter={(value, e: any) => {
                      const name = e?.payload?.name ?? value;
                      const item = chartData.find((d) => d.name === name);
                      if (!item) return String(name);
                      return `${item.name} · ${PCT(item.value / (totalDisplay || 1), 1)}`;
                    }}
                  />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            Exposição total exibida: <span className="text-foreground num">{BRL(totalDisplay, { compact: true })}</span>
            {" · "}PL base: <span className="text-foreground num">{BRL(navTotal, { compact: true })}</span>
          </div>
        </div>

        {/* Bloco 2 — tabela */}
        <div className="lg:col-span-4 bg-card border border-border overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-surface-2 text-muted-foreground">
              <tr className="hairline-b">
                <th className="text-left font-medium px-2 py-1.5">Grupo</th>
                <th className="text-right font-medium px-2 py-1.5">Exposição</th>
                <th className="text-right font-medium px-2 py-1.5">% cart.</th>
                <th className="text-right font-medium px-2 py-1.5">% FIDCs</th>
                <th className="text-right font-medium px-2 py-1.5">Nº FIDCs</th>
                <th className="text-right font-medium px-2 py-1.5">Posições</th>
              </tr>
            </thead>
            <tbody>
              {filteredTableRows.map((b, i) => {
                const color = b.key === "__others__" ? OTHERS_COLOR : PALETTE[i % PALETTE.length];
                const pctCart = navTotal > 0 ? b.value / navTotal : 0;
                const pctExpo = exposureTotal > 0 ? b.value / exposureTotal : 0;
                return (
                  <tr key={b.key} className="hairline-b hover:bg-surface-2/40">
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-sm" style={{ background: color }} />
                        {grouping === "fidc" && b.meta?.fidcId ? (
                          <Link to={`/fidc-monitor/fidcs/${b.meta.fidcId}`} className="hover:underline text-foreground">
                            {b.label}
                          </Link>
                        ) : (
                          <span>{b.label}</span>
                        )}
                      </div>
                      {grouping === "fidc" && b.meta?.cnpj && (
                        <div className="text-[10px] text-muted-foreground ml-3.5">{formatCNPJ(b.meta.cnpj)}</div>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right num">{BRL(b.value, { compact: true })}</td>
                    <td className="px-2 py-1.5 text-right num">{PCT(pctCart)}</td>
                    <td className="px-2 py-1.5 text-right num">{PCT(pctExpo)}</td>
                    <td className="px-2 py-1.5 text-right num">{b.fidcIds.size || "—"}</td>
                    <td className="px-2 py-1.5 text-right num">{b.positionsCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bloco 3 — ranking */}
        <div className="lg:col-span-3 bg-card border border-border p-3">
          <div className="text-[11.5px] text-muted-foreground mb-2">Ranking</div>
          <ol className="space-y-1.5">
            {displayBuckets.slice(0, 10).map((b, i) => {
              const pct = exposureTotal > 0 ? b.value / exposureTotal : 0;
              return (
                <li key={b.key} className="flex items-baseline gap-2 text-[12px]">
                  <span className="text-muted-foreground w-5 text-right num">{i + 1}.</span>
                  <span className="flex-1 truncate" title={b.label}>{b.label}</span>
                  <span className="num text-foreground">{BRL(b.value, { compact: true })}</span>
                  <span className="num text-muted-foreground w-12 text-right">{PCT(pct, 1)}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* Cards de destaque */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
        <SpotCard
          title="Top 5 FIDCs"
          primary={BRL(top5FidcSum, { compact: true })}
          subRows={[
            { label: "% da exposição em FIDCs", value: PCT(exposureTotal > 0 ? top5FidcSum / exposureTotal : 0) },
            { label: "% do PL total", value: PCT(navTotal > 0 ? top5FidcSum / navTotal : 0) },
          ]}
        />
        <SpotCard
          title="Maior FIDC"
          primary={biggestFidc ? biggestFidc.name : "—"}
          subRows={
            biggestFidc
              ? [
                  { label: "CNPJ", value: biggestFidc.cnpj ? formatCNPJ(biggestFidc.cnpj) : "—" },
                  { label: "Exposição", value: BRL(biggestFidc.value, { compact: true }) },
                  { label: "% da carteira", value: PCT(navTotal > 0 ? biggestFidc.value / navTotal : 0) },
                  { label: "Carteira", value: Array.from(biggestFidc.portfolios).join(", ") || "—" },
                ]
              : []
          }
          link={biggestFidc?.id ? `/fidc-monitor/fidcs/${biggestFidc.id}` : undefined}
        />
        <SpotCard
          title="Exposição sem informe completo"
          primary={BRL(exposureNoReport, { compact: true })}
          tone={exposureNoReport > 0 ? "warn" : "ok"}
          subRows={[
            { label: "% da exposição em FIDCs", value: PCT(exposureTotal > 0 ? exposureNoReport / exposureTotal : 0) },
            { label: "FIDCs pendentes/parciais", value: String(fidcsNoReport) },
          ]}
        />
        <SpotCard
          title="Diversificação"
          primary={`${div.fidcs} FIDCs`}
          subRows={[
            { label: "Contagem por", value: "CNPJ único" },
            { label: "Gestores", value: String(div.gestores) },
            { label: "Administradores", value: String(div.admins) },
            { label: "Setores (mestre)", value: String(div.setores) },
          ]}
        />
      </div>

      {/* Validação dos dados — checagens contra Cadastro Mestre / COTAS-ISIN */}
      <div className="mt-3 bg-card border border-border p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Validação dos dados — Cadastro Mestre & COTAS/ISIN
          </div>
          <div className={cn(
            "text-[11px] num",
            validationOkCount === validation.length ? "text-risk-normal" : "text-risk-warning",
          )}>
            {validationOkCount}/{validation.length} checagens OK
          </div>
        </div>
        <ul className="space-y-1.5">
          {validation.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-[12px]">
              {c.ok
                ? <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-risk-normal shrink-0" />
                : <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-risk-warning shrink-0" />}
              <div className="flex-1">
                <div className="text-foreground">{c.label}</div>
                {c.detail && <div className="text-[11px] text-muted-foreground">{c.detail}</div>}
              </div>
            </li>
          ))}
        </ul>
      </div>


      {/* Composição por carteira */}
      <div className="mt-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
          Composição por carteira — {GROUPING_OPTS.find((g) => g.id === grouping)?.label}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {portfolioSummaries.map((s) => (
            <PortfolioCompositionCard
              key={s.portfolio.id}
              summary={s}
              grouping={grouping}
              quotasPerFidc={quotasPerFidc}
              latestReportFor={latestReportFor}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FilterSelect<T extends string>({ label, value, onChange, options }:
  { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-background border border-border rounded-sm px-2 py-1 text-[12px] min-w-[140px] focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

function CustomTooltip({ active, payload, metric, grouping }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-sm border border-border bg-background px-2.5 py-1.5 text-[11.5px] shadow-md">
      <div className="font-medium text-foreground mb-1">{d.name}</div>
      <div className="flex justify-between gap-4"><span className="text-muted-foreground">Exposição</span><span className="num">{BRL(d.value, { compact: true })}</span></div>
      <div className="flex justify-between gap-4"><span className="text-muted-foreground">% da carteira</span><span className="num">{PCT(d.pctCart)}</span></div>
      <div className="flex justify-between gap-4"><span className="text-muted-foreground">% da exposição em FIDCs</span><span className="num">{PCT(d.pctExpo)}</span></div>
      {grouping !== "fidc" && (
        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Nº FIDCs</span><span className="num">{d.nFidcs}</span></div>
      )}
    </div>
  );
}

function SpotCard({ title, primary, subRows = [], tone, link }: {
  title: string; primary: string;
  subRows?: { label: string; value: string }[];
  tone?: "ok" | "warn" | "crit";
  link?: string;
}) {
  return (
    <div className="bg-card border border-border p-3">
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground mb-1">{title}</div>
      <div className={cn("text-[15px] font-semibold truncate",
        tone === "warn" && "text-risk-warning",
        tone === "crit" && "text-risk-critical",
      )}>
        {primary}
      </div>
      <div className="mt-1.5 space-y-0.5 text-[11.5px]">
        {subRows.map((r, i) => (
          <div key={i} className="flex justify-between gap-2">
            <span className="text-muted-foreground truncate">{r.label}</span>
            <span className="text-foreground num truncate">{r.value}</span>
          </div>
        ))}
      </div>
      {link && (
        <Link to={link} className="mt-2 inline-flex items-center gap-1 text-primary hover:underline text-[11px]">
          Abrir FIDC <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function PortfolioCompositionCard({ summary, grouping, quotasPerFidc, latestReportFor }: {
  summary: PortfolioSummary;
  grouping: Grouping;
  quotasPerFidc: Map<string, Set<string>>;
  latestReportFor: (fidcId: string) => MonthlyReportRow | null;
}) {
  const positions = summary.positions;
  const map = new Map<string, { label: string; value: number; fidcId?: string | null }>();
  const add = (k: string, label: string, v: number, fidcId?: string | null) => {
    if (!map.has(k)) map.set(k, { label, value: 0, fidcId });
    map.get(k)!.value += v;
  };
  positions.forEach((p) => {
    switch (grouping) {
      case "fidc": {
        const k = p.fidcId ?? `u::${p.isin}`;
        add(k, p.fidc?.name ?? `ISIN ${p.isin || "—"}`, p.value, p.fidcId);
        break;
      }
      case "anbima":   add(anbimaOf(p), anbimaOf(p), p.value); break;
      case "cotaTipo": {
        const lbl = classifyCotaTipo(p);
        add(lbl, lbl, p.value); break;
      }
      case "gestor":   add(p.fidc?.manager || "Não informado", p.fidc?.manager || "Não informado", p.value); break;
      case "admin":    add(p.fidc?.administrator || "Não informado", p.fidc?.administrator || "Não informado", p.value); break;
      case "rating":   add(ratingOf(p), ratingOf(p), p.value); break;
      case "informe": {
        const st = p.fidcId ? informeStatus(latestReportFor(p.fidcId)) : { label: "Pendente" };
        add(st.label, st.label, p.value); break;
      }
    }
  });
  const data = Array.from(map.values()).sort((a, b) => b.value - a.value);
  const total = data.reduce((a, b) => a + b.value, 0);
  const chartData = data.slice(0, 6).map((d, i) => ({
    name: d.label, value: d.value, color: PALETTE[i % PALETTE.length],
  }));
  if (data.length > 6) {
    const rest = data.slice(6).reduce((a, b) => a + b.value, 0);
    chartData.push({ name: "Outros", value: rest, color: OTHERS_COLOR });
  }
  const top3 = data.slice(0, 3);

  return (
    <div className="bg-card border border-border p-3">
      <div className="flex items-baseline justify-between mb-1">
        <div className="font-medium text-[13px]">{summary.portfolio.name}</div>
        <div className="text-[10px] text-muted-foreground">{summary.portfolio.description}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11.5px] mb-2">
        <div>
          <div className="text-muted-foreground text-[10px]">Exposição em FIDCs</div>
          <div className="num font-medium">{BRL(summary.exposure, { compact: true })}</div>
        </div>
        <div className="text-right">
          <div className="text-muted-foreground text-[10px]">% da carteira</div>
          <div className="num font-medium">{summary.nav > 0 ? PCT(summary.pct) : "—"}</div>
        </div>
      </div>
      <div className="h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <RTooltip
              formatter={(v: any) => [BRL(Number(v), { compact: true }), ""]}
              contentStyle={{ fontSize: 11, background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
            />
            <Pie data={chartData} dataKey="value" nameKey="name"
              cx="50%" cy="50%" innerRadius={36} outerRadius={60} paddingAngle={1}>
              {chartData.map((d, i) => <Cell key={i} fill={d.color} stroke="hsl(var(--background))" />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ol className="mt-2 space-y-0.5 text-[11.5px]">
        {top3.map((d, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="flex-1 truncate" title={d.label}>{d.label}</span>
            <span className="num text-muted-foreground">{PCT(total > 0 ? d.value / total : 0, 1)}</span>
          </li>
        ))}
      </ol>
      <Link
        to={`/fidc-monitor/monitor?portfolio=${summary.portfolio.id}`}
        className="mt-2 inline-flex items-center gap-1 text-primary hover:underline text-[11px]"
      >
        Abrir Monitor <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
