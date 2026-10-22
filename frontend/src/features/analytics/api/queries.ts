import { useQuery } from "@tanstack/react-query";

import type { FilterQuery } from "@/features/explore";
import { apiClient, unwrap } from "@/shared/api/client";
import type { components } from "@/shared/api/schema";

export type Summary = components["schemas"]["SummaryResponse"];
export type Timeline = components["schemas"]["TimelineResponse"];

// Mismos parámetros que la lista y el mapa: la URL de filtros es la fuente de verdad.
// Mientras llega la consulta nueva se mantiene la anterior para no vaciar las gráficas.

export function useAnalyticsSummary(query: FilterQuery | null) {
  return useQuery({
    queryKey: ["analytics-summary", query],
    enabled: query !== null,
    queryFn: async ({ signal }) =>
      unwrap(
        await apiClient.GET("/api/v1/analytics/summary/", {
          params: { query: query ?? {} },
          signal,
        }),
      ),
    placeholderData: (previous) => previous,
  });
}

export function useAnalyticsTimeline(query: FilterQuery | null) {
  return useQuery({
    queryKey: ["analytics-timeline", query],
    enabled: query !== null,
    queryFn: async ({ signal }) =>
      unwrap(
        await apiClient.GET("/api/v1/analytics/timeline/", {
          params: { query: query ?? {} },
          signal,
        }),
      ),
    placeholderData: (previous) => previous,
  });
}
