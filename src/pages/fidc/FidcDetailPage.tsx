import { useState } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFidcMonitorData } from "@/hooks/useFidcMonitorData";
import { BRL, PCT, formatCNPJ, monthLabel } from "@/lib/fidc/format";
import { MetricCard } from "@/components/fidc/MetricCard";
import { PageHeader } from "@/components/fidc/PageHeader";
import { NoDataChip, NoDataInline } from "@/components/fidc/NoDataChip";
import { MonthlyReportImportDialog } from "@/components/fidc/MonthlyReportImportDialog";
import { FidcHistoryCharts } from "@/components/fidc/FidcHistoryCharts";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Upload, CheckCircle2 } from "lucide-react";

export default function FidcDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const { fidcById, portfoliosForFidc, portfolioSummaries, exposureForFidc, latestValDate, isLoading } = useFidcMonitorData();
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

  const { data: latestReport } = useQuery({
    queryKey: ["fidc-monthly-reports", id, "latest"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fidc_monthly_reports")
        .select("*")
        .eq("fidc_id", id)
        .eq("is_current_version", true)
        .order("reference_month", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Record<string, unknown> | null;
    },
    enabled: !!id,
  });

  const { data: prevReport } = useQuery({
    queryKey: ["fidc-monthly-reports", id, "prev", latestReport?.reference_month ?? null],
    queryFn: async () => {
      const ref = latestReport?.reference_month as string | undefined;
      if (!ref) return null;
      const { data, error } = await supabase
        .from("fidc_monthly_reports")
        .select("nav_value, quota_value, reference_month")
        .eq("fidc_id", id)
        .eq("is_current_version", true)
        .lt("reference_month", ref)
        .order("reference_month", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Record<string, unknown> | null;
    },
    enabled: !!id && !!latestReport?.reference_month,
  });

  const { data: reportsHistory = [] } = useQuery({
    queryKey: ["fidc-monthly-reports", id, "history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fidc_monthly_reports")
        .select("id, reference_month, nav_value, quota_total_nav_value, quota_validation_difference, quota_validation_difference_percentage, quota_validation_status, quota_classes_found_count, subordinated_calculation_status, is_current_version, source_file_name, created_at")
        .eq("fidc_id", id)
        .eq("is_current_version", true)
        .order("reference_month", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<Record<string, unknown>>;
    },
    enabled: !!id,
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
    positions: s.positions.filter((p) => p.fidcId === id),
  })).filter((x) => x.positions.length > 0);

  return (
    <div>
      <div className="px-6 py-4 hairline-b">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[20px] font-semibold tracking-tight">{f.name}</h1>
              {latestReport ? (
                <span className="inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11px] bg-emerald-500/15 text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> Informe {monthLabel(String(latestReport.reference_month).slice(0, 10))}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11px] bg-muted/40 text-muted-foreground">
                  <AlertTriangle className="h-3 w-3" /> Informe mensal pendente
                </span>
              )}
              <Button size="sm" variant="outline" onClick={() => setImportOpen(true)} className="h-7 text-[11.5px]">
                <Upload className="h-3.5 w-3.5 mr-1.5" /> Importar Informe Mensal
              </Button>
            </div>
            <div className="mt-1 text-[11.5px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              <span>CNPJ <span className="num text-foreground">{f.cnpj ? formatCNPJ(f.cnpj) : "—"}</span></span>
              {f.manager && <span>Gestor <span className="text-foreground">{f.manager}</span></span>}
              {f.administrator && <span>Administrador <span className="text-foreground">{f.administrator}</span></span>}
              {f.custodian && <span>Custodiante <span className="text-foreground">{f.custodian}</span></span>}
              {f.main_originator && <span>Originador <span className="text-foreground">{f.main_originator}</span></span>}
              {f.sector && <span>Setor <span className="text-foreground">{f.sector}</span></span>}
              <span>Data posição <span className="text-foreground">{latestValDate ?? "—"}</span></span>
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
        <MetricCard label="Exposição Butiá" value={BRL(exposureTotal, { compact: true })} hint={`${ports.length} carteira(s)`} />
        {(() => {
          const r = latestReport ?? null;
          const num = (k: string): number | null => {
            const v = r?.[k];
            return v == null ? null : Number(v);
          };
          const subStatus = String(r?.subordinated_calculation_status ?? "");
          const subOk = subStatus === "ok";
          const nav = num("nav_value");
          const cota = num("quota_value");
          const dc = num("credit_rights_value");
          const overdue = num("overdue_value");
          const pdd = num("pdd_value");
          const cash = num("cash_value");
          const rep = num("repurchase_value");
          const subVal = num("subordinated_value");
          const inv = num("investors_count");
          const prevNav = prevReport ? Number(prevReport.nav_value ?? NaN) : NaN;
          const varPl = Number.isFinite(prevNav) && prevNav > 0 && nav != null
            ? (nav / prevNav - 1) : null;

          const ratio = (a: number | null, b: number | null) =>
            a != null && b != null && b !== 0 ? a / b : null;

          const sub = subOk && subVal != null && nav ? subVal / nav : null;
          const cell = (v: string | null) => v == null ? <NoDataInline /> : <>{v}</>;

          return (
            <>
              <MetricCard label="PL" value={cell(nav != null ? BRL(nav, { compact: true }) : null)} />
              <MetricCard label="Cota" value={cell(cota != null ? cota.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 8 }) : null)} />
              <MetricCard label="Direitos Creditórios" value={cell(dc != null ? BRL(dc, { compact: true }) : null)} />
              <MetricCard label="Atraso/DC" value={cell(ratio(overdue, dc) != null ? PCT(ratio(overdue, dc)) : null)} />
              <MetricCard label="PDD/DC" value={cell(ratio(pdd, dc) != null ? PCT(ratio(pdd, dc)) : null)} />
              <MetricCard label="PDD/Atrasos" value={cell(overdue && overdue !== 0 && pdd != null ? PCT(pdd / overdue) : null)} />
              <MetricCard label="Caixa/PL" value={cell(ratio(cash, nav) != null ? PCT(ratio(cash, nav)) : null)} />
              <MetricCard label="Recompras/DC" value={cell(ratio(rep, dc) != null ? PCT(ratio(rep, dc)) : null)} />
              <MetricCard
                label="Subordinação"
                value={subOk
                  ? cell(sub != null ? PCT(sub) : null)
                  : <span title="Soma das cotas diferente do PL total. Subordinação não confiável." className="text-amber-600 text-[13px]">Inconsistente</span>}
              />
              <MetricCard label="Var. mensal PL" value={cell(varPl != null ? PCT(varPl) : null)} />
              <MetricCard label="Investidores" value={cell(inv != null ? inv.toLocaleString("pt-BR") : null)} />
            </>
          );
        })()}
      </div>

      {latestReport && (
        <div className="px-6 pb-4">
          <div className="bg-card border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="section-title">Validação PL × Cotas — {monthLabel(String(latestReport.reference_month).slice(0, 10))}</div>
              <ValidationBadge status={String(latestReport.quota_validation_status ?? "—")} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-[12px]">
              <div>
                <div className="text-[11px] text-muted-foreground">PL informado</div>
                <div className="num font-medium">{BRL(latestReport.nav_value as number | null, { compact: true })}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Soma das cotas</div>
                <div className="num font-medium">{BRL(latestReport.quota_total_nav_value as number | null, { compact: true })}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Diferença</div>
                <div className="num font-medium">{BRL(latestReport.quota_validation_difference as number | null, { compact: true })}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">% diferença</div>
                <div className="num font-medium">
                  {latestReport.quota_validation_difference_percentage != null
                    ? `${(Number(latestReport.quota_validation_difference_percentage)).toFixed(3).replace(".", ",")}%`
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Cotas encontradas</div>
                <div className="num font-medium">{Number(latestReport.quota_classes_found_count ?? 0)}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Subordinação</div>
                <div className="font-medium">
                  {latestReport.subordinated_calculation_status === "ok" ? "Confiável" :
                   (latestReport.subordinated_calculation_status === "missing" || latestReport.subordinated_calculation_status === "quota_data_missing") ? "N/D" : "Inconsistente"}
                </div>
              </div>
            </div>
            {latestReport.subordinated_calculation_notes ? (
              <div className="mt-2 text-[11.5px] text-muted-foreground">
                {String(latestReport.subordinated_calculation_notes)}
              </div>
            ) : null}
          </div>
        </div>
      )}


      <div className="px-6 pb-4">
        <div className="bg-card border border-border">
          <div className="section-title px-4 pt-3">Exposição por carteira</div>
          <div className="overflow-x-auto">
            <table className="w-full mt-2 text-[12px]">
              <thead className="bg-surface-2 text-muted-foreground">
                <tr className="hairline-b">
                  <th className="text-left px-3 py-2 font-medium">Carteira</th>
                  <th className="text-left px-3 py-2 font-medium">ISIN</th>
                  <th className="text-left px-3 py-2 font-medium">Classe</th>
                  <th className="text-right px-3 py-2 font-medium">Exposição</th>
                  <th className="text-right px-3 py-2 font-medium">% Cart.</th>
                  <th className="text-left px-3 py-2 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {positionsByPortfolio.flatMap(({ portfolio, positions }) =>
                  positions.map((p, i) => {
                    const s = portfolioSummaries.find((x) => x.portfolio.id === portfolio.id)!;
                    return (
                      <tr key={`${portfolio.id}-${i}`} className="hairline-b">
                        <td className="px-3 py-2 font-medium">{portfolio.name}</td>
                        <td className="px-3 py-2 num">{p.isin}</td>
                        <td className="px-3 py-2">{p.quota?.class_name || p.quota?.internal_quota_name || "—"}</td>
                        <td className="px-3 py-2 text-right num">{BRL(p.value, { compact: true })}</td>
                        <td className="px-3 py-2 text-right num">{s.nav > 0 ? PCT(p.value / s.nav) : "—"}</td>
                        <td className="px-3 py-2 num text-muted-foreground">{p.valDate}</td>
                      </tr>
                    );
                  }),
                )}
                {positionsByPortfolio.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground text-[11.5px]">
                    Sem posições nesta data.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="px-6 pb-4">
        <div className="bg-card border border-border">
          <div className="section-title px-4 pt-3">Cotas / classes cadastradas</div>
          <div className="overflow-x-auto">
            <table className="w-full mt-2 text-[12px]">
              <thead className="bg-surface-2 text-muted-foreground">
                <tr className="hairline-b">
                  <th className="text-left px-3 py-2 font-medium">Classe</th>
                  <th className="text-left px-3 py-2 font-medium">ISIN</th>
                  <th className="text-left px-3 py-2 font-medium">Tipo</th>
                  <th className="text-left px-3 py-2 font-medium">Benchmark</th>
                  <th className="text-left px-3 py-2 font-medium">Rating</th>
                  <th className="text-right px-3 py-2 font-medium">PL classe</th>
                  <th className="text-right px-3 py-2 font-medium">Cota</th>
                </tr>
              </thead>
              <tbody>
                {(quotas as any[]).map((c) => (
                  <tr key={c.id} className="hairline-b">
                    <td className="px-3 py-2 font-medium">{c.class_name || "—"}</td>
                    <td className="px-3 py-2 num text-muted-foreground">{c.isin}</td>
                    <td className="px-3 py-2">{c.quota_type || "—"}</td>
                    <td className="px-3 py-2">{c.benchmark || "—"}</td>
                    <td className="px-3 py-2">{c.current_rating || "—"}</td>
                    <td className="px-3 py-2 text-right"><NoDataChip /></td>
                    <td className="px-3 py-2 text-right"><NoDataChip /></td>
                  </tr>
                ))}
                {quotas.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground text-[11.5px]">
                    Nenhuma cota cadastrada.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="px-6 pb-8">
        <div className="bg-card border border-border">
          <div className="section-title px-4 pt-3">Histórico mensal — informes importados</div>
          <div className="overflow-x-auto">
            <table className="w-full mt-2 text-[12px]">
              <thead className="bg-surface-2 text-muted-foreground">
                <tr className="hairline-b">
                  <th className="text-left px-3 py-2 font-medium">Mês</th>
                  <th className="text-right px-3 py-2 font-medium">PL informado</th>
                  <th className="text-right px-3 py-2 font-medium">Soma das cotas</th>
                  <th className="text-right px-3 py-2 font-medium">Diferença</th>
                  <th className="text-right px-3 py-2 font-medium">% dif.</th>
                  <th className="text-right px-3 py-2 font-medium">Cotas</th>
                  <th className="text-left px-3 py-2 font-medium">Subordinação</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-left px-3 py-2 font-medium">Arquivo</th>
                </tr>
              </thead>
              <tbody>
                {reportsHistory.map((r) => (
                  <tr key={String(r.id)} className="hairline-b">
                    <td className="px-3 py-2 font-medium">{monthLabel(String(r.reference_month).slice(0, 10))}</td>
                    <td className="px-3 py-2 text-right num">{BRL(r.nav_value as number | null, { compact: true })}</td>
                    <td className="px-3 py-2 text-right num">{BRL(r.quota_total_nav_value as number | null, { compact: true })}</td>
                    <td className="px-3 py-2 text-right num">{BRL(r.quota_validation_difference as number | null, { compact: true })}</td>
                    <td className="px-3 py-2 text-right num">
                      {r.quota_validation_difference_percentage != null
                        ? `${Number(r.quota_validation_difference_percentage).toFixed(3).replace(".", ",")}%`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right num">{Number(r.quota_classes_found_count ?? 0)}</td>
                    <td className="px-3 py-2">
                      {r.subordinated_calculation_status === "ok" ? "Confiável" :
                       (r.subordinated_calculation_status === "missing" || r.subordinated_calculation_status === "quota_data_missing") ? "N/D" : "Inconsistente"}
                    </td>
                    <td className="px-3 py-2"><ValidationBadge status={String(r.quota_validation_status ?? "—")} /></td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[220px]" title={String(r.source_file_name ?? "")}>
                      {String(r.source_file_name ?? "—")}
                    </td>
                  </tr>
                ))}
                {reportsHistory.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground text-[11.5px]">
                    Nenhum informe mensal importado ainda.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

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

function ValidationBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    valid: { label: "Válido", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
    warning: { label: "Atenção", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
    invalid: { label: "Crítico", cls: "bg-red-500/15 text-red-600 border-red-500/30" },
    cotas_ausentes: { label: "Cotas ausentes", cls: "bg-red-500/15 text-red-600 border-red-500/30" },
  };
  const v = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return <span className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] ${v.cls}`}>{v.label}</span>;
}

