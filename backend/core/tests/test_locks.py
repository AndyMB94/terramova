from collections.abc import Iterator

import pytest
from django.db import connections
from django.db.backends.base.base import BaseDatabaseWrapper

from core.locks import advisory_lock, lock_key


@pytest.fixture
def other_session() -> Iterator[BaseDatabaseWrapper]:
    """Una segunda conexión real: otra sesión de PostgreSQL, como otro proceso."""
    connection = connections.create_connection("default")
    try:
        yield connection
    finally:
        connection.close()


def try_lock(connection: BaseDatabaseWrapper, name: str) -> bool:
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_try_advisory_lock(%s)", [lock_key(name)])
        row = cursor.fetchone()
        acquired = bool(row and row[0])
        if acquired:
            cursor.execute("SELECT pg_advisory_unlock(%s)", [lock_key(name)])
    return acquired


def test_lock_key_is_stable_and_distinct() -> None:
    assert lock_key("earthquakes:sync") == lock_key("earthquakes:sync")
    assert lock_key("earthquakes:sync") != lock_key("summaries:generate")
    assert -(2**63) <= lock_key("earthquakes:sync") < 2**63


@pytest.mark.integration
@pytest.mark.django_db(transaction=True)
def test_lock_excludes_other_sessions_until_released(other_session: BaseDatabaseWrapper) -> None:
    with advisory_lock("test:lock") as acquired:
        assert acquired is True
        assert try_lock(other_session, "test:lock") is False

    assert try_lock(other_session, "test:lock") is True


@pytest.mark.integration
@pytest.mark.django_db(transaction=True)
def test_lock_reports_busy_when_held_elsewhere(other_session: BaseDatabaseWrapper) -> None:
    with other_session.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_lock(%s)", [lock_key("test:busy")])
    try:
        with advisory_lock("test:busy") as acquired:
            assert acquired is False
    finally:
        with other_session.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_unlock(%s)", [lock_key("test:busy")])
