import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { routes } from "./router";

describe("router", () => {
  it("muestra la página de exploración en la ruta raíz", () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/"] });
    render(<RouterProvider router={router} />);

    expect(screen.getByRole("heading", { level: 1, name: "TerraMova" })).toBeInTheDocument();
  });
});
