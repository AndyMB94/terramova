import { readdirSync } from "node:fs";

import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

// Reglas de dependencia de docs/STRUCTURE.md (regla 6):
// - Fuera de la carpeta actual se importa con el alias "@/", nunca con "../".
// - Una feature solo se importa por su API pública: "@/features/<nombre>" (index.ts).
// - shared/ no importa features/ ni app/; features/ no importa app/.
const features = readdirSync(new URL("./src/features", import.meta.url), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const noParentRelative = {
  regex: "^\\.\\./",
  message: 'Importa fuera de la carpeta actual con el alias "@/".',
};
const noFeatureInternals = (ownFeature) => ({
  regex: ownFeature ? `^@/features/(?!${ownFeature}(/|$))[^/]+/` : "^@/features/[^/]+/",
  message: 'Importa otra feature solo por su API pública: "@/features/<nombre>".',
});
const noApp = {
  regex: "^@/app(/|$)",
  message: "app/ compone la aplicación; features/ y shared/ no dependen de ella.",
};
const noFeatures = {
  regex: "^@/features(/|$)",
  message: "shared/ no puede depender de features/.",
};

const restrictImports = (...patterns) => ({
  "no-restricted-imports": ["error", { patterns }],
});

export default defineConfig(
  {
    ignores: [
      "dist",
      "coverage",
      "node_modules",
      "test-results",
      "playwright-report",
      "src/shared/api/schema.d.ts",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.strict],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: restrictImports(noParentRelative, noFeatureInternals(null)),
  },
  {
    files: ["src/shared/**/*.{ts,tsx}"],
    rules: restrictImports(noParentRelative, noFeatures, noApp),
  },
  ...features.map((name) => ({
    files: [`src/features/${name}/**/*.{ts,tsx}`],
    rules: restrictImports(noParentRelative, noFeatureInternals(name), noApp),
  })),
  {
    files: ["vite.config.ts", "eslint.config.js"],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
