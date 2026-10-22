import { Link } from "react-router";

export function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-[15px] leading-relaxed">
      <h1 className="text-2xl font-semibold tracking-tight">Acerca de TerraMova</h1>
      <p className="mt-4 text-tertiary">
        TerraMova muestra eventos sísmicos publicados por el Servicio Geológico de Estados Unidos
        (USGS). No predice terremotos, no es un sistema oficial de alerta y no garantiza registrar
        cada sismo del planeta: la detección no es igual de completa en todas las regiones.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Qué significan los datos</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-tertiary">
        <li>
          La <strong>magnitud</strong> mide la energía liberada en el foco. No equivale a la
          intensidad sentida ni a los daños, que dependen de la distancia, la profundidad y el
          terreno.
        </li>
        <li>
          La <strong>profundidad</strong> se mide en kilómetros bajo la superficie; algunos valores
          negativos son válidos según la red sísmica que los calcula.
        </li>
        <li>
          Un evento <strong>automático</strong> aún no ha sido revisado por un sismólogo y puede
          corregirse; TerraMova incorpora esas correcciones en cada sincronización.
        </li>
        <li>Las fechas se guardan en UTC y se muestran en tu hora local y en UTC.</li>
      </ul>

      <h2 className="mt-8 text-lg font-semibold">Fuentes y créditos</h2>
      <ul className="mt-3 space-y-2 text-tertiary">
        <li>
          Datos sísmicos:{" "}
          <a
            className="text-primary hover:underline"
            href="https://earthquake.usgs.gov/"
            target="_blank"
            rel="noreferrer"
          >
            USGS Earthquake Hazards Program
          </a>{" "}
          (dominio público).
        </li>
        <li>
          Imágenes del globo:{" "}
          <a
            className="text-primary hover:underline"
            href="https://visibleearth.nasa.gov/collection/1484/blue-marble"
            target="_blank"
            rel="noreferrer"
          >
            NASA Blue Marble
          </a>{" "}
          (NASA Earth Observatory). Su uso no implica respaldo de NASA.
        </li>
        <li>
          Fronteras:{" "}
          <a
            className="text-primary hover:underline"
            href="https://www.naturalearthdata.com/"
            target="_blank"
            rel="noreferrer"
          >
            Natural Earth
          </a>{" "}
          1:110m (dominio público). Las fronteras son orientativas y no expresan posición sobre
          territorios en disputa.
        </li>
        <li>
          Motor del globo:{" "}
          <a
            className="text-primary hover:underline"
            href="https://cesium.com/platform/cesiumjs/"
            target="_blank"
            rel="noreferrer"
          >
            CesiumJS
          </a>{" "}
          (licencia Apache 2.0). No se usan servicios de Cesium ion.
        </li>
        <li>Tipografías Geist y Geist Mono (licencia SIL Open Font), autoalojadas.</li>
      </ul>

      <p className="mt-10">
        <Link to="/" className="text-primary hover:underline">
          Volver a explorar
        </Link>
      </p>
    </main>
  );
}
