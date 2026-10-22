import logging

from django.core.cache import cache
from django.db import DatabaseError, connection
from drf_spectacular.utils import extend_schema
from redis.exceptions import RedisError
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)


@extend_schema(exclude=True)
class LiveView(APIView):
    """El proceso responde. No consulta dependencias ni revela versiones."""

    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = ()

    def get(self, request: Request) -> Response:
        return Response({"status": "ok"})


@extend_schema(exclude=True)
class ReadyView(APIView):
    """PostgreSQL y Redis responden. El detalle del fallo solo va a los logs."""

    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = ()

    def get(self, request: Request) -> Response:
        if database_is_available() and cache_is_available():
            return Response({"status": "ok"})
        return Response(
            {
                "code": "temporarily_unavailable",
                "message": "El servicio no está disponible temporalmente.",
            },
            status=503,
        )


def database_is_available() -> bool:
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except DatabaseError as exc:
        logger.warning("Readiness: PostgreSQL no disponible (%s)", type(exc).__name__)
        return False
    return True


def cache_is_available() -> bool:
    try:
        cache.set("health:ready", "1", timeout=5)
        available = bool(cache.get("health:ready") == "1")
    except (RedisError, OSError) as exc:
        logger.warning("Readiness: Redis no disponible (%s)", type(exc).__name__)
        return False
    if not available:
        logger.warning("Readiness: Redis no devolvió el valor escrito")
    return available
