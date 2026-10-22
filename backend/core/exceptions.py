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
