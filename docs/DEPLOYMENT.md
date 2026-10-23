# Desarrollo y despliegue en Ubuntu

Guía de preparación. No son comandos ya ejecutados ni autorización para modificar el VPS.

## Infraestructura existente (confirmada 2026-10-21)

- **VPS Contabo** compartido. La IP pública no se versiona en este repositorio; está en el panel del proveedor y en el registro DNS.
- **Proyectos que ya corren ahí**: Vacantia (Docker Compose, 6 contenedores, en `/root/interviewer-ai`) y el portafolio personal (estático, sin Docker, en el dominio raíz).
- **Dominio** `andymallcco.dev`, DNS administrado en **Porkbun**. Patrón: el dominio raíz es el portafolio y cada proyecto tiene su subdominio (`vacantia.andymallcco.dev`). TerraMova: **`terramova.andymallcco.dev`**.
- **Nginx en el host** (no en Docker), único proceso escuchando 80/443. Cada dominio tiene su propio bloque `server {}` y su certificado Certbot.
- **Puertos de host ya ocupados por Vacantia**: 8000 (backend), 3000 (gateway), 8080 (frontend). TerraMova no los usa.
- `.dev` está en la lista de precarga HSTS de los navegadores: HTTPS es obligatorio desde el primer acceso; no existe modo HTTP de prueba.

## Reglas de red (obligatorias)

Origen: incidente real en Vacantia, donde un Redis sin contraseña publicado en `0.0.0.0` fue encontrado por un escáner y secuestrado.

1. **Nginx del host es el único punto público.** Solo 22, 80 y 443 responden desde Internet.
2. **PostgreSQL y Redis no publican ningún puerto en producción**: sin sección `ports:` en `compose.prod.yaml`. Solo los alcanza el backend por la red interna de Compose. Para administrarlos: `docker compose exec db psql …` o túnel SSH.
3. **El backend publica un único puerto y solo en loopback**: `127.0.0.1:8100:8000`. Nunca `8100:8000`, que equivale a `0.0.0.0`.
4. **Docker se salta UFW.** Un puerto publicado por Docker queda abierto aunque el firewall diga lo contrario, porque Docker escribe sus propias reglas de iptables. Por eso la regla 2–3 se aplica en el Compose, no en el firewall.
5. **Defensa en profundidad**: Redis con `requirepass` (y `protected-mode` por defecto) y PostgreSQL con contraseña fuerte y usuario de privilegios mínimos, aunque no estén expuestos.
6. **Verificación tras cada despliegue**: en el VPS, `ss -tlnp` y `docker compose ps` no muestran `0.0.0.0` ni `[::]` en puertos de TerraMova; desde fuera (otra máquina), un escaneo de los puertos del proyecto no responde.
7. En desarrollo local, los puertos de DB/Redis del `compose.override.yaml` también se publican en `127.0.0.1`.

## Asignación de puertos de TerraMova

| Servicio | Contenedor | Host | Notas |
| --- | --- | --- | --- |
| backend (Gunicorn) | 8000 | `127.0.0.1:8100` | único puerto publicado; Nginx hace `proxy_pass` aquí |
| db (PostgreSQL) | 5432 | ninguno | red interna `terramova_internal` |
| redis | 6379 | ninguno | red interna, con contraseña y `maxmemory` |
| scheduler (supercronic) | — | ninguno | mismo código que backend |
| frontend | — | — | build estático servido directamente por Nginx del host |

Antes de fijar 8100, comprobar en el VPS que está libre (`ss -tlnp | grep 8100`).

## Ubicación en el VPS

- Proyecto en `/root/terramova` (junto a `/root/interviewer-ai`), con su propio `compose.yaml`/`compose.prod.yaml`, Dockerfile, red y volúmenes; nombre de proyecto Compose `terramova`. No comparte contenedores, redes, volúmenes ni base de datos con otros proyectos.
- **Build del frontend fuera de `/root`**: copiar `frontend/dist` a `/var/www/terramova/`. Nginx (usuario `www-data`) normalmente no puede leer dentro de `/root`.
- Mejora futura opcional: usuario de despliegue no root con acceso a Docker para todos los proyectos; no bloquea la publicación.

## Alta del subdominio (sin tocar otros proyectos)

1. Porkbun: registro `A` `terramova` → IP del VPS. `AAAA` solo si el VPS tiene IPv6 configurado y probado.
2. Esperar propagación (`dig terramova.andymallcco.dev`).
3. Crear `/etc/nginx/sites-available/terramova.andymallcco.dev` y enlazarlo en `sites-enabled`. No editar los archivos de Vacantia ni del portafolio.
4. `sudo nginx -t` antes de cualquier recarga; luego `sudo systemctl reload nginx`.
5. `sudo certbot --nginx -d terramova.andymallcco.dev` (solo ese nombre). Verificar `certbot renew --dry-run`.
6. Confirmar que `andymallcco.dev` y `vacantia.andymallcco.dev` siguen respondiendo igual que antes.

## Bloque Nginx de referencia

**Configuración real: `infra/nginx/terramova.andymallcco.dev.conf`** (Fase 6 · PR 1, probada en local con un Nginx real y un navegador, D114). Añade cabecera `X-Request-ID`, CSP ajustada a Cesium, admin tras contraseña de Nginx y estáticos del admin. El bloque de abajo queda como referencia histórica. Certbot añadirá las líneas de certificado y la redirección 80→443.

```nginx
# Fuera de server{}: los archivos de sites-enabled se incluyen en el contexto http
proxy_cache_path /var/cache/nginx/terramova levels=1:2 keys_zone=terramova_api:10m
                 max_size=200m inactive=10m use_temp_path=off;
limit_req_zone $binary_remote_addr zone=terramova_req:10m rate=10r/s;

server {
    server_name terramova.andymallcco.dev;

    root /var/www/terramova;
    index index.html;
    client_max_body_size 1m;

    gzip on;
    gzip_types application/json application/geo+json text/css application/javascript;

    location /api/ {
        limit_req zone=terramova_req burst=20 nodelay;
        proxy_pass http://127.0.0.1:8100;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;   # sobrescribe, no concatena lo que envía el cliente
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 15s;

        proxy_cache terramova_api;
        proxy_cache_methods GET HEAD;
        proxy_cache_valid 200 60s;
        proxy_cache_lock on;
        proxy_cache_use_stale error timeout updating;
        add_header X-Cache-Status $upstream_cache_status;
    }

    location /health/live/ { proxy_pass http://127.0.0.1:8100; }
    # /health/ready/ y /admin/ no se exponen o se restringen (allow/deny, auth básica o túnel SSH)

    location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }
    location / { try_files $uri $uri/ /index.html; }   # rutas de la SPA
}
```

Django en producción: `ALLOWED_HOSTS=terramova.andymallcco.dev`, `CSRF_TRUSTED_ORIGINS=https://terramova.andymallcco.dev`, `SECURE_PROXY_SSL_HEADER` confiando en `X-Forwarded-Proto` solo porque el único cliente del backend es Nginx en loopback.

## Antes de producción

Pendiente de inventariar: RAM/CPU/disco libres, versión de Ubuntu y Docker, y consumo actual de Vacantia. Dimensionar workers Gunicorn, PostgreSQL y Redis a partir de eso. No instalar un segundo Nginx, no levantar ningún contenedor que escuche en 80/443 y no sobrescribir configuración compartida. No modificar firewall o SSH de forma que bloquee el acceso operativo.

## Entorno local

Objetivo: frontend Vite en desarrollo y backend Django con PostgreSQL/Redis locales mediante Compose. Proponer un único comando de arranque documentado. Las migraciones se ejecutan explícitamente; fixtures de demo son opcionales y etiquetadas. Hot reload solo en desarrollo.

## Topología de producción

- Nginx termina HTTPS y sirve assets compilados. `/api/` se dirige a Django/Gunicorn en red interna.
- PostgreSQL y Redis sin puertos publicados (ver Reglas de red). Backend solo en `127.0.0.1:8100`.
- Contenedores sin privilegios innecesarios; imágenes y dependencias fijadas, volúmenes y redes con nombres del proyecto.
- Nginx del host con un archivo de sitio independiente para TerraMova; ningún contenedor compite por 80/443.
- No usar `vite --host`, `vite preview` ni `manage.py runserver` como servidor público de producción.
- Contenedor `scheduler` (supercronic, misma imagen del backend) para la sincronización escalonada; no requiere timers en el host.
- Nginx con microcaché para `GET /api/v1/*`, `proxy_cache_lock` y compresión. CDN opcional (por ejemplo, Cloudflare) más adelante: implicaría mover la gestión DNS desde Porkbun y afecta a todo el dominio, así que es una decisión aparte.
- El VPS aloja otros proyectos: nombre de proyecto Compose propio, Redis propio con `maxmemory` y política de expulsión, y límites de memoria por contenedor para que TerraMova no afecte a Vacantia ni al portafolio.
- Subdominio `terramova.andymallcco.dev` (DNS en Porkbun).
- HTTPS con Certbot y renovación comprobada. No añadir `includeSubDomains` ni preload propios a HSTS: afectaría a los demás subdominios.

## Configuración

Crear `.env.example` con variables sin secretos: modo Django, hosts/orígenes, conexión DB/Redis, parámetros de USGS, versión de frontend y variables IA apagadas. En producción guardar secretos fuera de Git, con permisos mínimos. `SECRET_KEY` fuerte y diferente entre entornos. No enviar claves al frontend.

Fijar UTC en backend y DB. Configurar logs rotados, espacio de disco, retención y healthchecks. Ninguna ruta pública de salud revela versiones detalladas, credenciales o configuración interna.

## Secuencia de despliegue autorizada

1. Revisar diff, CI, configuración y plan de rollback; registrar versión/commit.
2. Crear backup verificado antes de migraciones que afecten datos.
3. Construir imágenes/artefactos reproducibles, validar configuración de Nginx y Compose.
4. Aplicar migraciones con procedimiento documentado; no lanzar múltiples migradores simultáneos.
5. Actualizar servicios y ejecutar readiness/smoke tests.
6. Activar el contenedor scheduler con bloqueo compartido y observar un ciclo exitoso de cada frecuencia.
7. IA permanece desactivada salvo autorización y controles verificados.
8. Confirmar HTTPS, créditos geográficos, rutas SPA, assets Cesium, errores y límites API.

No ejecutar un comando remoto de instalación descargado sin inspección. No mostrar secretos en logs de despliegue.

## Backups y rollback

Implementado y probado en local en la Fase 6 · PR 2 (D118–D120). Los comandos se ejecutan desde `/root/terramova`.

### Copias de PostgreSQL

- `infra/scripts/backup_db.sh` crea `backups/terramova-<fecha UTC>.dump` (formato custom) con su SHA-256, comprueba que se puede leer, deja permisos `600` y borra las de más de `BACKUP_KEEP_DAYS` (14 por defecto). No necesita credenciales: las lee dentro del contenedor.
- Frecuencia propuesta: diaria. Cómo programarla en el VPS (cron del host o servicio de Compose) se decide en el plan de despliegue, con autorización.
- **Pendiente de decisión (D119):** copia fuera del VPS y cifrado. Hasta entonces, las copias viven en el mismo disco: protegen frente a errores de datos o migraciones, no frente a perder el servidor. Los eventos se pueden volver a importar de USGS (30 días); el historial de sincronizaciones no.

### Prueba de restauración

`infra/scripts/restore_check.sh backups/<copia>.dump` verifica el SHA-256 y restaura en un PostgreSQL temporal **sin red** (misma versión que `compose.yaml`), muestra el número de eventos, sincronizaciones y migraciones, y borra el contenedor. Hacerla tras cada cambio de esquema y periódicamente. Probado: copia real restaurada con los mismos 10.264 eventos; una copia con un byte cambiado o truncada se rechaza.

### Restauración real (solo si hace falta, con copia verificada)

1. `docker compose -f compose.yaml -f compose.prod.yaml stop backend scheduler`
2. `docker compose -f compose.yaml -f compose.prod.yaml exec -T db sh -c 'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backups/<copia>.dump`
3. `docker compose -f compose.yaml -f compose.prod.yaml start backend scheduler` y comprobar `/health/ready/` (desde el VPS) y `/api/v1/meta/`.

### Rollback de código

- **Backend:** cada despliegue construye la imagen con `TERRAMOVA_IMAGE_TAG=<commit corto>` y conserva la anterior. Volver atrás = arrancar con la etiqueta anterior (`TERRAMOVA_IMAGE_TAG=<anterior> docker compose ... up -d backend scheduler`), sin reconstruir.
- **Frontend:** cada versión en su carpeta (`/var/www/terramova-releases/<commit>`) y `/var/www/terramova` como enlace simbólico; volver = apuntar el enlace a la anterior. Nginx no necesita recarga.
- **Migraciones:** se escriben compatibles hacia atrás (añadir antes de quitar), para que la versión anterior del código funcione con el esquema nuevo. Copia verificada antes de migrar. Si una migración no fuera compatible, el rollback es restaurar la copia: se pierde lo escrito desde entonces (recuperable de USGS en su mayoría). Nunca prometer rollback con solo `git checkout`.

## Operación y costos

API pública USGS y librerías abiertas no requieren una suscripción adicional para el alcance básico. VPS/dominio ya contratados siguen teniendo sus costos existentes. Imágenes/terreno de terceros, backups externos, protección avanzada y DeepSeek pueden añadir costo; verificar antes de habilitar.

Alertas mínimas: última sincronización antigua, errores HTTP, disco, memoria y presupuesto IA. No enviar datos privados a servicios de monitoreo sin decisión. Si la IA falla, mapa y analítica permanecen operativos.
