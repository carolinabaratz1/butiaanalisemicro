// Espelha public.rating_bucket_severity (Postgres) para uso em gráficos.
// Mantém os mesmos números para que o eixo Y do gráfico bata com o servidor.
export function ratingSeverity(rating?: string | null): number | null {
  if (!rating || !rating.trim()) return null;
  const raw = rating.replace(/\(.*?\)/g, "").trim().toUpperCase();
  const norm = raw.replace(/^BR/, "");
  if (rating.toLowerCase().includes("soberano")) return 5;
  if (norm.startsWith("AAA")) return 5;
  if (norm.startsWith("AA")) return 4;
  if (norm.startsWith("A")) return 3;
  if (norm.startsWith("BBB")) return 2;
  if (/^(BB|B|CCC|CC|C|D)/.test(norm)) return 1;
  return null;
}

export const SEVERITY_LABEL: Record<number, string> = {
  5: "AAA",
  4: "AA",
  3: "A",
  2: "BBB",
  1: "<BBB",
};

export function severityLabel(sev: number | null | undefined): string {
  if (sev == null) return "N/R";
  return SEVERITY_LABEL[sev] ?? "N/R";
}

export type RatingBucket = "AAA" | "AA" | "A" | "BBB" | "<BBB" | "N/R";

export function ratingBucket(rating?: string | null): RatingBucket {
  const s = ratingSeverity(rating);
  if (s == null) return "N/R";
  return (SEVERITY_LABEL[s] as RatingBucket) ?? "N/R";
}

export const BUCKET_ORDER: RatingBucket[] = ["AAA", "AA", "A", "BBB", "<BBB", "N/R"];
