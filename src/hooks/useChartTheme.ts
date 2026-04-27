// src/hooks/useChartTheme.ts
// Resolves chart colors from CSS design tokens so Recharts SVG props
// (which can't read CSS variables directly) follow the active theme.
import { useEffect, useState } from "react";
import { useTheme } from "./useTheme";

function hsl(varName: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return v ? `hsl(${v})` : fallback;
}

export interface ChartTheme {
  /** Tooltip <Tooltip contentStyle={...} /> */
  tooltip: React.CSSProperties;
  /** Tooltip label / title text style */
  tooltipLabel: React.CSSProperties;
  /** Tooltip body text style (use as itemStyle) */
  tooltipItem: React.CSSProperties;
  /** Axis tick color (XAxis/YAxis tick={{ fill: ... }}) */
  tickFill: string;
  /** Grid / axis line stroke (CartesianGrid stroke=...) */
  gridStroke: string;
  /** Soft border for chart frames */
  border: string;
  /** Foreground / heading text */
  foreground: string;
  /** Muted / secondary text */
  muted: string;
}

export function useChartTheme(): ChartTheme {
  const { theme } = useTheme();
  // Re-resolve when the theme class on <html> flips
  const [tick, setTick] = useState(0);
  useEffect(() => { setTick(t => t + 1); }, [theme]);

  // Read once per theme change (cheap, all sync getComputedStyle calls)
  const card        = hsl("--card",              theme === "dark" ? "#0c1018" : "#ffffff");
  const border      = hsl("--border",            theme === "dark" ? "#1c2840" : "#e5e7eb");
  const foreground  = hsl("--foreground",        theme === "dark" ? "#dde6f0" : "#0f172a");
  const muted       = hsl("--muted-foreground",  theme === "dark" ? "#94a3b8" : "#64748b");
  void tick;

  return {
    tooltip: {
      backgroundColor: card,
      border: `1px solid ${border}`,
      borderRadius: 6,
      fontSize: 11,
      fontFamily: "DM Mono, monospace",
      color: foreground,
      boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
      padding: "6px 8px",
    },
    tooltipLabel: { color: foreground, fontWeight: 600 },
    tooltipItem: { color: muted },
    tickFill: muted,
    gridStroke: border,
    border,
    foreground,
    muted,
  };
}
