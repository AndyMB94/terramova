# Datos, sincronización y API

Modelos y sincronización implementados en Fase 1; API pública de eventos y `meta` implementada en Fase 2 (analítica y resúmenes siguen propuestos). UTC en almacenamiento y API; intervalos `[start, end)` para evitar solapamientos. Unidades explícitas.

## Origen

- Feeds: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson`, `all_week.geojson` y `all_month.geojson`.
- Catálogo: `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson` con filtros validados por backend.
- Usar feeds para actividad reciente con sincronización escalonada: `all_day` cada 2–5 min (eventos nuevos), `all_week` cada hora (correcciones) y `all_month` una vez al día (cierre de la ventana). Verificar condiciones y frecuencia de actualización del proveedor y ajustar. Implementado `If-Modified-Since` (D45): USGS no envía `ETag`, pero `Last-Modified` cambia cada minuto y responde 304. Tamaños medidos el 2026-10-22: `all_month` 7,2 MB (0,9 MB gzip, ~10 000 eventos), `all_week` 1,4 MB, `all_day` 133 KB.
- El MVP cubre como máximo los últimos 30 días sincronizados. Búsquedas históricas arbitrarias requieren importación acotada posterior; no prometer cobertura de años que no se ha cargado.
- Cobertura global heterogénea: no comparar cantidades entre países como si la detección fuera uniforme.
- Retención (D41): se conservan los eventos de más de 30 días; la API pública se limita a la cobertura declarada en `meta`.

## Modelos principales

| Modelo | Campos y restricciones principales |
| --- | --- |
| Earthquake (implementado) | UUID interno; source; external_id único con source; `source_ids` (todos los IDs de la fuente, índice GIN; D42); occurred_at; source_updated_at; magnitude nullable; magnitude_type; longitude y latitude con `CHECK` de rango; depth_km nullable; place (≤255); status; event_type (se guardan todos los tipos, D47); source_url (solo `https://earthquake.usgs.gov/`); ingested_at; updated_at |
| SyncRun (implementado) | source y feed; estado `running`/`succeeded`/`partial`/`failed`; inicio/fin; ventana `[generated − periodo, generated)`; `source_generated_at`; `source_last_modified`; `not_modified`; recibidos/creados/actualizados/sin cambios/fusionados/rechazados; `rejected_reasons` agrupados; `error_code` estable sin payload |
| ActivitySummary | scope y ventana; idioma; input_hash; versión de prompt; texto validado; modelo; generado_en; estado y fuente |
| AIBudgetPeriod | Periodo y moneda; límite; costo confirmado y reservado; estado de bloqueo |
| AIRequest | Clave idempotente, estado, reserva, uso, costo estimado/confirmado, modelo, versión de tarifa y timestamps |

Índices iniciales: occurred_at, source_updated_at, GIN sobre source_ids y restricción `(source, external_id)`. Medir consultas antes de agregar más. Coordenadas en grados WGS84; profundidad en km, con negativos posibles según la fuente: no rechazarlos sin revisar semántica. Magnitudes negativas pueden ser válidas; no imponer mínimo cero a datos importados.

## Ingesta robusta

1. Adquirir un único bloqueo para los tres feeds (D44); salir con código 3 si ya existe un job activo. Las ejecuciones que quedaron en `running` se marcan `failed/interrupted`.
2. Consultar una URL fija de USGS con timeout, tamaño máximo y reintentos limitados con backoff.
3. Verificar GeoJSON, tipos de evento, IDs, timestamps y coordenadas. Orden GeoJSON: longitud, latitud, profundidad.
4. Normalizar; conservar nulos y distinguir tipo de magnitud. Rechazar o registrar registros inválidos sin abortar todo el lote.
5. Hacer upsert por origen e ID; actualizar solo con información de versión posterior o conforme a política explícita.
6. Reconsultar ventanas superpuestas para recoger correcciones; no borrar un evento por faltar en un feed posterior. Fusiones: el evento se localiza por cualquiera de sus `source_ids`; si cambia el ID preferido se renombra y si dos filas son el mismo evento se borra la sobrante (D42). Retracciones: pendiente al ampliar alcance.
7. Registrar resultado en `SyncRun`. La versión de datos es el id del último `SyncRun` correcto que cambió filas (`current_data_version()`); las claves de caché de la Fase 2 la incluyen.

Comando: `python manage.py sync_earthquakes --feed day|week|month` (`make sync FEED=…`). Salida 0 correcta, parcial o sin cambios; 1 fallida; 3 otra sincronización en curso.

La descarga ocurre fuera de transacción y el upsert del lote se aplica en una sola transacción (todo o nada). Proteger el upsert contra carreras con restricción única. El fallo de USGS conserva los datos anteriores y no cambia falsamente el timestamp de éxito.

## Rutas

| Método y ruta | Uso |
| --- | --- |
| `GET /api/v1/earthquakes/` | Lista paginada de eventos (implementada) |
| `GET /api/v1/earthquakes/{id}/` | Detalle por UUID interno (implementada) |
| `GET /api/v1/earthquakes/geojson/` | Puntos acotados para mapa (implementada) |
| `GET /api/v1/analytics/summary/` | Conteo, rango y distribuciones |
| `GET /api/v1/analytics/timeline/` | Eventos agregados por hora/día |
| `GET /api/v1/activity-summaries/latest/` | Leer el resumen ya guardado o estado no disponible |
| `GET /api/v1/meta/` | Fuente, cobertura, `last_successful_sync_at`, `is_stale`, versión de datos y límites (implementada) |
| `GET /health/live/` | Salud del proceso, sin secretos |
| `GET /health/ready/` | Dependencias esenciales, detalle operativo restringido |

No existe `POST /chat` ni `POST /generate-summary` público en v1.

Desde la Fase 2, la fuente de verdad del contrato es `backend/openapi/schema.yaml`, generado con drf-spectacular y verificado en CI. Este documento describe intención y reglas; si discrepan, se corrige uno de los dos en el mismo cambio.

## Parámetros y límites iniciales

`start` (incluido), `end` (excluido) ISO 8601 con zona horaria obligatoria; `min_magnitude`, `max_magnitude` (−5…12); `min_depth_km`, `max_depth_km` (−100…1000); `bbox=west,south,east,north`; `event_type` (por defecto `earthquake`, `all` para todos; D49); `ordering=-occurred_at` o `-magnitude`; `cursor`, `page_size`.

- Ventana máxima 31 días. Sin fechas: últimos 7 días hasta el final de la cobertura (D51). La ventana se recorta a la cobertura y la respuesta la informa (`window`); sin cobertura, resultados vacíos y `window: null`.
- Lista: 50 por página por defecto, 100 máximo. **Paginación por cursor (keyset propio, D53)** sobre `(occurred_at, id)` o `(magnitude, id)` descendente, nulos al final: con eventos nuevos cada pocos minutos, la paginación por número de página o por desplazamiento produce duplicados y saltos. Respuesta `{results, next_cursor, window}`.
- Mapa: GeoJSON estándar (D52), máximo 5.000 puntos. Si se excede, se conservan los de mayor magnitud (D50) y `metadata` incluye `truncated`, `total_matching`, `returned`, `limit` y `selection`. Propiedades: magnitud, profundidad, hora y lugar. Números redondeados (D55).
- Estadísticas se calculan sobre el conjunto filtrado completo, no sobre una página ni sobre los puntos truncados.
- Validar rangos, valores finitos, longitudes y bbox; tratar cruce del antimeridiano explícitamente (west > east como dos intervalos) y probarlo.
- Límites por IP (120/min) y globales (3000/min) configurables (D57); pruebas de carga ajustarán valores antes de publicar. `statement_timeout` de 15 s (D59).

`meta` incluye cobertura (tramo continuo de sincronizaciones correctas, D54), versión de datos, `last_successful_sync_at` e `is_stale` (más de 15 min sin sincronizar). Un filtro fuera de cobertura devuelve error claro o intersección explícita; nunca aparentar cobertura completa.

## Errores y caché

Errores con código estable y mensaje útil: `400 invalid_filters` (con `errors` por campo), `404 event_not_found`, `429 rate_limited`, `503 temporarily_unavailable`. Sin stack traces. `Retry-After` cuando corresponda. Resumen ausente devuelve estado documentado sin intentar generarlo.

Implementado en Fase 2: `Cache-Control: public, max-age=60, stale-while-revalidate=60` (meta: 30 s), `ETag` calculado antes de consultar la base y caché Redis de 5 min con la misma clave (`SCHEMA_VERSION`, versión de datos, filtros efectivos, orden, página y cursor; D58). Si Redis falla, se responde sin caché y los límites de tasa pasan a un límite local más bajo por proceso.

Diseño original: GET públicos con `Cache-Control: public, max-age=<ciclo de sync>, stale-while-revalidate` y `ETag` derivado de versión de datos + filtros canónicos, respondiendo 304 cuando coincida; Nginx aplica microcaché (ver ARCHITECTURE.md). Detrás, caché Redis por filtros canónicos, versión de datos y versión de esquema, con TTL acotado. No incluir timestamps variables en claves. Limitar cardinalidad evitando consultas arbitrarias infinitas; limitar paginación y rangos. Si Redis falla, consultas públicas tienen límites conservadores o retornan degradación; llamadas IA siempre bloqueadas si falta coordinación necesaria.
