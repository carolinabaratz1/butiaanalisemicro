import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QUOTA_CLASSES, PORTFOLIOS, POSITIONS, fidcById } from "@/lib/fidc/mock-data";
import { formatCNPJ, dateBR } from "@/lib/fidc/format";
import { PageHeader } from "@/components/fidc/PageHeader";
import {
  Lock, Upload, CheckCircle2, AlertTriangle, XCircle, FileSpreadsheet, Plus,
  ChevronRight, Loader2, History, Pencil, Trash2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  parseExcelFile, applyMapping, validateRows,
  type ParsedSheet, type ValidatedRow, type ValidationSummary, type ExistingRefs,
} from "@/lib/fidc/master-data-parser";
import { FIELDS, FIELDS_BY_KEY, type CanonicalField } from "@/lib/fidc/master-data-schema";
import {
  commitMasterDataImport, upsertFidcManual, upsertQuotaManual,
  fetchExistingRefs, listFidcsAll, listQuotasAll, deleteFidcManual, deleteQuotaManual,
} from "@/lib/fidc/master-data-api";
import { toast } from "sonner";

const TABS = ["FIDCs", "Cotas / ISINs", "Ratings", "Mapeamento de Carteiras", "Importação"] as const;
type Tab = (typeof TABS)[number];

export default function FidcCadastroPage() {
  const [tab, setTab] = useState<Tab>("FIDCs");
  return (
    <div>
      <PageHeader
        title="Cadastro Mestre de FIDCs"
        subtitle="Cruzamento entre ISIN, CNPJ, cota interna e cota CVM/Quantum"
        right={<span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><Lock className="h-3 w-3" /> Edição apenas para Gestor/Coordenação</span>}
      />
      <div className="px-6 pt-3 hairline-b flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-[12.5px] border-b-2 transition-colors whitespace-nowrap ${
              t === tab ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="px-6 py-4">
        {tab === "FIDCs" && <FidcRegistry />}
        {tab === "Cotas / ISINs" && <QuotaRegistry />}
        {tab === "Ratings" && <RatingHistoryMock />}
        {tab === "Mapeamento de Carteiras" && <MappingMock />}
        {tab === "Importação" && <ImportTab />}
      </div>
    </div>
  );
}

type FidcRow = { id: string; [k: string]: unknown };
type QuotaRow = { id: string; fidcs?: { id: string; name: string; cnpj: string } | null; [k: string]: unknown };
const v = (x: unknown): string => (x === null || x === undefined || x === "" ? "—" : String(x));

function FidcRegistry() {
  const { data: fidcs = [], isLoading } = useQuery({
    queryKey: ["fidcs-all"],
    queryFn: () => listFidcsAll(),
  });
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="text-[11.5px] text-muted-foreground">{fidcs.length} FIDCs cadastrados</div>
        <FidcFormDialog trigger={<Button size="sm" variant="outline" className="h-8 text-[12px]"><Plus className="h-3 w-3 mr-1" /> Novo FIDC</Button>} />
      </div>
      <div className="bg-card border border-border overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-surface-2 text-muted-foreground">
            <tr className="hairline-b">
              <Th>FIDC</Th><Th>CNPJ</Th><Th>Administrador</Th><Th>Gestor</Th><Th>Custodiante</Th>
              <Th>Setor</Th><Th>Estratégia</Th><Th>Tipo</Th><Th>Status</Th><Th>Início</Th><Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={11} className="px-3 py-6 text-center text-muted-foreground text-[11.5px]"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando…</td></tr>}
            {!isLoading && fidcs.length === 0 && <tr><td colSpan={11} className="px-3 py-6 text-center text-muted-foreground text-[11.5px]">Nenhum FIDC cadastrado. Importe um arquivo ou clique em "Novo FIDC".</td></tr>}
            {(fidcs as FidcRow[]).map((f) => (
              <tr key={f.id} className="hairline-b hover:bg-surface-2/40">
                <td className="px-3 py-2 font-medium">{v(f.name)}</td>
                <td className="px-3 py-2 num text-muted-foreground">{f.cnpj ? formatCNPJ(String(f.cnpj)) : "—"}</td>
                <td className="px-3 py-2">{v(f.administrator)}</td>
                <td className="px-3 py-2">{v(f.manager)}</td>
                <td className="px-3 py-2">{v(f.custodian)}</td>
                <td className="px-3 py-2">{v(f.sector)}</td>
                <td className="px-3 py-2 text-muted-foreground">{v(f.strategy)}</td>
                <td className="px-3 py-2">{v(f.fidc_type)}</td>
                <td className="px-3 py-2"><span className="text-[10.5px] uppercase tracking-wider text-risk-normal">{v(f.status)}</span></td>
                <td className="px-3 py-2 num text-muted-foreground">{f.start_date ? dateBR(String(f.start_date)) : "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <FidcFormDialog
                      initial={f}
                      trigger={<button className="p-1 hover:text-primary" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>}
                    />
                    <DeleteFidcButton id={f.id} name={String(f.name ?? "")} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeleteFidcButton({ id, name }: { id: string; name: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      await deleteFidcManual({ id });
      toast.success("FIDC removido.");
      qc.invalidateQueries({ queryKey: ["fidcs-all"] });
      qc.invalidateQueries({ queryKey: ["quotas-all"] });
    } catch (e) {
      toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
    } finally { setBusy(false); }
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className="p-1 hover:text-risk-critical" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir {name || "FIDC"}?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação remove o FIDC e, em cascata, suas cotas/ISINs, ratings, alertas, posições e pareceres vinculados. Não há como desfazer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={go} disabled={busy} className="bg-destructive hover:bg-destructive/90">
            {busy && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function QuotaRegistry() {
  const { data: quotas = [], isLoading } = useQuery({ queryKey: ["quotas-all"], queryFn: () => listQuotasAll() });
  const { data: fidcs = [] } = useQuery({ queryKey: ["fidcs-all"], queryFn: () => listFidcsAll() });
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="text-[11.5px] text-muted-foreground">{quotas.length} cotas/ISINs cadastrados</div>
        <QuotaFormDialog fidcs={fidcs as FidcRow[]} trigger={<Button size="sm" variant="outline" className="h-8 text-[12px]"><Plus className="h-3 w-3 mr-1" /> Nova cota / ISIN</Button>} />
      </div>
      <div className="bg-card border border-border overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-surface-2 text-muted-foreground">
            <tr className="hairline-b">
              <Th>FIDC</Th><Th>ISIN</Th><Th>Nome interno</Th><Th>Nome CVM/Quantum</Th>
              <Th>Classe</Th><Th>Tipo</Th><Th>Sen.</Th><Th>Benchmark</Th><Th>Spread alvo</Th><Th>Rating</Th><Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={11} className="px-3 py-6 text-center text-muted-foreground text-[11.5px]"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando…</td></tr>}
            {!isLoading && quotas.length === 0 && <tr><td colSpan={11} className="px-3 py-6 text-center text-muted-foreground text-[11.5px]">Nenhuma cota cadastrada.</td></tr>}
            {(quotas as QuotaRow[]).map((c) => (
              <tr key={c.id} className="hairline-b hover:bg-surface-2/40">
                <td className="px-3 py-2 font-medium">{v(c.fidcs?.name)}</td>
                <td className="px-3 py-2 num">{v(c.isin)}</td>
                <td className="px-3 py-2 text-muted-foreground">{v(c.internal_quota_name)}</td>
                <td className="px-3 py-2 text-muted-foreground">{v(c.cvm_quota_name)}</td>
                <td className="px-3 py-2">{v(c.class_name)}</td>
                <td className="px-3 py-2">{v(c.quota_type)}</td>
                <td className="px-3 py-2 num">{v(c.seniority_level)}</td>
                <td className="px-3 py-2">{v(c.benchmark)}</td>
                <td className="px-3 py-2 num">{v(c.target_spread)}</td>
                <td className="px-3 py-2">{v(c.current_rating)}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <QuotaFormDialog fidcs={fidcs as FidcRow[]} initial={c} trigger={<button className="p-1 hover:text-primary" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>} />
                    <DeleteQuotaButton id={c.id} isin={String(c.isin ?? "")} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeleteQuotaButton({ id, isin }: { id: string; isin: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      await deleteQuotaManual({ id });
      toast.success("Cota removida.");
      qc.invalidateQueries({ queryKey: ["quotas-all"] });
    } catch (e) {
      toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
    } finally { setBusy(false); }
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className="p-1 hover:text-risk-critical" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir cota {isin}?</AlertDialogTitle>
          <AlertDialogDescription>A cota e seus ratings/posições vinculadas serão removidos. Não há como desfazer.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={go} disabled={busy} className="bg-destructive hover:bg-destructive/90">
            {busy && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RatingHistoryMock() {
  return (
    <div className="bg-card border border-border overflow-x-auto">
      <div className="px-4 pt-3 pb-2 text-[11px] text-muted-foreground italic">
        Histórico de rating amostral — será conectado a fidc_rating_history quando houver dados.
      </div>
      <table className="w-full text-[12px]">
        <thead className="bg-surface-2 text-muted-foreground">
          <tr className="hairline-b">
            <Th>FIDC</Th><Th>Cota / ISIN</Th><Th>Agência</Th><Th>Rating</Th><Th>Perspectiva</Th><Th>Data rating</Th><Th>Relatório</Th>
          </tr>
        </thead>
        <tbody>
          {QUOTA_CLASSES.flatMap((c, i) => {
            const f = fidcById(c.fidcId)!;
            return [0, 1].map((k) => (
              <tr key={`${c.id}-${k}`} className="hairline-b hover:bg-surface-2/40">
                <td className="px-3 py-2">{f.name}</td>
                <td className="px-3 py-2"><span className="text-[11px]">{c.className}</span> <span className="text-muted-foreground num">{c.isin}</span></td>
                <td className="px-3 py-2">{f.ratingAgency}</td>
                <td className="px-3 py-2 font-semibold">{c.rating}</td>
                <td className="px-3 py-2 text-muted-foreground">{(i + k) % 4 === 0 ? "Negativa" : (i + k) % 3 === 0 ? "Positiva" : "Estável"}</td>
                <td className="px-3 py-2 num">{k === 0 ? "15/05/2025" : "12/02/2025"}</td>
                <td className="px-3 py-2 text-primary text-[11px]">relatório-{c.fidcId}-{k}.pdf</td>
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}

function MappingMock() {
  return (
    <div className="bg-card border border-border overflow-x-auto">
      <div className="px-4 pt-3 pb-2 text-[11px] text-muted-foreground italic">
        Mapeamento amostral — futuras posições em FIDC virão de posicoes filtrado por trading_desk_share_source.
      </div>
      <table className="w-full text-[12px]">
        <thead className="bg-surface-2 text-muted-foreground">
          <tr className="hairline-b">
            <Th>Carteira</Th><Th>FIDC</Th><Th>CNPJ</Th><Th>ISIN</Th><Th>Cota</Th><Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {POSITIONS.map((pos, i) => {
            const f = fidcById(pos.fidcId)!;
            const port = PORTFOLIOS.find((p) => p.id === pos.portfolioId)!;
            const c = QUOTA_CLASSES.find((q) => q.id === pos.quotaClassId)!;
            return (
              <tr key={i} className="hairline-b hover:bg-surface-2/40">
                <td className="px-3 py-2 font-medium">{port.name}</td>
                <td className="px-3 py-2">{f.name}</td>
                <td className="px-3 py-2 num text-muted-foreground">{formatCNPJ(f.cnpj)}</td>
                <td className="px-3 py-2 num">{pos.isin}</td>
                <td className="px-3 py-2">{c.className}</td>
                <td className="px-3 py-2"><span className="text-[10.5px] uppercase tracking-wider text-risk-normal">Ativa</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ========================= IMPORT TAB ========================= */
type ImportStep = "upload" | "mapping" | "validate" | "done";

function ImportTab() {
  const [step, setStep] = useState<ImportStep>("upload");
  const [parsed, setParsed] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<Record<string, CanonicalField | null>>({});
  const [validated, setValidated] = useState<{ rows: ValidatedRow[]; summary: ValidationSummary } | null>(null);
  const [refs, setRefs] = useState<ExistingRefs>({ cnpjToFidcName: new Map(), isinToCnpj: new Map() });
  const [committing, setCommitting] = useState(false);

  const loadRefs = useCallback(async () => {
    try {
      const r = await fetchExistingRefs();
      setRefs({
        cnpjToFidcName: new Map(r.fidcs.map((f) => [f.cnpj, f.name])),
        isinToCnpj: new Map(r.quotas.filter((q) => q.cnpj).map((q) => [q.isin, q.cnpj])),
      });
    } catch (e) { console.warn("refs load failed", e); }
  }, []);

  useEffect(() => { loadRefs(); }, [loadRefs]);

  async function handleFile(file: File) {
    try {
      const p = await parseExcelFile(file);
      setParsed(p);
      setMapping(p.autoMapping);
      setStep("mapping");
    } catch (e) {
      toast.error(`Falha ao ler arquivo: ${e instanceof Error ? e.message : "erro"}`);
    }
  }

  function runValidation() {
    if (!parsed) return;
    const mapped = applyMapping(parsed.rows, mapping);
    const result = validateRows(mapped, refs);
    setValidated(result);
    setStep("validate");
  }

  const qc = useQueryClient();
  const [replaceMode, setReplaceMode] = useState(true);

  async function handleCommit() {
    if (!parsed || !validated) return;
    const validOrWarn = validated.rows.filter((r) => r.status !== "error");
    if (validOrWarn.length === 0) { toast.error("Nenhuma linha válida para importar."); return; }
    setCommitting(true);
    try {
      const res = await commitMasterDataImport({
        fileName: parsed.fileName,
        replaceMode,
        rows: validOrWarn.map((r) => ({ rowNumber: r.rowNumber, data: r.data })),
        summary: {
          totalRows: validated.summary.totalRows,
          validRows: validated.summary.validRows,
          warningRows: validated.summary.warningRows,
          errorRows: validated.summary.errorRows,
        },
      });
      const delMsg = res.deletedFidcs ? ` · ${res.deletedFidcs} removidos` : "";
      toast.success(`Importação concluída · ${res.createdFidcs + res.updatedFidcs} FIDCs${delMsg} · ${res.createdQuotas + res.updatedQuotas} cotas`);
      qc.invalidateQueries({ queryKey: ["fidcs-all"] });
      qc.invalidateQueries({ queryKey: ["quotas-all"] });
      setStep("done");
    } catch (e) {
      toast.error(`Falha ao gravar: ${e instanceof Error ? e.message : "erro"}`);
    } finally {
      setCommitting(false);
    }
  }

  function reset() { setParsed(null); setMapping({}); setValidated(null); setStep("upload"); }

  return (
    <div className="space-y-4">
      <Stepper step={step} />
      {step === "upload" && <UploadStep onFile={handleFile} />}
      {step === "mapping" && parsed && (
        <MappingStep parsed={parsed} mapping={mapping} setMapping={setMapping} onBack={reset} onNext={runValidation} />
      )}
      {step === "validate" && validated && parsed && (
        <ValidateStep
          fileName={parsed.fileName} summary={validated.summary} rows={validated.rows}
          onBack={() => setStep("mapping")} onConfirm={handleCommit} committing={committing}
          replaceMode={replaceMode} setReplaceMode={setReplaceMode}
        />
      )}
      {step === "done" && (
        <div className="bg-card border border-border p-6 text-center">
          <CheckCircle2 className="h-10 w-10 text-risk-normal mx-auto mb-2" />
          <div className="text-[14px] font-semibold">Importação concluída</div>
          <div className="text-[12px] text-muted-foreground mt-1">As tabelas FIDCs, Cotas/ISINs e Rating foram atualizadas.</div>
          <Button size="sm" onClick={reset} className="mt-4">Nova importação</Button>
        </div>
      )}
    </div>
  );
}

function Stepper({ step }: { step: ImportStep }) {
  const steps: { key: ImportStep; label: string }[] = [
    { key: "upload", label: "1. Upload" },
    { key: "mapping", label: "2. Mapeamento" },
    { key: "validate", label: "3. Pré-validação" },
    { key: "done", label: "4. Concluído" },
  ];
  const idx = steps.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center gap-2 text-[11.5px] flex-wrap">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-sm border ${i <= idx ? "border-primary/40 text-foreground bg-primary/5" : "border-border text-muted-foreground"}`}>{s.label}</span>
          {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </div>
      ))}
    </div>
  );
}

function UploadStep({ onFile }: { onFile: (f: File) => void }) {
  return (
    <div className="bg-card border border-border p-6">
      <div className="text-[13px] font-semibold">Importar Cadastro Mestre</div>
      <div className="text-[11.5px] text-muted-foreground mt-1">
        Envie a planilha Excel com os dados cadastrais de FIDCs, classes e ISINs. Aceita variações de cabeçalho.
      </div>
      <label className="mt-4 block border border-dashed border-border rounded-sm p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-surface-2/30 transition-colors">
        <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
        <div className="text-[13px] font-medium">Arraste o arquivo ou clique para selecionar</div>
        <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 justify-center">
          <FileSpreadsheet className="h-3 w-3" /> .xlsx · .xls
        </div>
        <input type="file" accept=".xlsx,.xls" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      </label>
    </div>
  );
}

function MappingStep({ parsed, mapping, setMapping, onBack, onNext }: {
  parsed: ParsedSheet; mapping: Record<string, CanonicalField | null>;
  setMapping: (m: Record<string, CanonicalField | null>) => void;
  onBack: () => void; onNext: () => void;
}) {
  const required: CanonicalField[] = ["fidc_name", "cnpj", "isin"];
  const mappedFields = new Set(Object.values(mapping).filter(Boolean) as CanonicalField[]);
  const missingRequired = required.filter((r) => !mappedFields.has(r));

  return (
    <div className="bg-card border border-border">
      <div className="px-4 py-3 hairline-b flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[13px] font-semibold">Mapeamento de colunas</div>
          <div className="text-[11.5px] text-muted-foreground mt-0.5">
            {parsed.fileName} · {parsed.rows.length} linhas · {parsed.headers.length} colunas detectadas
          </div>
        </div>
        {missingRequired.length > 0 && (
          <span className="text-[11px] text-risk-critical bg-risk-critical-bg px-2 py-1 rounded-sm">
            Campos obrigatórios faltando: {missingRequired.map((k) => FIELDS_BY_KEY[k].label).join(", ")}
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-surface-2 text-muted-foreground">
            <tr className="hairline-b">
              <Th>Coluna do Excel</Th><Th>Campo no sistema</Th><Th>Amostra (linha 1)</Th>
            </tr>
          </thead>
          <tbody>
            {parsed.headers.map((h) => (
              <tr key={h} className="hairline-b">
                <td className="px-3 py-2 font-mono text-[11.5px]">{h}</td>
                <td className="px-3 py-2">
                  <select
                    className="bg-surface-2 border border-border rounded-sm px-2 py-1 text-[12px] w-full max-w-[260px]"
                    value={mapping[h] ?? ""}
                    onChange={(e) => setMapping({ ...mapping, [h]: (e.target.value || null) as CanonicalField | null })}
                  >
                    <option value="">— Ignorar —</option>
                    {FIELDS.map((f) => (
                      <option key={f.key} value={f.key}>{f.label}{f.required ? " *" : ""}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-muted-foreground text-[11.5px]">
                  {String((parsed.rows[0] as Record<string, unknown>)?.[h] ?? "—")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 hairline-t flex justify-between">
        <Button size="sm" variant="outline" onClick={onBack}>Voltar</Button>
        <Button size="sm" onClick={onNext} disabled={missingRequired.length > 0}>
          Validar dados <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function ValidateStep({ fileName, summary, rows, onBack, onConfirm, committing, replaceMode, setReplaceMode }: {
  fileName: string; summary: ValidationSummary; rows: ValidatedRow[];
  onBack: () => void; onConfirm: () => void; committing: boolean;
  replaceMode: boolean; setReplaceMode: (v: boolean) => void;
}) {
  const [filter, setFilter] = useState<"all" | "error" | "warning" | "valid">("all");
  const filtered = useMemo(() => filter === "all" ? rows : rows.filter((r) => r.status === filter), [filter, rows]);
  const canConfirm = summary.validRows + summary.warningRows > 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total de linhas" value={summary.totalRows} />
        <StatCard label="Linhas válidas" value={summary.validRows} tone="ok" />
        <StatCard label="Com alerta" value={summary.warningRows} tone="warn" />
        <StatCard label="Com erro" value={summary.errorRows} tone="err" />
        <StatCard label="FIDCs únicos" value={summary.uniqueFidcs} />
        <StatCard label="CNPJs únicos" value={summary.uniqueCnpjs} />
        <StatCard label="ISINs únicos" value={summary.uniqueIsins} />
        <StatCard label="Arquivo" value={fileName} small />
        <StatCard label="FIDCs a criar" value={summary.toCreateFidcs} tone="ok" />
        <StatCard label="FIDCs a atualizar" value={summary.toUpdateFidcs} />
        <StatCard label="Cotas a criar" value={summary.toCreateQuotas} tone="ok" />
        <StatCard label="Cotas a atualizar" value={summary.toUpdateQuotas} />
      </div>

      <div className="bg-card border border-border">
        <div className="px-4 py-3 hairline-b flex items-center justify-between flex-wrap gap-2">
          <div className="text-[13px] font-semibold">Pré-validação por linha</div>
          <div className="flex gap-1 flex-wrap">
            {(["all", "error", "warning", "valid"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-1 text-[11px] rounded-sm border ${filter === f ? "border-primary/40 bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                {f === "all" ? "Todas" : f === "error" ? `Erros (${summary.errorRows})` : f === "warning" ? `Alertas (${summary.warningRows})` : `Válidas (${summary.validRows})`}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-surface-2 text-muted-foreground sticky top-0">
              <tr className="hairline-b">
                <Th>Status</Th><Th>Linha</Th><Th>FIDC</Th><Th>CNPJ</Th><Th>ISIN</Th>
                <Th>Classe/Série</Th><Th>Adm</Th><Th>Gestor</Th><Th>Custodiante</Th><Th>Rating</Th>
                <Th>Erro / Alerta</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 500).map((r) => (
                <tr key={r.rowNumber} className="hairline-b hover:bg-surface-2/40">
                  <td className="px-3 py-1.5"><StatusChip status={r.status} /></td>
                  <td className="px-3 py-1.5 num">{r.rowNumber}</td>
                  <td className="px-3 py-1.5">{r.data.fidc_name ?? "—"}</td>
                  <td className="px-3 py-1.5 num text-muted-foreground">{r.data.cnpj ? formatCNPJ(r.data.cnpj) : "—"}</td>
                  <td className="px-3 py-1.5 num">{r.data.isin ?? "—"}</td>
                  <td className="px-3 py-1.5">{[r.data.class_name, r.data.series_name].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{r.data.administrator ?? "—"}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{r.data.manager ?? "—"}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{r.data.custodian ?? "—"}</td>
                  <td className="px-3 py-1.5">{r.data.current_rating ?? "—"}</td>
                  <td className="px-3 py-1.5 text-[11px]">
                    {r.errors.map((e) => <div key={e} className="text-risk-critical">{e}</div>)}
                    {r.warnings.map((w) => <div key={w} className="text-risk-warning">{w}</div>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 500 && (
            <div className="px-3 py-2 text-[11px] text-muted-foreground">Exibindo primeiras 500 linhas. Total: {filtered.length}.</div>
          )}
        </div>
        <div className="px-4 py-3 hairline-t flex items-center justify-between gap-3 flex-wrap">
          <Button size="sm" variant="outline" onClick={onBack} disabled={committing}>Voltar</Button>
          <label className="flex items-start gap-2 text-[11.5px] cursor-pointer max-w-[420px]">
            <Checkbox checked={replaceMode} onCheckedChange={(v) => setReplaceMode(v === true)} disabled={committing} className="mt-0.5" />
            <span>
              <span className="font-medium">Substituir base atual</span>
              <span className="block text-muted-foreground text-[11px]">
                Remove FIDCs que não estão neste arquivo. Use sempre que esta planilha for a lista oficial completa de FIDCs do monitor.
              </span>
            </span>
          </label>
          <div className="flex items-center gap-3">
            {summary.errorRows > 0 && (
              <span className="text-[11px] text-risk-warning">
                Linhas com erro serão ignoradas. {summary.validRows + summary.warningRows} linhas serão importadas.
              </span>
            )}
            <Button size="sm" onClick={onConfirm} disabled={!canConfirm || committing}>
              {committing && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Confirmar importação
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone, small }: { label: string; value: string | number; tone?: "ok" | "warn" | "err"; small?: boolean }) {
  const color = tone === "ok" ? "text-risk-normal" : tone === "warn" ? "text-risk-warning" : tone === "err" ? "text-risk-critical" : "text-foreground";
  return (
    <div className="bg-card border border-border px-3 py-2">
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 ${small ? "text-[12px] truncate" : "text-[18px] font-semibold"} num ${color}`}>{value}</div>
    </div>
  );
}

function StatusChip({ status }: { status: ValidatedRow["status"] }) {
  if (status === "valid") return <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-sm text-risk-normal bg-risk-normal-bg"><CheckCircle2 className="h-3 w-3" /> Válido</span>;
  if (status === "warning") return <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-sm text-risk-warning bg-risk-warning-bg"><AlertTriangle className="h-3 w-3" /> Alerta</span>;
  return <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-sm text-risk-critical bg-risk-critical-bg"><XCircle className="h-3 w-3" /> Erro</span>;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-medium px-3 py-2 text-[10.5px] uppercase tracking-wider whitespace-nowrap">{children}</th>;
}

/* ========================= MANUAL FORM DIALOGS ========================= */
const FIDC_FORM_FIELDS: Array<{ key: string; label: string; textarea?: boolean }> = [
  { key: "name", label: "Nome do FIDC" },
  { key: "legal_name", label: "Razão social" },
  { key: "cnpj", label: "CNPJ" },
  { key: "administrator", label: "Administrador" },
  { key: "manager", label: "Gestor" },
  { key: "custodian", label: "Custodiante" },
  { key: "sector", label: "Setor" },
  { key: "strategy", label: "Estratégia" },
  { key: "fidc_type", label: "Tipo de FIDC" },
  { key: "condominium_type", label: "Condomínio" },
  { key: "main_originator", label: "Originador principal" },
  { key: "main_assignor", label: "Cedente principal" },
  { key: "status", label: "Status" },
  { key: "notes", label: "Observações", textarea: true },
];

function FidcFormDialog({ trigger, initial }: { trigger: React.ReactNode; initial?: FidcRow }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(() => buildInitial(initial));
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  function buildInitial(src?: FidcRow): Record<string, string> {
    const out: Record<string, string> = {};
    for (const f of FIDC_FORM_FIELDS) out[f.key] = src ? String(src[f.key] ?? "") : "";
    return out;
  }

  useEffect(() => { if (open) setForm(buildInitial(initial)); }, [open, initial]);

  async function submit() {
    setBusy(true);
    try {
      const row: Record<string, string | null> = {};
      for (const f of FIDC_FORM_FIELDS) row[f.key] = form[f.key].trim() === "" ? null : form[f.key].trim();
      await upsertFidcManual({ id: initial?.id, row });
      toast.success(initial ? "FIDC atualizado." : "FIDC criado.");
      qc.invalidateQueries({ queryKey: ["fidcs-all"] });
      qc.invalidateQueries({ queryKey: ["quotas-all"] });
      setOpen(false);
    } catch (e) {
      toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{initial ? "Editar FIDC" : "Novo FIDC"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
          {FIDC_FORM_FIELDS.map((f) => (
            <div key={f.key} className={f.textarea ? "sm:col-span-2" : ""}>
              <Label className="text-[11px] text-muted-foreground">{f.label}</Label>
              {f.textarea
                ? <Textarea rows={2} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                : <Input value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const QUOTA_FORM_FIELDS: Array<{ key: string; label: string }> = [
  { key: "isin", label: "ISIN" },
  { key: "internal_quota_name", label: "Nome interno" },
  { key: "cvm_quota_name", label: "Nome CVM/Quantum" },
  { key: "class_name", label: "Classe" },
  { key: "series_name", label: "Série" },
  { key: "quota_type", label: "Tipo" },
  { key: "seniority_level", label: "Senioridade" },
  { key: "benchmark", label: "Benchmark" },
  { key: "target_spread", label: "Spread alvo" },
  { key: "current_rating", label: "Rating" },
  { key: "current_rating_agency", label: "Agência" },
  { key: "current_rating_date", label: "Data rating (AAAA-MM-DD)" },
];

function QuotaFormDialog({ trigger, initial, fidcs }: { trigger: React.ReactNode; initial?: QuotaRow; fidcs: FidcRow[] }) {
  const [open, setOpen] = useState(false);
  const [fidcId, setFidcId] = useState<string>(() => (initial?.fidc_id as string) ?? (fidcs[0]?.id ?? ""));
  const [form, setForm] = useState<Record<string, string>>(() => buildInitial(initial));
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  function buildInitial(src?: QuotaRow): Record<string, string> {
    const out: Record<string, string> = {};
    for (const f of QUOTA_FORM_FIELDS) out[f.key] = src ? String(src[f.key] ?? "") : "";
    return out;
  }
  useEffect(() => {
    if (open) {
      setForm(buildInitial(initial));
      setFidcId((initial?.fidc_id as string) ?? fidcs[0]?.id ?? "");
    }
  }, [open, initial, fidcs]);

  async function submit() {
    if (!fidcId) { toast.error("Selecione um FIDC"); return; }
    setBusy(true);
    try {
      const row: Record<string, string | number | null> = { fidc_id: fidcId };
      for (const f of QUOTA_FORM_FIELDS) {
        const val = form[f.key].trim();
        if (val === "") { row[f.key] = null; continue; }
        if (f.key === "seniority_level") row[f.key] = parseInt(val, 10) || null;
        else row[f.key] = val;
      }
      await upsertQuotaManual({ id: initial?.id, row });
      toast.success(initial ? "Cota atualizada." : "Cota criada.");
      qc.invalidateQueries({ queryKey: ["quotas-all"] });
      setOpen(false);
    } catch (e) {
      toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{initial ? "Editar cota" : "Nova cota / ISIN"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
          <div className="sm:col-span-2">
            <Label className="text-[11px] text-muted-foreground">FIDC</Label>
            <select
              className="w-full bg-card border border-border rounded-sm px-2 py-1.5 text-[13px]"
              value={fidcId}
              onChange={(e) => setFidcId(e.target.value)}
            >
              {fidcs.map((f) => <option key={f.id} value={f.id}>{String(f.name ?? "")}</option>)}
            </select>
          </div>
          {QUOTA_FORM_FIELDS.map((f) => (
            <div key={f.key}>
              <Label className="text-[11px] text-muted-foreground">{f.label}</Label>
              <Input value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
