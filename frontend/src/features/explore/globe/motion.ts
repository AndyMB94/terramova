import { Cartesian3, type CesiumWidget, EasingFunction, SceneMode } from "cesium";

import { IDLE_DELAY_MS, INTRO_SECONDS, spinAngle } from "./effects";
import { FpsMeter } from "./quality";
import type { RippleLayer } from "./ripples";

export interface MotionOptions {
  widget: CesiumWidget;
  ripples: RippleLayer;
  /** Contenedor donde se reflejan intro y giro como atributos `data-*` (pruebas y depuración). */
  host: HTMLElement;
  /** Media de fps de cada ventana medida durante una animación continua. */
  onFps: (fps: number) => void;
}

interface Destination {
  longitude: number;
  latitude: number;
  height: number;
}

const INTERACTION_EVENTS = ["pointerdown", "wheel", "keydown", "touchstart"] as const;

/**
 * Director del movimiento del globo (docs/UI_UX.md): intro, giro en inactividad, vuelos y
 * ondas. Es el único que mueve la cámara sola, así que nunca se animan dos cosas a la vez:
 * durante un vuelo no hay giro, tocar el globo cancela el vuelo y cualquier interacción
 * con la página reinicia la cuenta de inactividad.
 *
 * Se engancha a `scene.preUpdate`, que Cesium ejecuta en cada fotograma aunque no dibuje
 * (render bajo demanda). Solo pide dibujar mientras hay algo animándose.
 */
export class GlobeMotion {
  reducedMotion = false;
  /** El usuario pulsó "Pausar giro". */
  spinPaused = false;
  /** Con un evento seleccionado no se gira: el punto se iría de la vista. */
  hasSelection = false;
  /** Durante la reproducción temporal la cámara no se mueve sola. */
  playbackActive = false;

  private readonly widget: CesiumWidget;
  private readonly ripples: RippleLayer;
  private readonly host: HTMLElement;
  private readonly onFps: (fps: number) => void;
  private readonly meter = new FpsMeter();
  private readonly removeListeners: (() => void)[] = [];
  private flight = 0;
  private flying = false;
  /** Destino de la intro mientras se reproduce; saltarla lleva directamente a él. */
  private intro: Destination | null = null;
  private continuous = false;
  private spinning = false;
  private lastInteraction = performance.now();
  private lastFrame: number | null = null;

  constructor({ widget, ripples, host, onFps }: MotionOptions) {
    this.widget = widget;
    this.ripples = ripples;
    this.host = host;
    this.onFps = onFps;
    const { scene } = widget;
    this.removeListeners.push(
      scene.preUpdate.addEventListener(() => this.tick()),
      scene.postRender.addEventListener(() => this.countFrame()),
    );

    // Inactividad = sin tocar la página, no solo el globo: quien usa la lista no está
    // inactivo. Pero solo tocar el globo cancela un vuelo: pulsar otro control no lo corta.
    const active = () => this.markActive();
    const takeControl = () => this.takeControl();
    for (const type of INTERACTION_EVENTS) {
      document.addEventListener(type, active, { capture: true, passive: true });
      host.addEventListener(type, takeControl, { capture: true, passive: true });
    }
    const drag = (event: PointerEvent) => {
      if (event.buttons !== 0) this.markActive();
    };
    document.addEventListener("pointermove", drag, { capture: true, passive: true });
    document.addEventListener("visibilitychange", active);
    this.removeListeners.push(() => {
      for (const type of INTERACTION_EVENTS) {
        document.removeEventListener(type, active, { capture: true });
        host.removeEventListener(type, takeControl, { capture: true });
      }
      document.removeEventListener("pointermove", drag, { capture: true });
      document.removeEventListener("visibilitychange", active);
    });
    this.host.dataset.spin = "off";
  }

  destroy(): void {
    for (const remove of this.removeListeners) remove();
    this.widget.camera.cancelFlight();
  }

  /** Acercamiento inicial desde órbita lejana; con `play = false`, corte directo. */
  playIntro(home: Destination, play: boolean): void {
    if (!play || this.reducedMotion) {
      this.host.dataset.intro = "skipped";
      return;
    }
    const { camera } = this.widget;
    camera.setView({
      destination: Cartesian3.fromDegrees(home.longitude + 60, home.latitude + 15, 38_000_000),
    });
    this.intro = home;
    this.host.dataset.intro = "playing";
    this.flyTo(home, INTRO_SECONDS);
  }

  /** Vuelo de cámara; instantáneo con movimiento reducido. */
  flyTo(destination: Destination, seconds: number): void {
    const { camera, scene } = this.widget;
    const target = Cartesian3.fromDegrees(
      destination.longitude,
      destination.latitude,
      destination.height,
    );
    if (this.reducedMotion) {
      camera.cancelFlight();
      camera.setView({ destination: target });
      scene.requestRender();
      return;
    }
    // Un vuelo nuevo cancela el anterior: el contador evita que el aviso de cancelación del
    // vuelo viejo dé por terminado el nuevo.
    const flight = ++this.flight;
    this.flying = true;
    const end = () => {
      if (flight !== this.flight) return;
      this.flying = false;
      this.finishIntro();
      this.lastInteraction = performance.now();
    };
    camera.flyTo({
      destination: target,
      duration: seconds,
      easingFunction: EasingFunction.CUBIC_OUT,
      complete: end,
      cancel: end,
    });
  }

  private markActive(): void {
    this.lastInteraction = performance.now();
  }

  /**
   * El usuario mueve el globo (arrastre, rueda, teclado o sus botones): se cancela
   * cualquier vuelo. La intro se salta hasta su vista final para que la acción del
   * usuario parta de ahí y no de la órbita lejana.
   */
  takeControl(): void {
    this.markActive();
    if (!this.flying) return;
    const intro = this.intro;
    this.flight += 1;
    this.flying = false;
    this.finishIntro();
    const { camera } = this.widget;
    camera.cancelFlight();
    if (intro) {
      camera.setView({
        destination: Cartesian3.fromDegrees(intro.longitude, intro.latitude, intro.height),
      });
    }
  }

  private finishIntro(): void {
    if (!this.intro) return;
    this.intro = null;
    this.host.dataset.intro = "done";
  }

  private shouldSpin(now: number): boolean {
    return (
      !this.reducedMotion &&
      !this.spinPaused &&
      !this.hasSelection &&
      !this.playbackActive &&
      !this.flying &&
      !document.hidden &&
      this.widget.scene.mode === SceneMode.SCENE3D &&
      now - this.lastInteraction >= IDLE_DELAY_MS
    );
  }

  private tick(): void {
    const now = performance.now();
    const elapsed = this.lastFrame === null ? 0 : now - this.lastFrame;
    this.lastFrame = now;
    const { scene, camera } = this.widget;

    const spinning = this.shouldSpin(now);
    if (spinning !== this.spinning) {
      this.spinning = spinning;
      this.host.dataset.spin = spinning ? "on" : "off";
    }
    // Ángulo positivo: la cámara avanza hacia el oeste y el globo parece girar hacia el este.
    if (spinning) camera.rotate(Cartesian3.UNIT_Z, spinAngle(elapsed));

    if (this.ripples.active && !document.hidden) {
      this.ripples.tick(now);
      scene.requestRender();
    }

    const continuous = spinning || this.flying || (this.ripples.active && !document.hidden);
    if (!continuous) this.meter.reset();
    this.continuous = continuous;
  }

  private countFrame(): void {
    if (!this.continuous) return;
    const fps = this.meter.frame(performance.now());
    if (fps !== null) this.onFps(fps);
  }
}
