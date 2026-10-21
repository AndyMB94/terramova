# TerraMova

Explorador interactivo de actividad sísmica mundial con globo 3D, mapa 2D, datos públicos y resúmenes de IA controlados.

## Estado del paquete

Plan inicial · 21 de octubre de 2026 · revisión 2 (estructura detallada, escalabilidad de lectura, contrato generado y sistema de movimiento). Este paquete contiene documentación para implementar el proyecto; no contiene una aplicación funcional, configuración de producción ni pruebas ejecutadas. Las casillas del roadmap empiezan pendientes. TerraMova es un nombre provisional; disponibilidad de marca sin comprobar.

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

Las versiones son hitos de producto, no promesas de calendario. Los comandos definitivos de instalación y ejecución se documentarán al crear la aplicación y deben corresponder a comandos comprobados.
