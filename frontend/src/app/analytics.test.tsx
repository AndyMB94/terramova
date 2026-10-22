import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { summary } from "@/test/msw/fixtures";
import { analyticsRequests } from "@/test/msw/handlers";
import { server } from "@/test/msw/server";
import { renderRoutes } from "@/test/render";

import { routes } from "./router";

function card(label: string) {
  const term = screen.getByText(label, { selector: "dt" });
  return within(term.parentElement as HTMLElement);
}

function useSummary(overrides: Parameters<typeof summary>[0]) {
  server.use(http.get("*/api/v1/analytics/summary/", () => HttpResponse.json(summary(overrides))));
}

describe("Analítica", () => {
  it("muestra total, magnitud máxima y variación frente al periodo anterior", async () => {
    renderRoutes(routes, "/analitica");

    expect(await screen.findByText("12", { selector: "dd" })).toBeInTheDocument();
    expect(card("Magnitud máxima").getByText("M 6,1")).toBeInTheDocument();
    expect(card("Magnitud máxima").getByText(/120 km al NE de Ficticia/)).toBeInTheDocument();
    // 12 frente a 16: −25 %, con signo tipográfico. Testing Library normaliza el espacio duro
    // de la página a uno normal (labels.test.ts comprueba que existe).
    expect(card("Frente al periodo anterior").getByText("−25 %")).toBeInTheDocument();
    expect(
      card("Frente al periodo anterior").getByText(/16 eventos en el periodo anterior/),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Eventos por día" })).toBeInTheDocument();
  });

  it("cada gráfica se puede consultar como tabla, sin dato aparte y extremos marcados", async () => {
    const user = userEvent.setup();
    renderRoutes(routes, "/analitica");

    const magnitudes = await screen.findByRole("region", { name: "Distribución por magnitud" });
    await user.click(within(magnitudes).getByRole("button", { name: "Ver como tabla" }));
    const table = within(magnitudes).getByRole("table");
    expect(within(table).getByRole("row", { name: /1 – 2 4 33,3/ })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: /Sin magnitud 1/ })).toBeInTheDocument();

    const timeline = screen.getByRole("region", { name: "Eventos por día" });
    await user.click(within(timeline).getByRole("button", { name: "Ver como tabla" }));
    expect(within(timeline).getByRole("row", { name: /15 oct UTC \* 1/ })).toBeInTheDocument();
    expect(within(timeline).getByRole("row", { name: /17 oct UTC 0 —/ })).toBeInTheDocument();
  });

  it("comparte los filtros con Explorar: el enlace de la cabecera los conserva", async () => {
    const user = userEvent.setup();
    const { router } = renderRoutes(routes, "/?min_magnitude=4&period=30d");

    await user.click(screen.getByRole("link", { name: "Analítica" }));

    expect(router.state.location.pathname).toBe("/analitica");
    await screen.findByText("12", { selector: "dd" });
    const sent = analyticsRequests.at(-1);
    expect(sent?.searchParams.get("min_magnitude")).toBe("4");
    // 30 días contados desde el final de la cobertura, como la lista y el mapa.
    expect(sent?.searchParams.get("start")).toBe("2026-09-22T04:33:36.000Z");
  });

  it("enlaza la magnitud máxima con el evento en el globo, conservando los filtros", async () => {
    renderRoutes(routes, "/analitica?min_magnitude=2");

    const link = await screen.findByRole("link", { name: "Ver en el globo" });
    expect(link).toHaveAttribute(
      "href",
      "/?min_magnitude=2&event=11111111-1111-4111-8111-111111111111",
    );
  });

  it("no compara con días sin sincronizar y lo explica", async () => {
    useSummary({
      comparison: {
        available: false,
        previous_window: { start: "2026-08-23T04:33:36Z", end: "2026-09-22T04:33:36Z" },
        previous_total: null,
        reason: "outside_coverage",
      },
    });
    renderRoutes(routes, "/analitica?period=30d");

    const comparison = await screen.findByText("Sin comparación");
    expect(comparison.parentElement).toHaveTextContent(/no están sincronizados/);
  });

  it("avisa si la cobertura recortó el periodo", async () => {
    useSummary({ window_clipped: true });
    renderRoutes(routes, "/analitica");

    expect(
      await screen.findByText(/La cobertura empieza el 22 de septiembre de 2026/),
    ).toBeInTheDocument();
  });

  it("distingue «sin eventos» de «sin cobertura»", async () => {
    useSummary({ total: 0, strongest: null, max_magnitude: null });
    const { unmount } = renderRoutes(routes, "/analitica");
    expect(await screen.findByText("Sin eventos registrados en esta consulta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restablecer filtros" })).toBeInTheDocument();
    unmount();

    useSummary({ window: null, total: 0, strongest: null, max_magnitude: null });
    renderRoutes(routes, "/analitica");
    expect(await screen.findByText("Sin cobertura o sin datos todavía")).toBeInTheDocument();
  });

  it("error de la API: mensaje claro y reintento", async () => {
    server.use(
      http.get("*/api/v1/analytics/summary/", () =>
        HttpResponse.json(
          { code: "temporarily_unavailable", message: "No disponible." },
          { status: 503 },
        ),
      ),
    );
    renderRoutes(routes, "/analitica");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("El servicio no está disponible temporalmente");
    expect(within(alert).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});
