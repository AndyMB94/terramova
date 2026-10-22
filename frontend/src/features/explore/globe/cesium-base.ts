// Debe evaluarse antes que "cesium": indica dónde están sus workers y recursos estáticos,
// copiados al build en /cesium/ por vite-plugin-static-copy (vite.config.ts).
(globalThis as { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = `${import.meta.env.BASE_URL}cesium/`;

export {};
