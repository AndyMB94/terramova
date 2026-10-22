import {
  Cartesian3,
  Color,
  type PointPrimitive,
  PointPrimitiveCollection,
  type Scene,
} from "cesium";

import {
  type RippleFrame,
  rippleFrame,
  rippleOffset,
  selectRipples,
  STATIC_RIPPLE,
} from "./effects";
import { pointPixelSize } from "./geometry";
import { depthColor, type GlobePoint, HorizonCuller, POINT_HEIGHT_M } from "./points";

interface Ripple {
  primitive: PointPrimitive;
  baseSize: number;
  offset: number;
  color: Color;
}

const TRANSPARENT = new Color(0, 0, 0, 0);
const scratch = new Color();

/**
 * Ondas sobre los eventos de la última hora (máx. 20, por magnitud). Cada onda es un punto
 * sin relleno cuyo borde crece y se desvanece. Animadas obligan a dibujar cada fotograma,
 * así que con movimiento reducido o calidad baja se quedan como anillo fijo.
 *
 * Debe crearse antes que `EventPointLayer` para que los anillos queden bajo los puntos.
 */
export class RippleLayer {
  private readonly collection = new PointPrimitiveCollection();
  private readonly culler = new HorizonCuller();
  private readonly removeCulling: () => void;
  private readonly scene: Scene;
  private ripples: Ripple[] = [];
  private animated = true;

  constructor(scene: Scene) {
    this.scene = scene;
    scene.primitives.add(this.collection);
    this.removeCulling = scene.preRender.addEventListener(() => this.cullHiddenSide());
  }

  destroy(): void {
    this.removeCulling();
  }

  /** Necesita dibujo continuo: hay ondas y están animadas. */
  get active(): boolean {
    return this.animated && this.ripples.length > 0;
  }

  get count(): number {
    return this.ripples.length;
  }

  update(points: readonly GlobePoint[], nowMs: number): void {
    this.collection.removeAll();
    this.ripples = selectRipples(points, nowMs).map((point) => ({
      primitive: this.collection.add({
        position: Cartesian3.fromDegrees(point.longitude, point.latitude, POINT_HEIGHT_M),
        color: TRANSPARENT,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      }),
      baseSize: pointPixelSize(point.magnitude),
      offset: rippleOffset(point.id),
      color: depthColor(point.depthKm),
    }));
    this.culler.markDirty();
    this.render(nowMs);
  }

  setAnimated(animated: boolean): void {
    this.animated = animated;
    this.render(performance.now());
  }

  /** Avanza la animación; quien llama pide el fotograma. */
  tick(nowMs: number): void {
    if (this.active) this.render(nowMs);
  }

  private render(nowMs: number): void {
    for (const ripple of this.ripples) {
      const frame: RippleFrame = this.animated ? rippleFrame(nowMs, ripple.offset) : STATIC_RIPPLE;
      ripple.primitive.pixelSize = ripple.baseSize + frame.growth;
      ripple.primitive.outlineColor = Color.clone(ripple.color, scratch).withAlpha(
        frame.alpha,
        scratch,
      );
    }
    this.scene.requestRender();
  }

  private cullHiddenSide(): void {
    const visible = this.culler.refresh(this.scene);
    if (!visible) return;
    for (const { primitive } of this.ripples) primitive.show = visible(primitive.position);
  }
}
