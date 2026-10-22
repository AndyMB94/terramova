// Formato de datos sísmicos para la interfaz en español. Las fechas de la API llegan en UTC.

const LOCALE = "es";

const decimal1 = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const decimal3 = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});
const integer = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0, useGrouping: "always" });
const upTo1 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });

export function formatMagnitude(magnitude: number | null | undefined): string {
  return magnitude === null || magnitude === undefined ? "—" : decimal1.format(magnitude);
}

export function formatDepth(depthKm: number | null | undefined): string {
  return depthKm === null || depthKm === undefined ? "Sin dato" : `${upTo1.format(depthKm)} km`;
}

export function formatCount(value: number): string {
  return integer.format(value);
}

export function formatCoordinates(latitude: number, longitude: number): string {
  const lat = `${decimal3.format(Math.abs(latitude))}° ${latitude >= 0 ? "N" : "S"}`;
  const lon = `${decimal3.format(Math.abs(longitude))}° ${longitude >= 0 ? "E" : "O"}`;
  return `${lat} ${lon}`;
}

const dateTimeParts: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
};

export function formatLocalDateTime(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(LOCALE, { ...dateTimeParts, timeZone }).format(new Date(iso));
}

export function formatUtcDateTime(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, { ...dateTimeParts, timeZone: "UTC" }).format(
    new Date(iso),
  );
}

export function formatShortLocal(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(iso));
}

export function formatDateRange(startIso: string, endIso: string, timeZone?: string): string {
  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone };
  const start = new Intl.DateTimeFormat(LOCALE, options).format(new Date(startIso));
  const end = new Intl.DateTimeFormat(LOCALE, { ...options, year: "numeric" }).format(
    new Date(endIso),
  );
  return `${start} – ${end}`;
}

/** "UTC−5", "UTC+5:30" o "UTC" para la zona horaria del navegador (o la indicada). */
export function utcOffsetLabel(at: Date = new Date(), timeZone?: string): string {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
      .formatToParts(at)
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const offset = name.replace("GMT", "");
  return offset === "" || /^[+-]0$/.test(offset) ? "UTC" : `UTC${offset.replace("-", "−")}`;
}

const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: "always", style: "narrow" });

export function formatRelative(iso: string, now: Date = new Date()): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return relative.format(Math.sign(seconds) * Math.max(abs, 1), "second");
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), "hour");
  return relative.format(Math.round(seconds / 86400), "day");
}

const DIRECTIONS: Record<string, string> = {
  N: "N",
  S: "S",
  E: "E",
  W: "O",
  NE: "NE",
  NW: "NO",
  SE: "SE",
  SW: "SO",
  NNE: "NNE",
  ENE: "ENE",
  ESE: "ESE",
  SSE: "SSE",
  SSW: "SSO",
  WSW: "OSO",
  WNW: "ONO",
  NNW: "NNO",
};

/**
 * USGS describe el lugar en inglés ("192 km S of Burica, Panama"). Se traduce solo el
 * patrón de distancia y rumbo; los topónimos se conservan tal como los publica la fuente.
 */
export function formatPlace(place: string): string {
  const match = /^(\d+(?:\.\d+)?) km ([NSEW]{1,3}) of (.+)$/.exec(place.trim());
  if (!match) return place || "Ubicación sin descripción";
  const [, km, direction, rest] = match;
  const translated = direction ? DIRECTIONS[direction] : undefined;
  return translated ? `${km} km al ${translated} de ${rest}` : place;
}

const STATUS_LABELS: Record<string, string> = {
  reviewed: "Revisado por USGS",
  automatic: "Automático, sin revisar",
  deleted: "Retirado por USGS",
};

export function formatStatus(status: string): string {
  return STATUS_LABELS[status] ?? (status || "Sin dato");
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  earthquake: "Sismo",
  "quarry blast": "Voladura de cantera",
  explosion: "Explosión",
  "mining explosion": "Explosión minera",
  "ice quake": "Sismo de hielo",
  landslide: "Deslizamiento",
};

export function formatEventType(eventType: string): string {
  return EVENT_TYPE_LABELS[eventType] ?? (eventType || "Sin dato");
}
