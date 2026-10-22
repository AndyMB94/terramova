import { lazy } from "react";

export { ExplorePage } from "./ExplorePage";

/** Laboratorio de rendimiento del globo: solo se enlaza en desarrollo (router.tsx). */
export const PerformanceLab = lazy(() => import("./lab/PerformanceLab"));
