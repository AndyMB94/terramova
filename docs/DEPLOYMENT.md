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

Referencia para revisar en Fase 6, no configuración probada. Certbot añadirá las líneas de certificado y la redirección 80→443.

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

Definir frecuencia según cambios y recursos; propuesta inicial: backup diario cifrado de PostgreSQL, con retención limitada y copia fuera del disco del VPS. El destino y costo se deciden con el propietario; no asumir almacenamiento externo gratuito.

Probar restauración en una base aislada antes de publicar. Versionar configuración sin secretos. Para rollback de código mantener artefacto anterior; las migraciones pueden ser incompatibles hacia atrás, por lo que se necesita estrategia explícita de migraciones compatibles o restauración. Nunca prometer rollback con solo `git checkout`.

## Operación y costos

API pública USGS y librerías abiertas no requieren una suscripción adicional para el alcance básico. VPS/dominio ya contratados siguen teniendo sus costos existentes. Imágenes/terreno de terceros, backups externos, protección avanzada y DeepSeek pueden añadir costo; verificar antes de habilitar.

Alertas mínimas: última sincronización antigua, errores HTTP, disco, memoria y presupuesto IA. No enviar datos privados a servicios de monitoreo sin decisión. Si la IA falla, mapa y analítica permanecen operativos.
