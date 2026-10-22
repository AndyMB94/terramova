from typing import Any

from rest_framework import exceptions
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from core.exceptions import DomainError


def api_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    """Convierte errores en `{code, message}` sin trazas ni detalles internos.

    Las excepciones no previstas devuelven None: Django responde 500 con su manejador
    genérico (sin traza cuando DEBUG=False) y el error queda en los logs.
    """
    if isinstance(exc, DomainError):
        return Response({"code": exc.code, "message": exc.message}, status=exc.status_code)

    response = drf_exception_handler(exc, context)
    if response is None or not isinstance(exc, exceptions.APIException):
        return response

    if isinstance(exc, exceptions.ValidationError):
        # La API pública solo recibe parámetros de consulta: todo 400 es de filtros.
        response.data = {
            "code": "invalid_filters",
            "message": "Los filtros no son válidos.",
            "errors": response.data,
        }
    elif isinstance(exc, exceptions.Throttled):
        response.data = {
            "code": "rate_limited",
            "message": "Demasiadas peticiones. Inténtalo de nuevo en unos segundos.",
        }
    else:
        message = exc.detail if isinstance(exc.detail, str) else exc.default_detail
        response.data = {"code": exc.default_code, "message": str(message)}
    return response
