import pytest
from django.core.cache import cache
from django.db import OperationalError, connection
from django.test import Client
from redis.exceptions import ConnectionError as RedisConnectionError

from core.health import views


def test_live_responds_without_checking_dependencies(client: Client) -> None:
    response = client.get("/health/live/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.integration
@pytest.mark.django_db
def test_ready_with_real_postgres_and_redis(client: Client) -> None:
    response = client.get("/health/ready/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_returns_503_without_details_when_database_fails(
    client: Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    def broken_cursor() -> None:
        raise OperationalError("could not connect to server: db:5432 password=secreto")

    monkeypatch.setattr(connection, "cursor", broken_cursor)
    monkeypatch.setattr(views, "cache_is_available", lambda: True)

    response = client.get("/health/ready/")

    assert response.status_code == 503
    assert response.json()["code"] == "temporarily_unavailable"
    assert "secreto" not in response.content.decode()
    assert "5432" not in response.content.decode()


def test_ready_returns_503_when_cache_fails(
    client: Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    def broken_set(*args: object, **kwargs: object) -> None:
        raise RedisConnectionError("Error connecting to redis:6379")

    monkeypatch.setattr(views, "database_is_available", lambda: True)
    monkeypatch.setattr(cache, "set", broken_set)

    response = client.get("/health/ready/")

    assert response.status_code == 503
    assert response.json()["code"] == "temporarily_unavailable"
    assert "6379" not in response.content.decode()
