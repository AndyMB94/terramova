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

/** Fallo de una petición: estado HTTP (0 sin respuesta) y cuerpo `{code, message}` si lo hubo. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly body: ApiError | undefined;

  constructor(status: number, body: unknown) {
    const parsed = isApiError(body) ? body : undefined;
    super(parsed?.message ?? `La API respondió con el estado ${status}.`);
    this.name = "ApiRequestError";
    this.status = status;
    this.body = parsed;
  }

  get code(): string | undefined {
    return this.body?.code;
  }
}

/** Mensaje para el visitante, sin detalles técnicos. */
export function userMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 429)
      return "Hay demasiadas consultas en este momento. Espera unos segundos.";
    if (error.status === 404) return "No se encontró lo que buscabas.";
    if (error.status === 400) return error.message;
    if (error.status >= 500) return "El servicio no está disponible temporalmente.";
  }
  return "No se pudo conectar con el servicio. Revisa tu conexión.";
}

/** Los errores del cliente (4xx) no mejoran al reintentar; los de red y 5xx sí, con límite. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < 2;
}
