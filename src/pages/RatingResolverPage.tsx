import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Download, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type SourceLevel = "fidc_class" | "emission" | "issuer" | "nr";

interface ResolvedV2 {
  rating_value: string | null;
  source_level: SourceLevel;
  rating_date: string | null;
  rating_id: string | null;
  source: string | null;
}

const cnpjSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[^0-9]/g, ""))
  .refine((v) => v.length === 14, { message: "CNPJ deve ter 14 dígitos" });

const isinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((v) => v === "" || /^[A-Z0-9]{12}$/.test(v), { message: "ISIN deve ter 12 caracteres alfanuméricos" });

const classSchema = z.string().trim().max(50, { message: "Máx. 50 caracteres" });

const sourceMeta: Record<SourceLevel, { label: string; className: string }> = {
  fidc_class: { label: "Série FIDC (ISIN + Classe)", className: "bg-primary/15 text-primary border-primary/40" },
  emission: { label: "Emissão (ISIN)", className: "bg-blue-500/15 text-blue-600 border-blue-500/40 dark:text-blue-400" },
  issuer: { label: "Emissor (CNPJ)", className: "bg-secondary text-secondary-foreground border-border" },
  nr: { label: "Sem rating cadastrado", className: "bg-muted text-muted-foreground border-border" },
};

function formatBR(iso?: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export default function RatingResolverPage() {
  const [cnpj, setCnpj] = useState("");
  const [isin, setIsin] = useState("");
  const [classCode, setClassCode] = useState("");
  const [submitted, setSubmitted] = useState<{ cnpj: string; isin: string; classCode: string } | null>(null);
  const [errors, setErrors] = useState<{ cnpj?: string; isin?: string; classCode?: string }>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cRes = cnpjSchema.safeParse(cnpj);
    const iRes = isinSchema.safeParse(isin);
    const kRes = classSchema.safeParse(classCode);
    const errs: typeof errors = {};
    if (!cRes.success) errs.cnpj = cRes.error.issues[0]?.message;
    if (!iRes.success) errs.isin = iRes.error.issues[0]?.message;
    if (!kRes.success) errs.classCode = kRes.error.issues[0]?.message;
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSubmitted({
      cnpj: cRes.data!,
      isin: iRes.data!,
      classCode: kRes.data!,
    });
  }

  const resolvedQuery = useQuery({
    queryKey: ["resolvedRatingV2", submitted?.cnpj, submitted?.isin, submitted?.classCode],
    enabled: !!submitted,
    queryFn: async (): Promise<ResolvedV2> => {
      const { data, error } = await (supabase as any).rpc("get_resolved_rating_v2", {
        p_cnpj: submitted!.cnpj,
        p_isin: submitted!.isin || null,
        p_class_code: submitted!.classCode || null,
      });
      if (error) throw error;
      const row = (data as any[])?.[0];
      if (!row) return { rating_value: null, source_level: "nr", rating_date: null, rating_id: null, source: null };
      return row as ResolvedV2;
    },
  });

  const resolved = resolvedQuery.data;
  const level: SourceLevel = resolved?.source_level ?? "nr";

  const historyQuery = useQuery({
    queryKey: ["ratingHistoryV2", submitted?.cnpj, submitted?.isin, submitted?.classCode, level],
    enabled: !!submitted && !!resolved && level !== "nr",
    queryFn: async () => {
      if (level === "fidc_class") {
        const { data, error } = await supabase
          .from("rating_fidc_class_history" as any)
          .select("id, rating_value, rating_date, source, outlook, created_at")
          .eq("isin", submitted!.isin)
          .eq("class_code", submitted!.classCode)
          .order("rating_date", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(5);
        if (error) throw error;
        return data ?? [];
      }
      if (level === "emission") {
        const { data, error } = await supabase
          .from("rating_emission_history" as any)
          .select("id, rating_value, rating_date, source, outlook, created_at")
          .eq("isin", submitted!.isin)
          .order("rating_date", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(5);
        if (error) throw error;
        return data ?? [];
      }
      const { data, error } = await supabase
        .from("rating_issuer_history" as any)
        .select("id, rating_value, rating_date, source, outlook, created_at")
        .eq("cnpj", submitted!.cnpj)
        .order("rating_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  function exportJSON() {
    if (!resolved || !submitted) return;
    const payload = {
      input: submitted,
      resolved,
      history: historyQuery.data ?? [],
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rating-${submitted.cnpj}-${submitted.isin || "noisin"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("JSON exportado");
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Rating Resolver</h1>
        <p className="text-sm text-muted-foreground">
          Consulta o rating mais específico disponível por CNPJ, ISIN e Classe (FIDC), com precedência automática.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Consulta</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="md:col-span-2">
              <Label className="text-xs">CNPJ *</Label>
              <Input
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="00.000.000/0000-00"
                maxLength={18}
                className="h-9"
              />
              {errors.cnpj && <p className="text-xs text-destructive mt-1">{errors.cnpj}</p>}
            </div>
            <div>
              <Label className="text-xs">ISIN</Label>
              <Input
                value={isin}
                onChange={(e) => setIsin(e.target.value.toUpperCase())}
                placeholder="BRXXXXDEB000"
                maxLength={12}
                className="h-9 font-mono"
              />
              {errors.isin && <p className="text-xs text-destructive mt-1">{errors.isin}</p>}
            </div>
            <div>
              <Label className="text-xs">Classe (FIDC)</Label>
              <Input
                value={classCode}
                onChange={(e) => setClassCode(e.target.value)}
                placeholder="Sênior, Sub A…"
                maxLength={50}
                className="h-9"
              />
              {errors.classCode && <p className="text-xs text-destructive mt-1">{errors.classCode}</p>}
            </div>
            <div className="md:col-span-4 flex justify-end">
              <Button type="submit" size="sm" className="gap-2">
                <Search className="h-4 w-4" /> Resolver rating
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {submitted && (
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Resultado</CardTitle>
            {resolved && level !== "nr" && (
              <Button variant="outline" size="sm" onClick={exportJSON} className="gap-1">
                <Download className="h-3 w-3" /> Exportar JSON
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {resolvedQuery.isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Consultando…
              </div>
            )}
            {resolvedQuery.isError && (
              <p className="text-sm text-destructive">
                Erro ao consultar: {(resolvedQuery.error as any)?.message ?? "desconhecido"}
              </p>
            )}
            {resolved && !resolvedQuery.isLoading && (
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex-1">
                  <div className="text-5xl font-mono font-bold tracking-tight">
                    {resolved.rating_value ?? "N/R"}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={sourceMeta[level].className}>
                      {sourceMeta[level].label}
                    </Badge>
                    {resolved.source && (
                      <Badge variant="outline" className="text-xs">
                        {resolved.source}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Data: {formatBR(resolved.rating_date)}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground md:max-w-xs">
                  Precedência: Classe FIDC (ISIN + Classe) → Emissão (ISIN) → Emissor (CNPJ). A resposta
                  vem do nível mais específico com registro disponível.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {submitted && resolved && level !== "nr" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Histórico (últimas 5 no nível “{sourceMeta[level].label}”)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px]">Data</TableHead>
                    <TableHead className="text-[11px]">Rating</TableHead>
                    <TableHead className="text-[11px]">Agência</TableHead>
                    <TableHead className="text-[11px]">Outlook</TableHead>
                    <TableHead className="text-[11px]">Registrado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyQuery.isLoading && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-4">
                        Carregando…
                      </TableCell>
                    </TableRow>
                  )}
                  {!historyQuery.isLoading && (historyQuery.data ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-4">
                        Sem histórico.
                      </TableCell>
                    </TableRow>
                  )}
                  {(historyQuery.data ?? []).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{formatBR(r.rating_date)}</TableCell>
                      <TableCell className="text-xs font-mono font-semibold">{r.rating_value}</TableCell>
                      <TableCell className="text-xs">{r.source ?? "—"}</TableCell>
                      <TableCell className="text-xs">{r.outlook ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.created_at ? new Date(r.created_at).toLocaleString("pt-BR") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
