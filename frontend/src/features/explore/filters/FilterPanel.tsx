import { useId, useState } from "react";

import {
  DEPTH_RANGE,
  type ExploreFilters,
  MAGNITUDE_RANGE,
  type Period,
} from "@/features/explore/filters/schema";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/Button";

import { NumberField } from "./NumberField";
import { useImmediateValue } from "./useImmediateValue";

const PERIOD_LABELS: Record<Period, string> = { "24h": "24 h", "7d": "7 días", "30d": "30 días" };

interface FilterPanelProps {
  filters: ExploreFilters;
  onChange: (changes: Partial<ExploreFilters>) => void;
  onReset: () => void;
  periodRange?: string;
  /** Área visible del globo como bbox (null si se ve todo el planeta). */
  onUseMapView: () => string | null;
  mapAvailable: boolean;
  /** Explica por qué no se puede elegir el área cuando no hay globo en la página. */
  mapUnavailableHint?: string;
}

const legendClass = "mb-2.5 p-0 text-xs font-medium tracking-wider text-muted-foreground uppercase";

export function FilterPanel({
  filters,
  onChange,
  onReset,
  periodRange,
  onUseMapView,
  mapAvailable,
  mapUnavailableHint = "Requiere el globo, que no está disponible en este navegador.",
}: FilterPanelProps) {
  const typesId = useId();
  const [bbox, setBbox] = useImmediateValue(filters.bbox);
  const [areaHint, setAreaHint] = useState<string | null>(null);

  const useWorld = () => {
    setAreaHint(null);
    setBbox(undefined);
    onChange({ bbox: undefined });
  };
  const useMapView = () => {
    const view = onUseMapView();
    if (!view) {
      setAreaHint("La vista abarca casi todo el planeta: acerca el mapa para elegir un área.");
      return;
    }
    setAreaHint(null);
    setBbox(view);
    onChange({ bbox: view });
  };
  const [period, setPeriod] = useImmediateValue(filters.period);
  const [allTypes, setAllTypes] = useImmediateValue(filters.types === "all");
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold">Filtros</h2>
        <Button variant="link" size="sm" onClick={onReset}>
          Restablecer
        </Button>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={legendClass}>Periodo</legend>
        <div className="grid grid-cols-3 gap-1 rounded-[10px] border border-border-subtle bg-surface p-1">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((option) => {
            const active = option === period;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setPeriod(option);
                  onChange({ period: option });
                }}
                className={cn(
                  "h-9 cursor-pointer rounded-sm text-[13px] transition-colors duration-[var(--duration-fast)]",
                  active
                    ? "bg-selected font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {PERIOD_LABELS[option]}
              </button>
            );
          })}
        </div>
        {periodRange ? (
          <p className="tabular font-mono text-xs text-muted-foreground">{periodRange} · UTC</p>
        ) : null}
      </fieldset>

      <fieldset>
        <legend className={legendClass}>Magnitud</legend>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Mínima"
            value={filters.min_magnitude}
            min={MAGNITUDE_RANGE.min}
            max={MAGNITUDE_RANGE.max}
            placeholder="Cualquiera"
            onCommit={(min_magnitude) => onChange({ min_magnitude })}
          />
          <NumberField
            label="Máxima"
            value={filters.max_magnitude}
            min={MAGNITUDE_RANGE.min}
            max={MAGNITUDE_RANGE.max}
            placeholder="Cualquiera"
            lowerBound={filters.min_magnitude}
            onCommit={(max_magnitude) => onChange({ max_magnitude })}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className={legendClass}>Profundidad (km)</legend>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Mínima"
            value={filters.min_depth_km}
            min={DEPTH_RANGE.min}
            max={DEPTH_RANGE.max}
            placeholder="Cualquiera"
            onCommit={(min_depth_km) => onChange({ min_depth_km })}
          />
          <NumberField
            label="Máxima"
            value={filters.max_depth_km}
            min={DEPTH_RANGE.min}
            max={DEPTH_RANGE.max}
            placeholder="Cualquiera"
            lowerBound={filters.min_depth_km}
            onCommit={(max_depth_km) => onChange({ max_depth_km })}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className={legendClass}>Área</legend>
        <div className="grid grid-cols-2 gap-1 rounded-[10px] border border-border-subtle bg-surface p-1">
          <button
            type="button"
            aria-pressed={!bbox}
            onClick={useWorld}
            className={cn(
              "h-9 cursor-pointer rounded-sm text-[13px]",
              !bbox ? "bg-selected font-medium" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Todo el mundo
          </button>
          <button
            type="button"
            aria-pressed={Boolean(bbox)}
            disabled={!mapAvailable}
            onClick={useMapView}
            className={cn(
              "h-9 cursor-pointer rounded-sm text-[13px] disabled:cursor-not-allowed disabled:opacity-50",
              bbox ? "bg-selected font-medium" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Vista del mapa
          </button>
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {!mapAvailable
            ? mapUnavailableHint
            : (areaHint ??
              (bbox
                ? "Filtrando por el área visible al pulsar. Vuelve a pulsar para actualizarla."
                : "Mueve el mapa y pulsa «Vista del mapa» para filtrar por esa zona."))}
        </p>
      </fieldset>

      <div className="flex items-start gap-2.5 text-[13px] text-tertiary">
        <input
          id={typesId}
          type="checkbox"
          checked={allTypes}
          onChange={(event) => {
            setAllTypes(event.target.checked);
            onChange({ types: event.target.checked ? "all" : "earthquake" });
          }}
          className="mt-0.5 size-[18px] accent-[var(--tm-accent)]"
        />
        <label htmlFor={typesId} className="cursor-pointer">
          Incluir otros tipos
          <span className="block text-xs text-muted-foreground">
            Voladuras, explosiones, sismos de hielo…
          </span>
        </label>
      </div>
    </div>
  );
}
