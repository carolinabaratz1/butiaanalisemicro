import { useMemo, useState, Fragment } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight, Download, Search, AlertTriangle, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { RatingBadge } from "@/components/ratings/RatingBadge";
import {
  useExposicaoData,
  type GrupoAgg,
  type EmissorAgg,
  type StatusKey,
} from "./useExposicaoData";
import { exportExposicao } from "./exposicaoExport";

const STATUS_CLASS: Record<StatusKey, string> = {
  Aprovado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  "Com restrição": "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  "Em análise": "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  Pendente: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  Vencido: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  "Sem análise": "bg-muted text-muted-foreground border-border",
  "Não aprovado": "bg-red-700/25 text-red-900 dark:text-red-200 border-red-700/50",
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtPct = (v: number | null | undefined, d = 2) =>
  v == null ? "—" : `${(v * 100).toFixed(d)}%`;

function ExposureCell({
  value,
  pct,
}: {
  value: number | undefined;
  pct: number | null | undefined;
}) {
  if (!value) return <TableCell className="text-right text-muted-foreground">—</TableCell>;
  const widthPct = pct == null ? 0 : Math.min(100, (pct * 100) / 10);
  return (
    <TableCell className="text-right tabular-nums">
      <div className="text-xs font-medium">{fmtBRL(value)}</div>
      <div className="text-[10px] text-muted-foreground">{fmtPct(pct, 2)}</div>
      <div className="h-1 mt-0.5 bg-muted rounded overflow-hidden">
        <div className="h-full bg-primary/60" style={{ width: `${widthPct}%` }} />
      </div>
    </TableCell>
  );
}

function StatusBadge({ status }: { status: StatusKey }) {
  return (
    <Badge variant="outline" className={cn("text-[10px] whitespace-nowrap", STATUS_CLASS[status])}>
      {status}
    </Badge>
  );
}

interface Props {
  valDate: string | null;
  availableDates: string[];
  onValDateChange: (d: string) => void;
}

export function ExposicaoGrupoEmissorTab({ valDate, availableDates, onValDateChange }: Props) {
  const [mode, setMode] = useState<"grupo" | "emissor">("grupo");
  const [selectedFundos, setSelectedFundos] = useState<string[]>([]); // vazio = todos
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [setorFilter, setSetorFilter] = useState<string>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [vencidaFilter, setVencidaFilter] = useState<"all" | "yes" | "no">("all");
  const [comPosicaoFilter] = useState<"all" | "yes" | "no">("yes");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useExposicaoData(valDate);

  const toggle = (k: string) =>
    setExpanded((p) => {
      const n = new Set(p);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  const allFundos = data?.fundos ?? [];
  const effectiveFundos = useMemo(
    () => (selectedFundos.length === 0 ? allFundos : allFundos.filter((f) => selectedFundos.includes(f))),
    [allFundos, selectedFundos],
  );
  const fundosSet = useMemo(() => new Set(effectiveFundos), [effectiveFundos]);

  const plSelected = useMemo(() => {
    if (!data) return 0;
    return effectiveFundos.reduce((s, f) => s + (data.plByFundo[f] ?? 0), 0);
  }, [data, effectiveFundos]);

  const allSetores = useMemo(() => {
    if (!data) return [];
    const s = new Set<string>();
    for (const e of data.porEmissor) s.add(e.setor);
    return Array.from(s).sort();
  }, [data]);
  const allTipos = useMemo(() => {
    if (!data) return [];
    const s = new Set<string>();
    for (const e of data.porEmissor) for (const a of e.ativos) s.add(a.tipoAtivo);
    return Array.from(s).sort();
  }, [data]);

  const filteredEmissores = useMemo<EmissorAgg[]>(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const out: EmissorAgg[] = [];
    for (const e of data.porEmissor) {
      if (statusFilter !== "all" && e.status !== statusFilter) continue;
      if (ratingFilter !== "all" && e.ratingBucketLabel !== ratingFilter) continue;
      if (setorFilter !== "all" && e.setor !== setorFilter) continue;
      if (vencidaFilter === "yes" && e.status !== "Vencido") continue;
      if (vencidaFilter === "no" && e.status === "Vencido") continue;
      if (comPosicaoFilter === "yes" && e.totalButia <= 0) continue;

      const ativosFiltrados = e.ativos.filter((a) => {
        if (!fundosSet.has(a.fundo)) return false;
        if (tipoFilter !== "all" && a.tipoAtivo !== tipoFilter) return false;
        if (q) {
          const hay = [e.nome, e.grupoEconomico, e.cnpj, a.isin ?? "", a.produto, a.ticker ?? ""]
            .join(" ")
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      if (!ativosFiltrados.length) continue;

      const expFundo: Record<string, number> = {};
      let total = 0;
      let num = 0;
      let den = 0;
      for (const a of ativosFiltrados) {
        expFundo[a.fundo] = (expFundo[a.fundo] ?? 0) + a.valor;
        total += a.valor;
        if (a.taxaNum != null) {
          num += a.taxaNum * a.valor;
          den += a.valor;
        }
      }
      const pctByFundo: Record<string, number | null> = {};
      for (const f of Object.keys(expFundo)) {
        const pl = data.plByFundo[f];
        pctByFundo[f] = pl ? expFundo[f] / pl : null;
      }
      out.push({
        ...e,
        ativos: ativosFiltrados,
        exposureByFundo: expFundo,
        pctByFundo,
        totalButia: total,
        weightedRate: den > 0 ? num / den : null,
        hasTaxa: den > 0,
        consolidatedPct: plSelected ? total / plSelected : null,
      });
    }
    return out.sort((a, b) => b.totalButia - a.totalButia);
  }, [
    data,
    statusFilter,
    ratingFilter,
    setorFilter,
    tipoFilter,
    fundosSet,
    vencidaFilter,
    comPosicaoFilter,
    search,
    plSelected,
  ]);

  const filteredGrupos = useMemo<GrupoAgg[]>(() => {
    if (!data) return [];
    const byGrupo = new Map<string, EmissorAgg[]>();
    for (const e of filteredEmissores) {
      const list = byGrupo.get(e.grupoEconomico) ?? [];
      list.push(e);
      byGrupo.set(e.grupoEconomico, list);
    }
    const out: GrupoAgg[] = [];
    for (const [grupo, emissores] of byGrupo.entries()) {
      const exp: Record<string, number> = {};
      let total = 0;
      let num = 0;
      let den = 0;
      const setorAgg = new Map<string, number>();
      for (const e of emissores) {
        total += e.totalButia;
        for (const [f, v] of Object.entries(e.exposureByFundo)) exp[f] = (exp[f] ?? 0) + v;
        setorAgg.set(e.setor, (setorAgg.get(e.setor) ?? 0) + e.totalButia);
        for (const a of e.ativos) {
          if (a.taxaNum != null) {
            num += a.taxaNum * a.valor;
            den += a.valor;
          }
        }
      }
      const pct: Record<string, number | null> = {};
      for (const f of Object.keys(exp)) {
        const pl = data.plByFundo[f];
        pct[f] = pl ? exp[f] / pl : null;
      }
      const buckets = emissores.map((e) => e.ratingBucketLabel);
      const RATING_ORDER = ["<BBB", "BBB", "Sem Rating", "A", "AA", "AAA"];
      const ratingLabel = RATING_ORDER.find((r) => buckets.includes(r)) ?? "Sem Rating";
      const SEV: Record<string, number> = {
        "Não aprovado": 1,
        Vencido: 2,
        "Com restrição": 3,
        Pendente: 4,
        "Em análise": 5,
        "Sem análise": 6,
        Aprovado: 7,
      };
      const status = (emissores.map((e) => e.status).sort((a, b) => SEV[a] - SEV[b])[0] ??
        "Sem análise") as StatusKey;
      out.push({
        grupo,
        nEmissores: emissores.length,
        ratingBucketLabel: ratingLabel,
        setor: Array.from(setorAgg.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—",
        totalButia: total,
        consolidatedPct: plSelected ? total / plSelected : null,
        exposureByFundo: exp,
        pctByFundo: pct,
        weightedRate: den > 0 ? num / den : null,
        hasTaxa: den > 0,
        ultimaAnalise:
          emissores
            .map((e) => e.ultimaAnalise)
            .filter(Boolean)
            .sort()
            .pop() ?? null,
        status,
        emissores,
        mapped: grupo !== "Grupo não mapeado",
      });
    }
    return out.sort((a, b) => b.totalButia - a.totalButia);
  }, [data, filteredEmissores, plSelected]);

  const cards = useMemo(() => {
    if (mode === "grupo") {
      const total = filteredGrupos.reduce((s, g) => s + g.totalButia, 0);
      const vencidos = filteredGrupos.filter((g) => g.status === "Vencido").length;
      const semAnalise = filteredGrupos.filter((g) => g.status === "Sem análise").length;
      const maior = filteredGrupos[0];
      return [
        { label: "Exposição Total", value: fmtBRL(total) },
        { label: "Grupos com posição", value: String(filteredGrupos.length) },
        { label: "Análise vencida", value: String(vencidos) },
        { label: "Sem análise", value: String(semAnalise) },
        { label: "Maior exposição", value: maior ? fmtBRL(maior.totalButia) : "—" },
        { label: "Maior grupo", value: maior?.grupo ?? "—" },
      ];
    }
    const total = filteredEmissores.reduce((s, e) => s + e.totalButia, 0);
    const vencidos = filteredEmissores.filter((e) => e.status === "Vencido").length;
    const semAnalise = filteredEmissores.filter((e) => e.status === "Sem análise").length;
    const maior = filteredEmissores[0];
    return [
      { label: "Exposição Total", value: fmtBRL(total) },
      { label: "Emissores com posição", value: String(filteredEmissores.length) },
      { label: "Análise vencida", value: String(vencidos) },
      { label: "Sem análise", value: String(semAnalise) },
      { label: "Maior exposição", value: maior ? fmtBRL(maior.totalButia) : "—" },
      { label: "Maior emissor", value: maior?.nome ?? "—" },
    ];
  }, [mode, filteredGrupos, filteredEmissores]);

  const sumFiltered = filteredEmissores.reduce((s, e) => s + e.totalButia, 0);

  const fundosLabel =
    selectedFundos.length === 0
      ? "Todos os fundos"
      : selectedFundos.length === 1
        ? selectedFundos[0]
        : `${selectedFundos.length} fundos selecionados`;

  const handleExport = () => {
    if (!data) return;
    const filtersLabel = [
      `Fundos: ${fundosLabel}`,
      `Status: ${statusFilter === "all" ? "Todos" : statusFilter}`,
      `Rating: ${ratingFilter === "all" ? "Todos" : ratingFilter}`,
      `Setor: ${setorFilter === "all" ? "Todos" : setorFilter}`,
      `Tipo: ${tipoFilter === "all" ? "Todos" : tipoFilter}`,
      `Vencida: ${vencidaFilter === "all" ? "Todos" : vencidaFilter === "yes" ? "Sim" : "Não"}`,
      `Busca: ${search || "—"}`,
    ].join(" | ");
    const filteredData = {
      ...data,
      fundos: effectiveFundos,
      porGrupo: filteredGrupos,
      porEmissor: filteredEmissores,
    };
    exportExposicao(filteredData, mode, filtersLabel);
  };

  const toggleFundo = (f: string) =>
    setSelectedFundos((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  return (
    <div className="space-y-3">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-surface-1 border border-border rounded-md p-0.5">
          <button
            onClick={() => setMode("grupo")}
            className={cn(
              "px-3 py-1 text-xs rounded",
              mode === "grupo" ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground",
            )}
          >
            Grupo Econômico
          </button>
          <button
            onClick={() => setMode("emissor")}
            className={cn(
              "px-3 py-1 text-xs rounded",
              mode === "emissor" ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground",
            )}
          >
            Emissor
          </button>
        </div>

        <Select value={valDate ?? ""} onValueChange={onValDateChange}>
          <SelectTrigger className="w-44 h-8 text-xs bg-surface-1 border-border">
            <SelectValue placeholder="Data ref." />
          </SelectTrigger>
          <SelectContent>
            {availableDates.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Multi-fund select */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs bg-surface-1 border-border justify-between min-w-[220px]"
            >
              <span className="flex items-center gap-1.5 truncate">
                <Filter className="h-3.5 w-3.5" />
                {fundosLabel}
              </span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <div className="p-2 border-b border-border flex items-center justify-between">
              <span className="text-xs font-medium">Selecionar fundos</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setSelectedFundos([])}
                  className="text-[10px] text-primary hover:underline"
                >
                  Todos
                </button>
                <span className="text-[10px] text-muted-foreground">·</span>
                <button
                  onClick={() => setSelectedFundos(allFundos.slice())}
                  className="text-[10px] text-primary hover:underline"
                >
                  Marcar todos
                </button>
                <span className="text-[10px] text-muted-foreground">·</span>
                <button
                  onClick={() => setSelectedFundos([])}
                  className="text-[10px] text-primary hover:underline"
                >
                  Limpar
                </button>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto p-1">
              {allFundos.map((f) => {
                const checked = selectedFundos.length === 0 || selectedFundos.includes(f);
                return (
                  <label
                    key={f}
                    className="flex items-center gap-2 px-2 py-1 hover:bg-muted/40 rounded cursor-pointer text-xs"
                  >
                    <Checkbox
                      checked={checked && selectedFundos.length > 0}
                      onCheckedChange={() => toggleFundo(f)}
                    />
                    <span className="truncate">{f}</span>
                  </label>
                );
              })}
              {allFundos.length === 0 && (
                <div className="text-xs text-muted-foreground p-2">Sem fundos.</div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-8 text-xs bg-surface-1 border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {(
              [
                "Aprovado",
                "Com restrição",
                "Em análise",
                "Pendente",
                "Vencido",
                "Sem análise",
                "Não aprovado",
              ] as StatusKey[]
            ).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-32 h-8 text-xs bg-surface-1 border-border">
            <SelectValue placeholder="Rating" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos ratings</SelectItem>
            {["AAA", "AA", "A", "BBB", "<BBB", "Sem Rating"].map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={setorFilter} onValueChange={setSetorFilter}>
          <SelectTrigger className="w-40 h-8 text-xs bg-surface-1 border-border">
            <SelectValue placeholder="Setor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos setores</SelectItem>
            {allSetores.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-44 h-8 text-xs bg-surface-1 border-border">
            <SelectValue placeholder="Tipo de ativo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            {allTipos.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={vencidaFilter} onValueChange={(v) => setVencidaFilter(v as any)}>
          <SelectTrigger className="w-36 h-8 text-xs bg-surface-1 border-border">
            <SelectValue placeholder="Vencida" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vencida: Todos</SelectItem>
            <SelectItem value="yes">Vencida: Sim</SelectItem>
            <SelectItem value="no">Vencida: Não</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar grupo, emissor, ativo, CNPJ, ticker ou ISIN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-8 text-xs bg-surface-1 border-border"
          />
        </div>

        <Button onClick={handleExport} size="sm" variant="outline" className="h-8 text-xs">
          <Download className="h-3.5 w-3.5 mr-1" /> Exportar .xlsx
        </Button>
      </div>

      {/* Chips of selected funds */}
      {selectedFundos.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-muted-foreground">Fundos:</span>
          {selectedFundos.map((f) => (
            <Badge
              key={f}
              variant="outline"
              className="text-[10px] cursor-pointer hover:bg-muted"
              onClick={() => toggleFundo(f)}
            >
              {f} ✕
            </Badge>
          ))}
          <button
            onClick={() => setSelectedFundos([])}
            className="text-[10px] text-primary hover:underline ml-1"
          >
            limpar
          </button>
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {cards.map((c) => (
          <Card key={c.label} className="bg-surface-1 border-border">
            <CardContent className="p-3">
              <div className="text-[10px] uppercase text-muted-foreground tracking-wide">
                {c.label}
              </div>
              <div className="text-sm font-semibold truncate" title={c.value}>
                {c.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {data && (data.unmappedIssuersCount > 0 || data.unmappedGroupsCount > 0) && (
        <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>
            {data.unmappedIssuersCount} emissor(es) sem mapeamento ·{" "}
            {data.unmappedGroupsCount} grupo(s) sem mapeamento ·{" "}
            {data.assetsWithoutRate} ativo(s) sem taxa
          </span>
        </div>
      )}

      <Card className="bg-surface-1 border-border">
        <CardContent className="p-0">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              {mode === "grupo" ? "Exposição por Grupo Econômico" : "Exposição por Emissor"}
            </h3>
            <div className="text-[10px] text-muted-foreground">
              Soma filtrada: {fmtBRL(sumFiltered)} · PL considerado: {fmtBRL(plSelected)}
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-[11px]">
                  <TableHead className="w-8 sticky left-0 bg-surface-1"></TableHead>
                  <TableHead className="sticky left-8 bg-surface-1 min-w-[220px]">
                    {mode === "grupo" ? "Grupo Econômico" : "Emissor"}
                  </TableHead>
                  {mode === "grupo" ? (
                    <TableHead className="text-center">Nº Emissores</TableHead>
                  ) : (
                    <TableHead>Grupo</TableHead>
                  )}
                  <TableHead className="text-center">Rating</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead className="text-right">Taxa média</TableHead>
                  {effectiveFundos.map((f) => (
                    <TableHead key={f} className="text-right min-w-[140px]">
                      {f.length > 24 ? f.slice(0, 24) + "…" : f}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Exp. Total</TableHead>
                  <TableHead className="text-right">% Consol.</TableHead>
                  <TableHead>Última Análise</TableHead>
                  <TableHead className="whitespace-nowrap">
                    {mode === "grupo" ? "Status do Grupo" : "Status do Emissor"}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={20} className="text-center text-xs text-muted-foreground py-6">
                      Carregando…
                    </TableCell>
                  </TableRow>
                )}
                {error && (
                  <TableRow>
                    <TableCell colSpan={20} className="text-center text-xs text-destructive py-6">
                      Erro ao carregar dados.
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && mode === "grupo" &&
                  filteredGrupos.map((g) => (
                    <GrupoRow
                      key={g.grupo}
                      g={g}
                      fundos={effectiveFundos}
                      expanded={expanded}
                      toggle={toggle}
                    />
                  ))}
                {!isLoading && mode === "emissor" &&
                  filteredEmissores.map((e) => (
                    <EmissorRow
                      key={e.cnpj || e.nome}
                      e={e}
                      fundos={effectiveFundos}
                      expanded={expanded}
                      toggle={toggle}
                      showGroupCol
                      inGroupMode={false}
                    />
                  ))}
                {!isLoading && !error && (filteredGrupos.length === 0 && filteredEmissores.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={20} className="text-center text-xs text-muted-foreground py-6">
                      Nenhum resultado para os filtros aplicados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function severityBorder(status: StatusKey): string {
  if (status === "Vencido") return "border-l-2 border-red-500 bg-red-500/5";
  if (status === "Não aprovado") return "border-l-2 border-red-700 bg-red-700/5";
  return "";
}

function GrupoRow({
  g,
  fundos,
  expanded,
  toggle,
}: {
  g: GrupoAgg;
  fundos: string[];
  expanded: Set<string>;
  toggle: (k: string) => void;
}) {
  const key = `g:${g.grupo}`;
  const isOpen = expanded.has(key);
  return (
    <Fragment>
      <TableRow className={cn("text-xs", severityBorder(g.status))}>
        <TableCell className="sticky left-0 bg-background">
          <button onClick={() => toggle(key)}>
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </TableCell>
        <TableCell className="sticky left-8 bg-background font-medium">
          {g.grupo}
          {!g.mapped && (
            <Badge variant="outline" className="ml-2 text-[9px] border-amber-500 text-amber-600">
              não mapeado
            </Badge>
          )}
        </TableCell>
        <TableCell className="text-center">{g.nEmissores}</TableCell>
        <TableCell className="text-center">
          <Badge variant="outline" className="font-mono text-[10px]">
            {g.ratingBucketLabel}
          </Badge>
        </TableCell>
        <TableCell className="truncate max-w-[160px]">{g.setor}</TableCell>
        <TableCell className="text-right tabular-nums">
          {g.weightedRate != null ? `${g.weightedRate.toFixed(2)}%` : "N/D"}
        </TableCell>
        {fundos.map((f) => (
          <ExposureCell key={f} value={g.exposureByFundo[f]} pct={g.pctByFundo[f]} />
        ))}
        <TableCell className="text-right tabular-nums font-medium">{fmtBRL(g.totalButia)}</TableCell>
        <TableCell className="text-right tabular-nums">{fmtPct(g.consolidatedPct)}</TableCell>
        <TableCell className="text-xs">{g.ultimaAnalise ?? "—"}</TableCell>
        <TableCell>
          <StatusBadge status={g.status} />
        </TableCell>
      </TableRow>
      {isOpen &&
        g.emissores.map((e) => (
          <EmissorRow
            key={e.cnpj || e.nome}
            e={e}
            fundos={fundos}
            expanded={expanded}
            toggle={toggle}
            indent
            inGroupMode
          />
        ))}
    </Fragment>
  );
}

function EmissorRow({
  e,
  fundos,
  expanded,
  toggle,
  indent,
  showGroupCol,
  inGroupMode,
}: {
  e: EmissorAgg;
  fundos: string[];
  expanded: Set<string>;
  toggle: (k: string) => void;
  indent?: boolean;
  showGroupCol?: boolean;
  inGroupMode?: boolean;
}) {
  const key = `e:${e.cnpj || e.nome}`;
  const isOpen = expanded.has(key);
  const statusLabel = inGroupMode ? "Status do Emissor" : "Status do Emissor";
  return (
    <Fragment>
      <TableRow className={cn("text-xs", indent && "bg-muted/20", severityBorder(e.status))}>
        <TableCell className="sticky left-0 bg-background">
          <button onClick={() => toggle(key)}>
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </TableCell>
        <TableCell className={cn("sticky left-8 bg-background", indent && "pl-6")}>
          {e.nome}
          {!e.mapped && (
            <Badge variant="outline" className="ml-2 text-[9px] border-amber-500 text-amber-600">
              não mapeado
            </Badge>
          )}
        </TableCell>
        {showGroupCol ? (
          <TableCell className="truncate max-w-[160px]">{e.grupoEconomico}</TableCell>
        ) : (
          <TableCell className="text-center text-muted-foreground">—</TableCell>
        )}
        <TableCell className="text-center">
          <RatingBadge
            rating={e.rating.rating}
            source={e.rating.source}
            agencia={e.rating.agencia}
            data={e.rating.data_rating}
          />
        </TableCell>
        <TableCell className="truncate max-w-[160px]">{e.setor}</TableCell>
        <TableCell className="text-right tabular-nums">
          {e.weightedRate != null ? `${e.weightedRate.toFixed(2)}%` : "N/D"}
        </TableCell>
        {fundos.map((f) => (
          <ExposureCell key={f} value={e.exposureByFundo[f]} pct={e.pctByFundo[f]} />
        ))}
        <TableCell className="text-right tabular-nums font-medium">{fmtBRL(e.totalButia)}</TableCell>
        <TableCell className="text-right tabular-nums">{fmtPct(e.consolidatedPct)}</TableCell>
        <TableCell className="text-xs">{e.ultimaAnalise ?? "—"}</TableCell>
        <TableCell aria-label={statusLabel}>
          <StatusBadge status={e.status} />
        </TableCell>
      </TableRow>
      {isOpen && (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={6 + fundos.length + 4} className="p-0">
            <div className="px-6 py-2 overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="text-left py-1">Ticker</th>
                    <th className="text-left py-1">Ativo</th>
                    <th className="text-left py-1">Tipo</th>
                    <th className="text-left py-1">ISIN</th>
                    <th className="text-left py-1">Fundo</th>
                    <th className="text-right py-1">Valor</th>
                    <th className="text-right py-1">% Fundo</th>
                    <th className="text-right py-1">Taxa</th>
                    <th className="text-left py-1">Venc.</th>
                    <th className="text-right py-1">Dur. (DU)</th>
                    <th className="text-left py-1">Status da Análise</th>
                  </tr>
                </thead>
                <tbody>
                  {e.ativos.map((a) => (
                    <tr key={a.posicaoId} className={cn("border-t border-border/40", severityBorder(a.status))}>
                      <td className="py-1 font-mono">{a.ticker ?? "N/D"}</td>
                      <td className="py-1">{a.produto}</td>
                      <td className="py-1">{a.tipoAtivo}</td>
                      <td className="py-1 font-mono">{a.isin ?? "—"}</td>
                      <td className="py-1">{a.fundo}</td>
                      <td className="py-1 text-right tabular-nums">{fmtBRL(a.valor)}</td>
                      <td className="py-1 text-right tabular-nums">{fmtPct(a.pctFundo)}</td>
                      <td className="py-1 text-right tabular-nums">
                        {a.taxaLabel ?? (a.taxaNum != null ? `${a.taxaNum.toFixed(2)}%` : "—")}
                      </td>
                      <td className="py-1">{a.vencimento ?? "—"}</td>
                      <td className="py-1 text-right tabular-nums">{a.durationDU ?? "—"}</td>
                      <td className="py-1">
                        <StatusBadge status={a.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}
