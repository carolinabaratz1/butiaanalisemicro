// Seção "Cotas, Subordinação e Validações" — cards + 2 tabelas (cadastro + informe).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BRL, PCT } from "@/lib/fidc/format";

type MonthlyQuota = {
  id: string;
  class_name: string | null;
  quota_type: string | null;
  number_of_quotas: number | null;
  quota_value: number | null;
  nav_value: number | null;
  monthly_yield_pct: number | null;
  subscription_value: number | null;
  redemption_value: number | null;
  amortization_value: number | null;
  matching_status: string | null;
};

type MasterQuota = {
  id: string;
  class_name: string | null;
  isin: string | null;
  quota_type: string | null;
  benchmark: string | null;
  current_rating: string | null;
};

function ValidationBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    valid: { label: "Válido", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
    warning: { label: "Atenção", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
    invalid: { label: "Crítico", cls: "bg-red-500/15 text-red-600 border-red-500/30" },
    cotas_ausentes: { label: "Cotas ausentes", cls: "bg-red-500/15 text-red-600 border-red-500/30" },
  };
  const v = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return <span className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-[11px] ${v.cls}`}>{v.label}</span>;
}

export function QuotasSection({
  reportId, fidcId, latestReport, masterQuotas,
}: {
  reportId: string | null;
  fidcId: string;
  latestReport: Record<string, unknown> | null;
  masterQuotas: MasterQuota[];
}) {
  const { data: importedQuotas = [] } = useQuery({
    queryKey: ["fidc-monthly-quotas", reportId],
    queryFn: async () => {
      if (!reportId) return [];
      const { data, error } = await supabase
        .from("fidc_monthly_quota_classes")
        .select("id, class_name, quota_type, number_of_quotas, quota_value, nav_value, monthly_yield_pct, subscription_value, redemption_value, amortization_value, matching_status")
        .eq("fidc_monthly_report_id", reportId);
      if (error) throw error;
      return (data ?? []) as MonthlyQuota[];
    },
    enabled: !!reportId,
  });

  const nav = Number(latestReport?.nav_value ?? NaN);
  const navTotal = Number.isFinite(nav) ? nav : null;
  const subStatus = String(latestReport?.subordinated_calculation_status ?? "—");
  const subLabel = subStatus === "ok" ? "Confiável"
    : subStatus === "missing" || subStatus === "quota_data_missing" ? "N/D" : "Inconsistente";

  return (
    <div className="bg-card border border-border" data-print-section>
      <div className="section-title px-4 pt-3">Cotas, Subordinação e Validações</div>

      {latestReport && (
        <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-[12px]">
          <Stat label="PL informado" value={BRL(latestReport.nav_value as number | null, { compact: true })} />
          <Stat label="Soma PL cotas" value={BRL(latestReport.quota_total_nav_value as number | null, { compact: true })} />
          <Stat label="Diferença" value={BRL(latestReport.quota_validation_difference as number | null, { compact: true })} />
          <Stat label="% diferença" value={latestReport.quota_validation_difference_percentage != null
            ? `${Number(latestReport.quota_validation_difference_percentage).toFixed(3).replace(".", ",")}%` : "—"} />
          <Stat label="Cotas encontradas" value={String(Number(latestReport.quota_classes_found_count ?? 0))} />
          <Stat label="Status validação" value={<ValidationBadge status={String(latestReport.quota_validation_status ?? "—")} />} />
          <Stat label="Subordinação" value={subLabel} />
        </div>
      )}

      {/* Tabela importada do informe */}
      <div className="px-4">
        <div className="section-title pt-2 pb-1">Cotas/classes importadas do informe</div>
        <div className="overflow-x-auto border border-border">
          <table className="w-full text-[12px]">
            <thead className="bg-surface-2 text-muted-foreground">
              <tr className="hairline-b">
                <th className="text-left px-2 py-1.5 font-medium">Classe</th>
                <th className="text-left px-2 py-1.5 font-medium">Tipo</th>
                <th className="text-right px-2 py-1.5 font-medium">Qtd. cotas</th>
                <th className="text-right px-2 py-1.5 font-medium">Valor cota</th>
                <th className="text-right px-2 py-1.5 font-medium">PL classe</th>
                <th className="text-right px-2 py-1.5 font-medium">% PL</th>
                <th className="text-right px-2 py-1.5 font-medium">Rent. mês</th>
                <th className="text-right px-2 py-1.5 font-medium">Captação</th>
                <th className="text-right px-2 py-1.5 font-medium">Resgate</th>
                <th className="text-right px-2 py-1.5 font-medium">Amort.</th>
                <th className="text-left px-2 py-1.5 font-medium">Matching</th>
              </tr>
            </thead>
            <tbody>
              {importedQuotas.map((q) => (
                <tr key={q.id} className="hairline-b">
                  <td className="px-2 py-1.5 font-medium">{q.class_name || "—"}</td>
                  <td className="px-2 py-1.5">{q.quota_type || "—"}</td>
                  <td className="px-2 py-1.5 text-right num">{q.number_of_quotas?.toLocaleString("pt-BR") ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right num">{q.quota_value?.toLocaleString("pt-BR", { maximumFractionDigits: 6 }) ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right num">{q.nav_value != null ? BRL(q.nav_value, { compact: true }) : "—"}</td>
                  <td className="px-2 py-1.5 text-right num text-muted-foreground">
                    {q.nav_value != null && navTotal && navTotal > 0 ? PCT(q.nav_value / navTotal, 1) : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right num">{q.monthly_yield_pct != null ? PCT(q.monthly_yield_pct, 2) : "—"}</td>
                  <td className="px-2 py-1.5 text-right num">{q.subscription_value != null ? BRL(q.subscription_value, { compact: true }) : "—"}</td>
                  <td className="px-2 py-1.5 text-right num">{q.redemption_value != null ? BRL(q.redemption_value, { compact: true }) : "—"}</td>
                  <td className="px-2 py-1.5 text-right num">{q.amortization_value != null ? BRL(q.amortization_value, { compact: true }) : "—"}</td>
                  <td className="px-2 py-1.5 text-[11px] text-muted-foreground">{q.matching_status || "—"}</td>
                </tr>
              ))}
              {importedQuotas.length === 0 && (
                <tr><td colSpan={11} className="px-3 py-6 text-center text-muted-foreground text-[11.5px]">
                  Nenhuma cota importada para este mês.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabela do cadastro mestre */}
      <div className="px-4 pb-4 pt-3">
        <div className="section-title pt-2 pb-1">Cotas/classes cadastradas (mestre)</div>
        <div className="overflow-x-auto border border-border">
          <table className="w-full text-[12px]">
            <thead className="bg-surface-2 text-muted-foreground">
              <tr className="hairline-b">
                <th className="text-left px-2 py-1.5 font-medium">Classe</th>
                <th className="text-left px-2 py-1.5 font-medium">ISIN</th>
                <th className="text-left px-2 py-1.5 font-medium">Tipo</th>
                <th className="text-left px-2 py-1.5 font-medium">Benchmark</th>
                <th className="text-left px-2 py-1.5 font-medium">Rating</th>
              </tr>
            </thead>
            <tbody>
              {masterQuotas.map((c) => (
                <tr key={c.id} className="hairline-b">
                  <td className="px-2 py-1.5 font-medium">{c.class_name || "—"}</td>
                  <td className="px-2 py-1.5 num text-muted-foreground">{c.isin || "—"}</td>
                  <td className="px-2 py-1.5">{c.quota_type || "—"}</td>
                  <td className="px-2 py-1.5">{c.benchmark || "—"}</td>
                  <td className="px-2 py-1.5">{c.current_rating || "—"}</td>
                </tr>
              ))}
              {masterQuotas.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground text-[11.5px]">
                  Nenhuma cota cadastrada no mestre.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] text-muted-foreground">{label}</div>
      <div className="text-[12.5px] font-medium num mt-0.5">{value}</div>
    </div>
  );
}
