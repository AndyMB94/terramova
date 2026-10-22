import { describe, expect, it } from "vitest";

import {
  bucketRange,
  bucketTick,
  depthClassFor,
  formatChange,
  rangeLabel,
  shareOf,
} from "./labels";

describe("etiquetas de la analítica", () => {
  it("bandas abiertas y cerradas", () => {
    expect(rangeLabel(null, 1)).toBe("< 1");
    expect(rangeLabel(3, 4)).toBe("3 – 4");
    expect(rangeLabel(7, null)).toBe("7 o más");
    expect(rangeLabel(70, 150, "km")).toBe("70 – 150 km");
  });

  it("las clases de profundidad usan el color y el texto de la leyenda del mapa", () => {
    expect(depthClassFor(35)?.label).toBe("0 – 35 km");
    expect(depthClassFor(null)?.label).toBe("300 km o más");
    expect(depthClassFor(999)).toBeUndefined();
  });

  it("intervalos siempre en UTC, aunque el navegador esté en otra zona", () => {
    expect(bucketTick("2026-10-15T00:00:00Z", "day")).toBe("15 oct");
    expect(bucketTick("2026-10-15T23:00:00Z", "hour")).toBe("23:00");
    expect(bucketRange("2026-10-15T23:00:00Z", "2026-10-16T00:00:00Z", "hour")).toBe(
      "15 oct, 23:00–00:00 UTC",
    );
    expect(bucketRange("2026-10-15T00:00:00Z", "2026-10-16T00:00:00Z", "day")).toBe("15 oct UTC");
  });

  // Intl separa el % con un espacio duro (U+00A0): nunca queda solo en otra línea.
  it("variación con signo tipográfico y sin dividir entre cero", () => {
    expect(formatChange(1927, 2180)).toBe("−11,6\u00a0%");
    expect(formatChange(110, 100)).toBe("+10\u00a0%");
    expect(formatChange(5, 5)).toBe("0\u00a0%");
    expect(formatChange(3, 0)).toBeNull();
  });

  it("porcentaje del total", () => {
    expect(shareOf(1, 8)).toBe("12,5\u00a0%");
    expect(shareOf(0, 0)).toBe("0\u00a0%");
  });
});
