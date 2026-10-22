import type { Summary } from "@/features/analytics/api/queries";
import { depthClassFor, rangeLabel, shareOf } from "@/features/analytics/labels";
import { formatCount } from "@/shared/lib/format";

import { BarChartFrame, type BarDatum } from "./BarChartFrame";
import { ChartCard, DataTable } from "./ChartCard";

interface Slice {
  label: string;
  count: number;
  fill: string;
}

const UNKNOWN_FILL = "var(--tm-foreground-secondary)";

function DistributionCard({
  title,
  description,
  slices,
  total,
  firstHeader,
  note,
}: {
  title: string;
  description: string;
  slices: Slice[];
  total: number;
  firstHeader: string;
  note?: string;
}) {
  const data: BarDatum[] = slices.map((slice) => ({
    tick: slice.label,
    count: slice.count,
    fill: slice.fill,
    muted: slice.fill === UNKNOWN_FILL,
    tooltip: (
      <>
        <p className="font-medium">{slice.label}</p>
        <p className="tabular font-mono">
          {formatCount(slice.count)} eventos · {shareOf(slice.count, total)}
        </p>
      </>
    ),
  }));
  const largest = slices.reduce((best, slice) => (slice.count > best.count ? slice : best));

  return (
    <ChartCard
      title={title}
      description={description}
      summary={`Gráfica de barras. El grupo más numeroso es ${largest.label}, con ${formatCount(largest.count)} de ${formatCount(total)} eventos.`}
      chart={<BarChartFrame data={data} />}
      table={
        <DataTable
          caption={title}
          headers={[firstHeader, "Eventos", "% del total"]}
          rows={slices.map((slice) => [
            slice.label,
            formatCount(slice.count),
            shareOf(slice.count, total),
          ])}
        />
      }
      note={note}
    />
  );
}

/** Los eventos sin dato se muestran aparte (y solo si existen), nunca repartidos. */
function withUnknown(slices: Slice[], unknown: number, label: string): Slice[] {
  return unknown > 0 ? [...slices, { label, count: unknown, fill: UNKNOWN_FILL }] : slices;
}

export function MagnitudeCard({ summary }: { summary: Summary }) {
  const slices = summary.magnitude_bands.map((band) => ({
    label: rangeLabel(band.min, band.max),
    count: band.count,
    fill: "var(--tm-accent)",
  }));
  return (
    <DistributionCard
      title="Distribución por magnitud"
      description="Eventos por banda de magnitud (escala de la fuente)."
      slices={withUnknown(slices, summary.magnitude_unknown, "Sin magnitud")}
      total={summary.total}
      firstHeader="Magnitud"
      note="La magnitud mide la energía liberada en el foco; no indica la intensidad sentida ni los daños."
    />
  );
}

export function DepthCard({ summary }: { summary: Summary }) {
  const slices = summary.depth_classes.map((depth) => {
    const legend = depthClassFor(depth.max_km);
    return {
      label: legend?.label ?? rangeLabel(depth.min_km, depth.max_km, "km"),
      count: depth.count,
      fill: legend?.cssVar ?? "var(--tm-accent)",
    };
  });
  return (
    <DistributionCard
      title="Distribución por profundidad"
      description="Eventos por profundidad del foco, con los colores de la leyenda del mapa."
      slices={withUnknown(slices, summary.depth_unknown, "Sin profundidad")}
      total={summary.total}
      firstHeader="Profundidad"
    />
  );
}
