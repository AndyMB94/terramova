from .base import *

DEBUG = False
ALLOWED_HOSTS = ["testserver", "localhost", "127.0.0.1"]
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
AI_ENABLED = False

# Base de Redis propia (15): los tests la vacían sin tocar la caché de desarrollo.
CACHES["default"]["LOCATION"] = str(CACHES["default"]["LOCATION"]).rsplit("/", 1)[0] + "/15"
CACHES["default"]["KEY_PREFIX"] = "terramova-test"
