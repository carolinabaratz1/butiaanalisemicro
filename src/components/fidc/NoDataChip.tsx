import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const DEFAULT_REASON = "Informe mensal ainda não importado";

export function NoDataChip({
  reason = DEFAULT_REASON,
  className,
  label = "N/D",
}: {
  reason?: string;
  className?: string;
  label?: string;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center justify-end rounded-sm px-1.5 py-0.5 text-[12px] font-medium leading-none whitespace-nowrap",
              "text-muted-foreground bg-muted/40 cursor-help",
              className,
            )}
          >
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[11px]">{reason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function NoDataInline({
  reason = DEFAULT_REASON,
  className,
  label = "N/D",
}: {
  reason?: string;
  className?: string;
  label?: string;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("text-muted-foreground cursor-help", className)}>{label}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[11px]">{reason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
