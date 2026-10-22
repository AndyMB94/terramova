import { describe, expect, it } from "vitest";

import { depthClass } from "./depth";
import {
  formatCoordinates,
  formatCount,
  formatDepth,
  formatLocalDateTime,
  formatMagnitude,
  formatPlace,
  formatRelative,
  formatStatus,
  formatUtcDateTime,
  utcOffsetLabel,
} from "./format";

describe("formato de datos sísmicos", () => {
  it("usa coma decimal y conserva nulos como texto explícito", () => {
    expect(formatMagnitude(5.4)).toBe("5,4");
    expect(formatMagnitude(-1.29)).toBe("-1,3");
    expect(formatMagnitude(null)).toBe("—");
    expect(formatDepth(10)).toBe("10 km");
    expect(formatDepth(4.5)).toBe("4,5 km");
    expect(formatDepth(null)).toBe("Sin dato");
  });

  it("agrupa miles", () => {
    expect(formatCount(1896)).toBe("1.896");
    expect(formatCount(42)).toBe("42");
  });

  it("formatea coordenadas con hemisferio", () => {
    expect(formatCoordinates(6.3226, -82.5693)).toBe("6,323° N 82,569° O");
    expect(formatCoordinates(-33.4, 151.2)).toBe("33,400° S 151,200° E");
  });

  it("muestra la hora en UTC y en una zona concreta", () => {
    const iso = "2026-10-20T17:05:48.338Z";
    expect(formatUtcDateTime(iso)).toBe("20 oct 2026, 17:05:48");
    expect(formatLocalDateTime(iso, "America/Lima")).toBe("20 oct 2026, 12:05:48");
    expect(utcOffsetLabel(new Date(iso), "America/Lima")).toBe("UTC−5");
    expect(utcOffsetLabel(new Date(iso), "UTC")).toBe("UTC");
  });

  it("expresa el tiempo relativo en forma breve", () => {
    const now = new Date("2026-10-22T04:33:00Z");
    expect(formatRelative("2026-10-22T04:31:00Z", now)).toBe("hace 2 min");
    expect(formatRelative("2026-10-20T04:33:00Z", now)).toBe("hace 2 d");
  });

  it("traduce el rumbo de USGS y conserva el topónimo", () => {
    expect(formatPlace("192 km S of Burica, Panama")).toBe("192 km al S de Burica, Panama");
    expect(formatPlace("48 km WNW of Khuzdar, Pakistan")).toBe("48 km al ONO de Khuzdar, Pakistan");
    expect(formatPlace("Reykjanes Ridge")).toBe("Reykjanes Ridge");
    expect(formatPlace("")).toBe("Ubicación sin descripción");
  });

  it("traduce el estado de revisión", () => {
    expect(formatStatus("reviewed")).toBe("Revisado por USGS");
    expect(formatStatus("automatic")).toBe("Automático, sin revisar");
  });
});

describe("escala de profundidad", () => {
  it("asigna la clase por límite superior exclusivo", () => {
    expect(depthClass(0)?.label).toBe("0 – 35 km");
    expect(depthClass(35)?.label).toBe("35 – 70 km");
    expect(depthClass(-3.4)?.label).toBe("0 – 35 km");
    expect(depthClass(650)?.label).toBe("300 km o más");
    expect(depthClass(null)).toBeNull();
  });
});
