"""DTO de USGS → EarthquakeRecord. Un evento inválido se rechaza sin abortar el lote."""

import json
import re
from dataclasses import dataclass
from datetime import UTC, datetime

from pydantic import ValidationError

from apps.earthquakes.ports import EarthquakeRecord, RejectedRecord
from core.exceptions import ExternalServiceError
from integrations.usgs.dto import FeatureDTO, FeedEnvelopeDTO

TRUSTED_URL_PREFIX = "https://earthquake.usgs.gov/"
MAX_SOURCE_IDS = 10
PLACE_MAX_LENGTH = 255
_EVENT_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")

# Primer campo inválido → código estable de rechazo.
_REASON_BY_FIELD = {
    "id": "invalid_id",
    "geometry": "invalid_geometry",
    "time": "invalid_time",
    "updated": "invalid_time",
    "mag": "invalid_magnitude",
}


@dataclass(frozen=True)
class ParsedFeed:
    generated_at: datetime
    records: tuple[EarthquakeRecord, ...]
    rejected: tuple[RejectedRecord, ...]


def parse_feed(content: bytes) -> ParsedFeed:
    try:
        raw = json.loads(content, parse_constant=_reject_non_finite)
        envelope = FeedEnvelopeDTO.model_validate(raw)
    except (ValueError, ValidationError) as exc:
        raise ExternalServiceError("invalid_payload") from exc

    records: list[EarthquakeRecord] = []
    rejected: list[RejectedRecord] = []
    for raw_feature in envelope.features:
        try:
            feature = FeatureDTO.model_validate(raw_feature)
        except ValidationError as exc:
            rejected.append(RejectedRecord(_raw_id(raw_feature), _reason(exc)))
            continue
        records.append(to_record(feature))
    return ParsedFeed(_from_millis(envelope.metadata.generated), tuple(records), tuple(rejected))


def to_record(feature: FeatureDTO) -> EarthquakeRecord:
    props = feature.properties
    longitude, latitude, depth_km = feature.geometry.coordinates
    occurred_at = _from_millis(props.time)
    updated_at = _from_millis(props.updated) if props.updated is not None else occurred_at
    return EarthquakeRecord(
        external_id=feature.id,
        source_ids=_source_ids(feature.id, props.ids),
        occurred_at=occurred_at,
        source_updated_at=max(updated_at, occurred_at),
        magnitude=props.mag,
        magnitude_type=props.magType or "",
        longitude=longitude,
        latitude=latitude,
        depth_km=depth_km,
        place=(props.place or "")[:PLACE_MAX_LENGTH],
        status=props.status or "",
        event_type=props.type or "",
        source_url=_trusted_url(props.url),
    )


def _source_ids(preferred: str, ids: str | None) -> tuple[str, ...]:
    """`ids` llega como ",a,b,c,". Se descartan valores con formato inválido."""
    aliases = [alias for alias in (ids or "").split(",") if _EVENT_ID.match(alias)]
    ordered = [preferred, *(alias for alias in aliases if alias != preferred)]
    return tuple(dict.fromkeys(ordered))[:MAX_SOURCE_IDS]


def _trusted_url(url: str | None) -> str:
    """Solo enlaces a USGS por HTTPS; cualquier otra cosa se descarta (no se rechaza el evento)."""
    if url and url.startswith(TRUSTED_URL_PREFIX):
        return url
    return ""


def _from_millis(value: int) -> datetime:
    return datetime.fromtimestamp(value / 1000, tz=UTC)


def _reject_non_finite(constant: str) -> float:
    raise ValueError(f"valor no finito en el JSON: {constant}")


def _raw_id(raw: object) -> str | None:
    if isinstance(raw, dict):
        value = raw.get("id")
        if isinstance(value, str) and _EVENT_ID.match(value):
            return value
    return None


def _reason(exc: ValidationError) -> str:
    for error in exc.errors():
        for part in error["loc"]:
            if isinstance(part, str) and part in _REASON_BY_FIELD:
                return _REASON_BY_FIELD[part]
    return "invalid_record"
