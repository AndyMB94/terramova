"""Gunicorn en producción (compose.prod.yaml). Valores ajustables por entorno.

Los workers se dimensionan con el inventario del VPS (docs/DEPLOYMENT.md): el servidor
es compartido con otros proyectos, así que se empieza con pocos.
"""

import os

# Solo dentro del contenedor: el host publica este puerto únicamente en 127.0.0.1:8100.
bind = "0.0.0.0:8000"
workers = int(os.environ.get("WEB_CONCURRENCY", "2"))
threads = 1
# Por encima del statement_timeout de PostgreSQL (15 s): una consulta lenta falla antes.
timeout = 30
graceful_timeout = 20
keepalive = 5
# Reciclar workers de vez en cuando acota cualquier fuga de memoria.
max_requests = 1000
max_requests_jitter = 100

# El único cliente es Nginx (vía el puerto publicado en loopback), cuya dirección vista
# desde el contenedor es la puerta de enlace de Docker.
forwarded_allow_ips = "*"

# Acceso en JSON, sin IP ni user agent (Nginx ya guarda el acceso completo). El
# identificador se toma de la respuesta: así también aparece el que genera Django.
accesslog = "-"
errorlog = "-"
access_log_format = (
    '{"time":"%(t)s","level":"INFO","logger":"gunicorn.access",'
    '"method":"%(m)s","path":"%(U)s","status":%(s)s,"bytes":"%(B)s",'
    '"duration_ms":%(M)s,"request_id":"%({x-request-id}o)s"}'
)
