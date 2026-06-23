import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  PORTFOLIOS, LATEST_MONTH, REFERENCE_MONTHS,
  positionsForPortfolio, portfolioSummary, fidcById, metricsFor, statusForFidc, opinionFor, reportFor,
} from "@/lib/fidc/mock-data";
import { BRL, PCT, formatCNPJ, monthLabel } from "@/lib/fidc/format";
import { DEFAULT_THRESHOLDS, evalStatus, type RiskStatus } from "@/lib/fidc/metrics";
import { MetricCard } from "@/components/fidc/MetricCard";
import { MetricChip, RiskStatusBadge, StatusDot } from "@/components/fidc/MetricChip";
import { PageHeader } from "@/components/fidc/PageHeader";
import { RecBadge } from "@/components/fidc/RecBadge";
import { Search } from "lucide-react";

const M = (k: string) => DEFAULT_THRESHOLDS.find((t) => t.metric === k)!;

export default function MonitorPage() {
  const [sp, setSp] = useSearchParams();
  const portfolioId = sp.get("portfolio") ?? PORTFOLIOS[0].id;
  const month = sp.get("month") ?? LATEST_MONTH;
  const statusFilter = (sp.get("status") ?? "all") as "all" | RiskStatus;
  const q = (sp.get("q") ?? "").toLowerCase();

  const summary = portfolioSummary(portfolioId);
  const positions = positionsForPortfolio(portfolioId);

  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "value", dir: "desc" });

  const rows = useMemo(() => {
    const data = positions.map((pos) => {
      const f = fidcById(pos.fidcId)!;
      const m = metricsFor(f.id, month);
      const r = reportFor(f.id, month);
      const st = statusForFidc(f.id, month);
      const op = opinionFor(f.id, month);
      return { fidc: f, position: pos, metrics: m, report: r, status: st, opinion: op, pctPortfolio: pos.value / summary.portfolio.nav };
    }).filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q && !(r.fidc.name.toLowerCase().includes(q) || r.fidc.cnpj.includes(q) || r.position.isin.toLowerCase().includes(q))) return false;
      return true;
    });
    const sorters: Record<string, (a: typeof data[number]) => number | string> = {
      value: (r) => r.position.value,
      name: (r) => r.fidc.name,
      pct: (r) => r.pctPortfolio,
      status: (r) => ({ critical: 3, warning: 2, missing: 1, normal: 0 }[r.status]),
    };
    const fn = sorters[sort.key] ?? sorters.value;
    return data.sort((a, b) => {
      const va = fn(a), vb = fn(b);
      if (va < vb) return sort.dir === "asc" ? -1 : 1;
      if (va > vb) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [positions, month, statusFilter, q, sort, summary.portfolio.nav]);

  const critCount = rows.filter((r) => r.status === "critical").length;
  const warnCount = rows.filter((r) => r.status === "warning").length;

  const setParam = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => v ? next.set(k, v) : next.delete(k));
    setSp(next, { replace: true });
  };

  function toggleSort(key: string) {
    setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" });
  }

  return (
    <div>
      <PageHeader
        title="Monitor de FIDCs"
        subtitle={`${summary.portfolio.name} · ${summary.portfolio.description}`}
        right={<RiskStatusBadge status={summary.worst} />}
      />

      <div className="px-6 py-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 hairline-b">
        <MetricCard label="PL da Carteira" value={BRL(summary.portfolio.nav, { compact: true })} />
        <MetricCard label="Exposição em FIDCs" value={BRL(summary.exposure, { compact: true })} hint={PCT(summary.pct)} />
        <MetricCard label="Total de FIDCs" value={String(summary.fidcCount)} />
        <MetricCard label="Em atenção" value={String(warnCount)} accent="warning" />
        <MetricCard label="Críticos" value={String(critCount)} accent="critical" />
        <MetricCard label="Mês de referência" value={monthLabel(month)} />
      </div>

      <div className="px-6 py-3 flex flex-wrap items-center gap-2 hairline-b">
        <Select label="Carteira" value={portfolioId} onChange={(v) => setParam({ portfolio: v })}
          options={PORTFOLIOS.map((p) => ({ value: p.id, label: p.name }))} />
        <Select label="Mês" value={month} onChange={(v) => setParam({ month: v })}
          options={REFERENCE_MONTHS.slice().reverse().map((m) => ({ value: m, label: monthLabel(m) }))} />
        <Select label="Status" value={statusFilter} onChange={(v) => setParam({ status: v })}
          options={[
            { value: "all", label: "Todos" },
            { value: "critical", label: "Crítico" },
            { value: "warning", label: "Atenção" },
            { value: "normal", label: "Normal" },
            { value: "missing", label: "S/ dado" },
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
              <Th>CNPJ</Th>
              <Th>ISIN</Th>
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
            {rows.map((r) => {
              const m = r.metrics;
              const chip = (key: string, val: number | null | undefined, fmt: (v: number) => string) => {
                const st: RiskStatus = val == null ? "missing" : evalStatus(M(key), val);
                return <MetricChip status={st} value={val == null ? "—" : fmt(val)} />;
              };
              return (
                <tr key={r.fidc.id} className="hairline-b hover:bg-surface-2/40 group">
                  <Td><StatusDot status={r.status} /></Td>
                  <Td>
                    <Link to={`/fidc-monitor/fidcs/${r.fidc.id}`} className="font-medium text-foreground hover:text-primary">
                      {r.fidc.name}
                    </Link>
                    <div className="text-[10.5px] text-muted-foreground truncate max-w-[240px]">{r.fidc.sector} · {r.fidc.manager}</div>
                  </Td>
                  <Td mono>{formatCNPJ(r.fidc.cnpj)}</Td>
                  <Td mono className="text-muted-foreground">{r.position.isin}</Td>
                  <Td right mono>{BRL(r.position.value, { compact: true })}</Td>
                  <Td right mono>{PCT(r.pctPortfolio)}</Td>
                  <Td right mono>{r.report ? BRL(r.report.nav, { compact: true }) : "—"}</Td>
                  <Td right>{chip("var_pl", m?.var_pl, (v) => PCT(v))}</Td>
                  <Td right mono>{r.report ? r.report.quotaValue.toFixed(6).replace(".", ",") : "—"}</Td>
                  <Td right>{chip("var_cota", m?.var_cota, (v) => PCT(v, 3))}</Td>
                  <Td right>{chip("atraso_dc", m?.atraso_dc, (v) => PCT(v))}</Td>
                  <Td right>{chip("caixa_pl", m?.caixa_pl, (v) => PCT(v))}</Td>
                  <Td right>{chip("pdd_atrasos", m?.pdd_atrasos, (v) => PCT(v))}</Td>
                  <Td right>{chip("pdd_dc", m?.pdd_dc, (v) => PCT(v))}</Td>
                  <Td right>{chip("recompras_dc", m?.recompras_dc, (v) => PCT(v))}</Td>
                  <Td right>{chip("subordinacao", m?.subordinacao, (v) => PCT(v))}</Td>
                  <Td>{r.opinion ? <RecBadge rec={r.opinion.recommendation} /> : <span className="text-muted-foreground">—</span>}</Td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr><td colSpan={17} className="py-12 text-center text-muted-foreground">Nenhum FIDC corresponde aos filtros.</td></tr>
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
