import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { meta } from "@/test/msw/fixtures";
import { requests } from "@/test/msw/handlers";
import { server } from "@/test/msw/server";
import { renderRoutes } from "@/test/render";

import { routes } from "./router";

const PANAMA_ID = "22222222-2222-4222-8222-222222222222";

function list() {
  return within(screen.getByRole("region", { name: "Eventos" }));
}

describe("Explorar", () => {
  it("muestra los eventos de la API con magnitud, lugar traducido y profundidad", async () => {
    renderRoutes(routes);

    expect(await list().findByText("120 km al NE de Ficticia, Testland")).toBeInTheDocument();
    expect(list().getByText("6,1")).toBeInTheDocument();
    expect(list().getByText("135 km")).toBeInTheDocument();
    // Nulos explícitos, sin inventar valores.
    expect(list().getByText("Sin dato")).toBeInTheDocument();
    expect(requests[0]?.searchParams.get("ordering")).toBe("-magnitude");
    expect(requests[0]?.searchParams.has("event_type")).toBe(false);
  });

  it("al seleccionar un evento abre la ficha y lo guarda en la URL", async () => {
    const user = userEvent.setup();
    const { router } = renderRoutes(routes);

    await user.click(await list().findByRole("button", { name: /192 km al S de Burica/ }));

    const detail = screen.getByRole("region", { name: "192 km al S de Burica, Panama" });
    expect(within(detail).getByText("M 5,4")).toBeInTheDocument();
    expect(within(detail).getByText("Revisado por USGS")).toBeInTheDocument();
    expect(within(detail).getByRole("link", { name: /Ver en USGS/ })).toHaveAttribute(
      "href",
      "https://earthquake.usgs.gov/earthquakes/eventpage/test0002",
    );
    expect(router.state.location.search).toBe(`?event=${PANAMA_ID}`);
  });

  it("restaura la ficha desde una URL compartida y la cierra con Escape", async () => {
    const user = userEvent.setup();
    const { router } = renderRoutes(routes, `/?event=${PANAMA_ID}`);

    expect(
      await screen.findByRole("region", { name: "192 km al S de Burica, Panama" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("region", { name: "192 km al S de Burica, Panama" }),
    ).not.toBeInTheDocument();
    expect(router.state.location.search).toBe("");
  });

  it("un evento inexistente muestra un mensaje en la ficha", async () => {
    renderRoutes(routes, "/?event=99999999-9999-4999-8999-999999999999");

    expect(await screen.findByText("No se encontró lo que buscabas.")).toBeInTheDocument();
  });

  it("los filtros actualizan la URL y la consulta", async () => {
    const user = userEvent.setup();
    const { router } = renderRoutes(routes);
    await list().findByText("6,1");

    await user.click(screen.getByRole("button", { name: "24 h" }));
    await user.click(screen.getByLabelText(/Incluir otros tipos/));

    await waitFor(() => expect(router.state.location.search).toBe("?period=24h&types=all"));
    expect(await list().findByText("Cantera de prueba")).toBeInTheDocument();
    const last = requests.at(-1);
    expect(last?.searchParams.get("start")).toBe("2026-10-21T04:33:36.000Z");
    expect(last?.searchParams.get("event_type")).toBe("all");
  });

  it("dos filtros cambiados muy seguidos se conservan ambos", async () => {
    const { router } = renderRoutes(routes);
    await list().findByText("6,1");

    // Sin esperar entre clics: el segundo cambio no debe pisar al primero.
    fireEvent.click(screen.getByRole("button", { name: "24 h" }));
    fireEvent.click(screen.getByLabelText(/Incluir otros tipos/));

    await waitFor(() => expect(router.state.location.search).toBe("?period=24h&types=all"));
    expect(screen.getByLabelText(/Incluir otros tipos/)).toBeChecked();
  });

  it("aplica la magnitud mínima al salir del campo, no en cada tecla", async () => {
    const user = userEvent.setup();
    const { router } = renderRoutes(routes);
    await list().findByText("6,1");
    const before = requests.length;

    const [field] = screen.getAllByLabelText("Mínima");
    if (!field) throw new Error("No se encontró el campo de magnitud mínima");
    await user.type(field, "4,5");
    expect(requests.length).toBe(before);
    await user.tab();

    await waitFor(() => expect(router.state.location.search).toBe("?min_magnitude=4.5"));
    await waitFor(() => expect(requests.at(-1)?.searchParams.get("min_magnitude")).toBe("4.5"));
  });

  it("carga más resultados con el cursor", async () => {
    const user = userEvent.setup();
    renderRoutes(routes);

    await user.click(await list().findByRole("button", { name: "Cargar más" }));

    expect(await list().findByText("5 km al ONO de Ejemplo, Testland")).toBeInTheDocument();
    expect(requests.at(-1)?.searchParams.get("cursor")).toBe("page-2");
    expect(list().queryByRole("button", { name: "Cargar más" })).not.toBeInTheDocument();
  });

  it("estado vacío con acción para restablecer", async () => {
    server.use(
      http.get("*/api/v1/earthquakes/", () =>
        HttpResponse.json({ results: [], next_cursor: null, window: null }),
      ),
    );
    renderRoutes(routes, "/?min_magnitude=9");

    expect(
      await list().findByText(/No hay eventos registrados con estos filtros/),
    ).toBeInTheDocument();
    expect(list().getByRole("button", { name: "Restablecer filtros" })).toBeInTheDocument();
  });

  it("error de la API con reintento que recupera la lista", async () => {
    const user = userEvent.setup();
    let fail = true;
    server.use(
      http.get("*/api/v1/earthquakes/", () => {
        if (fail) {
          return HttpResponse.json(
            { code: "rate_limited", message: "Demasiadas peticiones." },
            { status: 429 },
          );
        }
        return HttpResponse.json({ results: [], next_cursor: null, window: null });
      }),
    );
    renderRoutes(routes);

    const alert = await list().findByRole("alert");
    expect(alert).toHaveTextContent("Hay demasiadas consultas en este momento");
    fail = false;
    await user.click(within(alert).getByRole("button", { name: "Reintentar" }));

    expect(await list().findByText(/No hay eventos registrados/)).toBeInTheDocument();
  });

  it("muestra la frescura y avisa si los datos están desactualizados", async () => {
    server.use(
      http.get("*/api/v1/meta/", () =>
        HttpResponse.json(
          meta({
            is_stale: true,
            last_successful_sync_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
          }),
        ),
      ),
    );
    renderRoutes(routes);

    const status = await screen.findByRole("status");
    await within(status).findByText("Datos desactualizados");
    expect(within(status).getByText("hace 3 h")).toBeInTheDocument();
  });
});

describe("Globo", () => {
  it("sin WebGL avisa, deshabilita el filtro de área y la lista sigue disponible", async () => {
    renderRoutes(routes);

    expect(screen.getByText("Este navegador no puede mostrar el globo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vista del mapa" })).toBeDisabled();
    expect(await list().findByText("6,1")).toBeInTheDocument();
  });

  it("un bbox compartido en la URL se envía a la lista y al mapa", async () => {
    renderRoutes(routes, "/?bbox=-82,-56,-34,13");

    await list().findByText("6,1");
    expect(requests.at(-1)?.searchParams.get("bbox")).toBe("-82,-56,-34,13");
    expect(screen.getAllByText("Área del mapa").length).toBeGreaterThan(0);
  });
});

describe("Frescura de los datos", () => {
  it("respeta is_stale del servidor aunque la sincronización parezca reciente", async () => {
    server.use(http.get("*/api/v1/meta/", () => HttpResponse.json(meta({ is_stale: true }))));
    renderRoutes(routes);

    expect(
      await within(await screen.findByRole("status")).findByText("Datos desactualizados"),
    ).toBeInTheDocument();
  });

  it("lo deduce en el navegador si la última sincronización supera el umbral", async () => {
    const old = new Date(Date.now() - 20 * 60_000).toISOString();
    server.use(
      http.get("*/api/v1/meta/", () =>
        HttpResponse.json(meta({ is_stale: false, last_successful_sync_at: old })),
      ),
    );
    renderRoutes(routes);

    expect(
      await within(await screen.findByRole("status")).findByText("Datos desactualizados"),
    ).toBeInTheDocument();
  });

  it("muestra que los datos están al día", async () => {
    renderRoutes(routes);

    expect(
      await within(await screen.findByRole("status")).findByText("Datos al día"),
    ).toBeInTheDocument();
  });
});

describe("Preferencias", () => {
  it("el interruptor de movimiento reducido se refleja en el documento y se recuerda", async () => {
    const user = userEvent.setup();
    renderRoutes(routes);

    expect(document.documentElement.dataset.motion).toBe("full");
    await user.click(screen.getByRole("button", { name: /Movimiento: completo/ }));

    expect(document.documentElement.dataset.motion).toBe("reduced");
    expect(window.localStorage.getItem("terramova:motion")).toBe("reduced");
  });

  it("el tema se puede cambiar a claro", async () => {
    const user = userEvent.setup();
    renderRoutes(routes);

    await user.click(screen.getByRole("button", { name: "Cambiar a tema claro" }));

    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
