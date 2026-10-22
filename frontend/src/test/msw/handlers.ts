import { http, HttpResponse } from "msw";

import { BLAST, EVENTS, meta, SECOND_PAGE } from "./fixtures";

/** Peticiones recibidas, para comprobar los parámetros que envía la interfaz. */
export const requests: URL[] = [];

const WINDOW = { start: "2026-10-15T04:33:36Z", end: "2026-10-22T04:33:36Z" };

export const handlers = [
  http.get("*/api/v1/meta/", () => HttpResponse.json(meta())),

  http.get("*/api/v1/earthquakes/", ({ request }) => {
    const url = new URL(request.url);
    requests.push(url);
    if (url.searchParams.get("cursor") === "page-2") {
      return HttpResponse.json({ results: SECOND_PAGE, next_cursor: null, window: WINDOW });
    }
    const results = url.searchParams.get("event_type") === "all" ? [...EVENTS, BLAST] : EVENTS;
    return HttpResponse.json({ results, next_cursor: "page-2", window: WINDOW });
  }),

  http.get("*/api/v1/earthquakes/:id/", ({ params }) => {
    const found = [...EVENTS, ...SECOND_PAGE, BLAST].find((item) => item.id === params.id);
    return found
      ? HttpResponse.json(found)
      : HttpResponse.json(
          { code: "event_not_found", message: "El evento no existe." },
          { status: 404 },
        );
  }),
];
