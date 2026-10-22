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
}

const OUTLINE = Color.fromCssColorString("#070b14").withAlpha(0.85);
const SELECTED_OUTLINE = Color.fromCssColorString("#22d3ee");
const NO_DEPTH = Color.fromCssColorString("#9aa8bf");
// Ligeramente sobre el elipsoide para no parpadear contra la superficie.
const HEIGHT_M = 2_000;

/**
 * Puntos de eventos con PointPrimitiveCollection (miles de puntos, no Entities). Se
 * actualiza de forma incremental por id: no se recrea la colección al cambiar los datos.
 *
 * Los puntos no usan la prueba de profundidad contra el globo: con ella, la mitad inferior
 * de cada punto quedaba enterrada en la superficie. En su lugar, los que están detrás del
 * planeta se ocultan con un cálculo de horizonte, solo cuando la cámara se mueve.
 */
export class EventPointLayer {
  private readonly collection = new PointPrimitiveCollection();
  private readonly byId = new Map<string, { primitive: PointPrimitive; point: GlobePoint }>();
  private readonly occluder = new EllipsoidalOccluder(Ellipsoid.WGS84, Cartesian3.ZERO);
  private readonly lastCamera = new Cartesian3();
  private readonly removeCulling: () => void;
  private selectedId: string | null = null;
  private dirty = true;
  private readonly scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
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
          position: Cartesian3.fromDegrees(point.longitude, point.latitude, HEIGHT_M),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        });
        this.style(primitive, point);
        this.byId.set(point.id, { primitive, point });
      }
    }
    this.dirty = true;
    this.scene.requestRender();
  }

  select(id: string | null): void {
    const previous = this.selectedId ? this.byId.get(this.selectedId) : undefined;
    this.selectedId = id;
    if (previous) this.style(previous.primitive, previous.point);
    const current = id ? this.byId.get(id) : undefined;
    if (current) this.style(current.primitive, current.point);
    this.scene.requestRender();
  }

  position(id: string): GlobePoint | undefined {
    return this.byId.get(id)?.point;
  }

  get size(): number {
    return this.byId.size;
  }

  private cullHiddenSide(): void {
    const camera = this.scene.camera.positionWC;
    if (!this.dirty && Cartesian3.equalsEpsilon(camera, this.lastCamera, 0, 1)) return;
    Cartesian3.clone(camera, this.lastCamera);
    this.dirty = false;
    // En 2D (y durante la transición) todo el mapa está a la vista.
    const cull = this.scene.mode === SceneMode.SCENE3D;
    this.occluder.cameraPosition = camera;
    for (const { primitive } of this.byId.values()) {
      primitive.show = !cull || this.occluder.isPointVisible(primitive.position);
    }
  }

  private style(primitive: PointPrimitive, point: GlobePoint): void {
    const depth = depthClass(point.depthKm);
    const selected = point.id === this.selectedId;
    primitive.color = depth ? Color.fromCssColorString(depth.hex) : NO_DEPTH;
    primitive.pixelSize = pointPixelSize(point.magnitude) + (selected ? 6 : 0);
    primitive.outlineColor = selected ? SELECTED_OUTLINE : OUTLINE;
    primitive.outlineWidth = selected ? 3 : 1;
  }
}
