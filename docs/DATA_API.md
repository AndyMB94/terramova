# Datos, sincronización y API

Contratos propuestos para implementación; todavía no hay endpoints ejecutables. UTC en almacenamiento y API; intervalos `[start, end)` para evitar solapamientos. Unidades explícitas.

## Origen

- Feeds: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson`, `all_week.geojson` y `all_month.geojson`.
- Catálogo: `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson` con filtros validados por backend.
- Usar feeds para actividad reciente con sincronización escalonada: `all_day` cada 2–5 min (eventos nuevos), `all_week` cada hora (correcciones) y `all_month` una vez al día (cierre de la ventana). Verificar condiciones y frecuencia de actualización del proveedor y ajustar. Usar `If-Modified-Since`/`ETag` si el servidor los respeta.
- El MVP cubre como máximo los últimos 30 días sincronizados. Búsquedas históricas arbitrarias requieren importación acotada posterior; no prometer cobertura de años que no se ha cargado.
- Cobertura global heterogénea: no comparar cantidades entre países como si la detección fuera uniforme.
- Retención (propuesta, pendiente de decidir): conservar eventos de más de 30 días (volumen anual del orden de cientos de miles de filas, manejable) pero limitar la API pública a la cobertura declarada en `meta`.

## Modelos principales

| Modelo | Campos y restricciones principales |
| --- | --- |
| Earthquake | UUID interno; source; external_id único con source; occurred_at; source_updated_at; magnitude nullable; magnitude_type; longitude; latitude; depth_km nullable; place; status; event_type; source_url; ingested_at |
| SyncRun | Estado, ventana consultada, inicio/fin, recibidos/creados/actualizados/rechazados, código de error sin payload sensible |
| ActivitySummary | scope y ventana; idioma; input_hash; versión de prompt; texto validado; modelo; generado_en; estado y fuente |
| AIBudgetPeriod | Periodo y moneda; límite; costo confirmado y reservado; estado de bloqueo |
| AIRequest | Clave idempotente, estado, reserva, uso, costo estimado/confirmado, modelo, versión de tarifa y timestamps |

Índices iniciales: occurred_at, source_updated_at y restricción `(source, external_id)`. Medir consultas antes de agregar más. Coordenadas en grados WGS84; profundidad en km, con negativos posibles según la fuente: no rechazarlos sin revisar semántica. Magnitudes negativas pueden ser válidas; no imponer mínimo cero a datos importados.

## Ingesta robusta

1. Adquirir bloqueo compartido por tipo de sincronización; salir de forma controlada si ya existe un job activo.
2. Consultar una URL fija de USGS con timeout, tamaño máximo y reintentos limitados con backoff.
3. Verificar GeoJSON, tipos de evento, IDs, timestamps y coordenadas. Orden GeoJSON: longitud, latitud, profundidad.
4. Normalizar; conservar nulos y distinguir tipo de magnitud. Rechazar o registrar registros inválidos sin abortar todo el lote.
5. Hacer upsert por origen e ID; actualizar solo con información de versión posterior o conforme a política explícita.
6. Reconsultar ventanas superpuestas para recoger correcciones; no borrar un evento por faltar en un feed posterior. Definir proceso de revisión para fusiones/retracciones de eventos al ampliar alcance.
7. Registrar resultado e invalidar caché con una versión de datos cuando cambien filas.

No mantener una transacción DB abierta durante toda una espera HTTP. Proteger el upsert contra carreras con restricción única. El fallo de USGS conserva los datos anteriores y no cambia falsamente el timestamp de éxito.

## Rutas propuestas

| Método y ruta | Uso |
| --- | --- |
| `GET /api/v1/earthquakes/` | Lista paginada de eventos |
| `GET /api/v1/earthquakes/{id}/` | Detalle |
| `GET /api/v1/earthquakes/geojson/` | Puntos acotados para mapa |
| `GET /api/v1/analytics/summary/` | Conteo, rango y distribuciones |
| `GET /api/v1/analytics/timeline/` | Eventos agregados por hora/día |
| `GET /api/v1/activity-summaries/latest/` | Leer el resumen ya guardado o estado no disponible |
| `GET /api/v1/meta/` | Fuente, cobertura disponible, fecha de éxito y versión de datos |
| `GET /health/live/` | Salud del proceso, sin secretos |
| `GET /health/ready/` | Dependencias esenciales, detalle operativo restringido |

No existe `POST /chat` ni `POST /generate-summary` público en v1.

Desde la Fase 2, la fuente de verdad del contrato es `backend/openapi/schema.yaml`, generado con drf-spectacular y verificado en CI. Este documento describe intención y reglas; si discrepan, se corrige uno de los dos en el mismo cambio.

## Parámetros y límites iniciales

`start`, `end` ISO 8601 con offset; `min_magnitude`, `max_magnitude`; `min_depth_km`, `max_depth_km`; `bbox=west,south,east,north`; `ordering=-occurred_at` o `-magnitude`; `cursor`, `page_size`.

- Ventana máxima 31 días y dentro de cobertura disponible en MVP.
- Lista: 50 por página por defecto, 100 máximo. **Paginación por cursor** sobre `(occurred_at, id)` o `(magnitude, id)`: con eventos nuevos cada pocos minutos, la paginación por número de página produce duplicados y saltos. Orden estable con desempate por ID.
- Mapa: máximo inicial 5.000 puntos, sujeto a medición. Responder `truncated`, `total_matching` y criterio de selección si excede el límite. Evaluar, además del GeoJSON estándar, un formato columnar compacto (`ids`, `lon`, `lat`, `mag`, `depth_km`, `time` como arrays) y medir tamaño comprimido antes de elegir.
- Estadísticas se calculan sobre el conjunto filtrado completo, no sobre una página ni sobre los puntos truncados.
- Validar rangos, valores finitos, longitudes y bbox; tratar cruce del antimeridiano explícitamente (west > east como dos intervalos) y probarlo.
- Límites por IP y globales configurables; pruebas de carga ajustarán valores antes de publicar.

`meta` debe incluir ventana efectiva, versión de datos y `last_successful_sync_at`. Un filtro fuera de cobertura devuelve error claro o intersección explícita; nunca aparentar cobertura completa.

## Errores y caché

Errores con código estable y mensaje útil: `400 invalid_filters`, `404 event_not_found`, `429 rate_limited`, `503 temporarily_unavailable`. Sin stack traces. `Retry-After` cuando corresponda. Resumen ausente devuelve estado documentado sin intentar generarlo.

Caché HTTP primero: GET públicos con `Cache-Control: public, max-age=<ciclo de sync>, stale-while-revalidate` y `ETag` derivado de versión de datos + filtros canónicos, respondiendo 304 cuando coincida; Nginx aplica microcaché (ver ARCHITECTURE.md). Detrás, caché Redis por filtros canónicos, versión de datos y versión de esquema, con TTL acotado. No incluir timestamps variables en claves. Limitar cardinalidad evitando consultas arbitrarias infinitas; limitar paginación y rangos. Si Redis falla, consultas públicas tienen límites conservadores o retornan degradación; llamadas IA siempre bloqueadas si falta coordinación necesaria.
