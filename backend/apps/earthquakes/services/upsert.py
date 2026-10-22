"""Inserta o actualiza eventos por (source, external_id) con política de versión.

Reglas:
- Un evento nuevo se crea.
- Un evento existente se actualiza solo si la fuente trae un `updated` posterior.
- Si el identificador preferido cambió, el evento se localiza por cualquiera de sus
  identificadores (`source_ids`) y se renombra en vez de duplicarse.
- Si varias filas resultan ser el mismo evento (fusión en la fuente), se conserva una y
  se borran las demás (decisión D42).
- Nunca se borra un evento por faltar en un feed.

Se ejecuta en una única transacción: o se aplica el lote entero o nada.
"""

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import datetime

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.earthquakes.models import Earthquake
from apps.earthquakes.ports import EarthquakeRecord

UPDATABLE_FIELDS = [
    "external_id",
    "source_ids",
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
    "updated_at",
]
QUERY_CHUNK_SIZE = 5000
WRITE_BATCH_SIZE = 1000


@dataclass
class UpsertResult:
    created: int = 0
    updated: int = 0
    unchanged: int = 0
    merged: int = 0


def upsert_earthquakes(source: str, records: Sequence[EarthquakeRecord]) -> UpsertResult:
    result = UpsertResult()
    batch = _latest_per_event(records)
    now = timezone.now()

    by_alias: dict[str, Earthquake] = {}
    for row in _existing_rows(source, {alias for r in batch for alias in r.source_ids}):
        _index(by_alias, row)

    to_create: list[Earthquake] = []
    to_update: dict[object, Earthquake] = {}
    to_delete: dict[object, Earthquake] = {}

    for record in batch:
        matches = _unique(by_alias[alias] for alias in record.source_ids if alias in by_alias)
        if not matches:
            row = Earthquake(source=source)
            _apply(row, record, now)
            to_create.append(row)
            _index(by_alias, row)
            result.created += 1
            continue

        primary = _choose_primary(matches, record.external_id)
        for duplicate in matches:
            if duplicate is primary:
                continue
            _unindex(by_alias, duplicate)
            if duplicate._state.adding:
                # Creada en este mismo lote: basta con no insertarla.
                to_create.remove(duplicate)
                result.created -= 1
            else:
                to_update.pop(duplicate.pk, None)
                to_delete[duplicate.pk] = duplicate
            result.merged += 1

        if not _should_update(primary, record):
            result.unchanged += 1
            continue
        _unindex(by_alias, primary)
        _apply(primary, record, now)
        _index(by_alias, primary)
        if primary._state.adding:
            continue  # Se insertará con los datos más recientes; ya cuenta como creada.
        to_update[primary.pk] = primary
        result.updated += 1

    with transaction.atomic():
        if to_delete:
            Earthquake.objects.filter(pk__in=list(to_delete)).delete()
        if to_update:
            Earthquake.objects.bulk_update(
                list(to_update.values()), UPDATABLE_FIELDS, batch_size=WRITE_BATCH_SIZE
            )
        if to_create:
            Earthquake.objects.bulk_create(to_create, batch_size=WRITE_BATCH_SIZE)
    return result


def _latest_per_event(records: Sequence[EarthquakeRecord]) -> list[EarthquakeRecord]:
    """Si un mismo identificador aparece repetido en el lote, gana la versión más reciente."""
    latest: dict[str, EarthquakeRecord] = {}
    for record in records:
        current = latest.get(record.external_id)
        if current is None or record.source_updated_at > current.source_updated_at:
            latest[record.external_id] = record
    return list(latest.values())


def _existing_rows(source: str, aliases: set[str]) -> list[Earthquake]:
    rows: dict[object, Earthquake] = {}
    ordered = sorted(aliases)
    for start in range(0, len(ordered), QUERY_CHUNK_SIZE):
        chunk = ordered[start : start + QUERY_CHUNK_SIZE]
        query = Earthquake.objects.filter(source=source).filter(
            Q(external_id__in=chunk) | Q(source_ids__overlap=chunk)
        )
        for row in query:
            rows[row.pk] = row
    return list(rows.values())


def _index(by_alias: dict[str, Earthquake], row: Earthquake) -> None:
    for alias in {row.external_id, *row.source_ids}:
        by_alias[alias] = row


def _unindex(by_alias: dict[str, Earthquake], row: Earthquake) -> None:
    for alias in {row.external_id, *row.source_ids}:
        if by_alias.get(alias) is row:
            del by_alias[alias]


def _unique(rows: Iterable[Earthquake]) -> list[Earthquake]:
    seen: list[Earthquake] = []
    for row in rows:
        if not any(row is other for other in seen):
            seen.append(row)
    return seen


def _choose_primary(matches: list[Earthquake], external_id: str) -> Earthquake:
    for row in matches:
        if row.external_id == external_id:
            return row
    return max(matches, key=lambda row: row.source_updated_at)


def _should_update(row: Earthquake, record: EarthquakeRecord) -> bool:
    if record.source_updated_at > row.source_updated_at:
        return True
    renamed = row.external_id != record.external_id
    return renamed and record.source_updated_at == row.source_updated_at


def _apply(row: Earthquake, record: EarthquakeRecord, now: datetime) -> None:
    row.external_id = record.external_id
    row.source_ids = list(record.source_ids)
    row.occurred_at = record.occurred_at
    row.source_updated_at = record.source_updated_at
    row.magnitude = record.magnitude
    row.magnitude_type = record.magnitude_type
    row.longitude = record.longitude
    row.latitude = record.latitude
    row.depth_km = record.depth_km
    row.place = record.place
    row.status = record.status
    row.event_type = record.event_type
    row.source_url = record.source_url
    row.updated_at = now
