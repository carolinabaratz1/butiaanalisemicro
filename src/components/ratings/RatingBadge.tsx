import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { RatingSource } from "@/lib/ratings/useResolvedRating";
import { cn } from "@/lib/utils";

interface RatingBadgeProps {
  rating?: string | null;
  source?: RatingSource;
  agencia?: string | null;
  data?: string | null;
  loading?: boolean;
  className?: string;
}

function formatDateBR(iso?: string | null): string {
  if (!iso) return "sem data";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

const sourceLabels: Record<RatingSource, string> = {
  ticker: "Rating do ativo",
  emissor: "Rating do emissor",
  grupo: "Estimativa por grupo econômico",
  nr: "Sem rating cadastrado",
};

export function RatingBadge({ rating, source = "nr", agencia, data, loading, className }: RatingBadgeProps) {
  if (loading) {
    return (
      <Badge variant="outline" className={cn("font-mono text-xs text-muted-foreground", className)}>
        …
      </Badge>
    );
  }

  if (!rating || source === "nr") {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={cn("font-mono text-xs text-muted-foreground", className)}>
              N/R
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <span>Sem rating cadastrado</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const isEstimate = source === "grupo";
  const isIssuer = source === "emissor";

  const visualClasses = cn(
    "font-mono text-xs gap-1",
    isEstimate && "border-dashed bg-transparent text-muted-foreground",
    isIssuer && "bg-primary/10 text-primary border-primary/30",
    !isEstimate && !isIssuer && "bg-secondary text-secondary-foreground",
    className,
  );

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={visualClasses}>
            {isEstimate && <Sparkles className="h-3 w-3" aria-hidden />}
            <span>
              {isEstimate ? "≈ " : ""}
              {rating}
            </span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-0.5 text-xs">
            <div className="font-medium">{sourceLabels[source]}</div>
            {source !== "grupo" && (
              <>
                <div>Agência: {agencia ?? "não informada"}</div>
                <div>Data: {formatDateBR(data)}</div>
              </>
            )}
            {source === "grupo" && (
              <div className="text-muted-foreground">
                Inferido pelo rating mais comum no grupo econômico — não é rating oficial do emissor.
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
