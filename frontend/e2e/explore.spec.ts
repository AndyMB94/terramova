import { test as base, expect, type Page } from "@playwright/test";

import { BLAST, EVENTS, meta, SECOND_PAGE } from "../src/test/msw/fixtures";

/** Desactiva WebGL en la página: la app muestra el aviso y la lista (camino sin globo). */
function disableWebGL() {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    type: string,
    ...args: unknown[]
  ) {
    if (type.startsWith("webgl")) return null;
    return (original as (...a: unknown[]) => unknown).call(this, type, ...args);
  } as typeof HTMLCanvasElement.prototype.getContext;
}

/**
 * Sin GPU, el globo se dibuja por software y satura la CPU con varias pruebas en paralelo.
 * Por defecto las pruebas corren sin WebGL; las del globo usan `test.use({ webgl: true })`.
 */
const test = base.extend<{ webgl: boolean }>({
  webgl: [false, { option: true }],
  // "provide" en vez del habitual "use": la regla de hooks de React lo confundiría.
  page: async ({ page, webgl }, provide) => {
    if (!webgl) await page.addInitScript(disableWebGL);
    await provide(page);
  },
});

const PANAMA = EVENTS.find((event) => event.external_id === "test0002") ?? EVENTS[0];
if (!PANAMA) throw new Error("Faltan los datos de prueba");
const WINDOW = { start: "2026-10-15T04:33:36Z", end: "2026-10-22T04:33:36Z" };

/** Simula la API con datos ficticios y registra las consultas a la lista. */
async function mockApi(page: Page, options: { failList?: boolean } = {}) {
  const listRequests: URL[] = [];
  await page.route("**/api/v1/meta/", (route) => route.fulfill({ json: meta() }));
  await page.route("**/api/v1/earthquakes/?*", (route) => {
    const url = new URL(route.request().url());
    listRequests.push(url);
    if (options.failList) {
      return route.fulfill({
        status: 503,
        json: { code: "temporarily_unavailable", message: "No disponible." },
      });
    }
    if (url.searchParams.get("cursor") === "page-2") {
      return route.fulfill({ json: { results: SECOND_PAGE, next_cursor: null, window: WINDOW } });
    }
    const results = url.searchParams.get("event_type") === "all" ? [...EVENTS, BLAST] : EVENTS;
    return route.fulfill({ json: { results, next_cursor: "page-2", window: WINDOW } });
  });
  await page.route("**/api/v1/earthquakes/geojson/?*", (route) => {
    const url = new URL(route.request().url());
    const events = url.searchParams.get("event_type") === "all" ? [...EVENTS, BLAST] : EVENTS;
    return route.fulfill({
      json: {
        type: "FeatureCollection",
        features: events.map((event) => ({
          type: "Feature",
          id: event.id,
          geometry: { type: "Point", coordinates: [event.longitude, event.latitude] },
          properties: {
            magnitude: event.magnitude,
            depth_km: event.depth_km,
            occurred_at: event.occurred_at,
            place: event.place ?? "",
          },
        })),
        metadata: {
          window: WINDOW,
          total_matching: events.length,
          returned: events.length,
          limit: 5000,
          truncated: false,
          selection: "magnitude_desc",
        },
      },
    });
  });
  await page.route(/\/api\/v1\/earthquakes\/[0-9a-f-]{36}\/$/, (route) => {
    const id = route.request().url().split("/").at(-2);
    const found = [...EVENTS, ...SECOND_PAGE, BLAST].find((event) => event.id === id);
    return found
      ? route.fulfill({ json: found })
      : route.fulfill({ status: 404, json: { code: "event_not_found", message: "No existe." } });
  });
  return listRequests;
}

const eventList = (page: Page) => page.getByRole("region", { name: "Eventos" });

test("recorrido principal: ver eventos, abrir la ficha y compartir la URL", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");

  await expect(eventList(page).getByText("120 km al NE de Ficticia, Testland")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Datos al día");

  await eventList(page)
    .getByRole("button", { name: /192 km al S de Burica/ })
    .click();
  const detail = page.getByRole("region", { name: "192 km al S de Burica, Panama" });
  await expect(detail).toBeVisible();
  await expect(detail).toContainText("M 5,4");
  await expect(detail).toContainText("Hora local (UTC−5)");
  await expect(page).toHaveURL(`/?event=${PANAMA.id}`);

  // La misma URL en otra pestaña restaura la ficha.
  const shared = await page.context().newPage();
  await mockApi(shared);
  await shared.goto(`/?event=${PANAMA.id}`);
  await expect(shared.getByRole("region", { name: "192 km al S de Burica, Panama" })).toBeVisible();
});

test("los filtros cambian la consulta y quedan en la URL", async ({ page }) => {
  const requests = await mockApi(page);
  await page.goto("/");
  await expect(eventList(page).getByText("6,1")).toBeVisible();

  // En móvil y tableta los filtros están plegados tras un botón.
  const filtersButton = page.getByRole("button", { name: /^Filtros/ });
  if (await filtersButton.isVisible()) await filtersButton.click();

  await page.getByRole("button", { name: "24 h" }).click();
  await page.getByLabel(/Incluir otros tipos/).check();

  await expect(page).toHaveURL("/?period=24h&types=all");
  await expect(eventList(page).getByText("Cantera de prueba")).toBeVisible();
  const last = requests.at(-1);
  expect(last?.searchParams.get("start")).toBe("2026-10-21T04:33:36.000Z");
  expect(last?.searchParams.get("event_type")).toBe("all");
});

test("teclado: seleccionar con Intro, cerrar con Escape y recuperar el foco", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  const row = eventList(page).getByRole("button", { name: /192 km al S de Burica/ });
  await expect(row).toBeVisible();

  await row.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "192 km al S de Burica, Panama" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "192 km al S de Burica, Panama" })).toHaveCount(0);
  await expect(row).toBeFocused();
});

test("cargar más usa el cursor", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");

  await eventList(page).getByRole("button", { name: "Cargar más" }).click();

  await expect(eventList(page).getByText("5 km al ONO de Ejemplo, Testland")).toBeVisible();
  await expect(eventList(page).getByRole("button", { name: "Cargar más" })).toHaveCount(0);
});

test("error de la API: mensaje claro y reintento", async ({ page }) => {
  await mockApi(page, { failList: true });
  await page.goto("/");

  const alert = eventList(page).getByRole("alert");
  // Ante un 5xx la app reintenta dos veces (1 s + 2 s): el aviso tarda más de 3 s en salir.
  await expect(alert).toContainText("El servicio no está disponible temporalmente", {
    timeout: 15_000,
  });
  await expect(alert.getByRole("button", { name: "Reintentar" })).toBeVisible();
});

test("movimiento reducido: el interruptor se aplica y se recuerda al recargar", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/");

  await page.getByRole("button", { name: /Movimiento: completo/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
});

test("captura de la vista con una ficha abierta", async ({ page }, testInfo) => {
  await mockApi(page);
  await page.goto(`/?event=${PANAMA.id}`);
  await expect(page.getByRole("region", { name: "192 km al S de Burica, Panama" })).toBeVisible();
  await expect(eventList(page).getByText("6,1")).toBeVisible();
  // Las fuentes usan font-display: swap; la captura espera a que estén cargadas.
  await page.evaluate(() => document.fonts.ready);

  await page.screenshot({
    path: testInfo.outputPath(`explorar-${testInfo.project.name}.png`),
    fullPage: true,
  });
});

test("fuentes y créditos accesibles en cualquier tamaño de pantalla", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");

  await page
    .getByRole("link", { name: /créditos/ })
    .last()
    .click();

  await expect(page.getByRole("heading", { level: 1, name: "Acerca de TerraMova" })).toBeVisible();
  await expect(page.getByText(/no es un sistema oficial de alerta/)).toBeVisible();
});

// --- globo -------------------------------------------------------------------------------

test.describe("globo (WebGL por software)", () => {
  test.use({ webgl: true });
  // Dibujar por software satura la CPU: varias pruebas del globo en paralelo (y en los tres
  // tamaños) llegaron a una carga de 43 en 12 núcleos y fallaban por tiempo. Se ejecutan
  // en secuencia y solo en escritorio; tableta y móvil se cubren con el resto de la suite.
  test.describe.configure({ mode: "default" });
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "Globo solo en escritorio");

  /** Peticiones que salen fuera del servidor local (p. ej. Cesium ion): deben ser cero. */
  function trackExternalRequests(page: Page): string[] {
    const external: string[] = [];
    page.on("request", (request) => {
      const { hostname, protocol } = new URL(request.url());
      if (protocol.startsWith("http") && !["127.0.0.1", "localhost"].includes(hostname)) {
        external.push(request.url());
      }
    });
    return external;
  }

  test("el globo se dibuja con recursos propios, créditos y sin servicios externos", async ({
    page,
  }) => {
    const external = trackExternalRequests(page);
    await mockApi(page);
    await page.goto("/");

    await expect(page.getByRole("application", { name: /Globo con los eventos/ })).toBeVisible();
    await expect(page.locator("canvas").first()).toBeVisible();
    await expect(page.getByText("Imágenes: NASA Blue Marble")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Fronteras: Natural Earth/)).toBeVisible();
    await page.waitForTimeout(1500);
    expect(external).toEqual([]);
  });

  test("cambio entre globo 3D y mapa 2D", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    const map2d = page.getByRole("button", { name: "Mapa 2D" });
    await expect(map2d).toHaveAttribute("aria-pressed", "false");

    await map2d.click();

    await expect(map2d).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Globo 3D" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("filtrar por el área visible del mapa", async ({ page }) => {
    const requests = await mockApi(page);
    await page.goto("/");
    await expect(page.locator("canvas").first()).toBeVisible();

    for (let step = 0; step < 4; step += 1) {
      await page.getByRole("button", { name: "Acercar" }).click();
    }
    const filtersButton = page.getByRole("button", { name: /^Filtros/ });
    if (await filtersButton.isVisible()) await filtersButton.click();
    await page.getByRole("button", { name: "Vista del mapa" }).click();

    await expect(page).toHaveURL(/bbox=-?\d/);
    await expect.poll(() => requests.at(-1)?.searchParams.get("bbox") ?? null).not.toBeNull();
  });

  // El estado del movimiento se refleja en data-intro, data-spin y data-quality del globo.
  const globe = (page: Page) => page.getByRole("application", { name: /Globo con los eventos/ });

  test("intro una vez por pestaña, giro tras 8 s sin actividad y botón para pausarlo", async ({
    page,
  }) => {
    // Esperan la inactividad de 8 s: más que el límite habitual de 30 s.
    test.slow();
    await mockApi(page);
    await page.goto("/");
    await expect(globe(page)).toHaveAttribute("data-intro", /playing|done/);
    await expect(globe(page)).toHaveAttribute("data-spin", "on", { timeout: 25_000 });

    const pause = page.getByRole("button", { name: "Pausar giro" });
    await pause.click();
    await expect(page.getByRole("button", { name: "Reanudar giro" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(globe(page)).toHaveAttribute("data-spin", "off");
    // Pausado, no vuelve a girar aunque pase el tiempo de inactividad.
    await page.waitForTimeout(9_000);
    await expect(globe(page)).toHaveAttribute("data-spin", "off");

    await page.reload();
    await expect(globe(page)).toHaveAttribute("data-intro", "skipped");
    await expect(page.getByRole("button", { name: "Reanudar giro" })).toBeVisible();
  });

  test("con un evento abierto el globo no gira", async ({ page }) => {
    // Esperan la inactividad de 8 s: más que el límite habitual de 30 s.
    test.slow();
    await mockApi(page);
    await page.goto(`/?event=${PANAMA.id}`);
    await expect(page.getByRole("region", { name: "192 km al S de Burica, Panama" })).toBeVisible();
    await page.waitForTimeout(9_000);
    await expect(globe(page)).toHaveAttribute("data-spin", "off");
  });

  test("movimiento reducido: sin intro, sin giro y sin botón de pausa", async ({ page }) => {
    // Esperan la inactividad de 8 s: más que el límite habitual de 30 s.
    test.slow();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockApi(page);
    await page.goto("/");
    await expect(globe(page)).toHaveAttribute("data-intro", "skipped");
    await expect(page.getByRole("button", { name: "Pausar giro" })).toHaveCount(0);
    await page.waitForTimeout(9_000);
    await expect(globe(page)).toHaveAttribute("data-spin", "off");
  });

  test("calidad: la automática baja si los fps caen y el selector la fuerza", async ({ page }) => {
    // Esperan la inactividad de 8 s: más que el límite habitual de 30 s.
    test.slow();
    await mockApi(page);
    await page.goto("/");
    const quality = page.getByLabel("Calidad");
    // Por software los fps son bajos: al girar se mide y se pasa a calidad baja.
    await expect(globe(page)).toHaveAttribute("data-quality", "low", { timeout: 30_000 });
    await expect(quality.locator("option:checked")).toHaveText("Automática (baja)");

    await quality.selectOption("high");
    await expect(globe(page)).toHaveAttribute("data-quality", "high");
    await page.reload();
    await expect(page.getByLabel("Calidad")).toHaveValue("high");
    await expect(globe(page)).toHaveAttribute("data-quality", "high");
  });
});

test("sin WebGL se avisa y la lista sigue funcionando", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");

  await expect(page.getByText("Este navegador no puede mostrar el globo")).toBeVisible();
  await expect(eventList(page).getByText("120 km al NE de Ficticia, Testland")).toBeVisible();
  const filtersButton = page.getByRole("button", { name: /^Filtros/ });
  if (await filtersButton.isVisible()) await filtersButton.click();
  await expect(page.getByRole("button", { name: "Vista del mapa" })).toBeDisabled();
});
