/**
 * Modos de calidad del globo (docs/DECISIONS.md D84–D85). Lógica pura, sin Cesium: el
 * componente aplica el perfil a la escena.
 */
export type QualityChoice = "auto" | "high" | "low";
export type QualityLevel = "high" | "low";

export interface QualityProfile {
  msaaSamples: number;
  atmosphere: boolean;
  resolutionScale: number;
  /** Brillo, saturación y gamma de las imágenes: compensan el globo apagado sin atmósfera. */
  imageryBrightness: number;
  imagerySaturation: number;
  imageryGamma: number;
  /** Ondas animadas (dibujo continuo) o anillo fijo. */
  animatedRipples: boolean;
}

export const QUALITY_PROFILES: Record<QualityLevel, QualityProfile> = {
  high: {
    msaaSamples: 4,
    atmosphere: true,
    resolutionScale: 1,
    imageryBrightness: 1,
    imagerySaturation: 1,
    imageryGamma: 1,
    animatedRipples: true,
  },
  // Medido en el equipo de referencia: 60 fps girando con 5.000 puntos (D84). Brillo,
  // saturación y gamma ajustados para igualar la luminosidad media del globo con
  // atmósfera (84 frente a 91 sobre 255) sin quemar las nubes.
  low: {
    msaaSamples: 1,
    atmosphere: false,
    resolutionScale: 0.75,
    imageryBrightness: 1.4,
    imagerySaturation: 0.75,
    imageryGamma: 1.6,
    animatedRipples: false,
  },
};

export const QUALITY_CHOICES: readonly QualityChoice[] = ["auto", "high", "low"];

export function parseQualityChoice(value: string | null): QualityChoice {
  return value === "high" || value === "low" ? value : "auto";
}

/** En automático se empieza en alta, salvo en pantallas táctiles (móvil), y se baja si los fps caen. */
export function resolveQuality(choice: QualityChoice, autoLevel: QualityLevel): QualityLevel {
  return choice === "auto" ? autoLevel : choice;
}

export const LOW_FPS_THRESHOLD = 45;
export const FPS_WINDOW_MS = 3_000;

/**
 * Cuenta fotogramas solo mientras hay una animación que dibuja de forma continua y entrega
 * la media al cerrar cada ventana. Una pausa (sin animación) descarta la ventana en curso:
 * los huecos no deben contar como fotogramas lentos.
 */
export class FpsMeter {
  private start: number | null = null;
  private frames = 0;
  private readonly windowMs: number;

  constructor(windowMs = FPS_WINDOW_MS) {
    this.windowMs = windowMs;
  }

  frame(now: number): number | null {
    if (this.start === null) {
      this.start = now;
      this.frames = 0;
      return null;
    }
    this.frames += 1;
    const elapsed = now - this.start;
    if (elapsed < this.windowMs) return null;
    const fps = (this.frames * 1000) / elapsed;
    this.start = now;
    this.frames = 0;
    return fps;
  }

  reset(): void {
    this.start = null;
    this.frames = 0;
  }
}
