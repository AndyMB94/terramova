# Fixtures pytest globales. pytest-django aporta `client`, `settings` y `django_db`.
from collections.abc import Iterator

import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def _empty_cache() -> Iterator[None]:
    """Cada test empieza con la caché de tests (Redis, base 15) vacía."""
    cache.clear()
    yield
