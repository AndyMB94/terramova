import { type KeyboardEvent, useRef } from "react";

import { cn } from "@/shared/lib/utils";

import { LIST_TABS, type ListTab, panelId, tabId } from "./tabs";

/** Pestañas de la columna derecha (patrón ARIA: flechas para cambiar de pestaña). */
export function ListTabs({
  tab,
  onChange,
  favoritesCount,
}: {
  tab: ListTab;
  onChange: (tab: ListTab) => void;
  favoritesCount: number;
}) {
  const refs = useRef<Record<ListTab, HTMLButtonElement | null>>({
    events: null,
    favorites: null,
  });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = LIST_TABS[(LIST_TABS.indexOf(tab) + 1) % LIST_TABS.length] ?? "events";
    onChange(next);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Lista de eventos"
      onKeyDown={onKeyDown}
      className="mx-4 mt-3 grid grid-cols-2 gap-1 rounded-[10px] border border-border-subtle bg-surface p-1 lg:mx-5"
    >
      {LIST_TABS.map((option) => (
        <button
          key={option}
          ref={(element) => {
            refs.current[option] = element;
          }}
          type="button"
          role="tab"
          id={tabId(option)}
          aria-selected={tab === option}
          aria-controls={panelId(option)}
          tabIndex={tab === option ? 0 : -1}
          onClick={() => onChange(option)}
          className={cn(
            "h-9 cursor-pointer rounded-sm text-[13px]",
            tab === option
              ? "bg-selected font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option === "events" ? "Eventos" : `Favoritos (${favoritesCount})`}
        </button>
      ))}
    </div>
  );
}
