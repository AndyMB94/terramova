import { createBrowserRouter, type RouteObject } from "react-router";

import { ExplorePage } from "@/features/explore";

export const routes: RouteObject[] = [{ path: "/", element: <ExplorePage /> }];

export const router = createBrowserRouter(routes);
