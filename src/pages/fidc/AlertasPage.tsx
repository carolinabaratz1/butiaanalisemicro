import { useState } from "react";
import { ALERTS, fidcById, portfolioById } from "@/lib/fidc/mock-data";
import { PCT, monthLabel } from "@/lib/fidc/format";
import { PageHeader } from "@/components/fidc/PageHeader";
import { RiskStatusBadge } from "@/components/fidc/MetricChip";

export default function AlertasPage() {
  const [sev, setSev] = useState<"all" | "warning" | "critical">("all");
  const [status, setStatus] = useState<"all" | "new" | "in_analysis" | "resolved">("all");
  const rows = ALERTS.filter((a) =>
    (sev === "all" || a.severity === sev) && (status === "all" || a.status === status),
  );

  return (
    <div>
      <PageHeader title="Alertas" subtitle={`${ALERTS.length} alertas gerados em ${monthLabel(ALERTS[0]?.month ?? "2025-05")}`} />
      <div className="px-6 py-3 flex gap-2 hairline-b flex-wrap">
        <Sel label="Severidade" value={sev} onChange={(v) => setSev(v as typeof sev)} options={[
          { value: "all", label: "Todas" }, { value: "critical", label: "Crítico" }, { value: "warning", label: "Atenção" },
        ]} />
        <Sel label="Status" value={status} onChange={(v) => setStatus(v as typeof status)} options={[
          { value: "all", label: "Todos" }, { value: "new", label: "Novo" }, { value: "in_analysis", label: "Em análise" }, { value: "resolved", label: "Resolvido" },
        ]} />
      </div>
      <div className="px-6 py-4">
        <div className="bg-card border border-border overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-surface-2 text-muted-foreground">
              <tr className="hairline-b">
                <th className="text-left px-3 py-2 font-medium">Severidade</th>
                <th className="text-left px-3 py-2 font-medium">Carteira</th>
                <th className="text-left px-3 py-2 font-medium">FIDC</th>
                <th className="text-left px-3 py-2 font-medium">Métrica</th>
                <th className="text-right px-3 py-2 font-medium">Valor atual</th>
                <th className="text-right px-3 py-2 font-medium">Limite</th>
                <th className="text-left px-3 py-2 font-medium">Mês</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Comentário</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const f = fidcById(a.fidcId)!;
                const p = a.portfolioId ? portfolioById(a.portfolioId) : null;
                return (
                  <tr key={a.id} className="hairline-b hover:bg-surface-2/40">
                    <td className="px-3 py-2"><RiskStatusBadge status={a.severity} /></td>
                    <td className="px-3 py-2">{p?.name ?? "—"}</td>
                    <td className="px-3 py-2 font-medium">{f.name}</td>
                    <td className="px-3 py-2">{a.display}</td>
                    <td className="px-3 py-2 text-right num">{PCT(a.currentValue)}</td>
                    <td className="px-3 py-2 text-right num text-muted-foreground">{PCT(a.threshold)}</td>
                    <td className="px-3 py-2">{monthLabel(a.month)}</td>
                    <td className="px-3 py-2">
                      <span className="text-[10.5px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-surface-3 text-muted-foreground">
                        {a.status === "new" ? "Novo" : a.status === "in_analysis" ? "Em análise" : "Resolvido"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground italic">+ adicionar comentário</td>
                  </tr>
                );
              })}
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
