import type { ExploreFilters, Period } from "./schema";

const HOUR = 3_600_000;
const PERIOD_MS: Record<Exclude<Period, "7d">, number> = {
  "24h": 24 * HOUR,
  "30d": 30 * 24 * HOUR,
};

export const LIST_PAGE_SIZE = 50;

export interface FilterQuery {
  start?: string;
  min_magnitude?: number;
  max_magnitude?: number;
  min_depth_km?: number;
  max_depth_km?: number;
  event_type?: "all";
}

export interface ListQuery extends FilterQuery {
  ordering: "-magnitude" | "-occurred_at";
  page_size: number;
}

/**
 * Filtros de la URL → parámetros de la API. Los periodos se cuentan hacia atrás desde el
 * final de la cobertura (como hace la API con los 7 días por defecto), no desde "ahora":
 * así la consulta es estable entre sincronizaciones y aprovecha la caché.
 * Devuelve null si el periodo necesita la cobertura y todavía no se conoce.
 */
export function toFilterQuery(
  filters: ExploreFilters,
  coverageEnd: string | undefined,
): FilterQuery | null {
  let start: string | undefined;
  if (filters.period !== "7d") {
    if (!coverageEnd) return null;
    start = new Date(new Date(coverageEnd).getTime() - PERIOD_MS[filters.period]).toISOString();
  }
  return {
    ...(start ? { start } : {}),
    ...(filters.min_magnitude !== undefined ? { min_magnitude: filters.min_magnitude } : {}),
    ...(filters.max_magnitude !== undefined ? { max_magnitude: filters.max_magnitude } : {}),
    ...(filters.min_depth_km !== undefined ? { min_depth_km: filters.min_depth_km } : {}),
    ...(filters.max_depth_km !== undefined ? { max_depth_km: filters.max_depth_km } : {}),
    ...(filters.types === "all" ? { event_type: "all" as const } : {}),
  };
}

export function toListQuery(
  filters: ExploreFilters,
  coverageEnd: string | undefined,
): ListQuery | null {
  const base = toFilterQuery(filters, coverageEnd);
  if (!base) return null;
  return {
    ...base,
    ordering: filters.order === "recent" ? "-occurred_at" : "-magnitude",
    page_size: LIST_PAGE_SIZE,
  };
}
