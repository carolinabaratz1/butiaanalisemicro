// Gráficos históricos da lâmina FIDC. 10 painéis com eixos e escala.
import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, AreaChart, Area, BarChart, Bar, ComposedChart, ReferenceLine,
} from "recharts";
import { BRL, PCT, monthLabel } from "@/lib/fidc/format";

type Row = Record<string, unknown>;
const num = (v: unknown): number | null =>
  v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null;
const ratio = (a: number | null, b: number | null) =>
  a != null && b != null && b !== 0 ? a / b : null;

const tt = {
  contentStyle: {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 4, fontSize: 11, padding: "6px 8px",
  },
  labelStyle: { color: "hsl(var(--foreground))", fontSize: 11, fontWeight: 500 },
  itemStyle: { color: "hsl(var(--foreground))" },
};

const axis = {
  tick: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
  stroke: "hsl(var(--border))",
  tickLine: { stroke: "hsl(var(--border))" },
};

function moneyFmt(values: (number | null)[]) {
  const max = Math.max(...values.filter((v): v is number => v != null).map(Math.abs), 0);
  if (max >= 1e9) return (v: number) => `${(v / 1e9).toFixed(1)}bi`;
  if (max >= 1e6) return (v: number) => `${(v / 1e6).toFixed(0)}mi`;
  if (max >= 1e3) return (v: number) => `${(v / 1e3).toFixed(0)}mil`;
  return (v: number) => v.toLocaleString("pt-BR");
}
const pctFmt = (v: number) => `${(v * 100).toFixed(1)}%`;
const intFmt = (v: number) => Number(v).toLocaleString("pt-BR");

export function LaminateCharts({ history, subStatusByMonth }: {
  history: Row[];
  subStatusByMonth?: Map<string, string>;
}) {
  const data = useMemo(() => {
    const asc = [...history].sort((a, b) =>
      String(a.reference_month).localeCompare(String(b.reference_month))
    );
    const out = asc.map((r, idx) => {
      const month = String(r.reference_month).slice(0, 10);
      const nav = num(r.nav_value);
      const cota = num(r.quota_value);
      const dc = num(r.credit_rights_value);
      const overdue = num(r.overdue_value);
      const pdd = num(r.pdd_value);
      const cash = num(r.cash_value);
      const rep = num(r.repurchase_value);
      const acq = num(r.acquisitions_value);
      const sub = num(r.subordinated_value);
      const subOk = String(r.subordinated_calculation_status ?? "") === "ok";
      const prev = idx > 0 ? asc[idx - 1] : null;
      const prevNav = prev ? num(prev.nav_value) : null;
      const prevCota = prev ? num(prev.quota_value) : null;
      return {
        month, label: monthLabel(month),
        pl: nav,
        plVar: prevNav && prevNav > 0 && nav != null ? (nav / prevNav - 1) : null,
        cota,
        cotaVar: prevCota && prevCota > 0 && cota != null ? (cota / prevCota - 1) : null,
        dc,
        dcPl: ratio(dc, nav),
        atrasoPct: ratio(overdue, dc),
        pddPct: ratio(pdd, dc),
        pddAtrasoPct: overdue && overdue !== 0 && pdd != null ? pdd / overdue : null,
        caixaPct: ratio(cash, nav),
        recompraPct: ratio(rep, dc),
        aqPct: ratio(acq, dc),
        subPct: subOk ? ratio(sub, nav) : null,
        subInconsistent: !subOk && sub != null,
        investidores: num(r.investors_count),
        o30: ratio(num(r.overdue_30d_value), dc),
        o60: ratio(num(r.overdue_60d_value), dc),
        o90: ratio(num(r.overdue_90d_value), dc),
        o120: ratio(num(r.overdue_120d_value), dc),
        aq: acq, rec: rep,
        sub: num(r.substitutions_value),
        ali: num(r.disposals_value),
      };
    });
    return out;
  }, [history]);

  if (data.length < 2) {
    return (
      <div className="px-4 py-6 text-center text-muted-foreground text-[11.5px]">
        Importe ao menos 2 meses do informe para visualizar a evolução histórica.
      </div>
    );
  }

  const fmtPl = moneyFmt(data.map((d) => d.pl));
  const fmtDc = moneyFmt(data.map((d) => d.dc));
  const fmtFlow = moneyFmt(data.flatMap((d) => [d.aq, d.rec, d.sub, d.ali]));
  const x = { dataKey: "label" as const, interval: 0 as const, angle: -35, textAnchor: "end" as const, height: 46, ...axis };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
      {/* 1. PL + Variação mensal */}
      <Card title="PL e Variação Mensal" subtitle="R$ • %">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 8, right: 36, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis {...x} />
            <YAxis yAxisId="l" {...axis} width={64} tickFormatter={fmtPl} domain={["auto", "auto"]} />
            <YAxis yAxisId="r" orientation="right" {...axis} width={42} tickFormatter={pctFmt} domain={["auto", "auto"]} />
            <Tooltip {...tt} formatter={(v: number, name: string) => name === "Var. PL" ? PCT(v) : BRL(v, { compact: true })} />
            <Bar yAxisId="r" dataKey="plVar" name="Var. PL" fill="hsl(var(--primary) / 0.35)" />
            <Line yAxisId="l" type="monotone" dataKey="pl" name="PL" stroke="hsl(var(--primary))" strokeWidth={1.8} dot={{ r: 2 }} />
            <ReferenceLine yAxisId="r" y={0} stroke="hsl(var(--border))" />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* 2. Cota + Rentabilidade */}
      <Card title="Cota e Rentabilidade Mensal" subtitle="R$ por cota • %">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 8, right: 36, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis {...x} />
            <YAxis yAxisId="l" {...axis} width={70} tickFormatter={(v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 4 })} domain={["auto", "auto"]} />
            <YAxis yAxisId="r" orientation="right" {...axis} width={42} tickFormatter={pctFmt} />
            <Tooltip {...tt} formatter={(v: number, name: string) => name === "Rent. mês" ? PCT(v) : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 8 })} />
            <Bar yAxisId="r" dataKey="cotaVar" name="Rent. mês" fill="hsl(var(--primary) / 0.3)" />
            <Line yAxisId="l" type="monotone" dataKey="cota" name="Cota" stroke="hsl(var(--primary))" strokeWidth={1.6} dot={{ r: 2 }} />
            <ReferenceLine yAxisId="r" y={0} stroke="hsl(var(--border))" />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* 3. DC + DC/PL */}
      <Card title="Direitos Creditórios e DC/PL" subtitle="R$ • %">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 8, right: 36, left: 8, bottom: 8 }}>
            <defs>
              <linearGradient id="gDC2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis {...x} />
            <YAxis yAxisId="l" {...axis} width={64} tickFormatter={fmtDc} />
            <YAxis yAxisId="r" orientation="right" {...axis} width={42} tickFormatter={pctFmt} />
            <Tooltip {...tt} formatter={(v: number, name: string) => name === "DC/PL" ? PCT(v) : BRL(v, { compact: true })} />
            <Area yAxisId="l" type="monotone" dataKey="dc" name="DC" stroke="#10b981" fill="url(#gDC2)" strokeWidth={1.6} />
            <Line yAxisId="r" type="monotone" dataKey="dcPl" name="DC/PL" stroke="hsl(var(--primary))" strokeWidth={1.6} dot={{ r: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* 4. Inadimplência por faixa */}
      <Card title="Inadimplência por Faixa" subtitle="% sobre Direitos Creditórios">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis {...x} />
            <YAxis {...axis} width={56} tickFormatter={pctFmt} domain={[0, "auto"]} />
            <Tooltip {...tt} formatter={(v: number) => PCT(v)} />
            <Line type="monotone" dataKey="o30"  name="≤30d/DC"   stroke="#fbbf24" strokeWidth={1.5} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="o60"  name="≤60d/DC"   stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="o90"  name="≤90d/DC"   stroke="#ef4444" strokeWidth={1.5} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="o120" name="≤120d/DC"  stroke="#b91c1c" strokeWidth={1.5} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
        <MiniLegend items={[
          { label: "≤30d", color: "#fbbf24" }, { label: "≤60d", color: "#f59e0b" },
          { label: "≤90d", color: "#ef4444" }, { label: "≤120d", color: "#b91c1c" },
        ]} />
      </Card>

      {/* 5. Atraso/DC vs PDD/DC */}
      <Card title="Atraso/DC vs PDD/DC" subtitle="%">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis {...x} />
            <YAxis {...axis} width={56} tickFormatter={pctFmt} domain={[0, "auto"]} />
            <Tooltip {...tt} formatter={(v: number) => PCT(v)} />
            <Line type="monotone" dataKey="atrasoPct" name="Atraso/DC" stroke="#ef4444" strokeWidth={1.6} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="pddPct" name="PDD/DC" stroke="#f59e0b" strokeWidth={1.6} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
        <MiniLegend items={[{ label: "Atraso/DC", color: "#ef4444" }, { label: "PDD/DC", color: "#f59e0b" }]} />
      </Card>

      {/* 6. PDD/Atrasos */}
      <Card title="Cobertura PDD / Atrasos" subtitle="%">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis {...x} />
            <YAxis {...axis} width={56} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
            <Tooltip {...tt} formatter={(v: number) => PCT(v)} />
            <Line type="monotone" dataKey="pddAtrasoPct" stroke="hsl(var(--primary))" strokeWidth={1.6} dot={{ r: 2 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* 7. Caixa/PL + Recompras/DC */}
      <Card title="Caixa/PL e Recompras/DC" subtitle="%">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis {...x} />
            <YAxis {...axis} width={56} tickFormatter={pctFmt} domain={[0, "auto"]} />
            <Tooltip {...tt} formatter={(v: number) => PCT(v)} />
            <Line type="monotone" dataKey="caixaPct" name="Caixa/PL" stroke="#0ea5e9" strokeWidth={1.6} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="recompraPct" name="Recompras/DC" stroke="#a855f7" strokeWidth={1.6} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
        <MiniLegend items={[{ label: "Caixa/PL", color: "#0ea5e9" }, { label: "Recompras/DC", color: "#a855f7" }]} />
      </Card>

      {/* 8. Subordinação */}
      <Card title="Subordinação" subtitle="% sobre PL (pontos cinza = inconsistente)">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis {...x} />
            <YAxis {...axis} width={56} tickFormatter={pctFmt} domain={[0, "auto"]} />
            <Tooltip {...tt} formatter={(v: number) => PCT(v)} />
            <Line
              type="monotone" dataKey="subPct"
              stroke="hsl(var(--primary))" strokeWidth={1.6}
              connectNulls
              dot={(props: any) => {
                const inconsistent = data[props.index]?.subInconsistent;
                if (inconsistent) {
                  return <circle key={props.index} cx={props.cx} cy={props.cy ?? 0} r={3} fill="#94a3b8" stroke="#475569" />;
                }
                return <circle key={props.index} cx={props.cx} cy={props.cy} r={2} fill="hsl(var(--primary))" />;
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* 9. Investidores */}
      <Card title="Número de Cotistas" subtitle="qtd.">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis {...x} />
            <YAxis {...axis} width={56} tickFormatter={intFmt} allowDecimals={false} />
            <Tooltip {...tt} formatter={(v: number) => Number(v).toLocaleString("pt-BR")} />
            <Line type="monotone" dataKey="investidores" stroke="#6366f1" strokeWidth={1.6} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* 10. Fluxo VII */}
      <Card title="Fluxo de Negócios (VII)" subtitle="Aquisições · Recompras · Substituições · Alienações">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis {...x} />
            <YAxis {...axis} width={64} tickFormatter={fmtFlow} />
            <Tooltip {...tt} formatter={(v: number) => BRL(v, { compact: true })} />
            <Bar dataKey="aq" name="Aquisições" fill="#10b981" />
            <Bar dataKey="rec" name="Recompras" fill="#a855f7" />
            <Bar dataKey="sub" name="Substituições" fill="#0ea5e9" />
            <Bar dataKey="ali" name="Alienações" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
        <MiniLegend items={[
          { label: "Aquisições", color: "#10b981" }, { label: "Recompras", color: "#a855f7" },
          { label: "Substituições", color: "#0ea5e9" }, { label: "Alienações", color: "#f59e0b" },
        ]} />
      </Card>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-card" data-print-section>
      <div className="px-3 pt-2 pb-1 flex items-baseline justify-between gap-2">
        <div className="text-[11.5px] font-medium text-foreground">{title}</div>
        {subtitle && <div className="text-[10px] text-muted-foreground">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function MiniLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-3 px-3 pb-2 text-[10.5px] text-muted-foreground">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-3" style={{ background: it.color }} /> {it.label}
        </span>
      ))}
    </div>
  );
}
