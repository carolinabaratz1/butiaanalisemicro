import { Link } from "react-router-dom";
import { FIDCS, LATEST_MONTH, statusForFidc, portfoliosForFidc, reportFor } from "@/lib/fidc/mock-data";
import { BRL, formatCNPJ } from "@/lib/fidc/format";
import { PageHeader } from "@/components/fidc/PageHeader";
import { StatusDot } from "@/components/fidc/MetricChip";

export default function FidcListPage() {
  return (
    <div>
      <PageHeader title="FIDCs" subtitle={`${FIDCS.length} fundos monitorados em carteira`} />
      <div className="px-6 py-4">
        <div className="bg-card border border-border">
          <table className="w-full text-[12.5px]">
            <thead className="bg-surface-2 text-muted-foreground">
              <tr className="hairline-b">
                <th className="text-left font-medium px-3 py-2 w-8">St</th>
                <th className="text-left font-medium px-3 py-2">FIDC</th>
                <th className="text-left font-medium px-3 py-2">CNPJ</th>
                <th className="text-left font-medium px-3 py-2">Gestor</th>
                <th className="text-left font-medium px-3 py-2">Administrador</th>
                <th className="text-left font-medium px-3 py-2">Setor</th>
                <th className="text-left font-medium px-3 py-2">Rating</th>
                <th className="text-right font-medium px-3 py-2">PL</th>
                <th className="text-left font-medium px-3 py-2">Carteiras</th>
              </tr>
            </thead>
            <tbody>
              {FIDCS.map((f) => {
                const st = statusForFidc(f.id, LATEST_MONTH);
                const r = reportFor(f.id, LATEST_MONTH);
                const ports = portfoliosForFidc(f.id);
                return (
                  <tr key={f.id} className="hairline-b hover:bg-surface-2/50">
                    <td className="px-3 py-2"><StatusDot status={st} /></td>
                    <td className="px-3 py-2">
                      <Link to={`/fidc-monitor/fidcs/${f.id}`} className="font-medium hover:text-primary">{f.name}</Link>
                      <div className="text-[10.5px] text-muted-foreground">{f.condominium} · {f.fidcType}</div>
                    </td>
                    <td className="px-3 py-2 num text-muted-foreground">{formatCNPJ(f.cnpj)}</td>
                    <td className="px-3 py-2">{f.manager}</td>
                    <td className="px-3 py-2 text-muted-foreground">{f.administrator}</td>
                    <td className="px-3 py-2">{f.sector}</td>
                    <td className="px-3 py-2">
                      <span className="text-[11px] font-semibold">{f.rating}</span>{" "}
                      <span className="text-[10px] text-muted-foreground">· {f.ratingAgency}</span>
                    </td>
                    <td className="px-3 py-2 text-right num">{r ? BRL(r.nav, { compact: true }) : "—"}</td>
                    <td className="px-3 py-2 text-[11px] text-muted-foreground">{ports.map((p) => p.name).join(" · ")}</td>
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
