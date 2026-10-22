"""Claves canónicas y acceso a Redis que nunca rompe una petición pública.

Las claves incluyen la versión de esquema y la versión de datos: cuando cambian los
datos cambian las claves, así que nunca hace falta purgar.
"""

import hashlib
import json
import logging
from typing import Any

from django.core.cache import cache
from redis.exceptions import RedisError

logger = logging.getLogger(__name__)


def canonical_digest(namespace: str, parts: dict[str, Any]) -> str:
    payload = json.dumps({"ns": namespace, **parts}, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()[:32]


def safe_get(key: str) -> Any | None:
    try:
        return cache.get(key)
    except (RedisError, OSError) as exc:
        logger.warning("Caché no disponible al leer (%s); sin caché", type(exc).__name__)
        return None


def safe_set(key: str, value: Any, timeout: int) -> None:
    try:
        cache.set(key, value, timeout=timeout)
    except (RedisError, OSError) as exc:
        logger.warning("Caché no disponible al escribir (%s)", type(exc).__name__)
