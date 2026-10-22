# Roadmap ejecutable

Marca una casilla únicamente al verificar su resultado. Cada fase termina con revisión del diff, evidencia de pruebas y actualización de decisiones. No se asignan fechas hasta conocer disponibilidad y experiencia del desarrollador.

## Fase 0 — Base reproducible

Dependencias: ninguna; conservar cualquier código preexistente.

- [x] Inspeccionar proyecto y Git; documentar diferencias frente al plan.
- [x] Verificar versiones compatibles de Python, Node, Django, React, Vite, Cesium y UI. (Cesium: solo versión vigente consultada; su integración con Vite se valida en el spike de Fase 3.)
- [x] Crear frontend React/TypeScript y backend Django/DRF siguiendo la sección "Fase 0" de docs/STRUCTURE.md.
- [x] `Makefile` como punto de entrada (`up`, `test`, `lint`, `fmt`) y `compose.yaml` + override de desarrollo.
- [x] Añadir PostgreSQL y Redis al entorno local con configuración por entorno.
- [x] Crear `.env.example` sin claves; configurar `.gitignore` y exclusiones de build.
- [x] Configurar lint, formato, tipos, pruebas y lockfiles.
- [x] Configurar import-linter (backend) y reglas de imports por feature (frontend) en CI.
- [x] pre-commit con formato y detección de secretos.
- [x] Crear comandos reproducibles de arranque y verificación; documentarlos en README.
- [x] Crear CI básica sin secretos ni acceso a APIs externas pagadas.
- [x] Exponer salud mínima del backend y pantalla inicial del frontend.

Aceptación: desde un checkout limpio, instalar y levantar ambos servicios siguiendo README; pipeline básico en verde; ningún secreto versionado. No se exige globo ni llamadas a USGS todavía.

## Fase 1 — Fuente real y persistencia

Depende de Fase 0.

- [x] Modelos Earthquake y SyncRun, migraciones y restricciones.
- [x] Adapter USGS con DTOs, validación, timeouts y reintentos limitados.
- [x] Servicio y comando de sincronización idempotente con bloqueo compartido.
- [x] Importación inicial limitada a 30 días y ventanas superpuestas.
- [x] Opción `--feed day|week|month` para sincronización escalonada.
- [x] Persistencia de última sincronización exitosa, errores y cobertura. (Cada `SyncRun` guarda su ventana; el cálculo de cobertura agregada para `/meta` se hace en la Fase 2.)
- [x] Pruebas con fixtures: duplicados, correcciones, nulos, datos inválidos y fallos parciales.

Aceptación: importar dos veces no duplica; evento corregido se actualiza; fallo externo preserva el último estado válido. Una comprobación manual contra USGS puede documentarse sin hacerla requisito de CI.

## Fase 2 — API pública acotada

Depende de Fase 1.

- [x] Lista, detalle, GeoJSON y metadatos según DATA_API.md.
- [x] Filtros compartidos, fechas UTC, paginación y orden estable.
- [x] Límite de puntos con metadata de truncamiento.
- [x] Paginación por cursor con orden estable.
- [x] Caché canónica, `Cache-Control`/`ETag` con respuestas 304 y límites de consultas/tasa.
- [x] Contrato OpenAPI generado (drf-spectacular), commiteado, con ejemplos, y verificado en CI; tipos TS generados.
- [x] Pruebas de rangos inválidos, antimeridiano, límites, 404, 429, 304 y paginación estable con inserciones nuevas.

Aceptación: consultas reproducibles y documentadas; ninguna consulta sin rango/límite; errores sin información interna. Datos de lista y mapa coherentes dentro de los límites declarados.

## Fase 3 — Explorador visual · v0.1.0

Depende de Fase 2. UI con fixtures puede adelantarse en una rama si el contrato ya está acordado.

- [x] Moodboard, wireframes y tokens (incluidos tokens de movimiento) según el proceso de UI_UX.md. (Maqueta navegable a 360/768/1440 px con tokens, aprobada por el propietario; sin moodboard de capturas de terceros.)
- [x] Tokens de diseño, shell responsive y componentes accesibles.
- [x] Spike de Cesium: 3D/2D, assets, geometría publicada, imágenes Blue/Black Marble y atribución. (Black Marble descartada para v0.1.0 tras medir: D86.)
- [x] Puntos con `PointPrimitiveCollection`, `requestRenderMode` y medición con 1.000/5.000 puntos. (Medido en el equipo de referencia: D84.)
- [x] Integración real con API usando TanStack Query.
- [x] Marcadores, lista, selección y panel de detalle sincronizados.
- [x] Filtros, fuente y última actualización visibles.
- [x] Sistema de movimiento de UI_UX.md: intro, giro en inactividad con pausa, ondas en eventos recientes, transiciones de selección y paneles; interruptor de movimiento reducido y modo de calidad baja. (Medido en el equipo de referencia: D94. Falta medir en un móvil medio.)
- [x] Fallback de lista si WebGL falla; sin bucles de render ni recursos filtrados. (El visor se crea una vez, solo dibuja bajo demanda y se destruye al desmontar.)
- [x] Estados de carga/error/vacío y datos obsoletos.
- [x] E2E del recorrido principal y revisión a 360/768/1440 px. (Recorridos en los tres tamaños; el globo y el movimiento se prueban en escritorio con WebGL por software y se revisaron capturas a 768 y 360 px, D82/D95.)

Aceptación: un visitante explora eventos reales sin cuenta, entiende los datos y puede usar lista con teclado. Sin dependencia de mapas de demo ni IA pagada. Capturas y grabación breve de la demo para revisión.

## Fase 4 — Analítica y reproducción · v0.2.0

Depende de Fase 3.

- [ ] Agregados deterministas y timeline con filtros compartidos.
- [ ] Gráficas con unidades, leyendas y alternativa tabular.
- [ ] Comparación de ventanas iguales y advertencia de cobertura.
- [ ] Reproducción play/pausa, velocidad y cursor temporal; no cambia los datos originales.
- [ ] URL compartible que restaura filtros/vista/selección.
- [ ] Favoritos locales y acción para borrarlos.
- [ ] Pruebas de consistencia entre estadísticas y conjunto completo filtrado.

Aceptación: estadísticas no dependen de la página de lista ni del límite del mapa; una URL funciona en otro navegador; reproducción respetuosa de movimiento reducido.

## Fase 5 — IA compartida y limitada · v0.3.0, opcional

Depende de Fase 4 y aprobación de presupuesto/modelo/condiciones del proveedor. Puede omitirse y publicar sin IA.

- [ ] Contrato SummaryProvider y fake; clave exclusiva configurada fuera de Git.
- [ ] Modelos de resumen, solicitudes, presupuesto y reservas.
- [ ] Contexto agregado, prompt versionado, validación y sanitización.
- [ ] Comando programado con idempotencia, bloqueo y presupuesto transaccional.
- [ ] API pública de lectura que no puede iniciar generación.
- [ ] Panel de resumen con periodo, origen, antigüedad y etiqueta IA.
- [ ] Pruebas de concurrencia, reserva ante timeout, reinicio y agotamiento.
- [ ] Interruptor operativo y alertas de gasto, sin claves en logs.
- [ ] Una prueba manual pagada únicamente cuando el propietario lo autorice.

Aceptación: pruebas de AI_SECURITY.md satisfechas; múltiples visitas no elevan el número de generaciones; gasto acotado por reglas demostradas. Sin chat libre.

## Fase 6 — VPS y publicación · v1.0.0

Depende de Fase 4 como mínimo. Fase 5 solo si se publica con IA.

- [ ] Inventariar recursos y servicios existentes sin exponer secretos.
- [ ] Dockerfiles reproducibles, build frontend y configuración Nginx.
- [ ] `compose.prod.yaml` según "Reglas de red": DB/Redis sin `ports:`, backend en `127.0.0.1:8100`, Redis con contraseña y `maxmemory`.
- [ ] DNS `terramova` en Porkbun, sitio Nginx independiente, Certbot solo para el subdominio y settings de producción.
- [ ] Verificar con `ss -tlnp` y un escaneo externo que solo 22/80/443 responden, y que Vacantia y el portafolio siguen intactos.
- [ ] Contenedor scheduler (supercronic) con sincronización escalonada, exclusión mutua y comandos operativos.
- [ ] Microcaché Nginx, compresión gzip/brotli y CDN opcional; medir tasa de aciertos.
- [ ] Logs JSON con request ID y monitoreo de errores (por ejemplo, Sentry) sin datos personales.
- [ ] Backup/restore probado y plan de rollback de código y migraciones.
- [ ] Tests, build y `manage.py check --deploy` resueltos o excepciones justificadas.
- [ ] Prueba de carga con objetivos y recursos documentados; ajustar límites.
- [ ] Revisar licencias, créditos, privacidad, dependencias y seguridad.
- [ ] Preparar despliegue revisable y obtener indicación explícita antes de modificar el VPS.
- [ ] Ejecutar despliegue autorizado y smoke test público; monitorear errores.
- [ ] README final con demo, capturas reales, arquitectura, límites y cómo contribuir.
- [ ] Publicar etiqueta v1.0.0 cuando el propietario lo indique.

Aceptación: demo HTTPS reproducible, acceso admin protegido, DB/Redis no públicos, datos actualizándose y rollback documentado. Objetivo inicial de frontend: interacción fluida en el equipo de referencia y carga medida; registrar resultados, no declarar rendimiento universal.

## Después de v1

- [ ] Decidir si hay demanda de cuentas y chat autenticado con cuotas.
- [ ] Evaluar filtro exacto por país, importación histórica y PostGIS si lo justifican consultas reales.
- [ ] Añadir idiomas y exportaciones limitadas según necesidad.
- [ ] Evaluar colas/Celery únicamente con carga y operaciones observadas.

## Registro de avance

| Fecha | Fase/tarea | Evidencia de verificación | Pendiente o bloqueo |
| --- | --- | --- | --- |
| 2026-10-21 | Plan inicial | Documentación entregada; aplicación aún no implementada | Comenzar Fase 0 |
| 2026-10-21 | Revisión 2 del plan | STRUCTURE.md; decisiones D16–D24; sistema de movimiento en UI_UX.md | Comenzar Fase 0 |
| 2026-10-21 | Fase 0 (rama local `chore/phase-0-base`, sin commit) | `make check` en verde (ruff, mypy, import-linter, 9 tests pytest con PostgreSQL/Redis reales, ESLint con reglas de imports probadas con violaciones, Prettier, tsc, 2 tests Vitest, build); `make up` con servicios sanos solo en 127.0.0.1 (8100/5433/6380, confirmado con `ss`); `/health/live/` y `/health/ready/` 200, ready 503 sin detalles con Redis detenido; Redis rechaza sin contraseña; checkout limpio simulado (`make env/setup/up/migrate/check`) en verde; pre-commit y detect-secrets sin hallazgos en 74 archivos (detector probado con secretos plantados); `.env` ignorado; actionlint sin errores. Decisiones D28–D40 | CI pendiente de ejecutarse en GitHub (requiere push autorizado). Fase 1 tras revisión y commit |
| 2026-10-21 | Fase 0 · CI en GitHub | PR #1 fusionado en `main` (merge `95992b4`). Workflows `backend`, `frontend` y `repo` en verde tanto en el PR (`064fd65`) como en el push a `main` (`95992b4`). **Fase 0 completa** | Comenzar Fase 1 |
| 2026-10-22 | Fase 1 (rama local `feat/usgs-sync`, sin commit) | `make check` en verde: 79 tests pytest (PostgreSQL/Redis reales) que cubren duplicados, correcciones, versión antigua ignorada, cambio de ID preferido, fusiones, nulos, datos inválidos, fallo parcial, fallo de USGS que preserva el último éxito, rollback completo ante error de BD, 304, bloqueo con segunda sesión real y códigos de salida; 8 mutaciones de la lógica crítica detectadas por los tests; 5 contratos de import-linter verificados con violaciones de prueba. Prueba manual contra USGS: `month` importó 10 085 eventos en 3,7 s sin rechazos; repetir dio 304; `day` y `week` sin duplicados; 0 IDs alternativos repetidos entre filas (829 eventos con varios IDs); dos sincronizaciones simultáneas: una salió con código 3. Decisiones D41–D48 | CI pendiente de ejecutarse en GitHub. Fase 2 tras revisión y commit |
| 2026-10-22 | Fase 1 · CI y seguimiento | PR #3 fusionado en `main` (merge `f945b69`). Workflows `backend` y `repo` en verde en el PR (`66b6a01`) y en `main` (`f945b69`); `frontend` no aplica (sin cambios en `frontend/`). Sincronización real 10 min después: `day` creó 4 eventos nuevos sin duplicar 184 existentes; un evento que salió de la ventana de 24 h no se borró. Las correcciones de USGS (actualizaciones) están cubiertas por tests y quedan por observar en vivo cuando corra el scheduler. **Fase 1 completa** | Comenzar Fase 2 |
| 2026-10-22 | Fase 2 (rama local `feat/public-api`, sin commit) | `make check` en verde: 133 tests pytest (rangos inválidos, fechas sin zona, antimeridiano, límites de página y de puntos, truncado por magnitud, 404, 429 con `Retry-After`, 304, ETag que cambia con datos y filtros, caché servida hasta que cambia la versión, Redis caído sin 500 y con límite local, paginación estable con inserciones por fecha y por magnitud con empates y nulos, cobertura con huecos y 304, número de consultas ≤ 5); 4 tests Vitest; 11 mutaciones de la lógica nueva detectadas; 6 contratos de import-linter; `make contract` detecta un contrato desactualizado; actionlint sin errores. Prueba manual con 10 085 eventos reales: GeoJSON de 7 días 1 896 puntos en 73 ms (104 KB gzip), 30 días truncado a 5 000 (279 KB gzip). Una sincronización real actualizó 3 eventos: primera corrección de USGS observada en vivo. Decisiones D49–D60 | CI pendiente de ejecutarse en GitHub. Fase 3 tras revisión y commit |
| 2026-10-22 | Fase 2 · CI | PR #5 fusionado en `main` (merge `abf2a0b`). Primera ejecución de `contract.yml` falló (`3d6d72f`): el hook de Prettier de pre-commit había reformateado `schema.d.ts` porque corre desde la raíz y no aplica `frontend/.prettierignore` (D61). Corregido en `eb9d37d` excluyendo el archivo en el hook; reproducido antes en una copia limpia sin `.env`. Con la corrección, `backend`, `frontend`, `repo` y `contract` en verde en el PR y en `main`. **Fase 2 completa** | Comenzar Fase 3 |
| 2026-10-22 | Fase 3 · PR 1 (rama local `feat/explorer-ui`, sin commit) | Maqueta aprobada (D63) y tokens en `tokens.css`. Interfaz con datos reales sin globo: filtros en la URL, lista por cursor, ficha, frescura y cobertura, tema claro y movimiento reducido. Vitest: 38 tests con MSW (7 mutaciones; 1 no detectada que motivó 3 tests nuevos de frescura). Playwright: 24 recorridos en 1440/768/360 px, repetidos 72 veces sin fallos tras corregir un parpadeo de controles (D70). Comprobación manual contra la API real con 10 000+ eventos: lista, ficha y frescura correctas en escritorio y móvil, sin errores en consola. Fallos reales hallados y corregidos: `fetch` capturado por openapi-fetch, filtros que perdían la magnitud al serializar, opción renombrada de MSW 3 (D71). Decisiones D62–D74 | CI pendiente de ejecutarse en GitHub. Sigue el PR 2 (globo Cesium) |
| 2026-10-22 | Fase 3 · PR 1 · CI | PR #7 fusionado en `main` (merge `3c88e13`). Workflows `frontend`, `contract`, `repo` y, por primera vez, `e2e` (Playwright en GitHub, 1440/768/360 px) en verde en el PR (`56200f2`) y en `main` (`3c88e13`). **PR 1 de la Fase 3 completo** | Sigue el PR 2 (globo Cesium) |
| 2026-10-22 | Fase 3 · PR 2 (rama local `feat/globe`, sin commit) | Globo Cesium con datos reales: teselas Blue Marble propias (682, 7 MB), fronteras Natural Earth, puntos por profundidad y magnitud, selección desde globo y lista, 3D/2D conservando la vista, zoom, teclado, filtro de área en la URL y aviso sin WebGL. Vitest: 46 tests. Playwright: 36 recorridos (72 en dos repeticiones) con WebGL por software en las pruebas del globo, incluido **0 peticiones a servicios externos**. Comprobación manual con 10.000+ eventos reales y capturas en escritorio y móvil. Fallos reales hallados y corregidos: cámara reiniciada al volver a 3D, créditos de NASA ocultos y logotipo de ion engañoso, estilos de Cesium ausentes en el laboratorio, filtro de área activo sin WebGL. Decisiones D75–D83 | CI pendiente de ejecutarse en GitHub |
| 2026-10-22 | Fase 3 · PR 2 · medición | En el PC del propietario (Intel UHD, 1920×911, giro continuo): ~20 fps con todo activado y 1.000–10.000 puntos; 60 fps sin MSAA, sin atmósfera y al 75 % de resolución. Durante la medición se hallaron y corrigieron dos fallos: el contador de fps leía la variable tras reiniciarla (actualizador de React diferido) y los puntos salían cortados por la mitad por la prueba de profundidad (ahora se ocultan con un cálculo de horizonte). Decisiones D84–D86 | Sigue el PR 3 (movimiento y calidad automática) |
| 2026-10-22 | Fase 3 · PR 2 · CI | PR #9 fusionado en `main` (merge `72c7dc6`). Workflows `frontend`, `contract`, `repo` y `e2e` (con las pruebas del globo en WebGL por software) en verde en el PR (`d3176e0`) y en `main` (`72c7dc6`). **PR 2 de la Fase 3 completo** | Sigue el PR 3 (sistema de movimiento y calidad automática, D85) |
| 2026-10-22 | Fase 3 · PR 3 (rama local `feat/motion`, sin commit) | Intro, giro en inactividad con pausa, ondas de la última hora, vuelo de selección con halo, ficha deslizante y calidad Automática/Alta/Baja. En el PC del propietario: Alta 36,4 fps y Baja 60 fps girando; la automática bajó sola; pausa, ondas y selección comprobadas a ojo. Vitest y E2E (incluidas 4 pruebas nuevas de movimiento, 4 mutaciones detectadas). Fallos hallados y corregidos: intro y vuelo del enlace perdidos por el doble montaje de React, zoom durante la intro sin efecto, evento tapado por la ficha, desplegable de calidad ilegible, globo apagado en calidad baja y controles amontonados en móvil. La prueba E2E de error de la API falló una vez con la CPU cargada: esperaba 5 s y los reintentos tardan más de 3 s; ahora espera hasta 15 s. E2E repetido 3 veces: 102 superadas, 42 omitidas por diseño. Decisiones D87–D95 | CI pendiente de ejecutarse en GitHub. Falta para cerrar la Fase 3: capturas y grabación breve de la demo |
| 2026-10-22 | Fase 3 · PR 3 · CI | PR #11 fusionado en `main` (merge `2aaa412`). Workflows `frontend`, `repo` y `e2e` (con las pruebas de movimiento) en verde en el PR (`9fe009e`) y en `main` (`2aaa412`). En `main`, la instalación de Chromium en el runner tardó 11,5 min (las pruebas, 1,6 min): lentitud externa, no del código; si se repite, conviene cachear los navegadores de Playwright en CI. **PR 3 de la Fase 3 completo** | Para cerrar la Fase 3: capturas y grabación breve de la demo, y medición en un móvil medio |
| 2026-10-22 | Fase 3 · cierre (rama local `fix/creditos-cierre-fase-3`, sin commit) | Demo revisada: 7 capturas (1440/768/360 px, ficha, 2D y tema claro) y vídeo de 1 min del propietario, adjuntos al PR (D98). Las capturas destaparon créditos ilegibles en tema claro y en 2D, corregido con fondo propio (D96); lint, formato y pruebas de créditos en verde. Medición en móvil aplazada a la Fase 6 (D97) | CI pendiente; con ella en verde, Fase 3 completa |
