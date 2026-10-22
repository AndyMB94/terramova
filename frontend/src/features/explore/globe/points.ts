import {
  Cartesian3,
  Color,
  Ellipsoid,
  EllipsoidalOccluder,
  type PointPrimitive,
  PointPrimitiveCollection,
  type Scene,
  SceneMode,
} from "cesium";

import { depthClass } from "@/shared/lib/depth";

import { pointPixelSize } from "./geometry";

export interface GlobePoint {
  id: string;
  longitude: number;
  latitude: number;
  magnitude: number | null;
  depthKm: number | null;
  /** Hora del evento en ms (UTC); decide las ondas de la última hora. */
  occurredAtMs: number;
}

const OUTLINE = Color.fromCssColorString("#070b14").withAlpha(0.85);
const SELECTED_OUTLINE = Color.fromCssColorString("#22d3ee");
const NO_DEPTH = Color.fromCssColorString("#9aa8bf");
const HALO = SELECTED_OUTLINE.withAlpha(0.22);
const HALO_EXTRA_PX = 20;
// Ligeramente sobre el elipsoide para no parpadear contra la superficie.
export const POINT_HEIGHT_M = 2_000;

export function depthColor(depthKm: number | null): Color {
  const depth = depthClass(depthKm);
  return depth ? Color.fromCssColorString(depth.hex) : NO_DEPTH;
}

/**
 * Oculta lo que queda detrás del planeta. Solo recalcula cuando la cámara se mueve o se
 * marca como pendiente; devuelve `null` si no hay nada que actualizar.
 */
export class HorizonCuller {
  private readonly occluder = new EllipsoidalOccluder(Ellipsoid.WGS84, Cartesian3.ZERO);
  private readonly lastCamera = new Cartesian3();
  private dirty = true;

  markDirty(): void {
    this.dirty = true;
  }

  refresh(scene: Scene): ((position: Cartesian3) => boolean) | null {
    const camera = scene.camera.positionWC;
    if (!this.dirty && Cartesian3.equalsEpsilon(camera, this.lastCamera, 0, 1)) return null;
    Cartesian3.clone(camera, this.lastCamera);
    this.dirty = false;
    // En 2D (y durante la transición) todo el mapa está a la vista.
    if (scene.mode !== SceneMode.SCENE3D) return () => true;
    this.occluder.cameraPosition = camera;
    return (position) => this.occluder.isPointVisible(position);
  }
}

/**
 * Puntos de eventos con PointPrimitiveCollection (miles de puntos, no Entities). Se
 * actualiza de forma incremental por id: no se recrea la colección al cambiar los datos.
 *
 * Los puntos no usan la prueba de profundidad contra el globo: con ella, la mitad inferior
 * de cada punto quedaba enterrada en la superficie. En su lugar, los que están detrás del
 * planeta se ocultan con un cálculo de horizonte, solo cuando la cámara se mueve.
 */
export class EventPointLayer {
  // El halo va en su propia colección, añadida antes: queda dibujado debajo del punto.
  private readonly haloCollection = new PointPrimitiveCollection();
  private readonly halo: PointPrimitive;
  private readonly collection = new PointPrimitiveCollection();
  private readonly byId = new Map<string, { primitive: PointPrimitive; point: GlobePoint }>();
  private readonly culler = new HorizonCuller();
  private readonly removeCulling: () => void;
  private selectedId: string | null = null;
  private readonly scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
    this.halo = this.haloCollection.add({
      show: false,
      color: HALO,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });
    scene.primitives.add(this.haloCollection);
    scene.primitives.add(this.collection);
    this.removeCulling = scene.preRender.addEventListener(() => this.cullHiddenSide());
  }

  destroy(): void {
    this.removeCulling();
  }

  update(points: readonly GlobePoint[]): void {
    const incoming = new Set(points.map((point) => point.id));
    for (const [id, entry] of this.byId) {
      if (!incoming.has(id)) {
        this.collection.remove(entry.primitive);
        this.byId.delete(id);
      }
    }
    // La API entrega los puntos de mayor magnitud primero; se añaden al revés para que
    // los grandes queden dibujados encima.
    for (const point of [...points].reverse()) {
      const existing = this.byId.get(point.id);
      if (existing) {
        existing.point = point;
        this.style(existing.primitive, point);
      } else {
        const primitive = this.collection.add({
          id: point.id,
          position: Cartesian3.fromDegrees(point.longitude, point.latitude, POINT_HEIGHT_M),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        });
        this.style(primitive, point);
        this.byId.set(point.id, { primitive, point });
      }
    }
    this.culler.markDirty();
    this.placeHalo();
    this.scene.requestRender();
  }

  select(id: string | null): void {
    const previous = this.selectedId ? this.byId.get(this.selectedId) : undefined;
    this.selectedId = id;
    if (previous) this.style(previous.primitive, previous.point);
    const current = id ? this.byId.get(id) : undefined;
    if (current) this.style(current.primitive, current.point);
    this.culler.markDirty();
    this.placeHalo();
    this.scene.requestRender();
  }

  position(id: string): GlobePoint | undefined {
    return this.byId.get(id)?.point;
  }

  get size(): number {
    return this.byId.size;
  }

  private cullHiddenSide(): void {
    const visible = this.culler.refresh(this.scene);
    if (!visible) return;
    for (const { primitive } of this.byId.values()) {
      primitive.show = visible(primitive.position);
    }
    const selected = this.selectedId ? this.byId.get(this.selectedId) : undefined;
    this.halo.show = selected !== undefined && selected.primitive.show;
  }

  /** Halo suave bajo el punto seleccionado (estático: no obliga a dibujar sin parar). */
  private placeHalo(): void {
    const selected = this.selectedId ? this.byId.get(this.selectedId) : undefined;
    if (!selected) {
      this.halo.show = false;
      return;
    }
    this.halo.position = selected.primitive.position;
    this.halo.pixelSize = pointPixelSize(selected.point.magnitude) + HALO_EXTRA_PX;
  }

  private style(primitive: PointPrimitive, point: GlobePoint): void {
    const selected = point.id === this.selectedId;
    primitive.color = depthColor(point.depthKm);
    primitive.pixelSize = pointPixelSize(point.magnitude) + (selected ? 6 : 0);
    primitive.outlineColor = selected ? SELECTED_OUTLINE : OUTLINE;
    primitive.outlineWidth = selected ? 3 : 1;
  }
}
