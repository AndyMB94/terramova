import { z } from "zod";

// Favoritos de este navegador: IDs y metadatos mínimos para mostrarlos sin pedir nada a
// la API (docs/ARCHITECTURE.md). El formato lleva versión: un contenido antiguo, ajeno o
// manipulado se descarta en vez de romper la página.

export const FAVORITES_KEY = "terramova:favorites";
export const FAVORITES_VERSION = 1;
export const MAX_FAVORITES = 100;

const favoriteSchema = z.object({
  id: z.uuid(),
  place: z.string().max(300),
  magnitude: z.number().min(-5).max(12).nullable(),
  occurred_at: z.iso.datetime({ offset: true }),
  saved_at: z.iso.datetime({ offset: true }),
});

export type Favorite = z.infer<typeof favoriteSchema>;
export type FavoriteInput = Omit<Favorite, "saved_at">;

const storedSchema = z.object({
  version: z.literal(FAVORITES_VERSION),
  items: z.array(z.unknown()).max(MAX_FAVORITES * 2),
});

/** Lee el contenido guardado; descarta entradas inválidas o repetidas, una a una. */
export function parseFavorites(raw: string | null): Favorite[] {
  if (!raw || raw.length > 200_000) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const stored = storedSchema.safeParse(data);
  if (!stored.success) return [];
  const seen = new Set<string>();
  const favorites: Favorite[] = [];
  for (const item of stored.data.items) {
    const parsed = favoriteSchema.safeParse(item);
    if (parsed.success && !seen.has(parsed.data.id)) {
      seen.add(parsed.data.id);
      favorites.push(parsed.data);
    }
  }
  return favorites.slice(0, MAX_FAVORITES);
}

export function serializeFavorites(favorites: readonly Favorite[]): string {
  return JSON.stringify({ version: FAVORITES_VERSION, items: favorites });
}

export type AddResult = "added" | "exists" | "full";

/** Añade al principio (los más recientes primero) respetando el límite. */
export function addFavorite(
  favorites: readonly Favorite[],
  input: FavoriteInput,
  now: Date = new Date(),
): { favorites: Favorite[]; result: AddResult } {
  if (favorites.some((favorite) => favorite.id === input.id)) {
    return { favorites: [...favorites], result: "exists" };
  }
  if (favorites.length >= MAX_FAVORITES) return { favorites: [...favorites], result: "full" };
  return {
    favorites: [{ ...input, saved_at: now.toISOString() }, ...favorites],
    result: "added",
  };
}
