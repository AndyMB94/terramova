"""Paginación por cursor (keyset) estable ante inserciones.

La CursorPagination de DRF posiciona con el primer campo de orden más un
desplazamiento; con muchos empates (p. ej. cientos de eventos de igual magnitud) una
inserción entre páginas produce duplicados o saltos. Aquí el cursor guarda el par
(valor, pk) del último elemento y la página siguiente empieza estrictamente después,
con orden descendente, nulos al final y desempate por pk.
"""

import base64
import binascii
import json
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from django.db.models import F, Model, Q, QuerySet

from core.exceptions import DomainError


class InvalidCursor(DomainError):
    code = "invalid_filters"
    status_code = 400
    default_message = "El cursor de paginación no es válido."


@dataclass(frozen=True)
class KeysetPage[T: Model]:
    items: list[T]
    next_cursor: str | None


def paginate_keyset[T: Model](
    queryset: QuerySet[T],
    *,
    field: str,
    page_size: int,
    cursor: str | None,
    parse_value: Callable[[Any], Any],
    dump_value: Callable[[Any], Any],
) -> KeysetPage[T]:
    """Página descendente por (field, pk); `field` puede contener nulos (van al final)."""
    ordered = queryset.order_by(F(field).desc(nulls_last=True), "-pk")
    if cursor:
        value, pk = _decode(cursor, field, parse_value)
        ordered = ordered.filter(_after(field, value, pk))

    rows = list(ordered[: page_size + 1])
    items = rows[:page_size]
    next_cursor = None
    if len(rows) > page_size:
        last = items[-1]
        next_cursor = _encode(field, dump_value(getattr(last, field)), last.pk)
    return KeysetPage(items, next_cursor)


def _after(field: str, value: Any, pk: UUID) -> Q:
    if value is None:
        return Q(**{f"{field}__isnull": True, "pk__lt": pk})
    return (
        Q(**{f"{field}__lt": value})
        | Q(**{field: value, "pk__lt": pk})
        | Q(**{f"{field}__isnull": True})
    )


def _encode(field: str, value: Any, pk: UUID) -> str:
    payload = json.dumps({"f": field, "v": value, "pk": str(pk)}, separators=(",", ":"))
    return base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")


def _decode(cursor: str, field: str, parse_value: Callable[[Any], Any]) -> tuple[Any, UUID]:
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded.encode()))
        if not isinstance(payload, dict) or payload.get("f") != field:
            raise InvalidCursor
        pk = UUID(str(payload["pk"]))
        raw = payload.get("v")
        return (None if raw is None else parse_value(raw)), pk
    except (ValueError, KeyError, TypeError, binascii.Error) as exc:
        raise InvalidCursor from exc
