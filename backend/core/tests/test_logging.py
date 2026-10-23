import json
import logging
import os
import re
import secrets
import subprocess
import sys
from pathlib import Path

import pytest
from django.test import Client

from core.logging import JsonFormatter, RequestIdFilter, request_id_var

GENERATED = re.compile(r"^[0-9a-f]{32}$")
BACKEND = Path(__file__).resolve().parents[2]


def test_request_id_from_nginx_is_echoed(client: Client) -> None:
    response = client.get("/health/live/", headers={"X-Request-ID": "0123456789abcdef"})

    assert response["X-Request-ID"] == "0123456789abcdef"


@pytest.mark.parametrize("incoming", [None, "<script>", "corto", "x" * 65, "a b c d e f g h"])
def test_missing_or_suspicious_request_id_is_replaced(client: Client, incoming: str | None) -> None:
    headers = {} if incoming is None else {"X-Request-ID": incoming}

    response = client.get("/health/live/", headers=headers)

    assert GENERATED.match(response["X-Request-ID"])


def test_json_lines_carry_the_request_id_and_exceptions() -> None:
    record = logging.LogRecord(
        "terramova", logging.ERROR, __file__, 1, "Fallo de %s", ("prueba",), None
    )
    token = request_id_var.set("abcdef0123456789")
    try:
        RequestIdFilter().filter(record)
    finally:
        request_id_var.reset(token)
    try:
        raise ValueError("detalle")
    except ValueError:
        record.exc_info = sys.exc_info()

    entry = json.loads(JsonFormatter().format(record))

    assert entry["message"] == "Fallo de prueba"
    assert entry["level"] == "ERROR"
    assert entry["request_id"] == "abcdef0123456789"
    assert "ValueError: detalle" in entry["exception"]
    assert entry["time"].endswith("+00:00")


def test_production_settings_pass_the_deploy_checks() -> None:
    """Los settings de producción no deben degradarse (HTTPS, cookies, HSTS, DEBUG)."""
    env = {
        **os.environ,
        "DJANGO_SETTINGS_MODULE": "config.settings.prod",
        # Generada en cada ejecución: ningún valor con aspecto de secreto en el repositorio.
        "DJANGO_SECRET_KEY": secrets.token_urlsafe(64),
        "DJANGO_ALLOWED_HOSTS": "terramova.andymallcco.dev",
        "DJANGO_CSRF_TRUSTED_ORIGINS": "https://terramova.andymallcco.dev",
    }
    result = subprocess.run(
        [sys.executable, "manage.py", "check", "--deploy", "--fail-level", "WARNING"],
        cwd=BACKEND,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )

    assert result.returncode == 0, result.stdout + result.stderr
    assert "no issues (2 silenced)" in result.stdout
