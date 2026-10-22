import { describe, expect, it } from "vitest";

import {
  addFavorite,
  type Favorite,
  MAX_FAVORITES,
  parseFavorites,
  serializeFavorites,
} from "./storage";

function favorite(index: number, overrides: Partial<Favorite> = {}): Favorite {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    place: `Lugar ficticio ${index}`,
    magnitude: 4.2,
    occurred_at: "2026-10-21T18:04:11Z",
    saved_at: "2026-10-22T10:00:00.000Z",
    ...overrides,
  };
}

describe("formato de favoritos", () => {
  it("ida y vuelta conserva los datos", () => {
    const items = [favorite(1), favorite(2, { magnitude: null })];
    expect(parseFavorites(serializeFavorites(items))).toEqual(items);
  });

  it("contenido ausente, roto, de otra versión o ajeno: lista vacía sin fallar", () => {
    expect(parseFavorites(null)).toEqual([]);
    expect(parseFavorites("{no es json")).toEqual([]);
    expect(parseFavorites(JSON.stringify({ version: 2, items: [favorite(1)] }))).toEqual([]);
    expect(parseFavorites(JSON.stringify([favorite(1)]))).toEqual([]);
    expect(parseFavorites("x".repeat(300_000))).toEqual([]);
  });

  it("descarta entradas inválidas o repetidas una a una", () => {
    const raw = JSON.stringify({
      version: 1,
      items: [
        favorite(1),
        { ...favorite(2), id: "no-es-un-uuid" },
        { ...favorite(3), magnitude: 99 },
        { ...favorite(4), occurred_at: "ayer" },
        favorite(1),
        favorite(5),
      ],
    });
    expect(parseFavorites(raw).map((item) => item.place)).toEqual([
      "Lugar ficticio 1",
      "Lugar ficticio 5",
    ]);
  });

  it("añade al principio, no repite y respeta el límite", () => {
    const now = new Date("2026-10-22T12:00:00Z");
    const first = addFavorite([], favorite(1), now);
    expect(first.result).toBe("added");
    expect(first.favorites[0]?.saved_at).toBe("2026-10-22T12:00:00.000Z");

    const second = addFavorite(first.favorites, favorite(2), now);
    expect(second.favorites.map((item) => item.place)).toEqual([
      "Lugar ficticio 2",
      "Lugar ficticio 1",
    ]);
    expect(addFavorite(second.favorites, favorite(1), now).result).toBe("exists");

    const full = Array.from({ length: MAX_FAVORITES }, (_, index) => favorite(index + 10));
    const rejected = addFavorite(full, favorite(1), now);
    expect(rejected.result).toBe("full");
    expect(rejected.favorites).toHaveLength(MAX_FAVORITES);
  });
});
