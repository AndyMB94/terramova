"""Vistas públicas de solo lectura: validan, consultan selectors y serializan."""

from collections.abc import Mapping
from datetime import datetime
from typing import Any
from uuid import UUID

from django.utils import timezone
from drf_spectacular.utils import OpenApiExample, OpenApiResponse, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from apps.earthquakes import selectors
from apps.earthquakes.api.filters import EarthquakeFilterQuery, EarthquakeListQuery, parse_filters
from apps.earthquakes.api.serializers import (
    COORDINATE_DECIMALS,
    DEPTH_DECIMALS,
    MAGNITUDE_DECIMALS,
    EarthquakeGeoJsonResponseSerializer,
    EarthquakeListResponseSerializer,
    EarthquakeSerializer,
    MetaResponseSerializer,
    round_or_none,
)
from apps.earthquakes.domain import (
    DEFAULT_EVENT_TYPE,
    DEFAULT_PAGE_SIZE,
    DEFAULT_WINDOW,
    MAX_MAP_POINTS,
    MAX_PAGE_SIZE,
    MAX_WINDOW,
    STALE_AFTER,
    Ordering,
    Window,
)
from core.api.http_cache import cached_get_response
from core.api.public import ERROR_RESPONSES, ErrorSerializer, PublicReadView, format_datetime

# Cambia cuando cambia el formato de las respuestas: invalida cachés y ETags.
SCHEMA_VERSION = 1


class EarthquakeListView(PublicReadView):
    @extend_schema(
        operation_id="earthquakes_list",
        summary="Lista de eventos",
        description=(
            "Paginación por cursor estable ante inserciones. Sin fechas usa los últimos 7 días "
            "de la cobertura; el rango máximo es 31 días. Por defecto solo `earthquake`."
        ),
        parameters=[EarthquakeListQuery],
        responses={200: EarthquakeListResponseSerializer, **ERROR_RESPONSES},
        examples=[
            OpenApiExample(
                "Primera página",
                response_only=True,
                status_codes=["200"],
                description="GET /api/v1/earthquakes/?min_magnitude=4&bbox=-82,-56,-34,13",
                value={
                    "results": [
                        {
                            "id": "5b0f8f7e-3c1a-4c55-9d7e-2f4d7a1c9e10",
                            "source": "usgs",
                            "external_id": "us6000u3tu",
                            "occurred_at": "2026-10-21T18:04:11.123000+00:00",
                            "source_updated_at": "2026-10-21T18:30:02.000000+00:00",
                            "magnitude": 4.6,
                            "magnitude_type": "mb",
                            "longitude": -71.62,
                            "latitude": -30.15,
                            "depth_km": 48.3,
                            "place": "35 km W of Ovalle, Chile",
                            "status": "reviewed",
                            "event_type": "earthquake",
                            "source_url": "https://earthquake.usgs.gov/earthquakes/eventpage/us6000u3tu",
                        }
                    ],
                    "next_cursor": "eyJmIjoib2NjdXJyZWRfYXQiLCJ2IjoiLi4uIn0",
                    "window": {
                        "start": "2026-10-15T03:58:52+00:00",
                        "end": "2026-10-22T03:58:52+00:00",
                    },
                },
            ),
            OpenApiExample(
                "Filtros no válidos",
                response_only=True,
                status_codes=["400"],
                value={
                    "code": "invalid_filters",
                    "message": "Los filtros no son válidos.",
                    "errors": {"start": ["Indica la zona horaria, p. ej. 2026-10-01T00:00:00Z."]},
                },
            ),
        ],
    )
    def get(self, request: Request) -> Response:
        query = EarthquakeListQuery(data=request.query_params)
        query.is_valid(raise_exception=True)
        params = query.validated_data
        state = selectors.get_data_state()
        window, filters = parse_filters(params).build(state.coverage)
        ordering = Ordering(params["ordering"])
        page_size: int = params["page_size"]
        cursor: str | None = params.get("cursor")

        def build() -> dict[str, Any]:
            if filters is None:
                return {"results": [], "next_cursor": None, "window": None}
            page = selectors.list_events(
                filters, ordering=ordering, page_size=page_size, cursor=cursor
            )
            return {
                "results": EarthquakeSerializer(page.items, many=True).data,
                "next_cursor": page.next_cursor,
                "window": _window(window),
            }

        return cached_get_response(
            request,
            namespace="earthquakes:list",
            key_parts={
                "schema": SCHEMA_VERSION,
                "data": state.data_version,
                "filters": filters.canonical() if filters else None,
                "ordering": ordering.value,
                "page_size": page_size,
                "cursor": cursor,
            },
            build=build,
        )


class EarthquakeGeoJsonView(PublicReadView):
    @extend_schema(
        operation_id="earthquakes_geojson",
        summary="Puntos para el mapa (GeoJSON)",
        description=(
            f"Como máximo {MAX_MAP_POINTS} puntos. Si hay más, se devuelven los de mayor "
            "magnitud y `metadata.truncated` es true; `total_matching` indica cuántos coinciden."
        ),
        parameters=[EarthquakeFilterQuery],
        responses={200: EarthquakeGeoJsonResponseSerializer, **ERROR_RESPONSES},
    )
    def get(self, request: Request) -> Response:
        query = EarthquakeFilterQuery(data=request.query_params)
        query.is_valid(raise_exception=True)
        state = selectors.get_data_state()
        window, filters = parse_filters(query.validated_data).build(state.coverage)

        def build() -> dict[str, Any]:
            result = selectors.map_points(filters) if filters else None
            points = result.points if result else []
            return {
                "type": "FeatureCollection",
                "features": [_feature(point) for point in points],
                "metadata": {
                    "window": _window(window),
                    "total_matching": result.total_matching if result else 0,
                    "returned": len(points),
                    "limit": MAX_MAP_POINTS,
                    "truncated": result.truncated if result else False,
                    "selection": "magnitude_desc",
                },
            }

        return cached_get_response(
            request,
            namespace="earthquakes:geojson",
            key_parts={
                "schema": SCHEMA_VERSION,
                "data": state.data_version,
                "filters": filters.canonical() if filters else None,
            },
            build=build,
        )


class EarthquakeDetailView(PublicReadView):
    @extend_schema(
        operation_id="earthquakes_retrieve",
        summary="Detalle de un evento",
        responses={
            200: EarthquakeSerializer,
            404: OpenApiResponse(ErrorSerializer, description="El evento no existe."),
            429: ERROR_RESPONSES[429],
        },
    )
    def get(self, request: Request, event_id: UUID) -> Response:
        data_version = selectors.current_data_version()
        return cached_get_response(
            request,
            namespace="earthquakes:detail",
            key_parts={"schema": SCHEMA_VERSION, "data": data_version, "id": str(event_id)},
            build=lambda: EarthquakeSerializer(selectors.get_event(event_id)).data,
        )


class MetaView(PublicReadView):
    @extend_schema(
        operation_id="meta_retrieve",
        summary="Fuente, cobertura, frescura y límites",
        responses={200: MetaResponseSerializer, 429: ERROR_RESPONSES[429]},
    )
    def get(self, request: Request) -> Response:
        state = selectors.get_data_state()
        coverage = state.coverage
        last_sync = coverage.last_successful_sync_at if coverage else None
        is_stale = last_sync is None or timezone.now() - last_sync > STALE_AFTER
        data = {
            "source": {"name": "USGS", "url": "https://earthquake.usgs.gov/"},
            "coverage": _window(Window(coverage.start, coverage.end)) if coverage else None,
            "last_successful_sync_at": _iso(last_sync),
            "is_stale": is_stale,
            "stale_after_seconds": int(STALE_AFTER.total_seconds()),
            "data_version": state.data_version,
            "default_event_type": DEFAULT_EVENT_TYPE,
            "limits": {
                "max_window_days": MAX_WINDOW.days,
                "default_window_days": DEFAULT_WINDOW.days,
                "default_page_size": DEFAULT_PAGE_SIZE,
                "max_page_size": MAX_PAGE_SIZE,
                "max_map_points": MAX_MAP_POINTS,
            },
        }
        # is_stale depende del reloj: forma parte de la clave para que el ETag cambie.
        return cached_get_response(
            request,
            namespace="meta",
            key_parts={"schema": SCHEMA_VERSION, "body": data},
            build=lambda: data,
            max_age=30,
        )


def _window(window: Window | None) -> dict[str, str] | None:
    if window is None:
        return None
    return {"start": format_datetime(window.start), "end": format_datetime(window.end)}


def _iso(value: datetime | None) -> str | None:
    return format_datetime(value) if value else None


def _feature(point: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "type": "Feature",
        "id": str(point["id"]),
        "geometry": {
            "type": "Point",
            "coordinates": [
                round(point["longitude"], COORDINATE_DECIMALS),
                round(point["latitude"], COORDINATE_DECIMALS),
            ],
        },
        "properties": {
            "magnitude": round_or_none(point["magnitude"], MAGNITUDE_DECIMALS),
            "depth_km": round_or_none(point["depth_km"], DEPTH_DECIMALS),
            "occurred_at": format_datetime(point["occurred_at"]),
            "place": point["place"],
        },
    }
