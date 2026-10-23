import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderRoutes } from "@/test/render";

import { routes } from "./router";

describe("router", () => {
  it("la ruta raíz es la página de exploración", async () => {
    renderRoutes(routes);

    expect(
      screen.getByRole("heading", { level: 1, name: "Explorar sismos recientes" }),
    ).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "TerraMova" })).toBeInTheDocument();
  });

  it("acerca muestra las fuentes y el aviso de que no es un sistema de alerta", () => {
    renderRoutes(routes, "/acerca");

    expect(
      screen.getByRole("heading", { level: 1, name: "Acerca de TerraMova" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no es un sistema oficial de alerta/)).toBeInTheDocument();
  });

  it("acerca explica la privacidad y la licencia del código", () => {
    renderRoutes(routes, "/acerca");

    expect(screen.getByRole("heading", { name: "Privacidad" })).toBeInTheDocument();
    expect(screen.getByText(/los borra a los 14 días/)).toBeInTheDocument();
    expect(screen.getByText(/con licencia MIT/)).toBeInTheDocument();
  });

  it("una ruta desconocida muestra la página no encontrada", () => {
    renderRoutes(routes, "/no-existe");

    expect(screen.getByRole("heading", { name: "Página no encontrada" })).toBeInTheDocument();
  });
});
