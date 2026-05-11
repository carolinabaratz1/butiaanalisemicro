import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAllocationLimits, useAllocationData } from "./useAllocationData";
import {
  FundoKey, computeStatus, STATUS_LABEL, STATUS_BADGE_CLASS, fmtPct,
} from "./allocationUtils";

interface Props { fundo: FundoKey }

export function IssuerExposurePanel({ fundo }: Props) {
  const { data: limits = [] } = useAllocationLimits();
  const { data: agg, isLoading } = useAllocationData(fundo);
  const navigate = useNavigate();

  const limitByRating = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const l of limits) {
      if (l.fundo === fundo && l.categoria === "emissor") m.set(l.subcategoria, l.limite_pct);
    }
    return m;
  }, [limits, fundo]);

  if (isLoading) return <Skeleton className="h-60 w-full" />;
  if (!agg || agg.porGrupo.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground">
        Nenhuma posição encontrada para este fundo. Faça upload do arquivo de posições para visualizar o enquadramento.
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Grupo Econômico</TableHead>
            <TableHead>Emissores</TableHead>
            <TableHead className="text-center">Rating</TableHead>
            <TableHead className="text-right">Limite por Emissor</TableHead>
            <TableHead className="text-right">% do PL</TableHead>
            <TableHead className="text-right">Headroom</TableHead>
            <TableHead className="text-center">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agg.porGrupo.map(g => {
            const lim = limitByRating.get(g.ratingBucket) ?? null;
            const headroom = lim != null ? lim - g.pct : null;
            const st = computeStatus(g.pct, lim, true);
            return (
              <TableRow key={g.grupo}>
                <TableCell className="font-medium">{g.grupo}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {g.emissores.map(e => (
                      <button
                        key={e.cnpj}
                        onClick={() => e.empresaId && navigate(`/empresas/${e.empresaId}`)}
                        className="text-xs underline-offset-2 hover:underline text-primary"
                      >
                        {e.nome}
                      </button>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-center font-mono text-xs">{g.ratingBucket}</TableCell>
                <TableCell className="text-right font-mono">{fmtPct(lim)}</TableCell>
                <TableCell className="text-right font-mono">{fmtPct(g.pct)}</TableCell>
                <TableCell className="text-right font-mono">{fmtPct(headroom)}</TableCell>
                <TableCell className="text-center">
                  <span className={cn("inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide", STATUS_BADGE_CLASS[st])}>
                    {STATUS_LABEL[st]}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
