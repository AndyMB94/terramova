"""Parámetros de consulta → objetos de dominio. Toda entrada se valida y se acota."""

import re
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from rest_framework import serializers

from apps.earthquakes.domain import (
    ALL_EVENT_TYPES,
    DEFAULT_EVENT_TYPE,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    BBox,
    Coverage,
    EarthquakeFilters,
    Ordering,
    Window,
    resolve_window,
)

_EVENT_TYPE = re.compile(r"^[a-z][a-z ]{0,31}$")


class AwareDateTimeField(serializers.DateTimeField):
    """ISO 8601 con zona horaria obligatoria; se normaliza a UTC."""

    def to_internal_value(self, value: Any) -> datetime:
        if not isinstance(value, str) or len(value) > 40:
            self.fail("invalid", format="ISO 8601")
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            self.fail("invalid", format="ISO 8601")
        if parsed.tzinfo is None:
            raise serializers.ValidationError(
                "Indica la zona horaria, por ejemplo 2026-10-01T00:00:00Z o -05:00."
            )
        return parsed.astimezone(UTC)


class EarthquakeFilterQuery(serializers.Serializer[Any]):
    start = AwareDateTimeField(
        required=False, help_text="Inicio (incluido), ISO 8601 con zona horaria."
    )
    end = AwareDateTimeField(required=False, help_text="Fin (excluido), ISO 8601 con zona horaria.")
    min_magnitude = serializers.FloatField(required=False, min_value=-5, max_value=12)
    max_magnitude = serializers.FloatField(required=False, min_value=-5, max_value=12)
    min_depth_km = serializers.FloatField(required=False, min_value=-100, max_value=1000)
    max_depth_km = serializers.FloatField(required=False, min_value=-100, max_value=1000)
    bbox = serializers.CharField(
        required=False,
        max_length=100,
        help_text="oeste,sur,este,norte en grados. Si oeste > este cruza el antimeridiano.",
    )
    event_type = serializers.CharField(
        required=False,
        default=DEFAULT_EVENT_TYPE,
        max_length=32,
        help_text=f'Tipo de evento de USGS; "{ALL_EVENT_TYPES}" incluye todos.',
    )

    def validate_bbox(self, value: str) -> BBox:
        parts = value.split(",")
        if len(parts) != 4:
            raise serializers.ValidationError("Usa cuatro números: oeste,sur,este,norte.")
        try:
            west, south, east, north = (float(part) for part in parts)
        except ValueError as exc:
            raise serializers.ValidationError("Usa cuatro números: oeste,sur,este,norte.") from exc
        if not all(-180 <= lon <= 180 for lon in (west, east)):
            raise serializers.ValidationError("La longitud debe estar entre -180 y 180.")
        if not all(-90 <= lat <= 90 for lat in (south, north)):
            raise serializers.ValidationError("La latitud debe estar entre -90 y 90.")
        if south >= north:
            raise serializers.ValidationError("El sur debe ser menor que el norte.")
        if west == east:
            raise serializers.ValidationError("El oeste y el este no pueden coincidir.")
        return BBox(west, south, east, north)

    def validate_event_type(self, value: str) -> str | None:
        if value == ALL_EVENT_TYPES:
            return None
        if not _EVENT_TYPE.match(value):
            raise serializers.ValidationError("Tipo de evento no válido.")
        return value

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        for low, high in (("min_magnitude", "max_magnitude"), ("min_depth_km", "max_depth_km")):
            if low in attrs and high in attrs and attrs[low] > attrs[high]:
                raise serializers.ValidationError({low: "No puede ser mayor que el máximo."})
        return attrs


class EarthquakeListQuery(EarthquakeFilterQuery):
    ordering = serializers.ChoiceField(
        choices=[ordering.value for ordering in Ordering], default=Ordering.RECENT.value
    )
    page_size = serializers.IntegerField(
        required=False, default=DEFAULT_PAGE_SIZE, min_value=1, max_value=MAX_PAGE_SIZE
    )
    cursor = serializers.CharField(required=False, max_length=500)


@dataclass(frozen=True)
class ParsedFilters:
    start: datetime | None
    end: datetime | None
    values: dict[str, Any]

    def build(self, coverage: Coverage | None) -> tuple[Window | None, EarthquakeFilters | None]:
        window = resolve_window(self.start, self.end, coverage)
        if window is None:
            return None, None
        return window, EarthquakeFilters(window=window, **self.values)


def parse_filters(validated: dict[str, Any]) -> ParsedFilters:
    return ParsedFilters(
        start=validated.get("start"),
        end=validated.get("end"),
        values={
            "min_magnitude": validated.get("min_magnitude"),
            "max_magnitude": validated.get("max_magnitude"),
            "min_depth_km": validated.get("min_depth_km"),
            "max_depth_km": validated.get("max_depth_km"),
            "bbox": validated.get("bbox"),
            "event_type": validated.get("event_type", DEFAULT_EVENT_TYPE),
        },
    )
