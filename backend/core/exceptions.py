class DomainError(Exception):
    """Error esperado de un caso de uso, con código estable para la API.

    Las subclases fijan `code`, `status_code` y `default_message`; el mensaje es apto
    para mostrarse al público y nunca incluye datos internos.
    """

    code = "domain_error"
    status_code = 400
    default_message = "No se pudo completar la operación."

    def __init__(self, message: str | None = None) -> None:
        self.message = message or self.default_message
        super().__init__(self.message)


class ExternalServiceError(DomainError):
    """Un servicio externo falló o respondió algo inutilizable.

    `reason` es un código estable para logs y registros de sincronización
    (p. ej. "timeout", "http_status", "too_large", "invalid_payload"); nunca contiene
    el contenido de la respuesta.
    """

    code = "temporarily_unavailable"
    status_code = 503
    default_message = "Un servicio externo no está disponible temporalmente."

    def __init__(self, reason: str, message: str | None = None) -> None:
        self.reason = reason
        super().__init__(message)
