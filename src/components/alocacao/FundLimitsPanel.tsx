import { useMemo, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAllocationLimits, useAllocationData } from "./useAllocationData";
import {
  FundoKey, computeStatus, STATUS_LABEL, STATUS_BADGE_CLASS, fmtPct,
} from "./allocationUtils";

interface Props { fundo: FundoKey; valDate?: string | null }

const CATEGORIAS: { key: "tipo_ativo" | "indexador" | "rating"; titulo: string }[] = [
  { key: "tipo_ativo", titulo: "Limites por Tipo de Ativo" },
  { key: "indexador", titulo: "Limites por Indexador" },
  { key: "rating", titulo: "Limites por Faixa de Rating" },
];

export function FundLimitsPanel({ fundo, valDate }: Props) {
  const { data: limits = [], isLoading: lLoading } = useAllocationLimits();
  const { data: agg, isLoading: aLoading } = useAllocationData(fundo, valDate ?? null);

  const limitsByCat = useMemo(() => {
    const m: Record<string, { sub: string; lim: number | null }[]> = {};
    for (const l of limits) {
      if (l.fundo !== fundo) continue;
      (m[l.categoria] ??= []).push({ sub: l.subcategoria, lim: l.limite_pct });
    }
    // "Crédito Privado" sempre primeiro em tipo_ativo
    if (m["tipo_ativo"]) {
      m["tipo_ativo"].sort((a, b) => {
        if (a.sub === "Crédito Privado") return -1;
        if (b.sub === "Crédito Privado") return 1;
        return 0;
      });
    }
    return m;
  }, [limits, fundo]);

  if (lLoading) return <Skeleton className="h-40 w-full" />;

  const hasData = (agg?.totalFundo ?? 0) > 0;

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        {agg?.valDate ? <>Data de referência: <span className="font-mono">{agg.valDate}</span> · PL total: <span className="font-mono">R$ {(agg.totalFundo / 1_000_000).toFixed(2)}M</span></> : "Sem posições para este fundo."}
      </div>
      {CATEGORIAS.map(({ key, titulo }) => (
        <CategoryPanel
          key={key}
          titulo={titulo}
          rows={limitsByCat[key] ?? []}
          getPct={(sub) => {
            const map = key === "tipo_ativo" ? agg?.porTipo : key === "indexador" ? agg?.porIndexador : agg?.porRating;
            return map?.get(sub)?.pct ?? 0;
          }}
          hasData={hasData}
          loading={aLoading}
        />
      ))}
    </div>
  );
}

function CategoryPanel({
  titulo, rows, getPct, hasData, loading,
}: {
  titulo: string;
  rows: { sub: string; lim: number | null }[];
  getPct: (sub: string) => number;
  hasData: boolean;
  loading: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border rounded-lg">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 font-semibold text-sm hover:bg-muted/40 rounded-t-lg">
        {titulo}
        <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/3">Categoria</TableHead>
                <TableHead className="text-right">Limite</TableHead>
                <TableHead className="text-right">Posição Atual</TableHead>
                <TableHead className="text-right">Headroom</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => {
                const pos = getPct(r.sub);
                const headroom = r.lim != null ? r.lim - pos : null;
                const st = computeStatus(pos, r.lim, hasData);
                return (
                  <TableRow key={r.sub}>
                    <TableCell className="font-medium">{r.sub}</TableCell>
                    <TableCell className="text-right font-mono">{fmtPct(r.lim)}</TableCell>
                    <TableCell className="text-right font-mono">{loading ? "…" : fmtPct(pos)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtPct(headroom)}</TableCell>
                    <TableCell className="text-center">
                      <span className={cn("inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide", STATUS_BADGE_CLASS[st])}>
                        {STATUS_LABEL[st]}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-sm">Nenhum limite definido.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
