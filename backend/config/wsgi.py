# DJANGO_SETTINGS_MODULE se exige explícitamente: un servidor no debe arrancar con la
# configuración de desarrollo por omisión.
from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()
