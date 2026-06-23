import { Link } from "react-router-dom";
import { useFidcMonitorData } from "@/hooks/useFidcMonitorData";
import { BRL, formatCNPJ } from "@/lib/fidc/format";
import { PageHeader } from "@/components/fidc/PageHeader";
import { NoDataInline } from "@/components/fidc/NoDataChip";
import { Loader2 } from "lucide-react";

export default function FidcListPage() {
  const { isLoading, fidcs, exposureForFidc, portfoliosForFidc } = useFidcMonitorData();

  return (
    <div>
      <PageHeader title="FIDCs" subtitle={`${fidcs.length} fundos cadastrados`} />
      <div className="px-6 py-4">
        <div className="bg-card border border-border overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-surface-2 text-muted-foreground">
              <tr className="hairline-b">
                <th className="text-left font-medium px-3 py-2">FIDC</th>
                <th className="text-left font-medium px-3 py-2">CNPJ</th>
                <th className="text-left font-medium px-3 py-2">Gestor</th>
                <th className="text-left font-medium px-3 py-2">Administrador</th>
                <th className="text-left font-medium px-3 py-2">Setor</th>
                <th className="text-left font-medium px-3 py-2">Rating</th>
                <th className="text-right font-medium px-3 py-2">Exposição Butiá</th>
                <th className="text-right font-medium px-3 py-2">PL FIDC</th>
                <th className="text-left font-medium px-3 py-2">Carteiras</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground text-[11.5px]">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando…
                </td></tr>
              )}
              {!isLoading && fidcs.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground text-[11.5px]">
                  Nenhum FIDC cadastrado. Importe o cadastro mestre primeiro.
                </td></tr>
              )}
              {fidcs.map((f) => {
                const expo = exposureForFidc(f.id);
                const ports = portfoliosForFidc(f.id);
                return (
                  <tr key={f.id} className="hairline-b hover:bg-surface-2/50">
                    <td className="px-3 py-2">
                      <Link to={`/fidc-monitor/fidcs/${f.id}`} className="font-medium hover:text-primary">{f.name}</Link>
                      <div className="text-[10.5px] text-muted-foreground">{f.fidc_type || "—"}</div>
                    </td>
                    <td className="px-3 py-2 num text-muted-foreground">{f.cnpj ? formatCNPJ(f.cnpj) : "—"}</td>
                    <td className="px-3 py-2">{f.manager || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{f.administrator || "—"}</td>
                    <td className="px-3 py-2">{f.sector || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">—</td>
                    <td className="px-3 py-2 text-right num">{expo > 0 ? BRL(expo, { compact: true }) : "—"}</td>
                    <td className="px-3 py-2 text-right"><NoDataInline /></td>
                    <td className="px-3 py-2 text-[11px] text-muted-foreground">{ports.map((p) => p.name).join(" · ") || "—"}</td>
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
