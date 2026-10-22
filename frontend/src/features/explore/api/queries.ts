import {
  type InfiniteData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { FilterQuery, ListQuery } from "@/features/explore/filters/api-query";
import { apiClient } from "@/shared/api/client";
import { ApiRequestError } from "@/shared/api/errors";
import type { components } from "@/shared/api/schema";

export type Earthquake = components["schemas"]["Earthquake"];
export type Meta = components["schemas"]["MetaResponse"];
type ListPage = components["schemas"]["EarthquakeListResponse"];
export type MapPoints = components["schemas"]["EarthquakeGeoJsonResponse"];

interface FetchResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

function unwrap<T>({ data, error, response }: FetchResult<T>): T {
  if (data === undefined) {
    throw new ApiRequestError(response.status, error);
  }
  return data;
}

export function useMeta() {
  return useQuery({
    queryKey: ["meta"],
    queryFn: async ({ signal }) => unwrap(await apiClient.GET("/api/v1/meta/", { signal })),
    staleTime: 30_000,
    // La frescura de los datos debe verse sin recargar la página.
    refetchInterval: 60_000,
  });
}

export function useEarthquakeList(query: ListQuery | null) {
  return useInfiniteQuery({
    queryKey: ["earthquakes", query],
    enabled: query !== null,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await apiClient.GET("/api/v1/earthquakes/", {
          params: { query: { ...query, ...(pageParam ? { cursor: pageParam } : {}) } },
          signal,
        }),
      ),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
}

export function useMapPoints(query: FilterQuery | null) {
  return useQuery({
    queryKey: ["map-points", query],
    enabled: query !== null,
    queryFn: async ({ signal }) =>
      unwrap(
        await apiClient.GET("/api/v1/earthquakes/geojson/", {
          params: { query: query ?? {} },
          signal,
        }),
      ),
    // Al cambiar los filtros se mantienen los puntos anteriores hasta que llegan los nuevos.
    placeholderData: (previous) => previous,
  });
}

export function useEarthquake(id: string | undefined) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["earthquake", id],
    enabled: id !== undefined,
    queryFn: async ({ signal }) =>
      unwrap(
        await apiClient.GET("/api/v1/earthquakes/{event_id}/", {
          params: { path: { event_id: id ?? "" } },
          signal,
        }),
      ),
    // Si el evento ya está en una lista cargada, se muestra al instante sin otra petición.
    initialData: () =>
      id ? findInLists(queryClient.getQueriesData({ queryKey: ["earthquakes"] }), id) : undefined,
  });
}

function findInLists(
  entries: [unknown, InfiniteData<ListPage> | undefined][],
  id: string,
): Earthquake | undefined {
  for (const [, data] of entries) {
    for (const page of data?.pages ?? []) {
      const found = page.results.find((event) => event.id === id);
      if (found) return found;
    }
  }
  return undefined;
}
