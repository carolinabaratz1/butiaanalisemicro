// Painel de alertas do mês — separado em Crédito, Qualidade e Posição.
import { AlertTriangle, AlertCircle, ShieldAlert } from "lucide-react";
import { PCT } from "@/lib/fidc/format";

type Sev = "warning" | "critical";
export type LaminateAlert = { severity: Sev; message: string };

type Props = {
  report: Record<string, unknown> | null;
  prevReport: Record<string, unknown> | null;
  positionAlerts: { severity: "warning" | "critical"; message: string; kind: string }[];
};

const THRESHOLDS = {
  atraso: 0.10,         // > 10% warning, > 20% critical
  atrasoCrit: 0.20,
  pddDc: 0.05,
  pddDcCrit: 0.10,
  caixaMin: 0.02,
  recompras: 0.05,
  recomprasCrit: 0.10,
  o30: 0.03, o30Crit: 0.06,
  o60: 0.02, o60Crit: 0.04,
  o90: 0.015, o90Crit: 0.03,
  o120: 0.01, o120Crit: 0.025,
  navQueda: -0.10, navQuedaCrit: -0.20,
  cotaQueda: -0.02, cotaQuedaCrit: -0.05,
};

function buildCreditAlerts(r: Record<string, unknown> | null, prev: Record<string, unknown> | null): LaminateAlert[] {
  if (!r) return [];
  const out: LaminateAlert[] = [];
  const dc = Number(r.credit_rights_value ?? 0);
  const nav = Number(r.nav_value ?? 0);
  const subStatus = String(r.subordinated_calculation_status ?? "");
  const subReliable = subStatus === "ok";

  const ratio = (k: string) => {
    const v = Number(r[k] ?? 0);
    return dc > 0 ? v / dc : null;
  };
  const pushPct = (val: number | null, label: string, warn: number, crit: number) => {
    if (val == null) return;
    if (val > crit) out.push({ severity: "critical", message: `${label} em ${PCT(val)}` });
    else if (val > warn) out.push({ severity: "warning", message: `${label} em ${PCT(val)}` });
  };
  const atraso = ratio("overdue_value"); pushPct(atraso, "Atraso/DC", THRESHOLDS.atraso, THRESHOLDS.atrasoCrit);
  pushPct(ratio("overdue_30d_value"), "≤30d/DC", THRESHOLDS.o30, THRESHOLDS.o30Crit);
  pushPct(ratio("overdue_60d_value"), "≤60d/DC", THRESHOLDS.o60, THRESHOLDS.o60Crit);
  pushPct(ratio("overdue_90d_value"), "≤90d/DC", THRESHOLDS.o90, THRESHOLDS.o90Crit);
  pushPct(ratio("overdue_120d_value"), "≤120d/DC", THRESHOLDS.o120, THRESHOLDS.o120Crit);
  const pdd = Math.abs(Number(r.pdd_value ?? 0));
  const pddDc = dc > 0 ? pdd / dc : null;
  pushPct(pddDc, "PDD/DC", THRESHOLDS.pddDc, THRESHOLDS.pddDcCrit);

  const overdueVal = Number(r.overdue_value ?? 0);
  if (overdueVal > 0) {
    const pddAt = pdd / overdueVal;
    if (pddAt < 0.5) out.push({ severity: pddAt < 0.3 ? "critical" : "warning", message: `Cobertura PDD/Atrasos baixa: ${PCT(pddAt)}` });
  }

  const caixaPct = nav > 0 ? Number(r.cash_value ?? 0) / nav : null;
  if (caixaPct != null && caixaPct < THRESHOLDS.caixaMin) {
    out.push({ severity: caixaPct < 0.005 ? "critical" : "warning", message: `Caixa/PL baixo: ${PCT(caixaPct)}` });
  }

  pushPct(ratio("repurchase_value"), "Recompras/DC", THRESHOLDS.recompras, THRESHOLDS.recomprasCrit);

  if (subReliable) {
    const subVal = Number(r.subordinated_value ?? 0);
    const subPct = nav > 0 ? subVal / nav : null;
    if (subPct != null && subPct < 0.10) {
      out.push({ severity: subPct < 0.05 ? "critical" : "warning", message: `Subordinação baixa: ${PCT(subPct)}` });
    }
  }

  if (prev) {
    const prevNav = Number(prev.nav_value ?? 0);
    if (prevNav > 0) {
      const v = (nav - prevNav) / prevNav;
      if (v < THRESHOLDS.navQueda) {
        out.push({ severity: v < THRESHOLDS.navQuedaCrit ? "critical" : "warning", message: `PL caiu ${PCT(v)} vs. mês anterior` });
      }
    }
    const prevCota = Number(prev.quota_value ?? 0);
    const cota = Number(r.quota_value ?? 0);
    if (prevCota > 0) {
      const v = (cota - prevCota) / prevCota;
      if (v < THRESHOLDS.cotaQueda) {
        out.push({ severity: v < THRESHOLDS.cotaQuedaCrit ? "critical" : "warning", message: `Cota caiu ${PCT(v)} vs. mês anterior` });
      }
    }
  }
  return out;
}

function buildQualityAlerts(r: Record<string, unknown> | null): LaminateAlert[] {
  if (!r) return [];
  const out: LaminateAlert[] = [];
  const vStatus = String(r.quota_validation_status ?? "");
  if (vStatus === "invalid") out.push({ severity: "critical", message: "PL informado divergente da soma das cotas (>0,20%)." });
  else if (vStatus === "warning") out.push({ severity: "warning", message: "Pequena divergência entre PL e soma das cotas." });
  else if (vStatus === "cotas_ausentes") out.push({ severity: "critical", message: "Cotas/classes não encontradas no informe." });

  const sub = String(r.subordinated_calculation_status ?? "");
  if (sub === "invalid") out.push({ severity: "warning", message: "Subordinação inconsistente — não usada nos alertas de crédito." });

  // Ativo - Passivo ≈ PL?
  const raw = (r.raw_data ?? null) as Record<string, unknown> | null;
  const at = Number(raw?.assetsTotal ?? NaN);
  const pa = Number(raw?.liabilitiesTotal ?? NaN);
  const nav = Number(r.nav_value ?? NaN);
  if (Number.isFinite(at) && Number.isFinite(pa) && Number.isFinite(nav) && nav > 0) {
    const diff = Math.abs((at - pa) - nav);
    if (diff / nav > 0.005) {
      out.push({ severity: "warning", message: `Ativo − Passivo não confere com PL (dif. ${PCT(diff / nav, 2)}).` });
    }
  }

  const dc = Number(r.credit_rights_value ?? NaN);
  const seg = Number(raw?.segmentCarteiraTotal ?? NaN);
  if (Number.isFinite(dc) && Number.isFinite(seg) && dc > 0) {
    if (Math.abs(seg - dc) / dc > 0.01) {
      out.push({ severity: "warning", message: `Direitos Creditórios divergem da Carteira por Segmento (II).` });
    }
  }

  // Métricas críticas ausentes
  const required = ["nav_value", "credit_rights_value", "overdue_value", "pdd_value", "cash_value"];
  required.forEach((k) => {
    if (r[k] == null) out.push({ severity: "warning", message: `Métrica ausente no informe: ${k}` });
  });
  return out;
}

export function AlertsPanel({ report, prevReport, positionAlerts }: Props) {
  const creditAlerts = buildCreditAlerts(report, prevReport);
  const qualityAlerts = buildQualityAlerts(report);
  const posAlerts = positionAlerts.map((a) => ({ severity: a.severity, message: a.message } as LaminateAlert));

  return (
    <div className="bg-card border border-border" data-print-section>
      <div className="section-title px-4 pt-3">Alertas do Mês</div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 p-4">
        <Column title="Crédito" icon={<AlertCircle className="h-3.5 w-3.5" />} alerts={creditAlerts} />
        <Column title="Qualidade do informe" icon={<ShieldAlert className="h-3.5 w-3.5" />} alerts={qualityAlerts} />
        <Column title="Posição" icon={<AlertTriangle className="h-3.5 w-3.5" />} alerts={posAlerts} />
      </div>
    </div>
  );
}

function Column({ title, icon, alerts }: { title: string; icon: React.ReactNode; alerts: LaminateAlert[] }) {
  return (
    <div className="border border-border">
      <div className="px-3 py-1.5 hairline-b text-[10.5px] uppercase tracking-wider text-muted-foreground flex items-center justify-between">
        <span className="flex items-center gap-1.5">{icon} {title}</span>
        <span>{alerts.length}</span>
      </div>
      <ul className="text-[11.5px]">
        {alerts.length === 0 && <li className="px-3 py-3 text-center text-muted-foreground text-[11px]">Sem alertas</li>}
        {alerts.map((a, i) => (
          <li key={i} className="px-3 py-2 hairline-b flex items-start gap-2">
            <span className={`mt-1 inline-block h-1.5 w-1.5 rounded-full shrink-0 ${a.severity === "critical" ? "bg-red-500" : "bg-amber-500"}`} />
            <span>{a.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
