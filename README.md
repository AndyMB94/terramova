# TerraMova

Explorador interactivo de actividad sísmica mundial con globo 3D, mapa 2D, datos públicos y resúmenes de IA controlados.

## Estado del paquete

Fase 0 (base reproducible) implementada el 21 de octubre de 2026: entorno local con frontend, backend, PostgreSQL y Redis, calidad automatizada y CI. Fases 1 y 2 implementadas (sincronización real con USGS y API pública) y buena parte de la Fase 3: interfaz de exploración con globo 3D/mapa 2D (Cesium), lista, ficha, filtros y estado de los datos. Todavía **no** hay sistema de movimiento ni configuración de producción; ver [docs/ROADMAP.md](docs/ROADMAP.md). TerraMova es un nombre provisional; disponibilidad de marca sin comprobar.

## Desarrollo local

Comandos comprobados en WSL2 (Ubuntu 24.04) el 2026-10-21, incluido un checkout limpio.

### Requisitos

| Herramienta | Versión usada | Notas |
| --- | --- | --- |
| Docker Engine + Compose | 28.3.3 / 2.39.1 | Docker Desktop con integración WSL también sirve |
| uv | 0.13.4 | Instala Python 3.13 automáticamente. [Instalación](https://docs.astral.sh/uv/getting-started/installation/) |
| Node.js | 22 LTS (≥ 22.22.2) | Ver `frontend/.nvmrc` |
| pnpm | 11.17.0 | Fijado en `frontend/package.json` (`packageManager`) |
| make, python3 | — | `python3` del sistema solo ejecuta `infra/scripts/create_dev_env.py` |

### Primer arranque

```bash
make env       # crea .env desde .env.example con secretos aleatorios (no sobrescribe)
make setup     # uv sync, pnpm install --frozen-lockfile y hook de pre-commit
make up        # PostgreSQL, Redis y backend en Docker; espera a que estén sanos
make migrate   # migraciones explícitas en el contenedor backend
make web       # frontend en http://127.0.0.1:5173 (proxy de /api y /health al backend)
make sync FEED=month   # importa los últimos 30 días desde USGS (luego FEED=day o week)
```

- Backend: http://127.0.0.1:8100/health/live/ y http://127.0.0.1:8100/health/ready/ (comprueba PostgreSQL y Redis; 503 sin detalles si fallan).
- Todos los puertos se publican solo en `127.0.0.1`: backend 8100, PostgreSQL 5433, Redis 6380 (con contraseña).
- `make sync FEED=day|week|month` descarga el feed de USGS y lo guarda sin duplicar; si el feed no cambió, USGS responde 304 y no se descarga nada. Códigos de salida: 0 correcta, 1 fallida, 3 otra sincronización en curso. Cada ejecución queda registrada en `SyncRun` (visible en el admin).
- `make help` lista todos los objetivos.

### API pública (solo lectura)

Con datos sincronizados, por ejemplo:

```bash
curl http://127.0.0.1:8100/api/v1/meta/                                    # cobertura, frescura y límites
curl "http://127.0.0.1:8100/api/v1/earthquakes/?min_magnitude=4&page_size=20"
curl "http://127.0.0.1:8100/api/v1/earthquakes/geojson/?bbox=-82,-56,-34,13"  # Sudamérica
```

Sin fechas se devuelven los últimos 7 días (máximo 31) y solo sismos (`event_type=all` para todos los tipos). El contrato completo está en `backend/openapi/schema.yaml`; tras cambiar la API, `make schema` lo regenera junto con los tipos del frontend. `make down` detiene los servicios y conserva los datos.

### Verificación

```bash
make check      # lint + formato + tipos + capas + contrato + tests + build (lo mismo que la CI)
make precommit  # hooks de pre-commit, incluida la detección de secretos
make e2e        # recorridos E2E con Playwright en 1440, 768 y 360 px (API simulada)
```

El globo usa recursos propios en `frontend/public/` (teselas NASA Blue Marble y fronteras Natural Earth), ya versionados. Para regenerarlos desde las fuentes oficiales (hash verificado): `uv run --no-project --with pillow==12.0.0 python infra/scripts/build_globe_assets.py --cache ~/.cache/terramova`.

En desarrollo, `http://127.0.0.1:5173/laboratorio/rendimiento` mide los fps del globo con 1.000, 5.000 o 10.000 puntos sintéticos.

Para `make e2e` hace falta, una sola vez, el navegador de Playwright: `pnpm --dir frontend exec playwright install chromium` y, en WSL o Linux sin librerías gráficas, `sudo pnpm --dir frontend exec playwright install-deps chromium`.

Los tests del backend usan PostgreSQL y Redis reales: requieren `make up`. La CI (`.github/workflows/`) ejecuta lo mismo con servicios efímeros y sin secretos.

### Problemas conocidos

- `fork/exec /usr/local/lib/docker/cli-plugins/docker-buildx: no such file or directory` al hacer `make up`: quedan enlaces rotos de una integración antigua de Docker Desktop que ocultan el plugin del Docker Engine nativo. Solución puntual: `COMPOSE_BAKE=false make up`. Solución permanente (decisión del propietario de la máquina): reactivar la integración WSL de Docker Desktop o eliminar los enlaces rotos (`sudo find /usr/local/lib/docker/cli-plugins -xtype l -delete`).
- `docker-credential-desktop.exe: executable file not found` al descargar imágenes: `~/.docker/config.json` apunta al helper de Docker Desktop. Añade `/mnt/c/Program Files/Docker/Docker/resources/bin` al `PATH` o quita `"credsStore"` de ese archivo si no usas Docker Desktop.

## Comenzar en VS Code con Claude Code

1. Extrae este ZIP. Copia **el contenido de la carpeta TerraMova** a la raíz de tu proyecto: `CLAUDE.md`, `README.md` y `docs/` deben quedar junto a las futuras carpetas `frontend/` y `backend/`.
2. Si tu proyecto ya tiene archivos, conserva su contenido y pide a Claude que adapte el plan antes de sobrescribirlos.
3. Abre la raíz en VS Code y utiliza el texto de [START_HERE.md](START_HERE.md).
4. Revisa los cambios con Git antes de cada commit. No introduzcas credenciales en el chat ni en los documentos.

## Decisiones iniciales

- Frontend: React + Vite + TypeScript; Tailwind CSS, shadcn/ui y TanStack Query.
- Geografía: CesiumJS para globo 3D y mapa 2D, con recursos autoalojados o proveedores cuyas condiciones se verifiquen.
- Backend: Django + Django REST Framework; PostgreSQL; Redis para caché y coordinación compartida.
- Operación: Docker Compose en el VPS Contabo compartido, detrás del Nginx del host, en `terramova.andymallcco.dev`. Solo Nginx es público; DB y Redis sin puertos publicados.
- Datos: feeds y catálogo públicos de USGS, consultados por el backend.
- Acceso: exploración pública sin login; administración privada.
- IA inicial: DeepSeek opcional, solo resúmenes programados y compartidos. Ningún endpoint público dispara llamadas pagadas.
- Arquitectura: monolito modular por capas; SOLID, POO y patrones donde resuelven necesidades concretas.
- Calidad: pruebas de integración y de reglas críticas, revisión de accesibilidad, CI y control de versiones.
- Contrato: OpenAPI generado por el backend; tipos TypeScript generados a partir de él, nunca escritos a mano.
- Escalabilidad: caché HTTP (Cache-Control/ETag, microcaché Nginx, CDN opcional) como primera capa; Redis para caché de aplicación y límites.
- Diseño: interfaz mínima alrededor de un globo protagonista, con un sistema de movimiento definido (intro, giro en inactividad con pausa, ondas en eventos recientes) y versión reducida.

El sistema describe eventos publicados: no predice terremotos, no es un sistema oficial de alerta y no garantiza registrar cada sismo del planeta. La interfaz indicará fuente, cobertura y última actualización.

## Documentación

| Archivo | Propósito |
| --- | --- |
| [START_HERE.md](START_HERE.md) | Prompt inicial para Claude Code y lectura sugerida |
| [CLAUDE.md](CLAUDE.md) | Reglas obligatorias del proyecto para el agente |
| [docs/PRD.md](docs/PRD.md) | Producto, alcance y criterios de aceptación |
| [docs/UI_UX.md](docs/UI_UX.md) | Dirección visual y comportamiento de pantallas |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Módulos, capas, POO y decisiones técnicas |
| [docs/STRUCTURE.md](docs/STRUCTURE.md) | Árbol de carpetas, reglas de dependencia y convenciones |
| [docs/DATA_API.md](docs/DATA_API.md) | Modelo de datos, sincronización y contratos HTTP |
| [docs/AI_SECURITY.md](docs/AI_SECURITY.md) | IA, presupuesto, privacidad y protección pública |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Tareas por fase, dependencias y aceptación |
| [docs/QUALITY_GIT.md](docs/QUALITY_GIT.md) | Pruebas, flujo de Git y documentación de versiones |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Desarrollo y despliegue seguro en el VPS |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Decisiones acordadas, propuestas y pendientes |
| [docs/REFERENCES.md](docs/REFERENCES.md) | Documentación oficial a consultar al implementar |

## Versiones propuestas

- `v0.1.0`: integración real, globo/mapa, filtros y fichas.
- `v0.2.0`: analítica, reproducción y URLs compartibles.
- `v0.3.0`: resúmenes de IA limitados, tras demostrar controles de gasto.
- `v1.0.0`: despliegue verificado, accesibilidad y documentación de portafolio.

Las versiones son hitos de producto, no promesas de calendario. Los comandos de "Desarrollo local" se actualizan solo cuando se han comprobado.
