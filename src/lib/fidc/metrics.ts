export type RiskStatus = "normal" | "warning" | "critical" | "missing";

export const STATUS_ORDER: Record<RiskStatus, number> = {
  normal: 0,
  missing: 1,
  warning: 2,
  critical: 3,
};

export const worstStatus = (statuses: RiskStatus[]): RiskStatus => {
  if (!statuses.length) return "missing";
  return statuses.reduce((a, b) => (STATUS_ORDER[a] >= STATUS_ORDER[b] ? a : b));
};

export type ThresholdRule = {
  metric: string;
  display: string;
  warning: number;
  critical: number;
  direction: "above_is_worse" | "below_is_worse";
};

export const DEFAULT_THRESHOLDS: ThresholdRule[] = [
  { metric: "atraso_dc", display: "Atraso/DC", warning: 0.08, critical: 0.15, direction: "above_is_worse" },
  { metric: "caixa_pl", display: "Caixa/PL", warning: 0.05, critical: 0.02, direction: "below_is_worse" },
  { metric: "pdd_atrasos", display: "PDD/Atrasos", warning: 0.7, critical: 0.5, direction: "below_is_worse" },
  { metric: "pdd_dc", display: "PDD/DC", warning: 0.08, critical: 0.12, direction: "above_is_worse" },
  { metric: "recompras_dc", display: "Recompras/DC", warning: 0.04, critical: 0.07, direction: "above_is_worse" },
  { metric: "subordinacao", display: "Subordinação", warning: 0.18, critical: 0.12, direction: "below_is_worse" },
  { metric: "var_pl", display: "Var. mensal PL", warning: -0.05, critical: -0.1, direction: "below_is_worse" },
  { metric: "var_cota", display: "Var. mensal Cota", warning: 0, critical: -0.005, direction: "below_is_worse" },
];

export const evalStatus = (rule: ThresholdRule, value: number | null | undefined): RiskStatus => {
  if (value == null || Number.isNaN(value)) return "missing";
  if (rule.direction === "above_is_worse") {
    if (value >= rule.critical) return "critical";
    if (value >= rule.warning) return "warning";
    return "normal";
  } else {
    if (value <= rule.critical) return "critical";
    if (value <= rule.warning) return "warning";
    return "normal";
  }
};
