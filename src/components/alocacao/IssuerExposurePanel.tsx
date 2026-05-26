import { useMemo, useState, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAllocationLimits, useAllocationData, useAllocationTargetPeriods, useAllocationEmissorTargets, AtivoInfo } from "./useAllocationData";
import {
  FundoKey, computeStatus, STATUS_LABEL, STATUS_BADGE_CLASS, fmtPct,
} from "./allocationUtils";
import { STATUS_BADGE_CLASS as ANALISE_BADGE } from "@/utils/analiseStatus";

interface Props { fundo: FundoKey; valDate?: string | null }

type SortKey = "grupo" | "emissores" | "rating" | "limite" | "pct" | "headroom" | "status" | "analise";
type SortDir = "asc" | "desc";

// Debêntures Infra é IPCA+; demais fundos são CDI+
function isFundoIPCA(fundo: FundoKey): boolean {
  return fundo === "Debentures_INFRA_RF";
}

function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v == null || isNaN(v as any)) return "—";
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function taxaLabel(a: AtivoInfo, fundo: FundoKey): string {
  // Preferir taxa_emissao quando existir (texto já formatado)
  if (a.taxaEmissao && a.taxaEmissao.trim()) return a.taxaEmissao.trim();
  const sub = a.subIndexador;
  const v = a.lastSpread;
  if (v == null) return "—";
  if (sub === "IPCA") return `IPCA + ${v.toFixed(2)}%`;
  if (sub === "DI_SPREAD") return `CDI + ${v.toFixed(2)}%`;
  if (sub === "CDI_PCT") return `${v.toFixed(2)}% CDI`;
  if (sub === "PRE") return `${v.toFixed(2)}% a.a.`;
  // Fallback pelo fundo
  return isFundoIPCA(fundo) ? `IPCA + ${v.toFixed(2)}%` : `CDI + ${v.toFixed(2)}%`;
}

export function IssuerExposurePanel({ fundo, valDate }: Props) {
  const { data: limits = [] } = useAllocationLimits();
  const { data: agg, isLoading } = useAllocationData(fundo, valDate ?? null);
  const { data: periods = [] } = useAllocationTargetPeriods(fundo);
  const activePeriod = periods.find(p => p.ativo) ?? null;
  const { data: emissorTargets = [] } = useAllocationEmissorTargets(activePeriod?.id ?? null, fundo);
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("pct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (k: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  };

  const limitByRating = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const l of limits) {
      if (l.fundo === fundo && l.categoria === "emissor") m.set(l.subcategoria, l.limite_pct);
    }
    return m;
  }, [limits, fundo]);

  const targetByCnpj = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of emissorTargets) {
      if (t.target_pct != null) m.set(t.cnpj_emissor, t.target_pct);
    }
    return m;
  }, [emissorTargets]);

  const enriched = useMemo(() => {
    if (!agg) return [];
    return agg.porGrupo.map(g => {
      const targets = g.emissores.map(e => targetByCnpj.get(e.cnpj)).filter((v): v is number => v != null);
      const baseLim = g.isTermoSummary
        ? null
        : g.isSoberano
          ? (limitByRating.get("Soberano") ?? 100)
          : (limitByRating.get(g.ratingBucket) ?? null);
      const lim = targets.length > 0 ? Math.max(...targets) : baseLim;
      const headroom = lim != null ? lim - g.pct : null;
      const st = g.isTermoSummary ? "SEM_LIMITE" as const : computeStatus(g.pct, lim, true);
      return { ...g, lim, headroom, st };
    });
  }, [agg, limitByRating, targetByCnpj]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return enriched;
    return enriched.filter(g =>
      g.grupo.toLowerCase().includes(q) ||
      g.emissores.some(e => e.nome.toLowerCase().includes(q))
    );
  }, [enriched, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const cmp = (a: any, b: any): number => {
      let av: any; let bv: any;
      switch (sortKey) {
        case "grupo": av = a.grupo; bv = b.grupo; break;
        case "emissores": av = a.emissores.map((e: any) => e.nome).join(", "); bv = b.emissores.map((e: any) => e.nome).join(", "); break;
        case "rating": av = a.ratingBucket; bv = b.ratingBucket; break;
        case "limite": av = a.lim ?? -1; bv = b.lim ?? -1; break;
        case "pct": av = a.pct; bv = b.pct; break;
        case "headroom": av = a.headroom ?? -Infinity; bv = b.headroom ?? -Infinity; break;
        case "status": av = a.st; bv = b.st; break;
        case "analise": av = a.statusAnalise ?? ""; bv = b.statusAnalise ?? ""; break;
      }
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? (av - bv) : (bv - av);
    };
    arr.sort((a, b) => {
      if (a.isTermoSummary && !b.isTermoSummary) return 1;
      if (!a.isTermoSummary && b.isTermoSummary) return -1;
      return cmp(a, b);
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "grupo" || k === "emissores" || k === "rating" || k === "status" || k === "analise" ? "asc" : "desc"); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 inline ml-1" /> : <ArrowDown className="w-3 h-3 inline ml-1" />;
  };

  if (isLoading) return <Skeleton className="h-60 w-full" />;
  if (!agg || agg.porGrupo.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground">
        Nenhuma posição encontrada para este fundo. Faça upload do arquivo de posições para visualizar o enquadramento.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar grupo ou emissor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
        <span className="text-xs text-muted-foreground">{sorted.length} {sorted.length === 1 ? "linha" : "linhas"}</span>
      </div>
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("grupo")}>Grupo Econômico<SortIcon k="grupo" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("emissores")}>Emissores<SortIcon k="emissores" /></TableHead>
              <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort("rating")}>Rating<SortIcon k="rating" /></TableHead>
              <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("limite")}>Limite<SortIcon k="limite" /></TableHead>
              <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("pct")}>% do PL<SortIcon k="pct" /></TableHead>
              <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("headroom")}>Headroom<SortIcon k="headroom" /></TableHead>
              <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort("status")}>Enquadr.<SortIcon k="status" /></TableHead>
              <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort("analise")}>Status Análise<SortIcon k="analise" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map(g => {
              const isExpanded = expanded.has(g.grupo);
              const ativos = g.ativos ?? [];
              const canExpand = !g.isTermoSummary && ativos.length > 0;
              return (
                <Fragment key={g.grupo}>
                  <TableRow className={cn(g.isTermoSummary && "bg-muted/30 italic")}>
                    <TableCell className="w-8 p-1">
                      {canExpand && (
                        <button
                          onClick={() => toggleExpand(g.grupo)}
                          className="p-1 hover:bg-muted rounded"
                          aria-label={isExpanded ? "Recolher" : "Expandir"}
                        >
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {g.grupo}
                      {g.isSoberano && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 font-bold uppercase">Soberano</span>}
                    </TableCell>
                    <TableCell>
                      {g.isTermoSummary ? (
                        <span className="text-xs text-muted-foreground">— Operações compromissadas em B3 —</span>
                      ) : (
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
                      )}
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs">{g.ratingBucket}</TableCell>
                    <TableCell className="text-right font-mono">{fmtPct(g.lim)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtPct(g.pct)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtPct(g.headroom)}</TableCell>
                    <TableCell className="text-center">
                      <span className={cn("inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide", STATUS_BADGE_CLASS[g.st])}>
                        {STATUS_LABEL[g.st]}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {g.statusAnalise ? (
                        <span className={cn("inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border", ANALISE_BADGE[g.statusAnalise] ?? "bg-muted text-muted-foreground border-border")}>
                          {g.statusAnalise}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                  {isExpanded && canExpand && (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell />
                      <TableCell colSpan={8} className="p-3">
                        <div className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                          Ativos do grupo ({ativos.filter(a => a.inCarteira).length} em carteira · {ativos.filter(a => !a.inCarteira).length} disponíveis)
                        </div>
                        <div className="border rounded bg-background">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-[10px] uppercase">Ticker</TableHead>
                                <TableHead className="text-[10px] uppercase">Emissor</TableHead>
                                <TableHead className="text-center text-[10px] uppercase">Carteira</TableHead>
                                <TableHead className="text-[10px] uppercase">Taxa</TableHead>
                                <TableHead className="text-right text-[10px] uppercase">Duration</TableHead>
                                <TableHead className="text-right text-[10px] uppercase">PU</TableHead>
                                <TableHead className="text-right text-[10px] uppercase">PU PAR</TableHead>
                                <TableHead className="text-right text-[10px] uppercase">Venc.</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {ativos.map(a => (
                                <TableRow key={a.ticker} className={cn(!a.inCarteira && "opacity-70")}>
                                  <TableCell className="font-mono text-xs font-semibold">{a.ticker}</TableCell>
                                  <TableCell className="text-xs">{a.emissorNome}</TableCell>
                                  <TableCell className="text-center">
                                    {a.inCarteira ? (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 font-bold uppercase">Sim</span>
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs font-mono">{taxaLabel(a, fundo)}</TableCell>
                                  <TableCell className="text-right font-mono text-xs">
                                    {a.duration != null ? fmtNum(a.duration, 2) : (a.anosVenc != null ? `${fmtNum(a.anosVenc, 1)}a` : "—")}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-xs">{fmtNum(a.pu, 2)}</TableCell>
                                  <TableCell className="text-right font-mono text-xs">{fmtNum(a.puPar, 2)}</TableCell>
                                  <TableCell className="text-right font-mono text-xs">{a.vencDate ?? "—"}</TableCell>
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
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
