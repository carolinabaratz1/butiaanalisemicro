import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function MetricCard({
  label, value, hint, accent, className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: "normal" | "warning" | "critical" | "neutral";
  className?: string;
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
      <div className="section-title">{label}</div>
      <div className="text-[19px] font-semibold tracking-tight num text-foreground leading-tight">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground truncate">{hint}</div>}
    </div>
  );
}
