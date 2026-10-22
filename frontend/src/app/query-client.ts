import { QueryClient } from "@tanstack/react-query";

import { shouldRetry } from "@/shared/api/errors";

// Reintentos acotados (solo red y 5xx) y datos frescos durante 60 s, alineado con el
// Cache-Control de la API: la sincronización con USGS corre cada pocos minutos.
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        staleTime: 60_000,
        refetchOnWindowFocus: false,
      },
    },
  });
}
