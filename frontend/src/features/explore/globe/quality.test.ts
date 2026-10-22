import { describe, expect, it } from "vitest";

import { FpsMeter, parseQualityChoice, QUALITY_PROFILES, resolveQuality } from "./quality";

describe("FpsMeter", () => {
  it("entrega la media al cerrar cada ventana", () => {
    const meter = new FpsMeter(1000);
    const results: (number | null)[] = [];
    // 30 fotogramas por segundo durante 2 s.
    for (let frame = 0; frame <= 60; frame += 1) results.push(meter.frame(frame * (1000 / 30)));
    const windows = results.filter((value): value is number => value !== null);
    expect(windows).toHaveLength(2);
    for (const fps of windows) expect(fps).toBeCloseTo(30, 0);
  });

  it("una pausa descarta la ventana en curso en vez de contarla como lenta", () => {
    const meter = new FpsMeter(1000);
    meter.frame(0);
    meter.frame(16);
    meter.reset();
    expect(meter.frame(5_000)).toBeNull();
    let last: number | null = null;
    for (let time = 5_016; time <= 6_100; time += 16) last = meter.frame(time) ?? last;
    expect(last).toBeGreaterThan(55);
  });
});

describe("calidad", () => {
  it("automática usa el nivel medido; alta y baja lo fuerzan", () => {
    expect(resolveQuality("auto", "low")).toBe("low");
    expect(resolveQuality("auto", "high")).toBe("high");
    expect(resolveQuality("high", "low")).toBe("high");
    expect(resolveQuality("low", "high")).toBe("low");
  });

  it("valores guardados desconocidos vuelven a automática", () => {
    expect(parseQualityChoice(null)).toBe("auto");
    expect(parseQualityChoice("ultra")).toBe("auto");
    expect(parseQualityChoice("low")).toBe("low");
  });

  it("la calidad baja es la medida en el equipo de referencia (D85)", () => {
    expect(QUALITY_PROFILES.low).toMatchObject({
      msaaSamples: 1,
      atmosphere: false,
      resolutionScale: 0.75,
      animatedRipples: false,
    });
  });
});
