# Registro de decisiones

Fecha inicial: 2026-10-21. Mantener actualizado cuando se implemente o cambie el alcance. “Propuesto” no significa probado ni autorizado para gastar.

| ID | Decisión | Estado y razón |
| --- | --- | --- |
| D01 | Nombre TerraMova | Provisional elegido en conversación; disponibilidad sin comprobar |
| D02 | Datos sísmicos públicos globales, origen USGS | Base del producto; cobertura no uniforme |
| D03 | Globo 3D y mapa 2D | Dirección visual propuesta; Cesium sujeto a spike de rendimiento |
| D04 | React/Vite/TypeScript + Django/DRF | Stack propuesto para demostrar frontend y backend |
| D05 | Monolito modular, capas y SOLID pragmático | Evitar complejidad operativa sin perder separación de responsabilidades |
| D06 | PostgreSQL y Redis | Persistencia, consultas, caché y coordinación compartida |
| D07 | Uso público sin login | Mapa, analítica y lectura de resúmenes; admin privado |
| D08 | Sin chat público en la primera entrega | Riesgo de abuso y gasto señalado por el propietario |
| D09 | DeepSeek opcional, resúmenes programados | Proveedor disponible para el propietario; clave nueva y presupuesto aún pendientes |
| D10 | IA sin acceso SQL ni entrenamiento del proyecto | Contexto público acotado, backend calcula y valida |
| D11 | VPS Contabo compartido con Vacantia y el portafolio | Confirmado 2026-10-21. Nginx en el host, un bloque y certificado por subdominio; recursos libres pendientes de inventariar |
| D12 | Git local y GitHub para repositorio | Historial por fases; commits/push solo por indicación del propietario |
| D13 | Últimos 30 días en MVP | Limitar ingesta y consultas; histórico ampliado posterior |
| D14 | Mapa por bbox; país exacto posterior | Evitar inferir fronteras desde nombres de lugares |
| D15 | Sin Celery ni PostGIS inicialmente | Añadirlos únicamente por necesidades demostradas |
| D16 | Paginación por cursor en listas públicas | Propuesto (rev. 2). Inserciones frecuentes desplazan páginas numeradas |
| D17 | OpenAPI generado (drf-spectacular) y tipos TS generados | Propuesto (rev. 2). Evita divergencia entre backend y frontend; verificado en CI |
| D18 | Caché HTTP como primera capa (Cache-Control/ETag, microcaché Nginx, CDN opcional) | Propuesto (rev. 2). Lectura pública dominante; escala más que añadir workers |
| D19 | Sincronización escalonada day/week/month | Propuesto (rev. 2). Reduce descarga sin perder correcciones |
| D20 | Scheduler en contenedor con supercronic | Propuesto (rev. 2). Viaja con el proyecto; no modifica el host compartido del VPS |
| D21 | Reglas de capas verificadas en CI (import-linter, ESLint) | Propuesto (rev. 2). La arquitectura no depende de la disciplina manual |
| D22 | Sistema de movimiento: intro, giro en inactividad con pausa, ondas en eventos recientes | Propuesto (rev. 2). Reemplaza "giro solo por acción del usuario"; cumple WCAG 2.2.2 con pausa y movimiento reducido |
| D23 | Herramientas: uv, ruff, mypy, pytest-django, pnpm, Vitest, MSW, Playwright, Motion | Propuesto (rev. 2). Verificar versiones y compatibilidad en Fase 0 |
| D24 | Estructura detallada en docs/STRUCTURE.md | Propuesto (rev. 2). Complementa ARCHITECTURE.md |
| D25 | Subdominio `terramova.andymallcco.dev`, DNS en Porkbun | Confirmado 2026-10-21. Sigue el patrón de subdominio por proyecto |
| D26 | DB/Redis sin puertos publicados; backend solo en `127.0.0.1:8100`; Nginx único punto público | Obligatorio. Incidente real de Redis expuesto en Vacantia; Docker se salta UFW |
| D27 | Proyecto aislado en `/root/terramova`, frontend estático en `/var/www/terramova` | Confirmado/propuesto 2026-10-21. Sin recursos compartidos con otros proyectos |
| D28 | Django **5.2 LTS** (no 6.1) | Fase 0, 2026-10-21. Soporte de seguridad hasta abril de 2028; drf-spectacular, django-redis y pytest-django aún no declaran soporte de 6.1. Revisar al salir Django 6.2 LTS |
| D29 | Python 3.13 gestionado por uv; imagen `python:3.13.16-slim-trixie` | Fase 0. Soportado por todo el stack; el Python 3.12 del sistema no se usa |
| D30 | Node 22 LTS (`frontend/.nvmrc`) y pnpm 11.17.0 (`packageManager`) | Fase 0. Es lo instalado y lo exige jsdom (≥22.22.2). Node 22 deja de tener soporte en abril de 2027: migrar a Node 24 antes de la Fase 6 |
| D31 | TypeScript **6.0.3** (no 7.0) | Fase 0. typescript-eslint 8.72 exige `typescript <6.1.0`. Reevaluar cuando lo soporte |
| D32 | Vite 8.3.4 en lugar de 8.3.5 | Fase 0. 8.3.5 se publicó el mismo día y pnpm 11 aplica una antigüedad mínima de publicación; se prefirió no añadir excepciones |
| D33 | Reglas de imports del frontend con `no-restricted-imports` (regex), no eslint-plugin-boundaries | Fase 0. La v7 del plugin cambió su API y requiere un resolver TS adicional. Convención resultante: fuera de la carpeta actual se importa con `@/`, nunca con `../`; otras features solo vía `@/features/<nombre>`. Verificado con archivos de prueba que violan cada regla |
| D34 | shadcn inicializado (preset Nova, base Radix) solo con `components.json`, variables CSS y fuente Geist autoalojada | Fase 0. Se retiraron el botón de ejemplo, radix-ui, lucide-react y el paquete `cn` 0.x (publicado días antes); `cn()` usa clsx + tailwind-merge. Los componentes se añaden en Fase 3 |
| D35 | Caché con el backend Redis nativo de Django (`RedisCache`), sin django-redis | Fase 0. Cubre caché y coordinación inicial sin otra dependencia |
| D36 | PostgreSQL 18.6 y Redis 8.6.7 (alpine), versiones exactas | Fase 0. Sin `latest`. El volumen de Postgres 18 se monta en `/var/lib/postgresql` |
| D37 | detect-secrets (pre-commit + CI) en lugar de gitleaks | Fase 0. Python puro, sin binario adicional. Plan permitía cualquiera de los dos |
| D38 | Puertos de desarrollo: backend `127.0.0.1:8100` (igual que producción), PostgreSQL `127.0.0.1:5433`, Redis `127.0.0.1:6380` | Fase 0. Siempre loopback; puertos no estándar para no chocar con instancias locales |
| D39 | Workflow adicional `repo.yml` (pre-commit sobre todo el repo) | Fase 0. Un secreto puede aparecer fuera de `backend/` o `frontend/`; los workflows con filtro de rutas no lo verían |
| D40 | Sin dependencias de fases futuras en Fase 0 | drf-spectacular, openapi-typescript, factory_boy, MSW, Playwright, Cesium, Motion, Recharts, Gunicorn y supercronic se añaden en su fase. Versiones vigentes consultadas el 2026-10-21 (p. ej. Cesium 1.146.0) |
| D41 | **Retención:** se conservan los eventos de más de 30 días | Confirmado por el propietario 2026-10-22. No hay purga; la API (Fase 2) limitará las consultas a la cobertura declarada. ~120 mil filas/año |
| D42 | **Fusiones de USGS:** si dos filas resultan ser el mismo evento, se conserva una y se borra la otra | Confirmado por el propietario 2026-10-22. El 8 % de los eventos del feed mensual tiene varios IDs (`ids`) y el preferido puede cambiar. Se guarda `source_ids` (índice GIN) y el upsert localiza el evento por cualquiera de ellos; `SyncRun.merged` cuenta las fusiones |
| D43 | Validación de datos externos con pydantic 2 (modo estricto) y cliente HTTP httpx | Fase 1. pydantic rechaza tipos incorrectos sin código manual por campo; httpx permite streaming con límite de tamaño y transporte simulado en tests sin dependencias extra |
| D44 | Un único `pg_advisory_lock` para los tres feeds | Fase 1. day/week/month escriben las mismas filas; con un solo bloqueo nunca se solapan. Una ejecución que encuentra el bloqueo ocupado sale con código 3 sin crear `SyncRun` |
| D45 | Peticiones condicionales con `If-Modified-Since` | Fase 1. Verificado 2026-10-22: USGS no envía `ETag`, pero `Last-Modified` cambia cada minuto y responde 304. Solo una sincronización aplicada guarda `Last-Modified`; si falla, la siguiente descarga completa |
| D46 | Política de rechazo | Fase 1. Un evento inválido se rechaza sin abortar el lote (estado `partial`, motivos agrupados en `rejected_reasons`). Si se rechaza todo el lote, la ejecución es `failed`. Se aceptan eventos de [ahora − 31 días, ahora + 1 h]. URLs ajenas a `https://earthquake.usgs.gov/` se descartan sin rechazar el evento. Un JSON con `NaN`/`Infinity` invalida el feed entero |
| D47 | Se guardan todos los tipos de evento de USGS | Fase 1. El 2,4 % no son sismos (voladuras, explosiones, `ice quake`…). Se conservan con `event_type`; **pendiente para la Fase 2:** decidir si la API muestra por defecto solo `earthquake` |
| D48 | `integrations/` no importa nada de Django | Fase 1. import-linter no admite prohibir solo `django.db`; la regla más estricta se cumple y sigue garantizando que los adapters no tocan el ORM |
| D49 | **La API muestra por defecto solo `event_type=earthquake`** | Confirmado por el propietario 2026-10-22 (resuelve D47). `event_type=all` incluye todos; también se puede pedir un tipo concreto |
| D50 | **Mapa truncado por mayor magnitud** | Confirmado por el propietario 2026-10-22. Máximo 5 000 puntos; si hay más se conservan los de mayor magnitud y la respuesta indica `truncated`, `total_matching` y `selection: magnitude_desc` |
| D51 | **Ventana por defecto: últimos 7 días de la cobertura** | Confirmado por el propietario 2026-10-22. Se cuenta desde el final de la cobertura (última sincronización confirmada), no desde "ahora", para que la respuesta sea estable entre sincronizaciones y cacheable. Máximo 31 días; se recorta a la cobertura y se informa la ventana efectiva |
| D52 | GeoJSON estándar para el mapa (no columnar) | Fase 2, medido 2026-10-22: 5 000 puntos sin `place`, 137 KB gzip en GeoJSON frente a 100 KB en columnar. La diferencia no justifica perder interoperabilidad. Con `place` (para tooltip): 7 días ≈ 1 900 puntos, 104 KB gzip; 5 000 puntos, 279 KB gzip |
| D53 | Paginación keyset propia en lugar de `CursorPagination` de DRF | Fase 2. DRF posiciona con el primer campo más un desplazamiento: con cientos de empates de magnitud, una inserción entre páginas duplica o salta resultados. El cursor guarda (valor, pk), con nulos al final; solo hay `next_cursor` |
| D54 | Cobertura = tramo continuo de ventanas de `SyncRun` correctos | Fase 2. Un 304 cubre [inicio − periodo del feed, inicio]. Un hueco (scheduler detenido) corta la cobertura en vez de ocultarse. Se cachea por última sincronización |
| D55 | Coordenadas y valores redondeados en la API | Fase 2. USGS publica parte de las coordenadas con ruido de float32 (97 de 187 eventos del feed diario). Se guardan tal cual y la API redondea: coordenadas a 6 decimales, profundidad a 3, magnitud a 2 |
| D56 | Códigos de error `invalid_filters` (400) y `rate_limited` (429) | Fase 2. Se alinean con DATA_API.md; antes el manejador usaba `invalid_request` y `throttled` |
| D57 | Límites de tasa por IP (120/min) y global (3000/min), configurables; límite local más bajo si Redis falla | Fase 2. Valores iniciales sin medición de carga: se ajustan en la Fase 6. `API_NUM_PROXIES=1` detrás de Nginx para leer la IP real. Las rutas de salud no se limitan |
| D58 | `SCHEMA_VERSION` en las claves de caché y ETag | Fase 2. Cualquier cambio de formato de respuesta debe incrementarlo; si no, Redis podría servir el formato anterior hasta 5 min |
| D59 | `statement_timeout` de PostgreSQL (15 s por defecto) | Fase 2. Acota cualquier consulta, incluida una pública costosa. Configurable con `DB_STATEMENT_TIMEOUT_MS` |
| D61 | Los tipos generados no se formatean | Fase 2, hallado en la primera ejecución de `contract.yml` (PR #5): el hook de Prettier de pre-commit corre desde la raíz y no aplica `frontend/.prettierignore`, así que reformateó `schema.d.ts` y la CI vio diferencias. Se excluye en `.pre-commit-config.yaml`; el archivo queda tal como lo produce openapi-typescript |
| D62 | **Fase 3 en tres PRs**: interfaz sin globo, globo Cesium y sistema de movimiento | Confirmado por el propietario 2026-10-22. Cada PR se revisa y prueba por separado |
| D63 | **Maqueta aprobada antes de construir** | Confirmado por el propietario 2026-10-22: maqueta navegable (escritorio, tableta, móvil y tokens) con datos reales de muestra. Sus tokens pasan a `tokens.css` |
| D64 | Escala de profundidad ajustada a WCAG 1.4.11 | Medido en la maqueta: los tonos de 150–300 km y ≥ 300 km daban 3,4:1 y 2,9:1 sobre el fondo. Sustituidos por `#D0508A` y `#9B55D0` (4,9:1 y 4,3:1 sobre el fondo; ≥ 3,4:1 sobre el océano del globo), con luminosidad decreciente |
| D65 | Capa nocturna (Black Marble) solo si el rendimiento lo permite | Confirmado por el propietario 2026-10-22. Se decide con la medición de fps del PR 2 |
| D66 | Medición de fps en el PC del propietario; móvil real antes de publicar | Confirmado por el propietario 2026-10-22. WSL no accede a la GPU; el servidor de desarrollo solo escucha en 127.0.0.1 |
| D67 | Filtros en la URL con nombres cortos (`period`, `min_magnitude`, `types`, `order`, `event`…) validados con zod | Fase 3. Un valor inválido o manipulado vuelve a su valor por defecto. Solo se escriben los valores distintos del defecto. Orden por defecto: mayor magnitud, como en la maqueta |
| D68 | Periodos 24 h / 7 días / 30 días contados desde el final de la cobertura | Fase 3. Igual que la ventana por defecto de la API (D51): consultas estables entre sincronizaciones y cacheables. El filtro de área llega con el globo (PR 2) |
| D69 | Formato en español con `Intl` y traducción parcial de lugares | Fase 3. Coma decimal, miles agrupados (1.896), hora local con su desfase y UTC. De los lugares de USGS solo se traduce el patrón "N km DIR of" (W→O); los topónimos se conservan tal como los publica la fuente |
| D70 | Controles de filtro con valor inmediato (`useImmediateValue`) | Fase 3, hallado en E2E: React Router completa la navegación de forma asíncrona y una casilla ligada solo a la URL se repintaba un instante con el valor anterior (1 de cada 6 ejecuciones). `flushSync` no lo resolvía. Repetida la suite 72 veces sin fallos tras el cambio |
| D71 | Cliente openapi-fetch con `fetch` resuelto en cada llamada | Fase 3, hallado en tests: openapi-fetch guarda `globalThis.fetch` al crearse y no veía la interceptación de MSW. MSW 3 renombró `onUnhandledRequest` a `onUnhandledFrame`; con el nombre antiguo las peticiones no simuladas solo avisaban |
| D72 | E2E con Playwright contra el build de producción y la API simulada con `page.route` | Fase 3. Sin backend ni red externa; tres proyectos (1440, 768 y 360 px). Workflow `e2e.yml`. En local requiere `pnpm exec playwright install chromium` y, en WSL, `sudo pnpm exec playwright install-deps chromium`. Vitest se limita a `src/**/*.test.*` (recogía las specs de Playwright) y Prettier/ESLint ignoran `test-results/` y `playwright-report/` |
| D73 | Geist Mono se carga al arrancar | Fase 3. Las cifras aparecen al llegar los datos; sin carga anticipada la fuente se pedía tarde (`document.fonts.load` en `main.tsx`) |
| D74 | "Analítica" visible como "(pronto)", sin enlace | Fase 3. Evita un enlace roto hasta la Fase 4 |
| D75 | **Teselas Blue Marble hasta nivel 4 (8.192 px), versionadas en el repo** | Confirmado por el propietario 2026-10-22 (detalle medio). 682 teselas JPEG en el esquema geográfico de Cesium, 7 MB (estimado 15). Generadas por `infra/scripts/build_globe_assets.py` desde la imagen oficial de 21.600 px, con SHA-256 verificado |
| D76 | Fronteras Natural Earth v5.1.2 1:110m, reducidas | Fase 3 · PR 2. Sin propiedades y con coordenadas a 3 decimales: de 340 KB a 50 KB. Se dibujan con `PolylineCollection`. Se indica en "Acerca de" que no expresan posición sobre territorios en disputa |
| D77 | `CesiumWidget` en lugar de `Viewer`, sin Cesium ion | Fase 3 · PR 2. No se usan los widgets del Viewer. Verificado con E2E y con datos reales: 0 peticiones fuera del servidor propio. El logotipo "Cesium ion" que Cesium añade por defecto se oculta (sería engañoso); CesiumJS se cita por escrito |
| D78 | Cesium en un fragmento aparte (1,04 MB gzip) cargado con `React.lazy` | Fase 3 · PR 2. El bundle principal pasa de 154 a 158 KB gzip. Recursos estáticos en `/cesium/` con vite-plugin-static-copy 4 (`stripBase: 4`, porque la v4 conserva la ruta de origen); `CESIUM_BASE_URL` se fija antes de importar Cesium |
| D79 | Puntos con tamaño lineal acotado (4–18 px) y color por profundidad desde los mismos tokens | Fase 3 · PR 2. No proporcional a la energía. Los hex de profundidad se duplican en `depth.ts` para WebGL y un test comprueba que coinciden con `tokens.css` |
| D80 | Selección: desde la lista centra la cámara (instantáneo); desde el globo no la mueve | Fase 3 · PR 2. El vuelo animado llega con el sistema de movimiento (PR 3). Al cambiar 3D/2D se conserva el centro de la vista (Cesium reiniciaba la cámara sobre África) |
| D81 | Filtro de área = foto del área visible al pulsar, guardada como `bbox` en la URL | Fase 3 · PR 2. No sigue a la cámara para no lanzar consultas al mover el globo. Si la vista abarca casi todo el planeta no se filtra |
| D82 | E2E sin WebGL por defecto; las pruebas del globo usan WebGL por software (SwiftShader) | Fase 3 · PR 2. Con 6 workers dibujando el globo por software la CPU se saturaba y fallaban pruebas ajenas al globo. Las pruebas del globo van en serie y solo en escritorio (tableta y móvil no las repiten). Estable tras el cambio: 90 superadas y 18 omitidas por diseño en tres repeticiones |
| D83 | Laboratorio de rendimiento solo en desarrollo (`/laboratorio/rendimiento`) | Fase 3 · PR 2. Puntos sintéticos etiquetados, giro continuo (peor caso) y contador de fps. En SwiftShader (sin GPU) da ~3,7 fps con 1.000 puntos, que no es representativo: la medición válida es en el PC del propietario (D66, resultados en D84). Incluye interruptores de MSAA, atmósfera y resolución para componer el modo de calidad baja |
| D84 | **Medición de rendimiento del globo en el equipo de referencia** | 2026-10-22, PC del propietario: Intel UHD Graphics (Direct3D 11), Chrome 155, 1920×911 @ 1x, giro continuo (peor caso). Con todo activado: 1.000 puntos 20,4 fps; 5.000, 19,6; 10.000, 18,9 (los puntos apenas influyen). Con 5.000 puntos: sin MSAA 29,7; sin atmósfera 34,5; resolución 75 % 27,3; **sin MSAA, sin atmósfera y al 75 %: 60,1 fps** (tope de refresco de la pantalla) |
| D85 | **Calidad baja = sin MSAA + sin atmósfera + resolución al 75 %**; selección automática durante las animaciones | Derivado de D84 para el PR 3: con el globo quieto no hay coste (render bajo demanda), así que se mantiene la calidad alta; si los fps medidos durante giro, vuelos u ondas bajan del objetivo, se pasa a calidad baja. Selector manual además. Sin atmósfera el globo se ve más apagado: compensar con brillo de las imágenes |
| D86 | **Sin capa nocturna (Black Marble) en v0.1.0** | Aplica D65 con los datos de D84: con todo activado el equipo de referencia ya va a ~20 fps durante animaciones; la noche añadiría coste. Se reevalúa más adelante como opción de calidad alta |
| D60 | openapi-typescript 7.13 con TypeScript 6.0 | Fase 2. Declara compatibilidad con TS 5 (aviso de dependencia peer); verificado que genera tipos correctos, incluidos los nulos. Reevaluar al publicarse una versión que declare TS 6 |

## Pendientes antes de habilitar IA

Modelo exacto, tarifa vigente y categorías facturables, conteo/cota de tokens, clave exclusiva, presupuesto diario/mensual, condiciones de datos y posibilidad de aislamiento de facturación. Valor inicial autorizado de consumo: ninguno; mantener `AI_ENABLED=false`.

## Pendientes de producto/datos

Resueltos: retención (D41), tipos por defecto (D49), formato de puntos (D52) y cobertura (D54). Pendiente: ajustar límites de tasa y TTL de caché con una prueba de carga (Fase 6).

## Pendientes antes de publicar

RAM/CPU/disco libres del VPS y consumo de Vacantia, comprobar que el puerto 8100 está libre, estrategia de backup, geometría/imágenes y licencias, cuotas API, resultados de rendimiento/carga, política de privacidad y acceso admin. Estas decisiones no bloquean la implementación local inicial.

## Formato de futuros cambios

Registrar fecha, problema, alternativas evaluadas, decisión, consecuencias y documentos afectados. Un cambio de arquitectura debe justificarse por código, medición o requisito concreto; no por acumular herramientas.
