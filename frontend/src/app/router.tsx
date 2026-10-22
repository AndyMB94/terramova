import { Suspense } from "react";
import { createBrowserRouter, type RouteObject } from "react-router";

import { AboutPage } from "@/features/about";
import { ExplorePage, PerformanceLab } from "@/features/explore";

import { AppShell } from "./AppShell";
import { NotFound } from "./NotFound";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <ExplorePage /> },
      { path: "acerca", element: <AboutPage /> },
      // Solo en desarrollo: el build de producción no incluye esta ruta.
      ...(import.meta.env.DEV
        ? [
            {
              path: "laboratorio/rendimiento",
              element: (
                <Suspense fallback={null}>
                  <PerformanceLab />
                </Suspense>
              ),
            },
          ]
        : []),
      { path: "*", element: <NotFound /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
