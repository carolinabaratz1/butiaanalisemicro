// Seção "Carteira de Crédito": segmento, prazo, inadimplência por faixa, cedentes, garantias, SCR.
import { useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { BRL, PCT } from "@/lib/fidc/format";

type Item = { bucket: string; value: number };
type Props = {
  segments?: Item[] | null;
  maturity?: Item[] | null;
  overdueByBucket?: Item[] | null;
  overdueHeadlineValue?: number | null;
  overdueSource?: string | null;
  overdueBucketCoverageStatus?: string | null;
  delinquencyUnbucketedValue?: number | null;
  assignors?: Item[] | null;
  guaranteesValue?: number | null;
  guaranteesPctDc?: number | null;
  scrStatus?: string | null;
  scrValue?: number | null;
  creditRightsValue?: number | null;
};

const PIE_COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#0ea5e9", "#84cc16", "#ec4899", "#14b8a6", "#f43f5e"];

const tt = {
  contentStyle: {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 4, fontSize: 11, padding: "6px 8px",
  },
  itemStyle: { color: "hsl(var(--foreground))" },
};
const axis = {
  tick: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
  stroke: "hsl(var(--border))",
};

export function CreditPortfolio(p: Props) {
  const dc = p.creditRightsValue ?? null;

  const segData = useMemo(() => {
    if (!p.segments?.length) return [];
    const total = p.segments.reduce((s, x) => s + (x.value ?? 0), 0);
    return p.segments
      .map((s) => ({ ...s, pct: total > 0 ? s.value / total : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [p.segments]);

  const matData = useMemo(() => {
    if (!p.maturity?.length) return [];
    return [...p.maturity].sort((a, b) => maturityOrder(a.bucket) - maturityOrder(b.bucket));
  }, [p.maturity]);

  return (
    <div className="bg-card border border-border" data-print-section>
      <div className="section-title px-4 pt-3">Carteira de Crédito</div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-4">
        {/* 1. Segmento */}
        <Block title="Carteira por Segmento" subtitle="Fonte: II">
          {segData.length === 0 ? <Empty /> : (
            <div className="grid grid-cols-[1fr_1fr] gap-3">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={segData} dataKey="value" nameKey="bucket" cx="50%" cy="50%" innerRadius={36} outerRadius={70} stroke="hsl(var(--background))" strokeWidth={1}>
                    {segData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...tt} formatter={(v: number) => BRL(v, { compact: true })} />
                </PieChart>
              </ResponsiveContainer>
              <div className="overflow-y-auto max-h-[220px]">
                <table className="w-full text-[11px]">
                  <tbody>
                    {segData.map((s, i) => (
                      <tr key={i} className="hairline-b">
                        <td className="py-1 pr-2">
                          <span className="inline-block h-2 w-2 mr-1.5 align-middle" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="truncate inline-block max-w-[140px] align-middle" title={s.bucket}>{s.bucket}</span>
                        </td>
                        <td className="py-1 text-right num">{BRL(s.value, { compact: true })}</td>
                        <td className="py-1 text-right num text-muted-foreground">{PCT(s.pct, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Block>

        {/* 2. Prazo de vencimento */}
        <Block title="Prazo de Vencimento" subtitle="Fonte: V.a + VI.a">
          {matData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={matData} margin={{ top: 8, right: 8, left: 0, bottom: 30 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="bucket" angle={-30} textAnchor="end" interval={0} height={50} {...axis} />
                <YAxis {...axis} width={56} tickFormatter={(v) => v >= 1e6 ? `${(v / 1e6).toFixed(0)}mi` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}mil` : String(v)} />
                <Tooltip {...tt} formatter={(v: number) => BRL(v, { compact: true })} />
                <Bar dataKey="value" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Block>

        {/* 3. Inadimplência por faixa */}
        <Block title="Inadimplência por Faixa" subtitle="Fonte: V.b + VI.b">
          {!p.overdueByBucket?.length ? <Empty /> : (
            <table className="w-full text-[12px]">
              <thead className="bg-surface-2 text-muted-foreground">
                <tr className="hairline-b">
                  <th className="text-left px-2 py-1.5 font-medium">Faixa</th>
                  <th className="text-right px-2 py-1.5 font-medium">Valor</th>
                  <th className="text-right px-2 py-1.5 font-medium">% DC</th>
                </tr>
              </thead>
              <tbody>
                {p.overdueByBucket.map((o, i) => (
                  <tr key={i} className="hairline-b">
                    <td className="px-2 py-1.5">{o.bucket}</td>
                    <td className="px-2 py-1.5 text-right num">{BRL(o.value, { compact: true })}</td>
                    <td className="px-2 py-1.5 text-right num text-muted-foreground">
                      {dc && dc > 0 ? PCT(o.value / dc, 2) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Block>

        {/* 4. Cedentes relevantes */}
        <Block title="Cedentes Relevantes" subtitle="Fonte: I.2.a.11 / I.2.b.11">
          {!p.assignors?.length ? <Empty /> : (
            <div className="overflow-y-auto max-h-[220px]">
              <table className="w-full text-[12px]">
                <thead className="bg-surface-2 text-muted-foreground">
                  <tr className="hairline-b">
                    <th className="text-left px-2 py-1.5 font-medium">Cedente</th>
                    <th className="text-right px-2 py-1.5 font-medium">Valor / %</th>
                  </tr>
                </thead>
                <tbody>
                  {p.assignors.map((a, i) => (
                    <tr key={i} className="hairline-b">
                      <td className="px-2 py-1.5 truncate max-w-[260px]" title={a.bucket}>{a.bucket}</td>
                      <td className="px-2 py-1.5 text-right num">
                        {Math.abs(a.value) <= 1 ? PCT(a.value, 2) : BRL(a.value, { compact: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Block>

        {/* 5. Garantias */}
        <Block title="Garantias" subtitle="Fonte: 7) Garantias">
          {p.guaranteesValue == null && p.guaranteesPctDc == null ? <Empty /> : (
            <div className="grid grid-cols-2 gap-3">
              <Kpi label="Valor total" value={p.guaranteesValue != null ? BRL(p.guaranteesValue, { compact: true }) : "—"} />
              <Kpi label="% sobre DC" value={p.guaranteesPctDc != null ? PCT(p.guaranteesPctDc, 1) : (p.guaranteesValue != null && dc ? PCT(p.guaranteesValue / dc, 1) : "—")} />
            </div>
          )}
        </Block>

        {/* 6. SCR */}
        <Block title="SCR" subtitle="Fonte: 8) Resumo SCR">
          {!p.scrStatus && p.scrValue == null ? <Empty /> : (
            <div className="grid grid-cols-2 gap-3">
              <Kpi label="Status" value={p.scrStatus || "—"} />
              <Kpi label="Valor reportado" value={p.scrValue != null ? BRL(p.scrValue, { compact: true }) : "—"} />
            </div>
          )}
        </Block>
      </div>
    </div>
  );
}

function maturityOrder(bucket: string): number {
  const b = bucket.toLowerCase();
  if (/\b30\b/.test(b) && !/3[1-9]/.test(b)) return 1;
  if (/60/.test(b)) return 2;
  if (/90/.test(b)) return 3;
  if (/120/.test(b)) return 4;
  if (/150/.test(b)) return 5;
  if (/180/.test(b)) return 6;
  if (/360/.test(b)) return 7;
  if (/720/.test(b)) return 8;
  if (/1080/.test(b)) return 9;
  if (/acima/.test(b)) return 10;
  return 99;
}

function Block({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-card">
      <div className="px-3 pt-2 pb-1 flex items-baseline justify-between gap-2">
        <div className="text-[11.5px] font-medium">{title}</div>
        <div className="text-[10px] text-muted-foreground">{subtitle}</div>
      </div>
      <div className="px-2 pb-2">{children}</div>
    </div>
  );
}
function Empty() {
  return <div className="py-6 text-center text-muted-foreground text-[11.5px]">Sem dados no informe</div>;
}
function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border border-border px-2.5 py-2">
      <div className="text-[10.5px] text-muted-foreground">{label}</div>
      <div className="text-[15px] font-semibold num">{value}</div>
    </div>
  );
}
