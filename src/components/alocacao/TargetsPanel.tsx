import { useEffect, useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Save } from "lucide-react";
import { useAllocationLimits, useAllocationTargets } from "./useAllocationData";
import { FUNDOS, fmtPct } from "./allocationUtils";

const EDITOR_ROLES = new Set(["Gestor", "Coordenação/Especialista"]);

export function TargetsPanel() {
  const { data: limits = [], isLoading: lLoading } = useAllocationLimits();
  const { data: targets = [], isLoading: tLoading } = useAllocationTargets();
  const { currentUser } = useAuth();
  const qc = useQueryClient();
  const canEdit = currentUser ? EDITOR_ROLES.has(currentUser.funcao) : false;

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Build rows: for each fundo × tipo_ativo
  const rows = useMemo(() => {
    const tipos = Array.from(new Set(limits.filter(l => l.categoria === "tipo_ativo").map(l => l.subcategoria)));
    const out: { fundo: string; tipo_ativo: string; limite: number | null; target: number | null; key: string }[] = [];
    for (const f of FUNDOS) {
      for (const t of tipos) {
        const lim = limits.find(l => l.fundo === f.key && l.categoria === "tipo_ativo" && l.subcategoria === t)?.limite_pct ?? null;
        const tgt = targets.find(x => x.fundo === f.key && x.tipo_ativo === t)?.target_pct ?? null;
        out.push({ fundo: f.key, tipo_ativo: t, limite: lim, target: tgt, key: `${f.key}::${t}` });
      }
    }
    return out;
  }, [limits, targets]);

  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const r of rows) initial[r.key] = r.target == null ? "" : String(r.target);
    setDrafts(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]);

  async function saveOne(fundo: string, tipo_ativo: string, raw: string) {
    if (!canEdit) return;
    const value = raw.trim() === "" ? null : Number(raw.replace(",", "."));
    if (value != null && (isNaN(value) || value < 0 || value > 999)) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("allocation_targets" as any)
      .upsert({ fundo, tipo_ativo, target_pct: value, updated_by: currentUser?.id }, { onConflict: "fundo,tipo_ativo" });
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      qc.invalidateQueries({ queryKey: ["allocation_targets"] });
    }
  }

  async function saveAll() {
    if (!canEdit) return;
    setSaving(true);
    try {
      const payload = rows.map(r => {
        const raw = drafts[r.key] ?? "";
        const value = raw.trim() === "" ? null : Number(raw.replace(",", "."));
        return { fundo: r.fundo, tipo_ativo: r.tipo_ativo, target_pct: value, updated_by: currentUser?.id };
      });
      const { error } = await supabase
        .from("allocation_targets" as any)
        .upsert(payload, { onConflict: "fundo,tipo_ativo" });
      if (error) throw error;
      toast({ title: "Targets salvos" });
      qc.invalidateQueries({ queryKey: ["allocation_targets"] });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (lLoading || tLoading) return <Skeleton className="h-60 w-full" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {canEdit ? "Edite os valores de Target inline. Tab/Enter ou perda de foco salva automaticamente." : "Você está em modo somente leitura."}
        </p>
        {canEdit && (
          <Button size="sm" onClick={saveAll} disabled={saving} className="gap-1.5">
            <Save className="w-3.5 h-3.5" /> Salvar Todos
          </Button>
        )}
      </div>
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fundo</TableHead>
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
                  <TableCell className="font-mono text-xs">{r.fundo}</TableCell>
                  <TableCell>{r.tipo_ativo}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="text"
                      value={raw}
                      disabled={!canEdit}
                      className="h-8 text-right font-mono w-24 ml-auto"
                      onChange={(e) => setDrafts(d => ({ ...d, [r.key]: e.target.value }))}
                      onBlur={(e) => saveOne(r.fundo, r.tipo_ativo, e.target.value)}
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
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-destructive text-destructive-foreground">Acima do Limite</span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-600 text-white">Dentro do Limite</span>
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
