import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { ratingBucket, BUCKET_ORDER, type RatingBucket } from "@/lib/ratings/ratingSeverity";

interface Row {
  cnpj: string;
  rating: string | null;
  source_level: "emissor" | "grupo" | "nr";
}

const BUCKET_COLORS: Record<RatingBucket, string> = {
  AAA: "hsl(142 71% 45%)",
  AA: "hsl(160 60% 45%)",
  A: "hsl(200 70% 50%)",
  BBB: "hsl(38 92% 50%)",
  "<BBB": "hsl(0 72% 51%)",
  "N/R": "hsl(215 15% 65%)",
};

const SOURCE_LABEL: Record<Row["source_level"], string> = {
  emissor: "Emissor",
  grupo: "Grupo econômico",
  nr: "Sem rating",
};

// Supabase/PostgREST impoe um teto de linhas por requisicao (Max Rows do projeto,
// hoje 1000) independente do .range() pedido pelo cliente. Paginamos em blocos ate
// a pagina voltar menor que o pageSize, garantindo que TODAS as linhas de
// v_empresa_rating_resolved sejam carregadas, nao apenas as primeiras ~1000.
async function fetchAllRatingRows(): Promise<Row[]> {
  const pageSize = 500;
  let from = 0;
  let all: Row[] = [];
  while (true) {
    const { data, error } = await supabase
      .from("v_empresa_rating_resolved" as any)
      .select("cnpj, rating, source_level")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data as any as Row[]) ?? [];
    all = all.concat(page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

export function RatingDistributionCard() {
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["ratingDistribution"],
    queryFn: fetchAllRatingRows,
    staleTime: 60_000,
  });

  const { total, byBucket, bySource } = useMemo(() => {
    const b: Record<RatingBucket, number> = { AAA: 0, AA: 0, A: 0, BBB: 0, "<BBB": 0, "N/R": 0 };
    const s: Record<Row["source_level"], number> = { emissor: 0, grupo: 0, nr: 0 };
    for (const r of rows) {
      b[ratingBucket(r.rating)] += 1;
      s[r.source_level] = (s[r.source_level] ?? 0) + 1;
    }
    return { total: rows.length, byBucket: b, bySource: s };
  }, [rows]);

  const chartData = BUCKET_ORDER.map((k) => ({ name: k, value: byBucket[k], fill: BUCKET_COLORS[k] })).filter(
    (d) => d.value > 0,
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Visão geral de rating por emissor</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-56 w-full" />
        ) : error ? (
          <p className="text-sm text-destructive">Erro ao carregar distribuição.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr] gap-6 items-center">
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Emissores mapeados</div>
              <div className="text-3xl font-semibold tracking-tight">{total.toLocaleString("pt-BR")}</div>

              <div className="mt-4 space-y-2">
                <div className="text-xs uppercase text-muted-foreground">Por faixa</div>
                {BUCKET_ORDER.map((k) => (
                  <div key={k} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: BUCKET_COLORS[k] }} />
                      <span className="font-medium">{k}</span>
                    </div>
                    <span className="font-mono tabular-nums">
                      {byBucket[k]}
                      <span className="text-muted-foreground ml-1">
                        ({total ? Math.round((byBucket[k] / total) * 100) : 0}%)
                      </span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2">
                <div className="text-xs uppercase text-muted-foreground">Por fonte de resolução</div>
                {(Object.keys(SOURCE_LABEL) as Row["source_level"][]).map((k) => (
                  <div key={k} className="flex items-center justify-between text-xs">
                    <span>{SOURCE_LABEL[k]}</span>
                    <span className="font-mono tabular-nums">
                      {bySource[k] ?? 0}
                      <span className="text-muted-foreground ml-1">
                        ({total ? Math.round(((bySource[k] ?? 0) / total) * 100) : 0}%)
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                    {chartData.map((d) => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: any, name: any) => [
                      `${v} (${total ? Math.round((Number(v) / total) * 100) : 0}%)`,
                      name,
                    ]}
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
