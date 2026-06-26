import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// safeHref imported from lib
import { format } from "date-fns";
import { Plus, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { safeHref } from "@/integrations/supabase/safeHref";

interface IssuerRatingHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cnpj: string;
  emissorNome?: string;
}

const AGENCIAS = ["S&P Global", "Fitch", "Moody's", "Liberum", "Austin", "SR Rating", "Interno", "Outra"];
const OUTLOOKS = ["Positivo", "Estável", "Negativo", "Em revisão"];

function formatDateBR(iso?: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function IssuerRatingHistoryDialog({ open, onOpenChange, cnpj, emissorNome }: IssuerRatingHistoryDialogProps) {
  const { currentUser } = useAuth();
  const qc = useQueryClient();
  const canEdit = currentUser?.funcao === "Gestor" || currentUser?.funcao === "Coordenação/Especialista";

  const normCnpj = (cnpj || "").replace(/[^0-9]/g, "");

  const [showForm, setShowForm] = useState(false);
  const [fRating, setFRating] = useState("");
  const [fAgencia, setFAgencia] = useState<string>("");
  const [fData, setFData] = useState<string>("");
  const [fOutlook, setFOutlook] = useState<string>("");
  const [fObs, setFObs] = useState("");
  const [fUrl, setFUrl] = useState("");

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["issuer_ratings", normCnpj],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issuer_ratings")
        .select("*")
        .eq("cnpj", normCnpj)
        .order("data_rating", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && Boolean(normCnpj),
  });

  const insertMutation = useMutation({
    mutationFn: async () => {
      if (!fRating.trim()) throw new Error("Informe o rating");
      const payload = {
        cnpj: normCnpj,
        rating: fRating.trim(),
        agencia: fAgencia || null,
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
      qc.invalidateQueries({ queryKey: ["issuer_ratings", normCnpj] });
      qc.invalidateQueries({ queryKey: ["resolvedRating"] });
      qc.invalidateQueries({ queryKey: ["empresas"] });
      setShowForm(false);
      setFRating(""); setFAgencia(""); setFData(""); setFOutlook(""); setFObs(""); setFUrl("");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao registrar rating"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("issuer_ratings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro removido");
      qc.invalidateQueries({ queryKey: ["issuer_ratings", normCnpj] });
      qc.invalidateQueries({ queryKey: ["resolvedRating"] });
      qc.invalidateQueries({ queryKey: ["empresas"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Histórico de Rating — {emissorNome ?? cnpj}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {canEdit && !showForm && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setShowForm(true)} className="gap-1">
                <Plus className="h-3 w-3" /> Adicionar rating
              </Button>
            </div>
          )}

          {showForm && (
            <div className="rounded-md border border-border p-3 space-y-3 bg-muted/30">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Rating *</Label>
                  <Input value={fRating} onChange={(e) => setFRating(e.target.value)} placeholder="ex.: brAAA" className="h-8" />
                </div>
                <div>
                  <Label className="text-xs">Agência</Label>
                  <Select value={fAgencia} onValueChange={setFAgencia}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {AGENCIAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Data do rating</Label>
                  <Input type="date" value={fData} onChange={(e) => setFData(e.target.value)} className="h-8" />
                </div>
                <div>
                  <Label className="text-xs">Outlook</Label>
                  <Select value={fOutlook} onValueChange={setFOutlook}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {OUTLOOKS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">URL do laudo</Label>
                  <Input value={fUrl} onChange={(e) => setFUrl(e.target.value)} placeholder="https://…" className="h-8" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Observação</Label>
                  <Textarea value={fObs} onChange={(e) => setFObs(e.target.value)} rows={2} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button size="sm" onClick={() => insertMutation.mutate()} disabled={insertMutation.isPending}>
                  {insertMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Salvar
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-md border border-border max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px]">Data</TableHead>
                  <TableHead className="text-[11px]">Rating</TableHead>
                  <TableHead className="text-[11px]">Agência</TableHead>
                  <TableHead className="text-[11px]">Outlook</TableHead>
                  <TableHead className="text-[11px]">Observação</TableHead>
                  <TableHead className="text-[11px]">Laudo</TableHead>
                  {canEdit && <TableHead className="text-[11px] w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-4">Carregando…</TableCell></TableRow>
                )}
                {!isLoading && history.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-4">Sem ratings registrados.</TableCell></TableRow>
                )}
                {history.map((r: any, idx: number) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">
                      {formatDateBR(r.data_rating)}
                      {idx === 0 && <Badge variant="outline" className="ml-2 text-[9px] bg-primary/10 text-primary border-primary/30">atual</Badge>}
                    </TableCell>
                    <TableCell className="text-xs font-mono font-semibold">{r.rating}</TableCell>
                    <TableCell className="text-xs">{r.agencia || "—"}</TableCell>
                    <TableCell className="text-xs">{r.outlook || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate" title={r.observacao || ""}>{r.observacao || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {r.report_url ? (
                        <a href={safeHref(r.report_url) || "#"} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : "—"}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteMutation.mutate(r.id)} disabled={deleteMutation.isPending}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
