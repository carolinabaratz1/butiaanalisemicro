import { Fragment, useMemo, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ChevronDown, ArrowDown, ArrowUp, ArrowUpDown, Search, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAllocationLimits, useAllocationData, useAllocationTargetPeriods, useAllocationTargets,
  useAllocationSetorTargets, AtivoBreakdown,
} from "./useAllocationData";
import {
  FundoKey, computeStatus, STATUS_LABEL, STATUS_BADGE_CLASS, fmtPct,
} from "./allocationUtils";

interface Props { fundo: FundoKey; valDate?: string | null }

const CATEGORIAS: { key: "tipo_ativo" | "indexador" | "rating"; titulo: string }[] = [
  { key: "tipo_ativo", titulo: "Limites por Tipo de Ativo" },
  { key: "indexador", titulo: "Limites por Indexador" },
  { key: "rating", titulo: "Limites por Faixa de Rating" },
];

const DEFAULT_SETOR_LIMIT = 20; // %

export function FundLimitsPanel({ fundo, valDate }: Props) {
  const { data: limits = [], isLoading: lLoading } = useAllocationLimits();
  const { data: agg, isLoading: aLoading } = useAllocationData(fundo, valDate ?? null);
  const { data: periods = [] } = useAllocationTargetPeriods(fundo);
  const activePeriod = periods.find(p => p.ativo) ?? null;
  const { data: periodTargets = [] } = useAllocationTargets(activePeriod?.id ?? null);
  const { data: setorTargets = [] } = useAllocationSetorTargets(activePeriod?.id ?? null, fundo);

  const overrideByTipo = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const t of periodTargets) {
      if (t.fundo !== fundo) continue;
      if (t.target_pct != null) m.set(t.tipo_ativo, t.target_pct);
      else if (t.limite_pct != null && !m.has(t.tipo_ativo)) m.set(t.tipo_ativo, t.limite_pct);
    }
    return m;
  }, [periodTargets, fundo]);

  const limitsByCat = useMemo(() => {
    const m: Record<string, { sub: string; lim: number | null }[]> = {};
    for (const l of limits) {
      if (l.fundo !== fundo) continue;
      const lim = l.categoria === "tipo_ativo" && overrideByTipo.has(l.subcategoria)
        ? overrideByTipo.get(l.subcategoria) ?? l.limite_pct
        : l.limite_pct;
      (m[l.categoria] ??= []).push({ sub: l.subcategoria, lim });
    }
    if (m["tipo_ativo"]) {
      m["tipo_ativo"].sort((a, b) => {
        if (a.sub === "Crédito Privado") return -1;
        if (b.sub === "Crédito Privado") return 1;
        return 0;
      });
    }
    return m;
  }, [limits, fundo, overrideByTipo]);

  // Linhas para Setor: união entre setores presentes nas posições e setores com limite definido
  const setorRows = useMemo(() => {
    const limMap = new Map<string, number | null>();
    for (const t of setorTargets) {
      const v = t.limite_pct ?? t.target_pct;
      limMap.set(t.setor, v);
    }
    const keys = new Set<string>();
    for (const k of limMap.keys()) keys.add(k);
    if (agg?.porSetor) for (const k of agg.porSetor.keys()) keys.add(k);
    return Array.from(keys).sort().map(k => ({
      sub: k,
      lim: limMap.has(k) ? limMap.get(k)! : DEFAULT_SETOR_LIMIT,
    }));
  }, [setorTargets, agg]);

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
            if (key === "tipo_ativo" && sub === "Caixa Mínimo") {
              const a = agg?.porTipo?.get("Caixa Mínimo")?.pct ?? 0;
              const b = agg?.porTipo?.get("Compromissadas (Overnight)")?.pct ?? 0;
              return a + b;
            }
            return map?.get(sub)?.pct ?? 0;
          }}
          getAtivos={(sub) => {
            const map = key === "tipo_ativo" ? agg?.breakdownPorTipo : key === "indexador" ? agg?.breakdownPorIndexador : agg?.breakdownPorRating;
            if (key === "tipo_ativo" && sub === "Caixa Mínimo") {
              const a = agg?.breakdownPorTipo?.get("Caixa Mínimo") ?? [];
              const b = agg?.breakdownPorTipo?.get("Compromissadas (Overnight)") ?? [];
              return [...a, ...b];
            }
            return map?.get(sub) ?? [];
          }}
          hasData={hasData}
          loading={aLoading}
          pinFirst={key === "tipo_ativo" ? "Crédito Privado" : null}
        />
      ))}
      <CategoryPanel
        titulo="Limites por Setor (20% padrão)"
        rows={setorRows}
        getPct={(sub) => agg?.porSetor?.get(sub)?.pct ?? 0}
        getAtivos={(sub) => agg?.breakdownPorSetor?.get(sub) ?? []}
        hasData={hasData}
        loading={aLoading}
        pinFirst={null}
      />
    </div>
  );
}

type SortKey = "sub" | "lim" | "pos" | "headroom" | "status";
type SortDir = "asc" | "desc";

function CategoryPanel({
  titulo, rows, getPct, getAtivos, hasData, loading, pinFirst,
}: {
  titulo: string;
  rows: { sub: string; lim: number | null }[];
  getPct: (sub: string) => number;
  getAtivos: (sub: string) => AtivoBreakdown[];
  hasData: boolean;
  loading: boolean;
  pinFirst: string | null;
}) {
  const [open, setOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sub");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (k: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  };

  const enriched = useMemo(() => rows.map(r => {
    const pos = getPct(r.sub);
    const headroom = r.lim != null ? r.lim - pos : null;
    const st = computeStatus(pos, r.lim, hasData);
    return { ...r, pos, headroom, st };
  }), [rows, getPct, hasData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return enriched;
    return enriched.filter(r => r.sub.toLowerCase().includes(q));
  }, [enriched, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const cmp = (a: any, b: any): number => {
      let av: any, bv: any;
      switch (sortKey) {
        case "sub": av = a.sub; bv = b.sub; break;
        case "lim": av = a.lim ?? -Infinity; bv = b.lim ?? -Infinity; break;
        case "pos": av = a.pos; bv = b.pos; break;
        case "headroom": av = a.headroom ?? -Infinity; bv = b.headroom ?? -Infinity; break;
        case "status": av = a.st; bv = b.st; break;
      }
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? (av - bv) : (bv - av);
    };
    arr.sort((a, b) => {
      if (pinFirst) {
        if (a.sub === pinFirst && b.sub !== pinFirst) return -1;
        if (b.sub === pinFirst && a.sub !== pinFirst) return 1;
      }
      return cmp(a, b);
    });
    return arr;
  }, [filtered, sortKey, sortDir, pinFirst]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "sub" || k === "status" ? "asc" : "desc"); }
  };
  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 inline ml-1" /> : <ArrowDown className="w-3 h-3 inline ml-1" />;
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border rounded-lg">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 font-semibold text-sm hover:bg-muted/40 rounded-t-lg">
        {titulo}
        <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pt-3">
          <div className="relative max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filtrar categoria..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className="w-1/3 cursor-pointer select-none" onClick={() => toggleSort("sub")}>Categoria<SortIcon k="sub" /></TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("lim")}>Limite<SortIcon k="lim" /></TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("pos")}>Posição Atual<SortIcon k="pos" /></TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("headroom")}>Headroom<SortIcon k="headroom" /></TableHead>
                <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort("status")}>Status<SortIcon k="status" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map(r => {
                const ativos = getAtivos(r.sub);
                const canExpand = ativos.length > 0;
                const isExp = expanded.has(r.sub);
                return (
                  <Fragment key={r.sub}>
                    <TableRow>
                      <TableCell className="w-8 p-1">
                        {canExpand && (
                          <button
                            onClick={() => toggleExpand(r.sub)}
                            className="p-1 hover:bg-muted rounded"
                            aria-label={isExp ? "Recolher" : "Expandir"}
                          >
                            {isExp ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{r.sub}</TableCell>
                      <TableCell className="text-right font-mono">{fmtPct(r.lim)}</TableCell>
                      <TableCell className="text-right font-mono">{loading ? "…" : fmtPct(r.pos)}</TableCell>
                      <TableCell className="text-right font-mono">{fmtPct(r.headroom)}</TableCell>
                      <TableCell className="text-center">
                        <span className={cn("inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide", STATUS_BADGE_CLASS[r.st])}>
                          {STATUS_LABEL[r.st]}
                        </span>
                      </TableCell>
                    </TableRow>
                    {isExp && canExpand && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell />
                        <TableCell colSpan={5} className="p-3">
                          <div className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                            Ativos que compõem ({ativos.length})
                          </div>
                          <div className="border rounded bg-background">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-[10px] uppercase">Ticker</TableHead>
                                  <TableHead className="text-[10px] uppercase">Emissor</TableHead>
                                  <TableHead className="text-right text-[10px] uppercase">Posição (R$)</TableHead>
                                  <TableHead className="text-right text-[10px] uppercase">% do PL</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {ativos.map(a => (
                                  <TableRow key={a.ticker}>
                                    <TableCell className="font-mono text-xs font-semibold">{a.ticker}</TableCell>
                                    <TableCell className="text-xs">{a.emissor}</TableCell>
                                    <TableCell className="text-right font-mono text-xs">
                                      {a.posicaoRs.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-xs">{fmtPct(a.pct)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
              {sorted.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-sm">Nenhuma linha.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
