import type { ExploreFilters } from "./schema";

const PERIOD_CHIPS: Record<ExploreFilters["period"], string> = {
  "24h": "Últimas 24 h",
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
};

/** Resumen legible de los filtros activos (chips de Explorar y Analítica). */
export function activeChips(filters: ExploreFilters): string[] {
  const chips = [
    PERIOD_CHIPS[filters.period],
    filters.types === "all" ? "Todos los tipos" : "Solo sismos",
  ];
  if (filters.min_magnitude !== undefined || filters.max_magnitude !== undefined) {
    chips.push(`M ${rangeLabel(filters.min_magnitude, filters.max_magnitude)}`);
  }
  if (filters.min_depth_km !== undefined || filters.max_depth_km !== undefined) {
    chips.push(`${rangeLabel(filters.min_depth_km, filters.max_depth_km)} km`);
  }
  if (filters.bbox) chips.push("Área del mapa");
  return chips;
}

function rangeLabel(min: number | undefined, max: number | undefined): string {
  const format = (value: number) => String(value).replace(".", ",");
  if (min !== undefined && max !== undefined) return `${format(min)}–${format(max)}`;
  if (min !== undefined) return `≥ ${format(min)}`;
  return `≤ ${format(max ?? 0)}`;
}
