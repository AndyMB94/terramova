// Escala de profundidad compartida por lista, ficha, leyenda y (Fase 3, PR 2) globo.

export interface DepthClass {
  /** Límite superior exclusivo en km (Infinity para la última clase). */
  maxKm: number;
  label: string;
  /** Variable CSS del token de color. */
  cssVar: string;
  /** Mismo color en hexadecimal para WebGL (Cesium no lee variables CSS). */
  hex: string;
}

export const DEPTH_CLASSES: readonly DepthClass[] = [
  { maxKm: 35, label: "0 – 35 km", cssVar: "var(--tm-depth-1)", hex: "#fde68a" },
  { maxKm: 70, label: "35 – 70 km", cssVar: "var(--tm-depth-2)", hex: "#f9a43f" },
  { maxKm: 150, label: "70 – 150 km", cssVar: "var(--tm-depth-3)", hex: "#e8603c" },
  { maxKm: 300, label: "150 – 300 km", cssVar: "var(--tm-depth-4)", hex: "#d0508a" },
  { maxKm: Infinity, label: "300 km o más", cssVar: "var(--tm-depth-5)", hex: "#9b55d0" },
];

export function depthClass(depthKm: number | null | undefined): DepthClass | null {
  if (depthKm === null || depthKm === undefined) return null;
  return DEPTH_CLASSES.find((item) => depthKm < item.maxKm) ?? null;
}
