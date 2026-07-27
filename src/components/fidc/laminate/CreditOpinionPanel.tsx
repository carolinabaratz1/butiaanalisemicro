// Parecer de Crédito vinculado ao FIDC + mês de referência mais recente.
// Carrega/edita credit_opinions. Botão "Usar dados do informe" preenche o resumo por template.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BRL, PCT, monthLabel } from "@/lib/fidc/format";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Edit3, FileText, Lock } from "lucide-react";

type RecEnum = "manter" | "acompanhar" | "reduzir" | "zerar";
const REC_LABEL: Record<RecEnum, string> = {
  manter: "Manter", acompanhar: "Acompanhar", reduzir: "Reduzir", zerar: "Zerar",
};
const REC_COLOR: Record<RecEnum, string> = {
  manter: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  acompanhar: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  reduzir: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  zerar: "bg-red-500/15 text-red-700 border-red-500/30",
};

type Opinion = {
  id: string;
  fidc_id: string;
  reference_month: string;
  recommendation: RecEnum;
  summary: string | null;
  recommendation_reason: string | null;
  positive_points: string | null;
  attention_points: string | null;
  main_risks: string | null;
  recent_evolution: string | null;
  author_id: string | null;
  updated_at: string;
};

export function CreditOpinionPanel({
  fidcId, fidcName, latestReport,
}: {
  fidcId: string;
  fidcName: string;
  latestReport: Record<string, unknown> | null;
}) {
  const qc = useQueryClient();
  const { currentUser, permissions } = useAuth();
  const canWrite = permissions.canWrite;
  const refMonth = latestReport?.reference_month ? String(latestReport.reference_month).slice(0, 10) : null;

  const { data: opinion, isLoading } = useQuery({
    queryKey: ["credit-opinion-laminate", fidcId, refMonth],
    queryFn: async () => {
      if (!refMonth) return null;
      const { data, error } = await supabase
        .from("credit_opinions")
        .select("*")
        .eq("fidc_id", fidcId)
        .eq("reference_month", refMonth)
        .maybeSingle();
      if (error) throw error;
      return (data as Opinion | null);
    },
    enabled: !!refMonth,
  });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    recommendation: "manter" as RecEnum,
    summary: "", recommendation_reason: "",
    positive_points: "", attention_points: "",
    main_risks: "", recent_evolution: "",
  });

  useEffect(() => {
    if (opinion) {
      setForm({
        recommendation: (opinion.recommendation ?? "manter") as RecEnum,
        summary: opinion.summary ?? "",
        recommendation_reason: opinion.recommendation_reason ?? "",
        positive_points: opinion.positive_points ?? "",
        attention_points: opinion.attention_points ?? "",
        main_risks: opinion.main_risks ?? "",
        recent_evolution: opinion.recent_evolution ?? "",
      });
    }
  }, [opinion?.id]);

  function buildTemplate(): string {
    if (!latestReport) return "";
    const r = latestReport;
    const nav = Number(r.nav_value ?? 0);
    const dc = Number(r.credit_rights_value ?? 0);
    const overdue = Number(r.overdue_value ?? 0);
    const pdd = Math.abs(Number(r.pdd_value ?? 0));
    const cash = Number(r.cash_value ?? 0);
    const mon = monthLabel(String(r.reference_month).slice(0, 10));
    return (
      `No mês de ${mon}, o FIDC ${fidcName} apresentou PL de ${BRL(nav, { compact: true })}, ` +
      `direitos creditórios de ${BRL(dc, { compact: true })}, ` +
      `Atraso/DC de ${dc > 0 ? PCT(overdue / dc) : "N/D"}, ` +
      `PDD/DC de ${dc > 0 ? PCT(pdd / dc) : "N/D"}, ` +
      `Caixa/PL de ${nav > 0 ? PCT(cash / nav) : "N/D"} e ` +
      `status do informe ${String(r.quota_validation_status ?? "—")}.`
    );
  }

  async function save() {
    if (!canWrite) return; // defesa extra no client; RLS (fidc_can_write_opinion) já protege no banco
    if (!refMonth) return;
    const payload = {
      fidc_id: fidcId,
      reference_month: refMonth,
      recommendation: form.recommendation,
      summary: form.summary || null,
      recommendation_reason: form.recommendation_reason || null,
      positive_points: form.positive_points || null,
      attention_points: form.attention_points || null,
      main_risks: form.main_risks || null,
      recent_evolution: form.recent_evolution || null,
      author_id: currentUser?.id ?? null,
    };
    const { error } = await supabase
      .from("credit_opinions")
      .upsert(payload, { onConflict: "fidc_id,reference_month" });
    if (error) { toast.error("Falha ao salvar parecer"); return; }
    toast.success("Parecer salvo");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["credit-opinion-laminate", fidcId, refMonth] });
    qc.invalidateQueries({ queryKey: ["credit_opinions", "all"] });
  }

  if (!refMonth) {
    return (
      <div className="bg-card border border-border p-4 text-[12px] text-muted-foreground" data-print-section>
        Parecer aparece após a importação do primeiro informe mensal.
      </div>
    );
  }

  return (
    <div className="bg-card border border-border" data-print-section>
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div>
          <div className="section-title">Parecer de Crédito</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Mês de referência: <strong>{monthLabel(refMonth)}</strong>
            {opinion?.updated_at && <> · Atualizado em {new Date(opinion.updated_at).toLocaleString("pt-BR")}</>}
          </div>
        </div>
        <div className="flex items-center gap-2" data-print="hide">
          {canWrite ? (
            <>
              <Button variant="outline" size="sm" className="h-7 text-[11.5px]"
                onClick={() => setForm((f) => ({ ...f, summary: buildTemplate() }))}>
                <FileText className="h-3.5 w-3.5 mr-1.5" /> Usar dados do informe
              </Button>
              <Button variant={editing ? "default" : "outline"} size="sm" className="h-7 text-[11.5px]"
                onClick={() => editing ? save() : setEditing(true)}>
                <Edit3 className="h-3.5 w-3.5 mr-1.5" /> {editing ? "Salvar" : "Editar Parecer"}
              </Button>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> Somente leitura
            </span>
          )}
          <Link to={`/fidc-monitor/pareceres`} className="text-[11.5px] text-primary hover:underline">
            Abrir página de pareceres →
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="p-6 text-center text-[12px] text-muted-foreground">Carregando…</div>
      ) : (
        <div className="px-4 pb-4 space-y-3 text-[12.5px]">
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-muted-foreground">Recomendação:</span>
            {editing && canWrite ? (
              <select
                value={form.recommendation}
                onChange={(e) => setForm({ ...form, recommendation: e.target.value as RecEnum })}
                className="bg-card border border-border rounded-sm px-2 py-0.5 text-[12px]"
              >
                {(Object.keys(REC_LABEL) as RecEnum[]).map((k) => <option key={k} value={k}>{REC_LABEL[k]}</option>)}
              </select>
            ) : (
              <span className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-[11px] font-medium ${REC_COLOR[form.recommendation]}`}>
                {REC_LABEL[form.recommendation]}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Resumo executivo" value={form.summary} edit={editing && canWrite}
              onChange={(v) => setForm({ ...form, summary: v })} full />
            <Field label="Motivo da recomendação" value={form.recommendation_reason} edit={editing && canWrite}
              onChange={(v) => setForm({ ...form, recommendation_reason: v })} full />
            <Field label="Pontos positivos" value={form.positive_points} edit={editing && canWrite}
              onChange={(v) => setForm({ ...form, positive_points: v })} />
            <Field label="Pontos de atenção" value={form.attention_points} edit={editing && canWrite}
              onChange={(v) => setForm({ ...form, attention_points: v })} />
            <Field label="Riscos principais" value={form.main_risks} edit={editing && canWrite}
              onChange={(v) => setForm({ ...form, main_risks: v })} />
            <Field label="Evolução recente" value={form.recent_evolution} edit={editing && canWrite}
              onChange={(v) => setForm({ ...form, recent_evolution: v })} />
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label, value, edit, onChange, full,
}: {
  label: string; value: string; edit: boolean;
  onChange: (v: string) => void; full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      {edit ? (
        <textarea
          value={value} onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full bg-card border border-border rounded-sm px-2.5 py-1.5 text-[12.5px] outline-none focus:border-primary"
        />
      ) : (
        <div className="text-[12.5px] whitespace-pre-wrap text-foreground/90 min-h-[2.5em]">
          {value || <span className="text-muted-foreground italic">— sem conteúdo</span>}
        </div>
      )}
    </div>
  );
}
