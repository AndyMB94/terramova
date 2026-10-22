import { SlidersHorizontal } from "lucide-react";
import { useCallback, useId, useMemo, useState } from "react";

import {
  useEarthquake,
  useEarthquakeList,
  useMapPoints,
  useMeta,
} from "@/features/explore/api/queries";
import { EventDetail } from "@/features/explore/detail/EventDetail";
import { toFilterQuery, toListQuery } from "@/features/explore/filters/api-query";
import { activeChips } from "@/features/explore/filters/chips";
import { FilterPanel } from "@/features/explore/filters/FilterPanel";
import { useExploreFilters } from "@/features/explore/filters/useExploreFilters";
import { EventList } from "@/features/explore/list/EventList";
import { useGlobeApiRef } from "@/features/explore/globe/controller";
import type { GlobePoint } from "@/features/explore/globe/points";
import { supportsWebGL } from "@/features/explore/globe/webgl";
import { MapArea } from "@/features/explore/map/MapArea";
import { StatusBar } from "@/features/explore/status/StatusBar";
import { usePreferences } from "@/shared/hooks/preferences-context";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { formatDateRange } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

// La ficha flotante en escritorio: 340 px de ancho a 72 px del borde derecho del mapa.
const DETAIL_INSET_PX = 340 + 72;

export function ExplorePage() {
  const { filters, update, reset } = useExploreFilters();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersPanelId = useId();

  const meta = useMeta();
  const coverageEnd = meta.data?.coverage?.end;
  const listQuery = useMemo(() => toListQuery(filters, coverageEnd), [filters, coverageEnd]);
  const list = useEarthquakeList(listQuery);
  const events = useMemo(() => list.data?.pages.flatMap((page) => page.results) ?? [], [list.data]);
  const listWindow = list.data?.pages[0]?.window ?? null;
  const wide = useMediaQuery("(min-width: 1024px)");

  const filterQuery = useMemo(() => toFilterQuery(filters, coverageEnd), [filters, coverageEnd]);
  const map = useMapPoints(filterQuery);
  const points = useMemo<GlobePoint[]>(
    () =>
      (map.data?.features ?? []).map((feature) => ({
        id: feature.id,
        longitude: feature.geometry.coordinates[0] ?? 0,
        latitude: feature.geometry.coordinates[1] ?? 0,
        magnitude: feature.properties.magnitude,
        depthKm: feature.properties.depth_km,
        occurredAtMs: Date.parse(feature.properties.occurred_at),
      })),
    [map.data],
  );
  const globeApi = useGlobeApiRef();
  const [mapAvailable, setMapAvailable] = useState(supportsWebGL);
  const [focus, setFocus] = useState<{ id: string; nonce: number } | null>(null);
  const { reducedMotion } = usePreferences();

  const selected = useEarthquake(filters.event);

  // Desde la lista se centra el globo en el evento; desde el globo, no (ya está a la vista).
  const selectFromList = useCallback(
    (id: string) => {
      update({ event: id });
      setFocus({ id, nonce: Date.now() });
    },
    [update],
  );
  const selectFromGlobe = useCallback((id: string) => update({ event: id }), [update]);
  const closeDetail = useCallback(() => {
    const id = filters.event;
    update({ event: undefined });
    // Devuelve el foco a la fila del evento para no perder la posición con teclado.
    if (id) requestAnimationFrame(() => document.getElementById(`event-${id}`)?.focus());
  }, [filters.event, update]);

  const chips = activeChips(filters);
  // Sin consulta (periodo que necesita la cobertura y aún no llega) la lista espera a meta.
  const listStatus = listQuery === null ? (meta.isError ? "error" : "pending") : list.status;

  const detail = filters.event ? (
    <EventDetail
      event={selected.data}
      status={selected.status}
      error={selected.error}
      onClose={closeDetail}
      className="lg:absolute lg:top-[72px] lg:right-[72px] lg:w-[340px]"
    />
  ) : null;

  return (
    <main className="flex flex-col lg:h-[calc(100dvh-56px)]">
      <h1 className="sr-only">Explorar sismos recientes</h1>
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
            periodRange={
              listWindow ? formatDateRange(listWindow.start, listWindow.end, "UTC") : undefined
            }
            onUseMapView={() => globeApi.current?.getViewBbox() ?? null}
            mapAvailable={mapAvailable}
          />
          <div className="mt-6 hidden flex-col gap-2.5 lg:flex">
            <p className="text-xs text-muted-foreground">Filtros activos</p>
            <ul className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <li
                  key={chip}
                  className="inline-flex h-7 items-center rounded-full border border-border bg-surface-raised px-2.5 text-xs"
                >
                  {chip}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <section
          aria-label="Mapa"
          className="relative h-[312px] shrink-0 sm:h-[452px] lg:h-auto lg:min-w-0 lg:flex-1"
        >
          <MapArea
            points={points}
            selectedId={filters.event}
            focus={focus}
            onSelect={selectFromGlobe}
            reducedMotion={reducedMotion}
            rightInsetPx={wide && filters.event ? DETAIL_INSET_PX : 0}
            apiRef={globeApi}
            available={mapAvailable}
            onUnavailable={() => setMapAvailable(false)}
          >
            {wide ? detail : null}
          </MapArea>
        </section>

        <div className="flex min-h-0 flex-col border-border-subtle bg-panel lg:w-[392px] lg:shrink-0 lg:border-l">
          {detail && !wide ? <div className="p-3">{detail}</div> : null}
          <EventList
            events={events}
            status={listStatus}
            error={list.error ?? meta.error}
            hasMore={list.hasNextPage}
            loadingMore={list.isFetchingNextPage}
            selectedId={filters.event}
            order={filters.order}
            onOrderChange={(order) => update({ order })}
            onSelect={selectFromList}
            onLoadMore={() => void list.fetchNextPage()}
            onRetry={() => void (listQuery === null ? meta.refetch() : list.refetch())}
            onReset={reset}
          />
        </div>
      </div>
      <StatusBar meta={meta.data} status={meta.status} map={map.data?.metadata} />
    </main>
  );
}
