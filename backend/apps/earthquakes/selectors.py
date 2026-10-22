from apps.earthquakes.models import SyncRun
from apps.earthquakes.ports import Feed


def last_successful_sync(feed: Feed | None = None) -> SyncRun | None:
    runs = SyncRun.objects.filter(status__in=SyncRun.SUCCESSFUL_STATUSES)
    if feed is not None:
        runs = runs.filter(feed=feed)
    return runs.order_by("-started_at", "-id").first()


def current_data_version() -> int:
    """Identificador de la última sincronización que cambió filas (0 si ninguna).

    Las cachés de la API (Fase 2) lo usan en sus claves: cambia solo cuando cambian
    los datos, así que no hay que purgar nada.
    """
    run = (
        SyncRun.objects.filter(status__in=SyncRun.SUCCESSFUL_STATUSES)
        .exclude(created=0, updated=0, merged=0)
        .order_by("-id")
        .only("id")
        .first()
    )
    return run.id if run else 0
