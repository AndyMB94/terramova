"""Exclusión mutua entre procesos con bloqueos consultivos de PostgreSQL."""

import hashlib
from collections.abc import Iterator
from contextlib import contextmanager

from django.db import connections


def lock_key(name: str) -> int:
    """Clave int64 estable para un nombre (hash() de Python cambia entre procesos)."""
    digest = hashlib.sha256(name.encode()).digest()
    return int.from_bytes(digest[:8], "big", signed=True)


@contextmanager
def advisory_lock(name: str, *, using: str = "default") -> Iterator[bool]:
    """Intenta tomar un bloqueo de sesión sin esperar; produce True si lo obtuvo.

    El bloqueo es de sesión (no de transacción) para cubrir varias transacciones, y
    PostgreSQL lo libera solo si la conexión se cae. No depende de memoria del proceso.
    """
    key = lock_key(name)
    connection = connections[using]
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_try_advisory_lock(%s)", [key])
        row = cursor.fetchone()
    acquired = bool(row and row[0])
    try:
        yield acquired
    finally:
        if acquired:
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_unlock(%s)", [key])
