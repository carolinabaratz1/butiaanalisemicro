// Fase B — Subordinação: cards Sênior/Mezanino, Estrutura de Capital, Validação PL × Cotas
// e modal "Editar limites de subordinação".
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BRL, PCT } from "@/lib/fidc/format";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, AlertTriangle, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type R = Record<string, unknown> | null;
const num = (r: R, k: string) => (r && r[k] != null ? Number(r[k]) : null);
const str = (r: R, k: string) => (r && r[k] != null ? String(r[k]) : null);

type StatusKind =
  | "adequate" | "near_limit" | "below_limit" | "missing_limit"
  | "inconsistent_quota_validation" | "not_applicable" | "not_calculable" | string;

const STATUS_LABEL: Record<string, { label: string; cls: string; tip: string }> = {
  adequate: {
    label: "Adequado",
    cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    tip: "Subordinação acima do limite mínimo cadastrado.",
  },
  near_limit: {
    label: "Próximo do limite",
    cls: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    tip: "Folga ≤ 1 p.p. em relação ao limite mínimo.",
  },
  below_limit: {
    label: "Abaixo do limite",
    cls: "bg-red-500/15 text-red-600 border-red-500/30",
    tip: "Subordinação abaixo do limite mínimo regulatório cadastrado.",
  },
  missing_limit: {
    label: "Sem limite cadastrado",
    cls: "bg-muted text-muted-foreground border-border",
    tip: "Cadastre o limite mínimo no regulamento para avaliar adequação.",
  },
  inconsistent_quota_validation: {
    label: "Inconsistente",
    cls: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    tip: "Soma das cotas difere do PL informado — subordinação não confiável.",
  },
  not_applicable: {
    label: "Não aplicável",
    cls: "bg-muted text-muted-foreground border-border",
    tip: "Estrutura de classes não possui esta senioridade.",
  },
  not_calculable: {
    label: "N/D",
    cls: "bg-muted text-muted-foreground border-border",
    tip: "Dados insuficientes para o cálculo neste mês.",
  },
};

function StatusBadge({ status }: { status: string | null }) {
  const v = STATUS_LABEL[status ?? "not_calculable"] ?? STATUS_LABEL.not_calculable;
  return (
    <span
      title={v.tip}
      className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] font-medium ${v.cls}`}
    >
      {v.label}
    </span>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="border border-border px-2.5 py-2 min-w-0">
      <div className="text-[10.5px] text-muted-foreground truncate" title={label}>{label}</div>
      <div className="text-[14px] font-semibold num mt-0.5 truncate">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

const ND = <span className="text-muted-foreground font-normal">N/D</span>;
const INC = (
  <span className="text-amber-600 text-[13px] font-medium" title="PL informado ≠ soma das cotas">
    Inconsistente
  </span>
);

export function SubordinationPanel({
  fidcId, latestReport,
}: {
  fidcId: string;
  latestReport: R;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const refMonth = latestReport?.reference_month ? String(latestReport.reference_month).slice(0, 10) : null;
  const cnpj = str(latestReport, "cnpj_fundo_classe");
  const pl = num(latestReport, "nav_value");
  const quotaSum = num(latestReport, "quota_total_nav_value");
  const diff = num(latestReport, "quota_validation_difference");
  const diffPct = num(latestReport, "quota_validation_difference_percentage");
  const validation = str(latestReport, "quota_validation_status");

  const seniorNav = num(latestReport, "senior_nav_value");
  const mezzNav = num(latestReport, "mezzanine_nav_value");
  const subNav = num(latestReport, "subordinated_nav_value");
  const uniqueNav = num(latestReport, "unique_nav_value");
  const unknownNav = num(latestReport, "unknown_quota_nav_value");
  const seniorPct = num(latestReport, "senior_nav_pct");
  const mezzPct = num(latestReport, "mezzanine_nav_pct");
  const subPct = num(latestReport, "subordinated_nav_pct");

  const sRatio = num(latestReport, "senior_subordination_ratio");
  const sLimit = num(latestReport, "senior_subordination_limit");
  const sExcess = num(latestReport, "senior_subordination_excess");
  const sStatus = str(latestReport, "senior_subordination_status");

  const mRatio = num(latestReport, "mezzanine_subordination_ratio");
  const mLimit = num(latestReport, "mezzanine_subordination_limit");
  const mExcess = num(latestReport, "mezzanine_subordination_excess");
  const mStatus = str(latestReport, "mezzanine_subordination_status") ?? (mezzNav == null || mezzNav === 0 ? "not_applicable" : null);

  const qualityFlag = str(latestReport, "senior_subordination_status_quality");
  const calcStatus = str(latestReport, "subordinated_calculation_status");

  const inconsistent = sStatus === "inconsistent_quota_validation" || mStatus === "inconsistent_quota_validation"
    || calcStatus === "inconsistent" || validation === "invalid" || validation === "cotas_ausentes";

  const validationBadge = useMemo(() => {
    const map: Record<string, { label: string; cls: string }> = {
      valid: { label: "OK", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
      warning: { label: "Alerta", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
      invalid: { label: "Crítico", cls: "bg-red-500/15 text-red-600 border-red-500/30" },
      cotas_ausentes: { label: "Cotas ausentes", cls: "bg-red-500/15 text-red-600 border-red-500/30" },
    };
    const v = map[validation ?? ""] ?? { label: validation ?? "—", cls: "bg-muted text-muted-foreground border-border" };
    return <span className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-[11px] font-medium ${v.cls}`}>{v.label}</span>;
  }, [validation]);

  const limitsQ = useQuery({
    queryKey: ["fidc-sub-limits", fidcId, cnpj],
    queryFn: async () => {
      let q = supabase
        .from("fidc_subordination_limits")
        .select("*")
        .order("effective_from", { ascending: false });
      q = q.eq("fidc_id", fidcId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Array<Record<string, unknown>>;
    },
  });

  const capitalRows: Array<{ label: string; nav: number | null; pct: number | null; key: string }> = [
    { label: "Sênior", nav: seniorNav, pct: seniorPct, key: "senior" },
    { label: "Mezanino", nav: mezzNav, pct: mezzPct, key: "mezz" },
    { label: "Subordinada", nav: subNav, pct: subPct, key: "sub" },
    { label: "Única", nav: uniqueNav, pct: pl && uniqueNav != null ? uniqueNav / pl : null, key: "uniq" },
    { label: "Não classificada", nav: unknownNav, pct: pl && unknownNav != null ? unknownNav / pl : null, key: "unk" },
  ].filter((r) => (r.nav ?? 0) > 0);

  if (!latestReport) {
    return (
      <div className="bg-card border border-border" data-print-section>
        <div className="section-title px-4 pt-3">Subordinação & Estrutura de Capital</div>
        <div className="px-4 py-6 text-center text-[12px] text-muted-foreground">
          Sem informe mensal importado — não há dados de subordinação.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border" data-print-section>
      <div className="px-4 pt-3 flex items-center justify-between gap-3">
        <div>
          <div className="section-title">Subordinação & Estrutura de Capital</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Subordinação calculada com PL oficial (TAB IV) sobre as cotas/classes (TAB X_2).
          </div>
        </div>
        <Button size="sm" variant="outline" className="h-8 text-[11.5px]" data-print="hide" onClick={() => setOpen(true)}>
          <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar limites
        </Button>
      </div>

      {inconsistent && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-sm border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-700">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Validação PL × Cotas inconsistente</div>
            <div>Soma das cotas difere do PL oficial em mais de 0,2%. Os ratios de subordinação estão marcados como inconsistentes.</div>
          </div>
        </div>
      )}
      {qualityFlag === "contains_unknown_quota_type" && (
        <div className="mx-4 mt-2 flex items-start gap-2 rounded-sm border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11.5px] text-amber-700">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <div>Há classes sem tipo identificável (não classificada). A classificação senior/mezanino/subordinada pode estar incompleta.</div>
        </div>
      )}

      {/* CARDS PRINCIPAIS */}
      <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Sênior */}
        <div className="border border-border p-3">
          <div className="flex items-center justify-between">
            <div className="text-[12px] font-medium">Subordinação Sênior</div>
            <StatusBadge status={sStatus} />
          </div>
          <div className="mt-2 text-[22px] font-semibold num">
            {inconsistent ? INC : sRatio != null ? PCT(sRatio, 2) : ND}
          </div>
          <div className="mt-1 text-[10.5px] text-muted-foreground">
            (PL − PL Sênior) / PL
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            <div>
              <div className="text-muted-foreground">PL Sênior</div>
              <div className="num font-medium">{seniorNav != null ? BRL(seniorNav, { compact: true }) : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Limite mín.</div>
              <div className="num font-medium">{sLimit != null ? PCT(sLimit, 2) : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Folga</div>
              <div className={`num font-medium ${sExcess != null && sExcess < 0 ? "text-red-600" : sExcess != null && sExcess < 0.01 ? "text-amber-600" : ""}`}>
                {sExcess != null ? `${(sExcess * 100).toFixed(2).replace(".", ",")} p.p.` : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Mezanino */}
        <div className="border border-border p-3">
          <div className="flex items-center justify-between">
            <div className="text-[12px] font-medium">Subordinação Mezanino</div>
            <StatusBadge status={mStatus} />
          </div>
          <div className="mt-2 text-[22px] font-semibold num">
            {mStatus === "not_applicable" ? <span className="text-muted-foreground text-[14px] font-normal">Não aplicável</span>
              : inconsistent ? INC
              : mRatio != null ? PCT(mRatio, 2) : ND}
          </div>
          <div className="mt-1 text-[10.5px] text-muted-foreground">
            PL Subordinada / PL (proteção da mezanino)
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            <div>
              <div className="text-muted-foreground">PL Mezanino</div>
              <div className="num font-medium">{mezzNav != null ? BRL(mezzNav, { compact: true }) : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Limite mín.</div>
              <div className="num font-medium">{mLimit != null ? PCT(mLimit, 2) : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Folga</div>
              <div className={`num font-medium ${mExcess != null && mExcess < 0 ? "text-red-600" : mExcess != null && mExcess < 0.01 ? "text-amber-600" : ""}`}>
                {mExcess != null ? `${(mExcess * 100).toFixed(2).replace(".", ",")} p.p.` : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Validação PL × Cotas */}
        <div className="border border-border p-3">
          <div className="flex items-center justify-between">
            <div className="text-[12px] font-medium">Validação PL × Cotas</div>
            {validationBadge}
          </div>
          <div className="mt-2 text-[22px] font-semibold num">
            {diffPct != null ? `${diffPct.toFixed(3).replace(".", ",")}%` : ND}
          </div>
          <div className="mt-1 text-[10.5px] text-muted-foreground">
            Diferença relativa (|PL − ΣCotas| / PL)
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            <div>
              <div className="text-muted-foreground">PL oficial</div>
              <div className="num font-medium">{pl != null ? BRL(pl, { compact: true }) : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Soma cotas</div>
              <div className="num font-medium">{quotaSum != null ? BRL(quotaSum, { compact: true }) : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Diferença</div>
              <div className="num font-medium">{diff != null ? BRL(diff, { compact: true }) : "—"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ESTRUTURA DE CAPITAL */}
      <div className="px-4 pb-4">
        <div className="section-title pt-1 pb-2">Estrutura de Capital — mês de referência</div>
        <div className="overflow-x-auto border border-border">
          <table className="w-full text-[12px]">
            <thead className="bg-surface-2 text-muted-foreground">
              <tr className="hairline-b">
                <th className="text-left px-2 py-1.5 font-medium">Senioridade</th>
                <th className="text-right px-2 py-1.5 font-medium">PL da classe</th>
                <th className="text-right px-2 py-1.5 font-medium">% do PL</th>
                <th className="text-left px-2 py-1.5 font-medium w-[40%]">Distribuição</th>
              </tr>
            </thead>
            <tbody>
              {capitalRows.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground text-[11.5px]">
                  Sem cotas com PL positivo para o mês.
                </td></tr>
              )}
              {capitalRows.map((r) => {
                const pct = r.pct ?? 0;
                const barColor = r.key === "senior" ? "bg-sky-500"
                  : r.key === "mezz" ? "bg-amber-500"
                  : r.key === "sub" ? "bg-emerald-500"
                  : r.key === "uniq" ? "bg-slate-400"
                  : "bg-red-400";
                return (
                  <tr key={r.key} className="hairline-b">
                    <td className="px-2 py-1.5 font-medium">{r.label}</td>
                    <td className="px-2 py-1.5 text-right num">{r.nav != null ? BRL(r.nav, { compact: true }) : "—"}</td>
                    <td className="px-2 py-1.5 text-right num">{r.pct != null ? PCT(r.pct, 2) : "—"}</td>
                    <td className="px-2 py-1.5">
                      <div className="h-2 w-full bg-muted/40 rounded-sm overflow-hidden">
                        <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
          <Stat
            label="Status do cálculo"
            value={calcStatus === "ok" ? "Confiável" : calcStatus === "inconsistent" ? <span className="text-amber-600">Inconsistente</span> : calcStatus === "missing" || calcStatus === "quota_data_missing" ? "N/D" : (calcStatus ?? "—")}
          />
          <Stat label="Classes encontradas" value={String(Number(latestReport.quota_classes_found_count ?? capitalRows.length))} />
          <Stat label="Não classificada" value={unknownNav != null && unknownNav > 0 ? BRL(unknownNav, { compact: true }) : "—"} />
          <Stat label="Mês de referência" value={refMonth ? new Date(refMonth + "T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : "—"} />
        </div>
      </div>

      <LimitsDialog
        open={open}
        onOpenChange={setOpen}
        fidcId={fidcId}
        cnpj={cnpj}
        limits={limitsQ.data ?? []}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["fidc-sub-limits", fidcId] }); }}
      />
    </div>
  );
}

function LimitsDialog({
  open, onOpenChange, fidcId, cnpj, limits, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fidcId: string;
  cnpj: string | null;
  limits: Array<Record<string, unknown>>;
  onSaved: () => void;
}) {
  const [seniorPct, setSeniorPct] = useState("");
  const [mezzPct, setMezzPct] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const s = seniorPct.trim() ? Number(seniorPct.replace(",", ".")) / 100 : null;
    const m = mezzPct.trim() ? Number(mezzPct.replace(",", ".")) / 100 : null;
    if (s == null && m == null) {
      toast({ title: "Informe pelo menos um limite", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("fidc_subordination_limits").insert({
        fidc_id: fidcId,
        cnpj_fundo_classe: cnpj,
        senior_min_subordination_pct: s,
        mezzanine_min_subordination_pct: m,
        effective_from: effectiveFrom,
        source: "manual",
        regulation_reference: reference || null,
        notes: notes || null,
        created_by: u?.user?.id ?? null,
      });
      if (error) throw error;
      toast({ title: "Limite cadastrado", description: "Reimporte o informe mensal para reavaliar a adequação." });
      setSeniorPct(""); setMezzPct(""); setReference(""); setNotes("");
      onSaved();
      onOpenChange(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Falha ao salvar", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Limites de subordinação — regulamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border border-border">
            <div className="bg-surface-2 px-3 py-2 text-[11px] text-muted-foreground">Histórico de limites cadastrados</div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="text-muted-foreground">
                  <tr className="hairline-b">
                    <th className="text-left px-2 py-1.5 font-medium">Vigência</th>
                    <th className="text-right px-2 py-1.5 font-medium">Sênior mín.</th>
                    <th className="text-right px-2 py-1.5 font-medium">Mezanino mín.</th>
                    <th className="text-left px-2 py-1.5 font-medium">Referência</th>
                  </tr>
                </thead>
                <tbody>
                  {limits.length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground text-[11.5px]">
                      Nenhum limite cadastrado ainda.
                    </td></tr>
                  )}
                  {limits.map((l) => (
                    <tr key={String(l.id)} className="hairline-b">
                      <td className="px-2 py-1.5 num">
                        {String(l.effective_from ?? "—")}{l.effective_to ? ` → ${String(l.effective_to)}` : ""}
                      </td>
                      <td className="px-2 py-1.5 text-right num">
                        {l.senior_min_subordination_pct != null ? PCT(Number(l.senior_min_subordination_pct), 2) : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right num">
                        {l.mezzanine_min_subordination_pct != null ? PCT(Number(l.mezzanine_min_subordination_pct), 2) : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground text-[11px]">{String(l.regulation_reference ?? "—")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[11px]">Sênior mín. (%)</Label>
              <Input placeholder="ex.: 20,00" value={seniorPct} onChange={(e) => setSeniorPct(e.target.value)} />
            </div>
            <div>
              <Label className="text-[11px]">Mezanino mín. (%)</Label>
              <Input placeholder="ex.: 10,00" value={mezzPct} onChange={(e) => setMezzPct(e.target.value)} />
            </div>
            <div>
              <Label className="text-[11px]">Vigência a partir de</Label>
              <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-[11px]">Referência (regulamento, item)</Label>
              <Input placeholder="ex.: Regulamento, art. 5º" value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label className="text-[11px]">Observações</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Os valores são percentuais decimais (ex.: 20 = 20% = 0,20). Após salvar, reimporte o informe mensal para recalcular a adequação.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando…" : "Salvar limite"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
