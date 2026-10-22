from django.apps import AppConfig


class EarthquakesConfig(AppConfig):
    name = "apps.earthquakes"
    label = "earthquakes"
    verbose_name = "Sismos"
    default_auto_field = "django.db.models.BigAutoField"
