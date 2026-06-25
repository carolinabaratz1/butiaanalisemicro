import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useFidcMonitorData, FIDC_PORTFOLIOS } from "@/hooks/useFidcMonitorData";
import { BRL, PCT, formatCNPJ } from "@/lib/fidc/format";
import { MetricCard } from "@/components/fidc/MetricCard";
import { PageHeader } from "@/components/fidc/PageHeader";
import { NoDataChip, NoDataInline } from "@/components/fidc/NoDataChip";
import { Search, Loader2, CheckCircle2, AlertTriangle, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CvmImportDialog } from "@/components/fidc/CvmImportDialog";

type PosStatus = "mapped" | "unmapped";

export default function MonitorPage() {
  const [sp, setSp] = useSearchParams();
  const portfolioId = sp.get("portfolio") ?? FIDC_PORTFOLIOS[0].id;
  const q = (sp.get("q") ?? "").toLowerCase();
  const statusFilter = (sp.get("status") ?? "all") as "all" | PosStatus;
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "value", dir: "desc" });
  const [cvmOpen, setCvmOpen] = useState(false);

  const { isLoading, portfolioSummaries, latestValDate, latestReportFor, prevReportFor, reportSourceStatusFor, fidcsWithReportCount } = useFidcMonitorData();
  const summary = portfolioSummaries.find((s) => s.portfolio.id === portfolioId) ?? portfolioSummaries[0];

  const rows = useMemo(() => {
    if (!summary) return [];
    const data = summary.positions.map((p) => {
      const r = p.fidcId ? latestReportFor(p.fidcId) : null;
      const pr = p.fidcId ? prevReportFor(p.fidcId) : null;
      const navNow = Number(r?.nav_value ?? 0);
      const navPrev = Number(pr?.nav_value ?? 0);
      const qNow = Number(r?.quota_value ?? 0);
      const qPrev = Number(pr?.quota_value ?? 0);
      const dc = Number(r?.credit_rights_value ?? 0);
      const overdue = Number(r?.overdue_value ?? 0);
      const pdd = Math.abs(Number(r?.pdd_value ?? 0));
      const cash = Number(r?.cash_value ?? 0);
      const repurchase = Number(r?.repurchase_value ?? 0);
      const subord = Number(r?.subordinated_value ?? 0);
      return {
        ...p,
        posStatus: (p.fidc ? "mapped" : "unmapped") as PosStatus,
        pctPortfolio: summary.nav > 0 ? p.value / summary.nav : 0,
        report: r,
        prevReport: pr,
        navNow,
        varNav: navPrev > 0 ? (navNow - navPrev) / navPrev : null,
        quotaNow: qNow,
        varQuota: qPrev > 0 ? (qNow - qPrev) / qPrev : null,
        atrasoDC: dc > 0 ? overdue / dc : null,
        caixaPL: navNow > 0 ? cash / navNow : null,
        pddAtraso: overdue > 0 ? pdd / overdue : null,
        pddDC: dc > 0 ? pdd / dc : null,
        recompraDC: dc > 0 ? repurchase / dc : null,
        subordPct: navNow > 0 ? subord / navNow : null,
      };
    }).filter((r) => {
      if (statusFilter !== "all" && r.posStatus !== statusFilter) return false;
      if (q) {
        const hay = `${r.fidc?.name ?? ""} ${r.fidc?.cnpj ?? ""} ${r.isin} ${r.quota?.class_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const sorters: Record<string, (r: typeof data[number]) => number | string> = {
      value: (r) => r.value,
      name: (r) => r.fidc?.name ?? "zzz",
      pct: (r) => r.pctPortfolio,
      status: (r) => (r.posStatus === "unmapped" ? 1 : 0),
    };
    const fn = sorters[sort.key] ?? sorters.value;
    return data.sort((a, b) => {
      const va = fn(a), vb = fn(b);
      if (va < vb) return sort.dir === "asc" ? -1 : 1;
      if (va > vb) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [summary, statusFilter, q, sort, latestReportFor, prevReportFor]);

  const reportCoverage = useMemo(() => {
    if (!summary) return { withReport: 0, lastRef: null as string | null };
    const fidcIds = Array.from(new Set(summary.positions.map((p) => p.fidcId).filter(Boolean) as string[]));
    let withReport = 0;
    let lastRef: string | null = null;
    fidcIds.forEach((fid) => {
      const r = latestReportFor(fid);
      if (r) {
        withReport += 1;
        const ref = r.reference_month?.slice(0, 7) ?? null;
        if (ref && (!lastRef || ref > lastRef)) lastRef = ref;
      }
    });
    return { withReport, lastRef };
  }, [summary, latestReportFor]);

  const setParam = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setSp(next, { replace: true });
  };

  function toggleSort(key: string) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  }

  if (isLoading) {
    return (
      <div className="px-6 py-12 text-center text-muted-foreground text-[12px]">
        <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando posições…
      </div>
    );
  }

  if (!summary) {
    return (
      <div>
        <PageHeader title="Monitor de FIDCs" subtitle="Sem dados de posição." />
      </div>
    );
  }

  const unmapped = summary.unmappedCount;

  return (
    <div>
      <PageHeader
        title="Monitor de FIDCs"
        subtitle={`${summary.portfolio.name} · ${summary.portfolio.description}`}
        right={
          <div className="flex items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 bg-muted/40 text-muted-foreground">
              <AlertTriangle className="h-3 w-3" /> Informes mensais: {Math.min(fidcsWithReportCount, summary.fidcCount)}/{summary.fidcCount}
            </span>
            <Button size="sm" variant="outline" onClick={() => setCvmOpen(true)} className="h-7 text-[11px]">
              <Database className="h-3 w-3 mr-1" /> Importar Informes via CVM
            </Button>
          </div>
        }
      />
      <CvmImportDialog open={cvmOpen} onOpenChange={setCvmOpen} />

      <div className="px-6 py-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 hairline-b">
        <MetricCard label="PL da Carteira" value={summary.nav > 0 ? BRL(summary.nav, { compact: true }) : <NoDataInline reason="PL não disponível para a data" />} />
        <MetricCard label="Exposição em FIDCs" value={BRL(summary.exposure, { compact: true })} hint={summary.nav > 0 ? PCT(summary.pct) : ""} />
        <MetricCard label="Total de FIDCs" value={String(summary.fidcCount)} />
        <MetricCard label="ISINs não mapeados" value={String(unmapped)} accent={unmapped > 0 ? "warning" : "normal"} />
        <MetricCard label="FIDCs c/ informe" value={`${reportCoverage.withReport}/${summary.fidcCount}`} accent={reportCoverage.withReport < summary.fidcCount ? "warning" : "normal"} hint={reportCoverage.lastRef ? `Último: ${reportCoverage.lastRef}` : ""} />
        <MetricCard label="Data da posição" value={latestValDate ?? "—"} />
      </div>

      <div className="px-6 py-3 flex flex-wrap items-center gap-2 hairline-b">
        <Select label="Carteira" value={portfolioId} onChange={(v) => setParam({ portfolio: v })}
          options={FIDC_PORTFOLIOS.map((p) => ({ value: p.id, label: p.name }))} />
        <Select label="Mapeamento" value={statusFilter} onChange={(v) => setParam({ status: v })}
          options={[
            { value: "all", label: "Todos" },
            { value: "mapped", label: "ISIN mapeado" },
            { value: "unmapped", label: "ISIN não mapeado" },
          ]} />
        <div className="relative ml-auto">
          <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            defaultValue={q}
            placeholder="Buscar nome, CNPJ ou ISIN"
            onChange={(e) => setParam({ q: e.target.value })}
            className="bg-card border border-border rounded-sm pl-7 pr-3 py-1.5 text-[12px] w-72 outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border-separate border-spacing-0 min-w-[1700px]">
          <thead className="bg-surface-2 text-muted-foreground">
            <tr>
              <Th onClick={() => toggleSort("status")} dir={sort.key === "status" ? sort.dir : undefined}>St</Th>
              <Th onClick={() => toggleSort("name")} dir={sort.key === "name" ? sort.dir : undefined}>FIDC</Th>
              <Th>Status informe</Th>
              <Th>CNPJ</Th>
              <Th>ISIN</Th>
              <Th>Cota / Classe</Th>
              <Th right onClick={() => toggleSort("value")} dir={sort.key === "value" ? sort.dir : undefined}>Exposição</Th>
              <Th right onClick={() => toggleSort("pct")} dir={sort.key === "pct" ? sort.dir : undefined}>% Cart.</Th>
              <Th right>PL FIDC</Th>
              <Th right>Var. PL</Th>
              <Th right>Cota</Th>
              <Th right>Var. Cota</Th>
              <Th right>Atraso/DC</Th>
              <Th right>Caixa/PL</Th>
              <Th right>PDD/Atr.</Th>
              <Th right>PDD/DC</Th>
              <Th right>Recompras/DC</Th>
              <Th right>Subord.</Th>
              <Th>Recomendação</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isUnmapped = !r.fidc;
              return (
                <tr key={`${r.isin}-${i}`} className="hairline-b hover:bg-surface-2/40 group">
                  <Td>
                    {isUnmapped
                      ? <span title="ISIN não mapeado" className="inline-block h-2 w-2 rounded-full bg-risk-critical" />
                      : <span title="Posição importada · ISIN mapeado"><CheckCircle2 className="h-3 w-3 text-risk-normal" /></span>}
                  </Td>
                  <Td>
                    {r.fidc
                      ? <Link to={`/fidc-monitor/fidcs/${r.fidc.id}`} className="font-medium text-foreground hover:text-primary">
                          {r.fidc.name}
                        </Link>
                      : <span className="text-risk-critical italic">ISIN não mapeado</span>}
                    {r.fidc && (
                      <div className="text-[10.5px] text-muted-foreground truncate max-w-[260px]">
                        {r.fidc.sector || "—"} · {r.fidc.manager || "—"}
                      </div>
                    )}
                  </Td>
                  <Td>{r.fidc ? <ReportStatusBadge status={reportSourceStatusFor(r.fidc.id)} /> : <span className="text-muted-foreground">—</span>}</Td>
                  <Td mono>{r.fidc?.cnpj ? formatCNPJ(r.fidc.cnpj) : "—"}</Td>
                  <Td mono className={cn("text-muted-foreground", isUnmapped && "text-risk-critical")}>{r.isin || "—"}</Td>
                  <Td>{r.quota?.class_name || r.quota?.internal_quota_name || <span className="text-muted-foreground">—</span>}</Td>
                  <Td right mono>{BRL(r.value, { compact: true })}</Td>
                  <Td right mono>{PCT(r.pctPortfolio)}</Td>
                  <Td right mono>{r.report ? BRL(r.navNow, { compact: true }) : <NoDataChip />}</Td>
                  <Td right mono>{r.varNav != null ? PCT(r.varNav) : <NoDataChip />}</Td>
                  <Td right mono>{r.report && r.quotaNow > 0 ? r.quotaNow.toLocaleString("pt-BR", { minimumFractionDigits: 6, maximumFractionDigits: 8 }) : <NoDataChip />}</Td>
                  <Td right mono>{r.varQuota != null ? PCT(r.varQuota) : <NoDataChip />}</Td>
                  <Td right mono>{r.atrasoDC != null ? PCT(r.atrasoDC) : <NoDataChip />}</Td>
                  <Td right mono>{r.caixaPL != null ? PCT(r.caixaPL) : <NoDataChip />}</Td>
                  <Td right mono>{r.pddAtraso != null ? PCT(r.pddAtraso) : <NoDataChip />}</Td>
                  <Td right mono>{r.pddDC != null ? PCT(r.pddDC) : <NoDataChip />}</Td>
                  <Td right mono>{r.recompraDC != null ? PCT(r.recompraDC) : <NoDataChip />}</Td>
                  <Td right mono>{r.subordPct != null ? PCT(r.subordPct) : <NoDataChip />}</Td>
                  <Td><NoDataInline /></Td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr><td colSpan={18} className="py-12 text-center text-muted-foreground">Nenhuma posição em FIDC encontrada para esta carteira.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, right, onClick, dir }: { children: React.ReactNode; right?: boolean; onClick?: () => void; dir?: "asc" | "desc" }) {
  return (
    <th
      onClick={onClick}
      className={`hairline-b px-2.5 py-2 text-[10.5px] uppercase tracking-wider font-semibold whitespace-nowrap ${
        right ? "text-right" : "text-left"
      } ${onClick ? "cursor-pointer hover:text-foreground select-none" : ""}`}
    >
      {children}
      {dir && <span className="ml-1 opacity-60">{dir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}

function Td({ children, right, mono, className = "" }: { children: React.ReactNode; right?: boolean; mono?: boolean; className?: string }) {
  return (
    <td className={`px-2.5 py-1.5 whitespace-nowrap ${right ? "text-right" : ""} ${mono ? "num" : ""} ${className}`}>
      {children}
    </td>
  );
}

function Select<T extends string>({ label, value, onChange, options }: {
  label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
      <span className="uppercase tracking-wider">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="bg-card border border-border rounded-sm px-2 py-1 text-[12px] text-foreground outline-none focus:border-primary"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
