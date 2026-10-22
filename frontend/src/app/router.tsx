import { createBrowserRouter, type RouteObject } from "react-router";

import { AboutPage } from "@/features/about";
import { ExplorePage } from "@/features/explore";

import { AppShell } from "./AppShell";
import { NotFound } from "./NotFound";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <ExplorePage /> },
      { path: "acerca", element: <AboutPage /> },
      { path: "*", element: <NotFound /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
