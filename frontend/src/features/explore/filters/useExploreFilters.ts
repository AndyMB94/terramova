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
      // Restablecer conserva el evento seleccionado y la vista del mapa: no son filtros.
      const { event, view } = parseFilters(current);
      return serializeFilters({ ...DEFAULT_FILTERS, event, view });
    });
  }, [setSearchParams]);

  return { filters, update, reset };
}
