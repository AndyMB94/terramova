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

## Pendientes antes de habilitar IA

Modelo exacto, tarifa vigente y categorías facturables, conteo/cota de tokens, clave exclusiva, presupuesto diario/mensual, condiciones de datos y posibilidad de aislamiento de facturación. Valor inicial autorizado de consumo: ninguno; mantener `AI_ENABLED=false`.

## Pendientes de producto/datos

Retención de eventos con más de 30 días (propuesta: conservarlos y limitar la API a la cobertura declarada). Formato de puntos del mapa (GeoJSON estándar o columnar) tras medir.

## Pendientes antes de publicar

RAM/CPU/disco libres del VPS y consumo de Vacantia, comprobar que el puerto 8100 está libre, estrategia de backup, geometría/imágenes y licencias, cuotas API, resultados de rendimiento/carga, política de privacidad y acceso admin. Estas decisiones no bloquean la implementación local inicial.

## Formato de futuros cambios

Registrar fecha, problema, alternativas evaluadas, decisión, consecuencias y documentos afectados. Un cambio de arquitectura debe justificarse por código, medición o requisito concreto; no por acumular herramientas.
