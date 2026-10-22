"""Casos de uso de la analítica: comparación de ventanas iguales con control de cobertura."""

from dataclasses import dataclass, replace
from enum import StrEnum

from apps.analytics import selectors
from apps.analytics.domain import previous_window, within_coverage
from apps.earthquakes.domain import Coverage, EarthquakeFilters, Window


class ComparisonUnavailable(StrEnum):
    # La ventana anterior cae (en parte) fuera de lo sincronizado: compararla con la
    # actual aparentaría un descenso que en realidad es falta de datos.
    OUTSIDE_COVERAGE = "outside_coverage"
    NO_DATA = "no_data"


@dataclass(frozen=True)
class Comparison:
    previous_window: Window | None
    previous_total: int | None
    unavailable: ComparisonUnavailable | None

    @property
    def available(self) -> bool:
        return self.unavailable is None


def compare_with_previous(
    filters: EarthquakeFilters | None, coverage: Coverage | None
) -> Comparison:
    """Mismos filtros sobre la ventana anterior de igual duración, si está cubierta."""
    if filters is None:
        return Comparison(None, None, ComparisonUnavailable.NO_DATA)
    previous = previous_window(filters.window)
    if not within_coverage(previous, coverage):
        return Comparison(previous, None, ComparisonUnavailable.OUTSIDE_COVERAGE)
    return Comparison(previous, selectors.count(replace(filters, window=previous)), None)
