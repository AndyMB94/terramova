"""Cliente HTTP saliente con límites explícitos: timeouts, tamaño máximo y reintentos."""

import logging
import time
from collections.abc import Callable, Mapping
from dataclasses import dataclass

import httpx

from core.exceptions import ExternalServiceError

logger = logging.getLogger(__name__)

MEGABYTE = 1024 * 1024


@dataclass(frozen=True)
class HttpResponse:
    status_code: int
    headers: Mapping[str, str]
    content: bytes


class _RetryableError(Exception):
    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)


class HttpClient:
    """GET con reintentos solo ante fallos de red, timeouts y respuestas 5xx.

    El tamaño máximo se aplica al cuerpo ya descomprimido y se comprueba mientras se
    lee, para no cargar en memoria respuestas desmesuradas. Las respuestas 2xx y 304 se
    devuelven; cualquier otra termina en ExternalServiceError. No sigue redirecciones:
    las URLs de los adapters son fijas.
    """

    def __init__(
        self,
        *,
        user_agent: str,
        connect_timeout: float = 5.0,
        read_timeout: float = 20.0,
        total_timeout: float = 60.0,
        max_bytes: int = 50 * MEGABYTE,
        max_attempts: int = 3,
        backoff_seconds: float = 1.0,
        transport: httpx.BaseTransport | None = None,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._user_agent = user_agent
        self._timeout = httpx.Timeout(read_timeout, connect=connect_timeout)
        self._total_timeout = total_timeout
        self._max_bytes = max_bytes
        self._max_attempts = max_attempts
        self._backoff_seconds = backoff_seconds
        self._transport = transport
        self._sleep = sleep
        self._clock = clock

    def get(self, url: str, headers: Mapping[str, str] | None = None) -> HttpResponse:
        request_headers = {"User-Agent": self._user_agent, "Accept-Encoding": "gzip"}
        request_headers.update(headers or {})

        for attempt in range(1, self._max_attempts + 1):
            try:
                return self._get_once(url, request_headers)
            except _RetryableError as exc:
                if attempt == self._max_attempts:
                    raise ExternalServiceError(exc.reason) from exc
                delay = self._backoff_seconds * 2 ** (attempt - 1)
                logger.warning(
                    "GET %s falló (%s); reintento %d/%d en %.1f s",
                    url,
                    exc.reason,
                    attempt,
                    self._max_attempts - 1,
                    delay,
                )
                self._sleep(delay)
        raise AssertionError("unreachable")  # pragma: no cover

    def _get_once(self, url: str, headers: Mapping[str, str]) -> HttpResponse:
        deadline = self._clock() + self._total_timeout
        try:
            with (
                httpx.Client(
                    timeout=self._timeout, transport=self._transport, follow_redirects=False
                ) as client,
                client.stream("GET", url, headers=headers) as response,
            ):
                if response.status_code >= 500:
                    raise _RetryableError("http_status")
                if response.status_code == 304:
                    return HttpResponse(304, dict(response.headers), b"")
                if not 200 <= response.status_code < 300:
                    raise ExternalServiceError("http_status")
                content = self._read_limited(response, deadline)
                return HttpResponse(response.status_code, dict(response.headers), content)
        except httpx.TimeoutException as exc:
            raise _RetryableError("timeout") from exc
        except httpx.TransportError as exc:
            raise _RetryableError("connection") from exc

    def _read_limited(self, response: httpx.Response, deadline: float) -> bytes:
        declared = response.headers.get("Content-Length")
        if declared is not None and declared.isdigit() and int(declared) > self._max_bytes:
            raise ExternalServiceError("too_large")

        chunks: list[bytes] = []
        size = 0
        for chunk in response.iter_bytes():
            size += len(chunk)
            if size > self._max_bytes:
                raise ExternalServiceError("too_large")
            if self._clock() > deadline:
                raise _RetryableError("timeout")
            chunks.append(chunk)
        return b"".join(chunks)
