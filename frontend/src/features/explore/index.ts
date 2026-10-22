import { lazy } from "react";

export { ExplorePage } from "./ExplorePage";

/** Laboratorio de rendimiento del globo: solo se enlaza en desarrollo (router.tsx). */
export const PerformanceLab = lazy(() => import("./lab/PerformanceLab"));

// Compartido con Analítica: los mismos filtros en la URL dan los mismos datos (Fase 4).
export { type Meta, useMeta } from "./api/queries";
export { type FilterQuery, toFilterQuery } from "./filters/api-query";
export { activeChips } from "./filters/chips";
export { FilterPanel } from "./filters/FilterPanel";
export type { ExploreFilters } from "./filters/schema";
export { useExploreFilters } from "./filters/useExploreFilters";
export { StatusBar } from "./status/StatusBar";
