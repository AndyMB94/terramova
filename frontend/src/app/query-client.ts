import { QueryClient } from "@tanstack/react-query";

// Reintentos acotados: la API pública no debe recibir ráfagas por fallos repetidos.
// staleTime se alineará con el ciclo de sincronización cuando exista la API (Fase 2).
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        staleTime: 60_000,
        refetchOnWindowFocus: false,
      },
    },
  });
}
