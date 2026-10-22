"""Caso de uso: sincronizar un feed de la fuente con la base de datos."""

import logging
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from django.db import DatabaseError
from django.utils import timezone

from apps.earthquakes.models import SyncRun
from apps.earthquakes.ports import (
    EarthquakeRecord,
    EarthquakeSource,
    Feed,
    FeedBatch,
    FeedNotModified,
    RejectedRecord,
)
from apps.earthquakes.selectors import last_successful_sync
from apps.earthquakes.services.upsert import upsert_earthquakes
from core.exceptions import ExternalServiceError
from core.locks import advisory_lock

logger = logging.getLogger(__name__)

# Un único bloqueo para todos los feeds: day/week/month escriben las mismas filas.
SYNC_LOCK_NAME = "earthquakes:sync"
# Se aceptan eventos de los últimos 31 días (el feed mensual cubre 30) y hasta 1 h en
# el futuro por desfases de reloj; lo demás se rechaza como fuera de ventana.
MAX_EVENT_AGE = timedelta(days=31)
MAX_CLOCK_SKEW = timedelta(hours=1)


class SyncAlreadyRunning(Exception):
    """Otra sincronización tiene el bloqueo; esta termina sin hacer nada."""


@dataclass
class SyncEarthquakesService:
    source: EarthquakeSource
    clock: Callable[[], datetime] = field(default=timezone.now)

    def execute(self, feed: Feed) -> SyncRun:
        with advisory_lock(SYNC_LOCK_NAME) as acquired:
            if not acquired:
                raise SyncAlreadyRunning
            _mark_interrupted_runs()
            run = SyncRun.objects.create(
                source=self.source.source_name, feed=feed, started_at=self.clock()
            )
            return self._run(run, feed)

    def _run(self, run: SyncRun, feed: Feed) -> SyncRun:
        previous = last_successful_sync(feed)
        if_modified_since = previous.source_last_modified if previous else ""

        # La descarga ocurre fuera de cualquier transacción.
        try:
            result = self.source.fetch_feed(feed, if_modified_since=if_modified_since)
        except ExternalServiceError as exc:
            logger.warning("Sync %s: la fuente falló (%s)", feed, exc.reason)
            return self._finish(run, SyncRun.Status.FAILED, error_code=f"source_{exc.reason}")

        if isinstance(result, FeedNotModified):
            run.not_modified = True
            run.source_last_modified = result.last_modified
            return self._finish(run, SyncRun.Status.SUCCEEDED)
        return self._apply(run, feed, result)

    def _apply(self, run: SyncRun, feed: Feed, batch: FeedBatch) -> SyncRun:
        accepted, out_of_window = self._split_by_window(batch.records)
        rejected = [*batch.rejected, *out_of_window]

        run.received = batch.received
        run.rejected = len(rejected)
        run.rejected_reasons = dict(Counter(item.reason for item in rejected))
        run.source_generated_at = batch.generated_at
        run.window_start = batch.generated_at - feed.period
        run.window_end = batch.generated_at

        if batch.received and not accepted:
            logger.error("Sync %s: se rechazaron los %d eventos recibidos", feed, batch.received)
            return self._finish(run, SyncRun.Status.FAILED, error_code="all_records_rejected")

        try:
            upserted = upsert_earthquakes(self.source.source_name, accepted)
        except DatabaseError:
            logger.exception("Sync %s: error de base de datos al guardar el lote", feed)
            return self._finish(run, SyncRun.Status.FAILED, error_code="database_error")

        run.created = upserted.created
        run.updated = upserted.updated
        run.unchanged = upserted.unchanged
        run.merged = upserted.merged
        # Solo una sincronización aplicada guarda Last-Modified: si falló, la siguiente
        # vuelve a descargar el feed completo.
        run.source_last_modified = batch.last_modified
        if rejected:
            logger.warning(
                "Sync %s: %d eventos rechazados %s", feed, len(rejected), run.rejected_reasons
            )
            return self._finish(run, SyncRun.Status.PARTIAL)
        return self._finish(run, SyncRun.Status.SUCCEEDED)

    def _split_by_window(
        self, records: tuple[EarthquakeRecord, ...]
    ) -> tuple[list[EarthquakeRecord], list[RejectedRecord]]:
        now = self.clock()
        oldest, newest = now - MAX_EVENT_AGE, now + MAX_CLOCK_SKEW
        accepted: list[EarthquakeRecord] = []
        rejected: list[RejectedRecord] = []
        for record in records:
            if oldest <= record.occurred_at <= newest:
                accepted.append(record)
            else:
                rejected.append(RejectedRecord(record.external_id, "out_of_window"))
        return accepted, rejected

    def _finish(self, run: SyncRun, status: str, *, error_code: str = "") -> SyncRun:
        run.status = status
        run.error_code = error_code
        run.finished_at = self.clock()
        run.save()
        return run


def _mark_interrupted_runs() -> None:
    """Con el bloqueo tomado, ninguna otra ejecución puede seguir viva."""
    stale = SyncRun.objects.filter(status=SyncRun.Status.RUNNING)
    count = stale.update(
        status=SyncRun.Status.FAILED, error_code="interrupted", finished_at=timezone.now()
    )
    if count:
        logger.warning("Se marcaron %d sincronizaciones interrumpidas como fallidas", count)
