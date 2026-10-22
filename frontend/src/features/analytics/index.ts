import { lazy } from "react";

// Recharts va en un fragmento aparte: solo se descarga al abrir la analítica.
export const AnalyticsPage = lazy(() => import("./AnalyticsPage"));
