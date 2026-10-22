import createClient from "openapi-fetch";

import type { paths } from "./schema";

// Mismo origen: en desarrollo Vite hace de proxy de /api; en producción, Nginx.
// Los tipos salen de schema.d.ts, generado desde backend/openapi/schema.yaml (`pnpm gen:api`).
export const apiClient = createClient<paths>({ baseUrl: "" });
