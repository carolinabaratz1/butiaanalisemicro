import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SourceBadge } from "@/components/fidc/laminate/SourceBadge";
import type { MetricSource } from "@/lib/fidc/source-resolver";
import { BRL } from "@/lib/fidc/format";

const FORMAT_AS_BRL = new Set([
  "nav_value","total_assets","total_liabilities","avg_nav_value","credit_rights_value",
  "cash_value","cash_strict_value","pdd_value","overdue_value","overdue_30d_value",
  "overdue_60d_value","overdue_90d_value","overdue_120d_value","repurchase_value",
  "acquisitions_value","substitutions_value","disposals_value","guarantees_value",
  "scr_value","subordinated_value","total_subscription_value","total_redemption_value",
  "total_amortization_value","net_investor_flow_value",
]);

function fmt(metric: MetricSource): string {
  const v = metric.value;
  if (v === null || v === undefined || v === "") return "—";
  if (FORMAT_AS_BRL.has(metric.key) && typeof v === "number") return BRL(v, { compact: true });
  if (typeof v === "number") return new Intl.NumberFormat("pt-BR").format(v);
  return String(v);
}

const EXTRACTION_LABEL: Record<string, string> = {
  ok: "OK", missing: "Ausente", error: "Erro", partial: "Parcial",
};
const VALIDATION_LABEL: Record<string, string> = {
  valid: "Válido", warning: "Atenção", critical: "Crítico", na: "—",
};

export function DataSourceDialog({
  open, onOpenChange, metrics,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  metrics: MetricSource[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Origem dos dados</DialogTitle>
          <DialogDescription>
            Fonte usada para cada métrica desta lâmina, com status de extração e validação.
            Dados quantitativos priorizam <strong>CVM</strong>; upload manual é usado apenas como fallback.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto border border-border rounded-sm">
          <table className="w-full text-[12px]">
            <thead className="bg-surface-2 text-muted-foreground sticky top-0">
              <tr className="hairline-b">
                <th className="text-left font-medium px-3 py-2">Métrica</th>
                <th className="text-right font-medium px-3 py-2">Valor</th>
                <th className="text-left font-medium px-3 py-2">Fonte</th>
                <th className="text-left font-medium px-3 py-2">Arquivo de origem</th>
                <th className="text-left font-medium px-3 py-2">Extração</th>
                <th className="text-left font-medium px-3 py-2">Validação</th>
                <th className="text-left font-medium px-3 py-2">Fallback?</th>
                <th className="text-left font-medium px-3 py-2">Motivo do fallback</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.key} className="hairline-b hover:bg-surface-2/50 align-top">
                  <td className="px-3 py-2 text-foreground">{m.label}</td>
                  <td className="px-3 py-2 text-right num">{fmt(m)}</td>
                  <td className="px-3 py-2"><SourceBadge source={m.dataSource} fallbackReason={m.fallbackReason} /></td>
                  <td className="px-3 py-2 text-muted-foreground truncate max-w-[200px]" title={m.sourceFile ?? ""}>{m.sourceFile ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{EXTRACTION_LABEL[m.extractionStatus] ?? m.extractionStatus}</td>
                  <td className="px-3 py-2 text-muted-foreground">{VALIDATION_LABEL[m.validationStatus] ?? m.validationStatus}</td>
                  <td className="px-3 py-2 text-muted-foreground">{m.fallbackUsed ? "Sim" : "Não"}</td>
                  <td className="px-3 py-2 text-muted-foreground text-[11px] max-w-[260px]">{m.fallbackReason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
