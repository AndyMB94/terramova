from .base import *

DEBUG = False
ALLOWED_HOSTS = ["testserver", "localhost", "127.0.0.1"]
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
AI_ENABLED = False

# Los tests no deben compartir claves con un Redis de desarrollo en uso.
CACHES["default"]["KEY_PREFIX"] = "terramova-test"
