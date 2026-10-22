"""Entrada operativa de la sincronización. Códigos de salida:

0  correcta, correcta con rechazos o sin cambios en la fuente
1  fallida (el error queda en el SyncRun)
3  otra sincronización en curso; no se hizo nada
"""

from argparse import ArgumentParser
from typing import Any

from django.core.management.base import BaseCommand, CommandError

from apps.earthquakes.models import SyncRun
from apps.earthquakes.ports import Feed
from apps.earthquakes.services.sync import SyncAlreadyRunning, SyncEarthquakesService
from core.http import HttpClient
from integrations.usgs.client import USER_AGENT, UsgsFeedClient
from integrations.usgs.source import UsgsEarthquakeSource

EXIT_FAILED = 1
EXIT_ALREADY_RUNNING = 3


def build_sync_service() -> SyncEarthquakesService:
    """Raíz de composición: el único punto que conoce el adapter concreto."""
    client = UsgsFeedClient(HttpClient(user_agent=USER_AGENT))
    return SyncEarthquakesService(source=UsgsEarthquakeSource(client))


class Command(BaseCommand):
    help = "Sincroniza eventos sísmicos desde un feed de USGS (day, week o month)."

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument("--feed", required=True, choices=[feed.value for feed in Feed])

    def handle(self, *args: Any, **options: Any) -> None:
        feed = Feed(options["feed"])
        try:
            run = build_sync_service().execute(feed)
        except SyncAlreadyRunning as exc:
            raise CommandError(
                "Otra sincronización está en curso; no se hizo nada.",
                returncode=EXIT_ALREADY_RUNNING,
            ) from exc

        if run.status == SyncRun.Status.FAILED:
            raise CommandError(
                f"Sincronización {feed} fallida: {run.error_code} (SyncRun {run.pk}).",
                returncode=EXIT_FAILED,
            )
        if run.not_modified:
            self.stdout.write(f"Feed {feed} sin cambios desde la última sincronización.")
            return
        self.stdout.write(
            f"Feed {feed} ({run.status}): recibidos {run.received}, creados {run.created}, "
            f"actualizados {run.updated}, sin cambios {run.unchanged}, "
            f"fusionados {run.merged}, rechazados {run.rejected}."
        )
