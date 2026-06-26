import { useEffect, useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Save, Plus, Search, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { resolveRatingsBatch, ratingKey } from "@/lib/ratings/resolveRatingsBatch";
import {
  useAllocationLimits, useAllocationTargets, useAllocationTargetPeriods, useAllocationEmissorTargets,
  useAllocationSetorTargets,
} from "./useAllocationData";
import { FUNDOS, FundoKey, fmtPct } from "./allocationUtils";
import { useResolvedRatings } from "@/lib/ratings/useResolvedRating";
import { RatingBadge } from "@/components/ratings/RatingBadge";

const EDITOR_ROLES = new Set(["Gestor", "Coordenação/Especialista"]);

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

export function TargetsPanel() {
  const { currentUser } = useAuth();
  const canEdit = currentUser ? EDITOR_ROLES.has(currentUser.funcao) : false;

  const [fundo, setFundo] = useState<FundoKey>("TOP_CP");
  const [tab, setTab] = useState("tipo");

  const { data: periods = [], isLoading: pLoading } = useAllocationTargetPeriods(fundo);
  const [periodId, setPeriodId] = useState<string | null>(null);

  // Selecionar período ativo por padrão
  useEffect(() => {
    if (periods.length === 0) { setPeriodId(null); return; }
    const ativo = periods.find(p => p.ativo);
    setPeriodId(ativo?.id ?? periods[0].id);
  }, [fundo, periods.length]);

  const currentPeriod = periods.find(p => p.id === periodId) ?? null;
  const isActivePeriod = !!currentPeriod?.ativo;
  const editable = canEdit && isActivePeriod;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={fundo} onValueChange={(v) => setFundo(v as FundoKey)}>
          <SelectTrigger className="w-[220px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FUNDOS.map(f => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={periodId ?? ""} onValueChange={setPeriodId} disabled={periods.length === 0}>
          <SelectTrigger className="w-[300px] h-9 text-sm"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            {periods.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.ativo ? "★ VIGENTE · " : ""}{p.nome} ({fmtDate(p.data_inicio)} → {p.data_fim ? fmtDate(p.data_fim) : "—"})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {currentPeriod && (
          isActivePeriod ? (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-600 text-white">Vigente</span>
          ) : (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-amber-500 text-white">Histórico (somente leitura)</span>
          )
        )}
        {canEdit && (
          <NewPeriodButton fundo={fundo} currentPeriodId={periodId} />
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="tipo">Por Tipo de Ativo</TabsTrigger>
          <TabsTrigger value="emissor">Por Emissor</TabsTrigger>
          <TabsTrigger value="setor">Por Setor</TabsTrigger>
        </TabsList>
        <TabsContent value="tipo" className="mt-3">
          {pLoading ? <Skeleton className="h-60 w-full" /> : (
            <TipoAtivoTab fundo={fundo} periodId={periodId} editable={editable} />
          )}
        </TabsContent>
        <TabsContent value="emissor" className="mt-3">
          {pLoading ? <Skeleton className="h-60 w-full" /> : (
            <EmissorTab fundo={fundo} periodId={periodId} editable={editable} />
          )}
        </TabsContent>
        <TabsContent value="setor" className="mt-3">
          {pLoading ? <Skeleton className="h-60 w-full" /> : (
            <SetorTab fundo={fundo} periodId={periodId} editable={editable} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NewPeriodButton({ fundo, currentPeriodId }: { fundo: FundoKey; currentPeriodId: string | null }) {
  const { currentUser } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function handle() {
    const nome = window.prompt("Nome do novo período (ex: Política 2026):");
    if (!nome) return;
    setBusy(true);
    try {
      // 1. Encerra o período ativo atual (data_fim = hoje, ativo = false)
      await supabase.from("allocation_target_periods" as any)
        .update({ ativo: false, data_fim: new Date().toISOString().slice(0, 10) })
        .eq("fundo", fundo).eq("ativo", true);

      // 2. Cria novo período
      const { data: created, error: cErr } = await supabase
        .from("allocation_target_periods" as any)
        .insert({ fundo, nome, data_inicio: new Date().toISOString().slice(0, 10), ativo: true, created_by: currentUser?.id })
        .select("id").single();
      if (cErr) throw cErr;
      const newId = (created as any).id;

      // 3. Copia targets do período anterior
      if (currentPeriodId) {
        const { data: prev } = await supabase.from("allocation_targets" as any)
          .select("fundo,tipo_ativo,target_pct,limite_pct").eq("period_id", currentPeriodId);
        if (prev && (prev as any[]).length) {
          const payload = (prev as any[]).map(r => ({
            fundo: r.fundo, tipo_ativo: r.tipo_ativo, target_pct: r.target_pct, limite_pct: r.limite_pct,
            period_id: newId, updated_by: currentUser?.id,
          }));
          await supabase.from("allocation_targets" as any).insert(payload);
        }
        const { data: prevE } = await supabase.from("allocation_targets_emissor" as any)
          .select("fundo,cnpj_emissor,target_pct").eq("period_id", currentPeriodId);
        if (prevE && (prevE as any[]).length) {
          const payload = (prevE as any[]).map(r => ({
            fundo: r.fundo, cnpj_emissor: r.cnpj_emissor, target_pct: r.target_pct,
            period_id: newId, updated_by: currentUser?.id,
          }));
          await supabase.from("allocation_targets_emissor" as any).insert(payload);
        }
      }
      toast({ title: "Novo período criado" });
      qc.invalidateQueries({ queryKey: ["allocation_target_periods"] });
      qc.invalidateQueries({ queryKey: ["allocation_targets"] });
      qc.invalidateQueries({ queryKey: ["allocation_targets_emissor"] });
    } catch (e: any) {
      toast({ title: "Erro ao criar período", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handle} disabled={busy} className="gap-1.5">
      <Plus className="w-3.5 h-3.5" /> Novo Período
    </Button>
  );
}

function TipoAtivoTab({ fundo, periodId, editable }: { fundo: FundoKey; periodId: string | null; editable: boolean }) {
  const { data: limits = [] } = useAllocationLimits();
  const { data: targets = [] } = useAllocationTargets(periodId);
  const { currentUser } = useAuth();
  const qc = useQueryClient();

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [limDrafts, setLimDrafts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"tipo" | "target" | "limite" | "headroom" | "status">("tipo");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const rows = useMemo(() => {
    const tipos = Array.from(new Set(limits.filter(l => l.categoria === "tipo_ativo" && l.fundo === fundo).map(l => l.subcategoria)));
    return tipos.map(t => {
      const baseLim = limits.find(l => l.fundo === fundo && l.categoria === "tipo_ativo" && l.subcategoria === t)?.limite_pct ?? null;
      const tRow = targets.find(x => x.fundo === fundo && x.tipo_ativo === t);
      const tgt = tRow?.target_pct ?? null;
      const overrideLim = tRow?.limite_pct ?? null;
      const lim = overrideLim ?? baseLim;
      return { fundo, tipo_ativo: t, baseLimite: baseLim, overrideLimite: overrideLim, limite: lim, target: tgt, key: `${fundo}::${t}` };
    });
  }, [limits, targets, fundo]);

  const toggleSort = (k: typeof sortKey) => {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "tipo" || k === "status" ? "asc" : "desc"); }
  };
  const SortIcon = ({ k }: { k: typeof sortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 inline ml-1" /> : <ArrowDown className="w-3 h-3 inline ml-1" />;
  };

  const parseNum = (s: string | undefined): number | null => {
    if (s == null || s.trim() === "") return null;
    const v = Number(s.replace(",", "."));
    return isNaN(v) ? null : v;
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? rows.filter(r => r.tipo_ativo.toLowerCase().includes(q)) : rows;
    const arr = [...list];
    arr.sort((a, b) => {
      const tgtA = parseNum(drafts[a.key]) ?? a.target;
      const tgtB = parseNum(drafts[b.key]) ?? b.target;
      const limA = parseNum(limDrafts[a.key]) ?? a.limite;
      const limB = parseNum(limDrafts[b.key]) ?? b.limite;
      const headA = limA != null && tgtA != null ? limA - tgtA : null;
      const headB = limB != null && tgtB != null ? limB - tgtB : null;
      const stA = tgtA == null || limA == null ? 0 : tgtA > limA ? 2 : 1;
      const stB = tgtB == null || limB == null ? 0 : tgtB > limB ? 2 : 1;
      let av: any, bv: any;
      switch (sortKey) {
        case "tipo": av = a.tipo_ativo; bv = b.tipo_ativo; break;
        case "target": av = tgtA ?? -Infinity; bv = tgtB ?? -Infinity; break;
        case "limite": av = limA ?? -Infinity; bv = limB ?? -Infinity; break;
        case "headroom": av = headA ?? -Infinity; bv = headB ?? -Infinity; break;
        case "status": av = stA; bv = stB; break;
      }
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? (av - bv) : (bv - av);
    });
    return arr;
  }, [rows, search, sortKey, sortDir, drafts, limDrafts]);

  useEffect(() => {
    const initial: Record<string, string> = {};
    const initLim: Record<string, string> = {};
    for (const r of rows) {
      initial[r.key] = r.target == null ? "" : String(r.target);
      initLim[r.key] = r.overrideLimite == null ? "" : String(r.overrideLimite);
    }
    setDrafts(initial);
    setLimDrafts(initLim);
  }, [rows.length, periodId]);

  async function saveRow(tipo_ativo: string, targetRaw: string, limiteRaw: string) {
    if (!editable || !periodId) return;
    const tgt = parseNum(targetRaw);
    const lim = parseNum(limiteRaw);
    for (const v of [tgt, lim]) {
      if (v != null && (isNaN(v) || v < 0 || v > 999)) {
        toast({ title: "Valor inválido", variant: "destructive" });
        throw new Error("invalid");
      }
    }
    const payload = { period_id: periodId, fundo, tipo_ativo, target_pct: tgt, limite_pct: lim, updated_by: currentUser?.id };
    const { error } = await supabase
      .from("allocation_targets" as any)
      .upsert(payload, { onConflict: "period_id,fundo,tipo_ativo" } as any);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      throw error;
    }
    qc.invalidateQueries({ queryKey: ["allocation_targets"] });
  }

  async function saveAll() {
    if (!editable || !periodId) return;
    let ok = 0, fail = 0;
    for (const r of rows) {
      try {
        await saveRow(r.tipo_ativo, drafts[r.key] ?? "", limDrafts[r.key] ?? "");
        ok++;
      } catch { fail++; }
    }
    toast({ title: fail ? `Salvo com erros (${ok} ok, ${fail} falhas)` : `${ok} linhas salvas`, variant: fail ? "destructive" : "default" });
  }

  if (!periodId) return <div className="text-sm text-muted-foreground p-4">Nenhum período disponível. Crie um novo período para começar.</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Filtrar tipo de ativo..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-8 text-sm" />
        </div>
        <span className="text-xs text-muted-foreground">{visible.length} {visible.length === 1 ? "linha" : "linhas"}</span>
        {editable && (
          <Button size="sm" onClick={saveAll} className="gap-1.5 ml-auto"><Save className="w-3.5 h-3.5" />Salvar tudo</Button>
        )}
      </div>
      <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("tipo")}>Tipo de Ativo<SortIcon k="tipo" /></TableHead>
            <TableHead className="text-right w-[140px] cursor-pointer select-none" onClick={() => toggleSort("target")}>Target<SortIcon k="target" /></TableHead>
            <TableHead className="text-right w-[160px] cursor-pointer select-none" onClick={() => toggleSort("limite")}>Limite Gerencial<SortIcon k="limite" /></TableHead>
            <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("headroom")}>Headroom vs. Target<SortIcon k="headroom" /></TableHead>
            <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort("status")}>Status<SortIcon k="status" /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map(r => {
            const rawT = drafts[r.key] ?? "";
            const rawL = limDrafts[r.key] ?? "";
            const target = parseNum(rawT);
            const limOverride = parseNum(rawL);
            const limEff = limOverride ?? r.baseLimite;
            const headroom = limEff != null && target != null ? limEff - target : null;
            const acima = target != null && limEff != null && target > limEff;
            return (
              <TableRow key={r.key}>
                <TableCell>{r.tipo_ativo}</TableCell>
                <TableCell className="text-right">
                  <Input
                    type="text"
                    value={rawT}
                    disabled={!editable}
                    className="h-8 text-right font-mono w-24 ml-auto"
                    onChange={(e) => setDrafts(d => ({ ...d, [r.key]: e.target.value }))}
                    onBlur={(e) => { saveRow(r.tipo_ativo, e.target.value, limDrafts[r.key] ?? "").catch(() => {}); }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    placeholder="—"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="text"
                    value={rawL}
                    disabled={!editable}
                    className="h-8 text-right font-mono w-24 ml-auto"
                    onChange={(e) => setLimDrafts(d => ({ ...d, [r.key]: e.target.value }))}
                    onBlur={(e) => { saveRow(r.tipo_ativo, drafts[r.key] ?? "", e.target.value).catch(() => {}); }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    placeholder={r.baseLimite == null ? "—" : String(r.baseLimite)}
                  />
                </TableCell>
                <TableCell className="text-right font-mono">{fmtPct(headroom)}</TableCell>
                <TableCell className="text-center">
                  {target == null || limEff == null ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : acima ? (
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-destructive text-destructive-foreground">Acima</span>
                  ) : (
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-600 text-white">OK</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}

function EmissorTab({ fundo, periodId, editable }: { fundo: FundoKey; periodId: string | null; editable: boolean }) {
  const { currentUser } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<"nome" | "grupo" | "rating" | "target">("nome");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const toggleSort = (k: typeof sortKey) => {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "target" ? "desc" : "asc"); }
  };
  const SortIcon = ({ k }: { k: typeof sortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 inline ml-1" /> : <ArrowDown className="w-3 h-3 inline ml-1" />;
  };

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-for-targets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("id,cnpj,nome,grupo_economico,rating").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Resolve ratings via hierarquia (ticker → emissor → grupo) para cada empresa
  const { data: resolvedRatings } = useQuery({
    queryKey: ["empresas-resolved-ratings", (empresas as any[]).length],
    queryFn: async () => {
      return await resolveRatingsBatch((empresas as any[]).map(e => ({ cnpj: e.cnpj })));
    },
    enabled: (empresas as any[]).length > 0,
    staleTime: 5 * 60 * 1000,
  });
  const getResolved = (cnpj: string) =>
    resolvedRatings?.get(ratingKey(cnpj)) ?? { rating: null, source: "nr" as const, agencia: null, data_rating: null };
  const { data: emissorTargets = [] } = useAllocationEmissorTargets(periodId, fundo);

  const targetByCnpj = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const t of emissorTargets) m.set(t.cnpj_emissor, t.target_pct);
    return m;
  }, [emissorTargets]);

  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const e of empresas as any[]) {
      const v = targetByCnpj.get(e.cnpj);
      initial[e.cnpj] = v == null ? "" : String(v);
    }
    setDrafts(initial);
  }, [empresas, emissorTargets, periodId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = !q ? (empresas as any[]) : (empresas as any[]).filter(e =>
      e.nome?.toLowerCase().includes(q) ||
      e.cnpj?.toLowerCase().includes(q) ||
      e.grupo_economico?.toLowerCase().includes(q)
    );
    const arr = [...list];
    arr.sort((a: any, b: any) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "nome": av = a.nome ?? ""; bv = b.nome ?? ""; break;
        case "grupo": av = a.grupo_economico ?? ""; bv = b.grupo_economico ?? ""; break;
        case "rating": av = getResolved(a.cnpj).rating ?? ""; bv = getResolved(b.cnpj).rating ?? ""; break;
        case "target": {
          const ra = drafts[a.cnpj]; const rb = drafts[b.cnpj];
          av = ra == null || ra.trim() === "" ? -Infinity : Number(ra.replace(",", "."));
          bv = rb == null || rb.trim() === "" ? -Infinity : Number(rb.replace(",", "."));
          break;
        }
      }
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? (av - bv) : (bv - av);
    });
    return arr;
  }, [empresas, search, sortKey, sortDir, drafts, resolvedRatings]);

  async function saveOne(cnpj: string, raw: string) {
    if (!editable || !periodId) return;
    const value = raw.trim() === "" ? null : Number(raw.replace(",", "."));
    if (value != null && (isNaN(value) || value < 0 || value > 999)) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    const { data: ex } = await supabase.from("allocation_targets_emissor" as any)
      .select("id").eq("period_id", periodId).eq("fundo", fundo).eq("cnpj_emissor", cnpj).maybeSingle();
    if ((ex as any)?.id) {
      await supabase.from("allocation_targets_emissor" as any).update({ target_pct: value, updated_by: currentUser?.id }).eq("id", (ex as any).id);
    } else {
      await supabase.from("allocation_targets_emissor" as any).insert({ period_id: periodId, fundo, cnpj_emissor: cnpj, target_pct: value, updated_by: currentUser?.id });
    }
    qc.invalidateQueries({ queryKey: ["allocation_targets_emissor"] });
  }

  if (!periodId) return <div className="text-sm text-muted-foreground p-4">Nenhum período disponível.</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar emissor / CNPJ / grupo..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-8 text-sm" />
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} emissores</span>
      </div>
      <div className="border rounded-lg overflow-x-auto max-h-[60vh] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("nome")}>Emissor<SortIcon k="nome" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("grupo")}>Grupo<SortIcon k="grupo" /></TableHead>
              <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort("rating")}>Rating<SortIcon k="rating" /></TableHead>
              <TableHead className="text-right w-[140px] cursor-pointer select-none" onClick={() => toggleSort("target")}>Target %<SortIcon k="target" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((e: any) => {
              const raw = drafts[e.cnpj] ?? "";
              return (
                <TableRow key={e.cnpj}>
                  <TableCell className="font-medium">{e.nome}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.grupo_economico ?? "—"}</TableCell>
                  <TableCell className="text-center font-mono text-xs">{e.rating ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="text"
                      value={raw}
                      disabled={!editable}
                      className="h-8 text-right font-mono w-24 ml-auto"
                      onChange={(ev) => setDrafts(d => ({ ...d, [e.cnpj]: ev.target.value }))}
                      onBlur={(ev) => saveOne(e.cnpj, ev.target.value)}
                      onKeyDown={(ev) => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); }}
                      placeholder="—"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-6">Nenhum emissor.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const DEFAULT_SETOR_LIMIT = 20;

function SetorTab({ fundo, periodId, editable }: { fundo: FundoKey; periodId: string | null; editable: boolean }) {
  const { currentUser } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [targetDrafts, setTargetDrafts] = useState<Record<string, string>>({});
  const [limDrafts, setLimDrafts] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<"setor" | "target" | "limite">("setor");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const toggleSort = (k: typeof sortKey) => {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "setor" ? "asc" : "desc"); }
  };
  const SortIcon = ({ k }: { k: typeof sortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 inline ml-1" /> : <ArrowDown className="w-3 h-3 inline ml-1" />;
  };

  const { data: setores = [] } = useQuery({
    queryKey: ["empresas-setores-distinct"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("setor").not("setor", "is", null);
      if (error) throw error;
      const set = new Set<string>();
      for (const r of (data ?? []) as any[]) if (r.setor) set.add(r.setor.trim());
      set.add("FIDC"); set.add("Título Público"); set.add("Sem Setor");
      return Array.from(set).sort();
    },
  });
  const { data: setorTargets = [] } = useAllocationSetorTargets(periodId, fundo);

  const mapByKey = useMemo(() => {
    const m = new Map<string, { target: number | null; limite: number | null }>();
    for (const t of setorTargets) m.set(t.setor, { target: t.target_pct, limite: t.limite_pct });
    return m;
  }, [setorTargets]);

  useEffect(() => {
    const t: Record<string, string> = {};
    const l: Record<string, string> = {};
    for (const s of setores) {
      const v = mapByKey.get(s);
      t[s] = v?.target == null ? "" : String(v.target);
      l[s] = v?.limite == null ? "" : String(v.limite);
    }
    setTargetDrafts(t);
    setLimDrafts(l);
  }, [setores, setorTargets, periodId]);

  const parseNum = (s: string | undefined): number | null => {
    if (s == null || s.trim() === "") return null;
    const v = Number(s.replace(",", "."));
    return isNaN(v) ? null : v;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? setores.filter(s => s.toLowerCase().includes(q)) : setores;
    const arr = [...list];
    arr.sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "setor": av = a; bv = b; break;
        case "target": av = parseNum(targetDrafts[a]) ?? -Infinity; bv = parseNum(targetDrafts[b]) ?? -Infinity; break;
        case "limite": av = parseNum(limDrafts[a]) ?? -Infinity; bv = parseNum(limDrafts[b]) ?? -Infinity; break;
      }
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? (av - bv) : (bv - av);
    });
    return arr;
  }, [setores, search, sortKey, sortDir, targetDrafts, limDrafts]);

  async function saveOne(setor: string, tRaw: string, lRaw: string) {
    if (!editable || !periodId) return;
    const t = parseNum(tRaw);
    const l = parseNum(lRaw);
    for (const v of [t, l]) {
      if (v != null && (isNaN(v) || v < 0 || v > 999)) {
        toast({ title: "Valor inválido", variant: "destructive" });
        throw new Error("invalid");
      }
    }
    const payload = { period_id: periodId, fundo, setor, target_pct: t, limite_pct: l, updated_by: currentUser?.id };
    const { error } = await supabase
      .from("allocation_targets_setor" as any)
      .upsert(payload, { onConflict: "period_id,fundo,setor" } as any);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      throw error;
    }
    qc.invalidateQueries({ queryKey: ["allocation_targets_setor"] });
  }

  if (!periodId) return <div className="text-sm text-muted-foreground p-4">Nenhum período disponível.</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Filtrar setor..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-8 text-sm" />
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} setores · padrão {DEFAULT_SETOR_LIMIT}%</span>
      </div>
      <div className="border rounded-lg overflow-x-auto max-h-[60vh] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("setor")}>Setor<SortIcon k="setor" /></TableHead>
              <TableHead className="text-right w-[140px] cursor-pointer select-none" onClick={() => toggleSort("target")}>Target %<SortIcon k="target" /></TableHead>
              <TableHead className="text-right w-[160px] cursor-pointer select-none" onClick={() => toggleSort("limite")}>Limite %<SortIcon k="limite" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(s => (
              <TableRow key={s}>
                <TableCell className="font-medium">{s}</TableCell>
                <TableCell className="text-right">
                  <Input
                    type="text"
                    value={targetDrafts[s] ?? ""}
                    disabled={!editable}
                    className="h-8 text-right font-mono w-24 ml-auto"
                    onChange={(ev) => setTargetDrafts(d => ({ ...d, [s]: ev.target.value }))}
                    onBlur={(ev) => { saveOne(s, ev.target.value, limDrafts[s] ?? "").catch(() => {}); }}
                    onKeyDown={(ev) => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); }}
                    placeholder="—"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="text"
                    value={limDrafts[s] ?? ""}
                    disabled={!editable}
                    className="h-8 text-right font-mono w-24 ml-auto"
                    onChange={(ev) => setLimDrafts(d => ({ ...d, [s]: ev.target.value }))}
                    onBlur={(ev) => { saveOne(s, targetDrafts[s] ?? "", ev.target.value).catch(() => {}); }}
                    onKeyDown={(ev) => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); }}
                    placeholder={String(DEFAULT_SETOR_LIMIT)}
                  />
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground text-sm py-6">Nenhum setor.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
