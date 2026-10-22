"""Vistas públicas de analítica: mismos filtros, caché y límites que la API de eventos."""

from datetime import datetime
from typing import Any

from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from apps.analytics import selectors
from apps.analytics.api.serializers import SummaryResponseSerializer, TimelineResponseSerializer
from apps.analytics.domain import (
    DEPTH_CLASSES,
    MAGNITUDE_BANDS,
    Granularity,
    bucket_starts,
    granularity_for,
)
from apps.analytics.services import compare_with_previous
from apps.earthquakes import selectors as earthquake_selectors

# El parser de filtros es el contrato público de lectura de earthquakes: reutilizarlo
# garantiza que lista, mapa y estadísticas interpretan igual cada parámetro (D99).
from apps.earthquakes.api.filters import EarthquakeFilterQuery, parse_filters
from apps.earthquakes.domain import DEFAULT_WINDOW, Window
from core.api.http_cache import cached_get_response
from core.api.public import ERROR_RESPONSES, PublicReadView, format_datetime

# Cambia cuando cambia el formato de las respuestas: invalida cachés y ETags.
SCHEMA_VERSION = 1
MAGNITUDE_DECIMALS = 2


class SummaryView(PublicReadView):
    @extend_schema(
        operation_id="analytics_summary",
        summary="Resumen estadístico del conjunto filtrado",
        description=(
            "Conteo, magnitud máxima y distribuciones por magnitud y profundidad sobre TODOS "
            "los eventos que cumplen los filtros (no sobre una página ni sobre el límite del "
            "mapa). Incluye la comparación con la ventana anterior de igual duración solo si "
            "la cobertura la incluye entera."
        ),
        parameters=[EarthquakeFilterQuery],
        responses={200: SummaryResponseSerializer, **ERROR_RESPONSES},
        examples=[
            OpenApiExample(
                "Ventana sin comparación por cobertura",
                response_only=True,
                status_codes=["200"],
                description="GET /api/v1/analytics/summary/ con los últimos 30 días",
                value={
                    "window": {"start": "2026-09-22T03:58:52Z", "end": "2026-10-22T03:58:52Z"},
                    "window_clipped": False,
                    "total": 9842,
                    "max_magnitude": 7.0,
                    "strongest": {
                        "id": "bf38b622-8854-4aa6-8282-93cefbf8b6ba",
                        "magnitude": 7.0,
                        "place": "183 km ENE of Nagqu, China",
                        "occurred_at": "2026-10-22T14:33:39Z",
                    },
                    "magnitude_bands": [{"key": "4-5", "min": 4, "max": 5, "count": 512}],
                    "magnitude_unknown": 3,
                    "depth_classes": [{"key": "0-35", "min_km": None, "max_km": 35, "count": 8120}],
                    "depth_unknown": 0,
                    "comparison": {
                        "available": False,
                        "previous_window": {
                            "start": "2026-08-23T03:58:52Z",
                            "end": "2026-09-22T03:58:52Z",
                        },
                        "previous_total": None,
                        "reason": "outside_coverage",
                    },
                },
            )
        ],
    )
    def get(self, request: Request) -> Response:
        query = EarthquakeFilterQuery(data=request.query_params)
        query.is_valid(raise_exception=True)
        parsed = parse_filters(query.validated_data)
        state = earthquake_selectors.get_data_state()
        window, filters = parsed.build(state.coverage)

        def build() -> dict[str, Any]:
            summary = selectors.summarize(filters) if filters else None
            comparison = compare_with_previous(filters, state.coverage)
            strongest = summary.strongest if summary else None
            return {
                "window": _window(window),
                "window_clipped": _clipped(parsed.start, window),
                "total": summary.total if summary else 0,
                "max_magnitude": _round(summary.max_magnitude if summary else None),
                "strongest": None
                if strongest is None
                else {
                    "id": str(strongest.id),
                    "magnitude": _round(strongest.magnitude),
                    "place": strongest.place,
                    "occurred_at": format_datetime(strongest.occurred_at),
                },
                "magnitude_bands": [
                    {
                        "key": band.key,
                        "min": band.lower,
                        "max": band.upper,
                        "count": summary.magnitude_counts[index] if summary else 0,
                    }
                    for index, band in enumerate(MAGNITUDE_BANDS)
                ],
                "magnitude_unknown": summary.magnitude_unknown if summary else 0,
                "depth_classes": [
                    {
                        "key": band.key,
                        "min_km": band.lower,
                        "max_km": band.upper,
                        "count": summary.depth_counts[index] if summary else 0,
                    }
                    for index, band in enumerate(DEPTH_CLASSES)
                ],
                "depth_unknown": summary.depth_unknown if summary else 0,
                "comparison": {
                    "available": comparison.available,
                    "previous_window": _window(comparison.previous_window),
                    "previous_total": comparison.previous_total,
                    "reason": comparison.unavailable.value if comparison.unavailable else None,
                },
            }

        coverage = state.coverage
        return cached_get_response(
            request,
            namespace="analytics:summary",
            key_parts={
                "schema": SCHEMA_VERSION,
                "data": state.data_version,
                "filters": filters.canonical() if filters else None,
                "requested_start": parsed.start.isoformat() if parsed.start else None,
                # La comparación depende de dónde empieza la cobertura.
                "coverage_start": coverage.start.isoformat() if coverage else None,
            },
            build=build,
        )


class TimelineView(PublicReadView):
    @extend_schema(
        operation_id="analytics_timeline",
        summary="Eventos por hora o por día",
        description=(
            "Por hora si la ventana dura 48 h o menos; por día si es más larga. Incluye los "
            "intervalos sin eventos (count 0). Los intervalos UTC de los extremos pueden "
            "quedar cubiertos solo en parte (`is_partial`)."
        ),
        parameters=[EarthquakeFilterQuery],
        responses={200: TimelineResponseSerializer, **ERROR_RESPONSES},
    )
    def get(self, request: Request) -> Response:
        query = EarthquakeFilterQuery(data=request.query_params)
        query.is_valid(raise_exception=True)
        state = earthquake_selectors.get_data_state()
        window, filters = parse_filters(query.validated_data).build(state.coverage)

        def build() -> dict[str, Any]:
            if window is None or filters is None:
                return {"window": None, "granularity": Granularity.DAY.value, "buckets": []}
            granularity = granularity_for(window)
            counts = selectors.timeline(filters, granularity)
            buckets = []
            for start in bucket_starts(window, granularity):
                end = start + granularity.step
                bucket = counts.get(start)
                buckets.append(
                    {
                        "start": format_datetime(start),
                        "end": format_datetime(end),
                        "count": bucket.count if bucket else 0,
                        "max_magnitude": _round(bucket.max_magnitude if bucket else None),
                        "is_partial": start < window.start or end > window.end,
                    }
                )
            return {
                "window": _window(window),
                "granularity": granularity.value,
                "buckets": buckets,
            }

        return cached_get_response(
            request,
            namespace="analytics:timeline",
            key_parts={
                "schema": SCHEMA_VERSION,
                "data": state.data_version,
                "filters": filters.canonical() if filters else None,
            },
            build=build,
        )


def _window(window: Window | None) -> dict[str, str] | None:
    if window is None:
        return None
    return {"start": format_datetime(window.start), "end": format_datetime(window.end)}


def _clipped(requested_start: datetime | None, window: Window | None) -> bool:
    """La cobertura recortó el inicio pedido (o el de por defecto: 7 días)."""
    if window is None:
        return False
    expected = requested_start if requested_start is not None else window.end - DEFAULT_WINDOW
    return window.start > expected


def _round(value: float | None) -> float | None:
    return None if value is None else round(value, MAGNITUDE_DECIMALS)
