# Imagen del backend: la misma para producción (Gunicorn), el scheduler (supercronic) y
# desarrollo (compose.override.yaml cambia el comando a runserver con el código montado).
FROM ghcr.io/astral-sh/uv:0.13.4 AS uv

FROM python:3.13.16-slim-trixie

COPY --from=uv /uv /uvx /bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

# supercronic para el contenedor scheduler (D20). Versión de agosto de 2026 con su
# SHA-256 publicado: el build falla si el binario descargado no coincide.
ADD --checksum=sha256:a53ae236602c7338aba3fbaff40bda6300eae3b9fedb8261eb06cfe3724430c1 \
    https://github.com/aptible/supercronic/releases/download/v0.2.49/supercronic-linux-amd64 \
    /usr/local/bin/supercronic
RUN chmod 0755 /usr/local/bin/supercronic

RUN groupadd --system app && useradd --system --gid app --home-dir /app --no-create-home app

WORKDIR /app

# Dependencias primero para aprovechar la caché de capas; el venv vive fuera de /app
# para que el bind mount de desarrollo no lo oculte.
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --locked --no-dev --no-install-project

COPY --chown=app:app . .

# Estáticos del admin con hash (WhiteNoise). Los valores son de relleno: collectstatic no
# conecta con nada y la imagen no contiene ningún secreto real.
RUN DJANGO_SETTINGS_MODULE=config.settings.prod \
    DJANGO_SECRET_KEY=build-only DJANGO_ALLOWED_HOSTS=localhost \
    DJANGO_CSRF_TRUSTED_ORIGINS=https://localhost \
    DB_NAME=x DB_USER=x DB_PASSWORD=x DB_HOST=x DB_PORT=5432 REDIS_HOST=x REDIS_PORT=6379 \
    python manage.py collectstatic --noinput \
    && chown -R app:app /app/staticfiles

USER app

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health/live/', timeout=2)"]

CMD ["gunicorn", "config.wsgi:application", "--config", "gunicorn.conf.py"]
