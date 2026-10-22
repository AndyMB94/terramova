"""Tipos del GeoJSON de los feeds de USGS. Todo lo que llega se trata como no confiable.

Solo se declaran los campos que se usan; el resto se ignora. Los límites se basan en
los valores observados en los feeds reales (ver docs/DATA_API.md) con margen amplio:
magnitudes negativas y profundidades negativas son válidas.
"""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, Strict, StringConstraints

EventId = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_-]{1,64}$")]
FiniteFloat = Annotated[float, Strict(), Field(allow_inf_nan=False)]
# Milisegundos desde 1970 entre 1900 y 2100.
EpochMillis = Annotated[int, Field(ge=-2_208_988_800_000, le=4_102_444_800_000)]

MAX_FEATURES = 100_000


class _Strict(BaseModel):
    model_config = ConfigDict(strict=True, extra="ignore", frozen=True)


class GeometryDTO(_Strict):
    type: Literal["Point"]
    # JSON trae una lista: el contenedor no es estricto, pero cada valor sí.
    coordinates: Annotated[
        tuple[
            Annotated[FiniteFloat, Field(ge=-180, le=180)],
            Annotated[FiniteFloat, Field(ge=-90, le=90)],
            Annotated[FiniteFloat, Field(ge=-100, le=1000)] | None,
        ],
        Field(strict=False),
    ]


class PropertiesDTO(_Strict):
    mag: Annotated[FiniteFloat, Field(ge=-5, le=12)] | None = None
    magType: Annotated[str, StringConstraints(max_length=16)] | None = None
    place: Annotated[str, StringConstraints(max_length=1000)] | None = None
    time: EpochMillis
    updated: EpochMillis | None = None
    status: Annotated[str, StringConstraints(max_length=16)] | None = None
    type: Annotated[str, StringConstraints(max_length=32)] | None = None
    url: Annotated[str, StringConstraints(max_length=500)] | None = None
    ids: Annotated[str, StringConstraints(max_length=1000)] | None = None


class FeatureDTO(_Strict):
    type: Literal["Feature"]
    id: EventId
    properties: PropertiesDTO
    geometry: GeometryDTO


class FeedMetadataDTO(_Strict):
    generated: EpochMillis


class FeedEnvelopeDTO(_Strict):
    """Envoltorio del feed. Los eventos se validan uno a uno para rechazar solo los malos."""

    type: Literal["FeatureCollection"]
    metadata: FeedMetadataDTO
    features: Annotated[list[object], Field(max_length=MAX_FEATURES)]
