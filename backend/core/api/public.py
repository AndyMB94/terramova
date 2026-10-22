"""Piezas comunes de la API pública de solo lectura (todas las apps las comparten)."""

from datetime import datetime
from typing import Any

from drf_spectacular.utils import OpenApiResponse
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView


class PublicReadView(APIView):
    """GET público sin cuenta: sin autenticación; los límites de tasa siguen aplicando."""

    authentication_classes = ()
    permission_classes = (AllowAny,)


def format_datetime(value: datetime) -> str:
    """Mismo formato que DRF en toda la API (UTC con sufijo Z)."""
    return str(serializers.DateTimeField().to_representation(value))


class WindowSerializer(serializers.Serializer[Any]):
    start = serializers.DateTimeField()
    end = serializers.DateTimeField()


class ErrorSerializer(serializers.Serializer[Any]):
    code = serializers.CharField()
    message = serializers.CharField()
    # No choca con Serializer.errors en tiempo de ejecución: solo documenta el contrato.
    errors = serializers.DictField(  # type: ignore[assignment]
        required=False, help_text="Detalle por campo (solo 400)."
    )


ERROR_RESPONSES = {
    400: OpenApiResponse(ErrorSerializer, description="Filtros no válidos (invalid_filters)."),
    429: OpenApiResponse(ErrorSerializer, description="Demasiadas peticiones (rate_limited)."),
}
