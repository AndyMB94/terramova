"""Formato de salida. Las clases de respuesta también documentan el contrato OpenAPI."""

from typing import Any

from rest_framework import serializers

from apps.earthquakes.models import Earthquake
from core.api.public import WindowSerializer

# USGS publica algunas coordenadas con ruido de float32 (-121.229667663574). En la base
# se guardan tal cual; en la API se redondea a una precisión con sentido físico.
COORDINATE_DECIMALS = 6  # ~0,1 m
DEPTH_DECIMALS = 3  # 1 m
MAGNITUDE_DECIMALS = 2


def round_or_none(value: float | None, decimals: int) -> float | None:
    return None if value is None else round(value, decimals)


class RoundedFloatField(serializers.FloatField):
    def __init__(self, *, decimals: int, **kwargs: Any) -> None:
        self.decimals = decimals
        super().__init__(**kwargs)

    def to_representation(self, value: Any) -> Any:  # los stubs declaran str
        return round(float(value), self.decimals)


class EarthquakeSerializer(serializers.ModelSerializer[Earthquake]):
    magnitude = RoundedFloatField(decimals=MAGNITUDE_DECIMALS, allow_null=True)
    longitude = RoundedFloatField(decimals=COORDINATE_DECIMALS)
    latitude = RoundedFloatField(decimals=COORDINATE_DECIMALS)
    depth_km = RoundedFloatField(decimals=DEPTH_DECIMALS, allow_null=True)

    class Meta:
        model = Earthquake
        fields = [
            "id",
            "source",
            "external_id",
            "occurred_at",
            "source_updated_at",
            "magnitude",
            "magnitude_type",
            "longitude",
            "latitude",
            "depth_km",
            "place",
            "status",
            "event_type",
            "source_url",
        ]


class EarthquakeListResponseSerializer(serializers.Serializer[Any]):
    results = EarthquakeSerializer(many=True)
    next_cursor = serializers.CharField(allow_null=True)
    window = WindowSerializer(allow_null=True, help_text="Ventana efectiva aplicada.")


class PointGeometrySerializer(serializers.Serializer[Any]):
    type = serializers.ChoiceField(choices=["Point"])
    coordinates = serializers.ListField(
        child=serializers.FloatField(), min_length=2, max_length=2, help_text="[longitud, latitud]"
    )


class MapPointPropertiesSerializer(serializers.Serializer[Any]):
    magnitude = serializers.FloatField(allow_null=True)
    depth_km = serializers.FloatField(allow_null=True)
    occurred_at = serializers.DateTimeField()
    place = serializers.CharField()


class MapFeatureSerializer(serializers.Serializer[Any]):
    type = serializers.ChoiceField(choices=["Feature"])
    id = serializers.UUIDField()
    geometry = PointGeometrySerializer()
    properties = MapPointPropertiesSerializer()


class MapMetadataSerializer(serializers.Serializer[Any]):
    window = WindowSerializer(allow_null=True)
    total_matching = serializers.IntegerField()
    returned = serializers.IntegerField()
    limit = serializers.IntegerField()
    truncated = serializers.BooleanField()
    selection = serializers.ChoiceField(
        choices=["magnitude_desc"],
        help_text="Si se trunca, se conservan los eventos de mayor magnitud.",
    )


class EarthquakeGeoJsonResponseSerializer(serializers.Serializer[Any]):
    type = serializers.ChoiceField(choices=["FeatureCollection"])
    features = MapFeatureSerializer(many=True)
    metadata = MapMetadataSerializer()


class SourceSerializer(serializers.Serializer[Any]):
    name = serializers.CharField()
    url = serializers.URLField()


class LimitsSerializer(serializers.Serializer[Any]):
    max_window_days = serializers.IntegerField()
    default_window_days = serializers.IntegerField()
    default_page_size = serializers.IntegerField()
    max_page_size = serializers.IntegerField()
    max_map_points = serializers.IntegerField()


class MetaResponseSerializer(serializers.Serializer[Any]):
    # DRF retira los campos declarados de la clase; mypy los confunde con Field.source.
    source = SourceSerializer()  # type: ignore[assignment]
    coverage = WindowSerializer(allow_null=True, help_text="Tramo continuo sincronizado.")
    last_successful_sync_at = serializers.DateTimeField(allow_null=True)
    is_stale = serializers.BooleanField()
    stale_after_seconds = serializers.IntegerField()
    data_version = serializers.IntegerField()
    default_event_type = serializers.CharField()
    limits = LimitsSerializer()
