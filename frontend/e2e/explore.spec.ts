import { expect, type Page, test } from "@playwright/test";

import { BLAST, EVENTS, meta, SECOND_PAGE } from "../src/test/msw/fixtures";

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
  await expect(alert).toContainText("El servicio no está disponible temporalmente");
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
