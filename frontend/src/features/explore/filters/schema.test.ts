import { describe, expect, it } from "vitest";

import { toListQuery } from "./api-query";
import { DEFAULT_FILTERS, parseFilters, serializeFilters } from "./schema";

const COVERAGE_END = "2026-10-22T04:33:36Z";

describe("filtros en la URL", () => {
  it("sin parámetros usa los valores por defecto", () => {
    expect(parseFilters(new URLSearchParams())).toEqual(DEFAULT_FILTERS);
    expect(DEFAULT_FILTERS).toMatchObject({
      period: "7d",
      types: "earthquake",
      order: "magnitude",
    });
  });

  it("ida y vuelta conserva los filtros y solo escribe lo que cambia", () => {
    const params = new URLSearchParams("period=24h&min_magnitude=4.5&types=all&order=recent");
    const filters = parseFilters(params);

    expect(filters).toMatchObject({
      period: "24h",
      min_magnitude: 4.5,
      types: "all",
      order: "recent",
    });
    expect(serializeFilters(filters).toString()).toBe(
      "period=24h&min_magnitude=4.5&types=all&order=recent",
    );
    expect(serializeFilters(DEFAULT_FILTERS).toString()).toBe("");
  });

  it("descarta valores inválidos o manipulados sin fallar", () => {
    const filters = parseFilters(
      new URLSearchParams(
        "period=5y&min_magnitude=abc&max_magnitude=99&min_depth_km=&types=x&order=place&event=no-uuid",
      ),
    );

    expect(filters).toEqual(DEFAULT_FILTERS);
  });

  it("descarta un máximo menor que el mínimo", () => {
    const filters = parseFilters(new URLSearchParams("min_magnitude=6&max_magnitude=5"));

    expect(filters.min_magnitude).toBe(6);
    expect(filters.max_magnitude).toBeUndefined();
  });

  it("acepta un evento con UUID válido", () => {
    const id = "22222222-2222-4222-8222-222222222222";

    expect(parseFilters(new URLSearchParams(`event=${id}`)).event).toBe(id);
  });
});

describe("parámetros de la API", () => {
  it("7 días usa la ventana por defecto de la API y no necesita la cobertura", () => {
    expect(toListQuery(DEFAULT_FILTERS, undefined)).toEqual({
      ordering: "-magnitude",
      page_size: 50,
    });
  });

  it("24 h y 30 días cuentan desde el final de la cobertura", () => {
    const day = toListQuery({ ...DEFAULT_FILTERS, period: "24h" }, COVERAGE_END);
    const month = toListQuery({ ...DEFAULT_FILTERS, period: "30d" }, COVERAGE_END);

    expect(day?.start).toBe("2026-10-21T04:33:36.000Z");
    expect(month?.start).toBe("2026-09-22T04:33:36.000Z");
  });

  it("espera a la cobertura si el periodo la necesita", () => {
    expect(toListQuery({ ...DEFAULT_FILTERS, period: "24h" }, undefined)).toBeNull();
  });

  it("traduce tipos, orden y rangos", () => {
    const query = toListQuery(
      { ...DEFAULT_FILTERS, types: "all", order: "recent", min_magnitude: 4, max_depth_km: 70 },
      COVERAGE_END,
    );

    expect(query).toEqual({
      event_type: "all",
      ordering: "-occurred_at",
      page_size: 50,
      min_magnitude: 4,
      max_depth_km: 70,
    });
  });
});
