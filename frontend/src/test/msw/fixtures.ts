// DATOS FICTICIOS PARA PRUEBAS. Imitan el formato de la API (tipos generados del contrato);
// no son eventos reales y nunca se usan fuera de los tests.
import type { components } from "@/shared/api/schema";

type Earthquake = components["schemas"]["Earthquake"];
type Meta = components["schemas"]["MetaResponse"];

export const COVERAGE_END = "2026-10-22T04:33:36Z";

function event(
  overrides: Partial<Earthquake> & Pick<Earthquake, "id" | "external_id">,
): Earthquake {
  return {
    source: "usgs",
    occurred_at: "2026-10-20T17:05:48.338000Z",
    source_updated_at: "2026-10-20T18:00:00Z",
    magnitude: 4.5,
    magnitude_type: "mb",
    longitude: -82.569,
    latitude: 6.323,
    depth_km: 10,
    place: "192 km S of Burica, Panama",
    status: "reviewed",
    event_type: "earthquake",
    source_url: `https://earthquake.usgs.gov/earthquakes/eventpage/${overrides.external_id}`,
    ...overrides,
  };
}

export const EVENTS: Earthquake[] = [
  event({
    id: "11111111-1111-4111-8111-111111111111",
    external_id: "test0001",
    magnitude: 6.1,
    magnitude_type: "mww",
    place: "120 km NE of Ficticia, Testland",
    depth_km: 135,
  }),
  event({
    id: "22222222-2222-4222-8222-222222222222",
    external_id: "test0002",
    magnitude: 5.4,
    magnitude_type: "mww",
  }),
  event({
    id: "33333333-3333-4333-8333-333333333333",
    external_id: "test0003",
    magnitude: null,
    depth_km: null,
    place: "Dorsal de prueba",
    status: "automatic",
  }),
];

export const SECOND_PAGE: Earthquake[] = [
  event({
    id: "44444444-4444-4444-8444-444444444444",
    external_id: "test0004",
    magnitude: 2.1,
    place: "5 km WNW of Ejemplo, Testland",
  }),
];

export const BLAST = event({
  id: "55555555-5555-4555-8555-555555555555",
  external_id: "test0005",
  magnitude: 1.9,
  event_type: "quarry blast",
  place: "Cantera de prueba",
});

export function meta(overrides: Partial<Meta> = {}): Meta {
  return {
    source: { name: "USGS", url: "https://earthquake.usgs.gov/" },
    coverage: { start: "2026-09-22T03:58:52Z", end: COVERAGE_END },
    last_successful_sync_at: new Date(Date.now() - 2 * 60_000).toISOString(),
    is_stale: false,
    stale_after_seconds: 900,
    data_version: 9,
    default_event_type: "earthquake",
    limits: {
      max_window_days: 31,
      default_window_days: 7,
      default_page_size: 50,
      max_page_size: 100,
      max_map_points: 5000,
    },
    ...overrides,
  };
}
