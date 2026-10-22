import { X } from "lucide-react";
import { useState } from "react";

import { formatMagnitude, formatPlace, formatShortLocal } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/Button";

import { useFavorites } from "./useFavorites";

interface FavoritesListProps {
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  /** Si el evento está entre los puntos del mapa con los filtros actuales. */
  isOnMap: (id: string) => boolean;
}

/** Favoritos guardados en este navegador, con borrado individual o total (confirmado). */
export function FavoritesList({ selectedId, onSelect, isOnMap }: FavoritesListProps) {
  const { favorites, available, remove, clear } = useFavorites();
  const [confirming, setConfirming] = useState(false);

  if (!available) {
    return (
      <p className="px-4 py-3 text-[13px] text-muted-foreground lg:px-5">
        Este navegador no permite guardar favoritos (modo privado o almacenamiento bloqueado). Todo
        lo demás funciona igual.
      </p>
    );
  }
  if (favorites.length === 0) {
    return (
      <p className="px-4 py-3 text-[13px] text-muted-foreground lg:px-5">
        Aún no has guardado favoritos. Abre un evento y pulsa «Guardar en favoritos». Se guardan
        solo en este navegador.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 lg:px-3">
        {favorites.map((favorite) => {
          const place = formatPlace(favorite.place);
          return (
            <li key={favorite.id} className="flex items-center gap-1">
              <button
                type="button"
                id={`favorite-${favorite.id}`}
                aria-label={`${place}, magnitud ${formatMagnitude(favorite.magnitude)}, ${formatShortLocal(favorite.occurred_at)}${isOnMap(favorite.id) ? "" : ", fuera de los filtros actuales"}`}
                onClick={() => onSelect(favorite.id)}
                aria-current={favorite.id === selectedId ? "true" : undefined}
                className={cn(
                  "flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md px-2 py-2.5 text-left",
                  favorite.id === selectedId ? "bg-selected" : "hover:bg-surface-raised",
                )}
              >
                <span className="tabular w-10 shrink-0 font-mono text-base font-medium">
                  {formatMagnitude(favorite.magnitude)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px]">{place}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatShortLocal(favorite.occurred_at)}
                    {isOnMap(favorite.id) ? "" : " · fuera de los filtros actuales"}
                  </span>
                </span>
              </button>
              <button
                type="button"
                aria-label={`Quitar ${place} de favoritos`}
                onClick={() => remove(favorite.id)}
                className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-surface-raised hover:text-foreground"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-border-subtle px-4 py-3 lg:px-5">
        {confirming ? (
          <div role="group" aria-label="Confirmar borrado" className="flex flex-col gap-2">
            <p className="text-[13px]">
              ¿Borrar los {favorites.length} favoritos de este navegador? No se puede deshacer.
            </p>
            <div className="flex gap-2">
              <Button
                variant="solid"
                size="sm"
                onClick={() => {
                  clear();
                  setConfirming(false);
                }}
              >
                Sí, borrar todos
              </Button>
              <Button size="sm" onClick={() => setConfirming(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" onClick={() => setConfirming(true)}>
            Borrar todos
          </Button>
        )}
      </div>
    </div>
  );
}
