import { Star } from "lucide-react";
import { useState } from "react";

import { cn } from "@/shared/lib/utils";

import type { FavoriteInput } from "./storage";
import { MAX_FAVORITES } from "./storage";
import { useFavorites } from "./useFavorites";

/** Guardar o quitar un evento de los favoritos de este navegador. */
export function FavoriteButton({ event }: { event: FavoriteInput }) {
  const { available, isFavorite, toggle } = useFavorites();
  const [message, setMessage] = useState<string | null>(null);
  const saved = isFavorite(event.id);

  const onClick = () => {
    const result = toggle(event);
    setMessage(
      result === "full"
        ? `Ya tienes ${MAX_FAVORITES} favoritos: quita alguno para guardar más.`
        : result === "unavailable"
          ? "No se pudo guardar: el navegador no permite almacenar datos."
          : null,
    );
  };

  return (
    <div className="flex flex-col gap-1">
      {/* La etiqueta dice la acción que hará: guardar o quitar (evita quitar sin querer). */}
      <button
        type="button"
        disabled={!available}
        onClick={onClick}
        className={cn(
          "flex h-9 cursor-pointer items-center gap-2 self-start rounded-md border border-border px-3 text-[13px] disabled:cursor-not-allowed disabled:opacity-50",
          saved ? "bg-selected font-medium" : "bg-surface-raised text-tertiary",
        )}
      >
        <Star
          aria-hidden="true"
          className={cn("size-4", saved && "fill-[var(--tm-accent)] text-[var(--tm-accent)]")}
        />
        {saved ? "Quitar de favoritos" : "Guardar en favoritos"}
      </button>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {!available
          ? "Este navegador no permite guardar favoritos (modo privado o almacenamiento bloqueado)."
          : message}
      </p>
    </div>
  );
}
