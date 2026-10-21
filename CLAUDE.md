# Instrucciones de trabajo — TerraMova

## Objetivo y autoridad

Construir una aplicación pública moderna para explorar actividad sísmica. Sigue las instrucciones del propietario y estos documentos. Si una decisión cambia, actualiza docs/DECISIONS.md y los documentos afectados. No afirmes que existe una función por estar escrita en el plan.

Lee README.md, docs/DECISIONS.md y docs/ROADMAP.md al empezar, y docs/STRUCTURE.md antes de crear archivos o carpetas. Consulta arquitectura, contratos y seguridad antes de modificar módulos relacionados. No implementes fases futuras de forma implícita.

## Trabajo incremental

1. Inspecciona estructura, versiones instaladas y `git status`.
2. Revisa cambios existentes; no los reviertas ni los sobrescribas.
3. Identifica criterios de aceptación y riesgos de la fase.
4. Implementa una porción coherente, con la solución más sencilla que respete el diseño.
5. Ejecuta las verificaciones correspondientes y revisa el diff.
6. Actualiza documentación y marca tareas solo si se verificaron.
7. Informa resultados reales, comandos ejecutados, fallos y pendientes.

No hagas commits, push, despliegues, cambios de DNS o infraestructura hasta recibir instrucciones explícitas. Puedes preparar archivos y comandos para revisión. No uses `git reset --hard`, force push ni borrados masivos como solución rutinaria.

## Stack y versiones

React + Vite + TypeScript; Tailwind/shadcn; TanStack Query; CesiumJS; Recharts. Django/DRF, PostgreSQL y Redis. Docker Compose y Nginx. Verifica compatibilidad y soporte de versiones en documentación oficial al inicializar. Fija dependencias y conserva lockfiles; evita imágenes `latest`.

Herramientas propuestas (verificar versiones en Fase 0): backend con uv, ruff, mypy + django-stubs, pytest-django, factory_boy, drf-spectacular e import-linter; frontend con pnpm, ESLint, Prettier, Vitest, MSW, Playwright, openapi-typescript y Motion; pre-commit con detección de secretos. Un `Makefile` en la raíz es el punto de entrada de comandos.

No añadas microservicios, Kubernetes, un bus de eventos, Celery, PostGIS ni una base vectorial sin una necesidad demostrada y documentada. Para la sincronización, usa un comando Django ejecutado por un contenedor `scheduler` (supercronic) con la misma imagen del backend; bloquea ejecuciones solapadas con `pg_advisory_lock`. Sincronización escalonada: feed del día frecuente, semana cada hora, mes diario.

## Código y arquitectura

- Monolito modular: eventos, analítica, resúmenes e integraciones.
- Views/serializers delgados; casos de uso en servicios, consultas en selectors, llamadas externas en adapters.
- POO en servicios/adapters con dependencias explícitas y contratos pequeños. Composición sobre herencia profunda.
- Usa Django ORM; no construyas un repositorio genérico que replique el ORM.
- Respeta las reglas de dependencia de docs/STRUCTURE.md; se verifican con import-linter y reglas de imports de ESLint en CI.
- Tipos de la API en frontend generados desde `backend/openapi/schema.yaml`; no escribirlos a mano.
- Listas públicas con paginación por cursor; GET públicos con `Cache-Control` y `ETag` basados en la versión de datos.
- Cesium: miles de puntos con `PointPrimitiveCollection`, no `Entities`; `requestRenderMode` activado.
- React con componentes funcionales/hooks; estado remoto en TanStack Query, filtros compartibles en URL y estado efímero local.
- Código e identificadores en inglés; interfaz y documentación en español. Fechas persistidas en UTC.
- Magnitud no equivale a intensidad. No etiquetes eventos como “peligrosos” basándote solo en magnitud.
- Evita `any`, capturas silenciosas, SQL generado por IA, HTML no confiable y acceso a red sin timeout.
- Los datos externos son no confiables: valida tipos, longitudes, coordenadas y valores nulos.

## Seguridad y dinero

- IA desactivada por defecto. No invoques DeepSeek en pruebas, desarrollo inicial ni validaciones automáticas.
- La clave existe solo en backend/secreto de despliegue. Nunca en `VITE_*`, Git, logs, capturas o respuestas de API.
- Ningún endpoint público ni cache miss puede lanzar una generación pagada en la versión inicial.
- DeepSeek recibe agregados públicos acotados; nunca credenciales, toda la DB o acceso SQL.
- Presupuesto global con reservas transaccionales antes de enviar solicitudes, contabilización por uso y bloqueo ante estados inciertos.
- No supongas que una clave nueva aísla saldo ni que límites del proveedor impiden gasto indebido.
- Valida desafíos anti-bot en backend si se incorporan; CORS, CSRF y login no sustituyen cuotas.
- PostgreSQL y Redis **sin `ports:`** en producción; el backend publica solo `127.0.0.1:8100`. Nunca un puerto en `0.0.0.0` (Docker se salta UFW). Redis con contraseña. Ver "Reglas de red" en docs/DEPLOYMENT.md; un cambio de Compose que las incumpla es un fallo bloqueante.
- El VPS es compartido: no tocar archivos de Nginx, contenedores, redes ni volúmenes de Vacantia o del portafolio.
- Evita registrar prompts o IPs sin necesidad y política de retención.

## Calidad

Prueba sincronización idempotente y actualizaciones USGS, consultas limitadas, fechas, nulos, agregaciones, caché y presupuesto concurrente. Usa dobles para servicios externos. Cubre con Playwright los recorridos públicos principales y estados de error. Verifica teclado, contraste, móvil y reducción de movimiento.

Al crear la base, configura lint, formato, tipos, tests y CI. No inventes resultados de pruebas ni capturas. Si una dependencia no está disponible o el entorno impide una prueba, indícalo y deja la tarea pendiente.

## Datos y diseño

No uses geometría dibujada a mano como mapa real. Usa geometría publicada con licencia y atribución documentadas. Eventos de demostración deben estar claramente etiquetados y separados del modo real. La interfaz debe indicar última actualización y estado de datos obsoletos.

Respeta docs/UI_UX.md, en especial el sistema de movimiento: intro breve una vez por sesión; giro solo en inactividad, lento, con botón de pausa visible, detenido al interactuar o con la pestaña oculta; todo efecto con versión reducida (`prefers-reduced-motion` e interruptor propio). Ofrece alternativa 2D/lista. Mide fps de los efectos y degrada en móvil; evita efectos decorativos que impidan leer.
