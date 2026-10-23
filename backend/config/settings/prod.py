"""Producción: detrás del Nginx del host (docs/DEPLOYMENT.md). Nunca DEBUG ni hosts abiertos."""

from .base import *

DEBUG = False
# Sin valor por defecto: arrancar sin hosts explícitos es un error de configuración.
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS")
CSRF_TRUSTED_ORIGINS = env.list("DJANGO_CSRF_TRUSTED_ORIGINS")

# Nginx termina HTTPS y sobrescribe X-Forwarded-Proto; el backend solo escucha en
# 127.0.0.1:8100, así que ningún cliente externo puede falsear esta cabecera.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
# La comprobación de salud de Docker llega por HTTP dentro del contenedor.
SECURE_REDIRECT_EXEMPT = [r"^health/"]
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True

# HSTS solo para este subdominio: includeSubDomains o preload afectarían a los demás
# proyectos de andymallcco.dev (docs/DEPLOYMENT.md). .dev ya exige HTTPS en el navegador.
SECURE_HSTS_SECONDS = 31_536_000
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
SILENCED_SYSTEM_CHECKS = [
    "security.W005",  # HSTS sin includeSubDomains: decisión deliberada (D113)
    "security.W021",  # HSTS sin preload: decisión deliberada (D113)
]

SECURE_REFERRER_POLICY = "same-origin"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"

# Estáticos del admin servidos por WhiteNoise desde Gunicorn (con hash y comprimidos).
MIDDLEWARE.insert(
    MIDDLEWARE.index("django.middleware.security.SecurityMiddleware") + 1,
    "whitenoise.middleware.WhiteNoiseMiddleware",
)
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

LOGGING = JSON_LOGGING
