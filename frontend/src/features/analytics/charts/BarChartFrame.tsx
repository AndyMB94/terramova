import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  type BarShapeProps,
  CartesianGrid,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";

export interface BarDatum {
  /** Texto del eje X. */
  tick: string;
  count: number;
  /** Color de la barra (variable CSS de un token). */
  fill: string;
  /** Barra atenuada: intervalo incompleto o dato que conviene leer con cautela. */
  muted?: boolean;
  /** Contenido del tooltip, ya en español. */
  tooltip: ReactNode;
}

const AXIS = { fill: "var(--tm-foreground-secondary)", fontSize: 11 };

/**
 * Barras sin animación de actualización (docs/UI_UX.md): la tarjeta entra con una
 * transición corta y los cambios de filtro se reflejan al instante.
 */
export function BarChartFrame({ data }: { data: BarDatum[] }) {
  return (
    <div className="h-[220px] w-full lg:h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} stroke="var(--tm-border-subtle)" />
          <XAxis
            dataKey="tick"
            tick={AXIS}
            tickLine={false}
            axisLine={{ stroke: "var(--tm-border)" }}
            interval="preserveStartEnd"
            minTickGap={12}
          />
          <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={44} />
          <Tooltip
            cursor={{ fill: "var(--tm-selected)", opacity: 0.5 }}
            content={(props) => <ChartTooltip {...props} />}
            isAnimationActive={false}
          />
          <Bar dataKey="count" isAnimationActive={false} shape={ColoredBar} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ColoredBar(props: BarShapeProps) {
  const datum = props.payload as BarDatum | undefined;
  return (
    <Rectangle
      {...props}
      fill={datum?.fill ?? "var(--tm-accent)"}
      fillOpacity={datum?.muted ? 0.4 : 1}
      radius={[3, 3, 0, 0]}
    />
  );
}

function ChartTooltip({ active, payload }: TooltipContentProps) {
  const datum = payload?.[0]?.payload as BarDatum | undefined;
  if (!active || !datum) return null;
  return (
    <div className="rounded-md border border-border bg-surface-raised px-3 py-2 text-xs shadow-lg">
      {datum.tooltip}
    </div>
  );
}
