// Modal POC de importação de Informes Mensais FIDC via Dados Abertos da CVM.
// Fluxo: usuário escolhe AAAAMM → função baixa ZIP da CVM → mostra diagnóstico
// e tabela por FIDC → confirmação grava em fidc_monthly_reports.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Download, AlertTriangle, CheckCircle2, ExternalLink, Database, Upload } from "lucide-react";
import { toast } from "sonner";
import { BRL, PCT, formatCNPJ } from "@/lib/fidc/format";
import { cvmZipUrl, defaultMonth, STATUS_CLASSES, STATUS_LABELS, type CvmFidcRow, type CvmFidcStatus } from "@/lib/fidc/cvm-mapping";
import { useCvmDiagnose, useCvmCommit, type CommitItem } from "@/hooks/useCvmImport";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

type MasterFidc = { id: string; cnpj: string; name: string };
type CvmRow = CvmFidcRow;

export function CvmImportDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [month, setMonth] = useState<string>(defaultMonth());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modeByCnpj, setModeByCnpj] = useState<Record<string, "replace" | "new_version">>({});

  const diagnose = useCvmDiagnose();
  const commit = useCvmCommit();
  const diag = diagnose.data;

  // Cadastro Mestre + CNPJs com posição
  const { data: master = [] } = useQuery({
    queryKey: ["cvm-master-fidcs"],
    queryFn: async (): Promise<MasterFidc[]> => {
      const { data, error } = await supabase.from("fidcs").select("id, cnpj, name");
      if (error) throw error;
      return (data ?? []).map((d) => ({ id: d.id, cnpj: (d.cnpj ?? "").replace(/\D/g, ""), name: d.name })).filter((d) => d.cnpj);
    },
    enabled: open,
  });

  // CNPJs com posição na Butiá: join posicoes → emissoes → fidc_quota_classes → fidcs
  const { data: positionCnpjs = [] } = useQuery({
    queryKey: ["cvm-position-cnpjs"],
    queryFn: async (): Promise<string[]> => {
      const { data } = await supabase.from("fidc_quota_classes").select("fidc_id, fidcs(cnpj)");
      const set = new Set<string>();
      (data ?? []).forEach((r: any) => { const c = (r.fidcs?.cnpj ?? "").replace(/\D/g, ""); if (c) set.add(c); });
      return Array.from(set);
    },
    enabled: open,
  });

  const cnpjToFidc = useMemo(() => {
    const m = new Map<string, MasterFidc>();
    master.forEach((f) => m.set(f.cnpj, f));
    return m;
  }, [master]);

  useEffect(() => {
    if (!open) {
      setSelected(new Set()); setModeByCnpj({}); diagnose.reset(); commit.reset();
    }
  }, [open]); // eslint-disable-line

  // Verifica quais FIDCs já têm informe para o mês escolhido (para sugerir modo)
  const { data: existingForMonth = [] } = useQuery({
    queryKey: ["cvm-existing-reports", month],
    enabled: open && !!diag,
    queryFn: async () => {
      const refIso = `${month.slice(0, 4)}-${month.slice(4, 6)}-01`;
      const fidcIds = diag?.fidcs.map((f) => cnpjToFidc.get(f.cnpj)?.id).filter(Boolean) as string[];
      if (!fidcIds?.length) return [];
      const { data } = await supabase.from("fidc_monthly_reports")
        .select("fidc_id").eq("reference_month", refIso).in("fidc_id", fidcIds);
      return (data ?? []).map((r) => r.fidc_id);
    },
  });
  const existingSet = useMemo(() => new Set(existingForMonth), [existingForMonth]);

  const runDiagnose = () => {
    if (!/^\d{6}$/.test(month)) { toast.error("Mês inválido. Use AAAAMM."); return; }
    diagnose.mutate({
      referenceMonth: month,
      targetCnpjs: master.map((m) => m.cnpj),
      positionCnpjs,
    });
  };

  const toggleRow = (cnpj: string) => {
    const next = new Set(selected);
    next.has(cnpj) ? next.delete(cnpj) : next.add(cnpj);
    setSelected(next);
  };
  const toggleAll = () => {
    if (!diag) return;
    const eligible = diag.fidcs.filter((f) => cnpjToFidc.has(f.cnpj) && f.status !== "validacao_critica");
    if (selected.size === eligible.length) setSelected(new Set());
    else setSelected(new Set(eligible.map((f) => f.cnpj)));
  };

  const runCommit = async () => {
    if (!diag) return;
    const items: CommitItem[] = diag.fidcs
      .filter((f) => selected.has(f.cnpj) && cnpjToFidc.has(f.cnpj))
      .map((f) => {
        const fidc = cnpjToFidc.get(f.cnpj)!;
        const exists = existingSet.has(fidc.id);
        const mode = modeByCnpj[f.cnpj] ?? (exists ? "replace" : "new_version");
        return { ...f, fidcId: fidc.id, mode };
      });
    if (!items.length) { toast.error("Selecione pelo menos um FIDC."); return; }
    try {
      const res = await commit.mutateAsync({
        referenceMonth: diag.referenceMonth, sourceUrl: diag.url, fileHash: diag.fileHash, items,
      });
      toast.success(`Importação CVM: ${res.success}/${res.total} FIDCs gravados`);
      qc.invalidateQueries({ queryKey: ["fidc-monthly-reports"] });
      qc.invalidateQueries({ queryKey: ["fidc-monitor"] });
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(`Falha no commit: ${e?.message ?? String(e)}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1400px] max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-4 w-4" /> Importar Informes via CVM
            <span className="ml-2 inline-flex items-center rounded-sm border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-amber-700">POC</span>
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            Baixa o ZIP oficial do Informe Mensal FIDC dos Dados Abertos da CVM, filtra os CNPJs do Cadastro Mestre
            e mostra uma pré-validação antes de gravar. O upload manual continua disponível.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3 hairline-b pb-3">
          <label className="flex flex-col text-[11px] text-muted-foreground gap-1">
            <span className="uppercase tracking-wider">Mês de referência (AAAAMM)</span>
            <input
              value={month}
              onChange={(e) => setMonth(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="202506"
              className="bg-card border border-border rounded-sm px-2 py-1.5 text-[13px] w-40 text-foreground font-mono outline-none focus:border-primary"
            />
          </label>
          <div className="flex-1 text-[11px] text-muted-foreground truncate">
            <div className="uppercase tracking-wider">URL</div>
            <a href={cvmZipUrl(month)} target="_blank" rel="noreferrer" className="hover:text-primary inline-flex items-center gap-1 font-mono text-[11px]">
              {cvmZipUrl(month)} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <Button onClick={runDiagnose} disabled={diagnose.isPending} size="sm">
            {diagnose.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
            Baixar e analisar
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          {diagnose.isPending && (
            <div className="py-16 text-center text-muted-foreground text-[12px]">
              <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Baixando ZIP da CVM e processando CSVs...
            </div>
          )}

          {diagnose.error && (
            <Alert variant="destructive" className="my-3">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{(diagnose.error as Error).message}</AlertDescription>
            </Alert>
          )}

          {diag && (
            <div className="space-y-4 py-3">
              {/* KPIs de diagnóstico */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 text-[12px]">
                <Kpi label="Mês" value={`${diag.referenceMonth.slice(0,4)}/${diag.referenceMonth.slice(4,6)}`} />
                <Kpi label="Tamanho ZIP" value={`${(diag.fileSizeBytes/1024/1024).toFixed(1)} MB`} />
                <Kpi label="Arquivos" value={String(diag.filesInZip.length)} />
                <Kpi label="Total CNPJs (CVM)" value={diag.totalCnpjs.toLocaleString("pt-BR")} />
                <Kpi label="Mestre encontrados" value={`${diag.mestreFound.length}/${diag.mestreFound.length + diag.mestreMissing.length}`} accent={diag.mestreMissing.length ? "warning" : "ok"} />
                <Kpi label="Com posição encontrados" value={`${diag.posFound.length}/${diag.posFound.length + diag.posMissing.length}`} accent={diag.posMissing.length ? "warning" : "ok"} />
                <Kpi label="Hash" value={diag.fileHash} mono />
              </div>

              {/* Alertas / erros */}
              {(diag.alerts.length > 0 || diag.readErrors.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
                  {diag.alerts.length > 0 && (
                    <div className="border border-amber-500/30 bg-amber-500/5 rounded-sm p-3">
                      <div className="font-semibold text-amber-700 mb-1 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />Alertas</div>
                      <ul className="list-disc list-inside space-y-0.5 text-amber-700/90">
                        {diag.alerts.map((a, i) => <li key={i}>{a}</li>)}
                      </ul>
                    </div>
                  )}
                  {diag.readErrors.length > 0 && (
                    <div className="border border-red-500/30 bg-red-500/5 rounded-sm p-3">
                      <div className="font-semibold text-red-700 mb-1">Erros de leitura</div>
                      <ul className="list-disc list-inside space-y-0.5 text-red-700/90">
                        {diag.readErrors.map((a, i) => <li key={i} className="font-mono text-[11px]">{a}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* CNPJs não encontrados */}
              {diag.mestreMissing.length > 0 && (
                <details className="text-[12px] border border-border rounded-sm p-2">
                  <summary className="cursor-pointer text-muted-foreground">
                    {diag.mestreMissing.length} CNPJ(s) do Cadastro Mestre não encontrados no informe CVM
                  </summary>
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-1 font-mono text-[11px]">
                    {diag.mestreMissing.map((c) => (
                      <div key={c}>{formatCNPJ(c)} <span className="text-muted-foreground">— {cnpjToFidc.get(c)?.name ?? ""}</span></div>
                    ))}
                  </div>
                </details>
              )}

              {/* Tabela por FIDC */}
              <div className="overflow-x-auto border border-border rounded-sm">
                <table className="w-full text-[11.5px] border-separate border-spacing-0 min-w-[1800px]">
                  <thead className="bg-surface-2 text-muted-foreground sticky top-0">
                    <tr>
                      <Th>
                        <input type="checkbox"
                          checked={!!diag.fidcs.length && selected.size > 0 && selected.size === diag.fidcs.filter((f) => cnpjToFidc.has(f.cnpj) && f.status !== "validacao_critica").length}
                          onChange={toggleAll} />
                      </Th>
                      <Th>Status</Th>
                      <Th>CNPJ</Th>
                      <Th>FIDC</Th>
                      <Th>Posição Butiá</Th>
                      <Th right>PL</Th>
                      <Th right>DC</Th>
                      <Th right>Caixa Ampl.</Th>
                      <Th right>PDD</Th>
                      <Th right>Atraso total</Th>
                      <Th right>30d</Th><Th right>60d</Th><Th right>90d</Th><Th right>120d</Th>
                      <Th right>Recompras</Th>
                      <Th right>Cotistas</Th>
                      <Th right>Classes</Th>
                      <Th right>Σ PL Cotas</Th>
                      <Th right>Δ PL</Th>
                      <Th>Versão</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {diag.fidcs.map((f) => {
                      const fidc = cnpjToFidc.get(f.cnpj);
                      const eligible = !!fidc && f.status !== "validacao_critica";
                      const isSelected = selected.has(f.cnpj);
                      const exists = fidc ? existingSet.has(fidc.id) : false;
                      const mode = modeByCnpj[f.cnpj] ?? (exists ? "replace" : "new_version");
                      return (
                        <tr key={f.cnpj} className="hairline-b hover:bg-surface-2/40">
                          <Td>
                            <input type="checkbox" checked={isSelected} disabled={!eligible} onChange={() => toggleRow(f.cnpj)} />
                          </Td>
                          <Td><StatusBadge status={f.status} /></Td>
                          <Td mono>{formatCNPJ(f.cnpj)}</Td>
                          <Td>
                            <div className="font-medium">{fidc?.name ?? f.name ?? <span className="text-muted-foreground italic">(fora do Cadastro Mestre)</span>}</div>
                            <div className="text-[10.5px] text-muted-foreground truncate max-w-[280px]">{f.name}</div>
                            {f.flags.length > 0 && <div className="text-[10px] text-amber-700">{f.flags.join(" · ")}</div>}
                          </Td>
                          <Td>{f.hasPositionInButia ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <span className="text-muted-foreground">—</span>}</Td>
                          <Td right mono>{f.pl != null ? BRL(f.pl, { compact: true }) : "—"}</Td>
                          <Td right mono>{f.creditRights != null ? BRL(f.creditRights, { compact: true }) : "—"}</Td>
                          <Td right mono>{f.caixaAmpliado != null ? BRL(f.caixaAmpliado, { compact: true }) : "—"}</Td>
                          <Td right mono>{f.pdd != null ? BRL(f.pdd, { compact: true }) : "—"}</Td>
                          <Td right mono>{f.overdueTotal != null ? BRL(f.overdueTotal, { compact: true }) : "—"}</Td>
                          <Td right mono>{f.overdue30 ? BRL(f.overdue30, { compact: true }) : "—"}</Td>
                          <Td right mono>{f.overdue60 ? BRL(f.overdue60, { compact: true }) : "—"}</Td>
                          <Td right mono>{f.overdue90 ? BRL(f.overdue90, { compact: true }) : "—"}</Td>
                          <Td right mono>{f.overdue120 ? BRL(f.overdue120, { compact: true }) : "—"}</Td>
                          <Td right mono>{f.repurchase != null ? BRL(f.repurchase, { compact: true }) : "—"}</Td>
                          <Td right mono>{f.investors ?? "—"}</Td>
                          <Td right mono>{f.classes.length}</Td>
                          <Td right mono>{BRL(f.sumClassesPL, { compact: true })}</Td>
                          <Td right mono className={f.plDiffPct != null && f.plDiffPct > 0.05 ? "text-red-600" : ""}>
                            {f.plDiffPct != null ? PCT(f.plDiffPct) : "—"}
                          </Td>
                          <Td>
                            {exists ? (
                              <select value={mode} onChange={(e) => setModeByCnpj({ ...modeByCnpj, [f.cnpj]: e.target.value as any })}
                                className="bg-card border border-border rounded-sm text-[11px] px-1 py-0.5 outline-none">
                                <option value="replace">Substituir atual</option>
                                <option value="new_version">Nova versão</option>
                              </select>
                            ) : <span className="text-muted-foreground">Inserir</span>}
                          </Td>
                        </tr>
                      );
                    })}
                    {!diag.fidcs.length && (
                      <tr><td colSpan={20} className="py-10 text-center text-muted-foreground">Nenhum FIDC do Cadastro Mestre encontrado neste informe.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="hairline-t pt-3 gap-2">
          <div className="text-[11px] text-muted-foreground flex-1">
            {diag && <>Selecionados: <strong>{selected.size}</strong> · Tempo: {diag.elapsedMs}ms</>}
          </div>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button size="sm" onClick={runCommit} disabled={!diag || !selected.size || commit.isPending}>
            {commit.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
            Confirmar e gravar (teste)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`hairline-b px-2 py-1.5 text-[10px] uppercase tracking-wider font-semibold whitespace-nowrap ${right ? "text-right" : "text-left"}`}>{children}</th>;
}
function Td({ children, right, mono, className = "" }: { children: React.ReactNode; right?: boolean; mono?: boolean; className?: string }) {
  return <td className={`px-2 py-1 whitespace-nowrap ${right ? "text-right" : ""} ${mono ? "font-mono" : ""} ${className}`}>{children}</td>;
}
function Kpi({ label, value, mono, accent }: { label: string; value: React.ReactNode; mono?: boolean; accent?: "ok" | "warning" }) {
  const cls = accent === "warning" ? "border-amber-500/40 bg-amber-500/5"
            : accent === "ok" ? "border-emerald-500/40 bg-emerald-500/5"
            : "border-border bg-card";
  return (
    <div className={`rounded-sm border ${cls} p-2`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-[13px] font-semibold ${mono ? "font-mono" : ""} truncate`}>{value}</div>
    </div>
  );
}
function StatusBadge({ status }: { status: CvmFidcStatus }) {
  return <span className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] ${STATUS_CLASSES[status]}`}>{STATUS_LABELS[status]}</span>;
}
