import { useEffect, useMemo, useState } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFidcMonitorData } from "@/hooks/useFidcMonitorData";
import { BRL, PCT, formatCNPJ, monthLabel } from "@/lib/fidc/format";
import { MetricCard } from "@/components/fidc/MetricCard";
import { NoDataInline } from "@/components/fidc/NoDataChip";
import { MonthlyReportImportDialog } from "@/components/fidc/MonthlyReportImportDialog";
import { LaminateCharts } from "@/components/fidc/laminate/LaminateCharts";
import { CreditPortfolio } from "@/components/fidc/laminate/CreditPortfolio";
import { QuotasSection } from "@/components/fidc/laminate/QuotasSection";
import { AlertsPanel } from "@/components/fidc/laminate/AlertsPanel";
import { CreditOpinionPanel } from "@/components/fidc/laminate/CreditOpinionPanel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Loader2, AlertTriangle, Upload, CheckCircle2, Printer, ChevronDown } from "lucide-react";
import "@/styles/fidc-print.css";

// Status helpers
type InformeStatus = "Pendente" | "Importado" | "Parcial" | "Com alerta" | "Crítico";
type CreditStatus = "Normal" | "Atenção" | "Crítico" | "N/D";

function informeStatusOf(r: Record<string, unknown> | null): InformeStatus {
  if (!r) return "Pendente";
  const v = String(r.quota_validation_status ?? "");
  if (v === "invalid" || v === "cotas_ausentes") return "Crítico";
  if (v === "warning") return "Com alerta";
  if (v === "valid") return "Importado";
  return "Parcial";
}

function creditStatusOf(r: Record<string, unknown> | null): CreditStatus {
  if (!r) return "N/D";
  const dc = Number(r.credit_rights_value ?? 0);
  const overdue = Number(r.overdue_value ?? 0);
  const pdd = Math.abs(Number(r.pdd_value ?? 0));
  if (dc <= 0) return "N/D";
  const atraso = overdue / dc;
  const pddDc = pdd / dc;
  if (atraso > 0.2 || pddDc > 0.1) return "Crítico";
  if (atraso > 0.1 || pddDc > 0.05) return "Atenção";
  return "Normal";
}

function StatusChip({ label, value, kind }: { label: string; value: string; kind: "informe" | "credit" | "rec" }) {
  const palette: Record<string, string> = {
    Normal: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    Importado: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    Manter: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    Atenção: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    "Com alerta": "bg-amber-500/15 text-amber-700 border-amber-500/30",
    Parcial: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    Acompanhar: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    Crítico: "bg-red-500/15 text-red-700 border-red-500/30",
    Reduzir: "bg-orange-500/15 text-orange-700 border-orange-500/30",
    Zerar: "bg-red-500/15 text-red-700 border-red-500/30",
    Pendente: "bg-muted text-muted-foreground border-border",
    "N/D": "bg-muted text-muted-foreground border-border",
  };
  const cls = palette[value] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className="inline-flex flex-col items-start">
      <span className="text-[9.5px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`mt-0.5 inline-flex items-center rounded-sm border px-2 py-0.5 text-[11px] font-medium ${cls}`}>{value}</span>
    </span>
  );
}

export default function FidcDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const {
    fidcById, portfoliosForFidc, portfolioSummaries, exposureForFidc,
    latestValDate, isLoading, positionAlerts,
  } = useFidcMonitorData();
  const [importOpen, setImportOpen] = useState(false);

  const { data: quotas = [] } = useQuery({
    queryKey: ["fidc-detail-quotas", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("fidc_quota_classes").select("*").eq("fidc_id", id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: latestReport = null } = useQuery({
    queryKey: ["fidc-monthly-reports", id, "latest"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fidc_monthly_reports").select("*")
        .eq("fidc_id", id).eq("is_current_version", true)
        .order("reference_month", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data as Record<string, unknown> | null;
    },
    enabled: !!id,
  });

  const { data: prevReport = null } = useQuery({
    queryKey: ["fidc-monthly-reports", id, "prev", latestReport?.reference_month ?? null],
    queryFn: async () => {
      const ref = latestReport?.reference_month as string | undefined;
      if (!ref) return null;
      const { data, error } = await supabase
        .from("fidc_monthly_reports")
        .select("nav_value, quota_value, reference_month, credit_rights_value, overdue_value, pdd_value")
        .eq("fidc_id", id).eq("is_current_version", true)
        .lt("reference_month", ref)
        .order("reference_month", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data as Record<string, unknown> | null;
    },
    enabled: !!id && !!latestReport?.reference_month,
  });

  const { data: reportsHistory = [] } = useQuery({
    queryKey: ["fidc-monthly-reports", id, "history-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fidc_monthly_reports")
        .select("id, reference_month, nav_value, quota_value, credit_rights_value, overdue_value, overdue_30d_value, overdue_60d_value, overdue_90d_value, overdue_120d_value, pdd_value, cash_value, repurchase_value, subordinated_value, acquisitions_value, substitutions_value, disposals_value, investors_count, subordinated_calculation_status")
        .eq("fidc_id", id).eq("is_current_version", true)
        .order("reference_month", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<Record<string, unknown>>;
    },
    enabled: !!id,
  });

  // Phase 5 — segmentos detalhados (TAB II) para o mês corrente
  const { data: segmentRows = [] } = useQuery({
    queryKey: ["fidc-monthly-segments", id, latestReport?.reference_month ?? null],
    queryFn: async () => {
      const ref = latestReport?.reference_month as string | undefined;
      if (!ref) return [];
      const { data, error } = await supabase
        .from("fidc_monthly_segments")
        .select("segment_group, segment_name, value, pct_of_segment_portfolio")
        .eq("fidc_id", id).eq("reference_month", ref);
      if (error) throw error;
      return (data ?? []) as Array<{ segment_group: string; segment_name: string; value: number | null; pct_of_segment_portfolio: number | null }>;
    },
    enabled: !!id && !!latestReport?.reference_month,
  });

  useEffect(() => () => {
    document.body.classList.remove("print-summary");
  }, []);

  const refMonthEarly = latestReport?.reference_month ? String(latestReport.reference_month).slice(0, 10) : null;

  // Buscar recomendação atual (deve ser chamado antes de qualquer early return)
  const recQ = useQuery({
    queryKey: ["fidc-rec-latest", id, refMonthEarly],
    queryFn: async () => {
      if (!refMonthEarly) return null;
      const { data } = await supabase
        .from("credit_opinions").select("recommendation")
        .eq("fidc_id", id).eq("reference_month", refMonthEarly).maybeSingle();
      return (data as { recommendation?: string } | null)?.recommendation ?? null;
    },
    enabled: !!refMonthEarly,
  });

  if (isLoading) {
    return <div className="px-6 py-12 text-center text-muted-foreground text-[12px]">
      <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando…
    </div>;
  }

  const f = fidcById(id);
  if (!f) return <Navigate to="/fidc-monitor/fidcs" replace />;

  const ports = portfoliosForFidc(id);
  const exposureTotal = exposureForFidc(id);
  const positionsByPortfolio = portfolioSummaries.map((s) => ({
    portfolio: s.portfolio,
    summary: s,
    positions: s.positions.filter((p) => p.fidcId === id),
  })).filter((x) => x.positions.length > 0);

  const informeStatus = informeStatusOf(latestReport);
  const creditStatus = creditStatusOf(latestReport);
  const navTotal = latestReport ? Number(latestReport.nav_value ?? 0) : 0;
  const refMonth = refMonthEarly;

  const recCurrent = recQ.data
    ? { manter: "Manter", acompanhar: "Acompanhar", reduzir: "Reduzir", zerar: "Zerar" }[recQ.data as string] ?? "N/D"
    : "N/D";


  function doPrint(mode: "full" | "summary") {
    document.body.classList.toggle("print-summary", mode === "summary");
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove("print-summary"), 500);
    }, 50);
  }

  // Risk summary template
  const riskText = (() => {
    if (!latestReport) return "Sem informe mensal importado — sem dados para resumo de risco.";
    const r = latestReport;
    const dc = Number(r.credit_rights_value ?? 0);
    const nav = Number(r.nav_value ?? 0);
    const overdue = Number(r.overdue_value ?? 0);
    const pdd = Math.abs(Number(r.pdd_value ?? 0));
    const cash = Number(r.cash_value ?? 0);
    const prevNav = prevReport ? Number(prevReport.nav_value ?? NaN) : NaN;
    const navVar = Number.isFinite(prevNav) && prevNav > 0 ? (nav - prevNav) / prevNav : null;
    return (
      `No mês de ${monthLabel(refMonth!)}, o FIDC apresentou PL de ${BRL(nav, { compact: true })}` +
      (navVar != null ? ` (variação mensal de ${PCT(navVar)})` : "") +
      `, Atraso/DC de ${dc > 0 ? PCT(overdue / dc) : "N/D"}, ` +
      `PDD/DC de ${dc > 0 ? PCT(pdd / dc) : "N/D"} e Caixa/PL de ${nav > 0 ? PCT(cash / nav) : "N/D"}. ` +
      `Status do informe: ${informeStatus}. Status de crédito: ${creditStatus}.`
    );
  })();

  return (
    <div className="laminate">
      {/* Logo apenas na impressão */}
      <div className="print-only px-0 py-2 mb-2 border-b border-border text-[10px] text-muted-foreground">
        BUTIÁ RESEARCH PLATFORM · Lâmina de Crédito FIDC
      </div>

      {/* HEADER EXECUTIVO */}
      <header className="px-6 py-4 hairline-b" data-print-section>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[22px] font-semibold tracking-tight">{f.name}</h1>
              {latestReport ? (
                <span className="inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11px] bg-emerald-500/15 text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> Informe {monthLabel(refMonth!)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11px] bg-muted/40 text-muted-foreground">
                  <AlertTriangle className="h-3 w-3" /> Informe mensal pendente
                </span>
              )}
            </div>
            <div className="mt-2 text-[11.5px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              <span>CNPJ <span className="num text-foreground">{f.cnpj ? formatCNPJ(f.cnpj) : "—"}</span></span>
              {f.manager && <span>Gestor <span className="text-foreground">{f.manager}</span></span>}
              {f.administrator && <span>Administrador <span className="text-foreground">{f.administrator}</span></span>}
              {f.custodian && <span>Custodiante <span className="text-foreground">{f.custodian}</span></span>}
              {f.sector && <span>Setor/ANBIMA <span className="text-foreground">{f.sector}</span></span>}
              {f.fidc_type && <span>Tipo <span className="text-foreground">{f.fidc_type}</span></span>}
              <span>Data posição <span className="text-foreground">{latestValDate ?? "—"}</span></span>
            </div>
            <div className="mt-3 flex items-center gap-5 flex-wrap">
              <StatusChip label="Status do informe" value={informeStatus} kind="informe" />
              <StatusChip label="Status de crédito" value={creditStatus} kind="credit" />
              <StatusChip label="Recomendação" value={recCurrent} kind="rec" />
              <div className="text-[11px] text-muted-foreground">
                Carteiras Butiá: <span className="text-foreground">{ports.map((p) => p.name).join(", ") || "—"}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2" data-print="hide">
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)} className="h-8 text-[11.5px]">
              <Upload className="h-3.5 w-3.5 mr-1.5" /> Importar Informe Mensal
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="h-8 text-[11.5px]">
                  <Printer className="h-3.5 w-3.5 mr-1.5" /> Exportar Lâmina PDF
                  <ChevronDown className="h-3.5 w-3.5 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => doPrint("full")}>PDF completo</DropdownMenuItem>
                <DropdownMenuItem onClick={() => doPrint("summary")}>PDF resumido</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* RESUMO DE RISCO */}
      <section className="px-6 py-4 hairline-b" data-print-section>
        <div className="section-title mb-2">Resumo de Risco do Mês</div>
        <p className="text-[13px] leading-relaxed text-foreground/90 max-w-4xl">{riskText}</p>
      </section>

      {/* INDICADORES PRINCIPAIS */}
      <section className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3" data-print-section>
        <MetricCard label="Exposição Butiá" value={BRL(exposureTotal, { compact: true })} hint={`${ports.length} carteira(s)`} />
        {(() => {
          const r = latestReport;
          const n = (k: string) => r?.[k] != null ? Number(r[k]) : null;
          const nav = n("nav_value");
          const cota = n("quota_value");
          const dc = n("credit_rights_value");
          const overdue = n("overdue_value");
          const pdd = n("pdd_value");
          const cash = n("cash_value");
          const rep = n("repurchase_value");
          const acq = n("acquisitions_value");
          const subVal = n("subordinated_value");
          const inv = n("investors_count");
          const subStatus = String(r?.subordinated_calculation_status ?? "");
          const subOk = subStatus === "ok";
          const prevNav = prevReport ? Number(prevReport.nav_value ?? NaN) : NaN;
          const prevCota = prevReport ? Number(prevReport.quota_value ?? NaN) : NaN;
          const varPl = Number.isFinite(prevNav) && prevNav > 0 && nav != null ? (nav / prevNav - 1) : null;
          const varCota = Number.isFinite(prevCota) && prevCota > 0 && cota != null ? (cota / prevCota - 1) : null;
          const ratio = (a: number | null, b: number | null) => a != null && b != null && b !== 0 ? a / b : null;
          const sub = subOk && subVal != null && nav ? subVal / nav : null;
          const cell = (v: string | null) => v == null ? <NoDataInline /> : <>{v}</>;
          return (
            <>
              <MetricCard label="PL" value={cell(nav != null ? BRL(nav, { compact: true }) : null)} />
              <MetricCard label="Var. mensal PL" value={cell(varPl != null ? PCT(varPl) : null)} accent={varPl != null && varPl < -0.05 ? "warning" : "neutral"} />
              <MetricCard label="Cota" value={cell(cota != null ? cota.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 8 }) : null)} />
              <MetricCard label="Rent. mês cota" value={cell(varCota != null ? PCT(varCota, 2) : null)} accent={varCota != null && varCota < 0 ? "warning" : "neutral"} />
              <MetricCard label="Direitos Creditórios" value={cell(dc != null ? BRL(dc, { compact: true }) : null)} />
              <MetricCard label="DC/PL" value={cell(ratio(dc, nav) != null ? PCT(ratio(dc, nav)!) : null)} />
              <MetricCard label="Caixa/PL" value={cell(ratio(cash, nav) != null ? PCT(ratio(cash, nav)!) : null)} accent={ratio(cash, nav) != null && ratio(cash, nav)! < 0.02 ? "warning" : "neutral"} />
              {(() => {
                const overdueSrc = r?.overdue_source ? String(r.overdue_source) : null;
                const coverage = r?.overdue_bucket_coverage_status ? String(r.overdue_bucket_coverage_status) : null;
                const vTabI = r?.overdue_value_tab_i != null ? Number(r.overdue_value_tab_i) : null;
                const vTabVVI = r?.overdue_value_tab_v_vi != null ? Number(r.overdue_value_tab_v_vi) : null;
                const tipParts = [
                  vTabI != null ? `TAB I: ${BRL(vTabI, { compact: true })}` : `TAB I: —`,
                  vTabVVI != null ? `TAB V/VI: ${BRL(vTabVVI, { compact: true })}` : `TAB V/VI: —`,
                  overdueSrc ? `Fonte: ${overdueSrc === "tab_i" ? "TAB I (créditos vencidos/inadimplentes)" : overdueSrc === "tab_v_vi" ? "TAB V/VI (faixas)" : "sem inadimplência reportada"}` : "",
                  coverage === "sem_abertura_por_faixa" ? "Aviso: inadimplência positiva na TAB I, sem abertura por faixa na TAB V/VI." : "",
                ].filter(Boolean).join(" · ");
                const ratioVal = ratio(overdue, dc);
                const noFaixa = coverage === "sem_abertura_por_faixa";
                const ndTooltip = "A CVM reportou créditos vencidos/inadimplentes na TAB I, mas não trouxe abertura por faixa na TAB V/TAB VI.";
                return (
                  <>
                    <span title={tipParts}>
                      <MetricCard
                        label={`Atraso/DC${noFaixa ? " ⚠" : ""}`}
                        value={cell(ratioVal != null ? PCT(ratioVal) : null)}
                        accent={ratioVal != null && ratioVal > 0.1 ? (ratioVal > 0.2 ? "critical" : "warning") : "neutral"}
                      />
                    </span>
                    {noFaixa ? (
                      <>
                        <span title={ndTooltip}><MetricCard label="≤30d/DC" value={<span className="text-muted-foreground">N/D</span>} /></span>
                        <span title={ndTooltip}><MetricCard label="≤60d/DC" value={<span className="text-muted-foreground">N/D</span>} /></span>
                        <span title={ndTooltip}><MetricCard label="≤90d/DC" value={<span className="text-muted-foreground">N/D</span>} /></span>
                        <span title={ndTooltip}><MetricCard label="≤120d/DC" value={<span className="text-muted-foreground">N/D</span>} /></span>
                      </>
                    ) : (
                      <>
                        <MetricCard label="≤30d/DC" value={cell(ratio(n("overdue_30d_value"), dc) != null ? PCT(ratio(n("overdue_30d_value"), dc)!) : null)} />
                        <MetricCard label="≤60d/DC" value={cell(ratio(n("overdue_60d_value"), dc) != null ? PCT(ratio(n("overdue_60d_value"), dc)!) : null)} />
                        <MetricCard label="≤90d/DC" value={cell(ratio(n("overdue_90d_value"), dc) != null ? PCT(ratio(n("overdue_90d_value"), dc)!) : null)} />
                        <MetricCard label="≤120d/DC" value={cell(ratio(n("overdue_120d_value"), dc) != null ? PCT(ratio(n("overdue_120d_value"), dc)!) : null)} />
                      </>
                    )}
                  </>
                );
              })()}
              <MetricCard label="PDD/DC" value={cell(ratio(pdd != null ? Math.abs(pdd) : null, dc) != null ? PCT(ratio(Math.abs(pdd!), dc)!) : null)} accent={ratio(pdd != null ? Math.abs(pdd) : null, dc) != null && ratio(Math.abs(pdd!), dc)! > 0.05 ? "warning" : "neutral"} />
              <MetricCard label="PDD/Atrasos" value={cell(overdue && overdue !== 0 && pdd != null ? PCT(Math.abs(pdd) / overdue) : null)} />
              <MetricCard label="Recompras/DC" value={cell(ratio(rep, dc) != null ? PCT(ratio(rep, dc)!) : null)} />
              <MetricCard label="Aquisições/DC" value={cell(ratio(acq, dc) != null ? PCT(ratio(acq, dc)!) : null)} />
              <MetricCard
                label="Subordinação"
                value={subOk
                  ? cell(sub != null ? PCT(sub) : null)
                  : <span title="Soma das cotas diferente do PL — não confiável" className="text-amber-600 text-[13px]">Inconsistente</span>}
              />
              <MetricCard label="Cotistas" value={cell(inv != null ? inv.toLocaleString("pt-BR") : null)} />
            </>
          );
        })()}
      </section>

      {/* POSIÇÃO BUTIÁ */}
      <section className="px-6 py-4" data-print-section>
        <div className="bg-card border border-border">
          <div className="px-4 pt-3 flex items-center justify-between">
            <div>
              <div className="section-title">Posição Butiá</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Exposição total: <strong className="text-foreground">{BRL(exposureTotal, { compact: true })}</strong>
                {navTotal > 0 && <> · {PCT(exposureTotal / navTotal)} do PL do FIDC</>}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full mt-2 text-[12px]">
              <thead className="bg-surface-2 text-muted-foreground">
                <tr className="hairline-b">
                  <th className="text-left px-3 py-2 font-medium">Carteira</th>
                  <th className="text-left px-3 py-2 font-medium">ISIN</th>
                  <th className="text-left px-3 py-2 font-medium">Classe</th>
                  <th className="text-right px-3 py-2 font-medium">Exposição</th>
                  <th className="text-right px-3 py-2 font-medium">% Carteira</th>
                  <th className="text-right px-3 py-2 font-medium">% PL FIDC</th>
                  <th className="text-left px-3 py-2 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {positionsByPortfolio.flatMap(({ portfolio, summary, positions }) =>
                  positions.map((p, i) => (
                    <tr key={`${portfolio.id}-${i}`} className="hairline-b">
                      <td className="px-3 py-2 font-medium">{portfolio.name}</td>
                      <td className="px-3 py-2 num">{p.isin}</td>
                      <td className="px-3 py-2">{p.quota?.class_name || p.quota?.internal_quota_name || "—"}</td>
                      <td className="px-3 py-2 text-right num">{BRL(p.value, { compact: true })}</td>
                      <td className="px-3 py-2 text-right num">{summary.nav > 0 ? PCT(p.value / summary.nav) : "—"}</td>
                      <td className="px-3 py-2 text-right num text-muted-foreground">
                        {navTotal > 0 ? PCT(p.value / navTotal) : "—"}
                      </td>
                      <td className="px-3 py-2 num text-muted-foreground">{p.valDate}</td>
                    </tr>
                  ))
                )}
                {positionsByPortfolio.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground text-[11.5px]">
                    Sem posições nesta data.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* GRÁFICOS HISTÓRICOS */}
      <section className="px-6 pb-4" data-print-section>
        <div className="bg-card border border-border">
          <div className="section-title px-4 pt-3">Evolução Histórica</div>
          <LaminateCharts history={reportsHistory} />
        </div>
      </section>

      {/* BALANÇO, NEGÓCIOS E FLUXO DE COTISTAS (Phase 5 — CVM) */}
      {latestReport && (() => {
        const r = latestReport;
        const n = (k: string) => r?.[k] != null ? Number(r[k]) : null;
        const items: Array<{ label: string; value: string; hint?: string }> = [];
        const fmtBRL = (v: number | null) => v == null ? "—" : BRL(v, { compact: true });
        const fmtNum = (v: number | null) => v == null ? "—" : v.toLocaleString("pt-BR");
        const seg = String(r?.main_segment ?? "").trim();
        const segPct = n("main_segment_pct");
        items.push({ label: "Ativo total (I)", value: fmtBRL(n("total_assets")) });
        items.push({ label: "Passivo total (III)", value: fmtBRL(n("total_liabilities")) });
        items.push({ label: "PL médio (IV.b)", value: fmtBRL(n("avg_nav_value")) });
        items.push({ label: "Caixa estrito (I.1)", value: fmtBRL(n("cash_strict_value")) });
        items.push({ label: "Subscrições (X.4)", value: fmtBRL(n("total_subscription_value")) });
        items.push({ label: "Resgates (X.4)", value: fmtBRL(n("total_redemption_value")) });
        items.push({ label: "Amortizações (X.4)", value: fmtBRL(n("total_amortization_value")) });
        items.push({ label: "Fluxo líquido cotistas", value: fmtBRL(n("net_investor_flow_value")), hint: "Subscrições − Resgates − Amortizações" });
        items.push({ label: "Segmento principal", value: seg || "—", hint: segPct != null ? `${PCT(segPct, 1)} da carteira` : undefined });
        if (!items.some((i) => i.value !== "—")) return null;
        return (
          <section className="px-6 pb-4" data-print-section>
            <div className="bg-card border border-border">
              <div className="section-title px-4 pt-3">Balanço, Negócios e Fluxo de Cotistas</div>
              <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-[12px]">
                {items.map((it, i) => (
                  <div key={i} className="border border-border px-2.5 py-2">
                    <div className="text-[10.5px] text-muted-foreground">{it.label}</div>
                    <div className="text-[14px] font-semibold num mt-0.5">{it.value}</div>
                    {it.hint && <div className="text-[10px] text-muted-foreground mt-0.5">{it.hint}</div>}
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })()}

      {/* CARTEIRA DE CRÉDITO */}
      <section className="px-6 pb-4" data-print-summary="hide">
        {(() => {
          // Phase 5 — segmentos vindos da TAB II; fallback ao breakdown legado no raw_data
          const segmentsFromTable = segmentRows
            .filter((s) => s.segment_group === "main" && (s.value ?? 0) > 0)
            .map((s) => ({ bucket: s.segment_name, value: Number(s.value ?? 0) }));
          const segments = segmentsFromTable.length
            ? segmentsFromTable
            : ((latestReport?.segment_breakdown as { bucket: string; value: number }[] | null) ?? null);

          // Maturidade consolidada V+VI (colunas dedicadas)
          const r = latestReport ?? {};
          const num = (k: string) => r?.[k] != null ? Number(r[k]) : null;
          const matBuckets: Array<{ bucket: string; value: number }> = [
            ["0-30d", "maturity_0_30_value"],
            ["31-60d", "maturity_31_60_value"],
            ["61-90d", "maturity_61_90_value"],
            ["91-120d", "maturity_91_120_value"],
            ["121-150d", "maturity_121_150_value"],
            ["151-180d", "maturity_151_180_value"],
            ["181-360d", "maturity_181_360_value"],
            ["361-720d", "maturity_361_720_value"],
            ["721-1080d", "maturity_721_1080_value"],
            ["acima 1080d", "maturity_over_1080_value"],
          ].map(([b, k]) => ({ bucket: b, value: num(k) ?? 0 })).filter((x) => x.value > 0);
          const maturity = matBuckets.length
            ? matBuckets
            : ((latestReport?.maturity_breakdown as { bucket: string; value: number }[] | null) ?? null);

          // Inadimplência por faixa
          const delBuckets: Array<{ bucket: string; value: number }> = [
            ["0-30d", "delinquency_0_30_value"],
            ["31-60d", "delinquency_31_60_value"],
            ["61-90d", "delinquency_61_90_value"],
            ["91-120d", "delinquency_91_120_value"],
            ["121-150d", "delinquency_121_150_value"],
            ["151-180d", "delinquency_151_180_value"],
            ["181-360d", "delinquency_181_360_value"],
            ["361-720d", "delinquency_361_720_value"],
            ["721-1080d", "delinquency_721_1080_value"],
            ["acima 1080d", "delinquency_over_1080_value"],
          ].map(([b, k]) => ({ bucket: b, value: num(k) ?? 0 })).filter((x) => x.value > 0);
          const overdueByBucket = delBuckets.length
            ? delBuckets
            : ((latestReport?.overdue_breakdown as { bucket: string; value: number }[] | null) ?? null);

          const overdueHeadline = latestReport?.overdue_value != null ? Number(latestReport.overdue_value) : null;
          const overdueSource = latestReport?.overdue_source ? String(latestReport.overdue_source) : null;
          const coverageStatus = latestReport?.overdue_bucket_coverage_status ? String(latestReport.overdue_bucket_coverage_status) : null;
          const unbucketed = latestReport?.delinquency_unbucketed_value != null ? Number(latestReport.delinquency_unbucketed_value) : 0;

          return (
            <CreditPortfolio
              segments={segments}
              maturity={maturity}
              overdueByBucket={overdueByBucket}
              overdueHeadlineValue={overdueHeadline}
              overdueSource={overdueSource}
              overdueBucketCoverageStatus={coverageStatus}
              delinquencyUnbucketedValue={unbucketed}
              assignors={(latestReport?.assignors_breakdown as { bucket: string; value: number }[] | null) ?? null}
              guaranteesValue={latestReport?.guarantees_value != null ? Number(latestReport.guarantees_value) : null}
              guaranteesPctDc={latestReport?.guarantees_pct_dc != null ? Number(latestReport.guarantees_pct_dc) : null}
              scrStatus={latestReport?.scr_status ? String(latestReport.scr_status) : null}
              scrValue={latestReport?.scr_value != null ? Number(latestReport.scr_value) : null}
              creditRightsValue={latestReport?.credit_rights_value != null ? Number(latestReport.credit_rights_value) : null}
            />
          );
        })()}
      </section>

      {/* COTAS, SUBORDINAÇÃO E VALIDAÇÕES */}
      <section className="px-6 pb-4">
        <QuotasSection
          reportId={latestReport ? String(latestReport.id) : null}
          fidcId={id}
          latestReport={latestReport}
          masterQuotas={quotas as any}
        />
      </section>

      {/* ALERTAS */}
      <section className="px-6 pb-4">
        <AlertsPanel
          report={latestReport}
          prevReport={prevReport}
          positionAlerts={positionAlerts
            .filter((a) => a.fidcId === id || (a.portfolioName && ports.some((p) => p.name === a.portfolioName)))
            .map((a) => ({ severity: a.severity, message: a.message, kind: a.kind }))}
        />
      </section>

      {/* HISTÓRICO MENSAL DETALHADO (apenas tela / PDF completo) */}
      <section className="px-6 pb-4" data-print-summary="hide">
        <div className="bg-card border border-border">
          <div className="section-title px-4 pt-3">Histórico mensal — informes importados</div>
          <div className="overflow-x-auto">
            <table className="w-full mt-2 text-[12px]">
              <thead className="bg-surface-2 text-muted-foreground">
                <tr className="hairline-b">
                  <th className="text-left px-3 py-2 font-medium">Mês</th>
                  <th className="text-right px-3 py-2 font-medium">PL</th>
                  <th className="text-right px-3 py-2 font-medium">Cota</th>
                  <th className="text-right px-3 py-2 font-medium">DC</th>
                  <th className="text-right px-3 py-2 font-medium">Atraso/DC</th>
                  <th className="text-right px-3 py-2 font-medium">PDD/DC</th>
                  <th className="text-right px-3 py-2 font-medium">Caixa/PL</th>
                  <th className="text-right px-3 py-2 font-medium">Cotistas</th>
                </tr>
              </thead>
              <tbody>
                {reportsHistory.map((r) => {
                  const dc = Number(r.credit_rights_value ?? 0);
                  const nav = Number(r.nav_value ?? 0);
                  const overdue = Number(r.overdue_value ?? 0);
                  const pdd = Math.abs(Number(r.pdd_value ?? 0));
                  const cash = Number(r.cash_value ?? 0);
                  return (
                    <tr key={String(r.id)} className="hairline-b">
                      <td className="px-3 py-2 font-medium">{monthLabel(String(r.reference_month).slice(0, 10))}</td>
                      <td className="px-3 py-2 text-right num">{BRL(nav, { compact: true })}</td>
                      <td className="px-3 py-2 text-right num">{r.quota_value != null ? Number(r.quota_value).toLocaleString("pt-BR", { maximumFractionDigits: 6 }) : "—"}</td>
                      <td className="px-3 py-2 text-right num">{BRL(dc, { compact: true })}</td>
                      <td className="px-3 py-2 text-right num">{dc > 0 ? PCT(overdue / dc) : "—"}</td>
                      <td className="px-3 py-2 text-right num">{dc > 0 ? PCT(pdd / dc) : "—"}</td>
                      <td className="px-3 py-2 text-right num">{nav > 0 ? PCT(cash / nav) : "—"}</td>
                      <td className="px-3 py-2 text-right num">{r.investors_count != null ? Number(r.investors_count).toLocaleString("pt-BR") : "—"}</td>
                    </tr>
                  );
                })}
                {reportsHistory.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground text-[11.5px]">
                    Nenhum informe mensal importado ainda.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* PARECER DE CRÉDITO */}
      <section className="px-6 pb-8">
        <CreditOpinionPanel fidcId={id} fidcName={f.name} latestReport={latestReport} />
      </section>

      <MonthlyReportImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        fidcId={id}
        fidcName={f.name}
        fidcCnpj={f.cnpj ?? null}
      />
    </div>
  );
}
