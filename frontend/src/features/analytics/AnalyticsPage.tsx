import { AlertTriangle, SlidersHorizontal } from "lucide-react";
import { type ReactNode, useId, useMemo, useState } from "react";
import { Link, useLocation } from "react-router";

import {
  type Summary,
  useAnalyticsSummary,
  useAnalyticsTimeline,
} from "@/features/analytics/api/queries";
import { DepthCard, MagnitudeCard } from "@/features/analytics/charts/DistributionCards";
import { TimelineCard } from "@/features/analytics/charts/TimelineCard";
import { formatDay } from "@/features/analytics/labels";
import { SummaryCards } from "@/features/analytics/SummaryCards";
import {
  activeChips,
  FilterPanel,
  StatusBar,
  toFilterQuery,
  useExploreFilters,
  useMeta,
} from "@/features/explore";
import { userMessage } from "@/shared/api/errors";
import { formatDateRange } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/Button";

/**
 * Estadísticas del mismo conjunto que Explorar: comparte los filtros de la URL, así que
 * el mismo enlace muestra los mismos datos en ambas vistas (docs/UI_UX.md).
 */
export default function AnalyticsPage() {
  const { filters, update, reset } = useExploreFilters();
  const { search } = useLocation();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersPanelId = useId();

  const meta = useMeta();
  const coverageEnd = meta.data?.coverage?.end;
  const query = useMemo(() => toFilterQuery(filters, coverageEnd), [filters, coverageEnd]);
  const summary = useAnalyticsSummary(query);
  const timeline = useAnalyticsTimeline(query);
  const chips = activeChips(filters);
  const window = summary.data?.window ?? null;

  const retry = () => {
    if (query === null) void meta.refetch();
    else {
      void summary.refetch();
      void timeline.refetch();
    }
  };

  return (
    <main className="flex flex-col lg:h-[calc(100dvh-56px)]">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex items-center gap-2 overflow-x-auto border-b border-border-subtle bg-panel px-3 py-2.5 lg:hidden">
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls={filtersPanelId}
            onClick={() => setFiltersOpen((open) => !open)}
            className="flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 text-[13px] font-medium"
          >
            <SlidersHorizontal aria-hidden="true" className="size-4" />
            Filtros
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
              {chips.length}
            </span>
          </button>
          {chips.map((chip) => (
            <span
              key={chip}
              className="inline-flex h-8 shrink-0 items-center rounded-full border border-border bg-surface-raised px-3 text-xs"
            >
              {chip}
            </span>
          ))}
        </div>

        <aside
          id={filtersPanelId}
          aria-label="Filtros"
          className={cn(
            "border-border-subtle bg-panel p-5 lg:block lg:w-[296px] lg:shrink-0 lg:overflow-y-auto lg:border-r",
            filtersOpen ? "block border-b" : "hidden",
          )}
        >
          <FilterPanel
            filters={filters}
            onChange={update}
            onReset={reset}
            periodRange={window ? formatDateRange(window.start, window.end, "UTC") : undefined}
            onUseMapView={() => null}
            mapAvailable={false}
            mapUnavailableHint="El área se elige moviendo el globo en Explorar; aquí se aplica la misma."
          />
        </aside>

        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-4 lg:p-6">
            <header className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Analítica</h1>
                <p className="mt-1 hidden flex-wrap gap-1.5 lg:flex">
                  {chips.map((chip) => (
                    <span
                      key={chip}
                      className="inline-flex h-7 items-center rounded-full border border-border bg-surface-raised px-2.5 text-xs"
                    >
                      {chip}
                    </span>
                  ))}
                </p>
              </div>
              <Link
                to={{ pathname: "/", search }}
                className="text-[13px] text-primary underline-offset-2 hover:underline"
              >
                Ver estos eventos en el globo
              </Link>
            </header>

            <Content
              status={query === null ? (meta.isError ? "error" : "pending") : summary.status}
              error={summary.error ?? meta.error}
              summary={summary.data}
              onRetry={retry}
              onReset={reset}
            >
              {summary.data ? (
                <>
                  {summary.data.window_clipped && meta.data?.coverage ? (
                    <p className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3 text-[13px] text-tertiary">
                      <AlertTriangle
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-warning"
                      />
                      La cobertura empieza el {formatDay(meta.data.coverage.start)} (UTC): el
                      periodo abarca menos días de los pedidos.
                    </p>
                  ) : null}
                  <SummaryCards summary={summary.data} />
                  {timeline.data ? <TimelineCard timeline={timeline.data} /> : null}
                  <div className="grid gap-5 xl:grid-cols-2">
                    <MagnitudeCard summary={summary.data} />
                    <DepthCard summary={summary.data} />
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Cifras calculadas sobre todos los eventos que cumplen los filtros, no solo sobre
                    los que caben en la lista o en el mapa. La red de detección no es uniforme: más
                    eventos registrados en una zona no implica necesariamente más actividad.
                  </p>
                </>
              ) : null}
            </Content>
          </div>
        </div>
      </div>
      <StatusBar meta={meta.data} status={meta.status} />
    </main>
  );
}

function Content({
  status,
  error,
  summary,
  onRetry,
  onReset,
  children,
}: {
  status: "pending" | "error" | "success";
  error: unknown;
  summary: Summary | undefined;
  onRetry: () => void;
  onReset: () => void;
  children: ReactNode;
}) {
  if (status === "pending") {
    return <Notice title="Calculando estadísticas…" />;
  }
  if (status === "error") {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <p className="flex items-center gap-2 text-sm">
          <AlertTriangle aria-hidden="true" className="size-4 text-warning" />
          {userMessage(error)}
        </p>
        <Button variant="solid" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      </div>
    );
  }
  if (summary?.window === null) {
    return (
      <Notice
        title="Sin cobertura o sin datos todavía"
        detail="Aún no hay ninguna sincronización con USGS que cubra este periodo. No significa que no haya habido sismos."
      />
    );
  }
  if (summary?.total === 0) {
    return (
      <Notice
        title="Sin eventos registrados en esta consulta"
        detail="Ningún evento cumple los filtros en el periodo cubierto."
        action={
          <Button size="sm" onClick={onReset}>
            Restablecer filtros
          </Button>
        }
      />
    );
  }
  return <>{children}</>;
}

function Notice({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-border bg-surface p-5">
      <p className="text-sm font-medium text-tertiary">{title}</p>
      {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
      {action}
    </div>
  );
}
