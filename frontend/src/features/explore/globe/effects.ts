/**
 * Parámetros y cálculos puros de los efectos del globo (docs/UI_UX.md, "Sistema de
 * movimiento"). Sin Cesium, para poder probarlos sin WebGL.
 */

export const INTRO_SECONDS = 1.8;
export const SELECTION_FLIGHT_SECONDS = 1;
export const IDLE_DELAY_MS = 8_000;
/** Una vuelta cada 90 s. */
export const SPIN_RADIANS_PER_SECOND = (2 * Math.PI) / 90;
/** Tras una pausa larga (pestaña en segundo plano) no se recupera el giro perdido. */
const MAX_FRAME_MS = 100;

export function spinAngle(elapsedMs: number): number {
  const clamped = Math.min(Math.max(elapsedMs, 0), MAX_FRAME_MS);
  return (SPIN_RADIANS_PER_SECOND * clamped) / 1000;
}

export const RECENT_WINDOW_MS = 60 * 60 * 1000;
export const MAX_RIPPLES = 20;
export const RIPPLE_CYCLE_MS = 2_500;
const RIPPLE_GROWTH_PX = 26;

export interface RippleCandidate {
  id: string;
  magnitude: number | null;
  occurredAtMs: number;
}

/** Eventos de la última hora (hora real), los de mayor magnitud primero, como mucho 20. */
export function selectRipples<T extends RippleCandidate>(points: readonly T[], nowMs: number): T[] {
  return points
    .filter((point) => {
      const age = nowMs - point.occurredAtMs;
      return age >= 0 && age <= RECENT_WINDOW_MS;
    })
    .sort((a, b) => (b.magnitude ?? -Infinity) - (a.magnitude ?? -Infinity))
    .slice(0, MAX_RIPPLES);
}

export interface RippleFrame {
  /** Tamaño extra sobre el del punto, en píxeles. */
  growth: number;
  alpha: number;
}

/** Anillo fijo para movimiento reducido o calidad baja. */
export const STATIC_RIPPLE: RippleFrame = { growth: 10, alpha: 0.6 };

/**
 * Onda que se expande y se desvanece. `offset` (0–1) desfasa cada onda para que no
 * pulsen todas a la vez.
 */
export function rippleFrame(nowMs: number, offset: number): RippleFrame {
  const phase = (nowMs / RIPPLE_CYCLE_MS + offset) % 1;
  const eased = 1 - (1 - phase) ** 3;
  return { growth: RIPPLE_GROWTH_PX * eased, alpha: 0.9 * (1 - phase) };
}

/** Desfase estable por id (no cambia al recargar los datos). */
export function rippleOffset(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) | 0;
  }
  return (hash >>> 0) / 4294967296;
}
