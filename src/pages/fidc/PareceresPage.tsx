import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { OPINIONS, fidcById } from "@/lib/fidc/mock-data";
import { monthLabel } from "@/lib/fidc/format";
import { BRL, PCT } from "@/lib/fidc/format";
import { PageHeader } from "@/components/fidc/PageHeader";
import { RecBadge } from "@/components/fidc/RecBadge";
import { useFidcMonitorData } from "@/hooks/useFidcMonitorData";

export default function PareceresPage() {
  const [selected, setSelected] = useState(OPINIONS[0]?.id);
  const op = OPINIONS.find((o) => o.id === selected) ?? OPINIONS[0];
  const f = op ? fidcById(op.fidcId)! : null;
  const { fidcs, latestReportFor, prevReportFor } = useFidcMonitorData();

  // Tenta casar o FIDC do parecer com um FIDC real (do cadastro mestre) pelo nome
  const realFidc = useMemo(() => {
    if (!f) return null;
    const target = f.name.toLowerCase();
    return fidcs.find((x) => x.name?.toLowerCase().includes(target) || target.includes(x.name?.toLowerCase() ?? "")) ?? null;
  }, [f, fidcs]);
  const realReport = realFidc ? latestReportFor(realFidc.id) : null;
  const realPrev = realFidc ? prevReportFor(realFidc.id) : null;

  if (!op || !f) {
    return (
      <div>
        <PageHeader title="Pareceres de Crédito" subtitle="Nenhum parecer cadastrado" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Pareceres de Crédito" subtitle={`${OPINIONS.length} pareceres ativos`} />
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr]">
        <aside className="hairline-r min-h-[calc(100vh-7rem)]">
          <div className="section-title px-4 pt-3 pb-2">Mês de {monthLabel(op.month)}</div>
          <ul>
            {OPINIONS.map((o) => {
              const ff = fidcById(o.fidcId)!;
              return (
                <li key={o.id}>
                  <button
                    onClick={() => setSelected(o.id)}
                    className={`w-full text-left px-4 py-2.5 hairline-b flex items-start justify-between gap-2 transition-colors ${
                      o.id === selected ? "bg-surface-2" : "hover:bg-surface-2/40"
                    }`}
                  >
                    <div>
                      <div className="text-[12.5px] font-medium">{ff.name}</div>
                      <div className="text-[10.5px] text-muted-foreground mt-0.5">{ff.sector}</div>
                    </div>
                    <RecBadge rec={o.recommendation} />
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="p-6">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="section-title">Parecer · {monthLabel(op.month)}</div>
              <h2 className="text-[17px] font-semibold mt-1">{f.name}</h2>
              <div className="text-[11.5px] text-muted-foreground mt-1">{f.manager} · {f.administrator}</div>
            </div>
            <div className="flex items-center gap-3">
              <RecBadge rec={op.recommendation} />
              <Link to={`/fidc-monitor/fidcs/${f.id}`} className="text-[12px] text-primary hover:underline">Abrir FIDC →</Link>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Recomendação" defaultValue={op.recommendation} as="select" options={["Manter", "Acompanhar", "Reduzir", "Zerar"]} />
            <Field label="Responsável" defaultValue={op.author} />
            <Field label="Resumo executivo" defaultValue={op.summary} textarea className="md:col-span-2" />
            <Field label="Motivo da recomendação" defaultValue={op.reason} textarea className="md:col-span-2" />
            <Field label="Pontos positivos" defaultValue={op.positives} textarea />
            <Field label="Pontos de atenção" defaultValue={op.attentions} textarea />
            <Field label="Riscos principais" defaultValue={op.risks} textarea />
            <Field label="Evolução recente" defaultValue={op.evolution} textarea />
          </div>

          <div className="mt-5 flex items-center justify-between flex-wrap gap-3">
            <div className="text-[11px] text-muted-foreground">Última atualização: {op.date}</div>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 text-[12px] border border-border rounded-sm hover:bg-accent">Descartar alterações</button>
              <button className="px-3 py-1.5 text-[12px] bg-primary text-primary-foreground rounded-sm font-medium hover:bg-primary/90">Salvar parecer</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, defaultValue, textarea, as, options, className = "" }: {
  label: string; defaultValue?: string; textarea?: boolean;
  as?: "select"; options?: string[]; className?: string;
}) {
  const base = "w-full bg-card border border-border rounded-sm px-2.5 py-1.5 text-[12.5px] outline-none focus:border-primary";
  return (
    <label className={`block ${className}`}>
      <div className="section-title mb-1">{label}</div>
      {as === "select" ? (
        <select defaultValue={defaultValue} className={base}>
          {options!.map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : textarea ? (
        <textarea defaultValue={defaultValue} rows={3} className={`${base} resize-y leading-relaxed`} />
      ) : (
        <input defaultValue={defaultValue} className={base} />
      )}
    </label>
  );
}
