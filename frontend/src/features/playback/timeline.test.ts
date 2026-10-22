import { describe, expect, it } from "vitest";

import {
  advanceCursor,
  formatCursor,
  PLAYBACK_DURATION_MS,
  recentSpanMs,
  visibleUntil,
} from "./timeline";

const DAY = 86_400_000;
const WEEK = { startMs: Date.UTC(2026, 9, 15), endMs: Date.UTC(2026, 9, 22) };

describe("reproducción temporal", () => {
  it("a ×1 cualquier ventana se recorre en 30 s; ×2 y ×4 tardan la mitad y la cuarta parte", () => {
    const half = PLAYBACK_DURATION_MS / 2;
    expect(advanceCursor(WEEK.startMs, half, 1, WEEK)).toEqual({
      cursorMs: WEEK.startMs + 3.5 * DAY,
      ended: false,
    });
    expect(advanceCursor(WEEK.startMs, half, 2, WEEK)).toEqual({
      cursorMs: WEEK.endMs,
      ended: true,
    });
    const day = { startMs: 0, endMs: DAY };
    expect(advanceCursor(0, PLAYBACK_DURATION_MS / 4, 4, day).ended).toBe(true);
  });

  it("no pasa del final, no retrocede y aguanta ventanas vacías", () => {
    expect(advanceCursor(WEEK.endMs - 1, 10_000, 4, WEEK)).toEqual({
      cursorMs: WEEK.endMs,
      ended: true,
    });
    expect(advanceCursor(WEEK.startMs, -500, 1, WEEK).cursorMs).toBe(WEEK.startMs);
    expect(advanceCursor(5, 100, 1, { startMs: 5, endMs: 5 }).ended).toBe(true);
  });

  it("filtra por hora sin modificar la lista original", () => {
    const points = [
      { id: "a", occurredAtMs: 10 },
      { id: "b", occurredAtMs: 20 },
      { id: "c", occurredAtMs: 30 },
    ];
    expect(visibleUntil(points, 20).map((point) => point.id)).toEqual(["a", "b"]);
    expect(points).toHaveLength(3);
  });

  it("lo recién aparecido es el último segundo de reproducción", () => {
    expect(recentSpanMs(WEEK)).toBe((7 * DAY) / 30);
  });

  it("muestra el cursor en UTC", () => {
    expect(formatCursor(Date.UTC(2026, 9, 15, 14, 32))).toBe("15 oct, 14:32 UTC");
  });
});
