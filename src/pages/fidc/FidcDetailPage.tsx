import { Link, useParams, Navigate } from "react-router-dom";
import {
  fidcById, historyFor, reportFor, metricsFor, statusForFidc,
  quotaClassesFor, portfoliosForFidc, opinionFor, POSITIONS, LATEST_MONTH,
} from "@/lib/fidc/mock-data";
import { BRL, PCT, formatCNPJ, monthLabel } from "@/lib/fidc/format";
import { DEFAULT_THRESHOLDS, evalStatus } from "@/lib/fidc/metrics";
import { MetricCard } from "@/components/fidc/MetricCard";
import { MetricChip, RiskStatusBadge } from "@/components/fidc/MetricChip";
import { RecBadge } from "@/components/fidc/RecBadge";
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";

const M = (k: string) => DEFAULT_THRESHOLDS.find((t) => t.metric === k)!;

export default function FidcDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const f = fidcById(id);
  if (!f) return <Navigate to="/fidc-monitor/fidcs" replace />;

  const month = LATEST_MONTH;
  const r = reportFor(id, month);
  const m = metricsFor(id, month);
  const st = statusForFidc(id, month);
  const history = historyFor(id);
  const classes = quotaClassesFor(id);
  const ports = portfoliosForFidc(id);
  const op = opinionFor(id, month);
  const exposureTotal = POSITIONS.filter((p) => p.fidcId === id).reduce((s, p) => s + p.value, 0);

  const quotaSum = (r?.nav ?? 0) * 0.997;
  const diff = (r?.nav ?? 0) - quotaSum;
  const diffPct = r?.nav ? diff / r.nav : 0;
  const valStatus = Math.abs(diffPct) < 0.001 ? "valid" : Math.abs(diffPct) < 0.005 ? "warning" : "invalid";

  return (
    <div>
      <div className="px-6 py-4 hairline-b">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[20px] font-semibold tracking-tight">{f.name}</h1>
              <RiskStatusBadge status={st} />
              <RecBadge rec={op?.recommendation ?? "Manter"} />
            </div>
            <div className="mt-1 text-[11.5px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              <span>CNPJ <span className="num text-foreground">{formatCNPJ(f.cnpj)}</span></span>
              <span>Gestor <span className="text-foreground">{f.manager}</span></span>
              <span>Administrador <span className="text-foreground">{f.administrator}</span></span>
              <span>Custodiante <span className="text-foreground">{f.custodian}</span></span>
              <span>Originador <span className="text-foreground">{f.mainOriginator}</span></span>
              <span>Setor <span className="text-foreground">{f.sector}</span></span>
              <span>Rating <span className="text-foreground">{f.rating}</span> ({f.ratingAgency})</span>
              <span>Mês <span className="text-foreground">{monthLabel(month)}</span></span>
            </div>
          </div>
          <div className="text-right text-[11px]">
            <div className="section-title">Carteiras</div>
            <div className="mt-1 space-y-0.5">
              {ports.map((p) => (
                <Link key={p.id} to={`/fidc-monitor?portfolio=${p.id}`} className="block text-foreground hover:text-primary">
                  {p.name}
                </Link>
              ))}
              {!ports.length && <div className="text-muted-foreground">—</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="PL" value={r ? BRL(r.nav, { compact: true }) : "—"} />
        <MetricCard label="Cota" value={r ? r.quotaValue.toFixed(6).replace(".", ",") : "—"} hint={m?.var_cota != null ? PCT(m.var_cota, 3) + " m/m" : ""} />
        <MetricCard label="Direitos Creditórios" value={r ? BRL(r.creditRights, { compact: true }) : "—"} />
        <MetricCard label="Atraso/DC" value={m ? PCT(m.atraso_dc) : "—"} accent={statusToAccent("atraso_dc", m?.atraso_dc)} />
        <MetricCard label="PDD/DC" value={m ? PCT(m.pdd_dc) : "—"} accent={statusToAccent("pdd_dc", m?.pdd_dc)} />
        <MetricCard label="PDD/Atrasos" value={m ? PCT(m.pdd_atrasos) : "—"} accent={statusToAccent("pdd_atrasos", m?.pdd_atrasos)} />
        <MetricCard label="Caixa/PL" value={m ? PCT(m.caixa_pl) : "—"} accent={statusToAccent("caixa_pl", m?.caixa_pl)} />
        <MetricCard label="Recompras/DC" value={m ? PCT(m.recompras_dc) : "—"} accent={statusToAccent("recompras_dc", m?.recompras_dc)} />
        <MetricCard label="Subordinação" value={m ? PCT(m.subordinacao) : "—"} accent={statusToAccent("subordinacao", m?.subordinacao)} />
        <MetricCard label="Var. mensal PL" value={m?.var_pl != null ? PCT(m.var_pl) : "—"} accent={statusToAccent("var_pl", m?.var_pl)} />
        <MetricCard label="Exposição Butiá" value={BRL(exposureTotal, { compact: true })} hint={`${ports.length} carteira(s)`} />
        <MetricCard label="Investidores" value={String(r?.investors ?? "—")} />
      </div>

      <div className="px-6 pb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Chart title="Evolução do PL" data={history} dataKey="nav" format={(v) => BRL(v, { compact: true })} />
        <Chart title="Evolução da Cota" data={history} dataKey="quotaValue" format={(v) => v.toFixed(4)} />
        <Chart title="Atraso/DC" data={history} compute={(r) => r.overdue / r.creditRights} format={(v) => PCT(v)} />
        <Chart title="PDD/DC" data={history} compute={(r) => r.pdd / r.creditRights} format={(v) => PCT(v)} />
        <Chart title="PDD/Atrasos" data={history} compute={(r) => r.pdd / r.overdue} format={(v) => PCT(v)} />
        <Chart title="Caixa/PL" data={history} compute={(r) => r.cash / r.nav} format={(v) => PCT(v)} />
        <Chart title="Recompras/DC" data={history} compute={(r) => r.repurchase / r.creditRights} format={(v) => PCT(v)} />
        <Chart title="Subordinação" data={history} compute={(r) => r.subordinated / r.nav} format={(v) => PCT(v)} />
      </div>

      <div className="px-6 pb-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border">
          <div className="section-title px-4 pt-3">Composição por cotas / classes</div>
          <table className="w-full mt-2 text-[12px]">
            <thead className="bg-surface-2 text-muted-foreground">
              <tr className="hairline-b">
                <th className="text-left px-3 py-2 font-medium">Classe</th>
                <th className="text-left px-3 py-2 font-medium">ISIN</th>
                <th className="text-left px-3 py-2 font-medium">Tipo</th>
                <th className="text-right px-3 py-2 font-medium">PL classe</th>
                <th className="text-right px-3 py-2 font-medium">Cota</th>
                <th className="text-right px-3 py-2 font-medium">Nº cotas</th>
                <th className="text-left px-3 py-2 font-medium">Senioridade</th>
                <th className="text-left px-3 py-2 font-medium">Rating</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c, i) => {
                const share = i === 0 ? 0.82 : 0.18;
                const nav = (r?.nav ?? 0) * share * 0.997;
                const cota = (r?.quotaValue ?? 1) * (c.type === "Sênior" ? 1 : 0.95);
                return (
                  <tr key={c.id} className="hairline-b">
                    <td className="px-3 py-2 font-medium">{c.className}</td>
                    <td className="px-3 py-2 num text-muted-foreground">{c.isin}</td>
                    <td className="px-3 py-2">{c.type}</td>
                    <td className="px-3 py-2 text-right num">{BRL(nav, { compact: true })}</td>
                    <td className="px-3 py-2 text-right num">{cota.toFixed(6).replace(".", ",")}</td>
                    <td className="px-3 py-2 text-right num">{(nav / cota).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</td>
                    <td className="px-3 py-2">{c.seniority}</td>
                    <td className="px-3 py-2">{c.rating}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="bg-card border border-border p-4">
          <div className="section-title mb-3">Validação de PL</div>
          <Row k="PL total informado" v={r ? BRL(r.nav) : "—"} />
          <Row k="Soma do PL das classes" v={BRL(quotaSum)} />
          <Row k="Diferença absoluta" v={BRL(diff)} />
          <Row k="Diferença percentual" v={PCT(diffPct, 4)} />
          <div className="mt-3">
            <span className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-1 rounded-sm ${
              valStatus === "valid" ? "text-risk-normal bg-risk-normal-bg" :
              valStatus === "warning" ? "text-risk-warning bg-risk-warning-bg" :
              "text-risk-critical bg-risk-critical-bg"
            }`}>
              {valStatus === "valid" ? "Validado" : valStatus === "warning" ? "Alerta" : "Inválido"}
            </span>
          </div>
        </div>
      </div>

      <div className="px-6 pb-4">
        <div className="bg-card border border-border">
          <div className="section-title px-4 pt-3">Histórico mensal</div>
          <div className="overflow-x-auto">
          <table className="w-full mt-2 text-[12px]">
            <thead className="bg-surface-2 text-muted-foreground">
              <tr className="hairline-b">
                <th className="text-left px-3 py-2 font-medium">Mês</th>
                <th className="text-right px-3 py-2 font-medium">PL</th>
                <th className="text-right px-3 py-2 font-medium">Cota</th>
                <th className="text-right px-3 py-2 font-medium">DC</th>
                <th className="text-right px-3 py-2 font-medium">Atraso/DC</th>
                <th className="text-right px-3 py-2 font-medium">Caixa/PL</th>
                <th className="text-right px-3 py-2 font-medium">PDD/Atr.</th>
                <th className="text-right px-3 py-2 font-medium">PDD/DC</th>
                <th className="text-right px-3 py-2 font-medium">Recomp./DC</th>
                <th className="text-right px-3 py-2 font-medium">Subord.</th>
                <th className="text-left px-3 py-2 font-medium">St</th>
              </tr>
            </thead>
            <tbody>
              {history.slice().reverse().map((row) => {
                const mm = metricsFor(id, row.month);
                const stx = statusForFidc(id, row.month);
                const chip = (key: string, v: number | null | undefined, fmt: (x: number) => string) => {
                  const s = v == null ? "missing" : evalStatus(M(key), v);
                  return <MetricChip status={s} value={v == null ? "—" : fmt(v)} />;
                };
                return (
                  <tr key={row.month} className="hairline-b">
                    <td className="px-3 py-2 font-medium">{monthLabel(row.month)}</td>
                    <td className="px-3 py-2 text-right num">{BRL(row.nav, { compact: true })}</td>
                    <td className="px-3 py-2 text-right num">{row.quotaValue.toFixed(6).replace(".", ",")}</td>
                    <td className="px-3 py-2 text-right num">{BRL(row.creditRights, { compact: true })}</td>
                    <td className="px-3 py-2 text-right">{chip("atraso_dc", mm?.atraso_dc, PCT)}</td>
                    <td className="px-3 py-2 text-right">{chip("caixa_pl", mm?.caixa_pl, PCT)}</td>
                    <td className="px-3 py-2 text-right">{chip("pdd_atrasos", mm?.pdd_atrasos, PCT)}</td>
                    <td className="px-3 py-2 text-right">{chip("pdd_dc", mm?.pdd_dc, PCT)}</td>
                    <td className="px-3 py-2 text-right">{chip("recompras_dc", mm?.recompras_dc, PCT)}</td>
                    <td className="px-3 py-2 text-right">{chip("subordinacao", mm?.subordinacao, PCT)}</td>
                    <td className="px-3 py-2"><RiskStatusBadge status={stx} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      <div className="px-6 pb-8">
        <div className="bg-card border border-border p-5">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="section-title">Parecer de Crédito — {monthLabel(month)}</div>
              <div className="mt-1 flex items-center gap-2">
                <RecBadge rec={op?.recommendation ?? "Manter"} />
                <span className="text-[11px] text-muted-foreground">por {op?.author ?? "—"} · {op?.date ?? "—"}</span>
              </div>
            </div>
            <Link to="/fidc-monitor/pareceres" className="text-[12px] text-primary hover:underline">Editar parecer →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 text-[12.5px]">
            <Block title="Resumo executivo" body={op?.summary} />
            <Block title="Motivo da recomendação" body={op?.reason} />
            <Block title="Pontos positivos" body={op?.positives} />
            <Block title="Pontos de atenção" body={op?.attentions} />
            <Block title="Principais riscos" body={op?.risks} />
            <Block title="Evolução recente" body={op?.evolution} />
          </div>
        </div>
      </div>
    </div>
  );
}

function statusToAccent(key: string, v: number | null | undefined) {
  if (v == null) return "neutral" as const;
  const s = evalStatus(M(key), v);
  return s === "critical" ? "critical" : s === "warning" ? "warning" : "normal";
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-1 text-[12px] hairline-b last:border-b-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="num text-foreground">{v}</span>
    </div>
  );
}
function Block({ title, body }: { title: string; body?: string }) {
  return (
    <div>
      <div className="section-title mb-1">{title}</div>
      <div className="text-foreground/90 leading-relaxed">{body || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}
function Chart({ title, data, dataKey, compute, format }: {
  title: string;
  data: ReturnType<typeof historyFor>;
  dataKey?: keyof ReturnType<typeof historyFor>[number];
  compute?: (r: ReturnType<typeof historyFor>[number]) => number;
  format: (v: number) => string;
}) {
  const series = data.map((r) => ({ month: monthLabel(r.month), value: compute ? compute(r) : (r[dataKey!] as number) }));
  return (
    <div className="bg-card border border-border p-3">
      <div className="section-title mb-1">{title}</div>
      <div className="text-[11px] text-foreground/90 num mb-1">{series.length ? format(series[series.length - 1].value) : "—"}</div>
      <div className="h-[110px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeOpacity={0.06} vertical={false} />
            <XAxis dataKey="month" hide />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11, borderRadius: 3 }}
              labelStyle={{ color: "hsl(var(--muted-foreground))" }}
              formatter={(v: number) => format(v)}
            />
            <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
