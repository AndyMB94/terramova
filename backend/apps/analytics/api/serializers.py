"""Formato de salida de la analítica; las clases documentan el contrato OpenAPI."""

from typing import Any

from rest_framework import serializers

from core.api.public import WindowSerializer


class StrongestEventSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    magnitude = serializers.FloatField()
    place = serializers.CharField()
    occurred_at = serializers.DateTimeField()


class MagnitudeBandSerializer(serializers.Serializer[Any]):
    key = serializers.CharField(help_text="Identificador estable de la banda, p. ej. 3-4.")
    min = serializers.FloatField(allow_null=True, help_text="Incluido; null sin límite.")
    max = serializers.FloatField(allow_null=True, help_text="Excluido; null sin límite.")
    count = serializers.IntegerField()


class DepthClassSerializer(serializers.Serializer[Any]):
    key = serializers.CharField(help_text="Igual que la leyenda del mapa, p. ej. 70-150.")
    min_km = serializers.FloatField(allow_null=True, help_text="Incluido; null sin límite.")
    max_km = serializers.FloatField(allow_null=True, help_text="Excluido; null sin límite.")
    count = serializers.IntegerField()


class ComparisonSerializer(serializers.Serializer[Any]):
    available = serializers.BooleanField()
    previous_window = WindowSerializer(allow_null=True)
    previous_total = serializers.IntegerField(allow_null=True)
    reason = serializers.ChoiceField(
        choices=["outside_coverage", "no_data"],
        allow_null=True,
        help_text="Por qué no hay comparación (null si la hay).",
    )


class SummaryResponseSerializer(serializers.Serializer[Any]):
    window = WindowSerializer(allow_null=True, help_text="Ventana efectiva aplicada.")
    window_clipped = serializers.BooleanField(
        help_text="La ventana pedida empieza antes de la cobertura y se recortó."
    )
    total = serializers.IntegerField()
    max_magnitude = serializers.FloatField(allow_null=True)
    strongest = StrongestEventSerializer(allow_null=True)
    magnitude_bands = MagnitudeBandSerializer(many=True)
    magnitude_unknown = serializers.IntegerField(help_text="Eventos sin magnitud publicada.")
    depth_classes = DepthClassSerializer(many=True)
    depth_unknown = serializers.IntegerField(help_text="Eventos sin profundidad publicada.")
    comparison = ComparisonSerializer()


class TimelineBucketSerializer(serializers.Serializer[Any]):
    start = serializers.DateTimeField()
    end = serializers.DateTimeField()
    count = serializers.IntegerField()
    max_magnitude = serializers.FloatField(allow_null=True)
    is_partial = serializers.BooleanField(
        help_text="El intervalo solo está cubierto en parte por la ventana."
    )


class TimelineResponseSerializer(serializers.Serializer[Any]):
    window = WindowSerializer(allow_null=True)
    granularity = serializers.ChoiceField(choices=["hour", "day"])
    buckets = TimelineBucketSerializer(many=True)
