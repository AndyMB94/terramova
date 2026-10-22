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

## Pendientes antes de habilitar IA

Modelo exacto, tarifa vigente y categorías facturables, conteo/cota de tokens, clave exclusiva, presupuesto diario/mensual, condiciones de datos y posibilidad de aislamiento de facturación. Valor inicial autorizado de consumo: ninguno; mantener `AI_ENABLED=false`.

## Pendientes de producto/datos

Formato de puntos del mapa (GeoJSON estándar o columnar) tras medir. Tipos de evento que la API muestra por defecto (D47). Cálculo de cobertura para `/meta` a partir de `SyncRun` (Fase 2). Retención resuelta en D41.

## Pendientes antes de publicar

RAM/CPU/disco libres del VPS y consumo de Vacantia, comprobar que el puerto 8100 está libre, estrategia de backup, geometría/imágenes y licencias, cuotas API, resultados de rendimiento/carga, política de privacidad y acceso admin. Estas decisiones no bloquean la implementación local inicial.

## Formato de futuros cambios

Registrar fecha, problema, alternativas evaluadas, decisión, consecuencias y documentos afectados. Un cambio de arquitectura debe justificarse por código, medición o requisito concreto; no por acumular herramientas.
