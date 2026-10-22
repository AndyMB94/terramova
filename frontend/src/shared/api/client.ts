import createClient from "openapi-fetch";

import type { paths } from "./schema";

// Mismo origen: en desarrollo Vite hace de proxy de /api; en producción, Nginx.
// La URL absoluta permite usar el cliente también en tests (Node no acepta rutas relativas).
// Los tipos salen de schema.d.ts, generado desde backend/openapi/schema.yaml (`pnpm gen:api`).
// `fetch` se resuelve en cada llamada (no al cargar el módulo) para respetar cualquier
// sustitución posterior, como la de MSW en los tests.
export const apiClient = createClient<paths>({
  baseUrl: globalThis.location?.origin ?? "",
  fetch: (request) => globalThis.fetch(request),
});
