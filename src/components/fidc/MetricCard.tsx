import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { SourceBadge } from "@/components/fidc/laminate/SourceBadge";
import type { DataSource } from "@/lib/fidc/source-resolver";

export function MetricCard({
  label, value, hint, accent, className, source, fallbackReason,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: "normal" | "warning" | "critical" | "neutral";
  className?: string;
  source?: DataSource;
  fallbackReason?: string | null;
}) {
  const accentBorder = {
    normal: "border-l-risk-normal",
    warning: "border-l-risk-warning",
    critical: "border-l-risk-critical",
    neutral: "border-l-transparent",
  }[accent ?? "neutral"];

  return (
    <div
      className={cn(
        "bg-card border border-border border-l-2 px-3.5 py-2.5 flex flex-col gap-0.5",
        accentBorder, className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="section-title truncate">{label}</div>
        {source && <SourceBadge source={source} fallbackReason={fallbackReason} />}
      </div>
      <div className="text-[19px] font-semibold tracking-tight num text-foreground leading-tight">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground truncate">{hint}</div>}
    </div>
  );
}
