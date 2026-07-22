import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, ExternalLink, History, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useResolvedRating } from "@/lib/ratings/useResolvedRating";
import { RatingBadge } from "@/components/ratings/RatingBadge";
import { IssuerRatingTimelineChart, type TimelinePoint } from "@/components/ratings/IssuerRatingTimelineChart";
import { safeHref } from "@/lib/safeHref";
import { toast } from "sonner";
import type { IssuerOption } from "./IssuerRatingSelector";

const AGENCIAS = ["S&P Global", "Fitch", "Moody's", "Liberum", "Austin", "SR Rating", "Interno", "Outra"];
const OUTLOOKS = ["Positivo", "Estável", "Negativo", "Em revisão"];

function fmtBR(iso?: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

interface Props {
  issuer: IssuerOption;
}

export function IssuerRatingTimelinePanel({ issuer }: Props) {
  const { currentUser } = useAuth();
  const qc = useQueryClient();
  const canEdit = currentUser?.funcao === "Gestor" || currentUser?.funcao === "Coordenação/Especialista";

  const cnpj = issuer.cnpj;

  // Rating resolvido corrente
  const resolved = useResolvedRating(cnpj);

  // Histórico do emissor
  const historyQuery = useQuery({
    queryKey: ["issuer_ratings", cnpj],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issuer_ratings")
        .select("id, rating, rating_agency, data_rating, outlook, observacao, report_url, created_at")
        .eq("cnpj", cnpj)
        .order("data_rating", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Rating do grupo econômico (moda conservadora — usa a view)
  const grupoQuery = useQuery({
    queryKey: ["grupoRating", issuer.grupo_economico ?? "", cnpj],
    enabled: Boolean(issuer.grupo_economico),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_empresa_rating_resolved" as any)
        .select("rating, source_level")
        .eq("cnpj", cnpj)
        .maybeSingle();
      if (error) throw error;
      const row = data as any;
      if (row?.source_level === "grupo") return row.rating as string | null;
      // buscar grupo diretamente
      const { data: peers, error: e2 } = await supabase
        .from("empresas")
        .select("cnpj")
        .eq("grupo_economico", issuer.grupo_economico!)
        .neq("cnpj", cnpj);
      if (e2) throw e2;
      const cnpjs = (peers ?? []).map((p: any) => (p.cnpj ?? "").replace(/[^0-9]/g, "")).filter((c: string) => c);
      if (cnpjs.length === 0) return null;
      const { data: gr, error: e3 } = await supabase
        .from("v_empresa_rating_resolved" as any)
        .select("rating")
        .in("cnpj", cnpjs)
        .not("rating", "is", null);
      if (e3) throw e3;
      const counts = new Map<string, number>();
      for (const r of (gr ?? []) as any[]) {
        if (r.rating) counts.set(r.rating, (counts.get(r.rating) ?? 0) + 1);
      }
      let top: string | null = null;
      let topN = 0;
      for (const [k, v] of counts) if (v > topN) { top = k; topN = v; }
      return top;
    },
  });

  const timelinePoints: TimelinePoint[] = useMemo(() => {
    const rows = (historyQuery.data ?? []).slice().reverse(); // ascendente
    const grupo = grupoQuery.data ?? null;
    return rows
      .filter((r: any) => r.data_rating)
      .map((r: any) => ({
        data: r.data_rating,
        ratingEmissor: r.rating,
        ratingGrupo: grupo,
      }));
  }, [historyQuery.data, grupoQuery.data]);

  const historyDesc = historyQuery.data ?? [];
  const latestExisting = useMemo(() => {
    const withDate = historyDesc.filter((r: any) => r.data_rating);
    if (withDate.length === 0) return null;
    return withDate[0].data_rating as string;
  }, [historyDesc]);

  // Formulário
  const [showForm, setShowForm] = useState(false);
  const [fRating, setFRating] = useState("");
  const [fAgencia, setFAgencia] = useState("");
  const [fData, setFData] = useState("");
  const [fOutlook, setFOutlook] = useState("");
  const [fObs, setFObs] = useState("");
  const [fUrl, setFUrl] = useState("");
  const [confirmRetro, setConfirmRetro] = useState(false);

  function resetForm() {
    setFRating(""); setFAgencia(""); setFData(""); setFOutlook(""); setFObs(""); setFUrl("");
    setShowForm(false);
  }

  const insertMutation = useMutation({
    mutationFn: async () => {
      if (!fRating.trim()) throw new Error("Informe o rating");
      const payload = {
        cnpj,
        rating: fRating.trim(),
        rating_agency: fAgencia || null,
        data_rating: fData || null,
        outlook: fOutlook || null,
        observacao: fObs.trim() || null,
        report_url: fUrl.trim() || null,
        created_by: currentUser?.id ?? null,
      };
      const { error } = await supabase.from("issuer_ratings").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rating registrado");
      qc.invalidateQueries({ queryKey: ["issuer_ratings", cnpj] });
      qc.invalidateQueries({ queryKey: ["resolvedRating"] });
      qc.invalidateQueries({ queryKey: ["ratingDistribution"] });
      qc.invalidateQueries({ queryKey: ["grupoRating"] });
      qc.invalidateQueries({ queryKey: ["empresas"] });
      resetForm();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao registrar rating"),
  });

  function handleSave() {
    if (!fRating.trim()) {
      toast.error("Informe o rating");
      return;
    }
    if (fData && latestExisting && fData < latestExisting) {
      setConfirmRetro(true);
      return;
    }
    insertMutation.mutate();
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho do emissor */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="truncate">{issuer.nome}</div>
              <div className="text-[10px] text-muted-foreground font-mono font-normal">
                {issuer.cnpj}
                {issuer.grupo_economico ? ` · ${issuer.grupo_economico}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Rating atual:</span>
              <RatingBadge
                rating={resolved.data?.rating}
                source={resolved.data?.source}
                agencia={resolved.data?.agencia}
                data={resolved.data?.data_rating}
                loading={resolved.isLoading}
              />
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Gráfico */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" /> Evolução do rating
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historyQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico…
            </div>
          ) : (
            <>
              <IssuerRatingTimelineChart
                points={timelinePoints}
                hasGrupo={Boolean(grupoQuery.data)}
              />
              <p className="text-[11px] text-muted-foreground mt-2">
                Linha sólida: rating do próprio emissor.
                {grupoQuery.data ? " Linha tracejada: rating agregado do grupo econômico (modal)." : ""}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Formulário de inserção */}
      {canEdit && (
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Pencil className="h-4 w-4" /> Registrar atualização de rating
            </CardTitle>
            {!showForm && (
              <Button size="sm" onClick={() => setShowForm(true)} className="gap-1">
                <Plus className="h-3 w-3" /> Novo registro
              </Button>
            )}
          </CardHeader>
          {showForm && (
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Rating *</Label>
                  <Input value={fRating} onChange={(e) => setFRating(e.target.value)} placeholder="ex.: brAAA" className="h-9" />
                </div>
                <div>
                  <Label className="text-xs">Agência</Label>
                  <Select value={fAgencia} onValueChange={setFAgencia}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {AGENCIAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Data de referência</Label>
                  <Input type="date" value={fData} onChange={(e) => setFData(e.target.value)} className="h-9" />
                  {latestExisting && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Último registro: {fmtBR(latestExisting)}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Outlook</Label>
                  <Select value={fOutlook} onValueChange={setFOutlook}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {OUTLOOKS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">URL do laudo</Label>
                  <Input value={fUrl} onChange={(e) => setFUrl(e.target.value)} placeholder="https://…" className="h-9" />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Observação (opcional)</Label>
                  <Textarea value={fObs} onChange={(e) => setFObs(e.target.value)} rows={2} placeholder="Contexto, fonte, comentário livre…" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={resetForm}>Cancelar</Button>
                <Button size="sm" onClick={handleSave} disabled={insertMutation.isPending}>
                  {insertMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Salvar
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Histórico completo (observação oculta) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Histórico completo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px]">Data</TableHead>
                  <TableHead className="text-[11px]">Rating</TableHead>
                  <TableHead className="text-[11px]">Agência</TableHead>
                  <TableHead className="text-[11px]">Outlook</TableHead>
                  <TableHead className="text-[11px]">Laudo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyQuery.isLoading && (
                  <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-4">Carregando…</TableCell></TableRow>
                )}
                {!historyQuery.isLoading && historyDesc.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-4">Sem ratings registrados.</TableCell></TableRow>
                )}
                {historyDesc.map((r: any, idx: number) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">
                      {fmtBR(r.data_rating)}
                      {idx === 0 && r.data_rating && (
                        <Badge variant="outline" className="ml-2 text-[9px] bg-primary/10 text-primary border-primary/30">atual</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono font-semibold">{r.rating}</TableCell>
                    <TableCell className="text-xs">{r.rating_agency || "—"}</TableCell>
                    <TableCell className="text-xs">{r.outlook || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {r.report_url ? (
                        <a href={safeHref(r.report_url) || "#"} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmRetro} onOpenChange={setConfirmRetro}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar rating retroativo?</AlertDialogTitle>
            <AlertDialogDescription>
              A data informada ({fmtBR(fData)}) é anterior ao último registro existente ({fmtBR(latestExisting)}).
              Isso <strong>não</strong> altera o rating atual apresentado no app (que continua sendo o mais recente por data),
              mas ficará no histórico como correção retroativa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmRetro(false); insertMutation.mutate(); }}>
              Registrar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
