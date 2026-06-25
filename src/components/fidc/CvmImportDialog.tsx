// CVM Import Dialog v2 — POC com Schema Discovery, Dicionário CVM e Mapeamento Configurável.
// Abas: Resumo · Arquivos ZIP · Dicionário · Mapeamento · Pré-validação · Diagnóstico por FIDC · Comparar Manual.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Download, AlertTriangle, CheckCircle2, ExternalLink, Database, Upload, BookOpen, Settings2, Eye, GitCompare } from "lucide-react";
import { toast } from "sonner";
import { BRL, PCT, formatCNPJ } from "@/lib/fidc/format";
import {
  cvmZipUrl, defaultMonth, STATUS_CLASSES, STATUS_LABELS,
  METRIC_STATUS_CLASSES, METRIC_STATUS_LABELS,
  type CvmFidcRow, type CvmFidcStatus, type CvmDictionaryResponse, type CvmMappingRow,
} from "@/lib/fidc/cvm-mapping";
import { useCvmDiagnose, useCvmCommit, useCvmDictionary, useCvmMapping, updateCvmMapping, type CommitItem } from "@/hooks/useCvmImport";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };
type MasterFidc = { id: string; cnpj: string; name: string };

export function CvmImportDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [month, setMonth] = useState(defaultMonth());
  const [tab, setTab] = useState("resumo");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modeByCnpj, setModeByCnpj] = useState<Record<string, "replace" | "new_version">>({});
  const [drillCnpj, setDrillCnpj] = useState<string | null>(null);
  const [compareCnpj, setCompareCnpj] = useState<string | null>(null);

  const diagnose = useCvmDiagnose();
  const commit = useCvmCommit();
  const dictionary = useCvmDictionary();
  const mappingQ = useCvmMapping();
  const diag = diagnose.data;
  const dict = dictionary.data;

  const { data: master = [] } = useQuery({
    queryKey: ["cvm-master-fidcs"],
    queryFn: async (): Promise<MasterFidc[]> => {
      const { data, error } = await supabase.from("fidcs").select("id, cnpj, name");
      if (error) throw error;
      return (data ?? []).map((d) => ({ id: d.id, cnpj: (d.cnpj ?? "").replace(/\D/g, ""), name: d.name })).filter((d) => d.cnpj);
    },
    enabled: open,
  });

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
    const m = new Map<string, MasterFidc>(); master.forEach((f) => m.set(f.cnpj, f)); return m;
  }, [master]);

  useEffect(() => {
    if (!open) {
      setSelected(new Set()); setModeByCnpj({}); setDrillCnpj(null); setCompareCnpj(null);
      diagnose.reset(); commit.reset();
    }
  }, [open]); // eslint-disable-line

  const { data: existingForMonth = [] } = useQuery({
    queryKey: ["cvm-existing-reports", month],
    enabled: open && !!diag,
    queryFn: async () => {
      const refIso = `${month.slice(0, 4)}-${month.slice(4, 6)}-01`;
      const fidcIds = diag?.fidcs.map((f) => cnpjToFidc.get(f.cnpj)?.id).filter(Boolean) as string[];
      if (!fidcIds?.length) return [];
      const { data } = await supabase.from("fidc_monthly_reports").select("fidc_id").eq("reference_month", refIso).in("fidc_id", fidcIds);
      return (data ?? []).map((r) => r.fidc_id);
    },
  });
  const existingSet = useMemo(() => new Set(existingForMonth), [existingForMonth]);

  const runDiagnose = () => {
    if (!/^\d{6}$/.test(month)) { toast.error("Mês inválido. Use AAAAMM."); return; }
    diagnose.mutate({ referenceMonth: month, targetCnpjs: master.map((m) => m.cnpj), positionCnpjs });
  };

  const toggleRow = (cnpj: string) => { const next = new Set(selected); next.has(cnpj) ? next.delete(cnpj) : next.add(cnpj); setSelected(next); };
  const toggleAll = () => {
    if (!diag) return;
    const eligible = diag.fidcs.filter((f) => cnpjToFidc.has(f.cnpj) && f.status !== "validacao_critica" && f.status !== "mapping_error");
    if (selected.size === eligible.length) setSelected(new Set());
    else setSelected(new Set(eligible.map((f) => f.cnpj)));
  };

  const runCommit = async () => {
    if (!diag) return;
    const items: CommitItem[] = diag.fidcs
      .filter((f) => selected.has(f.cnpj) && cnpjToFidc.has(f.cnpj) && f.pl != null)
      .map((f) => {
        const fidc = cnpjToFidc.get(f.cnpj)!;
        const exists = existingSet.has(fidc.id);
        const mode = modeByCnpj[f.cnpj] ?? (exists ? "replace" : "new_version");
        return { ...f, fidcId: fidc.id, mode };
      });
    if (!items.length) { toast.error("Selecione FIDCs com PL encontrado."); return; }
    try {
      const res = await commit.mutateAsync({ referenceMonth: diag.referenceMonth, sourceUrl: diag.url, fileHash: diag.fileHash, items });
      toast.success(`Importação CVM: ${res.success}/${res.total} FIDCs gravados`);
      qc.invalidateQueries();
    } catch (e: any) { toast.error(`Falha no commit: ${e?.message ?? String(e)}`); }
  };

  // Resumo derivado
  const summary = useMemo(() => {
    if (!diag) return null;
    const fids = diag.fidcs;
    return {
      filesCount: diag.files.length,
      totalCnpjs: diag.totalCnpjs,
      mestreFound: diag.mestreFound.length,
      mestreTotal: diag.mestreFound.length + diag.mestreMissing.length,
      posFound: diag.posFound.length,
      posTotal: diag.posFound.length + diag.posMissing.length,
      plFound: fids.filter((f) => f.pl != null).length,
      dcFound: fids.filter((f) => f.creditRights != null).length,
      segFound: fids.filter((f) => f.mainSegment).length,
      flowsFound: fids.filter((f) => (f.flows?.totalSubscriptionValue ?? 0) + (f.flows?.totalRedemptionValue ?? 0) > 0).length,
      completos: fids.filter((f) => f.status === "completo").length,
      parciais: fids.filter((f) => f.status === "parcial").length,
      mappingErrors: fids.filter((f) => f.status === "mapping_error").length,
    };
  }, [diag]);

  const drillFidc = diag?.fidcs.find((f) => f.cnpj === drillCnpj) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1500px] max-h-[94vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-4 w-4" /> Importar Informes via CVM
            <span className="ml-2 inline-flex items-center rounded-sm border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-amber-700">POC v2</span>
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            Schema Discovery + Dicionário CVM + Mapeamento Configurável. Métricas ausentes nunca são tratadas como zero.
          </DialogDescription>
        </DialogHeader>

        {/* Linha de controle */}
        <div className="flex flex-wrap items-end gap-3 hairline-b pb-3">
          <label className="flex flex-col text-[11px] text-muted-foreground gap-1">
            <span className="uppercase tracking-wider">Mês (AAAAMM)</span>
            <input value={month} onChange={(e) => setMonth(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="202506" className="bg-card border border-border rounded-sm px-2 py-1.5 text-[13px] w-32 font-mono outline-none focus:border-primary" />
          </label>
          <div className="flex-1 text-[11px] text-muted-foreground truncate">
            <div className="uppercase tracking-wider">URL CVM</div>
            <a href={cvmZipUrl(month)} target="_blank" rel="noreferrer" className="hover:text-primary inline-flex items-center gap-1 font-mono text-[11px]">
              {cvmZipUrl(month)} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <Button onClick={runDiagnose} disabled={diagnose.isPending} size="sm">
            {diagnose.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
            Baixar e analisar
          </Button>
          <Button onClick={() => dictionary.mutate()} disabled={dictionary.isPending} size="sm" variant="outline">
            {dictionary.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <BookOpen className="h-3 w-3 mr-1" />}
            Carregar dicionário
          </Button>
        </div>

        {diagnose.error && (
          <Alert variant="destructive" className="my-2">
            <AlertTriangle className="h-4 w-4" /><AlertTitle>Erro</AlertTitle>
            <AlertDescription>{(diagnose.error as Error).message}</AlertDescription>
          </Alert>
        )}

        <div className="flex-1 overflow-hidden">
          <Tabs value={tab} onValueChange={setTab} className="h-full flex flex-col">
            <TabsList className="grid grid-cols-7 w-full">
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="arquivos">Arquivos ZIP</TabsTrigger>
              <TabsTrigger value="dicionario">Dicionário</TabsTrigger>
              <TabsTrigger value="mapeamento">Mapeamento</TabsTrigger>
              <TabsTrigger value="prevalidacao">Pré-validação</TabsTrigger>
              <TabsTrigger value="diagnostico" disabled={!drillCnpj}>Diagnóstico FIDC</TabsTrigger>
              <TabsTrigger value="comparar" disabled={!compareCnpj}>Comparar Manual</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-auto pt-3">
              <TabsContent value="resumo" className="m-0">
                {!diag && <Empty label="Rode 'Baixar e analisar' para começar." />}
                {diag && summary && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-[12px]">
                      <Kpi label="Mês" value={`${diag.referenceMonth.slice(0,4)}/${diag.referenceMonth.slice(4,6)}`} />
                      <Kpi label="Tamanho ZIP" value={`${(diag.fileSizeBytes/1024/1024).toFixed(1)} MB`} />
                      <Kpi label="Arquivos" value={String(summary.filesCount)} />
                      <Kpi label="Total CNPJs (CVM)" value={summary.totalCnpjs.toLocaleString("pt-BR")} />
                      <Kpi label="Mestre encontrados" value={`${summary.mestreFound}/${summary.mestreTotal}`} accent={summary.mestreFound === summary.mestreTotal ? "ok" : "warning"} />
                      <Kpi label="Posição encontrados" value={`${summary.posFound}/${summary.posTotal}`} accent={summary.posFound === summary.posTotal ? "ok" : "warning"} />
                      <Kpi label="FIDCs PL ok" value={String(summary.plFound)} accent="ok" />
                      <Kpi label="FIDCs DC ok" value={String(summary.dcFound)} accent="ok" />
                      <Kpi label="FIDCs c/ Segmento" value={String(summary.segFound)} accent={summary.segFound > 0 ? "ok" : "warning"} />
                      <Kpi label="FIDCs c/ Fluxo Cota" value={String(summary.flowsFound)} accent={summary.flowsFound > 0 ? "ok" : "warning"} />
                      <Kpi label="Completos" value={String(summary.completos)} accent="ok" />
                      <Kpi label="Parciais" value={String(summary.parciais)} accent="warning" />
                      <Kpi label="Erro mapeamento" value={String(summary.mappingErrors)} accent={summary.mappingErrors ? "warning" : "ok"} />
                      <Kpi label="Hash" value={diag.fileHash} mono />
                    </div>
                    {(diag.alerts.length > 0 || diag.readErrors.length > 0) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
                        {diag.alerts.length > 0 && (
                          <div className="border border-amber-500/30 bg-amber-500/5 rounded-sm p-3">
                            <div className="font-semibold text-amber-700 mb-1 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />Alertas</div>
                            <ul className="list-disc list-inside space-y-0.5 text-amber-700/90">{diag.alerts.map((a, i) => <li key={i}>{a}</li>)}</ul>
                          </div>
                        )}
                        {diag.readErrors.length > 0 && (
                          <div className="border border-red-500/30 bg-red-500/5 rounded-sm p-3">
                            <div className="font-semibold text-red-700 mb-1">Erros de leitura</div>
                            <ul className="list-disc list-inside space-y-0.5 text-red-700/90">{diag.readErrors.map((a, i) => <li key={i} className="font-mono text-[11px]">{a}</li>)}</ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* Arquivos do ZIP */}
              <TabsContent value="arquivos" className="m-0">
                {!diag && <Empty label="Sem diagnóstico ainda." />}
                {diag && (
                  <div className="space-y-3">
                    {diag.files.map((f) => (
                      <details key={f.filename} className="border border-border rounded-sm">
                        <summary className="cursor-pointer px-3 py-2 flex items-center justify-between text-[12px]">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-[11px] truncate">{f.filename}</span>
                            {f.tableKind && <span className="text-[10px] uppercase bg-surface-2 border border-border rounded-sm px-1">{f.tableKind}</span>}
                            {f.containsMasterCnpj && <span className="text-[10px] bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 rounded-sm px-1">contém mestre ({f.matchedMasterCount})</span>}
                          </div>
                          <div className="text-[10.5px] text-muted-foreground font-mono flex gap-3 shrink-0">
                            <span>{(f.sizeBytes/1024).toFixed(0)} KB</span>
                            <span>{f.rows.toLocaleString("pt-BR")} linhas</span>
                            <span>{f.columns} cols</span>
                            <span>sep={JSON.stringify(f.separator)}</span>
                            <span>enc={f.encoding}</span>
                          </div>
                        </summary>
                        <div className="p-3 border-t border-border space-y-3 text-[11.5px]">
                          <div>
                            <div className="text-[10px] uppercase text-muted-foreground mb-1">Colunas ({f.headers.length})</div>
                            <div className="flex flex-wrap gap-1">
                              {f.headers.map((h) => <span key={h} className="bg-surface-2 border border-border rounded-sm px-1.5 py-0.5 font-mono text-[10.5px]">{h}</span>)}
                            </div>
                          </div>
                          {f.firstRows.length > 0 && (
                            <div>
                              <div className="text-[10px] uppercase text-muted-foreground mb-1">Primeiras 3 linhas</div>
                              <div className="overflow-x-auto border border-border rounded-sm">
                                <table className="text-[10.5px] font-mono">
                                  <tbody>
                                    {f.firstRows.map((row, i) => (
                                      <tr key={i} className="hairline-b">{row.map((c, j) => <td key={j} className="px-2 py-1 whitespace-nowrap border-r border-border">{c}</td>)}</tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                          <div className="text-[11px] text-muted-foreground">
                            CNPJs únicos (amostra): <strong>{f.uniqueCnpjsCount.toLocaleString("pt-BR")}</strong>
                            {f.exampleCnpjs.length > 0 && <> · Exemplos: <span className="font-mono">{f.exampleCnpjs.slice(0,5).map(formatCNPJ).join(", ")}</span></>}
                          </div>
                        </div>
                      </details>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Dicionário CVM */}
              <TabsContent value="dicionario" className="m-0">
                {!dict && <Empty label="Clique em 'Carregar dicionário' para baixar e ler o meta_inf_mensal_fidc_txt.zip oficial." />}
                {dict && <DictionaryView dict={dict} />}
              </TabsContent>

              {/* Mapeamento configurável */}
              <TabsContent value="mapeamento" className="m-0">
                <MappingTab mapping={mappingQ.data ?? []} onChange={() => qc.invalidateQueries({ queryKey: ["cvm-field-mapping"] })} />
              </TabsContent>

              {/* Pré-validação por FIDC */}
              <TabsContent value="prevalidacao" className="m-0">
                {!diag && <Empty label="Sem diagnóstico ainda." />}
                {diag && (
                  <div className="overflow-x-auto border border-border rounded-sm">
                    <table className="w-full text-[11.5px] border-separate border-spacing-0 min-w-[1800px]">
                      <thead className="bg-surface-2 text-muted-foreground sticky top-0">
                        <tr>
                          <Th><input type="checkbox" checked={diag.fidcs.length > 0 && selected.size === diag.fidcs.filter((f) => cnpjToFidc.has(f.cnpj) && f.status !== "validacao_critica" && f.status !== "mapping_error").length} onChange={toggleAll} /></Th>
                          <Th>Status</Th><Th>CNPJ</Th><Th>FIDC</Th><Th>Pos. Butiá</Th>
                          <Th right>PL</Th><Th right>DC</Th><Th right>Caixa Ampl.</Th><Th right>PDD</Th>
                          <Th right>Atraso total</Th><Th right>30d</Th><Th right>60d</Th><Th right>90d</Th><Th right>120d</Th>
                          <Th right>Recompras</Th><Th right>Cotistas</Th>
                          <Th>Segmento principal</Th><Th right>% Seg</Th><Th right>Fluxo líq.</Th>
                          <Th right>Classes</Th><Th right>Σ PL Cotas</Th><Th right>Δ PL</Th>
                          <Th>Versão</Th><Th>Diagnóstico</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {diag.fidcs.map((f) => {
                          const fidc = cnpjToFidc.get(f.cnpj);
                          const eligible = !!fidc && f.status !== "validacao_critica" && f.status !== "mapping_error" && f.pl != null;
                          const isSel = selected.has(f.cnpj);
                          const exists = fidc ? existingSet.has(fidc.id) : false;
                          const mode = modeByCnpj[f.cnpj] ?? (exists ? "replace" : "new_version");
                          return (
                            <tr key={f.cnpj} className="hairline-b hover:bg-surface-2/40">
                              <Td><input type="checkbox" checked={isSel} disabled={!eligible} onChange={() => toggleRow(f.cnpj)} /></Td>
                              <Td><StatusBadge status={f.status} /></Td>
                              <Td mono>{formatCNPJ(f.cnpj)}</Td>
                              <Td>
                                <div className="font-medium">{fidc?.name ?? f.name ?? <span className="text-muted-foreground italic">(fora do Cadastro Mestre)</span>}</div>
                                <div className="text-[10.5px] text-muted-foreground truncate max-w-[260px]">{f.name}</div>
                                {f.missingMetrics.length > 0 && <div className="text-[10px] text-amber-700">faltando: {f.missingMetrics.join(", ")}</div>}
                              </Td>
                              <Td>{f.hasPositionInButia ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <span className="text-muted-foreground">—</span>}</Td>
                              <Td right mono>{cell(f.pl)}</Td>
                              <Td right mono>{cell(f.creditRights)}</Td>
                              <Td right mono>{cell(f.caixaAmpliado)}</Td>
                              <Td right mono>{cell(f.pdd)}</Td>
                              <Td right mono>{cell(f.overdueTotal)}</Td>
                              <Td right mono>{cell(f.overdue30)}</Td>
                              <Td right mono>{cell(f.overdue60)}</Td>
                              <Td right mono>{cell(f.overdue90)}</Td>
                              <Td right mono>{cell(f.overdue120)}</Td>
                              <Td right mono>{cell(f.repurchase)}</Td>
                              <Td right mono>{f.investors ?? "N/D"}</Td>
                              <Td><span className="text-[11px]">{f.mainSegment ?? <span className="text-muted-foreground">—</span>}</span></Td>
                              <Td right mono>{f.mainSegmentPct != null ? PCT(f.mainSegmentPct) : "—"}</Td>
                              <Td right mono className={(f.flows?.netInvestorFlowValue ?? 0) < 0 ? "text-red-600" : ""}>{cell(f.flows?.netInvestorFlowValue ?? null)}</Td>
                              <Td right mono>{f.classes.length}</Td>
                              <Td right mono>{BRL(f.sumClassesPL, { compact: true })}</Td>
                              <Td right mono className={f.plDiffPct != null && f.plDiffPct > 0.05 ? "text-red-600" : ""}>{f.plDiffPct != null ? PCT(f.plDiffPct) : "—"}</Td>
                              <Td>{exists ? (
                                <select value={mode} onChange={(e) => setModeByCnpj({ ...modeByCnpj, [f.cnpj]: e.target.value as any })}
                                  className="bg-card border border-border rounded-sm text-[11px] px-1 py-0.5 outline-none">
                                  <option value="replace">Substituir atual</option><option value="new_version">Nova versão</option>
                                </select>
                              ) : <span className="text-muted-foreground">Inserir</span>}</Td>
                              <Td>
                                <div className="flex gap-1">
                                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => { setDrillCnpj(f.cnpj); setTab("diagnostico"); }}>
                                    <Eye className="h-3 w-3 mr-1" />Ver
                                  </Button>
                                  {exists && (
                                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => { setCompareCnpj(f.cnpj); setTab("comparar"); }}>
                                      <GitCompare className="h-3 w-3 mr-1" />Comparar
                                    </Button>
                                  )}
                                </div>
                              </Td>
                            </tr>
                          );
                        })}
                        {!diag.fidcs.length && <tr><td colSpan={21} className="py-10 text-center text-muted-foreground">Nenhum FIDC do Cadastro Mestre encontrado neste informe.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              {/* Diagnóstico por FIDC */}
              <TabsContent value="diagnostico" className="m-0">
                {drillFidc ? <FidcDiagnosticView fidc={drillFidc} masterName={cnpjToFidc.get(drillFidc.cnpj)?.name} /> : <Empty label="Selecione um FIDC na Pré-validação." />}
              </TabsContent>

              {/* Comparar Manual */}
              <TabsContent value="comparar" className="m-0">
                {compareCnpj ? <CompareTab cnpj={compareCnpj} fidcId={cnpjToFidc.get(compareCnpj)?.id} cvmRow={diag?.fidcs.find((f) => f.cnpj === compareCnpj) ?? null} referenceMonth={diag?.referenceMonth ?? month} /> : <Empty label="Escolha um FIDC para comparar." />}
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <DialogFooter className="hairline-t pt-3 gap-2">
          <div className="text-[11px] text-muted-foreground flex-1">{diag && <>Selecionados: <strong>{selected.size}</strong> · Tempo: {diag.elapsedMs}ms</>}</div>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button size="sm" onClick={runCommit} disabled={!diag || !selected.size || commit.isPending}>
            {commit.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
            Confirmar e gravar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// === Subcomponentes ===

function cell(v: number | null) {
  return v != null ? BRL(v, { compact: true }) : <span className="text-muted-foreground">N/D</span>;
}

function Empty({ label }: { label: string }) { return <div className="py-16 text-center text-muted-foreground text-[12px]">{label}</div>; }

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`hairline-b px-2 py-1.5 text-[10px] uppercase tracking-wider font-semibold whitespace-nowrap ${right ? "text-right" : "text-left"}`}>{children}</th>;
}
function Td({ children, right, mono, className = "" }: { children: React.ReactNode; right?: boolean; mono?: boolean; className?: string }) {
  return <td className={`px-2 py-1 whitespace-nowrap ${right ? "text-right" : ""} ${mono ? "font-mono" : ""} ${className}`}>{children}</td>;
}

function StatusBadge({ status }: { status: CvmFidcStatus }) {
  return <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${STATUS_CLASSES[status]}`}>{STATUS_LABELS[status]}</span>;
}

function Kpi({ label, value, accent, mono }: { label: string; value: string; accent?: "ok" | "warning"; mono?: boolean }) {
  const accentCls = accent === "ok" ? "border-emerald-500/30 bg-emerald-500/5" : accent === "warning" ? "border-amber-500/30 bg-amber-500/5" : "border-border";
  return (
    <div className={`border ${accentCls} rounded-sm p-2`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-[13px] ${mono ? "font-mono" : "font-semibold"}`}>{value}</div>
    </div>
  );
}

function DictionaryView({ dict }: { dict: CvmDictionaryResponse }) {
  return (
    <div className="space-y-3 text-[12px]">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Kpi label="URL" value="META oficial" />
        <Kpi label="Tamanho" value={`${(dict.fileSizeBytes/1024).toFixed(0)} KB`} />
        <Kpi label="Arquivos meta" value={String(dict.filesInZip.length)} />
        <Kpi label="Colunas no dicionário" value={dict.totalColumns.toLocaleString("pt-BR")} accent="ok" />
      </div>
      <div className="space-y-2">
        {dict.tables.map((t) => (
          <details key={t.table_name} className="border border-border rounded-sm">
            <summary className="cursor-pointer px-3 py-2 flex items-center justify-between">
              <span className="font-mono text-[11px]">{t.table_name}</span>
              <span className="text-[10.5px] text-muted-foreground">{t.columnCount} colunas</span>
            </summary>
            <div className="p-3 border-t border-border overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="text-muted-foreground"><tr><Th>Coluna</Th><Th>Tipo</Th><Th>Descrição</Th></tr></thead>
                <tbody>
                  {t.columns.map((c) => (
                    <tr key={c.column_name} className="hairline-b">
                      <Td mono>{c.column_name}</Td>
                      <Td>{c.expected_type ?? "—"}</Td>
                      <Td>{c.description ?? <span className="text-muted-foreground">—</span>}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function MappingTab({ mapping, onChange }: { mapping: CvmMappingRow[]; onChange: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<CvmMappingRow>>({});
  const save = async (metric: string) => {
    try { await updateCvmMapping(metric, draft); toast.success("Mapeamento atualizado"); setEditing(null); setDraft({}); onChange(); }
    catch (e: any) { toast.error(e?.message ?? "Falha"); }
  };
  return (
    <div className="overflow-x-auto border border-border rounded-sm">
      <table className="w-full text-[11.5px] border-separate border-spacing-0 min-w-[1100px]">
        <thead className="bg-surface-2 text-muted-foreground sticky top-0">
          <tr><Th>Métrica</Th><Th>Arquivo (pattern)</Th><Th>Coluna (cands separadas por |)</Th><Th>Regra composta</Th><Th>Transformação</Th><Th>Obrigatório</Th><Th>Ações</Th></tr>
        </thead>
        <tbody>
          {mapping.map((m) => {
            const isEd = editing === m.metric_name;
            const cur = isEd ? { ...m, ...draft } : m;
            return (
              <tr key={m.metric_name} className="hairline-b">
                <Td mono><Settings2 className="h-3 w-3 inline mr-1 text-muted-foreground" />{m.metric_name}</Td>
                <Td>{isEd ? <input value={cur.source_file_pattern ?? ""} onChange={(e) => setDraft({ ...draft, source_file_pattern: e.target.value })} className="bg-card border border-border rounded-sm px-1 py-0.5 text-[11px] w-full font-mono" /> : <span className="font-mono">{m.source_file_pattern}</span>}</Td>
                <Td>{isEd ? <input value={cur.source_column ?? ""} onChange={(e) => setDraft({ ...draft, source_column: e.target.value })} className="bg-card border border-border rounded-sm px-1 py-0.5 text-[11px] w-full font-mono" /> : <span className="font-mono">{m.source_column ?? "—"}</span>}</Td>
                <Td>{isEd ? <input value={cur.composite_rule ?? ""} onChange={(e) => setDraft({ ...draft, composite_rule: e.target.value })} className="bg-card border border-border rounded-sm px-1 py-0.5 text-[11px] w-full font-mono" /> : <span className="font-mono">{m.composite_rule ?? "—"}</span>}</Td>
                <Td>{isEd ? <input value={cur.transformation ?? ""} onChange={(e) => setDraft({ ...draft, transformation: e.target.value })} className="bg-card border border-border rounded-sm px-1 py-0.5 text-[11px] w-24 font-mono" /> : m.transformation ?? "—"}</Td>
                <Td>{m.is_required ? "sim" : "—"}</Td>
                <Td>
                  {isEd ? (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => save(m.metric_name)}>Salvar</Button>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => { setEditing(null); setDraft({}); }}>Cancelar</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => { setEditing(m.metric_name); setDraft({}); }}>Editar</Button>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FidcDiagnosticView({ fidc, masterName }: { fidc: CvmFidcRow; masterName?: string }) {
  return (
    <div className="space-y-4 text-[12px]">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Kpi label="CNPJ" value={formatCNPJ(fidc.cnpj)} mono />
        <Kpi label="FIDC (Mestre)" value={masterName ?? "—"} />
        <Kpi label="Nome CVM" value={fidc.name || "—"} />
        <Kpi label="Status" value={STATUS_LABELS[fidc.status]} />
      </div>

      <div>
        <div className="text-[10px] uppercase text-muted-foreground mb-1">Métricas extraídas (status por métrica)</div>
        <div className="overflow-x-auto border border-border rounded-sm">
          <table className="w-full text-[11.5px]">
            <thead className="text-muted-foreground bg-surface-2">
              <tr><Th>Métrica</Th><Th>Valor</Th><Th>Status</Th><Th>Arquivo</Th><Th>Coluna/Regra</Th><Th>Erro</Th></tr>
            </thead>
            <tbody>
              {Object.values(fidc.metrics).map((r) => (
                <tr key={r.metric} className="hairline-b">
                  <Td mono>{r.metric}</Td>
                  <Td mono>{r.value == null ? "N/D" : typeof r.value === "number" ? BRL(r.value, { compact: true }) : String(r.value)}</Td>
                  <Td><span className={`font-medium ${METRIC_STATUS_CLASSES[r.status]}`}>{METRIC_STATUS_LABELS[r.status]}</span></Td>
                  <Td><span className="font-mono text-[10.5px]">{r.sourceFile ?? "—"}</span></Td>
                  <Td><span className="font-mono text-[10.5px]">{r.sourceColumn ?? r.rule ?? "—"}</span></Td>
                  <Td><span className="text-red-600 text-[10.5px]">{r.error ?? ""}</span></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase text-muted-foreground mb-1">Linhas brutas por arquivo (amostra ≤5)</div>
        <div className="space-y-2">
          {Object.entries(fidc.rowsByFile).map(([file, rows]) => (
            <details key={file} className="border border-border rounded-sm">
              <summary className="cursor-pointer px-3 py-2 font-mono text-[11px]">{file} <span className="text-muted-foreground">({rows.length} linhas)</span></summary>
              <div className="p-2 overflow-x-auto">
                <table className="text-[10.5px] font-mono">
                  <thead className="text-muted-foreground"><tr>{Object.keys(rows[0] ?? {}).map((c) => <th key={c} className="px-2 py-1 text-left">{c}</th>)}</tr></thead>
                  <tbody>{rows.map((row, i) => <tr key={i} className="hairline-b">{Object.values(row).map((v, j) => <td key={j} className="px-2 py-1">{String(v)}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </details>
          ))}
          {Object.keys(fidc.rowsByFile).length === 0 && <div className="text-muted-foreground text-[11px]">Sem linhas capturadas — CNPJ não apareceu em nenhum arquivo do ZIP.</div>}
        </div>
      </div>

      {fidc.missingMetrics.length > 0 && (
        <div className="border border-amber-500/30 bg-amber-500/5 rounded-sm p-3 text-[11.5px] text-amber-700">
          <div className="font-semibold mb-1">Campos ausentes</div>
          <div className="font-mono">{fidc.missingMetrics.join(", ")}</div>
        </div>
      )}
    </div>
  );
}

function CompareTab({ cnpj, fidcId, cvmRow, referenceMonth }: { cnpj: string; fidcId?: string; cvmRow: CvmFidcRow | null; referenceMonth: string }) {
  const refIso = referenceMonth.length === 6 ? `${referenceMonth.slice(0,4)}-${referenceMonth.slice(4,6)}-01` : referenceMonth;
  const { data: manual } = useQuery({
    queryKey: ["cvm-compare", fidcId, refIso],
    enabled: !!fidcId,
    queryFn: async () => {
      const { data } = await supabase.from("fidc_monthly_reports").select("*").eq("fidc_id", fidcId!).eq("reference_month", refIso).maybeSingle();
      return data;
    },
  });
  if (!cvmRow) return <Empty label="Sem dados CVM." />;
  const rows = [
    ["PL", cvmRow.pl, manual?.nav_value],
    ["Direitos Creditórios", cvmRow.creditRights, manual?.credit_rights_value],
    ["Caixa Ampliado", cvmRow.caixaAmpliado, manual?.cash_value],
    ["PDD", cvmRow.pdd, manual?.pdd_value],
    ["Atraso total", cvmRow.overdueTotal, manual?.overdue_value],
    ["Inad 30d", cvmRow.overdue30, manual?.overdue_30d_value],
    ["Inad 60d", cvmRow.overdue60, manual?.overdue_60d_value],
    ["Inad 90d", cvmRow.overdue90, manual?.overdue_90d_value],
    ["Inad 120d", cvmRow.overdue120, manual?.overdue_120d_value],
    ["Recompras", cvmRow.repurchase, manual?.repurchase_value],
    ["Cotistas", cvmRow.investors, manual?.investors_count],
    ["Σ PL Cotas", cvmRow.sumClassesPL, manual?.quota_total_nav_value],
  ] as Array<[string, number | null | undefined, number | null | undefined]>;

  return (
    <div className="space-y-3 text-[12px]">
      <div className="text-muted-foreground">CNPJ {formatCNPJ(cnpj)} · ref {refIso} · {manual ? "informe manual encontrado" : "sem informe manual"}</div>
      <div className="overflow-x-auto border border-border rounded-sm">
        <table className="w-full text-[11.5px]">
          <thead className="bg-surface-2 text-muted-foreground"><tr><Th>Métrica</Th><Th right>CVM</Th><Th right>Manual</Th><Th right>Δ absoluta</Th><Th right>Δ %</Th><Th>Status</Th></tr></thead>
          <tbody>
            {rows.map(([label, cvm, man]) => {
              const c = typeof cvm === "number" ? cvm : null;
              const m = typeof man === "number" ? man : null;
              const dif = c != null && m != null ? c - m : null;
              const pct = dif != null && m ? Math.abs(dif / m) : null;
              const tag = c == null && m == null ? "—" : c == null ? "Só Manual" : m == null ? "Só CVM" : pct == null ? "—" : pct < 0.01 ? "Igual" : pct < 0.05 ? "Pequena diferença" : "Divergente";
              return (
                <tr key={label} className="hairline-b">
                  <Td>{label}</Td>
                  <Td right mono>{c != null ? (typeof c === "number" && c < 1000 && label === "Cotistas" ? String(c) : BRL(c, { compact: true })) : "N/D"}</Td>
                  <Td right mono>{m != null ? BRL(m, { compact: true }) : "N/D"}</Td>
                  <Td right mono>{dif != null ? BRL(dif, { compact: true }) : "—"}</Td>
                  <Td right mono>{pct != null ? PCT(pct) : "—"}</Td>
                  <Td><span className={pct != null && pct > 0.05 ? "text-red-600" : "text-muted-foreground"}>{tag}</span></Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
