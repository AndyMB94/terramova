"""Límites de tasa por IP y globales, compartidos entre workers vía Redis.

Si Redis falla, cada proceso aplica un límite propio en memoria con una tasa más baja
(`<scope>_fallback`): la API sigue respondiendo, con límites conservadores, en vez de
fallar con 500 o quedarse sin límite.
"""

import logging
from typing import Any

from django.core.cache.backends.locmem import LocMemCache
from redis.exceptions import RedisError
from rest_framework.request import Request
from rest_framework.throttling import SimpleRateThrottle

logger = logging.getLogger(__name__)

_fallback_cache = LocMemCache("throttle-fallback", {})


class ResilientRateThrottle(SimpleRateThrottle):
    def allow_request(self, request: Request, view: Any) -> bool:
        try:
            return super().allow_request(request, view)
        except (RedisError, OSError) as exc:
            logger.warning(
                "Throttle %s sin Redis (%s); límite local conservador",
                self.scope,
                type(exc).__name__,
            )
            self.cache = _fallback_cache
            self.rate = self.THROTTLE_RATES[f"{self.scope}_fallback"]
            self.num_requests, self.duration = self.parse_rate(self.rate)
            return super().allow_request(request, view)


class PerIpThrottle(ResilientRateThrottle):
    """La IP sale de REMOTE_ADDR o de X-Forwarded-For según NUM_PROXIES (Nginx: 1)."""

    scope = "per_ip"

    def get_cache_key(self, request: Request, view: Any) -> str:
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class GlobalThrottle(ResilientRateThrottle):
    """Freno global ante abuso distribuido; protege al VPS compartido."""

    scope = "global"

    def get_cache_key(self, request: Request, view: Any) -> str:
        return self.cache_format % {"scope": self.scope, "ident": "all"}
