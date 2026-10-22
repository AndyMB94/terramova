"""Reglas puras de la analítica: bandas, granularidad de la línea temporal y ventanas.

Sin ORM. Las clases de profundidad coinciden con la leyenda del globo
(frontend/src/shared/lib/depth.ts) para que gráficas y mapa hablen el mismo idioma.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum

from apps.earthquakes.domain import Coverage, Window


@dataclass(frozen=True)
class Band:
    """Intervalo [lower, upper); un extremo None significa sin límite."""

    key: str
    lower: float | None
    upper: float | None


MAGNITUDE_BANDS: tuple[Band, ...] = (
    Band("lt1", None, 1),
    Band("1-2", 1, 2),
    Band("2-3", 2, 3),
    Band("3-4", 3, 4),
    Band("4-5", 4, 5),
    Band("5-6", 5, 6),
    Band("6-7", 6, 7),
    Band("7plus", 7, None),
)

# La primera clase incluye profundidades negativas (focos sobre el nivel del mar).
DEPTH_CLASSES: tuple[Band, ...] = (
    Band("0-35", None, 35),
    Band("35-70", 35, 70),
    Band("70-150", 70, 150),
    Band("150-300", 150, 300),
    Band("300plus", 300, None),
)


class Granularity(StrEnum):
    HOUR = "hour"
    DAY = "day"

    @property
    def step(self) -> timedelta:
        return timedelta(hours=1) if self is Granularity.HOUR else timedelta(days=1)


# Hasta 48 h se agrupa por hora (≤ 49 barras); con más, por día (≤ 32 barras en 31 días).
HOURLY_UP_TO = timedelta(hours=48)


def granularity_for(window: Window) -> Granularity:
    return Granularity.HOUR if window.end - window.start <= HOURLY_UP_TO else Granularity.DAY


def floor_to(value: datetime, granularity: Granularity) -> datetime:
    """Inicio del intervalo UTC que contiene `value` (las fechas de la API ya son UTC)."""
    floored = value.replace(minute=0, second=0, microsecond=0)
    return floored.replace(hour=0) if granularity is Granularity.DAY else floored


def bucket_starts(window: Window, granularity: Granularity) -> list[datetime]:
    """Todos los intervalos que tocan la ventana, también los vacíos: sin huecos ocultos."""
    starts = []
    current = floor_to(window.start, granularity)
    while current < window.end:
        starts.append(current)
        current += granularity.step
    return starts


def previous_window(window: Window) -> Window:
    """Ventana de la misma duración inmediatamente anterior."""
    return Window(window.start - (window.end - window.start), window.start)


def within_coverage(window: Window, coverage: Coverage | None) -> bool:
    """Solo se compara con una ventana que la cobertura incluye entera."""
    return coverage is not None and coverage.start <= window.start and window.end <= coverage.end
