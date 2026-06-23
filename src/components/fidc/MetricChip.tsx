import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import type { RiskStatus } from "@/lib/fidc/metrics";

const COLORS: Record<RiskStatus, string> = {
  normal: "text-risk-normal bg-risk-normal-bg",
  warning: "text-risk-warning bg-risk-warning-bg",
  critical: "text-risk-critical bg-risk-critical-bg",
  missing: "text-risk-missing bg-risk-missing-bg",
};

const LABELS: Record<RiskStatus, string> = {
  normal: "Normal",
  warning: "Atenção",
  critical: "Crítico",
  missing: "S/ dado",
};

export function MetricChip({
  status, value, className, mono = true,
}: {
  status: RiskStatus; value: ReactNode; className?: string; mono?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-end rounded-sm px-1.5 py-0.5 text-[12px] font-medium leading-none whitespace-nowrap",
        mono && "num", COLORS[status], className,
      )}
    >
      {value}
    </span>
  );
}

export function RiskStatusBadge({ status, label }: { status: RiskStatus; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider", COLORS[status])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label ?? LABELS[status]}
    </span>
  );
}

export function StatusDot({ status }: { status: RiskStatus }) {
  const c = {
    normal: "bg-risk-normal",
    warning: "bg-risk-warning",
    critical: "bg-risk-critical",
    missing: "bg-risk-missing",
  }[status];
  return <span className={cn("inline-block h-2 w-2 rounded-full", c)} />;
}
