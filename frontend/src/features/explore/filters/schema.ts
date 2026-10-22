import { z } from "zod";

// La URL es la fuente de verdad de los filtros: compartir el enlace restaura la vista.
// Cualquier valor inválido o manipulado vuelve a su valor por defecto en vez de fallar.

export const PERIODS = ["24h", "7d", "30d"] as const;
export type Period = (typeof PERIODS)[number];

export const ORDERS = ["magnitude", "recent"] as const;
export type Order = (typeof ORDERS)[number];

export const MAGNITUDE_RANGE = { min: -5, max: 12 } as const;
export const DEPTH_RANGE = { min: -100, max: 1000 } as const;

function optionalNumber(min: number, max: number) {
  return z
    .preprocess(
      (value) =>
        value === undefined || value === null || value === "" ? undefined : Number(value),
      z.number().min(min).max(max).optional(),
    )
    .catch(undefined);
}

const rawSchema = z.object({
  period: z.enum(PERIODS).catch("7d"),
  min_magnitude: optionalNumber(MAGNITUDE_RANGE.min, MAGNITUDE_RANGE.max),
  max_magnitude: optionalNumber(MAGNITUDE_RANGE.min, MAGNITUDE_RANGE.max),
  min_depth_km: optionalNumber(DEPTH_RANGE.min, DEPTH_RANGE.max),
  max_depth_km: optionalNumber(DEPTH_RANGE.min, DEPTH_RANGE.max),
  types: z.enum(["earthquake", "all"]).catch("earthquake"),
  order: z.enum(ORDERS).catch("magnitude"),
  bbox: z.string().refine(isValidBbox).optional().catch(undefined),
  event: z.uuid().optional().catch(undefined),
});

export const exploreFiltersSchema = rawSchema.transform((filters) => ({
  ...filters,
  // Un máximo menor que el mínimo no tiene sentido: se descarta el máximo.
  max_magnitude: exceeds(filters.min_magnitude, filters.max_magnitude)
    ? undefined
    : filters.max_magnitude,
  max_depth_km: exceeds(filters.min_depth_km, filters.max_depth_km)
    ? undefined
    : filters.max_depth_km,
}));

export type ExploreFilters = z.output<typeof exploreFiltersSchema>;

export const DEFAULT_FILTERS: ExploreFilters = exploreFiltersSchema.parse({});

/** "oeste,sur,este,norte" en grados; oeste > este cruza el antimeridiano. */
export function isValidBbox(value: string): boolean {
  const parts = value.split(",").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return false;
  const [west, south, east, north] = parts as [number, number, number, number];
  const lonOk = [west, east].every((lon) => lon >= -180 && lon <= 180);
  const latOk = [south, north].every((lat) => lat >= -90 && lat <= 90);
  return lonOk && latOk && south < north && west !== east;
}

function exceeds(min: number | undefined, max: number | undefined): boolean {
  return min !== undefined && max !== undefined && min > max;
}

export function parseFilters(params: URLSearchParams): ExploreFilters {
  return exploreFiltersSchema.parse(Object.fromEntries(params));
}

// Lista fija y ordenada: zod omite en la salida las claves opcionales sin valor.
const FILTER_KEYS = Object.keys(rawSchema.shape) as (keyof ExploreFilters)[];

/** Solo escribe lo que difiere del valor por defecto: URLs cortas y estables. */
export function serializeFilters(filters: ExploreFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value !== undefined && value !== DEFAULT_FILTERS[key]) {
      params.set(key, String(value));
    }
  }
  return params;
}
