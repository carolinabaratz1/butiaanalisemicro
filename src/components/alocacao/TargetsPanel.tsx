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
import { Save, Plus, Search } from "lucide-react";
import {
  useAllocationLimits, useAllocationTargets, useAllocationTargetPeriods, useAllocationEmissorTargets,
} from "./useAllocationData";
import { FUNDOS, FundoKey, fmtPct } from "./allocationUtils";

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
          <SelectTrigger className="w-[280px] h-9 text-sm"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            {periods.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome} ({fmtDate(p.data_inicio)} → {p.data_fim ? fmtDate(p.data_fim) : "vigente"}){p.ativo ? " ★" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canEdit && (
          <NewPeriodButton fundo={fundo} currentPeriodId={periodId} />
        )}
        {!isActivePeriod && currentPeriod && (
          <span className="text-xs text-amber-600 font-medium">Período histórico (somente leitura)</span>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="tipo">Por Tipo de Ativo</TabsTrigger>
          <TabsTrigger value="emissor">Por Emissor</TabsTrigger>
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
          .select("fundo,tipo_ativo,target_pct").eq("period_id", currentPeriodId);
        if (prev && (prev as any[]).length) {
          const payload = (prev as any[]).map(r => ({
            fundo: r.fundo, tipo_ativo: r.tipo_ativo, target_pct: r.target_pct,
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

  const rows = useMemo(() => {
    const tipos = Array.from(new Set(limits.filter(l => l.categoria === "tipo_ativo" && l.fundo === fundo).map(l => l.subcategoria)));
    return tipos.map(t => {
      const lim = limits.find(l => l.fundo === fundo && l.categoria === "tipo_ativo" && l.subcategoria === t)?.limite_pct ?? null;
      const tgt = targets.find(x => x.fundo === fundo && x.tipo_ativo === t)?.target_pct ?? null;
      return { fundo, tipo_ativo: t, limite: lim, target: tgt, key: `${fundo}::${t}` };
    });
  }, [limits, targets, fundo]);

  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const r of rows) initial[r.key] = r.target == null ? "" : String(r.target);
    setDrafts(initial);
  }, [rows.length, periodId]);

  async function saveOne(tipo_ativo: string, raw: string) {
    if (!editable || !periodId) return;
    const value = raw.trim() === "" ? null : Number(raw.replace(",", "."));
    if (value != null && (isNaN(value) || value < 0 || value > 999)) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("allocation_targets" as any)
      .upsert(
        { period_id: periodId, fundo, tipo_ativo, target_pct: value, updated_by: currentUser?.id },
        { onConflict: "period_id,fundo,tipo_ativo" } as any
      );
    if (error) {
      // fallback: manual upsert
      const { data: ex } = await supabase.from("allocation_targets" as any)
        .select("id").eq("period_id", periodId).eq("fundo", fundo).eq("tipo_ativo", tipo_ativo).maybeSingle();
      if ((ex as any)?.id) {
        await supabase.from("allocation_targets" as any).update({ target_pct: value, updated_by: currentUser?.id }).eq("id", (ex as any).id);
      } else {
        await supabase.from("allocation_targets" as any).insert({ period_id: periodId, fundo, tipo_ativo, target_pct: value, updated_by: currentUser?.id });
      }
    }
    qc.invalidateQueries({ queryKey: ["allocation_targets"] });
  }

  if (!periodId) return <div className="text-sm text-muted-foreground p-4">Nenhum período disponível. Crie um novo período para começar.</div>;

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo de Ativo</TableHead>
            <TableHead className="text-right w-[140px]">Target</TableHead>
            <TableHead className="text-right">Limite Gerencial</TableHead>
            <TableHead className="text-right">Headroom vs. Target</TableHead>
            <TableHead className="text-center">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(r => {
            const raw = drafts[r.key] ?? "";
            const target = raw.trim() === "" ? null : Number(raw.replace(",", "."));
            const headroom = r.limite != null && target != null ? r.limite - target : null;
            const acima = target != null && r.limite != null && target > r.limite;
            return (
              <TableRow key={r.key}>
                <TableCell>{r.tipo_ativo}</TableCell>
                <TableCell className="text-right">
                  <Input
                    type="text"
                    value={raw}
                    disabled={!editable}
                    className="h-8 text-right font-mono w-24 ml-auto"
                    onChange={(e) => setDrafts(d => ({ ...d, [r.key]: e.target.value }))}
                    onBlur={(e) => saveOne(r.tipo_ativo, e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    placeholder="—"
                  />
                </TableCell>
                <TableCell className="text-right font-mono">{fmtPct(r.limite)}</TableCell>
                <TableCell className="text-right font-mono">{fmtPct(headroom)}</TableCell>
                <TableCell className="text-center">
                  {target == null || r.limite == null ? (
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
  );
}

function EmissorTab({ fundo, periodId, editable }: { fundo: FundoKey; periodId: string | null; editable: boolean }) {
  const { currentUser } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-for-targets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("id,cnpj,nome,grupo_economico,rating").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
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
    if (!q) return empresas as any[];
    return (empresas as any[]).filter(e =>
      e.nome?.toLowerCase().includes(q) ||
      e.cnpj?.toLowerCase().includes(q) ||
      e.grupo_economico?.toLowerCase().includes(q)
    );
  }, [empresas, search]);

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
              <TableHead>Emissor</TableHead>
              <TableHead>Grupo</TableHead>
              <TableHead className="text-center">Rating</TableHead>
              <TableHead className="text-right w-[140px]">Target %</TableHead>
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
