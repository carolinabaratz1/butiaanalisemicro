import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  parseMonthlyReportFile, validateQuotas, matchQuotaClasses,
  type ParsedMonthlyReport, type QuotaValidation, type QuotaMatch, type MasterQuota,
} from "@/lib/fidc/monthly-report-parser";
import { BRL, PCT, formatCNPJ } from "@/lib/fidc/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Upload, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fidcId: string;
  fidcName: string;
  fidcCnpj: string | null;
};

function StatusBadge({ status }: { status: QuotaValidation["status"] }) {
  const map = {
    valid: { label: "Válido", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
    warning: { label: "Atenção", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
    invalid: { label: "Crítico", cls: "bg-red-500/15 text-red-600 border-red-500/30" },
    cotas_ausentes: { label: "Cotas ausentes", cls: "bg-red-500/15 text-red-600 border-red-500/30" },
  } as const;
  const v = map[status];
  return <span className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] ${v.cls}`}>{v.label}</span>;
}

export function MonthlyReportImportDialog({ open, onOpenChange, fidcId, fidcName, fidcCnpj }: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedMonthlyReport | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [cnpjOverride, setCnpjOverride] = useState(false);
  const [parsing, setParsing] = useState(false);

  const fidcCnpjClean = (fidcCnpj ?? "").replace(/\D/g, "");

  const { data: master = [] } = useQuery({
    queryKey: ["fidc-master-quotas", fidcId],
    queryFn: async (): Promise<MasterQuota[]> => {
      const { data, error } = await supabase
        .from("fidc_quota_classes")
        .select("id, isin, class_name, internal_quota_name, cvm_quota_name, quota_type, seniority_level")
        .eq("fidc_id", fidcId);
      if (error) throw error;
      return (data ?? []) as MasterQuota[];
    },
    enabled: open,
  });

  const previewSlice = useMemo(() => {
    if (!parsed) return null;
    return parsed.months.find((m) => m.iso === selectedMonth) ?? parsed.months[parsed.months.length - 1];
  }, [parsed, selectedMonth]);

  const validation = useMemo(
    () => (previewSlice ? validateQuotas({ metrics: previewSlice.metrics, quotaClasses: previewSlice.quotaClasses }) : null),
    [previewSlice],
  );
  const matches = useMemo<QuotaMatch[]>(
    () => (previewSlice ? matchQuotaClasses(previewSlice.quotaClasses, master) : []),
    [previewSlice, master],
  );

  const cnpjMatches = parsed?.cnpj && fidcCnpjClean && parsed.cnpj === fidcCnpjClean;
  const cnpjMissing = !parsed?.cnpj;
  const cnpjMismatch = parsed?.cnpj && fidcCnpjClean && parsed.cnpj !== fidcCnpjClean;

  const reset = () => {
    setParsed(null); setSelectedMonth(""); setCnpjOverride(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    setParsing(true);
    try {
      const r = await parseMonthlyReportFile(file);
      setParsed(r);
      setSelectedMonth(r.referenceMonth);
    } catch (e) {
      toast.error("Falha ao ler o arquivo", { description: String((e as Error).message) });
    } finally {
      setParsing(false);
    }
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!parsed) throw new Error("Nada para importar.");
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id ?? null;

      let imported = 0;
      let skipped = 0;
      const monthSlices = parsed.months;

      for (const slice of monthSlices) {
        const sliceValidation = validateQuotas({
          metrics: slice.metrics,
          quotaClasses: slice.quotaClasses,
        });

        // Pular meses completamente vazios (sem PL e sem cotas)
        if (slice.metrics.navValue == null && slice.quotaClasses.length === 0) {
          skipped++;
          continue;
        }

        const month = slice.iso;
        // Encerrar versão anterior para o mesmo (fidc, mês)
        await supabase
          .from("fidc_monthly_reports")
          .update({ is_current_version: false } as never)
          .eq("fidc_id", fidcId)
          .eq("reference_month", month)
          .eq("is_current_version", true);

        const { data: prev } = await supabase
          .from("fidc_monthly_reports")
          .select("version")
          .eq("fidc_id", fidcId)
          .eq("reference_month", month)
          .order("version", { ascending: false })
          .limit(1);
        const nextVersion = ((prev?.[0] as { version?: number } | undefined)?.version ?? 0) + 1;

        const sliceMatches = matchQuotaClasses(slice.quotaClasses, master);
        const m = slice.metrics;
        const dcForPct = m.creditRightsValue && m.creditRightsValue > 0 ? m.creditRightsValue : null;
        const payload = {
          fidc_id: fidcId,
          reference_month: month,
          nav_value: m.navValue,
          quota_value: m.quotaValue ?? slice.quotaClasses[0]?.quotaValue ?? null,
          credit_rights_value: m.creditRightsValue,
          overdue_value: m.overdueValue,
          overdue_30d_value: m.overdue30dValue,
          overdue_60d_value: m.overdue60dValue,
          overdue_90d_value: m.overdue90dValue,
          overdue_120d_value: m.overdue120dValue,
          pdd_value: m.pddValue,
          cash_value: m.cashValue,
          repurchase_value: m.repurchaseValue,
          acquisitions_value: m.acquisitionsValue,
          substitutions_value: m.substitutionsValue,
          disposals_value: m.disposalsValue,
          guarantees_value: m.guaranteesValue,
          guarantees_pct_dc: m.guaranteesValue != null && dcForPct ? m.guaranteesValue / dcForPct : null,
          scr_status: m.scrStatus,
          scr_value: m.scrValue,
          segment_breakdown: m.segmentBreakdown.length ? m.segmentBreakdown : null,
          maturity_breakdown: m.maturityBreakdown.length ? m.maturityBreakdown : null,
          overdue_breakdown: m.overdueBreakdown.length ? m.overdueBreakdown : null,
          assignors_breakdown: m.assignorsBreakdown.length ? m.assignorsBreakdown : null,
          investors_count: m.investorsCount,
          subordinated_value: slice.quotaClasses
            .filter((q) => q.quotaType === "Subordinada" || q.quotaType === "Mezanino")
            .reduce((a, q) => a + (q.navValue ?? 0), 0) || null,
          quota_total_nav_value: sliceValidation.quotasNavSum,
          quota_validation_status: sliceValidation.status,
          quota_validation_difference: sliceValidation.differenceAbs,
          quota_validation_difference_percentage:
            sliceValidation.differencePct != null ? sliceValidation.differencePct * 100 : null,
          quota_classes_found_count: sliceValidation.quotaClassesFoundCount,
          subordinated_calculation_status: sliceValidation.subordinatedStatus,
          subordinated_calculation_notes: sliceValidation.subordinatedNotes,
          source_file_name: parsed.fileName,
          imported_by: userId,
          version: nextVersion,
          is_current_version: true,
          raw_data: {
            assetsTotal: m.assetsTotal,
            liabilitiesTotal: m.liabilitiesTotal,
            segmentCarteiraTotal: m.segmentCarteiraTotal,
            monthlyAverageNavValue: m.monthlyAverageNavValue,
            creditRightsAValue: m.creditRightsAValue,
            creditRightsBValue: m.creditRightsBValue,
            overdueSource: m.overdueSource,
            fidc_name_in_file: parsed.fidcNameInFile,
            month_label: slice.label,
          } as never,
        } as never;

        const { data: inserted, error: insErr } = await supabase
          .from("fidc_monthly_reports")
          .insert(payload)
          .select("id")
          .single();
        if (insErr) throw insErr;
        const reportId = (inserted as { id: string }).id;

        if (sliceMatches.length > 0) {
          const rows = sliceMatches.map((mq) => ({
            fidc_monthly_report_id: reportId,
            fidc_quota_class_id: mq.matchedId,
            isin: null,
            class_name: mq.parsed.className,
            quota_type: mq.parsed.quotaType,
            nav_value: mq.parsed.navValue,
            quota_value: mq.parsed.quotaValue,
            number_of_quotas: mq.parsed.numberOfQuotas,
            seniority_level: mq.parsed.seniorityLevel,
            rating: mq.parsed.rating,
            monthly_yield_pct: mq.parsed.monthlyYieldPct,
            subscription_value: mq.parsed.subscriptionValue,
            redemption_value: mq.parsed.redemptionValue,
            amortization_value: mq.parsed.amortizationValue,
            matching_status: mq.matchingStatus,
          }));
          const { error } = await supabase
            .from("fidc_monthly_quota_classes")
            .insert(rows as never);
          if (error) throw error;
        }
        imported++;
      }


      return { imported, skipped };
    },
    onSuccess: ({ imported, skipped }) => {
      toast.success("Informes importados", {
        description: `${imported} mês(es) importado(s)${skipped ? `, ${skipped} ignorado(s) por falta de dados` : ""}.`,
      });
      qc.invalidateQueries({ queryKey: ["fidc-monthly-reports", fidcId] });
      reset();
      onOpenChange(false);
    },
    onError: (e) => toast.error("Falha ao salvar", { description: String((e as Error).message) }),
  });

  const canImport =
    !!parsed && !!validation && (cnpjMatches || (cnpjMissing && cnpjOverride)) && !cnpjMismatch;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Informe Mensal — {fidcName}</DialogTitle>
        </DialogHeader>

        {!parsed && (
          <div className="border border-dashed border-border rounded-md p-8 text-center">
            <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <div className="text-[13px] mb-3">Selecione o arquivo Excel do informe (CVM/Quantum)</div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
            <Button onClick={() => inputRef.current?.click()} disabled={parsing}>
              {parsing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Lendo…</> : "Escolher arquivo"}
            </Button>
            <div className="mt-3 text-[11px] text-muted-foreground">
              O arquivo será validado pelo CNPJ contra o cadastro do FIDC.
            </div>
          </div>
        )}

        {parsed && (
          <div className="space-y-4 text-[12.5px]">
            {/* CNPJ */}
            <div className="border border-border rounded-md p-3 bg-card">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-[11px] text-muted-foreground">CNPJ no arquivo</div>
                  <div className="num font-medium">{parsed.cnpj ? formatCNPJ(parsed.cnpj) : "—"}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">CNPJ cadastrado</div>
                  <div className="num font-medium">{fidcCnpj ? formatCNPJ(fidcCnpj) : "—"}</div>
                </div>
                <div>
                  {cnpjMatches && (
                    <span className="inline-flex items-center gap-1 text-emerald-600 text-[11.5px]">
                      <CheckCircle2 className="h-3.5 w-3.5" /> CNPJ confere
                    </span>
                  )}
                  {cnpjMismatch && (
                    <span className="inline-flex items-center gap-1 text-red-600 text-[11.5px]">
                      <XCircle className="h-3.5 w-3.5" /> CNPJ divergente — importação bloqueada
                    </span>
                  )}
                  {cnpjMissing && (
                    <label className="inline-flex items-center gap-1 text-amber-600 text-[11.5px]">
                      <input
                        type="checkbox"
                        checked={cnpjOverride}
                        onChange={(e) => setCnpjOverride(e.target.checked)}
                      />
                      CNPJ ausente — confirmo manualmente
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Meses no arquivo */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-[12px] text-muted-foreground">Meses no arquivo</div>
              <span className="text-[12px] font-medium">
                {parsed.availableMonths.length > 0
                  ? `${parsed.availableMonths[0].label} → ${parsed.availableMonths[parsed.availableMonths.length - 1].label}`
                  : "—"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                ({parsed.availableMonths.length} meses) — todos serão importados de uma vez
              </span>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-8 w-[220px]">
                  <SelectValue placeholder="Pré-visualizar mês" />
                </SelectTrigger>
                <SelectContent>
                  {parsed.availableMonths.map((m) => (
                    <SelectItem key={m.iso} value={m.iso}>
                      {m.label} {m.iso === parsed.referenceMonth ? " (mais recente)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Validação PL x Cotas */}
            {validation && (
              <div className="border border-border rounded-md p-3 bg-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="section-title">Validação PL × Cotas</div>
                  <StatusBadge status={validation.status} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <div className="text-[11px] text-muted-foreground">PL informado</div>
                    <div className="num font-medium">{BRL(validation.declaredNav, { compact: true })}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">Soma cotas</div>
                    <div className="num font-medium">{BRL(validation.quotasNavSum, { compact: true })}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">Diferença</div>
                    <div className="num font-medium">{BRL(validation.differenceAbs, { compact: true })}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">% diferença</div>
                    <div className="num font-medium">{PCT(validation.differencePct, 3)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">Cotas encontradas</div>
                    <div className="num font-medium">{validation.quotaClassesFoundCount}</div>
                  </div>
                </div>
                {validation.status !== "valid" && (
                  <Alert variant="destructive" className="mt-3">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Atenção</AlertTitle>
                    <AlertDescription>{validation.message}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Checklist de extração */}
            {parsed.checklist?.length > 0 && (
              <div className="border border-border rounded-md overflow-hidden bg-card">
                <div className="section-title px-3 pt-3">Checklist de extração</div>
                <div className="overflow-x-auto">
                  <table className="w-full mt-2 text-[12px]">
                    <thead className="bg-surface-2 text-muted-foreground">
                      <tr className="hairline-b">
                        <th className="text-left px-3 py-2 font-medium">Métrica</th>
                        <th className="text-left px-3 py-2 font-medium">Seção</th>
                        <th className="text-left px-3 py-2 font-medium">Linha encontrada</th>
                        <th className="text-right px-3 py-2 font-medium">Valor</th>
                        <th className="text-left px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.checklist.map((row, i) => {
                        const cls = row.status === "found" || row.status === "validated"
                          ? "text-emerald-600"
                          : row.status === "missing" ? "text-amber-600" : "text-red-600";
                        const valStr = row.value == null
                          ? "—"
                          : typeof row.value === "number"
                            ? (Math.abs(row.value) >= 1000 ? BRL(row.value, { compact: true }) : row.value.toLocaleString("pt-BR"))
                            : String(row.value);
                        return (
                          <tr key={i} className="hairline-b">
                            <td className="px-3 py-1.5">{row.metric}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{row.section}</td>
                            <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[260px]" title={row.foundLabel ?? ""}>
                              {row.foundLabel ?? "—"}
                            </td>
                            <td className="px-3 py-1.5 text-right num">{valStr}</td>
                            <td className={`px-3 py-1.5 text-[11px] ${cls}`}>{row.status}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Cotas */}
            <div className="border border-border rounded-md overflow-hidden bg-card">
              <div className="section-title px-3 pt-3">Cotas/classes detectadas</div>
              <table className="w-full mt-2 text-[12px]">
                <thead className="bg-surface-2 text-muted-foreground">
                  <tr className="hairline-b">
                    <th className="text-left px-3 py-2 font-medium">Classe</th>
                    <th className="text-left px-3 py-2 font-medium">Tipo</th>
                    <th className="text-right px-3 py-2 font-medium">PL</th>
                    <th className="text-right px-3 py-2 font-medium">Cota</th>
                    <th className="text-left px-3 py-2 font-medium">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m, i) => (
                    <tr key={i} className="hairline-b">
                      <td className="px-3 py-2">{m.parsed.className}</td>
                      <td className="px-3 py-2">{m.parsed.quotaType ?? "—"}</td>
                      <td className="px-3 py-2 text-right num">{BRL(m.parsed.navValue, { compact: true })}</td>
                      <td className="px-3 py-2 text-right num">
                        {m.parsed.quotaValue != null ? m.parsed.quotaValue.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 8 }) : "—"}
                      </td>
                      <td className="px-3 py-2 text-[11px]">
                        {m.matchingStatus === "matched_by_name" && <span className="text-emerald-600">por nome</span>}
                        {m.matchingStatus === "manual_match_required" && <span className="text-amber-600">manual</span>}
                        {m.matchingStatus === "unmatched" && <span className="text-red-600">sem match</span>}
                        {m.matchingStatus === "no_isin_available" && <span className="text-muted-foreground">sem ISIN</span>}
                      </td>
                    </tr>
                  ))}
                  {matches.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground text-[11.5px]">
                      Nenhuma cota/classe detectada no arquivo.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          {parsed && (
            <Button variant="outline" onClick={reset} disabled={importMutation.isPending}>
              Trocar arquivo
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={importMutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => importMutation.mutate()}
            disabled={!canImport || importMutation.isPending}
          >
            {importMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importando…</> : `Importar ${parsed?.months.length ?? 0} meses`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
