/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { DEPTH_CLASSES } from "./depth";

describe("escala de profundidad", () => {
  it("los colores en hexadecimal coinciden con los tokens de tokens.css", () => {
    // Vitest vacía las importaciones de CSS (css: false); se lee el archivo directamente.
    const tokens = readFileSync(resolve("src/shared/styles/tokens.css"), "utf8");
    DEPTH_CLASSES.forEach((item, index) => {
      const token = new RegExp(`--tm-depth-${index + 1}:\\s*(#[0-9a-f]{6})`, "i").exec(tokens);
      expect(token?.[1]?.toLowerCase()).toBe(item.hex);
    });
  });
});
