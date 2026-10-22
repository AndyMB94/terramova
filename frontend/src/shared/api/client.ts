import createClient from "openapi-fetch";

import { ApiRequestError } from "./errors";
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

interface FetchResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/** Devuelve los datos o lanza `ApiRequestError` con el estado y el cuerpo `{code, message}`. */
export function unwrap<T>({ data, error, response }: FetchResult<T>): T {
  if (data === undefined) {
    throw new ApiRequestError(response.status, error);
  }
  return data;
}
