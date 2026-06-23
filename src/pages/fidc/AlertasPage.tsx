import { useState } from "react";
import { useFidcMonitorData } from "@/hooks/useFidcMonitorData";
import { PageHeader } from "@/components/fidc/PageHeader";
import { RiskStatusBadge } from "@/components/fidc/MetricChip";
import { Loader2, Info } from "lucide-react";

const KIND_LABEL: Record<string, string> = {
  isin_nao_mapeado: "ISIN não mapeado",
  carteira_sem_pl: "PL da carteira ausente",
  carteira_sem_posicao: "Sem posição para carteira",
  posicao_duplicada: "Posição duplicada",
  divergencia_pct: "Divergência de %",
  informe_ausente: "Informe mensal ausente",
  subordinacao_inconsistente: "Subordinação inconsistente",
  pdd_alto: "PDD elevado",
  atraso_alto: "Inadimplência elevada",
  queda_pl: "Queda de PL",
  queda_cota: "Queda de cota",
};

export default function AlertasPage() {
  const [sev, setSev] = useState<"all" | "warning" | "critical">("all");
  const { isLoading, positionAlerts, latestValDate } = useFidcMonitorData();

  const rows = positionAlerts.filter((a) => sev === "all" || a.severity === sev);

  return (
    <div>
      <PageHeader
        title="Alertas"
        subtitle={`${positionAlerts.length} alertas de posição em ${latestValDate ?? "—"}`}
      />

      <div className="px-6 py-3 hairline-b">
        <div className="rounded-sm border border-border bg-muted/30 px-3 py-2 text-[11.5px] text-muted-foreground flex items-start gap-2">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Alertas combinam dados de posição (ISIN, carteira, duplicidade) com métricas do informe mensal
            de cada FIDC (subordinação, PDD/DC, inadimplência, queda de PL/cota). Importe o informe mensal
            do FIDC para popular os alertas baseados em métricas.
          </span>
        </div>
      </div>

      <div className="px-6 py-3 flex gap-2 hairline-b flex-wrap">
        <Sel label="Severidade" value={sev} onChange={(v) => setSev(v as typeof sev)} options={[
          { value: "all", label: "Todas" }, { value: "critical", label: "Crítico" }, { value: "warning", label: "Atenção" },
        ]} />
      </div>

      <div className="px-6 py-4">
        <div className="bg-card border border-border overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-surface-2 text-muted-foreground">
              <tr className="hairline-b">
                <th className="text-left px-3 py-2 font-medium">Severidade</th>
                <th className="text-left px-3 py-2 font-medium">Tipo</th>
                <th className="text-left px-3 py-2 font-medium">FIDC</th>
                <th className="text-left px-3 py-2 font-medium">Carteira</th>
                <th className="text-left px-3 py-2 font-medium">ISIN</th>
                <th className="text-left px-3 py-2 font-medium">Detalhe</th>
                <th className="text-left px-3 py-2 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground text-[11.5px]">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando…
                </td></tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground text-[11.5px]">
                  Nenhum alerta no momento.
                </td></tr>
              )}
              {rows.map((a) => (
                <tr key={a.id} className="hairline-b hover:bg-surface-2/40">
                  <td className="px-3 py-2"><RiskStatusBadge status={a.severity} /></td>
                  <td className="px-3 py-2 font-medium">{KIND_LABEL[a.kind] ?? a.kind}</td>
                  <td className="px-3 py-2">{a.fidcName ?? "—"}</td>
                  <td className="px-3 py-2">{a.portfolioName ?? "—"}</td>
                  <td className="px-3 py-2 num text-muted-foreground">{a.isin ?? "—"}</td>
                  <td className="px-3 py-2 text-foreground/90">{a.message}</td>
                  <td className="px-3 py-2 num text-muted-foreground">{a.valDate ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Sel<T extends string>({ label, value, onChange, options }: {
  label: string; value: T; onChange: (v: string) => void; options: { value: T; label: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
      <span className="uppercase tracking-wider">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}
        className="bg-card border border-border rounded-sm px-2 py-1 text-[12px] text-foreground outline-none focus:border-primary">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
