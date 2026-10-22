import type { components } from "./schema";

/** Cuerpo de error de la API: `{code, message}` con códigos estables. */
export type ApiError = components["schemas"]["Error"];

export function isApiError(value: unknown): value is ApiError {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.code === "string" && typeof candidate.message === "string";
}
