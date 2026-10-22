import { useRef } from "react";

/**
 * Operaciones del globo que necesitan otras partes de la página (p. ej. el filtro de
 * área). Sin dependencias de Cesium: el módulo pesado se carga aparte.
 */
export interface GlobeApi {
  /** Área visible como `bbox` de la API, o null si se ve todo el planeta. */
  getViewBbox: () => string | null;
}

export type GlobeApiRef = { current: GlobeApi | null };

export function useGlobeApiRef(): GlobeApiRef {
  return useRef<GlobeApi | null>(null);
}
