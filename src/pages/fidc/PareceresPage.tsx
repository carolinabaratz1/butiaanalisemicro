// Pareceres de Crédito (FIDC) — conectado às tabelas reais:
// - fidcs (cadastro mestre) → useFidcMonitorData
// - fidc_monthly_reports (informe mensal, última versão) → métricas exibidas
// - credit_opinions (parecer por FIDC/mês) → load + upsert
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { monthLabel, BRL, PCT } from "@/lib/fidc/format";
import { PageHeader } from "@/components/fidc/PageHeader";
import { RecBadge } from "@/components/fidc/RecBadge";
import { useFidcMonitorData } from "@/hooks/useFidcMonitorData";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Plus, Lock } from "lucide-react";

type RecEnum = "manter" | "acompanhar" | "reduzir" | "zerar";
const REC_LABEL: Record<RecEnum, "Manter" | "Acompanhar" | "Reduzir" | "Zerar"> = {
  manter: "Manter", acompanhar: "Acompanhar", reduzir: "Reduzir", zerar: "Zerar",
};
const REC_OPTIONS: RecEnum[] = ["manter", "acompanhar", "reduzir", "zerar"];

type OpinionRow = {
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

const toMonthInput = (iso: string | null | undefined) =>
  iso ? String(iso).slice(0, 7) : "";
const toMonthDate = (ym: string) => (ym ? `${ym}-01` : "");

export default function PareceresPage() {
  const qc = useQueryClient();
  const { currentUser, permissions } = useAuth();
  const canWrite = permissions.canWrite;
  const { fidcs, isLoading: fidcLoading, latestReportFor, prevReportFor } = useFidcMonitorData();

  // ----- Pareceres existentes -----
  const { data: opinions = [], isLoading: opLoading } = useQuery({
    queryKey: ["credit_opinions", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_opinions")
        .select("*")
        .order("reference_month", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OpinionRow[];
    },
  });

  // Mês padrão = mês do parecer mais recente (qualquer FIDC) ou mês do informe mais recente
  const defaultMonth = useMemo(() => {
    if (opinions.length) return toMonthInput(opinions[0].reference_month);
    for (const f of fidcs) {
      const r = latestReportFor(f.id);
      if (r?.reference_month) return toMonthInput(r.reference_month as string);
    }
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, [opinions, fidcs, latestReportFor]);

  const [month, setMonth] = useState<string>("");
  useEffect(() => { if (!month && defaultMonth) setMonth(defaultMonth); }, [defaultMonth, month]);

  // Último parecer por FIDC dentro do mês selecionado
  const opinionByFidc = useMemo(() => {
    const map = new Map<string, OpinionRow>();
    for (const o of opinions) {
      if (toMonthInput(o.reference_month) !== month) continue;
      if (!map.has(o.fidc_id)) map.set(o.fidc_id, o);
    }
    return map;
  }, [opinions, month]);

  // Último parecer por FIDC (qualquer mês), para mostrar badge na sidebar quando não há no mês atual
  const latestOpinionByFidc = useMemo(() => {
    const map = new Map<string, OpinionRow>();
    for (const o of opinions) if (!map.has(o.fidc_id)) map.set(o.fidc_id, o);
    return map;
  }, [opinions]);

  const sortedFidcs = useMemo(
    () => [...fidcs].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "pt-BR")),
    [fidcs],
  );

  const [selectedFidcId, setSelectedFidcId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedFidcId && sortedFidcs.length) setSelectedFidcId(sortedFidcs[0].id);
  }, [sortedFidcs, selectedFidcId]);

  const selectedFidc = sortedFidcs.find((f) => f.id === selectedFidcId) ?? null;
  const currentOp = selectedFidcId ? opinionByFidc.get(selectedFidcId) ?? null : null;
  const report = selectedFidcId ? latestReportFor(selectedFidcId) : null;
  const prev = selectedFidcId ? prevReportFor(selectedFidcId) : null;

  // ----- Form state -----
  type FormState = {
    recommendation: RecEnum;
    summary: string;
    recommendation_reason: string;
    positive_points: string;
    attention_points: string;
    main_risks: string;
    recent_evolution: string;
  };
  const emptyForm: FormState = {
    recommendation: "manter",
    summary: "",
    recommendation_reason: "",
    positive_points: "",
    attention_points: "",
    main_risks: "",
    recent_evolution: "",
  };
  const [form, setForm] = useState<FormState>(emptyForm);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentOp) {
      setForm({
        recommendation: (currentOp.recommendation ?? "manter") as RecEnum,
        summary: currentOp.summary ?? "",
        recommendation_reason: currentOp.recommendation_reason ?? "",
        positive_points: currentOp.positive_points ?? "",
        attention_points: currentOp.attention_points ?? "",
        main_risks: currentOp.main_risks ?? "",
        recent_evolution: currentOp.recent_evolution ?? "",
      });
    } else {
      setForm(emptyForm);
    }
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOp?.id, selectedFidcId, month]);

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    if (!canWrite) return;
    setForm((p) => ({ ...p, [k]: v }));
    setDirty(true);
  };

  async function handleSave() {
    if (!canWrite) return; // defesa extra no client; RLS (fidc_can_write_opinion) já protege no banco
    if (!selectedFidcId || !month) return;
    setSaving(true);
    try {
      const payload = {
        fidc_id: selectedFidcId,
        reference_month: toMonthDate(month),
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
      if (error) throw error;
      toast.success("Parecer salvo.");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["credit_opinions", "all"] });
    } catch (e) {
      toast.error(`Falha ao salvar: ${e instanceof Error ? e.message : "erro"}`);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (!canWrite) return;
    if (currentOp) {
      setForm({
        recommendation: (currentOp.recommendation ?? "manter") as RecEnum,
        summary: currentOp.summary ?? "",
        recommendation_reason: currentOp.recommendation_reason ?? "",
        positive_points: currentOp.positive_points ?? "",
        attention_points: currentOp.attention_points ?? "",
        main_risks: currentOp.main_risks ?? "",
        recent_evolution: currentOp.recent_evolution ?? "",
      });
    } else {
      setForm(emptyForm);
    }
    setDirty(false);
  }

  const opinionsForMonthCount = opinionByFidc.size;

  return (
    <div>
      <PageHeader
        title="Pareceres de Crédito"
        subtitle={
          opLoading || fidcLoading
            ? "Carregando…"
            : `${opinionsForMonthCount} parecer(es) em ${month ? monthLabel(toMonthDate(month)) : "—"} · ${sortedFidcs.length} FIDCs cadastrados`
        }
        right={
          <div className="flex items-center gap-2 text-[11.5px]">
            <span className="text-muted-foreground">Mês de referência</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="bg-card border border-border rounded-sm px-2 py-1 text-[12px] outline-none focus:border-primary"
            />
          </div>
        }
      />

      {fidcLoading ? (
        <div className="px-6 py-12 text-center text-muted-foreground text-[12px]">
          <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando FIDCs…
        </div>
      ) : sortedFidcs.length === 0 ? (
        <div className="px-6 py-12 text-center text-muted-foreground text-[12px]">
          Nenhum FIDC cadastrado. Importe o cadastro mestre para começar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[300px_1fr]">
          <aside className="hairline-r min-h-[calc(100vh-7rem)]">
            <div className="section-title px-4 pt-3 pb-2">FIDCs ({sortedFidcs.length})</div>
            <ul>
              {sortedFidcs.map((f) => {
                const opMonth = opinionByFidc.get(f.id);
                const opAny = latestOpinionByFidc.get(f.id);
                const op = opMonth ?? opAny ?? null;
                return (
                  <li key={f.id}>
                    <button
                      onClick={() => setSelectedFidcId(f.id)}
                      className={`w-full text-left px-4 py-2.5 hairline-b flex items-start justify-between gap-2 transition-colors ${
                        f.id === selectedFidcId ? "bg-surface-2" : "hover:bg-surface-2/40"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-medium truncate">{f.name}</div>
                        <div className="text-[10.5px] text-muted-foreground mt-0.5 truncate">
                          {f.sector || f.manager || "—"}
                        </div>
                        {!opMonth && opAny && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Último parecer: {monthLabel(String(opAny.reference_month).slice(0, 10))}
                          </div>
                        )}
                        {!op && (
                          <div className="text-[10px] text-muted-foreground mt-0.5 italic">Sem parecer</div>
                        )}
                      </div>
                      {op ? (
                        <RecBadge rec={REC_LABEL[op.recommendation]} />
                      ) : (
                        <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <section className="p-6">
            {!selectedFidc ? (
              <div className="text-center text-muted-foreground text-[12px] py-12">
                Selecione um FIDC para emitir/editar parecer.
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="section-title">
                      Parecer · {month ? monthLabel(toMonthDate(month)) : "—"}
                      {!currentOp && <span className="ml-2 text-[10.5px] text-muted-foreground italic">novo</span>}
                    </div>
                    <h2 className="text-[17px] font-semibold mt-1">{selectedFidc.name}</h2>
                    <div className="text-[11.5px] text-muted-foreground mt-1">
                      {[selectedFidc.manager, selectedFidc.administrator].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <RecBadge rec={REC_LABEL[form.recommendation]} />
                    <Link
                      to={`/fidc-monitor/fidcs/${selectedFidc.id}`}
                      className="text-[12px] text-primary hover:underline"
                    >
                      Abrir FIDC →
                    </Link>
                  </div>
                </div>

                {!canWrite && (
                  <div className="mt-3 flex items-center gap-2 rounded-sm border border-border bg-muted/20 px-3 py-2 text-[11.5px] text-muted-foreground">
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                    Seu perfil tem acesso somente leitura a Pareceres de Crédito. Apenas Gestor,
                    Analista e Coordenação/Especialista podem editar ou salvar.
                  </div>
                )}

                {/* Métricas do informe mensal */}
                {report ? (
                  <div className="mt-4 rounded-sm border border-border bg-card">
                    <div className="px-3 py-1.5 hairline-b text-[10.5px] uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span>Métricas do informe mensal</span>
                      <span className="text-foreground/80">
                        Ref.: {String(report.reference_month ?? "").slice(0, 7)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 px-3 py-3 text-[12px]">
                      <MiniKpi
                        label="PL"
                        value={BRL(Number(report.nav_value ?? 0), { compact: true })}
                        hint={prev && Number(prev.nav_value ?? 0) > 0
                          ? `Var. ${PCT((Number(report.nav_value ?? 0) - Number(prev.nav_value ?? 0)) / Number(prev.nav_value ?? 0))}`
                          : undefined}
                      />
                      <MiniKpi
                        label="Cota"
                        value={Number(report.quota_value ?? 0).toLocaleString("pt-BR", {
                          minimumFractionDigits: 6, maximumFractionDigits: 8,
                        })}
                        hint={prev && Number(prev.quota_value ?? 0) > 0
                          ? `Var. ${PCT((Number(report.quota_value ?? 0) - Number(prev.quota_value ?? 0)) / Number(prev.quota_value ?? 0))}`
                          : undefined}
                      />
                      <MiniKpi label="Direitos creditórios" value={BRL(Number(report.credit_rights_value ?? 0), { compact: true })} />
                      <MiniKpi
                        label="Atraso/DC"
                        value={Number(report.credit_rights_value ?? 0) > 0
                          ? PCT(Number(report.overdue_value ?? 0) / Number(report.credit_rights_value ?? 1))
                          : "—"}
                      />
                      <MiniKpi
                        label="PDD/DC"
                        value={Number(report.credit_rights_value ?? 0) > 0
                          ? PCT(Math.abs(Number(report.pdd_value ?? 0)) / Number(report.credit_rights_value ?? 1))
                          : "—"}
                      />
                      <MiniKpi
                        label="Caixa/PL"
                        value={Number(report.nav_value ?? 0) > 0
                          ? PCT(Number(report.cash_value ?? 0) / Number(report.nav_value ?? 1))
                          : "—"}
                      />
                      <MiniKpi label="Cotistas" value={String(report.investors_count ?? "—")} />
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-sm border border-dashed border-border bg-muted/20 px-3 py-2 text-[11.5px] text-muted-foreground">
                    Sem informe mensal importado para este FIDC — métricas serão preenchidas após o upload.
                  </div>
                )}

                {/* Formulário */}
                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block">
                    <div className="section-title mb-1">Recomendação</div>
                    <select
                      value={form.recommendation}
                      onChange={(e) => setField("recommendation", e.target.value as RecEnum)}
                      disabled={!canWrite}
                      className="w-full bg-card border border-border rounded-sm px-2.5 py-1.5 text-[12.5px] outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {REC_OPTIONS.map((r) => (
                        <option key={r} value={r}>{REC_LABEL[r]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <div className="section-title mb-1">Responsável</div>
                    <input
                      value={currentUser?.nome ?? "—"}
                      readOnly
                      className="w-full bg-muted/20 border border-border rounded-sm px-2.5 py-1.5 text-[12.5px] text-muted-foreground"
                    />
                  </label>
                  <Field label="Resumo executivo" value={form.summary}
                    onChange={(v) => setField("summary", v)} textarea className="md:col-span-2" disabled={!canWrite} />
                  <Field label="Motivo da recomendação" value={form.recommendation_reason}
                    onChange={(v) => setField("recommendation_reason", v)} textarea className="md:col-span-2" disabled={!canWrite} />
                  <Field label="Pontos positivos" value={form.positive_points}
                    onChange={(v) => setField("positive_points", v)} textarea disabled={!canWrite} />
                  <Field label="Pontos de atenção" value={form.attention_points}
                    onChange={(v) => setField("attention_points", v)} textarea disabled={!canWrite} />
                  <Field label="Riscos principais" value={form.main_risks}
                    onChange={(v) => setField("main_risks", v)} textarea disabled={!canWrite} />
                  <Field label="Evolução recente" value={form.recent_evolution}
                    onChange={(v) => setField("recent_evolution", v)} textarea disabled={!canWrite} />
                </div>

                {canWrite && (
                  <div className="mt-5 flex items-center justify-between flex-wrap gap-3">
                    <div className="text-[11px] text-muted-foreground">
                      {currentOp
                        ? `Última atualização: ${new Date(currentOp.updated_at).toLocaleString("pt-BR")}`
                        : "Parecer ainda não salvo para este mês."}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleReset}
                        disabled={!dirty || saving}
                        className="px-3 py-1.5 text-[12px] border border-border rounded-sm hover:bg-accent disabled:opacity-50"
                      >
                        Descartar alterações
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-3 py-1.5 text-[12px] bg-primary text-primary-foreground rounded-sm font-medium hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1.5"
                      >
                        {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                        {currentOp ? "Salvar alterações" : "Criar parecer"}
                      </button>
                    </div>
                  </div>
                )}

                {!canWrite && (
                  <div className="mt-5 text-[11px] text-muted-foreground">
                    {currentOp
                      ? `Última atualização: ${new Date(currentOp.updated_at).toLocaleString("pt-BR")}`
                      : "Nenhum parecer registrado para este mês."}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, textarea, className = "", disabled = false }: {
  label: string; value: string; onChange: (v: string) => void;
  textarea?: boolean; className?: string; disabled?: boolean;
}) {
  const base = "w-full bg-card border border-border rounded-sm px-2.5 py-1.5 text-[12.5px] outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed";
  return (
    <label className={`block ${className}`}>
      <div className="section-title mb-1">{label}</div>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} disabled={disabled} className={`${base} resize-y leading-relaxed`} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={base} />
      )}
    </label>
  );
}

function MiniKpi({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="num font-semibold text-foreground mt-0.5">{value}</div>
      {hint && <div className="text-[10.5px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
