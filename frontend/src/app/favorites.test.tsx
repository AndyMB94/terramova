import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderRoutes } from "@/test/render";

import { routes } from "./router";

const PANAMA_ID = "22222222-2222-4222-8222-222222222222";
const PANAMA = "192 km al S de Burica, Panama";

async function openPanama() {
  const user = userEvent.setup();
  const view = renderRoutes(routes, `/?event=${PANAMA_ID}`);
  const detail = await screen.findByRole("region", { name: PANAMA });
  return { user, detail, ...view };
}

describe("Favoritos", () => {
  it("se guardan desde la ficha y aparecen en su pestaña", async () => {
    const { user, detail } = await openPanama();
    await user.click(within(detail).getByRole("button", { name: "Guardar en favoritos" }));

    // Ya guardado, el botón ofrece la acción contraria.
    expect(within(detail).getByRole("button", { name: "Quitar de favoritos" })).toBeInTheDocument();
    const tab = screen.getByRole("tab", { name: "Favoritos (1)" });
    await user.click(tab);
    expect(tab).toHaveAttribute("aria-selected", "true");
    const panel = screen.getByRole("tabpanel");
    // El botón del favorito (no el de «Quitar … de favoritos»), con un nombre legible.
    expect(
      within(panel).getByRole("button", { name: /^192 km al S de Burica, Panama, magnitud 5,4,/ }),
    ).toBeInTheDocument();
    // Se guardan con formato versionado y solo metadatos mínimos.
    const stored = JSON.parse(window.localStorage.getItem("terramova:favorites") ?? "{}");
    expect(stored.version).toBe(1);
    expect(Object.keys(stored.items[0]).sort()).toEqual([
      "id",
      "magnitude",
      "occurred_at",
      "place",
      "saved_at",
    ]);
  });

  it("se quitan uno a uno y todos a la vez, con confirmación", async () => {
    const { user, detail } = await openPanama();
    await user.click(within(detail).getByRole("button", { name: "Guardar en favoritos" }));
    await user.click(screen.getByRole("tab", { name: "Favoritos (1)" }));

    await user.click(screen.getByRole("button", { name: "Borrar todos" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("tab", { name: "Favoritos (1)" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Borrar todos" }));
    await user.click(screen.getByRole("button", { name: "Sí, borrar todos" }));
    expect(screen.getByRole("tab", { name: "Favoritos (0)" })).toBeInTheDocument();
    expect(screen.getByText(/Aún no has guardado favoritos/)).toBeInTheDocument();

    await user.click(within(detail).getByRole("button", { name: "Guardar en favoritos" }));
    await user.click(screen.getByRole("button", { name: `Quitar ${PANAMA} de favoritos` }));
    expect(screen.getByRole("tab", { name: "Favoritos (0)" })).toBeInTheDocument();
  });

  it("sin almacenamiento la app sigue funcionando y lo explica", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Bloqueado", "SecurityError");
    });
    try {
      const { detail } = await openPanama();
      expect(within(detail).getByRole("button", { name: "Guardar en favoritos" })).toBeDisabled();
      expect(within(detail).getByText(/no permite guardar favoritos/)).toBeInTheDocument();
    } finally {
      setItem.mockRestore();
    }
  });

  it("un contenido guardado inválido no rompe la página", async () => {
    window.localStorage.setItem("terramova:favorites", "{roto");
    await openPanama();
    expect(screen.getByRole("tab", { name: "Favoritos (0)" })).toBeInTheDocument();
  });
});

describe("Enlace compartible", () => {
  it("restablecer conserva la vista 2D y el evento seleccionado", async () => {
    const user = userEvent.setup();
    const { router } = renderRoutes(routes, `/?min_magnitude=3&view=2d&event=${PANAMA_ID}`);
    await screen.findByRole("region", { name: PANAMA });

    await user.click(screen.getByRole("button", { name: "Restablecer" }));

    expect(router.state.location.search).toBe(`?event=${PANAMA_ID}&view=2d`);
  });
});
