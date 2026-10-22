// Textos de la analítica en español a partir de la API (claves estables, números y UTC).

import { DEPTH_CLASSES, type DepthClass } from "@/shared/lib/depth";

const LOCALE = "es";
const number = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat(LOCALE, {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});
const day = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", timeZone: "UTC" });
const hour = new Intl.DateTimeFormat(LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

export type Granularity = "hour" | "day";

/** Fecha suelta en UTC: "22 de septiembre de 2026". */
export function formatDay(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(iso),
  );
}

/** "< 1", "3 – 4", "7 o más" a partir de los límites [min, max) de la API. */
export function rangeLabel(min: number | null, max: number | null, unit = ""): string {
  const suffix = unit ? ` ${unit}` : "";
  if (min === null && max !== null) return `< ${number.format(max)}${suffix}`;
  if (max === null && min !== null) return `${number.format(min)}${suffix} o más`;
  return `${number.format(min ?? 0)} – ${number.format(max ?? 0)}${suffix}`;
}

/** Clase de profundidad de la leyenda del mapa (mismo color y texto) para unos límites. */
export function depthClassFor(maxKm: number | null): DepthClass | undefined {
  return DEPTH_CLASSES.find((item) => item.maxKm === (maxKm ?? Infinity));
}

/** Etiqueta corta del eje: "15 oct" (día) o "14:00" (hora), siempre en UTC. */
export function bucketTick(startIso: string, granularity: Granularity): string {
  const date = new Date(startIso);
  return granularity === "day" ? day.format(date) : hour.format(date);
}

/** Intervalo completo para tablas y tooltips: "15 oct, 14:00–15:00 UTC" o "15 oct UTC". */
export function bucketRange(startIso: string, endIso: string, granularity: Granularity): string {
  const start = new Date(startIso);
  if (granularity === "day") return `${day.format(start)} UTC`;
  return `${day.format(start)}, ${hour.format(start)}–${hour.format(new Date(endIso))} UTC`;
}

/** Variación con signo tipográfico: "−11,6 %", "+4 %" o "0 %" (espacio duro antes de %). */
export function formatChange(current: number, previous: number): string | null {
  if (previous === 0) return null;
  return percent.format((current - previous) / previous).replace("-", "−");
}

/** Porcentaje del total para las tablas: "12,5 %". */
export function shareOf(count: number, total: number): string {
  if (total === 0) return "0\u00a0%";
  return new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: 1 }).format(
    count / total,
  );
}
