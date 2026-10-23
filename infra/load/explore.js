// Prueba de carga de la API pública (Fase 6). Cada usuario virtual hace lo que hace la
// página al abrirse: estado de los datos, lista, mapa y, a veces, analítica, con periodos y
// filtros variados (para no medir solo la caché) y una pausa entre visitas.
//
// Uso (k6 en Docker, contra el entorno de comprobación local):
//   docker run --rm --network host -v "$PWD/infra/load:/load" grafana/k6:2.3.0 run \
//     -e BASE_URL=http://127.0.0.1:8101 -e HOST=terramova.andymallcco.dev /load/explore.js
//
// El 429 (límite de tasa) es una respuesta esperada, no un fallo: se cuenta aparte.
import { check, sleep } from "k6";
import http from "k6/http";
import { Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:8101";
const HOST = __ENV.HOST || "terramova.andymallcco.dev";
const VUS = Number(__ENV.VUS || 50);

const rateLimited = new Rate("rate_limited");

export const options = {
  scenarios: {
    visitors: {
      executor: "ramping-vus",
      stages: [
        { duration: "20s", target: VUS },
        { duration: "60s", target: VUS },
        { duration: "10s", target: 0 },
      ],
    },
  },
  thresholds: {
    // Objetivos (docs/DEPLOYMENT.md): sin errores de servidor y respuesta ágil.
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, 429));

const PARAMS = {
  // Nginx (o Gunicorn detrás de él) recibe HTTPS: se simula con la cabecera del proxy.
  headers: { Host: HOST, "X-Forwarded-Proto": "https", "Accept-Encoding": "gzip" },
};
const COVERAGE_END = Date.now();
const PERIODS_MS = [24 * 3600e3, 7 * 24 * 3600e3, 30 * 24 * 3600e3];
const MAGNITUDES = [null, 2, 4];

function query() {
  const period = PERIODS_MS[Math.floor(Math.random() * PERIODS_MS.length)];
  const magnitude = MAGNITUDES[Math.floor(Math.random() * MAGNITUDES.length)];
  // Fechas redondeadas al minuto: como el frontend, que cuenta desde el final de la cobertura.
  const end = Math.floor(COVERAGE_END / 60e3) * 60e3;
  const parts = [`start=${new Date(end - period).toISOString()}`];
  if (magnitude !== null) parts.push(`min_magnitude=${magnitude}`);
  return parts.join("&");
}

function get(path) {
  const response = http.get(`${BASE_URL}${path}`, PARAMS);
  rateLimited.add(response.status === 429);
  check(response, { "sin error de servidor": (r) => r.status < 500 });
  return response;
}

export default function () {
  const q = query();
  get("/api/v1/meta/");
  get(`/api/v1/earthquakes/?ordering=-magnitude&page_size=50&${q}`);
  get(`/api/v1/earthquakes/geojson/?${q}`);
  if (Math.random() < 0.3) {
    get(`/api/v1/analytics/summary/?${q}`);
    get(`/api/v1/analytics/timeline/?${q}`);
  }
  sleep(1 + Math.random() * 2);
}
