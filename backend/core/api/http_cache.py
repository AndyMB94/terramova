"""Respuestas GET cacheables: ETag, 304, Cache-Control y caché de aplicación."""

from collections.abc import Callable
from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from core.cache import canonical_digest, safe_get, safe_set

# Alineado con el ciclo de sincronización: los datos cambian cada pocos minutos.
DEFAULT_MAX_AGE = 60
APP_CACHE_TIMEOUT = 300


def cached_get_response(
    request: Request,
    *,
    namespace: str,
    key_parts: dict[str, Any],
    build: Callable[[], Any],
    max_age: int = DEFAULT_MAX_AGE,
) -> Response:
    """Devuelve 304 si el cliente ya tiene la versión; si no, sirve desde caché o construye.

    El ETag se calcula antes de consultar la base: `key_parts` debe incluir todo lo que
    determina el contenido (versión de esquema, versión de datos y filtros efectivos).
    """
    digest = canonical_digest(namespace, key_parts)
    etag = f'"{digest}"'

    if _matches(request.headers.get("If-None-Match", ""), etag):
        return _with_headers(Response(status=304), etag, max_age)

    cache_key = f"api:{namespace}:{digest}"
    data = safe_get(cache_key)
    if data is None:
        data = build()
        safe_set(cache_key, data, APP_CACHE_TIMEOUT)
    return _with_headers(Response(data), etag, max_age)


def _matches(if_none_match: str, etag: str) -> bool:
    candidates = {tag.strip().removeprefix("W/") for tag in if_none_match.split(",")}
    return etag in candidates or "*" in candidates


def _with_headers(response: Response, etag: str, max_age: int) -> Response:
    response["ETag"] = etag
    response["Cache-Control"] = f"public, max-age={max_age}, stale-while-revalidate={max_age}"
    return response
