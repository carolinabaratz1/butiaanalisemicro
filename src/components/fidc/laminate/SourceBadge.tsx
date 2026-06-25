import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { DataSource } from "@/lib/fidc/source-resolver";
import { dataSourceLabel } from "@/lib/fidc/source-resolver";

const STYLES: Record<DataSource, string> = {
  cvm_open_data:     "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  manual_upload:     "bg-amber-500/15 text-amber-700 border-amber-500/30",
  internal_position: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  master_data:       "bg-indigo-500/15 text-indigo-700 border-indigo-500/30",
  credit_opinion:    "bg-violet-500/15 text-violet-700 border-violet-500/30",
  manual_limit:      "bg-fuchsia-500/15 text-fuchsia-700 border-fuchsia-500/30",
  missing:           "bg-muted text-muted-foreground border-border",
};

const TOOLTIPS: Record<DataSource, string> = {
  cvm_open_data:     "Dado extraído do Informe Mensal FIDC publicado nos Dados Abertos da CVM.",
  manual_upload:     "Este dado não veio da CVM. Foi usado upload manual como fallback.",
  internal_position: "Dado calculado a partir das posições internas das carteiras Butiá.",
  master_data:       "Dado do cadastro mestre interno (gestor, administrador, custodiante).",
  credit_opinion:    "Dado vindo do parecer de crédito interno.",
  manual_limit:      "Limite regulatório cadastrado manualmente pela equipe.",
  missing:           "Métrica não disponível em nenhuma fonte.",
};

export function SourceBadge({
  source, className, fallbackReason,
}: {
  source: DataSource;
  className?: string;
  fallbackReason?: string | null;
}) {
  const tip = fallbackReason
    ? `${TOOLTIPS[source]} Motivo: ${fallbackReason}`
    : TOOLTIPS[source];
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center rounded-sm border px-1.5 py-0 text-[9.5px] font-medium leading-[14px] tracking-tight",
              STYLES[source], className,
            )}
          >
            {dataSourceLabel(source)}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px] text-[11px] leading-snug">
          {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
