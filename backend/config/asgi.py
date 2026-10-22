# DJANGO_SETTINGS_MODULE se exige explícitamente: un servidor no debe arrancar con la
# configuración de desarrollo por omisión.
from django.core.asgi import get_asgi_application

application = get_asgi_application()
