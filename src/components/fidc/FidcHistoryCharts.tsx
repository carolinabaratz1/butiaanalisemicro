import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, AreaChart, Area, Label,
} from "recharts";
import { BRL, PCT, monthLabel } from "@/lib/fidc/format";

type Row = Record<string, unknown>;

const num = (v: unknown): number | null =>
  v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null;
const ratio = (a: number | null, b: number | null) =>
  a != null && b != null && b !== 0 ? a / b : null;

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

const axisStyle = {
  tick: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
  stroke: "hsl(var(--border))",
  tickLine: { stroke: "hsl(var(--border))" },
};

// Heurística: usa milhões ou bilhões dependendo da escala
function moneyTickFormatter(values: (number | null)[]) {
  const max = Math.max(...values.filter((v): v is number => v != null).map(Math.abs), 0);
  if (max >= 1e9) return (v: number) => `${(v / 1e9).toFixed(1)} bi`;
  if (max >= 1e6) return (v: number) => `${(v / 1e6).toFixed(0)} mi`;
  if (max >= 1e3) return (v: number) => `${(v / 1e3).toFixed(0)} mil`;
  return (v: number) => v.toLocaleString("pt-BR");
}

const pctTickFormatter = (v: number) => `${(v * 100).toFixed(1)}%`;

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
        amortizacao: num(r.total_amortization_value),
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
        Importe ao menos 2 meses do informe para visualizar a evolução histórica.
      </div>
    );
  }

  const fmtPlAxis = moneyTickFormatter(data.map((d) => d.pl));
  const fmtDcAxis = moneyTickFormatter(data.map((d) => d.dc));

  const xAxisProps = {
    dataKey: "label" as const,
    interval: 0 as const,
    angle: -35,
    textAnchor: "end" as const,
    height: 46,
    ...axisStyle,
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
      <ChartCard title="PL — Patrimônio Líquido" subtitle="R$">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <defs>
              <linearGradient id="gPL" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis {...xAxisProps} />
            <YAxis {...axisStyle} width={64} tickFormatter={fmtPlAxis} domain={["auto", "auto"]}>
              <Label value="R$" position="insideTopLeft" offset={-2} style={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            </YAxis>
            <Tooltip {...tooltipStyle} formatter={(v: number) => BRL(v, { compact: true })} />
            <Area type="monotone" dataKey="pl" stroke="hsl(var(--primary))" strokeWidth={1.6} fill="url(#gPL)" />
          </AreaChart>
        </ResponsiveContainer>
        <Legend items={[{ label: "Patrimônio Líquido", color: "hsl(var(--primary))" }]} />
      </ChartCard>

      <ChartCard title="Valor da Cota" subtitle="R$ por cota">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis {...xAxisProps} />
            <YAxis
              {...axisStyle}
              width={70}
              tickFormatter={(v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}
              domain={["auto", "auto"]}
            />
            <Tooltip
              {...tooltipStyle}
              formatter={(v: number) =>
                v.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 8 })
              }
            />
            <Line type="monotone" dataKey="cota" stroke="hsl(var(--primary))" strokeWidth={1.6} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
        <Legend items={[{ label: "Valor da cota", color: "hsl(var(--primary))" }]} />
      </ChartCard>

      <ChartCard title="Direitos Creditórios" subtitle="R$">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <defs>
              <linearGradient id="gDC" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis {...xAxisProps} />
            <YAxis {...axisStyle} width={64} tickFormatter={fmtDcAxis} domain={["auto", "auto"]} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => BRL(v, { compact: true })} />
            <Area type="monotone" dataKey="dc" stroke="#10b981" strokeWidth={1.6} fill="url(#gDC)" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Inadimplência e PDD" subtitle="% sobre Direitos Creditórios">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis {...xAxisProps} />
            <YAxis {...axisStyle} width={56} tickFormatter={pctTickFormatter} domain={[0, "auto"]} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => PCT(v)} />
            <Line type="monotone" dataKey="atrasoPct" name="Atraso/DC" stroke="#ef4444" strokeWidth={1.6} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="pddPct" name="PDD/DC" stroke="#f59e0b" strokeWidth={1.6} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
        <Legend items={[{ label: "Atraso/DC", color: "#ef4444" }, { label: "PDD/DC", color: "#f59e0b" }]} />
      </ChartCard>

      <ChartCard title="Cobertura PDD / Atrasos" subtitle="%">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis {...xAxisProps} />
            <YAxis {...axisStyle} width={56} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} domain={["auto", "auto"]} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => PCT(v)} />
            <Line type="monotone" dataKey="pddAtrasoPct" stroke="hsl(var(--primary))" strokeWidth={1.6} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Caixa/PL e Recompras/DC" subtitle="%">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis {...xAxisProps} />
            <YAxis {...axisStyle} width={56} tickFormatter={pctTickFormatter} domain={[0, "auto"]} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => PCT(v)} />
            <Line type="monotone" dataKey="caixaPct" name="Caixa/PL" stroke="#0ea5e9" strokeWidth={1.6} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="recompraPct" name="Recompras/DC" stroke="#a855f7" strokeWidth={1.6} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
        <Legend items={[{ label: "Caixa/PL", color: "#0ea5e9" }, { label: "Recompras/DC", color: "#a855f7" }]} />
      </ChartCard>

      <ChartCard title="Subordinação" subtitle="% sobre PL">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis {...xAxisProps} />
            <YAxis {...axisStyle} width={56} tickFormatter={pctTickFormatter} domain={[0, "auto"]} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => PCT(v)} />
            <Line
              type="monotone" dataKey="subPct" stroke="hsl(var(--primary))"
              strokeWidth={1.6} dot={{ r: 2 }} connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Amortização Total no Mês" subtitle="R$">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <defs>
              <linearGradient id="gAmort" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis {...xAxisProps} />
            <YAxis
              {...axisStyle}
              width={64}
              tickFormatter={moneyTickFormatter(data.map((d) => d.amortizacao))}
              domain={[0, "auto"]}
            />
            <Tooltip {...tooltipStyle} formatter={(v: number) => BRL(v, { compact: true })} />
            <Area type="monotone" dataKey="amortizacao" name="Amortização" stroke="#6366f1" strokeWidth={1.6} fill="url(#gAmort)" />
          </AreaChart>
        </ResponsiveContainer>
        <Legend items={[{ label: "Amortização total no mês", color: "#6366f1" }]} />
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-card">
      <div className="px-3 pt-2 pb-1 flex items-baseline justify-between gap-2">
        <div className="text-[11.5px] font-medium text-foreground">{title}</div>
        {subtitle && <div className="text-[10px] text-muted-foreground">{subtitle}</div>}
      </div>
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
