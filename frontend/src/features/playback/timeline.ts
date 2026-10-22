// Reproducción temporal (docs/UI_UX.md): un cursor recorre la ventana de datos y el globo
// muestra solo lo ocurrido hasta él. Lógica pura: no cambia los datos, solo los filtra.

/** A ×1 la ventana entera dura 30 s, sea de 24 horas o de 30 días. */
export const PLAYBACK_DURATION_MS = 30_000;
export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];
/** Pasos del cursor con el teclado: 1/100 de la ventana. */
export const KEYBOARD_STEPS = 100;

export interface PlaybackWindow {
  startMs: number;
  endMs: number;
}

/** Avanza el cursor según el tiempo real transcurrido; se detiene al final. */
export function advanceCursor(
  cursorMs: number,
  elapsedMs: number,
  speed: Speed,
  range: PlaybackWindow,
): { cursorMs: number; ended: boolean } {
  const span = range.endMs - range.startMs;
  if (span <= 0) return { cursorMs: range.endMs, ended: true };
  const next = cursorMs + (span / PLAYBACK_DURATION_MS) * speed * Math.max(elapsedMs, 0);
  return next >= range.endMs
    ? { cursorMs: range.endMs, ended: true }
    : { cursorMs: next, ended: false };
}

/** Lo ocurrido en el último segundo de reproducción (a ×1) se marca como recién aparecido. */
export function recentSpanMs(range: PlaybackWindow): number {
  return (range.endMs - range.startMs) / (PLAYBACK_DURATION_MS / 1000);
}

/** Eventos ocurridos hasta el cursor (incluido). */
export function visibleUntil<T extends { occurredAtMs: number }>(
  points: readonly T[],
  cursorMs: number,
): T[] {
  return points.filter((point) => point.occurredAtMs <= cursorMs);
}

const cursorFormat = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

/** "15 oct, 14:32 UTC" */
export function formatCursor(ms: number): string {
  return `${cursorFormat.format(new Date(ms))} UTC`;
}
