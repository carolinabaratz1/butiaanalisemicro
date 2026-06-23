import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from "recharts";
import { BRL, PCT, monthLabel } from "@/lib/fidc/format";

type Row = Record<string, unknown>;

const num = (v: unknown): number | null => (v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const ratio = (a: number | null, b: number | null) => (a != null && b != null && b !== 0 ? a / b : null);

export function FidcHistoryCharts({ history }: { history: Row[] }) {
  const data = useMemo(() => {
    const asc = [...history].sort((a, b) =>
      String(a.reference_month).localeCompare(String(b.reference_month)),
    );
    return asc.map((r) => {
      const nav = num(r.nav_value);
      const dc = num(r.credit_rights_value);
      const overdue = num(r.overdue_value);
      const pdd = num(r.pdd_value);
      const cash = num(r.cash_value);
      const rep = num(r.repurchase_value);
      const sub = num(r.subordinated_value);
      const subOk = String(r.subordinated_calculation_status ?? "") === "ok";
      const month = String(r.reference_month).slice(0, 10);
      return {
        month,
        label: monthLabel(month),
        pl: nav,
        cota: num(r.quota_value),
        dc,
        investidores: num(r.investors_count),
        atrasoPct: ratio(overdue, dc),
        pddPct: ratio(pdd, dc),
        pddAtrasoPct: overdue && overdue !== 0 && pdd != null ? pdd / overdue : null,
        caixaPct: ratio(cash, nav),
        recompraPct: ratio(rep, dc),
        subPct: subOk ? ratio(sub, nav) : null,
      };
    });
  }, [history]);

  if (data.length < 2) {
    return (
      <div className="px-4 py-6 text-center text-muted-foreground text-[11.5px]">
        Importe ao menos 2 informes mensais para visualizar a evolução histórica.
      </div>
    );
  }

  const fmtBRLCompact = (v: number) => BRL(v, { compact: true });
  const fmtPct = (v: number | null) => (v == null ? "—" : PCT(v));
  const fmtInt = (v: number | null) => (v == null ? "—" : v.toLocaleString("pt-BR"));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
      <ChartCard title="PL (Patrimônio Líquido)">
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gPL" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => BRL(v, { compact: true }) ?? ""} width={70} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => fmtBRLCompact(v)} />
            <Area type="monotone" dataKey="pl" stroke="hsl(var(--primary))" strokeWidth={1.6} fill="url(#gPL)" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Cota">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={70} tickFormatter={(v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 4 })} domain={["auto", "auto"]} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 8 })} />
            <Line type="monotone" dataKey="cota" stroke="hsl(var(--primary))" strokeWidth={1.6} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Direitos Creditórios">
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gDC" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => BRL(v, { compact: true }) ?? ""} width={70} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => fmtBRLCompact(v)} />
            <Area type="monotone" dataKey="dc" stroke="#10b981" strokeWidth={1.6} fill="url(#gDC)" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Inadimplência e PDD (% DC)">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v * 100).toFixed(1)}%`} width={56} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => fmtPct(v)} />
            <Line type="monotone" dataKey="atrasoPct" name="Atraso/DC" stroke="#ef4444" strokeWidth={1.6} dot={false} />
            <Line type="monotone" dataKey="pddPct" name="PDD/DC" stroke="#f59e0b" strokeWidth={1.6} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <Legend items={[{ label: "Atraso/DC", color: "#ef4444" }, { label: "PDD/DC", color: "#f59e0b" }]} />
      </ChartCard>

      <ChartCard title="PDD / Atrasos (cobertura)">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} width={56} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => fmtPct(v)} />
            <Line type="monotone" dataKey="pddAtrasoPct" stroke="hsl(var(--primary))" strokeWidth={1.6} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Caixa/PL e Recompras/DC">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v * 100).toFixed(1)}%`} width={56} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => fmtPct(v)} />
            <Line type="monotone" dataKey="caixaPct" name="Caixa/PL" stroke="#0ea5e9" strokeWidth={1.6} dot={false} />
            <Line type="monotone" dataKey="recompraPct" name="Recompras/DC" stroke="#a855f7" strokeWidth={1.6} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <Legend items={[{ label: "Caixa/PL", color: "#0ea5e9" }, { label: "Recompras/DC", color: "#a855f7" }]} />
      </ChartCard>

      <ChartCard title="Subordinação (% PL)">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v * 100).toFixed(1)}%`} width={56} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => fmtPct(v)} />
            <Line type="monotone" dataKey="subPct" stroke="hsl(var(--primary))" strokeWidth={1.6} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Investidores">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => Number(v).toLocaleString("pt-BR")} width={56} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => fmtInt(v)} />
            <Line type="monotone" dataKey="investidores" stroke="#6366f1" strokeWidth={1.6} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

const tooltipStyle = {
  contentStyle: {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 4,
    fontSize: 11,
    padding: "6px 8px",
  },
  labelStyle: { color: "hsl(var(--foreground))", fontSize: 11, fontWeight: 500 },
  itemStyle: { color: "hsl(var(--foreground))" },
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-card">
      <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex gap-3 px-3 pb-2 text-[10.5px] text-muted-foreground">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-3" style={{ background: it.color }} /> {it.label}
        </span>
      ))}
    </div>
  );
}
