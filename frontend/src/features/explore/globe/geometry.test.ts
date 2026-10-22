import { describe, expect, it } from "vitest";

import {
  longitudeForScreenOffset,
  MAX_POINT_PX,
  MIN_POINT_PX,
  pointPixelSize,
  rectangleToBbox,
} from "./geometry";

describe("tamaño de los puntos", () => {
  it("crece con la magnitud dentro de límites", () => {
    expect(pointPixelSize(null)).toBe(MIN_POINT_PX);
    expect(pointPixelSize(-1.2)).toBe(MIN_POINT_PX);
    expect(pointPixelSize(2)).toBeLessThan(pointPixelSize(5));
    expect(pointPixelSize(9.5)).toBe(MAX_POINT_PX);
  });
});

describe("área visible → bbox", () => {
  it("convierte y redondea a dos decimales", () => {
    expect(rectangleToBbox({ west: -82.123, south: -56.456, east: -34.0, north: 13.789 })).toBe(
      "-82.12,-56.46,-34,13.79",
    );
  });

  it("conserva el cruce del antimeridiano (oeste > este)", () => {
    expect(rectangleToBbox({ west: 170, south: -30, east: -170, north: -10 })).toBe(
      "170,-30,-170,-10",
    );
  });

  it("si se ve todo el planeta no filtra", () => {
    expect(rectangleToBbox({ west: -180, south: -90, east: 180, north: 90 })).toBeNull();
  });

  it("recorta valores fuera de rango", () => {
    expect(rectangleToBbox({ west: -190, south: -95, east: 10, north: 20 })).toBe("-180,-90,10,20");
  });
});

describe("longitudeForScreenOffset", () => {
  const base = { heightM: 9_000_000, canvasHeightPx: 800, fovyRadians: Math.PI / 3 };

  it("sin desplazamiento devuelve la misma longitud", () => {
    expect(longitudeForScreenOffset({ ...base, longitude: -70, latitude: -20, offsetPx: 0 })).toBe(
      -70,
    );
  });

  it("apunta al este para dejar el punto a la izquierda, más cuanto más lejos está la cámara", () => {
    const near = longitudeForScreenOffset({
      ...base,
      heightM: 2_000_000,
      longitude: -70,
      latitude: 0,
      offsetPx: 200,
    });
    const far = longitudeForScreenOffset({ ...base, longitude: -70, latitude: 0, offsetPx: 200 });
    expect(near).toBeGreaterThan(-70);
    expect(far).toBeGreaterThan(near);
  });

  it("cruza el antimeridiano y se limita cerca de los polos", () => {
    const wrapped = longitudeForScreenOffset({
      ...base,
      longitude: 178,
      latitude: 0,
      offsetPx: 200,
    });
    expect(wrapped).toBeLessThan(-150);
    const polar = longitudeForScreenOffset({ ...base, longitude: 0, latitude: 89, offsetPx: 200 });
    expect(polar).toBeLessThanOrEqual(90);
  });
});
