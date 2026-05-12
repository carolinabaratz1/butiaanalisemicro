import { useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { FundoKey, sourceFromFundo, FidcClasse } from "./allocationUtils";

interface Props {
  fundo: FundoKey;
  valDate: string | null;
}

export function FidcClassesPanel({ fundo, valDate }: Props) {
  const qc = useQueryClient();
  const source = sourceFromFundo(fundo);

  const { data: rows = [] } = useQuery({
    queryKey: ["fidc-funds-positions", fundo, valDate],
    queryFn: async () => {
      if (!valDate) return [];
      const { data, error } = await supabase
        .from("posicoes")
        .select("isin,product,amount,financial_price")
        .eq("trading_desk_share_source", source)
        .eq("val_date", valDate)
        .eq("product", "Funds BR");
      if (error) throw error;
      const byIsin = new Map<string, number>();
      for (const r of (data ?? []) as any[]) {
        if (!r.isin) continue;
        const v = (Number(r.amount) || 0) * (Number(r.financial_price) || 0);
        byIsin.set(r.isin, (byIsin.get(r.isin) ?? 0) + v);
      }
      return Array.from(byIsin.entries()).map(([isin, total]) => ({ isin, total })).sort((a, b) => b.total - a.total);
    },
    enabled: !!valDate,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["fidc_classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fidc_classes" as any).select("isin,classe");
      if (error) throw error;
      return ((data ?? []) as any) as { isin: string; classe: FidcClasse }[];
    },
  });

  const isinToClasse = useMemo(() => new Map(classes.map(c => [c.isin, c.classe])), [classes]);

  const upsert = useMutation({
    mutationFn: async (payload: { isin: string; classe: FidcClasse }) => {
      const { error } = await supabase
        .from("fidc_classes" as any)
        .upsert({ isin: payload.isin, classe: payload.classe }, { onConflict: "isin" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fidc_classes"] });
      qc.invalidateQueries({ queryKey: ["alocacao"] });
      toast({ title: "Classificação salva" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  if (!valDate) return null;
  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cotas de Fundos CP — Classificação FIDC por ISIN</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          Defina a classe da cota (Sênior, Mezanino ou NP) para que a posição seja considerada no respectivo limite. ISINs sem classificação ficam agregados em "Cotas de Fundos CP".
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b text-xs text-muted-foreground">
                <th className="py-2 pr-3">ISIN</th>
                <th className="py-2 pr-3 text-right">Posição (R$)</th>
                <th className="py-2 pr-3">Classe</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const current = isinToClasse.get(r.isin);
                return (
                  <tr key={r.isin} className="border-b last:border-b-0">
                    <td className="py-2 pr-3 font-mono text-xs">{r.isin}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {r.total.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 pr-3">
                      <Select
                        value={current ?? ""}
                        onValueChange={(v) => upsert.mutate({ isin: r.isin, classe: v as FidcClasse })}
                      >
                        <SelectTrigger className="h-8 w-[160px] text-xs">
                          <SelectValue placeholder="— selecionar —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sênior">Sênior</SelectItem>
                          <SelectItem value="Mezanino">Mezanino</SelectItem>
                          <SelectItem value="NP">NP</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 pr-3">
                      {current ? (
                        <Badge variant="secondary" className="text-xs">Classificado</Badge>
                      ) : (
                        <Badge className="bg-amber-500 text-white text-xs">Pendente</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
