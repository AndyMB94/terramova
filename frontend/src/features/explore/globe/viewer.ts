import "./cesium-base";
// Estilos del contenedor de Cesium: sin ellos el canvas se queda en 300×150 px.
import "cesium/Build/Cesium/Widgets/widgets.css";

import {
  Cartesian3,
  CesiumWidget,
  Color,
  Credit,
  GeographicTilingScheme,
  ImageryLayer,
  Material,
  PolylineCollection,
  UrlTemplateImageryProvider,
} from "cesium";

const BASE = import.meta.env.BASE_URL;
const BACKGROUND = "#070b14";

/** Vista inicial: Sudamérica, sin pedir geolocalización (docs/UI_UX.md). */
export const HOME = { longitude: -62, latitude: -14, height: 15_000_000 };

/**
 * Crea el globo con recursos autoalojados: teselas NASA Blue Marble y fronteras de Natural
 * Earth (infra/scripts/build_globe_assets.py). No usa Cesium ion ni terreno de terceros:
 * ninguna petición sale a servicios externos.
 */
export function createGlobe(container: HTMLElement, creditContainer: HTMLElement): CesiumWidget {
  const imagery = new UrlTemplateImageryProvider({
    url: `${BASE}imagery/blue-marble/{z}/{x}/{y}.jpg`,
    tilingScheme: new GeographicTilingScheme(),
    maximumLevel: 4,
    tileWidth: 256,
    tileHeight: 256,
    // showOnScreen: el crédito se ve siempre, no escondido tras "Data attribution".
    credit: new Credit("Imágenes: NASA Blue Marble", true),
  });

  const widget = new CesiumWidget(container, {
    baseLayer: new ImageryLayer(imagery),
    creditContainer,
    skyBox: false,
    // Solo se dibuja cuando algo cambia: ahorra batería y CPU con el globo quieto.
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
  });

  const { scene } = widget;
  scene.backgroundColor = Color.fromCssColorString(BACKGROUND);
  scene.globe.baseColor = Color.fromCssColorString("#0b2545");
  scene.globe.showGroundAtmosphere = true;
  // Los puntos se ocultan tras el planeta con un cálculo de horizonte (points.ts), no con
  // la prueba de profundidad, que los cortaba por la mitad.
  scene.screenSpaceCameraController.minimumZoomDistance = 250_000;
  scene.screenSpaceCameraController.maximumZoomDistance = 40_000_000;

  widget.camera.setView({
    destination: Cartesian3.fromDegrees(HOME.longitude, HOME.latitude, HOME.height),
  });
  return widget;
}

/** Fronteras terrestres (Natural Earth 1:110m) como líneas finas y discretas. */
export async function addBorders(widget: CesiumWidget, signal: AbortSignal): Promise<void> {
  const response = await fetch(`${BASE}geo/borders-110m.geojson`, { signal });
  if (!response.ok) return;
  const data = (await response.json()) as {
    features: { geometry: { coordinates: [number, number][][] } }[];
  };
  if (widget.isDestroyed()) return;

  const borders = new PolylineCollection();
  const material = Material.fromType("Color", {
    color: Color.WHITE.withAlpha(0.28),
  });
  for (const feature of data.features) {
    for (const line of feature.geometry.coordinates) {
      borders.add({
        positions: Cartesian3.fromDegreesArray(line.flat()),
        width: 1,
        material,
      });
    }
  }
  widget.scene.primitives.add(borders);
  widget.scene.requestRender();
}
