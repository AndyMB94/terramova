# Estructura del proyecto

Complementa `docs/ARCHITECTURE.md` (sección "Organización objetivo"), que solo define las carpetas de primer nivel. Este documento fija el contenido interno de cada carpeta, las convenciones y las reglas de dependencia entre capas.

Regla general (del plan): crear carpetas y archivos **cuando tengan uso real**. El árbol es el destino, no algo para generar vacío en la Fase 0. La columna "Fase" indica cuándo aparece cada parte.

## Árbol completo (monorepo)

```text
terramova/
├── CLAUDE.md
├── README.md
├── START_HERE.md
├── Makefile                      # Fase 0 · punto de entrada único: make up, make test, make lint
├── .editorconfig
├── .gitignore
├── .env.example                  # sin secretos; AI_ENABLED=false
├── .pre-commit-config.yaml       # ruff, prettier/eslint, detect-secrets/gitleaks
├── compose.yaml                  # Fase 0 · servicios base: db, redis, backend
├── compose.override.yaml         # Fase 0 · solo dev: hot reload, puertos SIEMPRE en 127.0.0.1
├── compose.prod.yaml             # Fase 6 · db/redis sin ports:, backend 127.0.0.1:8100, scheduler
│
├── .github/
│   ├── workflows/
│   │   ├── backend.yml           # paths: backend/** · ruff, mypy, pytest (Postgres/Redis efímeros), makemigrations --check
│   │   ├── frontend.yml          # paths: frontend/** · eslint, tsc, vitest, build
│   │   ├── contract.yml          # Fase 2 · OpenAPI generado == commiteado; tipos TS regenerados sin diff
│   │   └── e2e.yml               # Fase 3 · Playwright contra build + fixtures
│   ├── dependabot.yml
│   └── pull_request_template.md
│
├── backend/
│   ├── pyproject.toml            # deps + config de ruff, mypy, pytest
│   ├── uv.lock                   # lockfile (uv recomendado; o pip-tools)
│   ├── manage.py
│   ├── Dockerfile                # multi-stage, usuario no root
│   ├── config/
│   │   ├── settings/
│   │   │   ├── base.py           # todo lo común; lee env con django-environ/pydantic-settings
│   │   │   ├── dev.py
│   │   │   ├── test.py
│   │   │   └── prod.py           # DEBUG=False, hosts, seguridad, logging JSON
│   │   ├── urls.py               # /api/v1/, /health/, /admin/ (ruta no obvia)
│   │   ├── api_router.py         # agrega las urls de cada app bajo /api/v1/
│   │   ├── wsgi.py
│   │   └── asgi.py
│   │
│   ├── core/                     # Fase 0 · transversal, SIN lógica de negocio
│   │   ├── exceptions.py         # DomainError, ExternalServiceError, códigos estables
│   │   ├── api/
│   │   │   ├── exception_handler.py   # mapea errores → {code, message}; sin stack traces
│   │   │   ├── pagination.py          # CursorPagination por (-occurred_at, id)
│   │   │   └── throttling.py
│   │   ├── locks.py              # pg_advisory_lock como context manager
│   │   ├── cache.py              # claves canónicas: schema_version + data_version + filtros normalizados
│   │   ├── http.py               # cliente httpx con timeout, tamaño máx. y retries con backoff
│   │   ├── logging.py            # request_id, formato JSON en prod
│   │   ├── time.py               # utilidades UTC, intervalos [start, end)
│   │   └── health/               # views live/ready
│   │
│   ├── apps/
│   │   ├── earthquakes/          # Fase 1–2
│   │   │   ├── apps.py
│   │   │   ├── models.py         # Earthquake, SyncRun
│   │   │   ├── admin.py
│   │   │   ├── domain.py         # dataclasses/value objects: EarthquakeFilters, BBox (antimeridiano)
│   │   │   ├── selectors.py      # lecturas ORM acotadas: list_events(filters), get_event(id)
│   │   │   ├── services/
│   │   │   │   ├── sync.py       # SyncEarthquakesService(source: EarthquakeSource)
│   │   │   │   └── upsert.py     # upsert por (source, external_id) con política de versión
│   │   │   ├── ports.py          # Protocol EarthquakeSource (contrato que implementa el adapter)
│   │   │   ├── api/
│   │   │   │   ├── serializers.py
│   │   │   │   ├── filters.py    # parseo/validación de query params → EarthquakeFilters
│   │   │   │   ├── views.py      # delgadas: validan, llaman selector, serializan
│   │   │   │   └── urls.py
│   │   │   ├── management/commands/
│   │   │   │   └── sync_earthquakes.py   # --feed day|week|month; exit codes útiles
│   │   │   ├── migrations/
│   │   │   └── tests/
│   │   │       ├── factories.py
│   │   │       ├── test_selectors.py
│   │   │       ├── test_sync_service.py  # idempotencia, correcciones, nulos, fallos parciales
│   │   │       └── test_api.py
│   │   │
│   │   ├── analytics/            # Fase 4 · sin modelos: solo agregaciones sobre earthquakes
│   │   │   ├── selectors.py      # counts, histograma de magnitudes, timeline (TruncHour/TruncDay)
│   │   │   ├── services.py       # comparación de ventanas iguales, cobertura
│   │   │   ├── api/ (serializers.py, views.py, urls.py)
│   │   │   └── tests/
│   │   │
│   │   ├── catalog_meta/         # Fase 2 · /api/v1/meta: cobertura, last_successful_sync_at, data_version
│   │   │   └── (selectors.py, api/, tests/)   # puede vivir dentro de earthquakes si queda pequeño
│   │   │
│   │   └── summaries/            # Fase 5 · opcional
│   │       ├── models.py         # ActivitySummary, AIBudgetPeriod, AIRequest
│   │       ├── ports.py          # Protocol SummaryProvider
│   │       ├── services/
│   │       │   ├── context.py    # construye el JSON agregado y su hash canónico
│   │       │   ├── budget.py     # reserva transaccional (select_for_update), Decimal
│   │       │   ├── generate.py   # orquesta: gate → reserva → provider → validación → persistencia
│   │       │   └── validation.py # esquema de salida, IDs permitidos, cifras
│   │       ├── selectors.py      # latest_summary()
│   │       ├── api/              # SOLO lectura; no hay ruta que llegue a generate.py
│   │       ├── management/commands/
│   │       │   ├── generate_activity_summary.py
│   │       │   └── reconcile_ai_usage.py
│   │       └── tests/            # concurrencia, timeout, agotamiento, 100 lecturas = 0 llamadas
│   │
│   ├── integrations/             # adapters: lo único que habla con el exterior
│   │   ├── usgs/                 # Fase 1
│   │   │   ├── client.py         # URLs fijas, usa core/http.py
│   │   │   ├── dto.py            # tipos del GeoJSON crudo (pydantic o dataclasses)
│   │   │   ├── normalize.py      # DTO → datos de dominio; conserva nulos
│   │   │   ├── source.py         # UsgsEarthquakeSource implementa EarthquakeSource
│   │   │   └── tests/fixtures/   # GeoJSON reales recortados, con origen documentado
│   │   └── llm/                  # Fase 5
│   │       ├── deepseek.py       # implementa SummaryProvider
│   │       ├── fake.py           # para tests y dev; único provider usado en CI
│   │       └── tests/
│   │
│   ├── openapi/schema.yaml       # Fase 2 · generado por drf-spectacular y commiteado
│   └── conftest.py               # fixtures pytest globales
│
├── frontend/
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── vite.config.ts            # plugin de Cesium (copia de assets/workers), alias @/
│   ├── tsconfig.json             # strict: true, noUncheckedIndexedAccess
│   ├── eslint.config.js
│   ├── playwright.config.ts
│   ├── public/                   # fuentes autoalojadas, geometría Natural Earth, teselas Blue/Black Marble, créditos
│   ├── e2e/                      # specs Playwright
│   └── src/
│       ├── main.tsx
│       ├── app/
│       │   ├── App.tsx
│       │   ├── router.tsx        # rutas: /, /analytics, /about
│       │   ├── providers.tsx     # QueryClientProvider, tema
│       │   └── query-client.ts   # retries acotados, staleTime alineado al ciclo de sync
│       │
│       ├── shared/
│       │   ├── api/
│       │   │   ├── schema.d.ts   # GENERADO desde backend/openapi/schema.yaml (openapi-typescript)
│       │   │   ├── client.ts     # fetch tipado (openapi-fetch), manejo de {code, message}
│       │   │   └── errors.ts
│       │   ├── ui/               # componentes shadcn copiados + propios genéricos
│       │   ├── hooks/            # useMediaQuery, useMotionPreference (sistema + interruptor propio), usePageVisibility
│       │   ├── lib/              # format de fechas (local + UTC), números, unidades
│       │   └── styles/           # tokens.css: color, tipografía, espacio, radio, sombra, duraciones y curvas
│       │
│       ├── features/
│       │   ├── explore/          # Fase 3
│       │   │   ├── api/          # queries: useEarthquakes(filters), useEarthquake(id), useMeta()
│       │   │   ├── filters/      # esquema zod de filtros ⇄ URL (fuente de verdad de filtros)
│       │   │   ├── globe/
│       │   │   │   ├── CesiumViewer.tsx   # crea/destruye el viewer UNA vez (useEffect + ref)
│       │   │   │   ├── useEventPoints.ts  # PointPrimitiveCollection, no Entities, para miles de puntos
│       │   │   │   ├── useIntroFlight.ts  # fly-in inicial, una vez por sesión, saltable
│       │   │   │   ├── useIdleSpin.ts     # giro tras inactividad; pausa al interactuar y en pestaña oculta
│       │   │   │   ├── useRipples.ts      # ondas en eventos de la última hora (máx. ~20)
│       │   │   │   ├── quality.ts         # modo calidad alta/baja según fps medidos
│       │   │   │   └── index.ts           # export lazy (React.lazy) para separar el bundle
│       │   │   ├── list/
│       │   │   ├── detail/
│       │   │   ├── status/       # última sync, cobertura, truncamiento, datos obsoletos
│       │   │   ├── ExplorePage.tsx
│       │   │   └── index.ts      # API pública de la feature
│       │   ├── analytics/        # Fase 4 · charts + tabla alternativa
│       │   ├── playback/         # Fase 4 · reproducción temporal
│       │   ├── favorites/        # Fase 4 · localStorage versionado, try/catch
│       │   └── summaries/        # Fase 5
│       │
│       └── test/
│           ├── setup.ts
│           └── msw/              # handlers que imitan la API con fixtures etiquetadas
│
├── infra/
│   ├── nginx/
│   │   └── terramova.andymallcco.dev.conf   # sitio para el Nginx del host (ver DEPLOYMENT.md)
│   ├── scheduler/
│   │   └── crontab               # supercronic: sync escalonado (ver abajo)
│   ├── postgres/
│   │   └── backup.sh             # pg_dump cifrado + prueba de restore
│   └── scripts/                  # utilidades de despliegue revisables, sin secretos
│
└── docs/
    ├── (los documentos actuales)
    ├── STRUCTURE.md              # este archivo
    └── adr/                      # una decisión por archivo cuando DECISIONS.md crezca
        └── 0001-template.md
```

## Reglas de dependencia (lo que hace escalable al monolito)

```text
api (views/serializers) ──► services ──► selectors / models
                               │
                               └──► ports (Protocol) ◄── integrations (adapters)
```

1. `views` solo llaman a `services` (escritura/casos de uso) o `selectors` (lectura). Nunca al ORM directamente ni a `integrations`.
2. `services` dependen de **ports** (`EarthquakeSource`, `SummaryProvider`), no de clases concretas. La inyección se hace en el comando Django o en una función `build_*()` pequeña; sin contenedor de DI.
3. `integrations/` no importa `apps/` excepto el `ports.py` que implementa. Nunca toca el ORM.
4. Entre apps solo se importan `selectors` y `services` públicos, nunca modelos de otra app para escribir. `analytics` lee de `earthquakes.selectors`.
5. `core/` no importa nada de `apps/` ni `integrations/`.
6. En frontend: una feature no importa archivos internos de otra feature; solo su `index.ts`. `shared/` no importa de `features/`.

Hacer cumplir 1–5 con **import-linter** (backend) y 6 con **eslint-plugin-boundaries** o la regla `no-restricted-imports` (frontend), dentro de CI. Así la arquitectura no depende de la disciplina de nadie, tampoco del agente.

## Convenciones

| Tema | Convención |
| --- | --- |
| Nombres | Código en inglés; UI y docs en español |
| Archivos Python | `snake_case.py`; servicios como clases con un método público (`execute`/`__call__`) o funciones si no tienen estado |
| Componentes React | `PascalCase.tsx`; hooks `useCamelCase.ts`; un componente por archivo |
| Tests backend | junto a la app, `tests/test_<módulo>.py`; marcador `@pytest.mark.integration` para los que usan Postgres real |
| Tests frontend | `*.test.ts(x)` junto al archivo; E2E en `frontend/e2e/` |
| Contrato API | backend es la fuente de verdad → `openapi/schema.yaml` → `shared/api/schema.d.ts`. Nunca escribir tipos de API a mano |
| Variables de entorno | prefijo por dominio: `DJANGO_*`, `DB_*`, `REDIS_*`, `USGS_*`, `AI_*`. Solo `VITE_PUBLIC_*` llega al frontend |
| Migraciones | una por cambio lógico; nombradas (`--name add_sync_run`); compatibles hacia atrás (expand → migrate → contract) |
| Commits | Conventional Commits, como en QUALITY_GIT.md |

## Sincronización escalonada (scheduler)

Un contenedor `scheduler` con **supercronic** dentro de `compose.prod.yaml`, en vez de un systemd timer del host: viaja con el proyecto, usa la misma imagen y no exige tocar el host del VPS.

| Frecuencia | Comando | Motivo |
| --- | --- | --- |
| cada 2–5 min | `sync_earthquakes --feed day` | eventos nuevos; feed pequeño |
| cada hora | `sync_earthquakes --feed week` | correcciones y revisiones |
| diario | `sync_earthquakes --feed month` | cierre de la ventana de 30 días |

Todas usan el mismo `pg_advisory_lock` por tipo de sync, así que nunca se solapan.

## Fase 0: qué crear realmente

Solo esto; el resto llega con su fase.

- `Makefile`, `compose.yaml` + override, `.env.example`, `.gitignore`, `.editorconfig`, pre-commit.
- `backend/`: `pyproject.toml`, lock, `config/settings/{base,dev,test}.py`, `core/health/`, `core/api/exception_handler.py`, un test de health.
- `frontend/`: Vite + TS strict + Tailwind + shadcn init, `app/` con router y QueryClient, una página inicial, un test de Vitest.
- `.github/workflows/backend.yml` y `frontend.yml`.
- import-linter y reglas de imports del frontend ya configurados (con pocas reglas, crecen con las apps).

### Resultado real de la Fase 0 (diferencias con el árbol)

- Raíz: además, `.gitattributes` (LF), `.secrets.baseline` (detect-secrets) e `infra/scripts/create_dev_env.py` (genera `.env` con secretos aleatorios; `make env`).
- `.github/workflows/repo.yml`: pre-commit sobre todo el repositorio (D39).
- Backend: `core/exceptions.py` contiene solo `DomainError`; `ExternalServiceError`, `api_router.py`, `pagination.py`, `locks.py`, etc. llegan con su fase. Tests de `core` en `core/tests/`. `wsgi.py`/`asgi.py` exigen `DJANGO_SETTINGS_MODULE` explícito; `manage.py` usa `dev` por omisión.
- Frontend: la página inicial es `features/explore/ExplorePage.tsx` (marcador "en construcción", sin datos). Los alias de shadcn (`components.json`) apuntan a `@/shared/ui`, `@/shared/lib/utils` y `@/shared/hooks`. CSS en `shared/styles/index.css` + `tokens.css` (solo tokens de movimiento por ahora).
- Reglas de imports del frontend (D33): fuera de la carpeta actual se importa con `@/`, nunca con `../`; otra feature solo vía `@/features/<nombre>`; `shared/` no importa `features/` ni `app/`; `features/` no importa `app/`. Los tests de rutas viven en `app/`.
- import-linter (backend): por ahora `core` no puede importar `config`; los contratos de `apps/` e `integrations/` se añaden cuando existan esos paquetes.

### Resultado real de la Fase 1 (diferencias con el árbol)

- `apps/earthquakes/`: `apps.py`, `models.py` (`Earthquake`, `SyncRun`), `ports.py` (contrato `EarthquakeSource` y tipos `Feed`, `EarthquakeRecord`, `FeedBatch`, `FeedNotModified`, `RejectedRecord`), `services/{sync,upsert}.py`, `selectors.py` (`last_successful_sync`, `current_data_version`), `admin.py` de solo lectura, comando `sync_earthquakes` y `tests/` (con `factories.py`, que también contiene los constructores de registros y el doble `FakeSource`). `domain.py` y `api/` llegan en la Fase 2.
- `integrations/usgs/`: `client.py`, `dto.py` (pydantic), `normalize.py`, `source.py` y `tests/fixtures/` con un recorte real documentado.
- `core/`: `http.py` (cliente httpx con límites) y `locks.py` (`advisory_lock`). `ExternalServiceError` añadido a `core/exceptions.py`.
- import-linter (5 contratos, verificados con violaciones de prueba): `core` no importa `config`, `apps` ni `integrations`; `integrations` solo importa `apps.earthquakes.ports` y nada de Django; capas `management > services > selectors > models > ports`; servicios, selectors y modelos no importan `integrations`. El comando es la raíz de composición (`build_sync_service()`).

### Resultado real de la Fase 2 (diferencias con el árbol)

- `apps/earthquakes/domain.py`: límites, `Window`, `Coverage`, `BBox`, `EarthquakeFilters`, `Ordering`, `resolve_window` y errores `InvalidFilters`/`EventNotFound`. `api/` con `filters.py` (parámetros → dominio), `serializers.py` (salida y documentación del contrato), `views.py` y `urls.py`. `meta` vive en `earthquakes` (no hizo falta `catalog_meta`).
- `selectors.py` añade `get_data_state` (versión de datos + cobertura cacheada), `compute_coverage`, `filter_events`, `list_events`, `map_points` y `get_event`.
- `core/api/pagination.py` es un paginador keyset propio (no `CursorPagination` de DRF, D53); `core/api/http_cache.py` (ETag, 304, `Cache-Control`, caché de aplicación); `core/api/throttling.py`; `core/cache.py` (claves canónicas y acceso a Redis que no rompe peticiones).
- `config/api_router.py` monta las rutas bajo `/api/v1/`. `backend/openapi/schema.yaml` (generado) y `frontend/src/shared/api/{schema.d.ts,client.ts,errors.ts}`.
- `make schema` regenera contrato y tipos; `make contract` (incluido en `make check`) y `.github/workflows/contract.yml` fallan si están desactualizados.
- import-linter: capas `api | management > services > selectors > models > domain | ports`; la API no puede importar `services` (escritura).
- Tests de Redis en la base 15, vaciada antes de cada test (`conftest.py`).

### Resultado real de la Fase 3 · PR 1 (interfaz sin globo)

- `frontend/src/app/`: `AppShell.tsx` (cabecera con navegación, créditos, movimiento y tema; enlace "Saltar al contenido"), `router.tsx` (`/`, `/acerca`, página no encontrada en `NotFound.tsx`), `providers.tsx` y `query-client.ts` (reintentos solo ante red y 5xx). Las pruebas de integración de páginas viven en `app/` (pueden importar features).
- `features/explore/`: `api/queries.ts` (meta, lista infinita por cursor, detalle con datos iniciales de la lista), `filters/` (esquema zod ⇄ URL, traducción a parámetros de la API, panel, campos numéricos que aplican al salir, `useImmediateValue`), `list/`, `detail/`, `status/` (frescura y cobertura), `map/MapArea.tsx` (aviso honesto y leyenda hasta el PR 2) y `ExplorePage.tsx`.
- `features/about/`: "Acerca de y créditos" con el aviso de que no es un sistema de alerta.
- `shared/`: `api/errors.ts` (`ApiRequestError`, mensajes y política de reintento), `hooks/` (`preferences.tsx` y `preferences-context.ts` para tema y movimiento reducido; `useMediaQuery`), `lib/` (`format.ts`, `depth.ts`, `storage.ts`), `ui/` (`Button`, `DepthDot`), `styles/tokens.css` (tokens aprobados, tema claro y movimiento reducido).
- Pruebas: `src/test/msw/` (manejadores y datos ficticios etiquetados), `src/test/render.tsx`, Vitest junto a cada módulo; `e2e/` y `playwright.config.ts` (build + `vite preview`, API simulada con `page.route`).
- `.github/workflows/e2e.yml` y `make e2e`.

### Resultado real de la Fase 3 · PR 2 (globo)

- `features/explore/globe/`: `cesium-base.ts` (fija `CESIUM_BASE_URL` antes de cargar Cesium), `viewer.ts` (crea el `CesiumWidget` con teselas propias, fronteras y sin ion; estilos del contenedor), `points.ts` (`EventPointLayer` con `PointPrimitiveCollection` incremental por id), `geometry.ts` (tamaño de punto y área visible → `bbox`, puro y probado), `controller.ts` (API mínima del globo para otras partes de la página), `webgl.ts` y `CesiumGlobe.tsx` (componente cargado con `React.lazy`: selección, centrado, 3D/2D, zoom, teclado y créditos).
- `features/explore/lab/PerformanceLab.tsx`: laboratorio de fps, enlazado solo en desarrollo.
- `frontend/public/imagery/blue-marble/{z}/{x}/{y}.jpg` y `frontend/public/geo/borders-110m.geojson`, generados por `infra/scripts/build_globe_assets.py`.
- `map/MapArea.tsx` decide entre globo y aviso sin WebGL según la disponibilidad que fija la página.

### Resultado real de la Fase 3 · PR 3 (movimiento)

- `features/explore/globe/`: `effects.ts` (parámetros y cálculos puros: giro, selección y fotograma de ondas), `quality.ts` (perfiles alto/bajo, elección automática y medidor de fps, puro), `motion.ts` (`GlobeMotion`: intro, giro en inactividad y vuelos con un único director enganchado a `scene.preUpdate`), `ripples.ts` (`RippleLayer`, colección aparte bajo los puntos). `points.ts` añade `HorizonCuller` compartido y el halo de selección; `geometry.ts`, el desplazamiento para no tapar el punto con la ficha.
- En vez de los hooks `useIntroFlight`/`useIdleSpin`/`useRipples` previstos, clases sin React como en el PR 2: el estado cambia en cada fotograma y no debe provocar renderizados.
- `shared/lib/storage.ts`: `readSession`/`writeSession` (intro y calidad medida, por pestaña). `shared/styles/index.css`: entrada de paneles.
