import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";

import type { Summary } from "@/features/analytics/api/queries";
import { formatChange } from "@/features/analytics/labels";
import { formatCount, formatDateRange, formatMagnitude, formatPlace } from "@/shared/lib/format";

export function SummaryCards({ summary }: { summary: Summary }) {
  const { search } = useLocation();
  const { strongest, comparison, total } = summary;

  // Enlace al evento en Explorar conservando los filtros actuales.
  const eventLink = (id: string) => {
    const params = new URLSearchParams(search);
    params.set("event", id);
    return `/?${params.toString()}`;
  };

  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      <Card
        label="Eventos registrados"
        value={formatCount(total)}
        detail={
          summary.window
            ? `${formatDateRange(summary.window.start, summary.window.end, "UTC")} · UTC`
            : null
        }
      />
      <Card
        label="Magnitud máxima"
        value={strongest ? `M ${formatMagnitude(strongest.magnitude)}` : "—"}
        detail={
          strongest ? (
            <>
              {formatPlace(strongest.place)} ·{" "}
              <Link
                to={eventLink(strongest.id)}
                className="text-primary underline-offset-2 hover:underline"
              >
                Ver en el globo
              </Link>
            </>
          ) : (
            "Ningún evento con magnitud publicada"
          )
        }
      />
      <ComparisonCard comparison={comparison} total={total} />
    </dl>
  );
}

function ComparisonCard({
  comparison,
  total,
}: {
  comparison: Summary["comparison"];
  total: number;
}) {
  const previous = comparison.previous_window;
  const previousRange = previous ? formatDateRange(previous.start, previous.end, "UTC") : "";

  if (!comparison.available || comparison.previous_total === null) {
    return (
      <Card
        label="Frente al periodo anterior"
        value="Sin comparación"
        detail={
          comparison.reason === "outside_coverage"
            ? `Los días anteriores (${previousRange}) no están sincronizados: compararlos aparentaría un descenso que en realidad es falta de datos.`
            : "No hay datos para comparar."
        }
      />
    );
  }

  const change = formatChange(total, comparison.previous_total);
  return (
    <Card
      label="Frente al periodo anterior"
      value={change ?? "—"}
      detail={
        change
          ? `${formatCount(comparison.previous_total)} eventos en el periodo anterior (${previousRange}), con los mismos filtros.`
          : `Sin eventos registrados en el periodo anterior (${previousRange}).`
      }
    />
  );
}

function Card({ label, value, detail }: { label: string; value: string; detail: ReactNode }) {
  return (
    <div className="animate-fade-in flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular font-mono text-2xl font-medium">{value}</dd>
      {detail ? <dd className="text-xs leading-snug text-muted-foreground">{detail}</dd> : null}
    </div>
  );
}
