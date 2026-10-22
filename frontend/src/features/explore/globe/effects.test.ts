import { describe, expect, it } from "vitest";

import {
  MAX_RIPPLES,
  RECENT_WINDOW_MS,
  RIPPLE_CYCLE_MS,
  rippleFrame,
  rippleOffset,
  selectRipples,
  spinAngle,
  SPIN_RADIANS_PER_SECOND,
} from "./effects";

const NOW = Date.parse("2026-10-22T12:00:00Z");

function candidate(id: string, minutesAgo: number, magnitude: number | null) {
  return { id, magnitude, occurredAtMs: NOW - minutesAgo * 60_000 };
}

describe("selectRipples", () => {
  it("solo incluye eventos de la última hora, contada desde la hora real", () => {
    const selected = selectRipples(
      [candidate("reciente", 10, 3), candidate("justo", 60, 2), candidate("viejo", 61, 7)],
      NOW,
    );
    expect(selected.map((point) => point.id)).toEqual(["reciente", "justo"]);
  });

  it("descarta fechas futuras (relojes desajustados o datos inválidos)", () => {
    expect(selectRipples([candidate("futuro", -5, 5)], NOW)).toEqual([]);
  });

  it("prioriza por magnitud, deja las nulas al final y limita a 20", () => {
    const points = [
      candidate("sin-magnitud", 1, null),
      ...Array.from({ length: 25 }, (_, index) => candidate(`m${index}`, 5, index / 10)),
    ];
    const selected = selectRipples(points, NOW);
    expect(selected).toHaveLength(MAX_RIPPLES);
    expect(selected[0]?.id).toBe("m24");
    expect(selected.some((point) => point.id === "sin-magnitud")).toBe(false);
  });

  it("no modifica el orden de la lista original", () => {
    const points = [candidate("a", 1, 1), candidate("b", 1, 5)];
    selectRipples(points, NOW);
    expect(points.map((point) => point.id)).toEqual(["a", "b"]);
  });

  it("la ventana es de una hora", () => {
    expect(RECENT_WINDOW_MS).toBe(3_600_000);
  });
});

describe("rippleFrame", () => {
  it("empieza pequeña y opaca y termina grande y transparente en cada ciclo", () => {
    const start = rippleFrame(0, 0);
    const end = rippleFrame(RIPPLE_CYCLE_MS - 1, 0);
    expect(start.growth).toBeCloseTo(0);
    expect(start.alpha).toBeCloseTo(0.9);
    expect(end.growth).toBeGreaterThan(20);
    expect(end.alpha).toBeLessThan(0.01);
  });

  it("se repite cada ciclo", () => {
    expect(rippleFrame(300, 0.2)).toEqual(rippleFrame(300 + RIPPLE_CYCLE_MS, 0.2));
  });

  it("el desfase es estable por id y queda entre 0 y 1", () => {
    const offset = rippleOffset("us7000abcd");
    expect(rippleOffset("us7000abcd")).toBe(offset);
    expect(offset).toBeGreaterThanOrEqual(0);
    expect(offset).toBeLessThan(1);
    expect(rippleOffset("us7000abce")).not.toBe(offset);
  });
});

describe("spinAngle", () => {
  it("da una vuelta cada 90 s", () => {
    expect(SPIN_RADIANS_PER_SECOND * 90).toBeCloseTo(2 * Math.PI);
    expect(spinAngle(50)).toBeCloseTo(SPIN_RADIANS_PER_SECOND * 0.05);
  });

  it("no salta tras una pausa larga ni retrocede", () => {
    expect(spinAngle(10_000)).toBeCloseTo(spinAngle(100));
    expect(spinAngle(-20)).toBe(0);
  });
});
