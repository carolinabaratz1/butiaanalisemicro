import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { ratingSeverity, severityLabel } from "@/lib/ratings/ratingSeverity";

export interface TimelinePoint {
  data: string; // ISO YYYY-MM-DD
  ratingEmissor?: string | null;
  ratingGrupo?: string | null;
}

interface Props {
  points: TimelinePoint[];
  hasGrupo: boolean;
}

function toChartRow(p: TimelinePoint) {
  return {
    data: p.data,
    label: (() => {
      const [y, m, d] = p.data.split("-");
      return y && m && d ? `${d}/${m}/${y.slice(2)}` : p.data;
    })(),
    emissor: ratingSeverity(p.ratingEmissor),
    grupo: ratingSeverity(p.ratingGrupo),
    ratingEmissor: p.ratingEmissor ?? null,
    ratingGrupo: p.ratingGrupo ?? null,
  };
}

export function IssuerRatingTimelineChart({ points, hasGrupo }: Props) {
  const data = useMemo(() => points.map(toChartRow), [points]);

  if (data.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
        Sem histórico de rating para plotar.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis
            domain={[0.5, 5.5]}
            ticks={[1, 2, 3, 4, 5]}
            tickFormatter={(v) => severityLabel(Number(v))}
            tick={{ fontSize: 11 }}
            width={45}
          />
          <Tooltip
            contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
            formatter={(_value: any, name: any, item: any) => {
              const key = name === "Emissor" ? "ratingEmissor" : "ratingGrupo";
              return [item?.payload?.[key] ?? "—", name];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line
            type="stepAfter"
            dataKey="emissor"
            name="Emissor"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
          {hasGrupo && (
            <Line
              type="stepAfter"
              dataKey="grupo"
              name="Grupo econômico"
              stroke="hsl(215 15% 55%)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={{ r: 2 }}
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
