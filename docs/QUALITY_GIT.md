# Calidad y control de versiones

## Git desde cero

Git conserva historial local; GitHub aloja una copia remota. Un commit registra un conjunto coherente de cambios. Una rama permite desarrollar una función sin alterar directamente la línea estable. Subir al remoto no equivale a desplegar.

Primera inspección: `git status`. Si no hay repositorio y el propietario pidió empezar el proyecto, `git init -b main` es la inicialización prevista. Antes de añadir archivos, revisar que `.gitignore` excluye secretos, bases, backups, dependencias, caches y builds. No crear un repositorio dentro de otro por accidente.

## Flujo sencillo

1. Verificar estado limpio o identificar cambios propios/previos.
2. Crear una rama: `git switch -c feat/usgs-sync`.
3. Implementar una fase o parte coherente; revisar `git diff`.
4. Ejecutar las verificaciones relevantes.
5. Seleccionar archivos con `git add ruta1 ruta2`; revisar `git diff --cached`.
6. Hacer commit solo cuando el propietario lo indique, con mensaje comprensible.
7. Subir rama y abrir PR si hay remoto y autorización. Revisar CI/diff y fusionar al completar aceptación.

Evitar `git add .` sin revisar; no incluir archivos de otras tareas. Nunca usar force push a main. Inicialmente un solo desarrollador puede usar PRs pequeños como revisión personal. Configurar protección de main cuando la cuenta y el repositorio lo permitan.

Mensajes propuestos: `feat: sincronizar eventos recientes de USGS`, `fix: conservar magnitudes nulas`, `test: cubrir reservas concurrentes de IA`, `docs: documentar despliegue`. Una etiqueta identifica un hito revisado; no crear tags de publicación automáticamente.

VS Code permite ver archivos cambiados, diferencias y staging desde Control de código fuente. Claude puede explicar y preparar los comandos; el propietario conserva control de commits/push.

## Estrategia de pruebas

| Nivel | Casos prioritarios |
| --- | --- |
| Backend unitario | Normalización, UTC, filtros, agregados y validación de IA |
| Backend integración con PostgreSQL | Upsert, índices relevantes, transacciones, reservas y concurrencia |
| API | Contratos, límites, paginación, caché, permisos y errores |
| Frontend | Estado de filtros, URLs, selección y datos incompletos |
| E2E Playwright | Abrir, filtrar, seleccionar, compartir, móvil y fallback de lista |
| Operación | Build, configuración de producción, restauración y smoke test |

Para reservas/bloqueos usar PostgreSQL real en pruebas: SQLite no demuestra la misma semántica. Simular USGS/DeepSeek; nunca gastar IA desde CI. Fixtures pequeñas, representativas y con origen documentado. Probar comportamiento, no copiar detalles internos del código.

## Herramientas propuestas

| Área | Herramienta | Uso |
| --- | --- | --- |
| Python | uv | Entorno, dependencias y lockfile |
| Python | ruff | Lint y formato |
| Python | mypy + django-stubs | Tipos |
| Python | pytest-django + factory_boy | Pruebas y datos de prueba |
| Python | import-linter | Reglas de capas de STRUCTURE.md |
| API | drf-spectacular | Esquema OpenAPI |
| JS | pnpm | Dependencias y lockfile |
| JS | ESLint + Prettier | Lint, formato y reglas de imports por feature |
| JS | Vitest + Testing Library + MSW | Pruebas unitarias/componentes con API simulada |
| JS | openapi-typescript + openapi-fetch | Tipos y cliente generados |
| E2E | Playwright | Recorridos públicos |
| Repo | pre-commit + gitleaks/detect-secrets | Formato y secretos antes del commit |

Verificar versiones vigentes en Fase 0; sustituir alguna solo con motivo registrado en DECISIONS.md.

## Pipeline propuesto

- Frontend: instalación por lockfile, lint, typecheck, tests y build.
- Backend: instalación fijada, formato/lint, tests con PostgreSQL/Redis efímeros, verificar que no faltan migraciones y validación de esquema.
- Contrato: el OpenAPI regenerado y los tipos TS no producen diff.
- Arquitectura: import-linter y reglas de imports del frontend en verde.
- E2E sobre build de prueba con datos fixtures y sin servicios pagados.
- Workflows con filtros de rutas (`backend/**`, `frontend/**`) para no ejecutar todo en cada cambio.
- Detectar secretos y vulnerabilidades con herramientas compatibles; no conceder tokens de producción a PRs externos.
- Cachés de CI sin archivos `.env`; permisos mínimos del workflow.

Los nombres y comandos exactos se crean en Fase 0. No agregar un comando al README como si funcionara antes de comprobarlo.

## Definición de terminado

Funciona conforme a aceptación; pruebas relevantes pasan; no hay secretos; errores/carga/vacío se contemplan; teclado y móvil revisados; documentación alineada; diff acotado; sin pendientes ocultos. Registrar limitaciones reales y no marcar fase completa si un requisito sigue bloqueado.

## Riesgos y evidencia

Medir tamaño del bundle Cesium, memoria al cambiar vistas, rendimiento con 1.000/5.000 puntos y fps de los efectos de movimiento (intro, giro, ondas) en escritorio y móvil documentados. La prueba de carga del backend se ejecuta sobre entorno propio autorizado, con límites definidos, sin presionar USGS. Guardar resultado y configuración de la prueba; no prometer “miles de usuarios” por usar Redis o Docker.
