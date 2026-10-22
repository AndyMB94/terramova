from rest_framework import exceptions

from core.api.exception_handler import api_exception_handler
from core.exceptions import DomainError


class EventNotFound(DomainError):
    code = "event_not_found"
    status_code = 404
    default_message = "El evento no existe."


def test_domain_error_maps_to_stable_code_and_message() -> None:
    response = api_exception_handler(EventNotFound(), {})

    assert response is not None
    assert response.status_code == 404
    assert response.data == {"code": "event_not_found", "message": "El evento no existe."}


def test_drf_error_keeps_status_and_uses_code_message_shape() -> None:
    response = api_exception_handler(exceptions.NotFound(), {})

    assert response is not None
    assert response.status_code == 404
    assert response.data["code"] == "not_found"
    assert set(response.data) == {"code", "message"}


def test_throttled_keeps_retry_after_header() -> None:
    response = api_exception_handler(exceptions.Throttled(wait=30), {})

    assert response is not None
    assert response.status_code == 429
    assert response.data["code"] == "rate_limited"
    assert response["Retry-After"] == "30"


def test_validation_error_is_grouped_under_invalid_filters() -> None:
    response = api_exception_handler(
        exceptions.ValidationError({"start": ["Fecha no válida."]}), {}
    )

    assert response is not None
    assert response.status_code == 400
    assert response.data["code"] == "invalid_filters"
    assert response.data["errors"] == {"start": ["Fecha no válida."]}


def test_unexpected_errors_are_left_to_django() -> None:
    assert api_exception_handler(ValueError("detalle interno"), {}) is None
