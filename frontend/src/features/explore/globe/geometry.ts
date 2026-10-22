// Cálculos puros del globo (sin Cesium): se prueban en Node.

export const MIN_POINT_PX = 4;
export const MAX_POINT_PX = 18;

/**
 * Tamaño visual del punto según la magnitud. Escala lineal acotada: no es proporcional a
 * la energía (que crece ~32 veces por unidad), solo ordena visualmente (docs/UI_UX.md).
 */
export function pointPixelSize(magnitude: number | null): number {
  if (magnitude === null) return MIN_POINT_PX;
  const size = 4 + Math.max(magnitude, 0) * 1.7;
  return Math.min(Math.max(size, MIN_POINT_PX), MAX_POINT_PX);
}

export interface DegreesRectangle {
  west: number;
  south: number;
  east: number;
  north: number;
}

/**
 * Área visible → parámetro `bbox` de la API ("oeste,sur,este,norte" en grados).
 * Si oeste > este el área cruza el antimeridiano (la API lo admite). Devuelve null si la
 * vista abarca prácticamente todo el planeta: no tiene sentido filtrar por área.
 */
export function rectangleToBbox(rect: DegreesRectangle): string | null {
  const width = rect.east >= rect.west ? rect.east - rect.west : rect.east + 360 - rect.west;
  if (width >= 359 && rect.north - rect.south >= 170) return null;

  const round = (value: number) => Math.round(value * 100) / 100;
  const west = round(clamp(rect.west, -180, 180));
  const east = round(clamp(rect.east, -180, 180));
  const south = round(clamp(rect.south, -90, 90));
  const north = round(clamp(rect.north, -90, 90));
  if (south >= north || west === east) return null;
  return `${west},${south},${east},${north}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
