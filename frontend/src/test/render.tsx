import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, type RouteObject, RouterProvider } from "react-router";

import { shouldRetry } from "@/shared/api/errors";
import { PreferencesProvider } from "@/shared/hooks/preferences";

/** Renderiza rutas reales con un QueryClient nuevo (sin caché compartida entre tests). */
export function renderRoutes(routes: RouteObject[], path = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: shouldRetry, retryDelay: 0, staleTime: 60_000 } },
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <RouterProvider router={router} />
      </PreferencesProvider>
    </QueryClientProvider>,
  );
  return { ...view, router, queryClient };
}
