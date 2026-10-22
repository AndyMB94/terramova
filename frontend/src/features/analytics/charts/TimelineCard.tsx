import type { Timeline } from "@/features/analytics/api/queries";
import { bucketRange, bucketTick } from "@/features/analytics/labels";
import { formatCount, formatMagnitude } from "@/shared/lib/format";

import { BarChartFrame, type BarDatum } from "./BarChartFrame";
import { ChartCard, DataTable } from "./ChartCard";

export function TimelineCard({ timeline }: { timeline: Timeline }) {
  const { granularity, buckets } = timeline;
  const unit = granularity === "hour" ? "hora" : "día";
  const hasPartial = buckets.some((bucket) => bucket.is_partial);
  const peak = buckets.reduce<(typeof buckets)[number] | undefined>(
    (best, bucket) => (!best || bucket.count > best.count ? bucket : best),
    undefined,
  );

  const data: BarDatum[] = buckets.map((bucket) => ({
    tick: bucketTick(bucket.start, granularity),
    count: bucket.count,
    fill: "var(--tm-accent)",
    muted: bucket.is_partial,
    tooltip: (
      <>
        <p className="font-medium">{bucketRange(bucket.start, bucket.end, granularity)}</p>
        <p className="tabular font-mono">{formatCount(bucket.count)} eventos</p>
        <p className="text-muted-foreground">
          Magnitud máxima: {formatMagnitude(bucket.max_magnitude)}
        </p>
        {bucket.is_partial ? (
          <p className="text-muted-foreground">Intervalo incompleto (extremo de la ventana)</p>
        ) : null}
      </>
    ),
  }));

  return (
    <ChartCard
      title={`Eventos por ${unit}`}
      description={`Número de eventos registrados por ${unit} (UTC).`}
      summary={
        peak
          ? `Gráfica de barras con ${buckets.length} intervalos. Máximo: ${formatCount(peak.count)} eventos el ${bucketRange(peak.start, peak.end, granularity)}.`
          : "Gráfica de barras sin intervalos."
      }
      chart={<BarChartFrame data={data} />}
      table={
        <DataTable
          caption={`Eventos por ${unit} en UTC`}
          headers={["Intervalo (UTC)", "Eventos", "Magnitud máxima"]}
          rows={buckets.map((bucket) => [
            `${bucketRange(bucket.start, bucket.end, granularity)}${bucket.is_partial ? " *" : ""}`,
            formatCount(bucket.count),
            formatMagnitude(bucket.max_magnitude),
          ])}
        />
      }
      note={
        hasPartial
          ? "Barras atenuadas (* en la tabla): intervalos que la ventana cubre solo en parte, en sus extremos."
          : undefined
      }
    />
  );
}
