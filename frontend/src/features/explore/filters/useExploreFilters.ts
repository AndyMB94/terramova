import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

import {
  DEFAULT_FILTERS,
  type ExploreFilters,
  parseFilters,
  serializeFilters,
} from "@/features/explore/filters/schema";

export function useExploreFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  const update = useCallback(
    (changes: Partial<ExploreFilters>) => {
      setSearchParams((current) => serializeFilters({ ...parseFilters(current), ...changes }), {
        replace: true,
      });
    },
    [setSearchParams],
  );

  const reset = useCallback(() => {
    setSearchParams((current) => {
      // Restablecer conserva el evento seleccionado: es una vista, no un filtro.
      const event = parseFilters(current).event;
      return serializeFilters({ ...DEFAULT_FILTERS, event });
    });
  }, [setSearchParams]);

  return { filters, update, reset };
}
