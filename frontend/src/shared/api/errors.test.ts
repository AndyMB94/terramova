import { describe, expect, it } from "vitest";

import { isApiError } from "./errors";

describe("isApiError", () => {
  it("reconoce el formato {code, message}", () => {
    expect(isApiError({ code: "invalid_filters", message: "Los filtros no son válidos." })).toBe(
      true,
    );
  });

  it("rechaza otros valores", () => {
    expect(isApiError(null)).toBe(false);
    expect(isApiError("error")).toBe(false);
    expect(isApiError({ code: 400 })).toBe(false);
  });
});
