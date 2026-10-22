# Imagen del backend. En Fase 0 sirve al entorno de desarrollo (runserver vía
# compose.override.yaml); la Fase 6 añade Gunicorn y la configuración de producción.
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

RUN groupadd --system app && useradd --system --gid app --home-dir /app --no-create-home app

WORKDIR /app

# Dependencias primero para aprovechar la caché de capas; el venv vive fuera de /app
# para que el bind mount de desarrollo no lo oculte.
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --locked --no-dev --no-install-project

COPY --chown=app:app . .

USER app

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health/live/', timeout=2)"]

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
