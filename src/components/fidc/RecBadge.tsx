export function RecBadge({ rec }: { rec: "Manter" | "Acompanhar" | "Reduzir" | "Zerar" }) {
  const map = {
    Manter: "text-risk-normal bg-risk-normal-bg",
    Acompanhar: "text-risk-missing bg-risk-missing-bg",
    Reduzir: "text-risk-warning bg-risk-warning-bg",
    Zerar: "text-risk-critical bg-risk-critical-bg",
  };
  return (
    <span className={`text-[10.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${map[rec]}`}>
      {rec}
    </span>
  );
}
