import { useCallback, useState, useSyncExternalStore } from "react";

import {
  isStorageAvailable,
  readPreference,
  tryWritePreference,
  writePreference,
} from "@/shared/lib/storage";

import {
  addFavorite,
  type Favorite,
  type FavoriteInput,
  FAVORITES_KEY,
  parseFavorites,
  serializeFavorites,
} from "./storage";

// Mismo almacén para todos los componentes y pestañas: los cambios de esta pestaña se
// anuncian con un evento propio y los de otras llegan con el evento "storage".
const CHANGE_EVENT = "terramova:favorites-change";

let cachedRaw: string | null | undefined;
let cachedFavorites: Favorite[] = [];

function snapshot(): Favorite[] {
  const raw = readPreference(FAVORITES_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedFavorites = parseFavorites(raw);
  }
  return cachedFavorites;
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === FAVORITES_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function save(favorites: readonly Favorite[]): boolean {
  const ok = tryWritePreference(FAVORITES_KEY, serializeFavorites(favorites));
  if (ok) window.dispatchEvent(new Event(CHANGE_EVENT));
  return ok;
}

const EMPTY: Favorite[] = [];

export type ToggleResult = "added" | "removed" | "full" | "unavailable";

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  // Una vez por montaje (la comprobación escribe en el almacenamiento), no en cada render.
  const [available] = useState(isStorageAvailable);

  const isFavorite = useCallback(
    (id: string) => favorites.some((favorite) => favorite.id === id),
    [favorites],
  );

  const toggle = useCallback((input: FavoriteInput): ToggleResult => {
    const current = snapshot();
    if (current.some((favorite) => favorite.id === input.id)) {
      return save(current.filter((favorite) => favorite.id !== input.id))
        ? "removed"
        : "unavailable";
    }
    const { favorites: next, result } = addFavorite(current, input);
    if (result === "full") return "full";
    return save(next) ? "added" : "unavailable";
  }, []);

  const remove = useCallback((id: string) => {
    save(snapshot().filter((favorite) => favorite.id !== id));
  }, []);

  const clear = useCallback(() => {
    writePreference(FAVORITES_KEY, null);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { favorites, available, isFavorite, toggle, remove, clear };
}
